import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const fileFindFirst = vi.fn();
const previewArtifactFindFirst = vi.fn();
const previewArtifactUpsert = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    file: {
      findFirst: fileFindFirst,
    },
    filePreviewArtifact: {
      findFirst: previewArtifactFindFirst,
      upsert: previewArtifactUpsert,
    },
  },
}));

async function getPreview(id = "file-1") {
  const { GET } = await import("./route");
  return GET(new NextRequest(`http://localhost/api/files/${id}/preview`), {
    params: Promise.resolve({ id }),
  });
}

async function postPreview(id = "file-1") {
  const { POST } = await import("./route");
  return POST(new NextRequest(`http://localhost/api/files/${id}/preview`, { method: "POST" }), {
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
      originalName: "deck.pptx",
      name: "Deck",
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      sizeBytes: 1234,
      category: "Plans",
    });
    previewArtifactFindFirst.mockResolvedValue(null);
    previewArtifactUpsert.mockResolvedValue({
      id: "artifact-1",
      status: "QUEUED",
      kind: "OFFICE_PDF",
      contentType: "application/pdf",
      storageKey: null,
      lastError: null,
    });
  });

  it("returns preview metadata and same-origin URLs for office files", async () => {
    const response = await getPreview();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      file: {
        id: "file-1",
        filename: "Deck",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        renderMode: "office",
        originalUrl: "/api/files/file-1/content",
        downloadUrl: "/api/files/file-1/content?download=1",
      },
      previewArtifact: null,
    });
  });

  it("enqueues a manual preview artifact for authorized company members", async () => {
    const response = await postPreview();

    expect(response.status).toBe(202);
    expect(previewArtifactUpsert).toHaveBeenCalledWith({
      where: { fileId_kind: { fileId: "file-1", kind: "OFFICE_PDF" } },
      create: expect.objectContaining({
        fileId: "file-1",
        kind: "OFFICE_PDF",
        status: "QUEUED",
        contentType: "application/pdf",
        requestedById: "user-1",
      }),
      update: expect.objectContaining({
        status: "QUEUED",
        requestedById: "user-1",
      }),
    });
  });

  it("does not enqueue previews for directly renderable PDFs", async () => {
    fileFindFirst.mockResolvedValueOnce({
      id: "file-1",
      type: "DOCUMENT",
      originalName: "permit.pdf",
      name: "Permit",
      contentType: "application/pdf",
      sizeBytes: 1234,
      category: "Permits",
    });

    const response = await postPreview();

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "This file type does not need a generated preview." });
    expect(previewArtifactUpsert).not.toHaveBeenCalled();
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
    expect(previewArtifactFindFirst).not.toHaveBeenCalled();
  });
});
