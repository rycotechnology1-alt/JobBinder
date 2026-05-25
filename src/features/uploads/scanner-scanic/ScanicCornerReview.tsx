"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createDefaultCorners } from "./scanicGeometry";
import { createJpegBlobFromCanvas } from "./scanicPdfGeneration";
import type { ScanicCapture, ScanicCorners } from "./scanicTypes";

type CornerKey = keyof ScanicCorners;

type Props = {
  capture: ScanicCapture;
  objectUrl: string;
  onAccept: (capture: ScanicCapture) => void;
  onRetake: () => void;
  onError: (message: string) => void;
};

type CorrectedPreview = {
  blob: Blob;
  objectUrl: string;
  width: number;
  height: number;
  corners: ScanicCorners;
};

const CORNER_KEYS: CornerKey[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

function cloneCorners(corners: ScanicCorners): ScanicCorners {
  return {
    topLeft: { ...corners.topLeft },
    topRight: { ...corners.topRight },
    bottomRight: { ...corners.bottomRight },
    bottomLeft: { ...corners.bottomLeft },
  };
}

function getPoints(corners: ScanicCorners) {
  return CORNER_KEYS.map((corner) => `${corners[corner].x},${corners[corner].y}`).join(" ");
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare scanned page.");
  return context;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load captured page."));
    image.src = src;
  });
}

function getSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(matrix.inverse());
}

async function createCorrectedPreview(input: {
  capture: ScanicCapture;
  objectUrl: string;
  corners: ScanicCorners;
}): Promise<Omit<CorrectedPreview, "objectUrl">> {
  const scanic = await import("scanic");
  const image = await loadImage(input.objectUrl);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = input.capture.width;
  sourceCanvas.height = input.capture.height;
  getCanvasContext(sourceCanvas).drawImage(image, 0, 0, input.capture.width, input.capture.height);

  const extracted = await scanic.extractDocument(sourceCanvas, input.corners, { output: "canvas" });
  if (!extracted.success || !(extracted.output instanceof HTMLCanvasElement)) {
    throw new Error(extracted.message || "Could not correct the page perspective.");
  }

  const pageImage = await createJpegBlobFromCanvas(extracted.output);
  return {
    blob: pageImage.blob,
    width: pageImage.width,
    height: pageImage.height,
    corners: cloneCorners(input.corners),
  };
}

export function ScanicCornerReview({ capture, objectUrl, onAccept, onRetake, onError }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [corners, setCorners] = useState<ScanicCorners>(
    () => cloneCorners(capture.corners ?? createDefaultCorners({ width: capture.width, height: capture.height })),
  );
  const [activeCorner, setActiveCorner] = useState<CornerKey | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [correctedPreview, setCorrectedPreview] = useState<CorrectedPreview | null>(null);

  const status = useMemo(() => {
    if (capture.detectionMode === "fallback") return "Set the page corners";
    if (capture.confidence) return `Review corners - ${Math.round(capture.confidence * 100)}% confidence`;
    return "Review corners";
  }, [capture.confidence, capture.detectionMode]);

  useEffect(() => () => {
    if (correctedPreview) URL.revokeObjectURL(correctedPreview.objectUrl);
  }, [correctedPreview]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setIsPreviewProcessing(true);
      try {
        const preview = await createCorrectedPreview({ capture, objectUrl, corners });
        const nextPreview = {
          ...preview,
          objectUrl: URL.createObjectURL(preview.blob),
        };

        if (cancelled) {
          URL.revokeObjectURL(nextPreview.objectUrl);
          return;
        }

        setCorrectedPreview((currentPreview) => {
          if (currentPreview) URL.revokeObjectURL(currentPreview.objectUrl);
          return nextPreview;
        });
      } catch (error) {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : "Could not prepare the corrected preview.");
        }
      } finally {
        if (!cancelled) setIsPreviewProcessing(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [capture, corners, objectUrl, onError]);

  function updateCorner(corner: CornerKey, clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const point = getSvgPoint(svg, clientX, clientY);
    if (!point) return;

    setCorners((currentCorners) => ({
      ...currentCorners,
      [corner]: {
        x: Math.max(0, Math.min(capture.width, Math.round(point.x))),
        y: Math.max(0, Math.min(capture.height, Math.round(point.y))),
      },
    }));
  }

  async function handleAccept() {
    setIsProcessing(true);
    try {
      const pageImage = correctedPreview && getPoints(correctedPreview.corners) === getPoints(corners)
        ? correctedPreview
        : await createCorrectedPreview({ capture, objectUrl, corners });
      onAccept({
        ...capture,
        blob: pageImage.blob,
        width: pageImage.width,
        height: pageImage.height,
        corners,
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not correct the page perspective.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="relative min-h-[260px] flex-[1.15] overflow-hidden rounded-lg border border-zinc-800 bg-black">
        {correctedPreview ? (
          <img
            src={correctedPreview.objectUrl}
            alt="Perspective-corrected page preview"
            className="h-full max-h-[44vh] w-full object-contain"
          />
        ) : (
          <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-zinc-500">
            {isPreviewProcessing ? "Preparing preview..." : "Preview unavailable"}
          </div>
        )}
      </div>

      <div className="relative min-h-[150px] flex-[0.85] overflow-hidden rounded-lg border border-zinc-800 bg-black">
        <img
          src={objectUrl}
          alt="Captured page awaiting corner review"
          className="h-full max-h-[28vh] w-full object-contain opacity-70"
        />
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full touch-none"
          viewBox={`0 0 ${capture.width} ${capture.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Adjust document corners"
          onPointerMove={(event) => {
            if (!activeCorner) return;
            event.preventDefault();
            updateCorner(activeCorner, event.clientX, event.clientY);
          }}
          onPointerUp={() => setActiveCorner(null)}
          onPointerCancel={() => setActiveCorner(null)}
        >
          <polygon
            points={getPoints(corners)}
            fill="rgba(16, 185, 129, 0.14)"
            stroke="rgba(52, 211, 153, 0.96)"
            strokeWidth="5"
            vectorEffect="non-scaling-stroke"
          />
          {CORNER_KEYS.map((cornerKey) => (
            <circle
              key={cornerKey}
              cx={corners[cornerKey].x}
              cy={corners[cornerKey].y}
              r="18"
              className="cursor-grab active:cursor-grabbing"
              fill="rgb(236, 253, 245)"
              stroke="rgb(5, 150, 105)"
              strokeWidth="4"
              vectorEffect="non-scaling-stroke"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setActiveCorner(cornerKey);
                updateCorner(cornerKey, event.clientX, event.clientY);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">{status}</p>
          <p className="text-xs text-zinc-500">
            {capture.detectionMode === "fallback" ? "No reliable auto-detection" : `Detected by ${capture.detectionMode}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onRetake} disabled={isProcessing} className="gap-2">
            <RotateCcw size={16} />
            Retake
          </Button>
          <Button type="button" size="sm" onClick={handleAccept} disabled={isProcessing} className="gap-2">
            <Check size={16} />
            Use Page
          </Button>
        </div>
      </div>
    </div>
  );
}
