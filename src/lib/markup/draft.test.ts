import { describe, expect, it } from "vitest";
import { geometryFromDrag, isDegenerateDrag, translateGeometry } from "./draft";
import type { ArrowMark, EllipseMark, PenMark, PinMark } from "./types";

describe("geometryFromDrag", () => {
  it("builds a normalized box for ellipse/cloud regardless of drag direction", () => {
    const box = geometryFromDrag("ELLIPSE", { x: 0.6, y: 0.7 }, { x: 0.2, y: 0.3 }) as { x: number; y: number; w: number; h: number };
    const r = (n: number) => Math.round(n * 1e6) / 1e6;
    expect({ x: r(box.x), y: r(box.y), w: r(box.w), h: r(box.h) }).toEqual({ x: 0.2, y: 0.3, w: 0.4, h: 0.4 });
  });

  it("keeps arrow endpoints ordered start→end", () => {
    expect(geometryFromDrag("ARROW", { x: 0.1, y: 0.1 }, { x: 0.8, y: 0.5 })).toEqual({
      x1: 0.1,
      y1: 0.1,
      x2: 0.8,
      y2: 0.5,
    });
  });

  it("places a pin at the drag end", () => {
    expect(geometryFromDrag("PIN", { x: 0, y: 0 }, { x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("translateGeometry", () => {
  const base = { id: "m", fileId: "f", page: 1, sequence: 0, clientUpdatedAt: "", style: { color: "#000", strokeWidth: 0.004, opacity: 1 } };
  const r = (n: number) => Math.round(n * 1e6) / 1e6;

  it("moves a pin and clamps within the page", () => {
    const pin: PinMark = { ...base, kind: "PIN", geometry: { x: 0.5, y: 0.5 } };
    const moved = translateGeometry(pin, 0.2, -0.2) as { x: number; y: number };
    expect(r(moved.x)).toBe(0.7);
    expect(r(moved.y)).toBe(0.3);
    expect(translateGeometry(pin, 1, 1)).toEqual({ x: 1, y: 1 });
  });

  it("moves every point of a pen stroke", () => {
    const pen: PenMark = { ...base, kind: "PEN", geometry: { points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }] } };
    const moved = translateGeometry(pen, 0.1, 0.1) as { points: { x: number; y: number }[] };
    expect(moved.points.map((p) => ({ x: r(p.x), y: r(p.y) }))).toEqual([{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }]);
  });

  it("preserves box size when moving an ellipse", () => {
    const ell: EllipseMark = { ...base, kind: "ELLIPSE", geometry: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 } };
    const moved = translateGeometry(ell, 0.1, 0.1) as { x: number; y: number; w: number; h: number };
    expect({ x: r(moved.x), y: r(moved.y), w: r(moved.w), h: r(moved.h) }).toEqual({ x: 0.2, y: 0.2, w: 0.3, h: 0.2 });
  });

  it("moves both arrow endpoints", () => {
    const arrow: ArrowMark = { ...base, kind: "ARROW", geometry: { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4 } };
    const moved = translateGeometry(arrow, 0.1, 0) as { x1: number; y1: number; x2: number; y2: number };
    expect({ x1: r(moved.x1), y1: r(moved.y1), x2: r(moved.x2), y2: r(moved.y2) }).toEqual({ x1: 0.2, y1: 0.1, x2: 0.5, y2: 0.4 });
  });
});

describe("isDegenerateDrag", () => {
  it("treats a tiny shape drag as degenerate but never a pin", () => {
    expect(isDegenerateDrag("ELLIPSE", { x: 0.5, y: 0.5 }, { x: 0.503, y: 0.502 })).toBe(true);
    expect(isDegenerateDrag("ELLIPSE", { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 })).toBe(false);
    expect(isDegenerateDrag("PIN", { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(false);
  });
});
