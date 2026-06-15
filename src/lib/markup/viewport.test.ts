import { describe, expect, it } from "vitest";
import { clampScale, fitEntireScale, zoomAroundPoint } from "./viewport";

describe("markup viewport helpers", () => {
  it("fits a very large image below the old 50 percent minimum", () => {
    expect(fitEntireScale({ width: 4000, height: 3000 }, { width: 360, height: 640 }, 16)).toBeCloseTo(0.082);
  });

  it("chooses the smaller width or height ratio when fitting", () => {
    expect(fitEntireScale({ width: 1000, height: 2000 }, { width: 900, height: 600 }, 0)).toBeCloseTo(0.3);
  });

  it("does not enlarge small documents above actual size", () => {
    expect(fitEntireScale({ width: 200, height: 100 }, { width: 1200, height: 800 }, 0)).toBe(1);
  });

  it("clamps zoom to the supported markup range", () => {
    expect(clampScale(0.01)).toBe(0.05);
    expect(clampScale(6)).toBe(4);
    expect(clampScale(1.25)).toBe(1.25);
  });

  it("keeps the focal point pinned on screen when zooming the transform", () => {
    // Content point under the focal stays at the same viewport-local pixel after zoom.
    const result = zoomAroundPoint({
      tx: 0,
      ty: 0,
      currentScale: 1,
      nextScale: 2,
      focalX: 100,
      focalY: 50,
    });

    expect(result.tx).toBeCloseTo(-100);
    expect(result.ty).toBeCloseTo(-50);

    const screenAfter = result.tx + ((100 - 0) / 1) * 2;
    expect(screenAfter).toBeCloseTo(100);
  });

  it("is the inverse of itself when zooming back out around the same point", () => {
    const zoomedIn = zoomAroundPoint({ tx: 0, ty: 0, currentScale: 1, nextScale: 2, focalX: 100, focalY: 50 });
    const zoomedOut = zoomAroundPoint({ ...zoomedIn, currentScale: 2, nextScale: 1, focalX: 100, focalY: 50 });

    expect(zoomedOut.tx).toBeCloseTo(0);
    expect(zoomedOut.ty).toBeCloseTo(0);
  });
});
