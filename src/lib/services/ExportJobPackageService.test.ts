import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { ExportJobPackageService, ExportItem, ExportManifest } from "./ExportJobPackageService";

function makeTextManifest(): ExportManifest {
  return {
    jobBucket: {
      id: "job-1",
      name: "Main Street Rebuild",
      jobNumber: "JB-100",
      poNumber: "PO-200",
      customerName: "Acme Construction",
      status: "ACTIVE",
      createdAt: "2026-05-01T12:00:00.000Z",
    },
    export: {
      generatedAt: "2026-05-20T12:00:00.000Z",
      generatedBy: "Project Admin",
      destination: "zip",
    },
    folders: ["02 - Punch List", "03 - Progress Updates", "06 - Notes", "99 - Other"],
    items: [
      {
        id: "note-1",
        category: "Notes",
        itemType: "NOTE",
        textItemType: "GENERAL",
        createdAt: "2026-05-18T14:30:00.000Z",
        createdBy: "Field User",
        title: "Customer conversation",
        description: "Customer requested driveway access remain open.",
        exportedFileName: "2026-05-18 - Notes - Customer conversation.txt",
        folderPath: "06 - Notes",
        noteCategory: "Customer",
      },
      {
        id: "progress-1",
        category: "Progress Updates",
        itemType: "NOTE",
        textItemType: "PROGRESS",
        createdAt: "2026-05-19T15:45:00.000Z",
        createdBy: "Foreman",
        title: "Pole transfer",
        description: "Transferred service and cleaned work area.",
        exportedFileName: "2026-05-19 - Progress Updates - Pole transfer.txt",
        folderPath: "03 - Progress Updates",
        statusTag: "Pole transfer",
      },
      {
        id: "task-1",
        category: "Other",
        itemType: "TASK",
        textItemType: "TASK",
        createdAt: "2026-05-20T10:00:00.000Z",
        createdBy: "Project Admin",
        title: "Schedule inspection",
        description: "Call inspector after trench is covered.",
        exportedFileName: "2026-05-20 - Other - Schedule inspection.txt",
        folderPath: "99 - Other",
        taskStatus: "IN_PROGRESS",
        priority: 2,
        dueDate: "2026-05-23T00:00:00.000Z",
        assignedTo: "Field User",
      },
      {
        id: "punch-1",
        category: "Punch List",
        itemType: "TASK",
        textItemType: "PUNCH_LIST",
        createdAt: "2026-05-21T11:00:00.000Z",
        createdBy: "Project Admin",
        title: "Touch up caulk",
        description: "Finish south wall caulk line.",
        exportedFileName: "2026-05-21 - Punch List - Touch up caulk.txt",
        folderPath: "02 - Punch List",
        taskStatus: "OPEN",
        priority: 1,
        dueDate: "2026-05-24T00:00:00.000Z",
      },
    ],
    warnings: [],
  };
}

async function loadWorkbookFromZip(zipBuffer: Buffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const workbookFile = zip.file("00 - Job Text Items.xlsx");
  expect(workbookFile).toBeTruthy();

  const workbookBuffer = await workbookFile!.async("nodebuffer");
  const workbook = new ExcelJS.Workbook();
  const workbookArrayBuffer = workbookBuffer.buffer.slice(
    workbookBuffer.byteOffset,
    workbookBuffer.byteOffset + workbookBuffer.byteLength,
  ) as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookArrayBuffer);

  return { zip, workbook };
}

describe("ExportJobPackageService Naming and Sanitization", () => {
  it("sanitizes invalid characters in filenames", () => {
    const items: ExportItem[] = [
      {
        id: "1",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench *condition* near pole / driveway?",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
    ];

    ExportJobPackageService.resolveExportFileNames(items, true);

    expect(items[0].exportedFileName).not.toContain("*");
    expect(items[0].exportedFileName).not.toContain("/");
    expect(items[0].exportedFileName).not.toContain("?");
    expect(items[0].exportedFileName).toBe(
      "2026-05-20 - Photos - Trench -condition- near pole - driveway- - IMG_4421.jpg",
    );
  });

  it("resolves duplicate file names within the same folder path", () => {
    const items: ExportItem[] = [
      {
        id: "1",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
      {
        id: "2",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
      {
        id: "3",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
    ];

    ExportJobPackageService.resolveExportFileNames(items, true);

    expect(items[0].exportedFileName).toBe("2026-05-20 - Photos - Trench - IMG_4421.jpg");
    expect(items[1].exportedFileName).toBe("2026-05-20 - Photos - Trench - IMG_4421 (2).jpg");
    expect(items[2].exportedFileName).toBe("2026-05-20 - Photos - Trench - IMG_4421 (3).jpg");
  });

  it("keeps original filename if renameFilesForReadability is false", () => {
    const items: ExportItem[] = [
      {
        id: "1",
        category: "Photos",
        itemType: "FILE",
        createdAt: "2026-05-20T12:00:00Z",
        createdBy: "User",
        title: "Trench",
        originalFileName: "IMG_4421.jpg",
        exportedFileName: "",
        folderPath: "01 - Photos",
      },
    ];

    ExportJobPackageService.resolveExportFileNames(items, false);

    expect(items[0].exportedFileName).toBe("IMG_4421.jpg");
  });
});

describe("ExportJobPackageService structured text workbook", () => {
  it("creates a PM workbook with summary, master, and item-type worksheets", async () => {
    const zipBuffer = await ExportJobPackageService.generateZip(makeTextManifest());

    const { workbook } = await loadWorkbookFromZip(zipBuffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Job Summary",
      "All Text Items",
      "Progress Updates",
      "Field Notes",
      "Tasks",
      "Punch List",
    ]);

    const allTextItems = workbook.getWorksheet("All Text Items")!;
    expect(allTextItems.autoFilter).toEqual("A1:M1");
    expect(allTextItems.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });

    const headers = allTextItems.getRow(1).values;
    expect(headers).toEqual([
      undefined,
      "Item ID",
      "Section",
      "Item Type",
      "Created Date",
      "Created By",
      "Title/Tag",
      "Status",
      "Priority",
      "Due Date",
      "Assigned To",
      "Category",
      "Body/Description",
      "Linked Folder Path",
    ]);

    const progressRow = allTextItems.getRow(3).values;
    expect(progressRow).toEqual([
      undefined,
      "progress-1",
      "Progress Updates",
      "Progress",
      "2026-05-19 15:45",
      "Foreman",
      "Pole transfer",
      "",
      "",
      "",
      "",
      "Pole transfer",
      "Transferred service and cleaned work area.",
      "03 - Progress Updates",
    ]);

    const taskRow = allTextItems.getRow(4).values;
    expect(taskRow).toEqual([
      undefined,
      "task-1",
      "Tasks",
      "Task",
      "2026-05-20 10:00",
      "Project Admin",
      "Schedule inspection",
      "In Progress",
      2,
      "2026-05-23",
      "Field User",
      "Other",
      "Call inspector after trench is covered.",
      "99 - Other",
    ]);

    expect(workbook.getWorksheet("Progress Updates")!.actualRowCount).toBe(2);
    expect(workbook.getWorksheet("Field Notes")!.actualRowCount).toBe(2);
    expect(workbook.getWorksheet("Tasks")!.actualRowCount).toBe(2);
    expect(workbook.getWorksheet("Punch List")!.actualRowCount).toBe(2);
  });

  it("uses the workbook instead of individual text files and honors optional PDF/CSV outputs", async () => {
    const zipBuffer = await ExportJobPackageService.generateZip(makeTextManifest(), {
      includeSummaryPdf: false,
      includeItemIndexCsv: false,
      includeTextWorkbook: true,
    });

    const { zip } = await loadWorkbookFromZip(zipBuffer);
    const fileNames = Object.keys(zip.files);

    expect(fileNames).toContain("00 - Job Text Items.xlsx");
    expect(fileNames).not.toContain("00 - Job Summary.pdf");
    expect(fileNames).not.toContain("00 - Item Index.csv");
    expect(fileNames.filter((fileName) => fileName.endsWith(".txt"))).toEqual([]);
  });
});
