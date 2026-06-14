import { format } from "date-fns";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import prisma from "@/lib/prisma";
import { downloadR2Object } from "@/lib/r2";
import { getFilePreviewInfo } from "@/lib/file-preview";
import { ensureFileMarkupPdf, markupFilename } from "@/lib/markup/generate";

export type ExportOptions = {
  destination: "zip" | "share_link" | "google_drive" | "onedrive";
  dateRange?: {
    start?: string; // YYYY-MM-DD
    end?: string;   // YYYY-MM-DD
  };
  categories: string[]; // ["photos", "notes", "punch_list", "progress_updates", "daily_reports", "material_tickets", "other"]
  includeSummaryPdf: boolean;
  includeItemIndexCsv: boolean;
  includeTextWorkbook: boolean;
  renameFilesForReadability: boolean;
  groupByCategory: boolean;
};

type ExportZipOptions = Partial<Pick<ExportOptions, "includeSummaryPdf" | "includeItemIndexCsv" | "includeTextWorkbook">>;

export type ExportManifest = {
  jobBucket: {
    id: string;
    name: string;
    jobNumber?: string;
    poNumber?: string;
    customerName?: string;
    status: string;
    createdAt: string;
  };
  export: {
    generatedAt: string;
    generatedBy: string;
    dateRange?: {
      start: string;
      end: string;
    };
    destination: string;
  };
  folders: string[];
  items: ExportItem[];
  warnings: string[];
};

export type ExportItem = {
  id: string;
  category: string; // e.g. "Photos", "Punch List", "Progress Updates", "Daily Reports", "Material Tickets", "Notes", "Other"
  itemType: "FILE" | "NOTE" | "TASK";
  textItemType?: "GENERAL" | "PROGRESS" | "TASK" | "PUNCH_LIST";
  createdAt: string;
  createdBy: string;
  title?: string;
  description?: string;
  noteCategory?: string;
  statusTag?: string;
  taskStatus?: "OPEN" | "IN_PROGRESS" | "DONE";
  priority?: number | null;
  dueDate?: string;
  assignedTo?: string;
  originalFileName?: string;
  exportedFileName: string; // resolved and unique
  folderPath: string; // e.g. "01 - Photos"
  storageKey?: string; // R2 key
  appUrl?: string;
};

export class ExportJobPackageService {
  /**
   * Builds the destination-agnostic manifest of all elements to be exported.
   */
  static async buildManifest(
    jobId: string,
    options: ExportOptions,
    userId: string,
    companyId: string,
  ): Promise<ExportManifest> {
    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId },
      include: {
        createdBy: { select: { name: true, email: true } },
        files: {
          include: { uploader: { select: { name: true, email: true } } },
        },
        notes: {
          include: { author: { select: { name: true, email: true } } },
        },
        tasks: {
          include: {
            assignedTo: { select: { name: true, email: true } },
            createdBy: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!job) {
      throw new Error(`Job bucket with ID ${jobId} not found or access denied.`);
    }

    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    // Date range boundaries
    let startBoundary: Date | null = null;
    let endBoundary: Date | null = null;
    if (options.dateRange?.start) {
      startBoundary = new Date(options.dateRange.start);
      startBoundary.setUTCHours(0, 0, 0, 0);
    }
    if (options.dateRange?.end) {
      endBoundary = new Date(options.dateRange.end);
      endBoundary.setUTCHours(23, 59, 59, 999);
    }

    const isWithinDateRange = (date: Date) => {
      if (startBoundary && date < startBoundary) return false;
      if (endBoundary && date > endBoundary) return false;
      return true;
    };

    const includedCategories = new Set(options.categories.map((c) => c.toLowerCase()));

    // Files that have at least one (non-deleted) markup — only queried when the
    // "markups" category is requested.
    const includeMarkups = includedCategories.has("markups");
    let filesWithMarks = new Set<string>();
    if (includeMarkups && job.files.length > 0) {
      const marked = await prisma.fileMarkupMark.findMany({
        where: { fileId: { in: job.files.map((f) => f.id) }, deletedAt: null },
        select: { fileId: true },
        distinct: ["fileId"],
      });
      filesWithMarks = new Set(marked.map((m) => m.fileId));
    }

    const items: ExportItem[] = [];
    const warnings: string[] = [];
    // Files needing a flattened marked-up PDF added beside their original. Resolved
    // after classification so each markup reuses its file's home folder.
    const markupCandidates: { file: (typeof job.files)[number]; folderPath: string }[] = [];

    // Helper to get author name
    const getUserDisplayName = (u: { name: string | null; email: string | null } | null) => {
      if (!u) return "System";
      return u.name || u.email || "Unknown User";
    };

    // 1. PROCESS FILES
    for (const file of job.files) {
      if (!isWithinDateRange(file.createdAt)) continue;

      let folderPath = "";
      let category = "";
      let isIncluded = false;

      const fileCategory = file.category?.toLowerCase() || "";

      // Rule classification
      if (file.type === "PHOTO") {
        isIncluded = includedCategories.has("photos");
        folderPath = "01 - Photos";
        category = "Photos";
      } else if (file.taskId) {
        const associatedTask = job.tasks.find((t) => t.id === file.taskId);
        if (associatedTask?.type === "PUNCH_LIST") {
          isIncluded = includedCategories.has("punch_list");
          folderPath = "02 - Punch List";
          category = "Punch List";
        } else {
          isIncluded = includedCategories.has("other");
          folderPath = "99 - Other";
          category = "Other";
        }
      } else if (file.noteId) {
        const associatedNote = job.notes.find((n) => n.id === file.noteId);
        if (associatedNote?.type === "PROGRESS") {
          isIncluded = includedCategories.has("progress_updates");
          folderPath = "03 - Progress Updates";
          category = "Progress Updates";
        } else {
          isIncluded = includedCategories.has("notes");
          folderPath = "06 - Notes";
          category = "Notes";
        }
      } else if (fileCategory === "daily reports" || fileCategory.startsWith("daily")) {
        isIncluded = includedCategories.has("daily_reports");
        folderPath = "04 - Daily Reports";
        category = "Daily Reports";
      } else if (
        ["material", "receipts", "quotes", "invoices", "receipt", "cut sheets", "material tickets"].includes(fileCategory)
      ) {
        isIncluded = includedCategories.has("material_tickets");
        folderPath = "05 - Material Tickets";
        category = "Material Tickets";
      } else {
        isIncluded = includedCategories.has("other");
        folderPath = "99 - Other";
        category = "Other";
      }

      if (isIncluded) {
        items.push({
          id: file.id,
          category,
          itemType: "FILE",
          createdAt: file.createdAt.toISOString(),
          createdBy: getUserDisplayName(file.uploader),
          title: file.name || file.originalName,
          description: file.category || undefined,
          originalFileName: file.originalName,
          exportedFileName: "", // Will be filled in naming step
          folderPath: options.groupByCategory ? folderPath : "",
          storageKey: file.url,
        });
      }

      // Collect marked-up version (placed beside the original in its home folder).
      // Independent of the original's inclusion so "Markups" works as its own category.
      if (includeMarkups && filesWithMarks.has(file.id)) {
        const { renderMode } = getFilePreviewInfo({
          filename: file.name || file.originalName,
          contentType: file.contentType,
        });
        if (renderMode === "pdf" || renderMode === "image") {
          markupCandidates.push({ file, folderPath });
        }
      }
    }

    // 2. PROCESS NOTES
    for (const note of job.notes) {
      if (!isWithinDateRange(note.createdAt)) continue;

      let folderPath = "";
      let category = "";
      let isIncluded = false;

      const noteCategory = note.category?.toLowerCase() || "";

      if (note.type === "PROGRESS") {
        isIncluded = includedCategories.has("progress_updates");
        folderPath = "03 - Progress Updates";
        category = "Progress Updates";
      } else if (noteCategory === "daily reports" || noteCategory.startsWith("daily")) {
        isIncluded = includedCategories.has("daily_reports");
        folderPath = "04 - Daily Reports";
        category = "Daily Reports";
      } else if (
        ["material", "receipts", "quotes", "invoices", "receipt", "cut sheets", "material tickets"].includes(noteCategory)
      ) {
        isIncluded = includedCategories.has("material_tickets");
        folderPath = "05 - Material Tickets";
        category = "Material Tickets";
      } else if (note.type === "GENERAL") {
        isIncluded = includedCategories.has("notes");
        folderPath = "06 - Notes";
        category = "Notes";
      } else {
        isIncluded = includedCategories.has("other");
        folderPath = "99 - Other";
        category = "Other";
      }

      if (isIncluded) {
        items.push({
          id: note.id,
          category,
          itemType: "NOTE",
          textItemType: note.type,
          createdAt: note.createdAt.toISOString(),
          createdBy: getUserDisplayName(note.author),
          title: note.statusTag || note.category || "Note",
          description: note.content,
          noteCategory: note.category || undefined,
          statusTag: note.statusTag || undefined,
          exportedFileName: "", // Resolved in naming step
          folderPath: options.groupByCategory ? folderPath : "",
        });
      }
    }

    // 3. PROCESS TASKS
    for (const task of job.tasks) {
      if (!isWithinDateRange(task.createdAt)) continue;

      let folderPath = "";
      let category = "";
      let isIncluded = false;

      if (task.type === "PUNCH_LIST") {
        isIncluded = includedCategories.has("punch_list");
        folderPath = "02 - Punch List";
        category = "Punch List";
      } else if (task.type === "TASK") {
        isIncluded = includedCategories.has("other");
        folderPath = "99 - Other";
        category = "Other";
      }

      if (isIncluded) {
        items.push({
          id: task.id,
          category,
          itemType: "TASK",
          textItemType: task.type,
          createdAt: task.createdAt.toISOString(),
          createdBy: getUserDisplayName(task.createdBy),
          title: task.title,
          description: task.description || undefined,
          taskStatus: task.status,
          priority: task.priority,
          dueDate: task.dueDate?.toISOString(),
          assignedTo: task.assignedTo ? getUserDisplayName(task.assignedTo) : undefined,
          exportedFileName: "", // Resolved in naming step
          folderPath: options.groupByCategory ? folderPath : "",
        });
      }
    }

    // 4. PROCESS MARKUPS — generate/fetch each flattened PDF and add it beside its original.
    if (markupCandidates.length > 0) {
      const markupItems = await Promise.all(
        markupCandidates.map(async (c) => {
          try {
            const res = await ensureFileMarkupPdf({ file: c.file, companyId });
            if (!res) return null;
            const item: ExportItem = {
              id: `${c.file.id}-markup`,
              category: "Markups",
              itemType: "FILE",
              createdAt: c.file.createdAt.toISOString(),
              createdBy: getUserDisplayName(c.file.uploader),
              title: c.file.name || c.file.originalName,
              originalFileName: markupFilename(c.file.name, c.file.originalName),
              exportedFileName: "",
              folderPath: options.groupByCategory ? c.folderPath : "",
              storageKey: res.storageKey,
            };
            return item;
          } catch (err) {
            const reason = err instanceof Error ? err.message : "unknown error";
            warnings.push(`- Markup for file ${c.file.id} could not be generated.\n  Reason: ${reason}`);
            return null;
          }
        }),
      );
      for (const item of markupItems) {
        if (item) items.push(item);
      }
    }

    // Naming / Sanitization & Collision Resolution
    this.resolveExportFileNames(items, options.renameFilesForReadability);

    const folders = Array.from(new Set(items.map((i) => i.folderPath).filter(Boolean))).sort();

    return {
      jobBucket: {
        id: job.id,
        name: job.title,
        jobNumber: job.jobNumber || undefined,
        poNumber: job.poNumber || undefined,
        customerName: job.customerName || undefined,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
      },
      export: {
        generatedAt: new Date().toISOString(),
        generatedBy: getUserDisplayName(requestingUser),
        dateRange:
          startBoundary || endBoundary
            ? {
                start: startBoundary ? format(startBoundary, "yyyy-MM-dd") : "All time",
                end: endBoundary ? format(endBoundary, "yyyy-MM-dd") : "All time",
              }
            : undefined,
        destination: options.destination,
      },
      folders,
      items,
      warnings,
    };
  }

  /**
   * Sanitizes names and resolves name duplication inside each export folder path.
   */
  static resolveExportFileNames(items: ExportItem[], renameEnabled: boolean) {
    const sanitize = (name: string): string => {
      // Replace invalid file system characters with '-'
      let clean = name.replace(/[\\/:*?"<>|%#]/g, "-");
      clean = clean.trim();
      const dotIndex = clean.lastIndexOf(".");
      if (dotIndex !== -1) {
        const base = clean.substring(0, dotIndex).substring(0, 100);
        const ext = clean.substring(dotIndex).toLowerCase();
        return base + ext;
      }
      return clean.substring(0, 100);
    };

    const usedNames = new Map<string, Set<string>>(); // folderPath -> Set of lowercase names

    for (const item of items) {
      if (item.itemType !== "FILE") {
        // Notes/Tasks text representations
        const dateStr = format(new Date(item.createdAt), "yyyy-MM-dd");
        const cleanTitle = sanitize(item.title || "Item").replace(/\.[a-z0-9]+$/i, "");
        item.exportedFileName = `${dateStr} - ${item.category} - ${cleanTitle}.txt`;
        continue;
      }

      // It's a FILE
      const original = item.originalFileName || "file.bin";
      const dotIndex = original.lastIndexOf(".");
      const ext = dotIndex !== -1 ? original.substring(dotIndex).toLowerCase() : ".bin";
      const baseOriginal = dotIndex !== -1 ? original.substring(0, dotIndex) : original;

      let nameCandidate = "";

      if (renameEnabled) {
        const dateStr = format(new Date(item.createdAt), "yyyy-MM-dd");
        const shortTitle = sanitize(item.title || baseOriginal).replace(/\.[a-z0-9]+$/i, "");
        nameCandidate = `${dateStr} - ${item.category} - ${shortTitle} - ${original}`;
      } else {
        nameCandidate = original;
      }

      nameCandidate = sanitize(nameCandidate);

      // Handle file extension protection
      const finalExt = nameCandidate.endsWith(ext) ? "" : ext;
      const finalName = nameCandidate + finalExt;

      // Duplicate resolution
      const folderKey = item.folderPath || "root";
      if (!usedNames.has(folderKey)) {
        usedNames.set(folderKey, new Set());
      }
      const set = usedNames.get(folderKey)!;

      let counter = 1;
      let uniqueName = finalName;
      while (set.has(uniqueName.toLowerCase())) {
        counter++;
        const currentDot = finalName.lastIndexOf(".");
        if (currentDot !== -1) {
          uniqueName = `${finalName.substring(0, currentDot)} (${counter})${finalName.substring(currentDot)}`;
        } else {
          uniqueName = `${finalName} (${counter})`;
        }
      }

      set.add(uniqueName.toLowerCase());
      item.exportedFileName = uniqueName;
    }
  }

  /**
   * Compiles the 00 - Item Index.csv file content.
   */
  static generateItemIndexCsv(manifest: ExportManifest): string {
    const escapeCsv = (val: string | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      return `"${val.replace(/"/g, '""')}"`;
    };

    const headers = [
      "Item ID",
      "Category",
      "Item Type",
      "Created Date",
      "Created By",
      "Title",
      "Description/Body",
      "Original File Name",
      "Exported File Name",
      "Folder Path",
      "Storage Key",
    ];

    const rows = [headers.join(",")];

    for (const item of manifest.items) {
      const row = [
        escapeCsv(item.id),
        escapeCsv(item.category),
        escapeCsv(item.itemType),
        escapeCsv(item.createdAt),
        escapeCsv(item.createdBy),
        escapeCsv(item.title),
        escapeCsv(item.description),
        escapeCsv(item.originalFileName || ""),
        escapeCsv(item.exportedFileName),
        escapeCsv(item.folderPath),
        escapeCsv(item.storageKey || ""),
      ];
      rows.push(row.join(","));
    }

    return rows.join("\n");
  }

  /**
   * Generates the 00 - Job Summary.pdf summarizing all exported files and notes.
   */
  static async generateSummaryPdf(manifest: ExportManifest): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageHeight = 840;
    let page = pdfDoc.addPage([600, pageHeight]);
    let currentY = 740;

    const addNewPage = () => {
      page = pdfDoc.addPage([600, pageHeight]);
      currentY = 780;

      // Draw running header separator
      page.drawLine({
        start: { x: 50, y: 795 },
        end: { x: 550, y: 795 },
        thickness: 0.4,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Draw running header text
      page.drawText(`HANDOFF SUMMARY  |  ${manifest.jobBucket.name.toUpperCase()}`, {
        x: 50,
        y: 802,
        size: 7.5,
        font: fontBold,
        color: rgb(0.4, 0.5, 0.6),
      });
    };

    const checkPageSpace = (needed: number) => {
      if (currentY - needed < 60) {
        addNewPage();
      }
    };

    const drawSectionHeader = (title: string) => {
      checkPageSpace(50);
      currentY -= 20;

      // Draw left decorative bar
      page.drawRectangle({
        x: 50,
        y: currentY - 2,
        width: 4,
        height: 14,
        color: rgb(0.08, 0.36, 0.56),
      });

      page.drawText(title.toUpperCase(), {
        x: 60,
        y: currentY,
        size: 10.5,
        font: fontBold,
        color: rgb(0.09, 0.18, 0.27),
      });

      currentY -= 8;

      // Divider line
      page.drawLine({
        start: { x: 50, y: currentY },
        end: { x: 550, y: currentY },
        thickness: 0.5,
        color: rgb(0.85, 0.87, 0.9),
      });

      currentY -= 12;
    };

    const drawLogCard = (
      dateStr: string,
      author: string,
      category: string,
      body: string,
      accentColor: [number, number, number],
      tagBgColor: [number, number, number]
    ) => {
      const maxBodyChars = 85;
      const paragraphs = body.split("\n");
      const wrappedLines: string[] = [];

      for (const p of paragraphs) {
        const words = p.split(" ");
        let line = "";
        for (const w of words) {
          if ((line + " " + w).length > maxBodyChars) {
            wrappedLines.push(line.trim());
            line = w;
          } else {
            line += (line ? " " : "") + w;
          }
        }
        if (line) wrappedLines.push(line.trim());
      }

      const lineHeight = 12;
      const topMargin = 22;
      const bottomMargin = 12;
      const totalBodyHeight = wrappedLines.length * lineHeight;
      const cardHeight = topMargin + totalBodyHeight + bottomMargin;

      checkPageSpace(cardHeight + 10);

      // Card Background
      page.drawRectangle({
        x: 50,
        y: currentY - cardHeight,
        width: 500,
        height: cardHeight,
        color: rgb(0.98, 0.98, 0.99),
        borderColor: rgb(0.88, 0.9, 0.93),
        borderWidth: 0.5,
      });

      // Left Accent Border
      page.drawLine({
        start: { x: 50, y: currentY },
        end: { x: 50, y: currentY - cardHeight },
        thickness: 3.5,
        color: rgb(...accentColor),
      });

      // Metadata text
      page.drawText(`${dateStr}  •  Logged by ${author}`, {
        x: 65,
        y: currentY - 14,
        size: 8.5,
        font: fontBold,
        color: rgb(0.2, 0.3, 0.4),
      });

      // Upper Right Category Pill Tag
      const catTag = category.toUpperCase();
      const tagWidth = fontBold.widthOfTextAtSize(catTag, 6.5);
      page.drawRectangle({
        x: 540 - tagWidth - 8,
        y: currentY - 16,
        width: tagWidth + 8,
        height: 11,
        color: rgb(...tagBgColor),
      });
      page.drawText(catTag, {
        x: 540 - tagWidth - 4,
        y: currentY - 13.5,
        size: 6.5,
        font: fontBold,
        color: rgb(...accentColor),
      });

      // Body Text lines
      let textY = currentY - topMargin - 8;
      for (const line of wrappedLines) {
        page.drawText(line, {
          x: 65,
          y: textY,
          size: 8.5,
          font: font,
          color: rgb(0.25, 0.25, 0.25),
        });
        textY -= lineHeight;
      }

      currentY -= cardHeight + 8;
    };

    // --- PAGE 1: TITLE BANNER ---
    page.drawRectangle({
      x: 0,
      y: 770,
      width: 600,
      height: 70,
      color: rgb(0.08, 0.16, 0.26),
    });
    page.drawRectangle({
      x: 0,
      y: 770,
      width: 8,
      height: 70,
      color: rgb(0.05, 0.58, 0.53), // Teal Accent
    });
    page.drawText("PROJECT HANDOFF SUMMARY", {
      x: 50,
      y: 810,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText("JobBinder Handoff Documentation Package", {
      x: 50,
      y: 792,
      size: 10,
      font: font,
      color: rgb(0.7, 0.85, 0.82),
    });

    // --- METADATA CONTAINER CARD ---
    checkPageSpace(105);
    currentY -= 20;

    page.drawRectangle({
      x: 50,
      y: currentY - 95,
      width: 500,
      height: 95,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.88, 0.9, 0.93),
      borderWidth: 1,
    });
    page.drawLine({
      start: { x: 50, y: currentY },
      end: { x: 50, y: currentY - 95 },
      thickness: 3.5,
      color: rgb(0.08, 0.36, 0.56),
    });

    const drawMetaRow = (label: string, val: string, lx: number, rx: number, y: number) => {
      page.drawText(label, { x: lx, y, size: 8.5, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
      page.drawText(val, { x: rx, y, size: 8.5, font: font, color: rgb(0.1, 0.1, 0.1) });
    };

    let cardY = currentY - 18;
    drawMetaRow("JOB NAME:", manifest.jobBucket.name.substring(0, 38), 65, 140, cardY);
    drawMetaRow("EXPORT DATE:", format(new Date(manifest.export.generatedAt), "PPP"), 310, 400, cardY);

    cardY -= 16;
    drawMetaRow("JOB NUMBER:", manifest.jobBucket.jobNumber || "N/A", 65, 140, cardY);
    drawMetaRow("EXPORTED BY:", manifest.export.generatedBy.substring(0, 25), 310, 400, cardY);

    cardY -= 16;
    drawMetaRow("CUSTOMER:", manifest.jobBucket.customerName || "N/A", 65, 140, cardY);
    const dateRangeStr = manifest.export.dateRange
      ? `${manifest.export.dateRange.start} to ${manifest.export.dateRange.end}`
      : "All Time";
    drawMetaRow("DATE RANGE:", dateRangeStr, 310, 400, cardY);

    cardY -= 16;
    drawMetaRow("PO NUMBER:", manifest.jobBucket.poNumber || "N/A", 65, 140, cardY);

    const status = (manifest.jobBucket.status || "active").toUpperCase();
    const statusColorMap: Record<string, { bg: [number, number, number]; txt: [number, number, number] }> = {
      ACTIVE: { bg: [0.85, 0.95, 0.9], txt: [0.1, 0.4, 0.2] },
      COMPLETED: { bg: [0.85, 0.9, 0.98], txt: [0.15, 0.25, 0.6] },
      default: { bg: [0.92, 0.92, 0.92], txt: [0.3, 0.3, 0.3] },
    };
    const badgeStyles = statusColorMap[status] || statusColorMap.default;

    page.drawText("STATUS:", { x: 310, y: cardY, size: 8.5, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
    page.drawRectangle({
      x: 400,
      y: cardY - 3,
      width: 70,
      height: 14,
      color: rgb(...badgeStyles.bg),
    });
    page.drawText(status, {
      x: 400 + (70 - fontBold.widthOfTextAtSize(status, 7.5)) / 2,
      y: cardY,
      size: 7.5,
      font: fontBold,
      color: rgb(...badgeStyles.txt),
    });

    currentY -= 115;

    // --- PACKAGE BREAKDOWN ---
    drawSectionHeader("Package Item Breakdown");

    const counts = manifest.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    checkPageSpace(45);
    const tableHeaderY = currentY;
    page.drawRectangle({
      x: 50,
      y: tableHeaderY - 18,
      width: 500,
      height: 18,
      color: rgb(0.9, 0.92, 0.95),
    });

    page.drawText("CATEGORY", { x: 60, y: tableHeaderY - 13, size: 8.5, font: fontBold, color: rgb(0.15, 0.25, 0.35) });
    page.drawText("COUNT", { x: 220, y: tableHeaderY - 13, size: 8.5, font: fontBold, color: rgb(0.15, 0.25, 0.35) });
    page.drawText("ZIP FOLDER LOCATION", { x: 320, y: tableHeaderY - 13, size: 8.5, font: fontBold, color: rgb(0.15, 0.25, 0.35) });

    currentY -= 18;

    const folderMappings: Record<string, string> = {
      Photos: "01 - Photos/",
      "Punch List": "02 - Punch List/",
      "Progress Updates": "03 - Progress Updates/",
      "Daily Reports": "04 - Daily Reports/",
      "Material Tickets": "05 - Material Tickets/",
      Notes: "06 - Notes/",
      Markups: "Various (beside originals)",
      Other: "99 - Other/",
    };

    let index = 0;
    let totalCount = 0;

    for (const [cat, cnt] of Object.entries(counts)) {
      checkPageSpace(20);
      totalCount += cnt;
      const rowBg = index % 2 === 0 ? rgb(0.98, 0.99, 1.0) : rgb(1, 1, 1);

      page.drawRectangle({
        x: 50,
        y: currentY - 16,
        width: 500,
        height: 16,
        color: rowBg,
      });

      page.drawText(cat, { x: 60, y: currentY - 11, size: 8.5, font: font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(`${cnt} item${cnt !== 1 ? "s" : ""}`, { x: 220, y: currentY - 11, size: 8.5, font: font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(folderMappings[cat] || "root/", { x: 320, y: currentY - 11, size: 8.5, font: font, color: rgb(0.4, 0.4, 0.4) });

      page.drawLine({
        start: { x: 50, y: currentY - 16 },
        end: { x: 550, y: currentY - 16 },
        thickness: 0.3,
        color: rgb(0.9, 0.9, 0.9),
      });

      currentY -= 16;
      index++;
    }

    checkPageSpace(20);
    page.drawRectangle({
      x: 50,
      y: currentY - 18,
      width: 500,
      height: 18,
      color: rgb(0.95, 0.96, 0.97),
    });
    page.drawText("TOTAL ITEMS EXPORTED", { x: 60, y: currentY - 13, size: 8.5, font: fontBold, color: rgb(0.09, 0.18, 0.27) });
    page.drawText(`${totalCount} items`, { x: 220, y: currentY - 13, size: 8.5, font: fontBold, color: rgb(0.09, 0.18, 0.27) });
    page.drawText("-", { x: 320, y: currentY - 13, size: 8.5, font: font, color: rgb(0.5, 0.5, 0.5) });

    currentY -= 30;

    // --- PUNCH LIST ---
    const punchListItems = manifest.items.filter((i) => i.category === "Punch List" && i.itemType === "TASK");
    if (punchListItems.length > 0) {
      drawSectionHeader("Punch List Items");

      for (const item of punchListItems) {
        checkPageSpace(30);
        const dateFormatted = format(new Date(item.createdAt), "yyyy-MM-dd");

        page.drawRectangle({
          x: 55,
          y: currentY - 10,
          width: 10,
          height: 10,
          borderColor: rgb(0.4, 0.5, 0.6),
          borderWidth: 1,
        });

        page.drawText(`${dateFormatted} - ${item.title}`, {
          x: 75,
          y: currentY - 9,
          size: 9,
          font: fontBold,
          color: rgb(0.15, 0.2, 0.25),
        });

        currentY -= 15;

        if (item.description) {
          const maxDescWidth = 80;
          const descParagraphs = item.description.split("\n");
          for (const dp of descParagraphs) {
            const words = dp.split(" ");
            let line = "";
            for (const w of words) {
              if ((line + " " + w).length > maxDescWidth) {
                checkPageSpace(14);
                page.drawText(line.trim(), {
                  x: 75,
                  y: currentY - 7,
                  size: 8,
                  font: font,
                  color: rgb(0.45, 0.45, 0.45),
                });
                currentY -= 11;
                line = w;
              } else {
                line += (line ? " " : "") + w;
              }
            }
            if (line) {
              checkPageSpace(14);
              page.drawText(line.trim(), {
                x: 75,
                y: currentY - 7,
                size: 8,
                font: font,
                color: rgb(0.45, 0.45, 0.45),
              });
              currentY -= 11;
            }
          }
        }
        currentY -= 4;
      }
      currentY -= 10;
    }

    // --- PROGRESS LOGS ---
    const progressUpdates = manifest.items.filter((i) => i.category === "Progress Updates" && i.itemType === "NOTE");
    if (progressUpdates.length > 0) {
      drawSectionHeader("Progress Update Logs");
      for (const item of progressUpdates) {
        const dateFormatted = format(new Date(item.createdAt), "yyyy-MM-dd");
        drawLogCard(
          dateFormatted,
          item.createdBy,
          item.category,
          item.description || "No text description provided.",
          [0.06, 0.6, 0.54],
          [0.85, 0.95, 0.93]
        );
      }
    }

    // --- GENERAL FIELD NOTES ---
    const generalNotes = manifest.items.filter((i) => i.category === "Notes" && i.itemType === "NOTE");
    if (generalNotes.length > 0) {
      drawSectionHeader("General Field Notes");
      for (const item of generalNotes) {
        const dateFormatted = format(new Date(item.createdAt), "yyyy-MM-dd");
        drawLogCard(
          dateFormatted,
          item.createdBy,
          item.title || "Field Note",
          item.description || "No content provided.",
          [0.12, 0.36, 0.56],
          [0.88, 0.92, 0.96]
        );
      }
    }

    // --- GENERATE RUNNING FOOTERS ---
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];

      p.drawLine({
        start: { x: 50, y: 45 },
        end: { x: 550, y: 45 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });

      const footerText = `Generated on ${format(new Date(manifest.export.generatedAt), "PPP")} • JobBinder Handoff`;
      p.drawText(footerText, {
        x: 50,
        y: 32,
        size: 7,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const pageText = `Page ${i + 1} of ${pages.length}`;
      p.drawText(pageText, {
        x: 550 - font.widthOfTextAtSize(pageText, 7),
        y: 32,
        size: 7,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private static getTextItems(manifest: ExportManifest) {
    return manifest.items.filter((item) => item.itemType !== "FILE");
  }

  private static getWorkbookSection(item: ExportItem) {
    if (item.itemType === "NOTE" && item.textItemType === "PROGRESS") return "Progress Updates";
    if (item.itemType === "NOTE") return "Field Notes";
    if (item.itemType === "TASK" && item.textItemType === "PUNCH_LIST") return "Punch List";
    return "Tasks";
  }

  private static getWorkbookItemType(item: ExportItem) {
    if (item.itemType === "NOTE" && item.textItemType === "PROGRESS") return "Progress";
    if (item.itemType === "NOTE") return "Note";
    if (item.itemType === "TASK" && item.textItemType === "PUNCH_LIST") return "Punch List";
    return "Task";
  }

  private static formatWorkbookStatus(status?: string) {
    if (!status) return "";
    return status
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private static formatWorkbookTextDate(date: string) {
    if (date.includes("T")) return date.replace("T", " ").slice(0, 16);
    return format(new Date(date), "yyyy-MM-dd HH:mm");
  }

  private static formatWorkbookDate(date?: string) {
    if (!date) return "";
    if (date.includes("T")) return date.slice(0, 10);
    return format(new Date(date), "yyyy-MM-dd");
  }

  private static getWorkbookCategory(item: ExportItem) {
    if (item.itemType === "NOTE") return item.statusTag || item.noteCategory || item.category;
    return item.category;
  }

  private static addTextItemsSheet(workbook: ExcelJS.Workbook, name: string, items: ExportItem[]) {
    const worksheet = workbook.addWorksheet(name);

    worksheet.columns = [
      { header: "Item ID", key: "id", width: 24 },
      { header: "Section", key: "section", width: 20 },
      { header: "Item Type", key: "itemType", width: 16 },
      { header: "Created Date", key: "createdAt", width: 18 },
      { header: "Created By", key: "createdBy", width: 22 },
      { header: "Title/Tag", key: "title", width: 28 },
      { header: "Status", key: "status", width: 16 },
      { header: "Priority", key: "priority", width: 10 },
      { header: "Due Date", key: "dueDate", width: 14 },
      { header: "Assigned To", key: "assignedTo", width: 22 },
      { header: "Category", key: "category", width: 22 },
      { header: "Body/Description", key: "body", width: 60 },
      { header: "Linked Folder Path", key: "folderPath", width: 24 },
    ];

    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = "A1:M1";

    for (const item of items) {
      worksheet.addRow({
        id: item.id,
        section: this.getWorkbookSection(item),
        itemType: this.getWorkbookItemType(item),
        createdAt: this.formatWorkbookTextDate(item.createdAt),
        createdBy: item.createdBy,
        title: item.title || "",
        status: this.formatWorkbookStatus(item.taskStatus),
        priority: item.priority ?? "",
        dueDate: this.formatWorkbookDate(item.dueDate),
        assignedTo: item.assignedTo || "",
        category: this.getWorkbookCategory(item),
        body: item.description || "",
        folderPath: item.folderPath,
      });
    }

    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    header.alignment = { vertical: "middle", wrapText: true };

    worksheet.eachRow((row, rowNumber) => {
      row.height = rowNumber === 1 ? 22 : 48;
      row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });

      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        });
      }
    });

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const statusCell = worksheet.getCell(rowNumber, 7);
      const status = String(statusCell.value || "");
      if (status === "Open") {
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF7ED" } };
      } else if (status === "In Progress") {
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
      } else if (status === "Done") {
        statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
      }
    }

    return worksheet;
  }

  /**
   * Generates the structured workbook used by PMs to review and manipulate text items.
   */
  static async generateTextItemsWorkbook(manifest: ExportManifest): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "JobBinder";
    workbook.created = new Date(manifest.export.generatedAt);

    const summary = workbook.addWorksheet("Job Summary");
    summary.columns = [
      { width: 24 },
      { width: 44 },
      { width: 18 },
    ];
    summary.addRow(["Job Text Items Export"]);
    summary.addRow([]);
    summary.addRow(["Job Name", manifest.jobBucket.name]);
    summary.addRow(["Job Number", manifest.jobBucket.jobNumber || ""]);
    summary.addRow(["PO Number", manifest.jobBucket.poNumber || ""]);
    summary.addRow(["Customer", manifest.jobBucket.customerName || ""]);
    summary.addRow(["Job Status", manifest.jobBucket.status]);
    summary.addRow(["Exported By", manifest.export.generatedBy]);
    summary.addRow(["Generated At", this.formatWorkbookTextDate(manifest.export.generatedAt)]);
    summary.addRow([]);
    summary.addRow(["Category", "Count"]);

    const textItems = this.getTextItems(manifest);
    const counts = textItems.reduce<Record<string, number>>((acc, item) => {
      const section = this.getWorkbookSection(item);
      acc[section] = (acc[section] || 0) + 1;
      return acc;
    }, {});

    for (const section of ["Progress Updates", "Field Notes", "Tasks", "Punch List"]) {
      summary.addRow([section, counts[section] || 0]);
    }

    summary.getRow(1).font = { bold: true, size: 16, color: { argb: "FF111827" } };
    summary.getRow(11).font = { bold: true, color: { argb: "FFFFFFFF" } };
    summary.getRow(11).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };

    this.addTextItemsSheet(workbook, "All Text Items", textItems);
    this.addTextItemsSheet(
      workbook,
      "Progress Updates",
      textItems.filter((item) => this.getWorkbookSection(item) === "Progress Updates"),
    );
    this.addTextItemsSheet(
      workbook,
      "Field Notes",
      textItems.filter((item) => this.getWorkbookSection(item) === "Field Notes"),
    );
    this.addTextItemsSheet(
      workbook,
      "Tasks",
      textItems.filter((item) => this.getWorkbookSection(item) === "Tasks"),
    );
    this.addTextItemsSheet(
      workbook,
      "Punch List",
      textItems.filter((item) => this.getWorkbookSection(item) === "Punch List"),
    );

    const bytes = await workbook.xlsx.writeBuffer();
    return Buffer.from(bytes);
  }

  /**
   * Compiles the manifest items into a .zip archive, downloading files from R2.
   */
  static async generateZip(manifest: ExportManifest, options: ExportZipOptions = {}): Promise<Buffer> {
    const outputOptions = {
      includeSummaryPdf: options.includeSummaryPdf !== false,
      includeItemIndexCsv: options.includeItemIndexCsv !== false,
      includeTextWorkbook: options.includeTextWorkbook !== false,
    };
    const zip = new JSZip();

    // 1. ADD STRUCTURED SUMMARY ARTIFACTS
    if (manifest.items.length > 0 && outputOptions.includeItemIndexCsv) {
      const csvContent = this.generateItemIndexCsv(manifest);
      zip.file("00 - Item Index.csv", csvContent);
    }

    if (manifest.items.length > 0 && outputOptions.includeSummaryPdf) {
      const pdfBuffer = await this.generateSummaryPdf(manifest);
      zip.file("00 - Job Summary.pdf", pdfBuffer);
    }

    const textItems = this.getTextItems(manifest);
    if (textItems.length > 0 && outputOptions.includeTextWorkbook) {
      const workbookBuffer = await this.generateTextItemsWorkbook(manifest);
      zip.file("00 - Job Text Items.xlsx", workbookBuffer);
    }

    // 2. DOWNLOAD AND INSERT R2 FILES IN PARALLEL WITH GRACEFUL ERROR HANDLING
    const filesToDownload = manifest.items.filter((item) => item.itemType === "FILE" && item.storageKey);

    const downloadPromises = filesToDownload.map(async (item) => {
      try {
        const buffer = await downloadR2Object(item.storageKey!);
        const zipPath = item.folderPath
          ? `${item.folderPath}/${item.exportedFileName}`
          : item.exportedFileName;
        zip.file(zipPath, buffer);
      } catch (err) {
        console.error(`Failed to download object ${item.storageKey} for export:`, err);
        const reason = err instanceof Error ? err.message : "Connection failure or missing file in storage";
        manifest.warnings.push(
          `- Item ID: ${item.id}\n  Reason: ${reason}\n  Original file name: ${item.originalFileName || "Unknown"}\n  Storage key: ${item.storageKey}`,
        );
      }
    });

    await Promise.all(downloadPromises);

    // 3. WRITE WARNINGS FILE IF ANY OCCURRED
    if (manifest.warnings.length > 0) {
      let warningsContent = "Export Job Package - Compilation Warnings\n";
      warningsContent += "=========================================\n\n";
      warningsContent += "The following items could not be downloaded from storage and were skipped:\n\n";
      warningsContent += manifest.warnings.join("\n\n");
      zip.file("Export Warnings.txt", warningsContent);
    }

    // 4. GENERATE FINAL ZIP BUFFER
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return zipBuffer;
  }
}
