"use client";

// Renders one page of the base document (a pdf.js canvas, or an image) at the
// given *raster* scale and exposes the rendered pixel size to an overlay via a
// render-prop. It lives inside the viewport's transformed wrapper, so it owns no
// centering or scrolling of its own — only the page box at base × rasterScale.
// Live zoom between rasterizations is handled by the wrapper's CSS transform.

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  isRenderCancelled,
  loadPdfFromUrl,
  renderPdfPageToCanvas,
  type PdfDocumentProxy,
} from "@/lib/markup/pdf-render";
import type { Size } from "./MarkShape";

type Props = {
  mode: "pdf" | "image";
  src: string;
  pageNumber: number;
  rasterScale: number;
  onNumPages?: (numPages: number) => void;
  onStatus?: (status: string) => void;
  onBaseSize?: (size: Size) => void;
  children: (size: Size) => ReactNode;
};

const EMPTY: Size = { width: 0, height: 0 };

export function PageSurface({ mode, src, pageNumber, rasterScale, onNumPages, onStatus, onBaseSize, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [pdfBase, setPdfBase] = useState<Size>(EMPTY);
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
      if (canceled) return;
      // Publish the page's natural size up front so layout/overlay can size
      // themselves before the (heavier) rasterization completes.
      const natural = page.getViewport({ scale: 1 });
      setPdfBase({ width: natural.width, height: natural.height });
      onBaseSize?.({ width: natural.width, height: natural.height });
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        await renderPdfPageToCanvas(page, canvas, rasterScale);
      } catch (error) {
        if (isRenderCancelled(error)) return; // a newer raster superseded this one
        throw error;
      }
      if (canceled) return;
      onStatus?.("");
    }
    render().catch((error) => onStatus?.(error instanceof Error ? error.message : "Could not render page."));
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, doc, pageNumber, rasterScale]);

  // Intrinsic page-box size is base × rasterScale; the wrapper transform applies
  // the remaining viewScale/rasterScale factor for smooth live zoom.
  const base = mode === "pdf" ? pdfBase : imageNatural;
  const size: Size = { width: base.width * rasterScale, height: base.height * rasterScale };

  return (
    <div className="relative bg-white shadow-2xl" style={{ width: size.width || undefined, height: size.height || undefined }}>
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
