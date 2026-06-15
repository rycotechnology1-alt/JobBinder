"use client";

// Transform-based pan/zoom engine shared by the file viewer, the marked-up view,
// and the markup editor. The Fieldwire model: during a gesture we move a single
// GPU-composited CSS transform (written straight to the DOM, so React/SVG never
// re-render mid-gesture), and only re-rasterize the page once the gesture
// settles. `viewScale` is the live on-screen scale; `rasterScale` is the
// debounced scale the page is actually drawn at. The content transform is
// `translate(tx,ty) scale(viewScale/rasterScale)`, so on-screen geometry depends
// only on (tx, ty, viewScale) — rasterScale changes swap blur for crispness
// without moving anything.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { CSSProperties } from "react";
import { clampScale, fitEntireScale, zoomAroundPoint, type Size } from "@/lib/markup/viewport";

const ZOOM_STEP = 0.25;
const RASTER_SETTLE_MS = 180;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

type PointerPoint = { x: number; y: number };
type Gesture =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; startTx: number; startTy: number }
  | {
      mode: "pinch";
      startDistance: number;
      startScale: number;
      startTx: number;
      startTy: number;
      startCenterX: number;
      startCenterY: number;
    };

type Options = {
  baseSize: Size;
  pageKey: string | number;
  navigationEnabled: boolean;
  padding?: number;
};

function transformString(tx: number, ty: number, viewScale: number, rasterScale: number): string {
  const k = rasterScale > 0 ? viewScale / rasterScale : 1;
  return `translate(${tx}px, ${ty}px) scale(${k})`;
}

export function useMarkupViewport({ baseSize, pageKey, navigationEnabled, padding = 16 }: Options) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [viewScale, setViewScaleState] = useState(1);
  const [rasterScale, setRasterScaleState] = useState(1);
  const [tx, setTxState] = useState(0);
  const [ty, setTyState] = useState(0);

  const viewScaleRef = useRef(1);
  const rasterScaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  const userZoomedRef = useRef(false);
  const pageKeyRef = useRef(pageKey);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<Gesture | null>(null);
  const rasterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fitScale = useMemo(() => fitEntireScale(baseSize, viewportSize, padding), [baseSize, viewportSize, padding]);

  // Push the live transform straight to the DOM during a gesture (no re-render).
  const writeTransform = useCallback(() => {
    const el = contentRef.current;
    if (el) el.style.transform = transformString(txRef.current, tyRef.current, viewScaleRef.current, rasterScaleRef.current);
  }, []);

  // Commit refs to React state (one render); used on gesture end and discrete zooms.
  const commitView = useCallback((nextTx: number, nextTy: number, nextScale: number) => {
    txRef.current = nextTx;
    tyRef.current = nextTy;
    viewScaleRef.current = nextScale;
    setTxState(nextTx);
    setTyState(nextTy);
    setViewScaleState(nextScale);
  }, []);

  const commitRaster = useCallback((scale: number) => {
    rasterScaleRef.current = scale;
    setRasterScaleState(scale);
  }, []);

  const scheduleRaster = useCallback(() => {
    if (rasterTimerRef.current) clearTimeout(rasterTimerRef.current);
    rasterTimerRef.current = setTimeout(() => commitRaster(viewScaleRef.current), RASTER_SETTLE_MS);
  }, [commitRaster]);

  const centeredOffset = useCallback(
    (scale: number) => ({
      tx: (viewportSize.width - baseSize.width * scale) / 2,
      ty: (viewportSize.height - baseSize.height * scale) / 2,
    }),
    [viewportSize, baseSize],
  );

  const fitNow = useCallback(() => {
    const { tx: ftx, ty: fty } = centeredOffset(fitScale);
    commitView(ftx, fty, fitScale);
    commitRaster(fitScale); // the page starts crisp at the fitted scale
  }, [fitScale, centeredOffset, commitView, commitRaster]);

  // Measure the viewport (ResizeObserver where available, else window resize).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let canceled = false;
    const measure = () => {
      if (canceled) return;
      const rect = viewport.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };
    queueMicrotask(measure);
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => {
        canceled = true;
        window.removeEventListener("resize", measure);
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => {
      canceled = true;
      observer.disconnect();
    };
  }, []);

  // Fit on first sizing and whenever the page changes; respect an explicit user zoom.
  useEffect(() => {
    let canceled = false;
    queueMicrotask(() => {
      if (canceled) return;
      if (pageKeyRef.current !== pageKey) {
        pageKeyRef.current = pageKey;
        userZoomedRef.current = false;
        fitNow();
        return;
      }
      if (!userZoomedRef.current) fitNow();
    });
    return () => {
      canceled = true;
    };
  }, [fitScale, pageKey, fitNow]);

  useEffect(() => () => {
    if (rasterTimerRef.current) clearTimeout(rasterTimerRef.current);
  }, []);

  // Discrete zoom (buttons / wheel) around a focal point; commits immediately,
  // schedules the crisp re-raster.
  const applyZoom = useCallback(
    (nextScaleRaw: number, focal?: { clientX: number; clientY: number }) => {
      const next = clampScale(nextScaleRaw);
      const current = viewScaleRef.current;
      if (next === current) return;
      const viewport = viewportRef.current;
      const rect = viewport?.getBoundingClientRect();
      const focalX = rect ? (focal ? focal.clientX - rect.left : rect.width / 2) : 0;
      const focalY = rect ? (focal ? focal.clientY - rect.top : rect.height / 2) : 0;
      const { tx: ntx, ty: nty } = zoomAroundPoint({
        tx: txRef.current,
        ty: tyRef.current,
        currentScale: current,
        nextScale: next,
        focalX,
        focalY,
      });
      userZoomedRef.current = true;
      commitView(ntx, nty, next);
      scheduleRaster();
    },
    [commitView, scheduleRaster],
  );

  const zoomIn = useCallback(() => applyZoom(viewScaleRef.current + ZOOM_STEP), [applyZoom]);
  const zoomOut = useCallback(() => applyZoom(viewScaleRef.current - ZOOM_STEP), [applyZoom]);
  const fitToScreen = useCallback(() => {
    userZoomedRef.current = false;
    fitNow();
  }, [fitNow]);

  // Native, non-passive wheel listener: React attaches `wheel` as passive at the
  // root, so a React onWheel can't preventDefault — which we must do to stop the
  // browser zooming the page on ctrl/trackpad-pinch wheel.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey) {
        // Trackpad pinch arrives as ctrl+wheel.
        const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
        applyZoom(viewScaleRef.current * factor, { clientX: event.clientX, clientY: event.clientY });
      } else {
        // Plain wheel pans the document.
        commitView(txRef.current - event.deltaX, tyRef.current - event.deltaY, viewScaleRef.current);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [applyZoom, commitView]);

  const startPinch = useCallback(() => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return;
    const [a, b] = points;
    gestureRef.current = {
      mode: "pinch",
      startDistance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      startScale: viewScaleRef.current,
      startTx: txRef.current,
      startTy: tyRef.current,
      startCenterX: (a.x + b.x) / 2,
      startCenterY: (a.y + b.y) / 2,
    };
  }, []);

  const updatePinch = useCallback(() => {
    const gesture = gestureRef.current;
    if (gesture?.mode !== "pinch") {
      startPinch();
      return;
    }
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return;
    const [a, b] = points;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (distance === 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const nextScale = clampScale(gesture.startScale * (distance / gesture.startDistance));
    const zoomed = zoomAroundPoint({
      tx: gesture.startTx,
      ty: gesture.startTy,
      currentScale: gesture.startScale,
      nextScale,
      focalX: gesture.startCenterX - rect.left,
      focalY: gesture.startCenterY - rect.top,
    });
    txRef.current = zoomed.tx + (centerX - gesture.startCenterX);
    tyRef.current = zoomed.ty + (centerY - gesture.startCenterY);
    viewScaleRef.current = nextScale;
    userZoomedRef.current = true;
    writeTransform();
  }, [startPinch, writeTransform]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointersRef.current.size >= 2) {
        startPinch();
        return;
      }
      gestureRef.current = {
        mode: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTx: txRef.current,
        startTy: tyRef.current,
      };
    },
    [startPinch],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(event.pointerId)) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      event.preventDefault();
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointersRef.current.size >= 2) {
        updatePinch();
        return;
      }
      const gesture = gestureRef.current;
      if (gesture?.mode !== "pan" || gesture.pointerId !== event.pointerId) return;
      txRef.current = gesture.startTx + (event.clientX - gesture.startX);
      tyRef.current = gesture.startTy + (event.clientY - gesture.startY);
      writeTransform();
    },
    [updatePinch, writeTransform],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      pointersRef.current.delete(event.pointerId);
      // Commit the gesture result to React state and queue the crisp re-raster.
      commitView(txRef.current, tyRef.current, viewScaleRef.current);
      scheduleRaster();

      if (pointersRef.current.size === 0) {
        gestureRef.current = null;
        return;
      }
      // A finger remains: continue as a pan from its current position.
      const remaining = [...pointersRef.current.entries()][0];
      gestureRef.current = {
        mode: "pan",
        pointerId: remaining[0],
        startX: remaining[1].x,
        startY: remaining[1].y,
        startTx: txRef.current,
        startTy: tyRef.current,
      };
    },
    [commitView, scheduleRaster],
  );

  const resetGesture = useCallback(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
    commitView(txRef.current, tyRef.current, viewScaleRef.current);
  }, [commitView]);

  const pointerHandlers = navigationEnabled
    ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: resetGesture }
    : {};

  const contentStyle: CSSProperties = useMemo(
    () => ({
      transform: transformString(tx, ty, viewScale, rasterScale),
      transformOrigin: "0 0",
      willChange: "transform",
    }),
    [tx, ty, viewScale, rasterScale],
  );

  return {
    viewportRef,
    contentRef,
    contentStyle,
    viewScale,
    rasterScale,
    tx,
    ty,
    fitScale,
    zoomIn,
    zoomOut,
    fitToScreen,
    pointerHandlers,
  };
}
