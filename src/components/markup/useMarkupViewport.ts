"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { clampScale, fitEntireScale, zoomAroundViewportPoint, type Size } from "@/lib/markup/viewport";

type PointerPoint = { x: number; y: number };
type Gesture =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number }
  | {
      mode: "pinch";
      startDistance: number;
      startScale: number;
      startCenterX: number;
      startCenterY: number;
      scrollLeft: number;
      scrollTop: number;
    };

type Options = {
  baseSize: Size;
  pageKey: string | number;
  navigationEnabled: boolean;
  padding?: number;
};

export function useMarkupViewport({ baseSize, pageKey, navigationEnabled, padding = 16 }: Options) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(1);
  const userZoomedRef = useRef(false);
  const pageKeyRef = useRef(pageKey);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<Gesture | null>(null);
  const [viewportSize, setViewportSize] = useState<Size>({ width: 0, height: 0 });
  const [scale, setScaleState] = useState(1);

  const fitScale = useMemo(() => fitEntireScale(baseSize, viewportSize, padding), [baseSize, viewportSize, padding]);

  const setScale = useCallback((next: number) => {
    const clamped = clampScale(next);
    scaleRef.current = clamped;
    setScaleState(clamped);
  }, []);

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

  useEffect(() => {
    let canceled = false;
    queueMicrotask(() => {
      if (canceled) return;
      if (pageKeyRef.current !== pageKey) {
        pageKeyRef.current = pageKey;
        userZoomedRef.current = false;
        setScale(fitScale);
        return;
      }
      if (!userZoomedRef.current) setScale(fitScale);
    });
    return () => {
      canceled = true;
    };
  }, [fitScale, pageKey, setScale]);

  const applyManualScale = useCallback(
    (next: number, focal?: { clientX: number; clientY: number }) => {
      const viewport = viewportRef.current;
      const currentScale = scaleRef.current;
      const nextScale = clampScale(next);
      userZoomedRef.current = true;

      let nextScroll: { scrollLeft: number; scrollTop: number } | null = null;
      if (viewport && focal) {
        const rect = viewport.getBoundingClientRect();
        nextScroll = zoomAroundViewportPoint({
          currentScale,
          nextScale,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
          viewportLeft: rect.left,
          viewportTop: rect.top,
          focalClientX: focal.clientX,
          focalClientY: focal.clientY,
        });
      }

      setScale(nextScale);
      if (viewport && nextScroll) {
        requestAnimationFrame(() => {
          viewport.scrollLeft = nextScroll.scrollLeft;
          viewport.scrollTop = nextScroll.scrollTop;
        });
      }
    },
    [setScale],
  );

  const zoomIn = useCallback(() => applyManualScale(scaleRef.current + 0.2), [applyManualScale]);
  const zoomOut = useCallback(() => applyManualScale(scaleRef.current - 0.2), [applyManualScale]);
  const fitToScreen = useCallback(() => {
    userZoomedRef.current = false;
    setScale(fitScale);
    const viewport = viewportRef.current;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
      });
    }
  }, [fitScale, setScale]);

  const resetGesture = useCallback(() => {
    pointersRef.current.clear();
    gestureRef.current = null;
  }, []);

  const updatePinchGesture = useCallback(() => {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return;
    const [a, b] = points;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const centerX = (a.x + b.x) / 2;
    const centerY = (a.y + b.y) / 2;
    const viewport = viewportRef.current;
    if (!viewport || distance === 0) return;

    if (gestureRef.current?.mode !== "pinch") {
      gestureRef.current = {
        mode: "pinch",
        startDistance: distance,
        startScale: scaleRef.current,
        startCenterX: centerX,
        startCenterY: centerY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
      return;
    }

    const gesture = gestureRef.current;
    const nextScale = clampScale(gesture.startScale * (distance / gesture.startDistance));
    const rect = viewport.getBoundingClientRect();
    const nextScroll = zoomAroundViewportPoint({
      currentScale: gesture.startScale,
      nextScale,
      scrollLeft: gesture.scrollLeft,
      scrollTop: gesture.scrollTop,
      viewportLeft: rect.left,
      viewportTop: rect.top,
      focalClientX: gesture.startCenterX,
      focalClientY: gesture.startCenterY,
    });

    userZoomedRef.current = true;
    setScale(nextScale);
    viewport.scrollLeft = nextScroll.scrollLeft + (gesture.startCenterX - centerX);
    viewport.scrollTop = nextScroll.scrollTop + (gesture.startCenterY - centerY);
  }, [setScale]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!navigationEnabled || (event.pointerType === "mouse" && event.button !== 0)) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointersRef.current.size >= 2) {
        updatePinchGesture();
        return;
      }

      gestureRef.current = {
        mode: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
    },
    [navigationEnabled, updatePinchGesture],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!navigationEnabled || !pointersRef.current.has(event.pointerId)) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      event.preventDefault();
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointersRef.current.size >= 2) {
        updatePinchGesture();
        return;
      }

      const gesture = gestureRef.current;
      if (gesture?.mode !== "pan" || gesture.pointerId !== event.pointerId) return;
      viewport.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.startX);
      viewport.scrollTop = gesture.scrollTop - (event.clientY - gesture.startY);
    },
    [navigationEnabled, updatePinchGesture],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
      pointersRef.current.delete(event.pointerId);
      if (!navigationEnabled || pointersRef.current.size === 0) {
        gestureRef.current = null;
        return;
      }

      const remaining = [...pointersRef.current.entries()][0];
      const viewport = viewportRef.current;
      if (!remaining || !viewport) {
        gestureRef.current = null;
        return;
      }
      gestureRef.current = {
        mode: "pan",
        pointerId: remaining[0],
        startX: remaining[1].x,
        startY: remaining[1].y,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
    },
    [navigationEnabled],
  );

  const pointerHandlers = navigationEnabled
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel: resetGesture,
      }
    : {};

  return {
    viewportRef,
    scale,
    fitScale,
    zoomIn,
    zoomOut,
    fitToScreen,
    pointerHandlers,
  };
}
