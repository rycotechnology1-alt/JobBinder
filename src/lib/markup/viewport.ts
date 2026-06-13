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

export function zoomAroundViewportPoint(input: {
  currentScale: number;
  nextScale: number;
  scrollLeft: number;
  scrollTop: number;
  viewportLeft: number;
  viewportTop: number;
  focalClientX: number;
  focalClientY: number;
}): { scrollLeft: number; scrollTop: number } {
  const focalX = input.focalClientX - input.viewportLeft;
  const focalY = input.focalClientY - input.viewportTop;
  const contentX = (input.scrollLeft + focalX) / input.currentScale;
  const contentY = (input.scrollTop + focalY) / input.currentScale;

  return {
    scrollLeft: contentX * input.nextScale - focalX,
    scrollTop: contentY * input.nextScale - focalY,
  };
}
