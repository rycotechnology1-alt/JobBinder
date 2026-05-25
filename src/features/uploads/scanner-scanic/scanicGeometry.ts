import type { ScanicCorners } from "./scanicTypes";

export type Dimensions = {
  width: number;
  height: number;
};

export type Rect = Dimensions & {
  x: number;
  y: number;
};

export type StableDetectionEntry = {
  corners: ScanicCorners;
};

const CORNER_ORDER = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCenter(corners: ScanicCorners) {
  const points = CORNER_ORDER.map((corner) => corners[corner]);
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function getPolygonArea(corners: ScanicCorners) {
  const points = CORNER_ORDER.map((corner) => corners[corner]);
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

export function getContainedFrameRect(container: Dimensions, source: Dimensions): Rect {
  const scale = Math.min(container.width / source.width, container.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  };
}

export function createDefaultCorners(dimensions: Dimensions): ScanicCorners {
  return {
    topLeft: { x: Math.round(dimensions.width * 0.08), y: Math.round(dimensions.height * 0.12) },
    topRight: { x: Math.round(dimensions.width * 0.92), y: Math.round(dimensions.height * 0.12) },
    bottomRight: { x: Math.round(dimensions.width * 0.92), y: Math.round(dimensions.height * 0.88) },
    bottomLeft: { x: Math.round(dimensions.width * 0.08), y: Math.round(dimensions.height * 0.88) },
  };
}

export function outsetCorners(
  corners: ScanicCorners,
  dimensions: Dimensions,
  ratio = 0.03,
): ScanicCorners {
  const center = getCenter(corners);

  return Object.fromEntries(CORNER_ORDER.map((cornerName) => {
    const point = corners[cornerName];
    const xOffset = (point.x - center.x) * ratio;
    const yOffset = (point.y - center.y) * ratio;

    return [
      cornerName,
      {
        x: Math.round(clamp(point.x + xOffset, 0, dimensions.width)),
        y: Math.round(clamp(point.y + yOffset, 0, dimensions.height)),
      },
    ];
  })) as unknown as ScanicCorners;
}

export function getCornerCoverageRatio(corners: ScanicCorners, dimensions: Dimensions) {
  return getPolygonArea(corners) / Math.max(1, dimensions.width * dimensions.height);
}

export function isDetectionUsable({
  corners,
  dimensions,
  confidence,
  minConfidence = 0.45,
  minCoverageRatio = 0.08,
}: {
  corners: ScanicCorners | null;
  dimensions: Dimensions;
  confidence?: number | null;
  minConfidence?: number;
  minCoverageRatio?: number;
}) {
  if (!corners) return false;
  if ((confidence ?? 0) < minConfidence) return false;

  return getCornerCoverageRatio(corners, dimensions) >= minCoverageRatio;
}

export function areCornersSimilar(
  previous: ScanicCorners,
  next: ScanicCorners,
  dimensions: Dimensions,
  maxMovementRatio = 0.035,
) {
  const diagonal = Math.hypot(dimensions.width, dimensions.height);
  const maxAverageMovement = diagonal * maxMovementRatio;
  const averageMovement = CORNER_ORDER.reduce((sum, cornerName) => (
    sum + distance(previous[cornerName], next[cornerName])
  ), 0) / CORNER_ORDER.length;

  return averageMovement <= maxAverageMovement;
}

export function averageCorners(entries: StableDetectionEntry[]): ScanicCorners {
  const count = Math.max(1, entries.length);

  return Object.fromEntries(CORNER_ORDER.map((cornerName) => [
    cornerName,
    {
      x: Math.round(entries.reduce((sum, entry) => sum + entry.corners[cornerName].x, 0) / count),
      y: Math.round(entries.reduce((sum, entry) => sum + entry.corners[cornerName].y, 0) / count),
    },
  ])) as unknown as ScanicCorners;
}

export function getStableDetection(
  history: StableDetectionEntry[],
  corners: ScanicCorners,
  dimensions: Dimensions,
  options: { requiredFrames?: number; maxHistory?: number } = {},
) {
  const requiredFrames = options.requiredFrames ?? 3;
  const maxHistory = options.maxHistory ?? 5;
  const previous = history.at(-1);
  const nextHistory = previous && !areCornersSimilar(previous.corners, corners, dimensions)
    ? [{ corners }]
    : [...history, { corners }].slice(-maxHistory);

  return {
    history: nextHistory,
    stableCorners: nextHistory.length >= requiredFrames
      ? averageCorners(nextHistory.slice(-requiredFrames))
      : null,
  };
}
