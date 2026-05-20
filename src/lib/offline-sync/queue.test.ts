// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearOfflineQueueForTests,
  enqueueOfflineFile,
  enqueueOfflineNote,
  listOfflineQueue,
  removeOfflineQueueItem,
  updateOfflineQueueItem,
} from "./queue";

describe("offline sync queue", () => {
  afterEach(async () => {
    await clearOfflineQueueForTests();
  });

  it("stores queue items in capture order with mutation ids and pending status", async () => {
    const note = await enqueueOfflineNote({
      jobId: "job-1",
      type: "GENERAL",
      content: "Customer asked to document the wall opening.",
      category: "Customer Documents",
      statusTag: null,
    });

    const file = await enqueueOfflineFile({
      jobId: "job-1",
      originalName: "before.jpg",
      name: "Kitchen before",
      contentType: "image/jpeg",
      category: "Before",
      blob: new Blob(["image-data"], { type: "image/jpeg" }),
    });

    const items = await listOfflineQueue();

    expect(items.map((item) => item.id)).toEqual([note.id, file.id]);
    expect(items[0]).toMatchObject({
      kind: "NOTE_CREATE",
      status: "PENDING",
      attempts: 0,
      lastError: null,
      jobId: "job-1",
    });
    expect(items[0].clientMutationId).toMatch(/^offline-/);
    expect(items[1]).toMatchObject({
      kind: "FILE_UPLOAD",
      status: "PENDING",
      attempts: 0,
      lastError: null,
    });
  });

  it("persists file blobs and supports failed-state updates and removal", async () => {
    const queued = await enqueueOfflineFile({
      jobId: null,
      originalName: "permit.pdf",
      name: "",
      contentType: "application/pdf",
      category: "Permits",
      blob: new Blob(["pdf-data"], { type: "application/pdf" }),
    });

    await updateOfflineQueueItem(queued.id, {
      status: "FAILED",
      attempts: 1,
      lastError: "Network unavailable",
    });

    const [failed] = await listOfflineQueue();

    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("Network unavailable");
    expect(failed.kind).toBe("FILE_UPLOAD");
    if (failed.kind !== "FILE_UPLOAD") throw new Error("expected file upload item");
    expect(await failed.payload.blob.text()).toBe("pdf-data");

    await removeOfflineQueueItem(queued.id);

    expect(await listOfflineQueue()).toEqual([]);
  });
});
