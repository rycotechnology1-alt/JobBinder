export type Size = { width: number; height: number };

export const MIN_MARKUP_SCALE = 0.05;
export const MAX_MARKUP_SCALE = 4;

export function clampScale(value: number, min = MIN_MARKUP_SCALE, max = MAX_MARKUP_SCALE): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(max, Math.max(min, value));
}

export function fitEntireScale(contentSize: Size, viewportSize: Size, padding = 0): number {
  if (contentSize.width <= 0 || contentSize.height <= 0 || viewportSize.width <= 0 || viewportSize.height <= 0) {
    return 1;
  }

  const availableWidth = Math.max(1, viewportSize.width - padding * 2);
  const availableHeight = Math.max(1, viewportSize.height - padding * 2);
  return clampScale(Math.min(1, availableWidth / contentSize.width, availableHeight / contentSize.height));
}

/**
 * Translate-based focal zoom for the transform model. The content is drawn at
 * `transform: translate(tx, ty) scale(s)` (origin 0,0), so a content point `c`
 * lands at screen `tx + c * s`. To keep the point under (focalX, focalY) fixed
 * while the scale changes, the new offset is derived from the scale ratio alone.
 * Focal coords are viewport-local (clientX - viewport.left).
 */
export function zoomAroundPoint(input: {
  tx: number;
  ty: number;
  currentScale: number;
  nextScale: number;
  focalX: number;
  focalY: number;
}): { tx: number; ty: number } {
  const ratio = input.nextScale / input.currentScale;
  return {
    tx: input.focalX - (input.focalX - input.tx) * ratio,
    ty: input.focalY - (input.focalY - input.ty) * ratio,
  };
}
