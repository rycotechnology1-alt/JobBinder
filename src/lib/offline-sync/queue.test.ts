// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearOfflineQueueForTests,
  enqueueOfflineDailyReport,
  enqueueOfflineFile,
  enqueueOfflineMarkup,
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

  it("queues markup mutations for later sync", async () => {
    const queued = await enqueueOfflineMarkup({
      fileId: "file-1",
      mutations: [{ op: "delete", id: "mark-1", clientUpdatedAt: "2026-06-13T12:00:00.000Z" }],
    });

    const [item] = await listOfflineQueue();
    expect(item).toMatchObject({ id: queued.id, kind: "MARKUP_SAVE", status: "PENDING", jobId: null });
    if (item.kind !== "MARKUP_SAVE") throw new Error("expected markup item");
    expect(item.payload.fileId).toBe("file-1");
    expect(item.payload.mutations).toHaveLength(1);
  });

  it("queues daily reports with multiple attachment blobs", async () => {
    const firstPhoto = new Blob(["photo-1"], { type: "image/jpeg" });
    const secondPhoto = new Blob(["photo-2"], { type: "image/jpeg" });

    const queued = await enqueueOfflineDailyReport({
      jobId: "job-1",
      reportDate: "2026-06-14",
      workPerformed: "Installed conduit.",
      materialsUsed: "2 EMT sticks",
      attachments: [
        {
          originalName: "photo-1.jpg",
          name: "Panel before",
          contentType: "image/jpeg",
          blob: firstPhoto,
        },
        {
          originalName: "photo-2.jpg",
          name: "",
          contentType: "image/jpeg",
          blob: secondPhoto,
        },
      ],
    });

    const [item] = await listOfflineQueue();

    expect(item).toMatchObject({
      id: queued.id,
      kind: "DAILY_REPORT_CREATE",
      jobId: "job-1",
      payload: {
        reportDate: "2026-06-14",
        workPerformed: "Installed conduit.",
        materialsUsed: "2 EMT sticks",
      },
    });
    if (item.kind !== "DAILY_REPORT_CREATE") throw new Error("expected daily report item");
    expect(item.payload.attachments).toHaveLength(2);
    expect(await item.payload.attachments[0].blob.text()).toBe("photo-1");
    expect(await item.payload.attachments[1].blob.text()).toBe("photo-2");
  });
});
