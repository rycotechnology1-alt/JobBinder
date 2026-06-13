// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOfflineQueueForTests,
  enqueueOfflineFile,
  enqueueOfflineMarkup,
  enqueueOfflineNote,
  enqueueOfflineTask,
  listOfflineQueue,
} from "./queue";
import { syncNextQueuedItem } from "./sync-runner";
import type { MarkMutation } from "@/lib/markup/types";

describe("offline sync runner", () => {
  beforeEach(async () => {
    await clearOfflineQueueForTests();
  });

  afterEach(async () => {
    await clearOfflineQueueForTests();
  });

  it("flushes a queued note with clientMutationId and original capture timestamp", async () => {
    const queued = await enqueueOfflineNote({
      jobId: "job-1",
      type: "PROGRESS",
      content: "Installed conduit.",
      category: "Completed Work",
      statusTag: "Rough-in complete",
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "note-1" }),
    });

    await expect(syncNextQueuedItem({ fetchImpl })).resolves.toEqual({
      status: "synced",
      itemId: queued.id,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jobId: "job-1",
          type: "PROGRESS",
          content: "Installed conduit.",
          category: "Completed Work",
          statusTag: "Rough-in complete",
          createdAt: queued.createdAt,
          clientMutationId: queued.clientMutationId,
        }),
      }),
    );
    expect(await listOfflineQueue()).toEqual([]);
  });

  it("flushes a queued task with clientMutationId and original capture timestamp", async () => {
    const queued = await enqueueOfflineTask({
      jobId: "job-1",
      title: "Finish trim",
      description: "North wall",
      type: "PUNCH_LIST",
      dueDate: "2026-06-15",
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "task-1" }),
    });

    await syncNextQueuedItem({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/tasks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jobId: "job-1",
          title: "Finish trim",
          description: "North wall",
          type: "PUNCH_LIST",
          dueDate: "2026-06-15",
          createdAt: queued.createdAt,
          clientMutationId: queued.clientMutationId,
        }),
      }),
    );
    expect(await listOfflineQueue()).toEqual([]);
  });

  it("uploads queued files through presign, R2 PUT, and file record creation", async () => {
    const queued = await enqueueOfflineFile({
      jobId: "job-1",
      originalName: "before.jpg",
      name: "Before cabinet",
      contentType: "image/jpeg",
      category: "Before",
      blob: new Blob(["image"], { type: "image/jpeg" }),
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: "https://r2.test/upload", objectKey: "company/file.jpg" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "file-1" }) });

    await syncNextQueuedItem({ fetchImpl });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/files/upload-url",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          filename: "before.jpg",
          contentType: "image/jpeg",
        }),
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://r2.test/upload",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: queued.payload.blob,
      }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/files",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          jobId: "job-1",
          objectKey: "company/file.jpg",
          originalName: "before.jpg",
          name: "Before cabinet",
          contentType: "image/jpeg",
          sizeBytes: queued.payload.blob.size,
          category: "Before",
          createdAt: queued.createdAt,
          clientMutationId: queued.clientMutationId,
        }),
      }),
    );
    expect(await listOfflineQueue()).toEqual([]);
  });

  it("keeps failed uploads queued with error details", async () => {
    const queued = await enqueueOfflineFile({
      jobId: null,
      originalName: "permit.pdf",
      name: "",
      contentType: "application/pdf",
      category: "Permits",
      blob: new Blob(["pdf"], { type: "application/pdf" }),
    });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Could not create upload URL." }),
    });

    await expect(syncNextQueuedItem({ fetchImpl })).resolves.toEqual({
      status: "failed",
      itemId: queued.id,
      error: "Could not create upload URL.",
    });

    const [failed] = await listOfflineQueue();
    expect(failed).toMatchObject({
      id: queued.id,
      status: "FAILED",
      attempts: 1,
      lastError: "Could not create upload URL.",
    });
  });

  it("replays queued markup as a mutations batch to the file markup endpoint", async () => {
    const mutations: MarkMutation[] = [
      {
        op: "upsert",
        mark: {
          id: "mark-1",
          fileId: "",
          page: 1,
          kind: "PIN",
          geometry: { x: 0.5, y: 0.5 },
          style: { color: "#ef4444", strokeWidth: 0.004, opacity: 1 },
          sequence: 0,
          clientUpdatedAt: "2026-06-13T12:00:00.000Z",
        },
      },
      { op: "delete", id: "mark-2", clientUpdatedAt: "2026-06-13T12:01:00.000Z" },
    ];
    await enqueueOfflineMarkup({ fileId: "file-1", mutations });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await syncNextQueuedItem({ fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/files/file-1/markup",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ mutations }) }),
    );
    expect(await listOfflineQueue()).toEqual([]);
  });
});
