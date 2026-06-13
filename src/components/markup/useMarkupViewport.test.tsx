// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMarkupViewport } from "./useMarkupViewport";

function Harness({ navigationEnabled }: { navigationEnabled: boolean }) {
  const viewport = useMarkupViewport({
    baseSize: { width: 4000, height: 3000 },
    pageKey: "page-1",
    navigationEnabled,
    padding: 16,
  });

  return (
    <div>
      <output data-testid="scale">{viewport.scale.toFixed(3)}</output>
      <div
        ref={viewport.viewportRef}
        data-testid="viewport"
        style={{ height: 640, overflow: "auto", width: 360 }}
        {...viewport.pointerHandlers}
      >
        <div style={{ height: 3000 * viewport.scale, width: 4000 * viewport.scale }} />
      </div>
    </div>
  );
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getMockRect(this: HTMLElement) {
    if (this.dataset.testid === "viewport") {
      return {
        width: 360,
        height: 640,
        top: 0,
        right: 360,
        bottom: 640,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }

    return {
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useMarkupViewport", () => {
  it("opens large content fit entirely in the viewport", async () => {
    render(<Harness navigationEnabled />);

    await waitFor(() => {
      expect(screen.getByTestId("scale").textContent).toBe("0.082");
    });
  });

  it("pans only when navigation is enabled", async () => {
    const { rerender } = render(<Harness navigationEnabled={false} />);
    const disabledViewport = screen.getByTestId("viewport");

    fireEvent.pointerDown(disabledViewport, { clientX: 200, clientY: 200, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(disabledViewport, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" });
    expect(disabledViewport.scrollLeft).toBe(0);
    expect(disabledViewport.scrollTop).toBe(0);

    rerender(<Harness navigationEnabled />);
    const enabledViewport = screen.getByTestId("viewport");
    fireEvent.pointerDown(enabledViewport, { clientX: 200, clientY: 200, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(enabledViewport, { clientX: 100, clientY: 100, pointerId: 1, pointerType: "touch" });

    expect(enabledViewport.scrollLeft).toBe(100);
    expect(enabledViewport.scrollTop).toBe(100);
  });
});
