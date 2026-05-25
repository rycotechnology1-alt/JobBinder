"use client";

import type { ScanicCorners } from "./scanicTypes";

type Props = {
  corners: ScanicCorners | null;
  width: number;
  height: number;
};

function toPoints(corners: ScanicCorners) {
  return [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}

export function ScanicOverlay({ corners, width, height }: Props) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${width || 1} ${height || 1}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {corners ? (
        <>
          <polygon
            points={toPoints(corners)}
            fill="rgba(16, 185, 129, 0.14)"
            stroke="rgba(52, 211, 153, 0.96)"
            strokeWidth="5"
            vectorEffect="non-scaling-stroke"
          />
          {[corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].map((point, index) => (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r="7"
              fill="rgb(236, 253, 245)"
              stroke="rgb(5, 150, 105)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </>
      ) : (
        <rect
          x={width * 0.08}
          y={height * 0.12}
          width={width * 0.84}
          height={height * 0.76}
          rx="16"
          fill="none"
          stroke="rgba(244, 244, 245, 0.38)"
          strokeDasharray="12 12"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
