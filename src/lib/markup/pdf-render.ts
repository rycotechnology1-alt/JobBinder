// Low-level pdf.js helpers shared by the file viewer and the markup editor so
// the worker is configured in exactly one place. Client-only (uses dynamic
// import of pdfjs-dist).

export type PdfViewport = {
  width: number;
  height: number;
  transform: number[];
};

type PdfTextItem = {
  str: string;
  transform: number[];
};

/** A pdf.js render task: its completion promise plus a cooperative cancel(). */
export type RenderTask = {
  promise: Promise<void>;
  cancel: () => void;
};

export type PdfPageProxy = {
  getViewport: (input: { scale: number }) => PdfViewport;
  render: (input: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => RenderTask;
  getTextContent: () => Promise<{ items: unknown[] }>;
};

// Largest backing-store edge we will allocate. pdf.js (and the browser) blank
// the canvas if it grows past the device limit, so we cap it: big plans at deep
// zoom stay within budget on mobile rather than rendering to a dead canvas.
const MAX_CANVAS_DIMENSION = 8192;

// One in-flight render per canvas. pdf.js throws "Cannot use the same canvas
// during multiple render() operations" if a second render starts before the
// first settles, so we cancel and await the previous task before re-rendering.
const activeRenders = new WeakMap<HTMLCanvasElement, RenderTask>();

/** True for the cancellation pdf.js raises (and we re-raise) when a render is superseded. */
export function isRenderCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "RenderingCancelledException"
  );
}

export type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
};

type PdfjsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function loadPdfFromUrl(src: string): Promise<PdfDocumentProxy> {
  const pdfjs = await getPdfjs();
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load PDF.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  return pdfjs.getDocument({ data: bytes }).promise as unknown as PdfDocumentProxy;
}

/**
 * Render a page into the canvas at the given scale; returns the rendered CSS
 * pixel size. Renders are serialized per canvas: any in-flight render on the
 * same canvas is cancelled and awaited first, so two renders never share a
 * canvas. A superseded call rejects with a cancellation (see isRenderCancelled)
 * that callers ignore.
 */
export async function renderPdfPageToCanvas(
  page: PdfPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ viewport: PdfViewport; width: number; height: number }> {
  const previous = activeRenders.get(canvas);
  if (previous) {
    previous.cancel();
    try {
      await previous.promise;
    } catch {
      // Expected: the previous render rejects when cancelled. Ignore it.
    }
  }

  const viewport = page.getViewport({ scale });
  const dpr = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
  // Cap the backing store: never let either edge exceed MAX_CANVAS_DIMENSION,
  // reducing the device-pixel multiplier uniformly so the aspect ratio holds.
  const outputScale = Math.min(dpr, MAX_CANVAS_DIMENSION / viewport.width, MAX_CANVAS_DIMENSION / viewport.height);
  const renderViewport = outputScale === 1 ? viewport : page.getViewport({ scale: scale * outputScale });
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare PDF canvas.");

  const task = page.render({ canvasContext: context, viewport: renderViewport });
  activeRenders.set(canvas, task);
  try {
    await task.promise;
  } finally {
    if (activeRenders.get(canvas) === task) activeRenders.delete(canvas);
  }
  return { viewport, width: viewport.width, height: viewport.height };
}

/** Build the transparent, selectable text layer over a rendered page. */
export async function buildPdfTextLayer(
  page: PdfPageProxy,
  viewport: PdfViewport,
  textLayer: HTMLElement,
  options: { selectable?: boolean } = {},
): Promise<void> {
  const pdfjs = await getPdfjs();
  textLayer.style.width = `${viewport.width}px`;
  textLayer.style.height = `${viewport.height}px`;
  textLayer.replaceChildren();
  const textContent = await page.getTextContent();
  for (const item of textContent.items.filter(isPdfTextItem)) {
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.position = "absolute";
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - Math.abs(tx[3])}px`;
    span.style.fontSize = `${Math.abs(tx[3])}px`;
    span.style.color = "transparent";
    span.style.whiteSpace = "pre";
    span.style.userSelect = options.selectable ? "text" : "none";
    span.style.webkitUserSelect = options.selectable ? "text" : "none";
    textLayer.appendChild(span);
  }
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as { str?: unknown; transform?: unknown };
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}
