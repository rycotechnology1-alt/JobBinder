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

export type PdfPageProxy = {
  getViewport: (input: { scale: number }) => PdfViewport;
  render: (input: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: unknown[] }>;
};

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

/** Render a page into the canvas at the given scale; returns the rendered pixel size. */
export async function renderPdfPageToCanvas(
  page: PdfPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ viewport: PdfViewport; width: number; height: number }> {
  const viewport = page.getViewport({ scale });
  const outputScale = typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);
  const renderViewport = outputScale === 1 ? viewport : page.getViewport({ scale: scale * outputScale });
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare PDF canvas.");
  await page.render({ canvasContext: context, viewport: renderViewport }).promise;
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
