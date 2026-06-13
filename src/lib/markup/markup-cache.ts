"use client";

// Best-effort IndexedDB cache of a file's marks so the marked-up view still
// works offline. Separate from the offline sync queue DB to avoid coupling
// schema versions. All operations are guarded and swallow errors — the cache
// is an optimization, never a source of truth.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Mark } from "./types";

const DB_NAME = "jobbinder-markup-cache-v1";
const STORE = "marks";

interface MarkupCacheDb extends DBSchema {
  [STORE]: { key: string; value: { fileId: string; marks: Mark[]; updatedAt: string } };
}

let dbPromise: Promise<IDBPDatabase<MarkupCacheDb>> | null = null;

function isAvailable() {
  return typeof indexedDB !== "undefined";
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MarkupCacheDb>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "fileId" });
      },
    });
  }
  return dbPromise;
}

export async function cacheMarks(fileId: string, marks: Mark[]): Promise<void> {
  if (!isAvailable()) return;
  try {
    const db = await getDb();
    await db.put(STORE, { fileId, marks, updatedAt: new Date().toISOString() });
  } catch {
    // Caching is best-effort.
  }
}

export async function readCachedMarks(fileId: string): Promise<Mark[] | null> {
  if (!isAvailable()) return null;
  try {
    const db = await getDb();
    const row = await db.get(STORE, fileId);
    return row?.marks ?? null;
  } catch {
    return null;
  }
}
