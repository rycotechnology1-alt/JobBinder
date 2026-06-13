// Pure geometry helpers for markup. No DOM access here so these stay
// unit-testable in the node test environment; the editor passes in plain
// rect/size values it reads from the DOM.

import type { NormalizedBox, NormalizedPoint } from "./types";

export type Size = { width: number; height: number };
type RectLike = { left: number; top: number; width: number; height: number };
type Point = { x: number; y: number };

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Convert a client (pointer) coordinate to normalized page space using the
 * overlay element's current bounding rect. Normalizing against the rendered
 * size means the result is independent of the current zoom level.
 */
export function clientToNormalized(rect: RectLike, clientX: number, clientY: number): NormalizedPoint {
  return {
    x: clamp01(rect.width === 0 ? 0 : (clientX - rect.left) / rect.width),
    y: clamp01(rect.height === 0 ? 0 : (clientY - rect.top) / rect.height),
  };
}

/** Scale a normalized point up to rendered pixels for the SVG overlay. */
export function normalizedToViewport(point: NormalizedPoint, size: Size): Point {
  return { x: point.x * size.width, y: point.y * size.height };
}

/**
 * Scale a normalized point to PDF user-space points, flipping the Y axis
 * because PDF's origin is bottom-left while ours is top-left.
 */
export function normalizedToPdfPoint(point: NormalizedPoint, page: Size): Point {
  return { x: point.x * page.width, y: (1 - point.y) * page.height };
}

export type ArrowHeadOptions = {
  /** Barb length in the target coordinate units. */
  size?: number;
  /** Half-angle of the arrowhead opening, in degrees. */
  spreadDeg?: number;
};

/**
 * Compute the tip and two barb points of an arrowhead at `to`, pointing along
 * the `from`→`to` direction. Coordinates are in whatever space the caller uses
 * (rendered pixels in the overlay, PDF points when flattening).
 */
export function buildArrowHead(from: Point, to: Point, options: ArrowHeadOptions = {}) {
  const size = options.size ?? 12;
  const spread = ((options.spreadDeg ?? 28) * Math.PI) / 180;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const leftAngle = angle + Math.PI - spread;
  const rightAngle = angle + Math.PI + spread;
  return {
    tip: { x: to.x, y: to.y },
    left: { x: to.x + size * Math.cos(leftAngle), y: to.y + size * Math.sin(leftAngle) },
    right: { x: to.x + size * Math.cos(rightAngle), y: to.y + size * Math.sin(rightAngle) },
  };
}

export type CloudPathOptions = {
  /** Target scallop radius in the target coordinate units. */
  scallop?: number;
};

/**
 * Build a "revision cloud" SVG path string around the given box: a closed loop
 * of outward-bulging arcs along each side. Used both by the SVG overlay and by
 * pdf-lib's drawSvgPath when flattening. The box is in the target coordinate
 * space (already converted out of normalized units by the caller).
 */
export function buildCloudPath(box: { x: number; y: number; w: number; h: number }, options: CloudPathOptions = {}): string {
  const { x, y, w, h } = box;
  const baseRadius = options.scallop ?? Math.max(6, Math.min(Math.abs(w), Math.abs(h)) / 8);
  const corners: Point[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];

  let d = `M ${round(x)} ${round(y)}`;
  for (let i = 0; i < corners.length; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % corners.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const count = Math.max(1, Math.round(length / (baseRadius * 2)));
    const stepX = (end.x - start.x) / count;
    const stepY = (end.y - start.y) / count;
    const arcRadius = Math.hypot(stepX, stepY) / 2;
    for (let j = 0; j < count; j++) {
      const nx = start.x + stepX * (j + 1);
      const ny = start.y + stepY * (j + 1);
      // sweep-flag 1 + clockwise corner order ⇒ arcs bulge outward.
      d += ` A ${round(arcRadius)} ${round(arcRadius)} 0 0 1 ${round(nx)} ${round(ny)}`;
    }
  }
  return `${d} Z`;
}

/** Normalize a drag (two corners) into a positive-extent normalized box. */
export function boxFromPoints(a: NormalizedPoint, b: NormalizedPoint): NormalizedBox {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
