// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileViewerOverlay } from "./FileViewerOverlay";

const docxPreviewMocks = vi.hoisted(() => ({
  renderAsync: vi.fn(async (_document: ArrayBuffer, bodyContainer: HTMLElement) => {
    bodyContainer.textContent = "Rendered DOCX preview";
  }),
}));

vi.mock("docx-preview", () => docxPreviewMocks);

describe("FileViewerOverlay", () => {
  beforeEach(() => {
    docxPreviewMocks.renderAsync.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/files/file-1/preview") {
          expect(init).toBeUndefined();
          return {
            ok: true,
            json: async () => ({
              file: {
                id: "file-1",
                filename: "Scope",
                originalName: "scope.docx",
                contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                renderMode: "docx",
                originalUrl: "/api/files/file-1/content",
                downloadUrl: "/api/files/file-1/content?download=1",
                sizeBytes: 2048,
                category: "Customer Documents",
              },
              previewArtifact: null,
            }),
          } as Response;
        }
        if (url === "/api/files/file-1/content") {
          expect(init).toBeUndefined();
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    document.body.style.overflow = "unset";
  });

  it("renders DOCX files from the authenticated same-origin content route", async () => {
    render(<FileViewerOverlay fileId="file-1" isOpen onClose={vi.fn()} />);

    expect(await screen.findByRole("dialog", { name: "File preview" })).toBeTruthy();
    expect(await screen.findByText("Rendered DOCX preview")).toBeTruthy();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/files/file-1/content");
    });
    expect(docxPreviewMocks.renderAsync).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.any(HTMLElement),
      expect.any(HTMLElement),
      expect.objectContaining({
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
      }),
    );
    expect(screen.queryByRole("button", { name: "Generate Preview" })).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith("/api/files/file-1/preview", { method: "POST" });
  });
});
