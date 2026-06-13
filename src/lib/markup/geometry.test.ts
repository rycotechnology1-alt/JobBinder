import { describe, expect, it } from "vitest";
import {
  buildArrowHead,
  buildCloudPath,
  clamp01,
  clientToNormalized,
  normalizedToPdfPoint,
  normalizedToViewport,
} from "./geometry";

describe("clamp01", () => {
  it("clamps into the [0,1] range", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe("clientToNormalized", () => {
  const rect = { left: 100, top: 50, width: 200, height: 400 };

  it("maps a client point to normalized page space", () => {
    expect(clientToNormalized(rect, 200, 250)).toEqual({ x: 0.5, y: 0.5 });
    expect(clientToNormalized(rect, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(clientToNormalized(rect, 300, 450)).toEqual({ x: 1, y: 1 });
  });

  it("clamps points outside the element", () => {
    expect(clientToNormalized(rect, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(clientToNormalized(rect, 9999, 9999)).toEqual({ x: 1, y: 1 });
  });
});

describe("normalizedToViewport", () => {
  it("scales a normalized point up to rendered pixels", () => {
    expect(normalizedToViewport({ x: 0.5, y: 0.25 }, { width: 800, height: 600 })).toEqual({
      x: 400,
      y: 150,
    });
  });
});

describe("normalizedToPdfPoint", () => {
  it("scales to PDF points and flips the Y axis (bottom-left origin)", () => {
    // Top of the page (y=0) maps to the top of the PDF page (y = height).
    expect(normalizedToPdfPoint({ x: 0, y: 0 }, { width: 612, height: 792 })).toEqual({
      x: 0,
      y: 792,
    });
    expect(normalizedToPdfPoint({ x: 1, y: 1 }, { width: 612, height: 792 })).toEqual({
      x: 612,
      y: 0,
    });
    expect(normalizedToPdfPoint({ x: 0.5, y: 0.5 }, { width: 612, height: 792 })).toEqual({
      x: 306,
      y: 396,
    });
  });
});

describe("buildArrowHead", () => {
  it("places both barbs behind the tip, symmetric about the shaft", () => {
    const { left, right } = buildArrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, { size: 10 });
    // Barbs sit behind the tip (smaller x than the tip at x=100).
    expect(left.x).toBeLessThan(100);
    expect(right.x).toBeLessThan(100);
    // Symmetric about the horizontal shaft.
    expect(left.y).toBeCloseTo(-right.y, 5);
    expect(Math.abs(left.y)).toBeGreaterThan(0);
  });

  it("orients the barbs along the shaft direction", () => {
    // Vertical arrow pointing down: barbs should sit above the tip (smaller y).
    const { left, right } = buildArrowHead({ x: 0, y: 0 }, { x: 0, y: 100 }, { size: 10 });
    expect(left.y).toBeLessThan(100);
    expect(right.y).toBeLessThan(100);
  });
});

describe("buildCloudPath", () => {
  it("returns a closed SVG path made of outward arcs", () => {
    const d = buildCloudPath({ x: 10, y: 20, w: 200, h: 100 });
    expect(d.startsWith("M")).toBe(true);
    expect(d.trimEnd().endsWith("Z")).toBe(true);
    // At least one scallop (arc) per side.
    const arcCount = (d.match(/A/g) ?? []).length;
    expect(arcCount).toBeGreaterThanOrEqual(4);
  });

  it("scales the number of scallops with the box size", () => {
    const small = (buildCloudPath({ x: 0, y: 0, w: 40, h: 40 }).match(/A/g) ?? []).length;
    const large = (buildCloudPath({ x: 0, y: 0, w: 400, h: 400 }).match(/A/g) ?? []).length;
    expect(large).toBeGreaterThan(small);
  });
});
