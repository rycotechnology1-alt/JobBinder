"use client";

// The interactive SVG overlay that sits exactly over a rendered page/image.
// Handles drawing new marks, selecting, and moving existing ones via pointer
// events (touch, pen, and mouse). In read-only mode it only renders marks and
// reports pin taps so the viewer can show comments.

import { useMemo, useRef, useState } from "react";
import type React from "react";
import { v4 as uuid } from "uuid";
import { clientToNormalized } from "@/lib/markup/geometry";
import { geometryFromDrag, isDegenerateDrag, translateGeometry } from "@/lib/markup/draft";
import type { Mark, MarkStyle, MarkupTool, NormalizedPoint } from "@/lib/markup/types";
import { toolToKind } from "@/lib/markup/types";
import { MarkShape, markBoundsPx, type Size } from "./MarkShape";

type Props = {
  marks: Mark[];
  size: Size;
  page: number;
  tool: MarkupTool;
  style: MarkStyle;
  selectedId: string | null;
  readOnly?: boolean;
  onSelect: (id: string | null) => void;
  onCreate: (mark: Mark) => void;
  onMove: (before: Mark, after: Mark) => void;
  onPinTap?: (mark: Mark) => void;
};

const HIT_TOLERANCE_PX = 12;
const PEN_MIN_STEP = 0.003;

type Drag =
  | { mode: "draw"; start: NormalizedPoint; points: NormalizedPoint[] }
  | { mode: "move"; start: NormalizedPoint; original: Mark };

export function MarkupCanvasLayer({
  marks,
  size,
  page,
  tool,
  style,
  selectedId,
  readOnly = false,
  onSelect,
  onCreate,
  onMove,
  onPinTap,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [preview, setPreview] = useState<Mark | null>(null);

  const pageMarks = useMemo(() => marks.filter((m) => m.page === page), [marks, page]);
  const pinNumbers = useMemo(() => {
    const map = new Map<string, number>();
    marks
      .filter((m) => m.kind === "PIN")
      .sort((a, b) => a.sequence - b.sequence)
      .forEach((m, i) => map.set(m.id, i + 1));
    return map;
  }, [marks]);

  function toNormalized(clientX: number, clientY: number): NormalizedPoint {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return clientToNormalized(rect, clientX, clientY);
  }

  function hitTest(point: NormalizedPoint): Mark | null {
    const px = point.x * size.width;
    const py = point.y * size.height;
    for (let i = pageMarks.length - 1; i >= 0; i--) {
      const b = markBoundsPx(pageMarks[i], size);
      if (px >= b.x - HIT_TOLERANCE_PX && px <= b.x + b.w + HIT_TOLERANCE_PX && py >= b.y - HIT_TOLERANCE_PX && py <= b.y + b.h + HIT_TOLERANCE_PX) {
        return pageMarks[i];
      }
    }
    return null;
  }

  function buildMark(kind: NonNullable<ReturnType<typeof toolToKind>>, geometry: Mark["geometry"]): Mark {
    return {
      id: uuid(),
      fileId: "",
      page,
      kind,
      geometry,
      style: { ...style },
      sequence: 0,
      clientUpdatedAt: new Date().toISOString(),
    } as Mark;
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    // Reject only explicitly-secondary pointers (palm/extra touches) and
    // non-primary mouse buttons; allow primary touch/pen/mouse.
    if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;
    const point = toNormalized(event.clientX, event.clientY);

    if (readOnly) {
      const hit = hitTest(point);
      if (hit?.kind === "PIN") onPinTap?.(hit);
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);

    if (tool === "select") {
      const hit = hitTest(point);
      onSelect(hit?.id ?? null);
      if (hit) dragRef.current = { mode: "move", start: point, original: hit };
      return;
    }

    if (tool === "pin") {
      const mark = buildMark("PIN", { x: point.x, y: point.y });
      onCreate(mark);
      onSelect(mark.id);
      return;
    }

    if (tool === "pen") {
      dragRef.current = { mode: "draw", start: point, points: [point] };
      setPreview(buildMark("PEN", { points: [point, point] }));
      return;
    }

    // ellipse / cloud / arrow
    dragRef.current = { mode: "draw", start: point, points: [point] };
    const kind = toolToKind(tool)!;
    setPreview(buildMark(kind, geometryFromDrag(kind, point, point)));
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toNormalized(event.clientX, event.clientY);

    if (drag.mode === "move") {
      const after = { ...drag.original, geometry: translateGeometry(drag.original, point.x - drag.start.x, point.y - drag.start.y) } as Mark;
      setPreview(after);
      return;
    }

    if (tool === "pen") {
      const last = drag.points[drag.points.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) >= PEN_MIN_STEP) drag.points.push(point);
      setPreview(buildMark("PEN", { points: [...drag.points, point] }));
      return;
    }

    const kind = toolToKind(tool)!;
    setPreview(buildMark(kind, geometryFromDrag(kind, drag.start, point)));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drag) return;
    const point = toNormalized(event.clientX, event.clientY);

    if (drag.mode === "move") {
      setPreview(null);
      const moved = point.x !== drag.start.x || point.y !== drag.start.y;
      if (moved) {
        const after = { ...drag.original, geometry: translateGeometry(drag.original, point.x - drag.start.x, point.y - drag.start.y) } as Mark;
        onMove(drag.original, after);
      }
      return;
    }

    setPreview(null);
    if (tool === "pen") {
      if (drag.points.length >= 2) onCreate(buildMark("PEN", { points: drag.points }));
      return;
    }
    const kind = toolToKind(tool)!;
    if (!isDegenerateDrag(kind, drag.start, point)) {
      const mark = buildMark(kind, geometryFromDrag(kind, drag.start, point));
      onCreate(mark);
      onSelect(mark.id);
    }
  }

  const cursor = readOnly ? "default" : tool === "select" ? "move" : "crosshair";

  return (
    <svg
      ref={svgRef}
      width={size.width}
      height={size.height}
      className="absolute inset-0"
      style={{ touchAction: readOnly ? "auto" : "none", cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid="markup-canvas-layer"
    >
      {pageMarks.map((mark) => (
        <MarkShape
          key={mark.id}
          mark={mark}
          size={size}
          selected={mark.id === selectedId && !preview}
          pinNumber={pinNumbers.get(mark.id)}
        />
      ))}
      {preview && <MarkShape mark={preview} size={size} pinNumber={pinNumbers.get(preview.id)} />}
    </svg>
  );
}
