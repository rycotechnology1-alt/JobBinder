"use client";

// Renders one page of the base document (a pdf.js canvas, or an image) at a
// given scale and exposes the rendered pixel size to an overlay via a
// render-prop. Used by both the markup editor and the read-only marked-up view
// so the overlay always lines up exactly with what's drawn underneath.

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadPdfFromUrl, renderPdfPageToCanvas, type PdfDocumentProxy } from "@/lib/markup/pdf-render";
import type { Size } from "./MarkShape";

type Props = {
  mode: "pdf" | "image";
  src: string;
  pageNumber: number;
  scale: number;
  onNumPages?: (numPages: number) => void;
  onStatus?: (status: string) => void;
  onBaseSize?: (size: Size) => void;
  children: (size: Size) => ReactNode;
};

const EMPTY: Size = { width: 0, height: 0 };

export function PageSurface({ mode, src, pageNumber, scale, onNumPages, onStatus, onBaseSize, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [pdfSize, setPdfSize] = useState<Size>(EMPTY);
  const [imageNatural, setImageNatural] = useState<Size>(EMPTY);
  const [doc, setDoc] = useState<PdfDocumentProxy | null>(null);

  useEffect(() => {
    if (mode !== "pdf") return;
    let canceled = false;
    async function load() {
      onStatus?.("Loading PDF…");
      const loaded = await loadPdfFromUrl(src);
      if (canceled) {
        void loaded.destroy();
        return;
      }
      setDoc(loaded);
      onNumPages?.(loaded.numPages);
      onStatus?.("");
    }
    load().catch((error) => onStatus?.(error instanceof Error ? error.message : "Could not load PDF."));
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, src]);

  useEffect(() => () => void doc?.destroy(), [doc]);

  useEffect(() => {
    if (mode !== "pdf" || !doc) return;
    let canceled = false;
    async function render() {
      onStatus?.("Rendering…");
      const page = await doc!.getPage(pageNumber);
      if (canceled || !canvasRef.current) return;
      const rendered = await renderPdfPageToCanvas(page, canvasRef.current, scale);
      if (canceled) return;
      setPdfSize({ width: rendered.width, height: rendered.height });
      onBaseSize?.({ width: rendered.width / scale, height: rendered.height / scale });
      onStatus?.("");
    }
    render().catch((error) => onStatus?.(error instanceof Error ? error.message : "Could not render page."));
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, doc, pageNumber, scale]);

  // Displayed size is derived (no effect): the pdf canvas is rendered at scale
  // already; images are their natural size times the zoom.
  const size: Size =
    mode === "pdf" ? pdfSize : { width: imageNatural.width * scale, height: imageNatural.height * scale };

  return (
    <div className="relative mx-auto bg-white shadow-2xl" style={{ width: size.width || undefined, height: size.height || undefined }}>
      {mode === "pdf" ? (
        <canvas ref={canvasRef} className="block" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt=""
          onLoad={(event) => {
            const natural = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
            setImageNatural(natural);
            onBaseSize?.(natural);
          }}
          draggable={false}
          className="block select-none"
          style={{ width: size.width || undefined, height: size.height || undefined }}
        />
      )}
      {size.width > 0 && children(size)}
    </div>
  );
}
