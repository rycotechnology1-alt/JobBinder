// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mark } from "@/lib/markup/types";
import { MarkedUpView } from "./MarkedUpView";

const pin: Mark = {
  id: "pin-1",
  fileId: "file-1",
  page: 1,
  kind: "PIN",
  geometry: { x: 0.5, y: 0.5 },
  style: { color: "#ef4444", strokeWidth: 0.004, opacity: 1 },
  text: "Missing caulk at sill",
  sequence: 0,
  clientUpdatedAt: "2026-06-15T12:00:00.000Z",
  attachments: [
    {
      id: "file-pin-1",
      type: "PHOTO",
      originalName: "sill.jpg",
      name: null,
      category: "Issue",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      createdAt: "2026-06-15T12:05:00.000Z",
    },
  ],
  task: {
    id: "task-1",
    title: "Fix sill caulk",
    status: "OPEN",
    type: "TASK",
    dueDate: null,
  },
};

vi.mock("@/lib/markup/useMarkupStore", () => ({
  useMarkupStore: () => ({
    marks: [pin],
    status: "ready",
    error: null,
    pendingCount: 0,
    upsertMark: vi.fn(),
    deleteMark: vi.fn(),
    reload: vi.fn(),
    flushNow: vi.fn(),
  }),
}));

vi.mock("./useMarkupViewport", () => ({
  useMarkupViewport: () => ({
    viewportRef: { current: null },
    contentRef: { current: null },
    contentStyle: {},
    viewScale: 1,
    rasterScale: 1,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitToScreen: vi.fn(),
    pointerHandlers: {},
  }),
}));

vi.mock("./PageSurface", () => ({
  PageSurface: ({ children }: { children: (size: { width: number; height: number }) => React.ReactNode }) => (
    <div>{children({ width: 600, height: 800 })}</div>
  ),
}));

vi.mock("./MarkupCanvasLayer", () => ({
  MarkupCanvasLayer: ({ marks, onPinTap }: { marks: Mark[]; onPinTap?: (mark: Mark) => void }) => (
    <button type="button" onClick={() => onPinTap?.(marks[0])}>
      Open pin
    </button>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("MarkedUpView", () => {
  it("shows pin attachments and linked task status in the pin panel", async () => {
    const user = userEvent.setup();
    render(<MarkedUpView fileId="file-1" src="/file.pdf" mode="pdf" onEdit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Open pin" }));

    expect(screen.getByText("Missing caulk at sill")).toBeTruthy();
    expect(screen.getByText("sill.jpg")).toBeTruthy();
    expect(screen.getByText("Fix sill caulk")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
  });
});
