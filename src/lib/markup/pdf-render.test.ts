// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPdfTextLayer, renderPdfPageToCanvas, type PdfPageProxy } from "./pdf-render";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  Util: {
    transform: (_viewport: number[], item: number[]) => item,
  },
}));

describe("pdf render helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses high-DPI backing pixels while returning CSS page size", async () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const canvas = document.createElement("canvas");
    const context = {} as CanvasRenderingContext2D;
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const page = {
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        transform: [],
      })),
      render,
      getTextContent: vi.fn(),
    } as unknown as PdfPageProxy;

    const result = await renderPdfPageToCanvas(page, canvas, 1.5);

    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(2400);
    expect(canvas.style.width).toBe("900px");
    expect(canvas.style.height).toBe("1200px");
    expect(result.width).toBe(900);
    expect(result.height).toBe(1200);
    expect(render).toHaveBeenCalledWith({
      canvasContext: context,
      viewport: expect.objectContaining({ width: 1800, height: 2400 }),
    });
  });

  it("builds a non-selectable text layer by default", async () => {
    const textLayer = document.createElement("div");
    const page = {
      getTextContent: vi.fn(async () => ({
        items: [{ str: "Scope", transform: [1, 0, 0, 12, 20, 30] }],
      })),
    } as unknown as PdfPageProxy;

    await buildPdfTextLayer(page, { width: 600, height: 800, transform: [1, 0, 0, 1, 0, 0] }, textLayer);

    const span = textLayer.querySelector("span");
    expect(span?.style.userSelect).toBe("none");
  });
});
