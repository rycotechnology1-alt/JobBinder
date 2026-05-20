// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetUploadModal } from "./AssetUploadModal";

const refresh = vi.fn();
const offlineQueueMocks = vi.hoisted(() => ({
  queueOfflineFile: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock("@/lib/offline-sync/queue", () => ({
  queueOfflineFile: offlineQueueMocks.queueOfflineFile,
}));

describe("AssetUploadModal", () => {
  beforeEach(() => {
    refresh.mockClear();
    offlineQueueMocks.queueOfflineFile.mockReset();
    offlineQueueMocks.queueOfflineFile.mockResolvedValue({ id: "queued-file" });
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
});
