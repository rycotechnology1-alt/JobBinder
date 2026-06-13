// Pure helpers for turning pointer drags into mark geometry and for moving
// existing marks. No DOM access, so these are unit-tested directly.

import { boxFromPoints, clamp01 } from "./geometry";
import type { Mark, MarkKind, NormalizedPoint } from "./types";

type Geometry = Mark["geometry"];

/** Build geometry for a shape from its drag start/end (normalized) points. */
export function geometryFromDrag(kind: MarkKind, start: NormalizedPoint, end: NormalizedPoint): Geometry {
  switch (kind) {
    case "ELLIPSE":
    case "CLOUD":
      return boxFromPoints(start, end);
    case "ARROW":
      return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    case "PIN":
      return { x: end.x, y: end.y };
    case "PEN":
      return { points: [start, end] };
  }
}

/** Translate a mark's geometry by a normalized delta, clamping into the page. */
export function translateGeometry(mark: Mark, dx: number, dy: number): Geometry {
  switch (mark.kind) {
    case "PEN":
      return { points: mark.geometry.points.map((p) => ({ x: clamp01(p.x + dx), y: clamp01(p.y + dy) })) };
    case "ELLIPSE":
    case "CLOUD":
      return { x: clamp01(mark.geometry.x + dx), y: clamp01(mark.geometry.y + dy), w: mark.geometry.w, h: mark.geometry.h };
    case "ARROW":
      return {
        x1: clamp01(mark.geometry.x1 + dx),
        y1: clamp01(mark.geometry.y1 + dy),
        x2: clamp01(mark.geometry.x2 + dx),
        y2: clamp01(mark.geometry.y2 + dy),
      };
    case "PIN":
      return { x: clamp01(mark.geometry.x + dx), y: clamp01(mark.geometry.y + dy) };
  }
}

/** True if a shape drag is too small to be a real mark (a stray tap). */
export function isDegenerateDrag(kind: MarkKind, start: NormalizedPoint, end: NormalizedPoint): boolean {
  if (kind === "PIN") return false;
  const dx = Math.abs(start.x - end.x);
  const dy = Math.abs(start.y - end.y);
  return Math.hypot(dx, dy) < 0.01;
}
