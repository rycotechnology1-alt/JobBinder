"use client";

// Read-only "Marked-up" view shown inside the file viewer: the original page
// with the saved marks composited on top. Tapping a pin reveals its comment.
// "Edit markup" hands off to the full editor.

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, Maximize2, Pencil, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileViewerOverlay } from "@/components/FileViewerOverlay";
import { getOriginalContentUrl } from "@/lib/file-preview";
import { useMarkupStore } from "@/lib/markup/useMarkupStore";
import type { Mark, MarkAttachment } from "@/lib/markup/types";
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

function formatTaskStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function attachmentDisplayName(attachment: MarkAttachment) {
  return attachment.name?.trim() || attachment.originalName;
}

function isImageAttachment(attachment: MarkAttachment) {
  return attachment.type === "PHOTO" || attachment.contentType?.toLowerCase().startsWith("image/");
}

export function MarkedUpView({ fileId, src, mode, onEdit }: Props) {
  const store = useMarkupStore(fileId);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [baseSize, setBaseSize] = useState<Size>(EMPTY_SIZE);
  const [status, setStatus] = useState("");
  const [activePin, setActivePin] = useState<Mark | null>(null);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const { viewportRef, contentRef, contentStyle, viewScale, rasterScale, zoomIn, zoomOut, fitToScreen, pointerHandlers } =
    useMarkupViewport({
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

  const activeAttachment = activePin?.attachments?.find((attachment) => attachment.id === activeAttachmentId) ?? null;

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
        <button type="button" aria-label="Zoom out" onClick={zoomOut} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <ZoomOut size={18} />
        </button>
        <span className="min-w-12 text-center text-xs text-zinc-400">{Math.round(viewScale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={zoomIn} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <ZoomIn size={18} />
        </button>
        <button type="button" aria-label="Fit to screen" onClick={fitToScreen} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <Maximize2 size={18} />
        </button>
        <div className="mx-1 h-5 w-px bg-zinc-800" />
        <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={onEdit}>
          <Pencil size={14} />
          Edit markup
        </Button>
      </div>

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ ...NO_SELECT_STYLE, touchAction: "none" }}
        {...pointerHandlers}
      >
        {status && <p className="absolute inset-x-0 top-3 z-10 text-center text-sm text-zinc-500">{status}</p>}
        <div ref={contentRef} style={contentStyle}>
          <PageSurface
            mode={mode}
            src={src}
            pageNumber={pageNumber}
            rasterScale={rasterScale}
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
                onPinTap={(mark) => {
                  setActivePin(mark);
                  setActiveAttachmentId(null);
                }}
              />
            )}
          </PageSurface>
        </div>
      </div>

      {activePin && (
        <div className="flex shrink-0 items-start gap-3 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
            {pinNumbers.get(activePin.id) ?? "•"}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm text-zinc-100">{activePin.text?.trim() || <span className="text-zinc-500">No comment</span>}</p>
            {activePin.task && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-zinc-300">{activePin.task.title}</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-zinc-300">{formatTaskStatus(activePin.task.status)}</span>
              </div>
            )}
            {activePin.attachments && activePin.attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {activePin.attachments.map((attachment) => (
                  <PinAttachmentPreview
                    key={attachment.id}
                    attachment={attachment}
                    onOpen={() => setActiveAttachmentId(attachment.id)}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveAttachmentId(null);
              setActivePin(null);
            }}
            className="text-xs text-zinc-400 hover:text-zinc-100"
          >
            Close
          </button>
        </div>
      )}

      <FileViewerOverlay
        fileId={activeAttachment?.id ?? null}
        isOpen={Boolean(activeAttachment)}
        initialFilename={activeAttachment ? attachmentDisplayName(activeAttachment) : undefined}
        onClose={() => setActiveAttachmentId(null)}
      />
    </div>
  );
}

function PinAttachmentPreview({ attachment, onOpen }: { attachment: MarkAttachment; onOpen: () => void }) {
  const filename = attachmentDisplayName(attachment);
  const isImage = isImageAttachment(attachment);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${filename}`}
      title={`View ${filename}`}
      className="group w-28 shrink-0 text-left"
    >
      <span className="relative block aspect-[4/3] overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
        <ImageIcon size={20} className="absolute left-1/2 top-1/2 text-zinc-600 -translate-x-1/2 -translate-y-1/2" />
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getOriginalContentUrl(attachment.id)}
            alt={filename}
            className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
      </span>
      <span className="mt-1 block truncate text-xs text-zinc-300 group-hover:text-zinc-100">{filename}</span>
    </button>
  );
}
