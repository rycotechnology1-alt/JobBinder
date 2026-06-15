import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  fileMarkupExportFindUnique: vi.fn(),
  fileMarkupExportUpsert: vi.fn(),
  fileMarkupMarkFindMany: vi.fn(),
  fileFindMany: vi.fn(),
}));

const r2Mocks = vi.hoisted(() => ({
  downloadR2Object: vi.fn(),
  uploadR2Object: vi.fn(),
}));

const flattenMarkupToPdf = vi.hoisted(() => vi.fn(async () => new Uint8Array([9, 9, 9])));

vi.mock("@/lib/prisma", () => ({
  default: {
    fileMarkupExport: {
      findUnique: prismaMocks.fileMarkupExportFindUnique,
      upsert: prismaMocks.fileMarkupExportUpsert,
    },
    fileMarkupMark: { findMany: prismaMocks.fileMarkupMarkFindMany },
    file: { findMany: prismaMocks.fileFindMany },
  },
}));

vi.mock("@/lib/r2", () => ({
  downloadR2Object: r2Mocks.downloadR2Object,
  uploadR2Object: r2Mocks.uploadR2Object,
}));

vi.mock("@/lib/markup/flatten", () => ({
  flattenMarkupToPdf,
}));

describe("ensureFileMarkupPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.fileMarkupExportFindUnique.mockResolvedValue(null);
    prismaMocks.fileMarkupExportUpsert.mockResolvedValue({});
    r2Mocks.downloadR2Object.mockResolvedValue(Buffer.from("pdf"));
  });

  it("passes pin attachment images into the PDF appendix", async () => {
    const { ensureFileMarkupPdf } = await import("./generate");
    const mark = {
      id: "mark-1",
      fileId: "file-1",
      page: 1,
      kind: "PIN",
      geometry: { x: 0.5, y: 0.5 },
      style: { color: "#ef4444", strokeWidth: 0.004, opacity: 1 },
      text: "Missing caulk",
      sequence: 0,
      authorId: "user-1",
      deletedAt: null,
      clientUpdatedAt: new Date("2026-06-15T12:00:00.000Z"),
    };
    prismaMocks.fileMarkupMarkFindMany.mockResolvedValue([mark]);
    prismaMocks.fileFindMany.mockResolvedValue([
      {
        id: "attachment-1",
        markupMarkId: "mark-1",
        originalName: "sill.jpg",
        name: null,
        contentType: "image/jpeg",
        url: "company/sill.jpg",
      },
    ]);
    r2Mocks.downloadR2Object
      .mockResolvedValueOnce(Buffer.from("pdf"))
      .mockResolvedValueOnce(Buffer.from("jpg"));

    await ensureFileMarkupPdf({
      file: {
        id: "file-1",
        url: "company/file.pdf",
        originalName: "Plan.pdf",
        name: null,
        contentType: "application/pdf",
      },
      companyId: "company-1",
    });

    expect(prismaMocks.fileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: "company-1", markupMarkId: { in: ["mark-1"] }, type: "PHOTO" }),
      }),
    );
    expect(flattenMarkupToPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        pinAttachments: [
          {
            markId: "mark-1",
            id: "attachment-1",
            filename: "sill.jpg",
            contentType: "image/jpeg",
            bytes: Buffer.from("jpg"),
          },
        ],
      }),
    );
  });
});
