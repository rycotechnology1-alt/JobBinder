// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePreview } from "./FilePreview";

vi.mock("@/components/FileViewerOverlay", () => ({
  FileViewerOverlay: ({
    fileId,
    isOpen,
    initialFilename,
  }: {
    fileId: string;
    isOpen: boolean;
    initialFilename?: string;
  }) => (
    isOpen ? (
      <div role="dialog" aria-label="File preview">
        Previewing {initialFilename ?? fileId}
      </div>
    ) : null
  ),
}));

vi.mock("@/components/markup/PageSurface", () => ({
  PageSurface: ({ mode }: { mode: "pdf" | "image" }) => (
    <div data-testid={`${mode}-thumbnail`}>Rendered {mode} thumbnail</div>
  ),
}));

describe("FilePreview", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens the file preview from the document thumbnail without rendering a View button", async () => {
    const user = userEvent.setup();

    render(
      <FilePreview
        fileId="file-1"
        type="DOCUMENT"
        filename="Permit Packet"
        category="Permits"
        contentType="application/pdf"
        renderMode="pdf"
      />,
    );

    expect(screen.getByText("Permit Packet")).toBeTruthy();
    expect(screen.getByText("Document")).toBeTruthy();
    expect(screen.getByText("Permits")).toBeTruthy();
    expect(screen.getByTestId("pdf-thumbnail")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Preview Permit Packet" }));

    expect(screen.getByRole("dialog", { name: "File preview" })).toBeTruthy();
    expect(screen.getByText("Previewing Permit Packet")).toBeTruthy();
  });

  it("renders image thumbnails for photo feed items", () => {
    render(
      <FilePreview
        fileId="photo-1"
        type="PHOTO"
        filename="before.jpg"
        category="Before"
        contentType="image/jpeg"
        renderMode="image"
      />,
    );

    expect(screen.getByRole("button", { name: "Preview before.jpg" })).toBeTruthy();
    expect(screen.getByAltText("before.jpg")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "View before.jpg" })).toBeNull();
  });

  it("renders type-specific thumbnails for non-PDF documents", () => {
    render(
      <FilePreview
        fileId="file-2"
        type="DOCUMENT"
        filename="Scope.docx"
        category="Customer Documents"
        contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        renderMode="docx"
      />,
    );

    expect(screen.getByText("DOCX")).toBeTruthy();
    expect(screen.getByText("Customer Documents")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Preview Scope.docx" })).toBeTruthy();
  });
});
