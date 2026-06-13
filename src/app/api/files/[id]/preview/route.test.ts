import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const fileFindFirst = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    file: {
      findFirst: fileFindFirst,
    },
  },
}));

async function getPreview(id = "file-1") {
  const { GET } = await import("./route");
  return GET(new NextRequest(`http://localhost/api/files/${id}/preview`), {
    params: Promise.resolve({ id }),
  });
}

describe("/api/files/[id]/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    fileFindFirst.mockResolvedValue({
      id: "file-1",
      type: "DOCUMENT",
      originalName: "scope.docx",
      name: "Scope",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 1234,
      category: "Customer Documents",
    });
  });

  it("returns DOCX preview metadata with authenticated same-origin content URLs", async () => {
    const response = await getPreview();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      file: {
        id: "file-1",
        filename: "Scope",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        renderMode: "docx",
        originalUrl: "/api/files/file-1/content",
        downloadUrl: "/api/files/file-1/content?download=1",
      },
      previewArtifact: null,
    });
  });

  it("treats XLSX files as direct spreadsheet previews instead of queued office conversions", async () => {
    fileFindFirst.mockResolvedValueOnce({
      id: "file-1",
      type: "DOCUMENT",
      originalName: "00 - Job Text Items.xlsx",
      name: "test xlsx doc",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 13543,
      category: "Misc",
    });

    const response = await getPreview();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      file: {
        filename: "test xlsx doc",
        renderMode: "spreadsheet",
        spreadsheetPreviewUrl: "/api/files/file-1/spreadsheet-preview",
      },
      previewArtifact: null,
    });
  });
});
