// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkupViewport } from "./useMarkupViewport";

function Harness({ navigationEnabled = true }: { navigationEnabled?: boolean }) {
  const { viewportRef, contentRef, contentStyle, viewScale, rasterScale, tx, ty, zoomIn, pointerHandlers } =
    useMarkupViewport({
      baseSize: { width: 4000, height: 3000 },
      pageKey: "page-1",
      navigationEnabled,
      padding: 16,
    });

  return (
    <div>
      <output data-testid="viewScale">{viewScale.toFixed(3)}</output>
      <output data-testid="rasterScale">{rasterScale.toFixed(3)}</output>
      <output data-testid="tx">{tx.toFixed(1)}</output>
      <output data-testid="ty">{ty.toFixed(1)}</output>
      <div
        ref={viewportRef}
        data-testid="viewport"
        style={{ height: 640, overflow: "hidden", width: 360 }}
        {...pointerHandlers}
      >
        <div ref={contentRef} style={contentStyle} />
      </div>
      <button type="button" data-testid="zoomIn" onClick={zoomIn}>
        in
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getMockRect(this: HTMLElement) {
    if (this.dataset.testid === "viewport") {
      return { width: 360, height: 640, top: 0, right: 360, bottom: 640, left: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    return { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const num = (testId: string) => Number(screen.getByTestId(testId).textContent);

describe("useMarkupViewport", () => {
  it("fits large content into the viewport on open and seeds both scales", async () => {
    render(<Harness />);

    await waitFor(() => {
      expect(screen.getByTestId("viewScale").textContent).toBe("0.082");
    });
    // The first paint is crisp: rasterScale matches the fitted view scale.
    expect(screen.getByTestId("rasterScale").textContent).toBe("0.082");
  });

  it("pans by translating the content with the pointer", async () => {
    render(<Harness />);
    await waitFor(() => expect(num("viewScale")).toBeGreaterThan(0));

    const txBefore = num("tx");
    const tyBefore = num("ty");
    const viewport = screen.getByTestId("viewport");
    fireEvent.pointerDown(viewport, { clientX: 200, clientY: 200, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(viewport, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(viewport, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" });

    // Content follows the finger: dragging up-left by 100 moves the translate by -100.
    expect(num("tx")).toBeCloseTo(txBefore - 100, 1);
    expect(num("ty")).toBeCloseTo(tyBefore - 100, 1);
  });

  it("does not pan when navigation is disabled", async () => {
    render(<Harness navigationEnabled={false} />);
    await waitFor(() => expect(num("viewScale")).toBeGreaterThan(0));

    const txBefore = num("tx");
    const viewport = screen.getByTestId("viewport");
    fireEvent.pointerDown(viewport, { clientX: 200, clientY: 200, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(viewport, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" });

    expect(num("tx")).toBeCloseTo(txBefore, 1);
  });

  it("updates viewScale immediately but defers rasterScale until the gesture settles", async () => {
    render(<Harness />);
    await waitFor(() => expect(num("viewScale")).toBeCloseTo(0.082, 3));

    fireEvent.click(screen.getByTestId("zoomIn"));

    // Live view scale jumps now; the expensive raster scale lags behind.
    expect(num("viewScale")).toBeGreaterThan(0.2);
    expect(num("rasterScale")).toBeCloseTo(0.082, 3);

    // After the debounce window the raster catches up to the view scale.
    await waitFor(() => expect(num("rasterScale")).toBeCloseTo(num("viewScale"), 3), { timeout: 1000 });
  });

  it("zooms with ctrl/pinch wheel and keeps it out of the raster hot path", async () => {
    render(<Harness />);
    await waitFor(() => expect(num("viewScale")).toBeCloseTo(0.082, 3));
    const before = num("viewScale");

    fireEvent.wheel(screen.getByTestId("viewport"), { deltaY: -100, ctrlKey: true, clientX: 180, clientY: 320 });

    expect(num("viewScale")).toBeGreaterThan(before);
  });
});
