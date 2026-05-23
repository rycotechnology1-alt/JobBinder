import { describe, expect, it } from "vitest";
import {
  buildScannedDocumentFileName,
  getPdfPageSize,
  getScaledImageDimensions,
} from "./scanicPdfGeneration";

describe("scanic PDF generation helpers", () => {
  it("builds the default scanned document filename with a local timestamp", () => {
    const fileName = buildScannedDocumentFileName(
      "Scanned Document",
      new Date("2026-05-22T15:04:00"),
    );

    expect(fileName).toBe("Scanned Document - 2026-05-22 15-04.pdf");
  });

  it("uses PDF page dimensions that preserve image orientation", () => {
    expect(getPdfPageSize({ width: 1600, height: 2200 })).toEqual({
      width: 1600,
      height: 2200,
    });
    expect(getPdfPageSize({ width: 2200, height: 1600 })).toEqual({
      width: 2200,
      height: 1600,
    });
  });

  it("scales scanned images to a max long edge while preserving aspect ratio", () => {
    expect(getScaledImageDimensions({ width: 4000, height: 2000 }, 2000)).toEqual({
      width: 2000,
      height: 1000,
    });
    expect(getScaledImageDimensions({ width: 1200, height: 1600 }, 2500)).toEqual({
      width: 1200,
      height: 1600,
    });
  });
});
