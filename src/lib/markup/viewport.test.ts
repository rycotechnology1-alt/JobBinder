import { describe, expect, it } from "vitest";
import { clampScale, fitEntireScale, zoomAroundViewportPoint } from "./viewport";

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

  it("preserves the viewport focal point when zooming around a point", () => {
    const result = zoomAroundViewportPoint({
      currentScale: 1,
      nextScale: 2,
      scrollLeft: 100,
      scrollTop: 50,
      viewportLeft: 10,
      viewportTop: 20,
      focalClientX: 210,
      focalClientY: 220,
    });

    expect(result.scrollLeft).toBeCloseTo(400);
    expect(result.scrollTop).toBeCloseTo(300);
  });
});
