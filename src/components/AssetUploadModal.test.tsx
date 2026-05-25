// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetUploadModal } from "./AssetUploadModal";

const refresh = vi.fn();
const offlineQueueMocks = vi.hoisted(() => ({
  queueOfflineFile: vi.fn(),
}));
const scanicProviderMocks = vi.hoisted(() => ({
  openScanner: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/lib/offline-sync/queue", () => ({
  queueOfflineFile: offlineQueueMocks.queueOfflineFile,
}));

vi.mock("@/features/uploads/scanner-scanic/scanicProvider", () => ({
  registerScanicScannerLauncher: vi.fn(() => vi.fn()),
  scanicScannerProvider: scanicProviderMocks,
}));

vi.mock("@/features/uploads/scanner-scanic/ScanicScannerHost", () => ({
  ScanicScannerHost: () => null,
}));

describe("AssetUploadModal", () => {
  beforeEach(() => {
    refresh.mockClear();
    offlineQueueMocks.queueOfflineFile.mockReset();
    offlineQueueMocks.queueOfflineFile.mockResolvedValue({ id: "queued-file" });
    scanicProviderMocks.openScanner.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("queues a selected file while offline instead of requesting a presigned upload URL", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AssetUploadModal isOpen onClose={onClose} jobId="job-1" title="Upload" />);

    const file = new File(["pdf"], "permit.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText("Photo or document") as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);
    await user.type(screen.getByLabelText("Display Name"), "Permit packet");
    await user.selectOptions(screen.getByLabelText("Category"), "Permits");
    fireEvent.submit(fileInput.closest("form")!);

    await waitFor(() => {
      expect(offlineQueueMocks.queueOfflineFile).toHaveBeenCalledWith({
        jobId: "job-1",
        originalName: "permit.pdf",
        name: "Permit packet",
        contentType: "application/pdf",
        category: "Permits",
        blob: file,
      });
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("retries through the same-origin relay when the R2 upload rejects while online", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/files/upload-url")) {
        return new Response(
          JSON.stringify({ uploadUrl: "https://r2.example.com/upload", objectKey: "key-1", fileId: "id-1" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/files/upload-body")) {
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual({
          "Content-Type": "application/pdf",
          "X-Object-Key": "key-1",
        });
        expect(init?.body).toBe(file);
        return new Response(null, { status: 204 });
      }
      if (url.includes("/api/files")) {
        return new Response(JSON.stringify({ id: "file-1" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new TypeError("Load failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AssetUploadModal isOpen onClose={onClose} jobId="job-1" title="Upload" />);

    const file = new File(["pdf"], "permit.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText("Photo or document") as HTMLInputElement;
    Object.defineProperty(fileInput, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(fileInput);
    await user.selectOptions(screen.getByLabelText("Category"), "Permits");
    fireEvent.submit(fileInput.closest("form")!);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });
    expect(offlineQueueMocks.queueOfflineFile).not.toHaveBeenCalled();
    expect(screen.queryByText(/load failed/i)).toBeNull();
  });

  it("uploads the PDF returned by the Scanic scanner provider with scan metadata", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    const scannedFile = new File(["pdf"], "scan.pdf", { type: "application/pdf" });
    scanicProviderMocks.openScanner.mockResolvedValue({
      file: scannedFile,
      pageCount: 2,
      source: "scan",
      metadata: {
        scannerProvider: "scanic",
        detectionMode: "live",
      },
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/files/upload-url")) {
        return new Response(
          JSON.stringify({ uploadUrl: "https://r2.example.com/upload", objectKey: "company/file.pdf" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("https://r2.example.com/upload")) {
        expect(init?.body).toBe(scannedFile);
        return new Response(null, { status: 200 });
      }
      if (url.includes("/api/files")) {
        return new Response(JSON.stringify({ id: "file-1" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AssetUploadModal isOpen onClose={onClose} jobId="job-1" title="Upload" />);

    await user.click(screen.getByRole("button", { name: /scan document/i }));
    await user.selectOptions(screen.getByLabelText("Category"), "Permits");
    await user.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledOnce();
    });

    expect(scanicProviderMocks.openScanner).toHaveBeenCalledWith({
      maxPages: 20,
      defaultFileName: "Scanned Document",
    });
    const fileRecordCall = fetchMock.mock.calls.find(([input]) => input.toString() === "/api/files");
    expect(JSON.parse(fileRecordCall?.[1]?.body as string)).toMatchObject({
      jobId: "job-1",
      originalName: "scan.pdf",
      contentType: "application/pdf",
      category: "Permits",
      sourceType: "scan",
      scannedPageCount: 2,
      createdFromMobileCamera: true,
      scannerProvider: "scanic",
      detectionMode: "live",
    });
  });
});
