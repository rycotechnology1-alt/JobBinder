// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileViewerOverlay } from "./FileViewerOverlay";

describe("FileViewerOverlay", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            file: {
              id: "file-1",
              filename: "Deck",
              originalName: "deck.pptx",
              contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              renderMode: "office",
              originalUrl: "/api/files/file-1/content",
              downloadUrl: "/api/files/file-1/content?download=1",
              sizeBytes: 2048,
              category: "Plans",
            },
            previewArtifact: null,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            previewArtifact: {
              id: "artifact-1",
              status: "QUEUED",
              previewUrl: null,
              lastError: null,
            },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            file: {
              id: "file-1",
              filename: "Deck",
              originalName: "deck.pptx",
              contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              renderMode: "office",
              originalUrl: "/api/files/file-1/content",
              downloadUrl: "/api/files/file-1/content?download=1",
              sizeBytes: 2048,
              category: "Plans",
            },
            previewArtifact: {
              id: "artifact-1",
              status: "QUEUED",
              previewUrl: null,
              lastError: null,
            },
          }),
        } as Response),
    );
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "unset";
  });

  it("shows a manual generate action for office files without cached previews", async () => {
    const user = userEvent.setup();
    render(<FileViewerOverlay fileId="file-1" isOpen onClose={vi.fn()} />);

    expect(await screen.findByRole("dialog", { name: "File preview" })).toBeTruthy();
    expect(await screen.findByText("Preview not generated")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Generate Preview" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/files/file-1/preview", { method: "POST" });
    });
    expect(await screen.findByText("Preview queued")).toBeTruthy();
  });
});
