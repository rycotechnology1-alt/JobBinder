// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileViewerOverlay } from "./FileViewerOverlay";

const docxPreviewMocks = vi.hoisted(() => ({
  renderAsync: vi.fn(async (_document: ArrayBuffer, bodyContainer: HTMLElement) => {
    const page = document.createElement("section");
    page.textContent = "Rendered DOCX preview";
    page.getBoundingClientRect = () => ({
      width: 720,
      height: 1000,
      top: 0,
      right: 720,
      bottom: 1000,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    bodyContainer.appendChild(page);
  }),
}));

vi.mock("docx-preview", () => docxPreviewMocks);

describe("FileViewerOverlay", () => {
  beforeEach(() => {
    docxPreviewMocks.renderAsync.mockClear();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getMockRect(this: HTMLElement) {
      if (this.dataset.testid === "docx-preview-viewport") {
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
        };
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
      };
    });
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

  it("opens DOCX pages fit to the mobile viewport width", async () => {
    render(<FileViewerOverlay fileId="file-1" isOpen onClose={vi.fn()} />);

    expect(await screen.findByText("Rendered DOCX preview")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("docx-preview-document").style.transform).toBe("scale(0.5)");
    });
    expect(screen.getByTestId("docx-preview-frame").style.width).toBe("360px");
    expect(screen.getByTestId("docx-preview-frame").style.height).toBe("500px");
  });
});
