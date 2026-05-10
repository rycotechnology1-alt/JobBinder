import { describe, expect, it } from "vitest";
import { createR2ObjectKey, getSafeFileExtension, isCompanyScopedObjectKey } from "./r2";

describe("r2 storage helpers", () => {
  it("creates company-scoped object keys with safe extensions", () => {
    expect(createR2ObjectKey("company_123", "file_456", "Progress Photo.JPG")).toBe(
      "company_123/file_456.jpg",
    );
    expect(createR2ObjectKey("company_123", "file_456", "permit")).toBe(
      "company_123/file_456.bin",
    );
    expect(createR2ObjectKey("company_123", "file_456", "archive.tar.gz")).toBe(
      "company_123/file_456.gz",
    );
  });

  it("rejects unsafe or missing filename extensions", () => {
    expect(getSafeFileExtension("receipt.pdf")).toBe("pdf");
    expect(getSafeFileExtension("invoice.2026.PDF")).toBe("pdf");
    expect(getSafeFileExtension("no-extension")).toBe("bin");
    expect(getSafeFileExtension("weird.<script>")).toBe("bin");
  });

  it("detects whether an object key belongs to a company prefix", () => {
    expect(isCompanyScopedObjectKey("company_123/file_456.pdf", "company_123")).toBe(true);
    expect(isCompanyScopedObjectKey("company_123/nested/file_456.pdf", "company_123")).toBe(true);
    expect(isCompanyScopedObjectKey("company_1234/file_456.pdf", "company_123")).toBe(false);
    expect(isCompanyScopedObjectKey("../company_123/file_456.pdf", "company_123")).toBe(false);
  });
});
