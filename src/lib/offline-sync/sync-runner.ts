import {
  listOfflineQueue,
  removeOfflineQueueItem,
  updateOfflineQueueItem,
} from "./queue";
import type { OfflineFileQueueItem, OfflineQueueItem } from "./types";

type FetchLike = typeof fetch;

type SyncResult =
  | { status: "idle" }
  | { status: "synced"; itemId: string }
  | { status: "failed"; itemId: string; error: string };

type SyncOptions = {
  fetchImpl?: FetchLike;
};

async function readError(response: Response) {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === "string") return payload.error;
  } catch {
    // Ignore non-JSON responses.
  }

  return "Sync request failed.";
}

async function postJson(fetchImpl: FetchLike, url: string, body: Record<string, unknown>) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}

async function syncNote(fetchImpl: FetchLike, item: OfflineQueueItem) {
  if (item.kind !== "NOTE_CREATE") return;

  await postJson(fetchImpl, "/api/notes", {
    jobId: item.jobId,
    type: item.payload.type,
    content: item.payload.content,
    category: item.payload.category,
    statusTag: item.payload.statusTag,
    createdAt: item.createdAt,
    clientMutationId: item.clientMutationId,
  });
}

async function syncTask(fetchImpl: FetchLike, item: OfflineQueueItem) {
  if (item.kind !== "TASK_CREATE") return;

  await postJson(fetchImpl, "/api/tasks", {
    jobId: item.jobId,
    title: item.payload.title,
    description: item.payload.description,
    type: item.payload.type,
    dueDate: item.payload.dueDate,
    createdAt: item.createdAt,
    clientMutationId: item.clientMutationId,
  });
}

async function syncFile(fetchImpl: FetchLike, item: OfflineFileQueueItem) {
  const uploadUrlPayload = await postJson(fetchImpl, "/api/files/upload-url", {
    filename: item.payload.originalName,
    contentType: item.payload.contentType,
  });

  const r2Response = await fetchImpl(uploadUrlPayload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": item.payload.contentType },
    body: item.payload.blob,
  });

  if (!r2Response.ok) {
    throw new Error("Cloudflare R2 upload failed.");
  }

  await postJson(fetchImpl, "/api/files", {
    jobId: item.jobId,
    objectKey: uploadUrlPayload.objectKey,
    originalName: item.payload.originalName,
    name: item.payload.name,
    contentType: item.payload.contentType,
    sizeBytes: item.payload.blob.size,
    category: item.payload.category,
    createdAt: item.createdAt,
    clientMutationId: item.clientMutationId,
  });
}

async function syncMarkup(fetchImpl: FetchLike, item: OfflineQueueItem) {
  if (item.kind !== "MARKUP_SAVE") return;

  await postJson(fetchImpl, `/api/files/${encodeURIComponent(item.payload.fileId)}/markup`, {
    mutations: item.payload.mutations,
  });
}

async function syncItem(fetchImpl: FetchLike, item: OfflineQueueItem) {
  if (item.kind === "NOTE_CREATE") return syncNote(fetchImpl, item);
  if (item.kind === "TASK_CREATE") return syncTask(fetchImpl, item);
  if (item.kind === "MARKUP_SAVE") return syncMarkup(fetchImpl, item);
  return syncFile(fetchImpl, item);
}

export async function syncNextQueuedItem({ fetchImpl = fetch }: SyncOptions = {}): Promise<SyncResult> {
  const [item] = (await listOfflineQueue()).filter((queueItem) => queueItem.status !== "SYNCING");

  if (!item) return { status: "idle" };

  await updateOfflineQueueItem(item.id, {
    status: "SYNCING",
    attempts: item.attempts + 1,
    lastError: null,
  });

  try {
    await syncItem(fetchImpl, item);
    await removeOfflineQueueItem(item.id);
    return { status: "synced", itemId: item.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await updateOfflineQueueItem(item.id, {
      status: "FAILED",
      attempts: item.attempts + 1,
      lastError: message,
    });
    return { status: "failed", itemId: item.id, error: message };
  }
}

export async function syncAllQueuedItems(options: SyncOptions = {}) {
  let synced = 0;
  let failed = 0;

  for (let index = 0; index < 25; index += 1) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break;

    const result = await syncNextQueuedItem(options);
    if (result.status === "idle") break;
    if (result.status === "synced") synced += 1;
    if (result.status === "failed") {
      failed += 1;
      break;
    }
  }

  return { synced, failed };
}
