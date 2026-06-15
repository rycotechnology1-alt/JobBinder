// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPdfTextLayer, isRenderCancelled, renderPdfPageToCanvas, type PdfPageProxy } from "./pdf-render";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  Util: {
    transform: (_viewport: number[], item: number[]) => item,
  },
}));

function makeCancelledError(): Error {
  return Object.assign(new Error("Rendering cancelled"), { name: "RenderingCancelledException" });
}

function pageWithViewport(baseWidth: number, baseHeight: number, render: PdfPageProxy["render"]): PdfPageProxy {
  return {
    getViewport: vi.fn(({ scale }: { scale: number }) => ({
      width: baseWidth * scale,
      height: baseHeight * scale,
      transform: [],
    })),
    render,
    getTextContent: vi.fn(),
  } as unknown as PdfPageProxy;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("pdf render helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses high-DPI backing pixels while returning CSS page size", async () => {
    vi.stubGlobal("devicePixelRatio", 2);
    const canvas = document.createElement("canvas");
    const context = {} as CanvasRenderingContext2D;
    vi.spyOn(canvas, "getContext").mockReturnValue(context);
    const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    const page = pageWithViewport(600, 800, render as unknown as PdfPageProxy["render"]);

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

  it("serializes renders on one canvas: cancels and waits for the in-flight task before re-rendering", async () => {
    vi.stubGlobal("devicePixelRatio", 1);
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({} as CanvasRenderingContext2D);

    let rejectFirst!: (reason: unknown) => void;
    const firstTask = {
      cancel: vi.fn(),
      promise: new Promise<void>((_, reject) => {
        rejectFirst = reject;
      }),
    };
    const secondTask = { cancel: vi.fn(), promise: Promise.resolve() };
    const render = vi.fn().mockReturnValueOnce(firstTask).mockReturnValueOnce(secondTask);
    const page = pageWithViewport(600, 800, render as unknown as PdfPageProxy["render"]);

    const first = renderPdfPageToCanvas(page, canvas, 1);
    const second = renderPdfPageToCanvas(page, canvas, 2);

    await flush();
    // The second render must not start until the first task has settled.
    expect(render).toHaveBeenCalledTimes(1);
    expect(firstTask.cancel).toHaveBeenCalledTimes(1);

    rejectFirst(makeCancelledError());

    await expect(second).resolves.toMatchObject({ width: 1200, height: 1600 });
    expect(render).toHaveBeenCalledTimes(2);

    // The superseded call rejects with a recognizable cancellation that callers ignore.
    await expect(first).rejects.toSatisfy(isRenderCancelled);
  });

  it("caps the backing store so huge pages never exceed the max canvas dimension", async () => {
    vi.stubGlobal("devicePixelRatio", 3);
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    const page = pageWithViewport(5000, 4000, render as unknown as PdfPageProxy["render"]);

    const result = await renderPdfPageToCanvas(page, canvas, 1);

    // dpr 3 would give 15000x12000; capped to <= 8192 on the limiting axis, aspect preserved.
    expect(canvas.width).toBe(8192);
    expect(canvas.height).toBeLessThanOrEqual(8192);
    expect(canvas.height).toBe(Math.floor(4000 * (8192 / 5000)));
    // CSS layout size is unchanged by the cap.
    expect(canvas.style.width).toBe("5000px");
    expect(canvas.style.height).toBe("4000px");
    expect(result.width).toBe(5000);
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
