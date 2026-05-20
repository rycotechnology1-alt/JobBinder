import { format } from "date-fns";
import JSZip from "jszip";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import prisma from "@/lib/prisma";
import { downloadR2Object } from "@/lib/r2";

export type ExportOptions = {
  destination: "zip" | "share_link" | "google_drive" | "onedrive";
  dateRange?: {
    start?: string; // YYYY-MM-DD
    end?: string;   // YYYY-MM-DD
  };
  categories: string[]; // ["photos", "notes", "punch_list", "progress_updates", "daily_reports", "material_tickets", "other"]
  includeSummaryPdf: boolean;
  includeItemIndexCsv: boolean;
  renameFilesForReadability: boolean;
  groupByCategory: boolean;
};

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
  createdAt: string;
  createdBy: string;
  title?: string;
  description?: string;
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
          include: { createdBy: { select: { name: true, email: true } } },
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

    const items: ExportItem[] = [];
    const warnings: string[] = [];

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
          createdAt: note.createdAt.toISOString(),
          createdBy: getUserDisplayName(note.author),
          title: note.statusTag || note.category || "Note",
          description: note.content,
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
          createdAt: task.createdAt.toISOString(),
          createdBy: getUserDisplayName(task.createdBy),
          title: task.title,
          description: task.description || undefined,
          exportedFileName: "", // Resolved in naming step
          folderPath: options.groupByCategory ? folderPath : "",
        });
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
      let finalName = nameCandidate + finalExt;

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

    let page = pdfDoc.addPage([600, 800]);
    let currentY = 750;

    const checkPageSpace = (needed: number) => {
      if (currentY - needed < 50) {
        page = pdfDoc.addPage([600, 800]);
        currentY = 750;
      }
    };

    const drawHeader = (text: string) => {
      checkPageSpace(40);
      currentY -= 15;
      page.drawText(text, {
        x: 50,
        y: currentY,
        size: 14,
        font: fontBold,
        color: rgb(0.12, 0.23, 0.35),
      });
      currentY -= 20;
      // Draw underline
      page.drawLine({
        start: { x: 50, y: currentY + 12 },
        end: { x: 550, y: currentY + 12 },
        thickness: 1,
        color: rgb(0.85, 0.85, 0.85),
      });
    };

    const drawText = (text: string, size = 10, isBold = false, color = rgb(0.2, 0.2, 0.2)) => {
      const maxChars = 85;
      const paragraphs = text.split("\n");

      for (const p of paragraphs) {
        const words = p.split(" ");
        let currentLine = "";

        for (const w of words) {
          if ((currentLine + " " + w).length > maxChars) {
            checkPageSpace(16);
            page.drawText(currentLine.trim(), {
              x: 50,
              y: currentY,
              size,
              font: isBold ? fontBold : font,
              color,
            });
            currentY -= 16;
            currentLine = w;
          } else {
            currentLine += (currentLine ? " " : "") + w;
          }
        }

        if (currentLine) {
          checkPageSpace(16);
          page.drawText(currentLine.trim(), {
            x: 50,
            y: currentY,
            size,
            font: isBold ? fontBold : font,
            color,
          });
          currentY -= 16;
        }
      }
    };

    // --- TITLE HEADER ---
    page.drawText("JOB HANDOFF SUMMARY", {
      x: 50,
      y: currentY,
      size: 18,
      font: fontBold,
      color: rgb(0.09, 0.18, 0.27),
    });
    currentY -= 30;

    // --- METADATA ---
    drawText(`Job Name: ${manifest.jobBucket.name}`, 11, true);
    if (manifest.jobBucket.jobNumber) {
      drawText(`Job Number: ${manifest.jobBucket.jobNumber}`, 11, true);
    }
    if (manifest.jobBucket.poNumber) {
      drawText(`PO Number: ${manifest.jobBucket.poNumber}`, 10, false);
    }
    if (manifest.jobBucket.customerName) {
      drawText(`Customer: ${manifest.jobBucket.customerName}`, 10, false);
    }
    drawText(`Export Date: ${format(new Date(manifest.export.generatedAt), "PPP")}`, 10, false);
    drawText(`Exported By: ${manifest.export.generatedBy}`, 10, false);
    if (manifest.export.dateRange) {
      drawText(`Date Range Selected: ${manifest.export.dateRange.start} to ${manifest.export.dateRange.end}`, 10, false);
    } else {
      drawText("Date Range: All Time", 10, false);
    }
    currentY -= 20;

    // --- CATEGORY SUMMARY STATISTICS ---
    drawHeader("Package Item Breakdown");
    const counts = manifest.items.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    drawText(`Total Items Exported: ${manifest.items.length}`, 11, true);
    currentY -= 5;
    for (const [cat, cnt] of Object.entries(counts)) {
      drawText(`- ${cat}: ${cnt} items`, 10);
    }
    currentY -= 20;

    // --- PUNCH LIST SUMMARY ---
    const punchListItems = manifest.items.filter((i) => i.category === "Punch List" && i.itemType === "TASK");
    if (punchListItems.length > 0) {
      drawHeader("Punch List Items");
      for (const item of punchListItems) {
        const dateFormatted = format(new Date(item.createdAt), "yyyy-MM-dd");
        const statusText = item.description ? ` - ${item.description}` : "";
        drawText(`[ ] ${dateFormatted}: ${item.title}${statusText}`, 10);
        currentY -= 5;
      }
      currentY -= 15;
    }

    // --- PROGRESS UPDATES SUMMARY ---
    const progressUpdates = manifest.items.filter((i) => i.category === "Progress Updates" && i.itemType === "NOTE");
    if (progressUpdates.length > 0) {
      drawHeader("Progress Update Logs");
      for (const item of progressUpdates) {
        const dateFormatted = format(new Date(item.createdAt), "yyyy-MM-dd");
        drawText(`${dateFormatted} - Logged by ${item.createdBy}:`, 10, true);
        drawText(`${item.description}`, 9, false, rgb(0.3, 0.3, 0.3));
        currentY -= 10;
      }
      currentY -= 15;
    }

    // --- NOTES SUMMARY ---
    const generalNotes = manifest.items.filter((i) => i.category === "Notes" && i.itemType === "NOTE");
    if (generalNotes.length > 0) {
      drawHeader("General Field Notes");
      for (const item of generalNotes) {
        const dateFormatted = format(new Date(item.createdAt), "yyyy-MM-dd");
        drawText(`${dateFormatted} - Author: ${item.createdBy} [Category: ${item.title}]:`, 10, true);
        drawText(`${item.description}`, 9, false, rgb(0.3, 0.3, 0.3));
        currentY -= 10;
      }
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  /**
   * Compiles the manifest items into a .zip archive, downloading files from R2.
   */
  static async generateZip(manifest: ExportManifest): Promise<Buffer> {
    const zip = new JSZip();

    // 1. ADD CSV INDEX & PDF SUMMARY
    if (manifest.items.length > 0) {
      const csvContent = this.generateItemIndexCsv(manifest);
      zip.file("00 - Item Index.csv", csvContent);

      const pdfBuffer = await this.generateSummaryPdf(manifest);
      zip.file("00 - Job Summary.pdf", pdfBuffer);
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

    // 3. COMPILE TEXT NOTES & TASKS
    const textItems = manifest.items.filter((item) => item.itemType !== "FILE");
    for (const item of textItems) {
      const zipPath = item.folderPath
        ? `${item.folderPath}/${item.exportedFileName}`
        : item.exportedFileName;

      let fileContent = `ID: ${item.id}\n`;
      fileContent += `Category: ${item.category}\n`;
      fileContent += `Date: ${format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss")}\n`;
      fileContent += `Author: ${item.createdBy}\n`;
      fileContent += `Title/Tag: ${item.title}\n\n`;
      fileContent += `Content:\n${item.description || "No content provided."}\n`;

      zip.file(zipPath, fileContent);
    }

    // 4. WRITE WARNINGS FILE IF ANY OCCURRED
    if (manifest.warnings.length > 0) {
      let warningsContent = "Export Job Package - Compilation Warnings\n";
      warningsContent += "=========================================\n\n";
      warningsContent += "The following items could not be downloaded from storage and were skipped:\n\n";
      warningsContent += manifest.warnings.join("\n\n");
      zip.file("Export Warnings.txt", warningsContent);
    }

    // 5. GENERATE FINAL ZIP BUFFER
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    return zipBuffer;
  }
}
