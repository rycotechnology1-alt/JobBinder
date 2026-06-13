"use client";

// Touch-first markup toolbar: tool selection, colour, stroke width, undo/redo
// and delete. Buttons are large (>=44px) for finger use and the bar scrolls
// horizontally on narrow screens.

import { ArrowUpRight, Circle, Cloud, MapPin, MousePointer2, Pencil, Redo2, Trash2, Undo2 } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";
import type { MarkupTool } from "@/lib/markup/types";

export const MARKUP_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#111827", "#ffffff"];

export const STROKE_WIDTHS: { label: string; value: number }[] = [
  { label: "S", value: 0.0025 },
  { label: "M", value: 0.005 },
  { label: "L", value: 0.009 },
];

const TOOLS: { tool: MarkupTool; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { tool: "select", label: "Select & move", Icon: MousePointer2 },
  { tool: "pen", label: "Freehand pen", Icon: Pencil },
  { tool: "ellipse", label: "Circle", Icon: Circle },
  { tool: "arrow", label: "Arrow", Icon: ArrowUpRight },
  { tool: "cloud", label: "Revision cloud", Icon: Cloud },
  { tool: "pin", label: "Comment pin", Icon: MapPin },
];

type Props = {
  tool: MarkupTool;
  onToolChange: (tool: MarkupTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
};

export function MarkupToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  strokeWidth,
  onStrokeWidthChange,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  hasSelection,
  onDeleteSelected,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2">
      <div className="flex items-center gap-2 overflow-x-auto">
        {TOOLS.map(({ tool: value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={tool === value}
            title={label}
            onClick={() => onToolChange(value)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
              tool === value ? "bg-brand text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50",
            )}
          >
            <Icon size={20} />
          </button>
        ))}

        <div className="mx-1 h-7 w-px shrink-0 bg-zinc-800" />

        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={!canUndo}
          onClick={onUndo}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-40"
        >
          <Undo2 size={20} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={!canRedo}
          onClick={onRedo}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-50 disabled:opacity-40"
        >
          <Redo2 size={20} />
        </button>
        <button
          type="button"
          aria-label="Delete selected"
          title="Delete selected"
          disabled={!hasSelection}
          onClick={onDeleteSelected}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-40"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {MARKUP_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`Colour ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => onColorChange(swatch)}
              className={cn(
                "h-8 w-8 shrink-0 rounded-full border-2 transition-transform",
                color === swatch ? "scale-110 border-white" : "border-zinc-700",
              )}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>

        <div className="mx-1 h-7 w-px shrink-0 bg-zinc-800" />

        <div className="flex items-center gap-1.5">
          {STROKE_WIDTHS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              aria-label={`Stroke width ${label}`}
              aria-pressed={strokeWidth === value}
              onClick={() => onStrokeWidthChange(value)}
              className={cn(
                "flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                strokeWidth === value ? "bg-brand text-white" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
