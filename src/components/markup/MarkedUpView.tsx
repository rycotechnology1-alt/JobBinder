"use client";

// Read-only "Marked-up" view shown inside the file viewer: the original page
// with the saved marks composited on top. Tapping a pin reveals its comment.
// "Edit markup" hands off to the full editor.

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Pencil, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMarkupStore } from "@/lib/markup/useMarkupStore";
import type { Mark } from "@/lib/markup/types";
import type { Size } from "@/lib/markup/viewport";
import { MarkupCanvasLayer } from "./MarkupCanvasLayer";
import { PageSurface } from "./PageSurface";
import { useMarkupViewport } from "./useMarkupViewport";

type Props = {
  fileId: string;
  src: string;
  mode: "pdf" | "image";
  onEdit: () => void;
};

const EMPTY_SIZE: Size = { width: 0, height: 0 };
const NO_SELECT_STYLE: CSSProperties & { WebkitTouchCallout?: string } = {
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  userSelect: "none",
};

export function MarkedUpView({ fileId, src, mode, onEdit }: Props) {
  const store = useMarkupStore(fileId);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [baseSize, setBaseSize] = useState<Size>(EMPTY_SIZE);
  const [status, setStatus] = useState("");
  const [activePin, setActivePin] = useState<Mark | null>(null);
  const viewport = useMarkupViewport({
    baseSize,
    pageKey: mode === "pdf" ? pageNumber : src,
    navigationEnabled: true,
    padding: 32,
  });

  const pinNumbers = useMemo(() => {
    const map = new Map<string, number>();
    store.marks
      .filter((m) => m.kind === "PIN")
      .sort((a, b) => a.sequence - b.sequence)
      .forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }, [store.marks]);

  return (
    <div className="flex h-full select-none flex-col" style={NO_SELECT_STYLE}>
      <div className="flex h-12 shrink-0 items-center justify-center gap-2 border-b border-zinc-800 bg-zinc-950/80 px-3">
        {mode === "pdf" && (
          <>
            <button type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => setPageNumber((p) => p - 1)} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-zinc-400">Page {pageNumber} / {numPages || "…"}</span>
            <button type="button" aria-label="Next page" disabled={pageNumber >= numPages} onClick={() => setPageNumber((p) => p + 1)} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
              <ChevronRight size={18} />
            </button>
            <div className="mx-1 h-5 w-px bg-zinc-800" />
          </>
        )}
        <button type="button" aria-label="Zoom out" onClick={viewport.zoomOut} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <ZoomOut size={18} />
        </button>
        <span className="min-w-12 text-center text-xs text-zinc-400">{Math.round(viewport.scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={viewport.zoomIn} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <ZoomIn size={18} />
        </button>
        <button type="button" aria-label="Fit to screen" onClick={viewport.fitToScreen} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <Maximize2 size={18} />
        </button>
        <div className="mx-1 h-5 w-px bg-zinc-800" />
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onEdit}>
          <Pencil size={14} />
          Edit markup
        </Button>
      </div>

      <div
        ref={viewport.viewportRef}
        className="min-h-0 flex-1 overflow-auto p-4"
        style={{ ...NO_SELECT_STYLE, touchAction: "none" }}
        {...viewport.pointerHandlers}
      >
        {status && <p className="mb-3 text-center text-sm text-zinc-500">{status}</p>}
        <PageSurface
          mode={mode}
          src={src}
          pageNumber={pageNumber}
          scale={viewport.scale}
          onNumPages={setNumPages}
          onStatus={setStatus}
          onBaseSize={setBaseSize}
        >
          {(size) => (
            <MarkupCanvasLayer
              marks={store.marks}
              size={size}
              page={pageNumber}
              tool="select"
              style={{ color: "#ef4444", strokeWidth: 0.005, opacity: 1 }}
              selectedId={null}
              readOnly
              onSelect={() => {}}
              onCreate={() => {}}
              onMove={() => {}}
              onPinTap={setActivePin}
            />
          )}
        </PageSurface>
      </div>

      {activePin && (
        <div className="flex shrink-0 items-start gap-3 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {pinNumbers.get(activePin.id) ?? "•"}
          </div>
          <p className="min-w-0 flex-1 text-sm text-zinc-100">{activePin.text?.trim() || <span className="text-zinc-500">No comment</span>}</p>
          <button type="button" onClick={() => setActivePin(null)} className="text-xs text-zinc-400 hover:text-zinc-100">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
