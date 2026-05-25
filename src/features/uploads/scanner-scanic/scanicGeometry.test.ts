import { describe, expect, it } from "vitest";
import {
  areCornersSimilar,
  createDefaultCorners,
  getContainedFrameRect,
  getCornerCoverageRatio,
  isDetectionUsable,
  getStableDetection,
  outsetCorners,
} from "./scanicGeometry";
import type { ScanicCorners } from "./scanicTypes";

const baseCorners: ScanicCorners = {
  topLeft: { x: 100, y: 100 },
  topRight: { x: 900, y: 100 },
  bottomRight: { x: 900, y: 700 },
  bottomLeft: { x: 100, y: 700 },
};

describe("scanic geometry helpers", () => {
  it("calculates the visible video frame for object-contain previews", () => {
    expect(getContainedFrameRect(
      { width: 390, height: 600 },
      { width: 1920, height: 1080 },
    )).toEqual({
      x: 0,
      y: 190.3125,
      width: 390,
      height: 219.375,
    });
  });

  it("creates safe default manual corners inside the image bounds", () => {
    expect(createDefaultCorners({ width: 1000, height: 800 })).toEqual({
      topLeft: { x: 80, y: 96 },
      topRight: { x: 920, y: 96 },
      bottomRight: { x: 920, y: 704 },
      bottomLeft: { x: 80, y: 704 },
    });
  });

  it("expands detected corners outward without leaving the image", () => {
    expect(outsetCorners(baseCorners, { width: 1000, height: 800 }, 0.04)).toEqual({
      topLeft: { x: 84, y: 88 },
      topRight: { x: 916, y: 88 },
      bottomRight: { x: 916, y: 712 },
      bottomLeft: { x: 84, y: 712 },
    });
  });

  it("computes document coverage from the quadrilateral area", () => {
    expect(getCornerCoverageRatio(baseCorners, { width: 1000, height: 800 })).toBeCloseTo(0.6);
  });

  it("treats nearby detections as similar and random jumps as unstable", () => {
    const smallMovement: ScanicCorners = {
      topLeft: { x: 106, y: 98 },
      topRight: { x: 904, y: 103 },
      bottomRight: { x: 897, y: 705 },
      bottomLeft: { x: 98, y: 696 },
    };
    const randomObject: ScanicCorners = {
      topLeft: { x: 20, y: 20 },
      topRight: { x: 250, y: 30 },
      bottomRight: { x: 260, y: 190 },
      bottomLeft: { x: 18, y: 180 },
    };

    expect(areCornersSimilar(baseCorners, smallMovement, { width: 1000, height: 800 })).toBe(true);
    expect(areCornersSimilar(baseCorners, randomObject, { width: 1000, height: 800 })).toBe(false);
  });

  it("requires repeated similar detections before returning a stable lock", () => {
    const frame = { width: 1000, height: 800 };
    const first = getStableDetection([], baseCorners, frame);
    const second = getStableDetection(first.history, {
      topLeft: { x: 104, y: 102 },
      topRight: { x: 902, y: 100 },
      bottomRight: { x: 898, y: 704 },
      bottomLeft: { x: 102, y: 699 },
    }, frame);
    const third = getStableDetection(second.history, {
      topLeft: { x: 101, y: 99 },
      topRight: { x: 899, y: 102 },
      bottomRight: { x: 901, y: 701 },
      bottomLeft: { x: 99, y: 702 },
    }, frame);

    expect(first.stableCorners).toBeNull();
    expect(second.stableCorners).toBeNull();
    expect(third.stableCorners).not.toBeNull();
  });

  it("rejects tiny or low-confidence detections before stabilization", () => {
    const tinyCorners: ScanicCorners = {
      topLeft: { x: 20, y: 20 },
      topRight: { x: 90, y: 20 },
      bottomRight: { x: 90, y: 70 },
      bottomLeft: { x: 20, y: 70 },
    };

    expect(isDetectionUsable({
      corners: baseCorners,
      dimensions: { width: 1000, height: 800 },
      confidence: 0.7,
    })).toBe(true);
    expect(isDetectionUsable({
      corners: baseCorners,
      dimensions: { width: 1000, height: 800 },
      confidence: 0.2,
    })).toBe(false);
    expect(isDetectionUsable({
      corners: tinyCorners,
      dimensions: { width: 1000, height: 800 },
      confidence: 0.9,
    })).toBe(false);
  });
});
