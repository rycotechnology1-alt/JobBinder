import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  OfflineFileQueueItem,
  OfflineNoteQueueItem,
  OfflineQueueItem,
  OfflineQueueStatus,
  OfflineTaskQueueItem,
  QueueOfflineFileInput,
  QueueOfflineNoteInput,
  QueueOfflineTaskInput,
} from "./types";

export const OFFLINE_DB_NAME = "jobbinder-offline-v1";
export const OFFLINE_QUEUE_STORE = "syncQueue";
export const OFFLINE_QUEUE_CHANGED_EVENT = "jobbinder-offline-queue-changed";
export const MAX_OFFLINE_FILE_SIZE_BYTES = 25 * 1024 * 1024;

type QueueUpdate = Partial<Pick<OfflineQueueItem, "status" | "attempts" | "lastError">>;
type StoredOfflineFileQueueItem = Omit<OfflineFileQueueItem, "payload"> & {
  payload: Omit<OfflineFileQueueItem["payload"], "blob"> & {
    blobData: ArrayBuffer;
    blobType: string;
  };
};
type StoredOfflineQueueItem = OfflineNoteQueueItem | OfflineTaskQueueItem | StoredOfflineFileQueueItem;

interface OfflineSyncDatabase extends DBSchema {
  [OFFLINE_QUEUE_STORE]: {
    key: string;
    value: StoredOfflineQueueItem;
    indexes: {
      "by-createdAt": string;
      "by-status": OfflineQueueStatus;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSyncDatabase>> | null = null;
const blobCache = new Map<string, Blob>();

function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineSyncDatabase>(OFFLINE_DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
          const store = db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
          store.createIndex("by-status", "status");
        }
      },
    });
  }

  return dbPromise;
}

function createId() {
  const randomId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `offline-${randomId}`;
}

function notifyQueueChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
  }
}

async function serializeQueueItem(item: OfflineQueueItem): Promise<StoredOfflineQueueItem> {
  if (item.kind !== "FILE_UPLOAD") return item;

  blobCache.set(item.id, item.payload.blob);
  return {
    ...item,
    payload: {
      originalName: item.payload.originalName,
      name: item.payload.name,
      contentType: item.payload.contentType,
      category: item.payload.category,
      blobType: item.payload.blob.type,
      blobData: await item.payload.blob.arrayBuffer(),
    },
  };
}

function deserializeQueueItem(item: StoredOfflineQueueItem): OfflineQueueItem {
  if (item.kind !== "FILE_UPLOAD") return item;

  const cachedBlob = blobCache.get(item.id);
  return {
    ...item,
    payload: {
      originalName: item.payload.originalName,
      name: item.payload.name,
      contentType: item.payload.contentType,
      category: item.payload.category,
      blob: cachedBlob ?? new Blob([item.payload.blobData], { type: item.payload.contentType || item.payload.blobType }),
    },
  };
}

async function addQueueItem<T extends OfflineQueueItem>(item: T) {
  const db = await getDatabase();
  await db.put(OFFLINE_QUEUE_STORE, await serializeQueueItem(item));
  notifyQueueChanged();
  return item;
}

function baseQueueItem(kind: OfflineQueueItem["kind"], jobId?: string | null) {
  return {
    id: createId(),
    clientMutationId: createId(),
    kind,
    createdAt: new Date().toISOString(),
    jobId: jobId ?? null,
    status: "PENDING" as const,
    attempts: 0,
    lastError: null,
  };
}

export async function enqueueOfflineNote(input: QueueOfflineNoteInput): Promise<OfflineNoteQueueItem> {
  const item: OfflineNoteQueueItem = {
    ...baseQueueItem("NOTE_CREATE", input.jobId),
    kind: "NOTE_CREATE",
    payload: {
      type: input.type,
      content: input.content,
      category: input.category ?? null,
      statusTag: input.statusTag ?? null,
    },
  };

  return addQueueItem(item);
}

export async function enqueueOfflineTask(input: QueueOfflineTaskInput): Promise<OfflineTaskQueueItem> {
  const item: OfflineTaskQueueItem = {
    ...baseQueueItem("TASK_CREATE", input.jobId),
    kind: "TASK_CREATE",
    payload: {
      title: input.title,
      description: input.description ?? "",
      type: input.type ?? "TASK",
      dueDate: input.dueDate ?? "",
    },
  };

  return addQueueItem(item);
}

export async function enqueueOfflineFile(input: QueueOfflineFileInput): Promise<OfflineFileQueueItem> {
  if (input.blob.size > MAX_OFFLINE_FILE_SIZE_BYTES) {
    throw new Error("Files larger than 25 MB need an internet connection to upload.");
  }

  const item: OfflineFileQueueItem = {
    ...baseQueueItem("FILE_UPLOAD", input.jobId),
    kind: "FILE_UPLOAD",
    payload: {
      originalName: input.originalName,
      name: input.name ?? "",
      contentType: input.contentType,
      category: input.category,
      blob: input.blob,
    },
  };

  return addQueueItem(item);
}

export const queueOfflineNote = enqueueOfflineNote;
export const queueOfflineTask = enqueueOfflineTask;
export const queueOfflineFile = enqueueOfflineFile;

export async function listOfflineQueue() {
  const db = await getDatabase();
  const items = await db.getAllFromIndex(OFFLINE_QUEUE_STORE, "by-createdAt");
  return items
    .map(deserializeQueueItem)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function updateOfflineQueueItem(id: string, patch: QueueUpdate) {
  const db = await getDatabase();
  const storedItem = await db.get(OFFLINE_QUEUE_STORE, id);
  const item = storedItem ? deserializeQueueItem(storedItem) : null;
  if (!item) return null;

  const updated = { ...item, ...patch } as OfflineQueueItem;
  await db.put(OFFLINE_QUEUE_STORE, await serializeQueueItem(updated));
  notifyQueueChanged();
  return updated;
}

export async function removeOfflineQueueItem(id: string) {
  const db = await getDatabase();
  await db.delete(OFFLINE_QUEUE_STORE, id);
  blobCache.delete(id);
  notifyQueueChanged();
}

export async function clearOfflineQueueForTests() {
  const db = await getDatabase();
  db.close();
  dbPromise = null;
  blobCache.clear();
  await deleteDB(OFFLINE_DB_NAME);
}
