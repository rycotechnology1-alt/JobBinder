// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkupCanvasLayer } from "./MarkupCanvasLayer";
import type { Mark } from "@/lib/markup/types";

const SIZE = { width: 1000, height: 500 };

function renderLayer(props: Partial<Parameters<typeof MarkupCanvasLayer>[0]> = {}) {
  const onCreate = vi.fn();
  const onSelect = vi.fn();
  const onMove = vi.fn();
  const onPinTap = vi.fn();
  render(
    <svg>
      <MarkupCanvasLayer
        marks={props.marks ?? []}
        size={SIZE}
        page={1}
        tool={props.tool ?? "ellipse"}
        style={{ color: "#ef4444", strokeWidth: 0.005, opacity: 1 }}
        selectedId={props.selectedId ?? null}
        readOnly={props.readOnly}
        onSelect={onSelect}
        onCreate={onCreate}
        onMove={onMove}
        onPinTap={onPinTap}
      />
    </svg>,
  );
  return { onCreate, onSelect, onMove, onPinTap, layer: screen.getByTestId("markup-canvas-layer") };
}

beforeEach(() => {
  // The layer normalizes pointer coords against its bounding rect.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: SIZE.width,
    height: SIZE.height,
    right: SIZE.width,
    bottom: SIZE.height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MarkupCanvasLayer", () => {
  it("creates an ellipse from a drag with normalized geometry", () => {
    const { onCreate } = renderLayer({ tool: "ellipse" });
    const layer = screen.getByTestId("markup-canvas-layer");

    fireEvent.pointerDown(layer, { clientX: 100, clientY: 100, pointerId: 1, isPrimary: true });
    fireEvent.pointerMove(layer, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(layer, { clientX: 500, clientY: 300, pointerId: 1 });

    expect(onCreate).toHaveBeenCalledTimes(1);
    const mark: Mark = onCreate.mock.calls[0][0];
    expect(mark.kind).toBe("ELLIPSE");
    const g = mark.geometry as { x: number; y: number; w: number; h: number };
    expect(g.x).toBeCloseTo(0.1);
    expect(g.y).toBeCloseTo(0.2);
    expect(g.w).toBeCloseTo(0.4);
    expect(g.h).toBeCloseTo(0.4);
  });

  it("creates a pin on tap and selects it", () => {
    const { onCreate, onSelect } = renderLayer({ tool: "pin" });
    const layer = screen.getByTestId("markup-canvas-layer");

    fireEvent.pointerDown(layer, { clientX: 250, clientY: 250, pointerId: 1, isPrimary: true });

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].kind).toBe("PIN");
    expect(onCreate.mock.calls[0][0].geometry).toMatchObject({ x: 0.25, y: 0.5 });
    expect(onSelect).toHaveBeenCalled();
  });

  it("ignores a tiny (accidental) shape drag", () => {
    const { onCreate } = renderLayer({ tool: "cloud" });
    const layer = screen.getByTestId("markup-canvas-layer");

    fireEvent.pointerDown(layer, { clientX: 200, clientY: 200, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(layer, { clientX: 202, clientY: 201, pointerId: 1 });

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("reports pin taps in read-only mode instead of creating marks", () => {
    const pin: Mark = {
      id: "pin-1",
      fileId: "f",
      page: 1,
      kind: "PIN",
      geometry: { x: 0.25, y: 0.5 },
      style: { color: "#ef4444", strokeWidth: 0.005, opacity: 1 },
      text: "Note",
      sequence: 0,
      clientUpdatedAt: "2026-06-13T12:00:00.000Z",
    };
    const { onCreate, onPinTap } = renderLayer({ tool: "select", readOnly: true, marks: [pin] });
    const layer = screen.getByTestId("markup-canvas-layer");

    fireEvent.pointerDown(layer, { clientX: 250, clientY: 250, pointerId: 1, isPrimary: true });

    expect(onCreate).not.toHaveBeenCalled();
    expect(onPinTap).toHaveBeenCalledWith(expect.objectContaining({ id: "pin-1" }));
  });
});
