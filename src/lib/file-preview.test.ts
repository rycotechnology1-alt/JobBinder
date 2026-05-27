import { describe, expect, it } from "vitest";
import {
  getDownloadFilename,
  getFilePreviewInfo,
  getOriginalContentUrl,
  isOfficePreviewType,
} from "./file-preview";

describe("file preview rules", () => {
  it("chooses direct render modes from persisted content type", () => {
    expect(getFilePreviewInfo({ filename: "before.jpg", contentType: "image/jpeg" }).renderMode).toBe("image");
    expect(getFilePreviewInfo({ filename: "permit.pdf", contentType: "application/pdf" }).renderMode).toBe("pdf");
    expect(getFilePreviewInfo({ filename: "notes.txt", contentType: "text/plain" }).renderMode).toBe("text");
    expect(getFilePreviewInfo({ filename: "materials.csv", contentType: "text/csv" }).renderMode).toBe("csv");
    expect(getFilePreviewInfo({ filename: "costs.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }).renderMode).toBe("spreadsheet");
  });

  it("falls back to filename extension for legacy records without content type", () => {
    expect(getFilePreviewInfo({ filename: "legacy.pdf", contentType: null })).toMatchObject({
      contentType: "application/pdf",
      renderMode: "pdf",
    });
    expect(getFilePreviewInfo({ filename: "legacy.pptx", contentType: null })).toMatchObject({
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      renderMode: "office",
    });
  });

  it("identifies office files that need cached PDF preview artifacts", () => {
    expect(isOfficePreviewType("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(true);
    expect(isOfficePreviewType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(false);
    expect(isOfficePreviewType("application/pdf")).toBe(false);
    expect(getFilePreviewInfo({ filename: "scope.docx", contentType: null }).renderMode).toBe("office");
  });

  it("keeps original extensions when display names omit them", () => {
    expect(getDownloadFilename("test xlsx doc", "00 - Job Text Items.xlsx")).toBe("test xlsx doc.xlsx");
    expect(getDownloadFilename("permit.pdf", "original.pdf")).toBe("permit.pdf");
    expect(getDownloadFilename(null, "original.xlsx")).toBe("original.xlsx");
  });

  it("keeps original content behind same-origin app routes", () => {
    expect(getOriginalContentUrl("file-1")).toBe("/api/files/file-1/content");
    expect(getOriginalContentUrl("file-1", { download: true })).toBe("/api/files/file-1/content?download=1");
  });
});
