"use client";

// Full-screen markup editor. Composes the page surface, the interactive SVG
// layer, and the touch-first toolbar, and owns tool/colour/page/zoom state plus
// an undo/redo history. Persistence goes through useMarkupStore (optimistic +
// debounced save).

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMarkupStore, type SaveMutations } from "@/lib/markup/useMarkupStore";
import type { Mark, MarkupTool } from "@/lib/markup/types";
import { MarkupCanvasLayer } from "./MarkupCanvasLayer";
import { MarkupToolbar, MARKUP_COLORS, STROKE_WIDTHS } from "./MarkupToolbar";
import { PageSurface } from "./PageSurface";

type Props = {
  fileId: string;
  src: string;
  mode: "pdf" | "image";
  filename: string;
  onClose: () => void;
  /** Injectable save (offline-aware variant supplied later). */
  save?: SaveMutations;
};

type HistoryEntry = { undo: () => void; redo: () => void };

export function MarkupEditor({ fileId, src, mode, filename, onClose, save }: Props) {
  const store = useMarkupStore(fileId, save);
  const [tool, setTool] = useState<MarkupTool>("pen");
  const [color, setColor] = useState(MARKUP_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(mode === "pdf" ? 1.1 : 1);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);

  const selected = store.marks.find((m) => m.id === selectedId) ?? null;

  const pushUndo = useCallback((entry: HistoryEntry) => {
    setUndoStack((stack) => [...stack, entry]);
    setRedoStack([]);
  }, []);

  const applyCreate = useCallback(
    (mark: Mark) => {
      store.upsertMark(mark);
      pushUndo({ undo: () => store.deleteMark(mark.id), redo: () => store.upsertMark(mark) });
    },
    [store, pushUndo],
  );

  const applyMove = useCallback(
    (before: Mark, after: Mark) => {
      store.upsertMark(after);
      pushUndo({ undo: () => store.upsertMark(before), redo: () => store.upsertMark(after) });
    },
    [store, pushUndo],
  );

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    const before = selected;
    store.deleteMark(before.id);
    setSelectedId(null);
    pushUndo({ undo: () => store.upsertMark(before), redo: () => store.deleteMark(before.id) });
  }, [selected, store, pushUndo]);

  const commitComment = useCallback(
    (mark: Mark, text: string) => {
      const trimmed = text.trim();
      if ((mark.text ?? "") === trimmed) return;
      const after = { ...mark, text: trimmed } as Mark;
      store.upsertMark(after);
      pushUndo({ undo: () => store.upsertMark(mark), redo: () => store.upsertMark(after) });
    },
    [store, pushUndo],
  );

  const undo = () => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    entry.undo();
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, entry]);
    setSelectedId(null);
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    entry.redo();
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, entry]);
    setSelectedId(null);
  };

  async function handleDone() {
    await store.flushNow();
    onClose();
  }

  if (typeof document === "undefined") return null;

  const saving = store.pendingCount > 0;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex flex-col bg-zinc-950 text-zinc-50">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base">Marking up · {filename}</h2>
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} className="text-emerald-400" />}
            {saving ? "Saving…" : "Saved"}
          </p>
        </div>
        <Button type="button" onClick={handleDone} className="gap-2">
          <Check size={16} />
          Done
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-auto bg-zinc-900 p-4">
        {status && <p className="mb-3 text-center text-sm text-zinc-400">{status}</p>}
        <PageSurface mode={mode} src={src} pageNumber={pageNumber} scale={scale} onNumPages={setNumPages} onStatus={setStatus}>
          {(size) => (
            <MarkupCanvasLayer
              marks={store.marks}
              size={size}
              page={pageNumber}
              tool={tool}
              style={{ color, strokeWidth, opacity: 1 }}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreate={applyCreate}
              onMove={applyMove}
            />
          )}
        </PageSurface>
      </main>

      {selected?.kind === "PIN" && (
        <PinCommentPanel
          key={selected.id}
          initialText={selected.text ?? ""}
          onCommit={(text) => commitComment(selected, text)}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5">
        {mode === "pdf" && (
          <>
            <button type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => { setSelectedId(null); setPageNumber((p) => p - 1); }} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-zinc-400">Page {pageNumber} / {numPages || "…"}</span>
            <button type="button" aria-label="Next page" disabled={pageNumber >= numPages} onClick={() => { setSelectedId(null); setPageNumber((p) => p + 1); }} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
              <ChevronRight size={18} />
            </button>
            <div className="mx-1 h-5 w-px bg-zinc-800" />
          </>
        )}
        <button type="button" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <ZoomOut size={18} />
        </button>
        <span className="min-w-12 text-center text-xs text-zinc-400">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(3, s + 0.2))} className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800">
          <ZoomIn size={18} />
        </button>
      </div>

      <MarkupToolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        canUndo={undoStack.length > 0}
        onUndo={undo}
        canRedo={redoStack.length > 0}
        onRedo={redo}
        hasSelection={Boolean(selected)}
        onDeleteSelected={deleteSelected}
      />
    </div>,
    document.body,
  );
}

// Keyed by pin id so it re-initializes per pin without a syncing effect.
function PinCommentPanel({ initialText, onCommit, onClose }: { initialText: string; onCommit: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initialText);
  return (
    <div className="flex shrink-0 items-end gap-2 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2">
      <label className="flex-1">
        <span className="mb-1 block text-xs text-zinc-400">Pin comment</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => onCommit(text)}
          rows={2}
          placeholder="Add a note for this pin…"
          className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand"
        />
      </label>
      <Button type="button" variant="secondary" onClick={() => { onCommit(text); onClose(); }}>
        Done
      </Button>
    </div>
  );
}
