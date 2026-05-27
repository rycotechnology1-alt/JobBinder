import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCompanyUser = vi.fn();
const accessErrorResponse = vi.fn();
const previewArtifactFindFirst = vi.fn();
const downloadR2Object = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireCompanyUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    filePreviewArtifact: {
      findFirst: previewArtifactFindFirst,
    },
  },
}));

vi.mock("@/lib/r2", () => ({
  downloadR2Object,
}));

async function getPreviewContent(id = "file-1") {
  const { GET } = await import("./route");
  return GET(new NextRequest(`http://localhost/api/files/${id}/preview-content`), {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/files/[id]/preview-content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCompanyUser.mockResolvedValue({ id: "user-1", companyId: "company-1" });
    accessErrorResponse.mockReturnValue(null);
    previewArtifactFindFirst.mockResolvedValue({
      id: "artifact-1",
      storageKey: "company-1/previews/file-1.pdf",
      contentType: "application/pdf",
      file: { name: "Deck", originalName: "deck.pptx" },
    });
    downloadR2Object.mockResolvedValue(Buffer.from("preview pdf"));
  });

  it("streams a ready cached preview for the user's company file", async () => {
    const response = await getPreviewContent();

    expect(response.status).toBe(200);
    expect(previewArtifactFindFirst).toHaveBeenCalledWith({
      where: {
        fileId: "file-1",
        kind: "OFFICE_PDF",
        status: "READY",
        file: { companyId: "company-1" },
      },
      include: { file: { select: { originalName: true, name: true } } },
    });
    expect(downloadR2Object).toHaveBeenCalledWith("company-1/previews/file-1.pdf");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(await response.text()).toBe("preview pdf");
  });

  it("returns 404 until a generated preview is ready", async () => {
    previewArtifactFindFirst.mockResolvedValueOnce(null);

    const response = await getPreviewContent();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Preview not found" });
    expect(downloadR2Object).not.toHaveBeenCalled();
  });
});
