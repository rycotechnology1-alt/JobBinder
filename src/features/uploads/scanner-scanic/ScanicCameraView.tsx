"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getStableDetection,
  isDetectionUsable,
  outsetCorners,
  type StableDetectionEntry,
} from "./scanicGeometry";
import { ScanicOverlay } from "./ScanicOverlay";
import { getScanicCameraSupportError } from "./scanicCameraSupport";
import { createJpegBlobFromCanvas } from "./scanicPdfGeneration";
import type { ScanicCapture, ScanicCorners } from "./scanicTypes";

type ScanicModule = typeof import("scanic");
type ScanicScanner = InstanceType<ScanicModule["Scanner"]>;

const DETECTION_INTERVAL_MS = 650;
const DETECTION_MAX_DIMENSION = 720;

type Props = {
  onCapture: (capture: ScanicCapture) => void;
  onError: (message: string) => void;
  captureRequestId: number;
  isActive: boolean;
};

function scaleCorners(corners: ScanicCorners, scaleX: number, scaleY: number): ScanicCorners {
  return {
    topLeft: { x: corners.topLeft.x * scaleX, y: corners.topLeft.y * scaleY },
    topRight: { x: corners.topRight.x * scaleX, y: corners.topRight.y * scaleY },
    bottomRight: { x: corners.bottomRight.x * scaleX, y: corners.bottomRight.y * scaleY },
    bottomLeft: { x: corners.bottomLeft.x * scaleX, y: corners.bottomLeft.y * scaleY },
  };
}

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare the scanner preview.");
  return context;
}

export function ScanicCameraView({ onCapture, onError, captureRequestId, isActive }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<ScanicScanner | null>(null);
  const scanicRef = useRef<ScanicModule | null>(null);
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestCornersRef = useRef<ScanicCorners | null>(null);
  const latestConfidenceRef = useRef<number | null>(null);
  const stableHistoryRef = useRef<StableDetectionEntry[]>([]);
  const isDetectingRef = useRef(false);
  const [overlayCorners, setOverlayCorners] = useState<ScanicCorners | null>(null);
  const [sourceSize, setSourceSize] = useState({ width: 1, height: 1 });
  const [status, setStatus] = useState("Opening camera...");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    latestCornersRef.current = null;
    latestConfidenceRef.current = null;
    stableHistoryRef.current = [];
    setOverlayCorners(null);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    let intervalId: number | null = null;

    async function start() {
      try {
        const supportError = getScanicCameraSupportError({
          isSecureContext: window.isSecureContext,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          hasMediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
        });

        if (supportError) {
          throw new Error(supportError);
        }

        setStatus("Loading scanner...");
        const scanic = await import("scanic");
        scanicRef.current = scanic;
        const scanner = new scanic.Scanner({
          mode: "detect",
          maxProcessingDimension: DETECTION_MAX_DIMENSION,
        });
        await scanner.initialize();
        scannerRef.current = scanner;

        setStatus("Opening rear camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("Looking for document edges...");

        intervalId = window.setInterval(async () => {
          if (isDetectingRef.current || !scannerRef.current || !video.videoWidth || !video.videoHeight) return;
          isDetectingRef.current = true;

          try {
            const longEdge = Math.max(video.videoWidth, video.videoHeight);
            const scale = Math.min(1, DETECTION_MAX_DIMENSION / longEdge);
            const width = Math.max(1, Math.round(video.videoWidth * scale));
            const height = Math.max(1, Math.round(video.videoHeight * scale));
            const canvas = detectionCanvasRef.current ?? document.createElement("canvas");
            detectionCanvasRef.current = canvas;
            canvas.width = width;
            canvas.height = height;
            getCanvasContext(canvas).drawImage(video, 0, 0, width, height);
            setSourceSize({ width: video.videoWidth, height: video.videoHeight });

            const result = await scannerRef.current.scan(canvas, {
              mode: "detect",
              maxProcessingDimension: DETECTION_MAX_DIMENSION,
              enableDetectionCascade: true,
              minDocumentCoverageRatio: 0.06,
              maxCandidateContours: 18,
              dilationKernelSize: 5,
              dilationIterations: 2,
            });

            const sourceCorners = result.corners
              ? scaleCorners(result.corners, video.videoWidth / width, video.videoHeight / height)
              : null;
            const confidence = result.confidence ?? (result.success ? 0.5 : null);

            if (sourceCorners && result.success && isDetectionUsable({
              corners: sourceCorners,
              dimensions: { width: video.videoWidth, height: video.videoHeight },
              confidence,
            })) {
              const stableDetection = getStableDetection(
                stableHistoryRef.current,
                sourceCorners,
                { width: video.videoWidth, height: video.videoHeight },
              );
              stableHistoryRef.current = stableDetection.history;

              if (stableDetection.stableCorners) {
                latestCornersRef.current = stableDetection.stableCorners;
                latestConfidenceRef.current = confidence;
                setOverlayCorners(stableDetection.stableCorners);
                setStatus("Edges locked. Review corners after capture.");
              } else {
                setStatus("Hold steady...");
              }
            } else {
              stableHistoryRef.current = stableHistoryRef.current.slice(-2);
              setStatus(latestCornersRef.current ? "Keeping last stable edge preview" : "Align the full page inside the guide");
            }
          } catch (error) {
            console.warn("Scanic live detection failed:", error);
            setStatus("Live detection paused. Capture still works.");
          } finally {
            isDetectingRef.current = false;
          }
        }, DETECTION_INTERVAL_MS);
      } catch (error) {
        const message = error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera access is required to scan a document. You can allow camera access in your browser settings, or upload a file instead."
          : error instanceof Error
            ? error.message
            : "Scanner is unavailable. Upload a file instead.";
        onError(message);
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      stopCamera();
    };
  }, [isActive, onError, stopCamera]);

  useEffect(() => {
    if (!captureRequestId || !isActive) return;

    let cancelled = false;

    async function capture() {
      const video = videoRef.current;
      if (!video || !video.videoWidth || !video.videoHeight) return;

      try {
        setStatus("Capturing page...");
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = video.videoWidth;
        sourceCanvas.height = video.videoHeight;
        getCanvasContext(sourceCanvas).drawImage(video, 0, 0, sourceCanvas.width, sourceCanvas.height);

        const scanic = scanicRef.current ?? await import("scanic");
        scanicRef.current = scanic;
        const detectionCanvas = detectionCanvasRef.current;
        const liveCorners = latestCornersRef.current;
        let reviewCorners: ScanicCorners | null = null;
        let confidence: number | null = null;
        let detectionMode: ScanicCapture["detectionMode"] = "fallback";

        const scanner = scannerRef.current ?? new scanic.Scanner({ mode: "detect" });
        scannerRef.current = scanner;
        const extracted = await scanner.scan(sourceCanvas, {
          mode: "detect",
          maxProcessingDimension: 1400,
          enableDetectionCascade: true,
          minDocumentCoverageRatio: 0.06,
          maxCandidateContours: 18,
          dilationKernelSize: 5,
          dilationIterations: 2,
        });

        const captureConfidence = extracted.confidence ?? (extracted.success ? 0.5 : null);
        if (extracted.success && isDetectionUsable({
          corners: extracted.corners,
          dimensions: { width: sourceCanvas.width, height: sourceCanvas.height },
          confidence: captureConfidence,
        })) {
          reviewCorners = extracted.corners;
          confidence = captureConfidence;
          detectionMode = "capture";
        } else if (liveCorners && isDetectionUsable({
          corners: liveCorners,
          dimensions: { width: sourceCanvas.width, height: sourceCanvas.height },
          confidence: latestConfidenceRef.current ?? 0.5,
        })) {
          reviewCorners = liveCorners;
          confidence = latestConfidenceRef.current;
          detectionMode = "live";
        } else {
          detectionMode = "fallback";
        }

        const sourceImage = await createJpegBlobFromCanvas(sourceCanvas);
        if (reviewCorners) {
          reviewCorners = scaleCorners(
            reviewCorners,
            sourceImage.width / sourceCanvas.width,
            sourceImage.height / sourceCanvas.height,
          );
          reviewCorners = outsetCorners(reviewCorners, { width: sourceImage.width, height: sourceImage.height });
        }

        if (!cancelled) {
          onCapture({
            blob: sourceImage.blob,
            width: sourceImage.width,
            height: sourceImage.height,
            detectionMode,
            corners: reviewCorners,
            confidence,
            sourceWidth: sourceCanvas.width,
            sourceHeight: sourceCanvas.height,
            detectionFrame: detectionCanvas ? { width: detectionCanvas.width, height: detectionCanvas.height } : null,
            displayFrame: { width: video.videoWidth, height: video.videoHeight },
            needsCornerReview: true,
          });
          setStatus("Review and adjust corners");
        }
      } catch (error) {
        console.warn("Scanic capture failed, using full image fallback:", error);
        try {
          const video = videoRef.current;
          if (!video) return;
          const fallbackCanvas = document.createElement("canvas");
          fallbackCanvas.width = video.videoWidth;
          fallbackCanvas.height = video.videoHeight;
          getCanvasContext(fallbackCanvas).drawImage(video, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
          const pageImage = await createJpegBlobFromCanvas(fallbackCanvas);
          if (!cancelled) {
            onCapture({
              blob: pageImage.blob,
              width: pageImage.width,
              height: pageImage.height,
              detectionMode: "fallback",
              corners: null,
              needsCornerReview: true,
            });
          }
        } catch {
          onError("Could not capture the page. Try again or upload a file instead.");
        }
      }
    }

    capture();

    return () => {
      cancelled = true;
    };
  }, [captureRequestId, isActive, onCapture, onError]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="h-full min-h-[420px] w-full object-contain"
      />
      <ScanicOverlay corners={overlayCorners} width={sourceSize.width} height={sourceSize.height} />
      <div className="absolute left-3 right-3 top-3 rounded-lg bg-black/60 px-3 py-2 text-center text-xs font-medium text-zinc-100 backdrop-blur">
        {status}
      </div>
    </div>
  );
}
