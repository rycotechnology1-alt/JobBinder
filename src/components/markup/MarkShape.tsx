"use client";

// Renders a single mark as SVG elements inside the overlay's <svg>. Geometry is
// stored normalized (0..1); everything is converted to rendered pixels here so
// marks look identical at any zoom. Stroke width is a fraction of the page's
// smaller dimension, so it scales with the document too.

import type React from "react";
import { buildArrowHead, buildCloudPath, normalizedToViewport } from "@/lib/markup/geometry";
import type { Mark, NormalizedBox } from "@/lib/markup/types";

export type Size = { width: number; height: number };

export function strokeWidthPx(mark: Mark, size: Size): number {
  return Math.max(1, mark.style.strokeWidth * Math.min(size.width, size.height));
}

/** Pixel bounding box of a mark, used for hit-testing and selection handles. */
export function markBoundsPx(mark: Mark, size: Size): { x: number; y: number; w: number; h: number } {
  switch (mark.kind) {
    case "PEN": {
      const xs = mark.geometry.points.map((p) => p.x * size.width);
      const ys = mark.geometry.points.map((p) => p.y * size.height);
      const minX = Math.min(...xs, Infinity);
      const minY = Math.min(...ys, Infinity);
      return { x: minX, y: minY, w: Math.max(...xs, -Infinity) - minX, h: Math.max(...ys, -Infinity) - minY };
    }
    case "ELLIPSE":
    case "CLOUD":
      return boxToPx(mark.geometry, size);
    case "ARROW": {
      const x = Math.min(mark.geometry.x1, mark.geometry.x2) * size.width;
      const y = Math.min(mark.geometry.y1, mark.geometry.y2) * size.height;
      const w = Math.abs(mark.geometry.x1 - mark.geometry.x2) * size.width;
      const h = Math.abs(mark.geometry.y1 - mark.geometry.y2) * size.height;
      return { x, y, w, h };
    }
    case "PIN": {
      const c = normalizedToViewport(mark.geometry, size);
      return { x: c.x - PIN_RADIUS, y: c.y - PIN_RADIUS * 2, w: PIN_RADIUS * 2, h: PIN_RADIUS * 2 };
    }
  }
}

function boxToPx(box: NormalizedBox, size: Size) {
  return { x: box.x * size.width, y: box.y * size.height, w: box.w * size.width, h: box.h * size.height };
}

export const PIN_RADIUS = 13;

type Props = {
  mark: Mark;
  size: Size;
  selected?: boolean;
  /** Pin label (1-based number) shown inside the marker. */
  pinNumber?: number;
};

export function MarkShape({ mark, size, selected, pinNumber }: Props) {
  const stroke = mark.style.color;
  const width = strokeWidthPx(mark, size);
  const common = {
    stroke,
    strokeWidth: width,
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: mark.style.opacity,
  };
  const selectionStroke = selected ? <SelectionHalo mark={mark} size={size} /> : null;

  switch (mark.kind) {
    case "PEN": {
      const d = penPath(mark.geometry.points, size);
      return (
        <g>
          {selectionStroke}
          <path d={d} {...common} />
        </g>
      );
    }
    case "ELLIPSE": {
      const b = boxToPx(mark.geometry, size);
      return (
        <g>
          {selectionStroke}
          <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} {...common} />
        </g>
      );
    }
    case "CLOUD": {
      const b = boxToPx(mark.geometry, size);
      return (
        <g>
          {selectionStroke}
          <path d={buildCloudPath(b)} {...common} />
        </g>
      );
    }
    case "ARROW": {
      const from = { x: mark.geometry.x1 * size.width, y: mark.geometry.y1 * size.height };
      const to = { x: mark.geometry.x2 * size.width, y: mark.geometry.y2 * size.height };
      const head = buildArrowHead(from, to, { size: Math.max(10, width * 3) });
      return (
        <g>
          {selectionStroke}
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} {...common} />
          <polyline points={`${head.left.x},${head.left.y} ${to.x},${to.y} ${head.right.x},${head.right.y}`} {...common} />
        </g>
      );
    }
    case "PIN": {
      const c = normalizedToViewport(mark.geometry, size);
      return (
        <g>
          {selected && <circle cx={c.x} cy={c.y - PIN_RADIUS} r={PIN_RADIUS + 4} fill="none" stroke={stroke} strokeWidth={2} strokeDasharray="4 3" opacity={0.7} />}
          {/* teardrop tail */}
          <path d={`M ${c.x} ${c.y} L ${c.x - PIN_RADIUS * 0.7} ${c.y - PIN_RADIUS} L ${c.x + PIN_RADIUS * 0.7} ${c.y - PIN_RADIUS} Z`} fill={stroke} opacity={mark.style.opacity} />
          <circle cx={c.x} cy={c.y - PIN_RADIUS} r={PIN_RADIUS} fill={stroke} opacity={mark.style.opacity} />
          <text x={c.x} y={c.y - PIN_RADIUS} textAnchor="middle" dominantBaseline="central" fontSize={PIN_RADIUS} fontWeight={700} fill="#ffffff">
            {pinNumber ?? "•"}
          </text>
        </g>
      );
    }
  }
}

function SelectionHalo({ mark, size }: { mark: Mark; size: Size }) {
  const b = markBoundsPx(mark, size);
  const pad = 6;
  return (
    <rect
      x={b.x - pad}
      y={b.y - pad}
      width={b.w + pad * 2}
      height={b.h + pad * 2}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={1.5}
      strokeDasharray="5 4"
      opacity={0.9}
    />
  );
}

function penPath(points: { x: number; y: number }[], size: Size): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * size.width).toFixed(2)} ${(p.y * size.height).toFixed(2)}`)
    .join(" ");
}
