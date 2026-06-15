"use client";

// Full-screen markup editor. Composes the page surface, the interactive SVG
// layer, and the touch-first toolbar, and owns tool/color/page/zoom state plus
// an undo/redo history. Persistence goes through useMarkupStore (optimistic +
// debounced save).

import { useCallback, useState, type CSSProperties, type ChangeEvent, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, ImagePlus, ListTodo, Loader2, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMarkupStore, type SaveMutations } from "@/lib/markup/useMarkupStore";
import type { Mark, MarkupTool } from "@/lib/markup/types";
import type { Size } from "@/lib/markup/viewport";
import { isOffline, prepareClientUploadFile, uploadFileRecord } from "@/lib/uploads/client-upload";
import { MarkupCanvasLayer } from "./MarkupCanvasLayer";
import { MarkupToolbar, MARKUP_COLORS, STROKE_WIDTHS } from "./MarkupToolbar";
import { PageSurface } from "./PageSurface";
import { useMarkupViewport } from "./useMarkupViewport";

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
const EMPTY_SIZE: Size = { width: 0, height: 0 };
const NO_SELECT_STYLE: CSSProperties & { WebkitTouchCallout?: string } = {
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  userSelect: "none",
};

export function MarkupEditor({ fileId, src, mode, filename, onClose, save }: Props) {
  const store = useMarkupStore(fileId, save);
  const [tool, setTool] = useState<MarkupTool>("pen");
  const [color, setColor] = useState(MARKUP_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [baseSize, setBaseSize] = useState<Size>(EMPTY_SIZE);
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([]);
  const navigationEnabled = tool === "select";
  const { viewportRef, contentRef, contentStyle, viewScale, rasterScale, zoomIn, zoomOut, fitToScreen, pointerHandlers } =
    useMarkupViewport({
      baseSize,
      pageKey: mode === "pdf" ? pageNumber : src,
      navigationEnabled,
      padding: 32,
    });

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
    <div className="fixed inset-0 z-[140] flex select-none flex-col bg-zinc-950 text-zinc-50" style={NO_SELECT_STYLE}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-3 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold sm:text-base">Marking up - {filename}</h2>
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            {saving ? <Loader2 className="animate-spin" size={12} /> : <Check size={12} className="text-emerald-400" />}
            {saving ? "Saving..." : "Saved"}
          </p>
        </div>
        <Button type="button" onClick={handleDone} className="gap-2">
          <Check size={16} />
          Done
        </Button>
      </header>

      <main
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-hidden bg-zinc-900"
        style={{ ...NO_SELECT_STYLE, touchAction: "none" }}
        {...pointerHandlers}
      >
        {status && <p className="absolute inset-x-0 top-3 z-10 text-center text-sm text-zinc-400">{status}</p>}
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
                tool={tool}
                style={{ color, strokeWidth, opacity: 1 }}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreate={applyCreate}
                onMove={applyMove}
              />
            )}
          </PageSurface>
        </div>
      </main>

      {selected?.kind === "PIN" && (
        <PinCommentPanel
          key={selected.id}
          mark={selected}
          onCommit={(text) => commitComment(selected, text)}
          onFlush={store.flushNow}
          onReload={store.reload}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-950/80 px-3 py-1.5">
        {mode === "pdf" && (
          <>
            <button
              type="button"
              aria-label="Previous page"
              disabled={pageNumber <= 1}
              onClick={() => {
                setSelectedId(null);
                setPageNumber((p) => p - 1);
              }}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs text-zinc-400">Page {pageNumber} / {numPages || "..."}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={pageNumber >= numPages}
              onClick={() => {
                setSelectedId(null);
                setPageNumber((p) => p + 1);
              }}
              className="rounded-lg p-1.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
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

type PinCommentPanelProps = {
  mark: Mark;
  onCommit: (text: string) => void;
  onFlush: () => Promise<void>;
  onReload: () => Promise<void>;
  onClose: () => void;
};

// Keyed by pin id so it re-initializes per pin without a syncing effect.
function PinCommentPanel({ mark, onCommit, onFlush, onReload, onClose }: PinCommentPanelProps) {
  const [text, setText] = useState(mark.text ?? "");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [taskTitle, setTaskTitle] = useState((mark.text ?? "").trim() || "Pinned comment follow-up");
  const [taskType, setTaskType] = useState<"TASK" | "PUNCH_LIST">("TASK");
  const [dueDate, setDueDate] = useState("");
  const attachments = mark.attachments ?? [];
  const hasTask = Boolean(mark.task);

  async function attachImages(files: FileList | File[]) {
    const selectedFiles = Array.from(files).filter(Boolean);
    if (selectedFiles.length === 0) return;
    setError("");
    setStatus("");

    if (isOffline()) {
      setError("Connect to upload pin images.");
      return;
    }

    const invalid = selectedFiles.find((file) => !file.type.startsWith("image/"));
    if (invalid) {
      setError("Pin attachments must be images.");
      return;
    }

    setIsBusy(true);
    try {
      onCommit(text);
      await onFlush();
      for (const file of selectedFiles) {
        const prepared = await prepareClientUploadFile(file, setStatus);
        await uploadFileRecord({
          markupMarkId: mark.id,
          originalName: prepared.sourceFile.name,
          name: "",
          category: "Issue",
          prepared,
          onStatus: setStatus,
        });
      }
      setStatus("");
      await onReload();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload pin image.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleAttachChange(event: ChangeEvent<HTMLInputElement>) {
    void attachImages(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
  }

  async function createLinkedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (isOffline()) {
      setError("Connect to create a task from this pin.");
      return;
    }

    const trimmedText = text.trim();
    const trimmedTitle = taskTitle.trim() || trimmedText || "Pinned comment follow-up";
    setIsBusy(true);
    try {
      onCommit(text);
      await onFlush();
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMarkupMarkId: mark.id,
          title: trimmedTitle,
          description: trimmedText,
          type: taskType,
          dueDate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Could not create linked task.");
      }
      setTaskFormOpen(false);
      await onReload();
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Could not create linked task.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-zinc-400">Pin comment</span>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (!taskFormOpen) setTaskTitle(event.target.value.trim() || "Pinned comment follow-up");
            }}
            onBlur={() => onCommit(text)}
            rows={2}
            placeholder="Add a note for this pin..."
            className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800">
            <ImagePlus size={16} />
            Attach image
            <input
              aria-label="Attach image"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={isBusy}
              onChange={handleAttachChange}
            />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-800 sm:hidden">
            <ImagePlus size={16} />
            Take photo
            <input
              aria-label="Take photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={isBusy}
              onChange={handleAttachChange}
            />
          </label>
          {hasTask ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/40 px-3 text-sm text-emerald-200">
              <ListTodo size={16} />
              {mark.task?.status.replace("_", " ")}
            </span>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setTaskFormOpen((open) => !open)}>
              <ListTodo size={16} />
              Create task
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => {
              onCommit(text);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      </div>

      {(attachments.length > 0 || status || error) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {attachments.map((attachment) => (
            <span key={attachment.id} className="inline-flex max-w-56 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300">
              <ImagePlus size={14} className="shrink-0 text-zinc-500" />
              <span className="truncate">{attachment.name || attachment.originalName}</span>
            </span>
          ))}
          {status && <span className="text-zinc-400">{status}</span>}
          {error && <span className="text-red-300">{error}</span>}
        </div>
      )}

      {taskFormOpen && !hasTask && (
        <form onSubmit={createLinkedTask} className="mt-3 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 sm:grid-cols-[minmax(0,1fr)_160px_150px_auto] sm:items-end">
          <label className="min-w-0">
            <span className="mb-1 block text-xs text-zinc-400">Task title</span>
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-brand"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs text-zinc-400">Type</span>
            <select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value as "TASK" | "PUNCH_LIST")}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-brand"
            >
              <option value="TASK">Task</option>
              <option value="PUNCH_LIST">Punch list</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs text-zinc-400">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-brand"
            />
          </label>
          <Button type="submit" size="sm" disabled={isBusy}>
            Create linked task
          </Button>
        </form>
      )}
    </div>
  );
}
