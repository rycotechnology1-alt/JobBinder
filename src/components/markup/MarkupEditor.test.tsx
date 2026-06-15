// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mark } from "@/lib/markup/types";
import { MarkupEditor } from "./MarkupEditor";

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
  attachments: [],
  task: null,
};

const storeMocks = vi.hoisted(() => ({
  marks: [] as Mark[],
  upsertMark: vi.fn(),
  deleteMark: vi.fn(),
  reload: vi.fn(async () => {}),
  flushNow: vi.fn(async () => {}),
}));

const uploadMocks = vi.hoisted(() => ({
  prepareClientUploadFile: vi.fn(async (file: File) => ({
    sourceFile: file,
    body: file,
    contentType: file.type,
  })),
  uploadFileRecord: vi.fn(async () => ({ id: "file-pin-1" })),
}));

vi.mock("@/lib/markup/useMarkupStore", () => ({
  useMarkupStore: () => ({
    marks: storeMocks.marks,
    status: "ready",
    error: null,
    pendingCount: 0,
    upsertMark: storeMocks.upsertMark,
    deleteMark: storeMocks.deleteMark,
    reload: storeMocks.reload,
    flushNow: storeMocks.flushNow,
  }),
}));

vi.mock("@/lib/uploads/client-upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/uploads/client-upload")>();
  return {
    ...actual,
    prepareClientUploadFile: uploadMocks.prepareClientUploadFile,
    uploadFileRecord: uploadMocks.uploadFileRecord,
  };
});

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
  MarkupCanvasLayer: ({ marks, onSelect }: { marks: Mark[]; onSelect: (id: string | null) => void }) => (
    <button type="button" onClick={() => onSelect(marks[0]?.id ?? null)}>
      Select pin
    </button>
  ),
}));

beforeEach(() => {
  storeMocks.marks = [{ ...pin }];
  storeMocks.upsertMark.mockClear();
  storeMocks.deleteMark.mockClear();
  storeMocks.reload.mockClear();
  storeMocks.flushNow.mockClear();
  uploadMocks.prepareClientUploadFile.mockClear();
  uploadMocks.uploadFileRecord.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "task-1" }),
    })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  document.body.innerHTML = "";
});

function renderEditor() {
  render(<MarkupEditor fileId="file-1" src="/file.pdf" mode="pdf" filename="Plan.pdf" onClose={vi.fn()} />);
}

describe("MarkupEditor pin panel", () => {
  it("uploads selected images to the active pin", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Select pin" }));
    const input = screen.getByLabelText("Attach image") as HTMLInputElement;
    const photo = new File(["photo"], "sill.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", {
      value: [photo],
      configurable: true,
    });
    fireEvent.change(input);

    await waitFor(() => {
      expect(uploadMocks.uploadFileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          markupMarkId: "pin-1",
          originalName: "sill.jpg",
          category: "Issue",
        }),
      );
    });
    expect(storeMocks.flushNow).toHaveBeenCalled();
    expect(storeMocks.reload).toHaveBeenCalled();
  });

  it("creates a linked task from the active pin after review", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole("button", { name: "Select pin" }));
    await user.click(screen.getByRole("button", { name: "Create task" }));
    await user.click(screen.getByRole("button", { name: "Create linked task" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/tasks",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceMarkupMarkId: "pin-1",
            title: "Missing caulk at sill",
            description: "Missing caulk at sill",
            type: "TASK",
            dueDate: "",
          }),
        }),
      );
    });
    expect(storeMocks.flushNow).toHaveBeenCalled();
    expect(storeMocks.reload).toHaveBeenCalled();
  });
});
