import { beforeEach, describe, expect, it, vi } from "vitest";

const artifactFindFirst = vi.fn();
const artifactUpdate = vi.fn();
const downloadR2Object = vi.fn();
const uploadR2Object = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    filePreviewArtifact: {
      findFirst: artifactFindFirst,
      update: artifactUpdate,
    },
  },
}));

vi.mock("@/lib/r2", () => ({
  downloadR2Object,
  uploadR2Object,
}));

describe("FilePreviewConversionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    artifactFindFirst.mockResolvedValue({
      id: "artifact-1",
      fileId: "file-1",
      file: {
        id: "file-1",
        companyId: "company-1",
        url: "company-1/file-1.pptx",
      },
    });
    artifactUpdate.mockResolvedValue({});
    downloadR2Object.mockResolvedValue(Buffer.from("office bytes"));
    uploadR2Object.mockResolvedValue(undefined);
  });

  it("claims the next queued office artifact and stores a generated PDF preview", async () => {
    const { processNextOfficePreview } = await import("./FilePreviewConversionService");
    const converter = vi.fn().mockResolvedValue(Buffer.from("pdf bytes"));

    const result = await processNextOfficePreview({ convertToPdf: converter });

    expect(result).toEqual({ status: "processed", artifactId: "artifact-1" });
    expect(artifactUpdate).toHaveBeenCalledWith({
      where: { id: "artifact-1" },
      data: { status: "PROCESSING", lastError: null },
    });
    expect(downloadR2Object).toHaveBeenCalledWith("company-1/file-1.pptx");
    expect(converter).toHaveBeenCalledWith(Buffer.from("office bytes"), {
      inputStorageKey: "company-1/file-1.pptx",
      artifactId: "artifact-1",
    });
    expect(uploadR2Object).toHaveBeenCalledWith(
      "company-1/previews/file-1/artifact-1.pdf",
      Buffer.from("pdf bytes"),
      "application/pdf",
    );
    expect(artifactUpdate).toHaveBeenLastCalledWith({
      where: { id: "artifact-1" },
      data: {
        status: "READY",
        storageKey: "company-1/previews/file-1/artifact-1.pdf",
        contentType: "application/pdf",
        lastError: null,
      },
    });
  });

  it("marks conversion failures as retryable failed artifacts", async () => {
    const { processNextOfficePreview } = await import("./FilePreviewConversionService");
    const converter = vi.fn().mockRejectedValue(new Error("LibreOffice failed"));

    const result = await processNextOfficePreview({ convertToPdf: converter });

    expect(result).toEqual({ status: "failed", artifactId: "artifact-1", error: "LibreOffice failed" });
    expect(uploadR2Object).not.toHaveBeenCalled();
    expect(artifactUpdate).toHaveBeenLastCalledWith({
      where: { id: "artifact-1" },
      data: {
        status: "FAILED",
        lastError: "LibreOffice failed",
      },
    });
  });

  it("reports idle when no queued artifacts are available", async () => {
    artifactFindFirst.mockResolvedValueOnce(null);
    const { processNextOfficePreview } = await import("./FilePreviewConversionService");

    await expect(processNextOfficePreview({ convertToPdf: vi.fn() })).resolves.toEqual({ status: "idle" });

    expect(downloadR2Object).not.toHaveBeenCalled();
  });
});
