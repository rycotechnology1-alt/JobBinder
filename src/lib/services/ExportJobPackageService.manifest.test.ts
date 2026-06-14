import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  jobFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  fileMarkupFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    job: { findFirst: prismaMocks.jobFindFirst },
    user: { findUnique: prismaMocks.userFindUnique },
    fileMarkupMark: { findMany: prismaMocks.fileMarkupFindMany },
  },
}));

vi.mock("@/lib/markup/generate", () => ({
  ensureFileMarkupPdf: vi.fn(),
  markupFilename: vi.fn((name: string | null, originalName: string) => `Marked - ${name || originalName}`),
}));

describe("ExportJobPackageService manifest daily reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userFindUnique.mockResolvedValue({ name: "Admin", email: "admin@example.com" });
    prismaMocks.fileMarkupFindMany.mockResolvedValue([]);
  });

  it("classifies daily reports and linked attachments by report date", async () => {
    const { ExportJobPackageService } = await import("./ExportJobPackageService");
    prismaMocks.jobFindFirst.mockResolvedValue({
      id: "job-1",
      title: "Main Street",
      jobNumber: null,
      poNumber: null,
      customerName: null,
      status: "ACTIVE",
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      files: [
        {
          id: "file-1",
          type: "PHOTO",
          noteId: "report-1",
          taskId: null,
          category: "Misc",
          createdAt: new Date("2026-06-15T12:00:00.000Z"),
          uploader: { name: "Foreman", email: "foreman@example.com" },
          name: null,
          originalName: "report-photo.jpg",
          url: "company/report-photo.jpg",
          contentType: "image/jpeg",
        },
      ],
      notes: [
        {
          id: "report-1",
          type: "DAILY_REPORT",
          category: null,
          statusTag: null,
          content: "Installed conduit.",
          materialsUsed: "2 EMT sticks",
          reportDate: new Date("2026-06-14T00:00:00.000Z"),
          createdAt: new Date("2026-06-15T12:00:00.000Z"),
          author: { name: "Foreman", email: "foreman@example.com" },
        },
        {
          id: "legacy-progress-1",
          type: "PROGRESS",
          category: "Completed Work",
          statusTag: "Rough-in",
          content: "Legacy progress log.",
          materialsUsed: null,
          reportDate: null,
          createdAt: new Date("2026-06-14T18:00:00.000Z"),
          author: { name: "Foreman", email: "foreman@example.com" },
        },
      ],
      tasks: [],
    });

    const manifest = await ExportJobPackageService.buildManifest(
      "job-1",
      {
        destination: "zip",
        dateRange: { start: "2026-06-14", end: "2026-06-14" },
        categories: ["daily_reports"],
        includeSummaryPdf: true,
        includeItemIndexCsv: true,
        includeTextWorkbook: true,
        renameFilesForReadability: true,
        groupByCategory: true,
      },
      "user-1",
      "company-1",
    );

    expect(manifest.folders).toEqual(["04 - Daily Reports"]);
    const rows = manifest.items
      .map((item) => [item.id, item.category, item.folderPath, item.createdAt])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    expect(rows).toEqual([
      ["file-1", "Daily Reports", "04 - Daily Reports", "2026-06-14T00:00:00.000Z"],
      ["legacy-progress-1", "Daily Reports", "04 - Daily Reports", "2026-06-14T18:00:00.000Z"],
      ["report-1", "Daily Reports", "04 - Daily Reports", "2026-06-14T00:00:00.000Z"],
    ]);
  });
});
