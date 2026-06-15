import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireFileAccess = vi.fn();
const accessErrorResponse = vi.fn();
const fileFindFirst = vi.fn();
const markCount = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireFileAccess,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    file: {
      findFirst: fileFindFirst,
    },
    fileMarkupMark: {
      count: markCount,
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
    requireFileAccess.mockResolvedValue({
      user: { id: "user-1", companyId: "company-1" },
      file: { id: "file-1" },
    });
    accessErrorResponse.mockReturnValue(null);
    markCount.mockResolvedValue(0);
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

  it("reports markup presence so the viewer can offer the Original/Marked-up toggle", async () => {
    markCount.mockResolvedValueOnce(3);
    const response = await getPreview();
    expect(await response.json()).toMatchObject({
      markup: { hasMarkups: true, markCount: 3 },
    });
  });

  it("reports no markup when the file has none", async () => {
    const response = await getPreview();
    expect(await response.json()).toMatchObject({
      markup: { hasMarkups: false, markCount: 0 },
    });
  });
});
