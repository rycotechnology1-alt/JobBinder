// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

const offlineQueueMocks = vi.hoisted(() => ({
  listOfflineQueue: vi.fn(),
  removeOfflineQueueItem: vi.fn(),
  syncAllQueuedItems: vi.fn(),
}));

vi.mock("@/lib/offline-sync/queue", () => ({
  OFFLINE_QUEUE_CHANGED_EVENT: "jobbinder-offline-queue-changed",
  listOfflineQueue: offlineQueueMocks.listOfflineQueue,
  removeOfflineQueueItem: offlineQueueMocks.removeOfflineQueueItem,
}));

vi.mock("@/lib/offline-sync/sync-runner", () => ({
  syncAllQueuedItems: offlineQueueMocks.syncAllQueuedItems,
}));

describe("SyncStatusIndicator", () => {
  beforeEach(() => {
    offlineQueueMocks.listOfflineQueue.mockResolvedValue([
      {
        id: "queued-1",
        kind: "NOTE_CREATE",
        status: "PENDING",
        attempts: 0,
        lastError: null,
        createdAt: "2026-05-14T12:00:00.000Z",
        payload: { content: "Offline note" },
      },
      {
        id: "queued-2",
        kind: "FILE_UPLOAD",
        status: "FAILED",
        attempts: 1,
        lastError: "Upload failed",
        createdAt: "2026-05-14T12:01:00.000Z",
        payload: { originalName: "permit.pdf" },
      },
    ]);
    offlineQueueMocks.removeOfflineQueueItem.mockResolvedValue(undefined);
    offlineQueueMocks.syncAllQueuedItems.mockResolvedValue({ synced: 0, failed: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("shows offline and queued/failed counts with retry controls", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const user = userEvent.setup();

    render(<SyncStatusIndicator />);

    expect(await screen.findByRole("button", { name: /Offline, 2 pending sync items, 1 failed/i })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Offline/i }));

    expect(screen.getByText("Pending sync")).toBeTruthy();
    expect(screen.getByText("Offline note")).toBeTruthy();
    expect(screen.getByText("permit.pdf")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Retry sync" }));

    await waitFor(() => {
      expect(offlineQueueMocks.syncAllQueuedItems).toHaveBeenCalled();
    });
  });
});
