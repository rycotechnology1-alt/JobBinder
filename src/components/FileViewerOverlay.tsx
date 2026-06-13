"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Download,
  FileIcon,
  Loader2,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getPreviewMetadataUrl } from "@/lib/file-preview";

type RenderMode = "image" | "pdf" | "text" | "csv" | "spreadsheet" | "docx" | "unsupported";
type PdfViewport = {
  width: number;
  height: number;
  transform: number[];
};
type PdfTextItem = {
  str: string;
  transform: number[];
};
type PdfPageProxy = {
  getViewport: (input: { scale: number }) => PdfViewport;
  render: (input: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: unknown[] }>;
};
type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
};
type Size = {
  width: number;
  height: number;
};

type PreviewPayload = {
  file: {
    id: string;
    filename: string;
    originalName: string;
    contentType: string | null;
    renderMode: RenderMode;
    originalUrl: string;
    downloadUrl: string;
    spreadsheetPreviewUrl: string | null;
    sizeBytes: number | null;
    category: string | null;
  };
  previewArtifact: null;
};

type Props = {
  fileId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialFilename?: string;
};

function formatBytes(sizeBytes: number | null) {
  if (sizeBytes === null) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileViewerOverlay({ fileId, isOpen, onClose, initialFilename }: Props) {
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!fileId) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getPreviewMetadataUrl(fileId));
      const nextPayload = await response.json();
      if (!response.ok) throw new Error(nextPayload.error || "Could not load file preview.");
      setPayload(nextPayload);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Could not load file preview.");
    } finally {
      setIsLoading(false);
    }
  }, [fileId]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => void loadPreview());
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, loadPreview]);

  if (!isOpen || !fileId || typeof document === "undefined") return null;

  const file = payload?.file;
  const sizeLabel = file ? formatBytes(file.sizeBytes) : null;

  return createPortal(
    <div className="fixed inset-0 z-[130] bg-zinc-950 text-zinc-50">
      <div role="dialog" aria-modal="true" aria-label="File preview" className="flex h-dvh flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/95 px-3 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300">
              <FileIcon size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-50 sm:text-base">
                {file?.filename ?? initialFilename ?? "Loading file..."}
              </h2>
              <p className="truncate text-xs text-zinc-500">
                {[file?.contentType, sizeLabel, file?.category].filter(Boolean).join(" · ") || "Preparing preview"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {file && (
              <a
                href={file.downloadUrl}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-transparent px-3 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-zinc-950"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Download</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
              aria-label="Close file preview"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 bg-zinc-950">
          {isLoading && !payload ? (
            <CenteredState icon={<Loader2 className="animate-spin" size={24} />} title="Loading preview" />
          ) : error && !payload ? (
            <CenteredState icon={<AlertCircle size={24} />} title="Could not open file" message={error} />
          ) : file ? (
            <PreviewSurface
              file={file}
            />
          ) : null}
        </main>
      </div>
    </div>,
    document.body,
  );
}

function PreviewSurface({
  file,
}: {
  file: PreviewPayload["file"];
}) {
  if (file.renderMode === "image") return <ImagePreview src={file.originalUrl} alt={file.filename} />;
  if (file.renderMode === "pdf") return <PdfPreview src={file.originalUrl} />;
  if (file.renderMode === "text") return <TextPreview src={file.originalUrl} />;
  if (file.renderMode === "csv") return <CsvPreview src={file.originalUrl} />;
  if (file.renderMode === "docx") return <DocxPreview src={file.originalUrl} />;
  if (file.renderMode === "spreadsheet" && file.spreadsheetPreviewUrl) {
    return <SpreadsheetPreview src={file.spreadsheetPreviewUrl} />;
  }

  return (
    <CenteredState
      icon={<AlertCircle size={24} />}
      title="Preview unavailable"
      message="This file type cannot be previewed in the app yet. Download the original file to open it."
    />
  );
}

function DocxPreview({ src }: { src: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Loading DOCX...");
  const [error, setError] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);

  const scale = Math.max(0.25, Math.min(3, fitScale * zoom));

  useEffect(() => {
    let isCanceled = false;
    const viewport = viewportRef.current;
    const bodyContainer = bodyRef.current;
    const styleContainer = styleRef.current;

    function updateFit() {
      if (!viewport || !bodyContainer) return;

      const nextSize = measureRenderedContent(bodyContainer);
      const viewportStyle = window.getComputedStyle(viewport);
      const horizontalPadding =
        (Number.parseFloat(viewportStyle.paddingLeft) || 0) + (Number.parseFloat(viewportStyle.paddingRight) || 0);
      const viewportWidth = Math.max(0, viewport.getBoundingClientRect().width - horizontalPadding);
      const nextFitScale = nextSize.width > 0 && viewportWidth > 0
        ? Math.min(1, viewportWidth / nextSize.width)
        : 1;

      setNaturalSize(nextSize);
      setFitScale(nextFitScale);
    }

    async function loadDocx() {
      setError(null);
      setStatus("Loading DOCX...");
      setNaturalSize({ width: 0, height: 0 });
      setFitScale(1);
      setZoom(1);

      const response = await fetch(src);
      if (!response.ok) throw new Error("Could not load DOCX.");
      const bytes = await response.arrayBuffer();
      if (!bodyContainer || !styleContainer || isCanceled) return;

      bodyContainer.replaceChildren();
      styleContainer.replaceChildren();
      setStatus("Rendering DOCX...");

      const { renderAsync } = await import("docx-preview");
      await renderAsync(bytes, bodyContainer, styleContainer, {
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        renderComments: false,
      });

      if (!isCanceled) {
        updateFit();
        setStatus("");
      }
    }

    loadDocx().catch((docxError) => {
      if (!isCanceled) {
        setStatus("");
        setError(docxError instanceof Error ? docxError.message : "Could not render DOCX.");
      }
    });

    window.addEventListener("resize", updateFit);

    return () => {
      isCanceled = true;
      window.removeEventListener("resize", updateFit);
      bodyContainer?.replaceChildren();
      styleContainer?.replaceChildren();
    };
  }, [src]);

  if (error) return <CenteredState icon={<AlertCircle size={24} />} title="Could not open DOCX" message={error} />;

  return (
    <div className="flex h-full flex-col">
      <ViewerToolbar>
        <IconButton label="Zoom out" onClick={() => setZoom((current) => Math.max(0.5, current - 0.2))}>
          <ZoomOut size={16} />
        </IconButton>
        <span className="min-w-12 text-center text-xs text-zinc-400">{Math.round(scale * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => setZoom((current) => Math.min(3, current + 0.2))}>
          <ZoomIn size={16} />
        </IconButton>
        <IconButton label="Fit width" onClick={() => setZoom(1)}>
          <Maximize2 size={16} />
        </IconButton>
      </ViewerToolbar>
      <div ref={viewportRef} data-testid="docx-preview-viewport" className="min-h-0 flex-1 overflow-auto bg-zinc-800 p-0 sm:p-6">
        {status && <p className="p-4 text-center text-sm text-zinc-400">{status}</p>}
        <div ref={styleRef} />
        <div
          data-testid="docx-preview-frame"
          className="mx-auto"
          style={{
            width: naturalSize.width ? `${naturalSize.width * scale}px` : undefined,
            height: naturalSize.height ? `${naturalSize.height * scale}px` : undefined,
          }}
        >
          <div
            ref={bodyRef}
            data-testid="docx-preview-document"
            className="origin-top-left text-zinc-950"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: naturalSize.width ? `${naturalSize.width}px` : undefined,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function measureRenderedContent(container: HTMLElement): Size {
  const children = Array.from(container.children) as HTMLElement[];
  const elements = children.length ? children : [container];
  const rects = elements.map((element) => element.getBoundingClientRect());

  return {
    width: Math.max(container.scrollWidth, ...rects.map((rect) => rect.width)),
    height: Math.max(container.scrollHeight, ...rects.map((rect) => rect.height)),
  };
}

function CenteredState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-zinc-300">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          {message && <p className="mt-2 text-sm leading-6 text-zinc-500">{message}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);

  return (
    <div className="flex h-full flex-col">
      <ViewerToolbar>
        <IconButton label="Zoom out" onClick={() => setScale((current) => Math.max(0.5, current - 0.25))}>
          <ZoomOut size={16} />
        </IconButton>
        <span className="min-w-12 text-center text-xs text-zinc-400">{Math.round(scale * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => setScale((current) => Math.min(3, current + 0.25))}>
          <ZoomIn size={16} />
        </IconButton>
      </ViewerToolbar>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
          />
        </div>
      </div>
    </div>
  );
}

function PdfPreview({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [status, setStatus] = useState("Loading PDF...");
  const [pdfDocument, setPdfDocument] = useState<PdfDocumentProxy | null>(null);

  useEffect(() => {
    let isCanceled = false;

    async function loadPdf() {
      setStatus("Loading PDF...");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
      const response = await fetch(src);
      if (!response.ok) throw new Error("Could not load PDF.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const document = await pdfjs.getDocument({ data: bytes }).promise as unknown as PdfDocumentProxy;
      if (isCanceled) {
        await document.destroy();
        return;
      }
      setPdfDocument(document);
      setPageCount(document.numPages);
      setPageNumber(1);
    }

    loadPdf().catch((error) => {
      if (!isCanceled) setStatus(error instanceof Error ? error.message : "Could not load PDF.");
    });

    return () => {
      isCanceled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current || !textLayerRef.current) return;
    let isCanceled = false;
    const currentDocument = pdfDocument;

    async function renderPage() {
      setStatus("Rendering page...");
      const page = await currentDocument.getPage(pageNumber);
      if (isCanceled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;
      if (!canvas || !textLayer) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      textLayer.replaceChildren();

      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare PDF canvas.");
      await page.render({ canvasContext: context, viewport }).promise;

      const pdfjs = await import("pdfjs-dist");
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
        span.style.userSelect = "text";
        textLayer.appendChild(span);
      }

      setStatus("");
    }

    renderPage().catch((error) => {
      if (!isCanceled) setStatus(error instanceof Error ? error.message : "Could not render PDF page.");
    });

    return () => {
      isCanceled = true;
    };
  }, [pdfDocument, pageNumber, scale]);

  return (
    <div className="flex h-full flex-col">
      <ViewerToolbar>
        <Button type="button" variant="ghost" size="sm" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>
          Previous
        </Button>
        <span className="text-xs text-zinc-400">Page {pageNumber} of {pageCount || "..."}</span>
        <Button type="button" variant="ghost" size="sm" disabled={pageCount === 0 || pageNumber >= pageCount} onClick={() => setPageNumber((page) => page + 1)}>
          Next
        </Button>
        <IconButton label="Zoom out" onClick={() => setScale((current) => Math.max(0.6, current - 0.2))}>
          <ZoomOut size={16} />
        </IconButton>
        <IconButton label="Zoom in" onClick={() => setScale((current) => Math.min(2.4, current + 0.2))}>
          <ZoomIn size={16} />
        </IconButton>
      </ViewerToolbar>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {status && <p className="mb-3 text-center text-sm text-zinc-500">{status}</p>}
        <div className="mx-auto w-fit rounded-lg bg-white shadow-2xl">
          <div className="relative">
            <canvas ref={canvasRef} />
            <div ref={textLayerRef} className="absolute inset-0 overflow-hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  if (!item || typeof item !== "object") return false;
  const candidate = item as { str?: unknown; transform?: unknown };
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

function TextPreview({ src }: { src: string }) {
  const [content, setContent] = useState("Loading text...");

  useEffect(() => {
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load text.");
        return response.text();
      })
      .then(setContent)
      .catch((error) => setContent(error instanceof Error ? error.message : "Could not load text."));
  }, [src]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <pre className="mx-auto max-w-5xl whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/70 p-4 text-sm leading-6 text-zinc-100">
        {content}
      </pre>
    </div>
  );
}

function CsvPreview({ src }: { src: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load CSV.");
        return response.text();
      })
      .then((text) => setRows(parseCsv(text)))
      .catch((csvError) => setError(csvError instanceof Error ? csvError.message : "Could not load CSV."));
  }, [src]);

  if (error) return <CenteredState icon={<AlertCircle size={24} />} title="Could not open CSV" message={error} />;
  if (!rows) return <CenteredState icon={<Loader2 className="animate-spin" size={24} />} title="Loading CSV" />;

  return (
    <div className="h-full overflow-auto p-4 sm:p-6">
      <table className="mx-auto min-w-full max-w-6xl border-collapse rounded-lg border border-zinc-800 bg-zinc-900/70 text-left text-sm text-zinc-100">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-zinc-800 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="max-w-xs border-r border-zinc-800 px-3 py-2 align-top last:border-r-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type SpreadsheetSheet = {
  name: string;
  rows: string[][];
};

function SpreadsheetPreview({ src }: { src: string }) {
  const [sheets, setSheets] = useState<SpreadsheetSheet[] | null>(null);
  const [activeSheetName, setActiveSheetName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load spreadsheet.");
        return response.json();
      })
      .then((payload: { sheets: SpreadsheetSheet[] }) => {
        setSheets(payload.sheets);
        setActiveSheetName(payload.sheets[0]?.name ?? null);
      })
      .catch((spreadsheetError) => {
        setError(spreadsheetError instanceof Error ? spreadsheetError.message : "Could not load spreadsheet.");
      });
  }, [src]);

  if (error) return <CenteredState icon={<AlertCircle size={24} />} title="Could not open spreadsheet" message={error} />;
  if (!sheets) return <CenteredState icon={<Loader2 className="animate-spin" size={24} />} title="Loading spreadsheet" />;

  const activeSheet = sheets.find((sheet) => sheet.name === activeSheetName) ?? sheets[0];
  if (!activeSheet) {
    return <CenteredState icon={<AlertCircle size={24} />} title="Spreadsheet is empty" message="No sheets were found in this workbook." />;
  }

  return (
    <div className="flex h-full flex-col">
      {sheets.length > 1 && (
        <ViewerToolbar>
          <div className="flex max-w-full gap-2 overflow-x-auto">
            {sheets.map((sheet) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => setActiveSheetName(sheet.name)}
                className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition-colors ${
                  sheet.name === activeSheet.name
                    ? "bg-brand text-white"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                }`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        </ViewerToolbar>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <table className="min-w-full border-collapse rounded-lg border border-zinc-800 bg-zinc-900/70 text-left text-sm text-zinc-100">
          <tbody>
            {activeSheet.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-zinc-800 last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`} className="max-w-sm border-r border-zinc-800 px-3 py-2 align-top last:border-r-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function parseCsv(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")));
}

function ViewerToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-center gap-2 border-b border-zinc-800 bg-zinc-950/80 px-3">
      {children}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
