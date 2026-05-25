// @vitest-environment jsdom

import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanicCornerReview } from "./ScanicCornerReview";
import type { ScanicCapture } from "./scanicTypes";

const extractDocument = vi.fn();

vi.mock("scanic", () => ({
  extractDocument,
}));

class LoadableImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

const capture: ScanicCapture = {
  blob: new Blob(["raw"], { type: "image/jpeg" }),
  width: 1000,
  height: 800,
  detectionMode: "capture",
  corners: {
    topLeft: { x: 100, y: 100 },
    topRight: { x: 900, y: 100 },
    bottomRight: { x: 900, y: 700 },
    bottomLeft: { x: 100, y: 700 },
  },
  confidence: 0.79,
  needsCornerReview: true,
};

describe("ScanicCornerReview", () => {
  beforeEach(() => {
    extractDocument.mockResolvedValue({
      success: true,
      output: document.createElement("canvas"),
    });
    vi.stubGlobal("Image", LoadableImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:corrected-preview");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value(callback: BlobCallback) {
        callback(new Blob(["corrected"], { type: "image/jpeg" }));
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows the perspective-corrected page as the primary review preview", async () => {
    render(
      <ScanicCornerReview
        capture={capture}
        objectUrl="blob:raw-capture"
        onAccept={vi.fn()}
        onRetake={vi.fn()}
        onError={vi.fn()}
      />,
    );

    const preview = await screen.findByAltText("Perspective-corrected page preview");

    await waitFor(() => {
      expect(preview.getAttribute("src")).toBe("blob:corrected-preview");
    });
    expect(screen.getByAltText("Captured page awaiting corner review").getAttribute("src")).toBe("blob:raw-capture");
    expect(extractDocument).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), capture.corners, { output: "canvas" });
  });
});
