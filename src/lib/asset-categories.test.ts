import { describe, expect, it } from "vitest";
import {
  ASSET_CATEGORIES,
  DEFAULT_ASSET_CATEGORY,
  getFileTypeForMime,
  getMimeTypeForFilename,
  normalizeAssetCategory,
  validateFileUploadInput,
} from "./asset-categories";

describe("asset category and file rules", () => {
  it("keeps one shared ordered category list with Misc as the default", () => {
    expect(ASSET_CATEGORIES).toEqual([
      "Before",
      "During",
      "After",
      "Issue",
      "Material",
      "Inspection",
      "Damage",
      "Completed Work",
      "Punch List",
      "Plans",
      "Permits",
      "Quotes",
      "Invoices",
      "Receipts",
      "Cut Sheets",
      "Inspection Documents",
      "Customer Documents",
      "Misc",
    ]);
    expect(DEFAULT_ASSET_CATEGORY).toBe("Misc");
  });

  it("normalizes invalid or empty categories to Misc", () => {
    expect(normalizeAssetCategory("Inspection")).toBe("Inspection");
    expect(normalizeAssetCategory("  Material  ")).toBe("Material");
    expect(normalizeAssetCategory("Unknown bucket")).toBe("Misc");
    expect(normalizeAssetCategory(null)).toBe("Misc");
  });

  it("maps supported mime types to Prisma file types", () => {
    expect(getFileTypeForMime("image/jpeg")).toBe("PHOTO");
    expect(getFileTypeForMime("image/png")).toBe("PHOTO");
    expect(getFileTypeForMime("application/pdf")).toBe("DOCUMENT");
    expect(getFileTypeForMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("DOCUMENT");
    expect(getFileTypeForMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("DOCUMENT");
    expect(getFileTypeForMime("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe("DOCUMENT");
    expect(getFileTypeForMime("text/plain")).toBe("DOCUMENT");
    expect(getFileTypeForMime("text/csv")).toBe("DOCUMENT");
    expect(getFileTypeForMime("application/x-msdownload")).toBeNull();
  });

  it("infers supported mime types from common file extensions", () => {
    expect(getMimeTypeForFilename("photo.JPG")).toBe("image/jpeg");
    expect(getMimeTypeForFilename("permit.pdf")).toBe("application/pdf");
    expect(getMimeTypeForFilename("scope.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(getMimeTypeForFilename("costs.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(getMimeTypeForFilename("deck.pptx")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(getMimeTypeForFilename("notes.txt")).toBe("text/plain");
    expect(getMimeTypeForFilename("materials.csv")).toBe("text/csv");
    expect(getMimeTypeForFilename("run-me.exe")).toBeNull();
  });

  it("validates upload input and returns normalized fields", () => {
    expect(
      validateFileUploadInput({
        originalName: " permit.pdf ",
        objectKey: "company/file.pdf",
        contentType: "application/pdf",
        category: "Permits",
      }),
    ).toEqual({
      ok: true,
      value: {
        originalName: "permit.pdf",
        objectKey: "company/file.pdf",
        contentType: "application/pdf",
        sizeBytes: null,
        category: "Permits",
        type: "DOCUMENT",
      },
    });

    expect(
      validateFileUploadInput({
        originalName: "",
        objectKey: "company/file.exe",
        contentType: "application/x-msdownload",
        category: "Issue",
      }),
    ).toEqual({
      ok: false,
      error: "Missing originalName",
    });
  });
});
