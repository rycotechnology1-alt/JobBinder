"use client";

// Client-side store for a file's markup. Holds the marks in React state,
// applies optimistic add/update/delete, and debounces saves into batched
// POSTs. Saves collapse repeated edits of the same mark id so only the latest
// goes to the server. Offline queueing is layered on in a later step via the
// injectable `save` function.

import { useCallback, useEffect, useRef, useState } from "react";
import { getMarkupUrl } from "@/lib/file-preview";
import { enqueueOfflineMarkup } from "@/lib/offline-sync/queue";
import { cacheMarks, readCachedMarks } from "./markup-cache";
import type { Mark, MarkMutation } from "./types";

type Status = "loading" | "ready" | "error";

export type MarkupStore = {
  marks: Mark[];
  status: Status;
  error: string | null;
  pendingCount: number;
  upsertMark: (mark: Mark) => void;
  deleteMark: (id: string) => void;
  reload: () => Promise<void>;
  flushNow: () => Promise<void>;
};

/** Persists a batch of mutations. Swapped for an offline-aware version later. */
export type SaveMutations = (fileId: string, mutations: MarkMutation[]) => Promise<void>;

const FLUSH_DELAY_MS = 600;

/**
 * Offline-aware save: POST when online; on no-connection / network failure /
 * server 5xx, enqueue for the background sync runner to replay later. Per-mark
 * last-write-wins on the server means replays merge cleanly. Client (4xx)
 * errors are surfaced rather than queued.
 */
export async function saveMarkupMutations(fileId: string, mutations: MarkMutation[]): Promise<void> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline) {
    await enqueueOfflineMarkup({ fileId, mutations });
    return;
  }

  let res: Response;
  try {
    res = await fetch(getMarkupUrl(fileId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mutations }),
    });
  } catch {
    await enqueueOfflineMarkup({ fileId, mutations });
    return;
  }

  if (res.ok) return;
  if (res.status >= 500) {
    await enqueueOfflineMarkup({ fileId, mutations });
    return;
  }
  throw new Error("Could not save markups.");
}

export function useMarkupStore(fileId: string | null, save: SaveMutations = saveMarkupMutations): MarkupStore {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const marksRef = useRef<Mark[]>([]);
  const pendingRef = useRef<Map<string, MarkMutation>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = useCallback(
    (next: Mark[]) => {
      marksRef.current = next;
      setMarks(next);
      if (fileId) void cacheMarks(fileId, next);
    },
    [fileId],
  );

  const reload = useCallback(async () => {
    if (!fileId) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(getMarkupUrl(fileId));
      if (!res.ok) throw new Error("Could not load markups.");
      const data = await res.json();
      commit(Array.isArray(data.marks) ? data.marks : []);
      setStatus("ready");
    } catch (loadError) {
      // Offline / fetch failed: fall back to the last cached marks so the
      // marked-up view still works without a connection.
      const cached = await readCachedMarks(fileId);
      if (cached) {
        marksRef.current = cached;
        setMarks(cached);
        setStatus("ready");
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Could not load markups.");
      setStatus("error");
    }
  }, [fileId, commit]);

  useEffect(() => {
    // Defer off the synchronous effect body (matches the file viewer pattern).
    queueMicrotask(() => void reload());
  }, [reload]);

  const flushNow = useCallback(async () => {
    if (!fileId) return;
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const batch = Array.from(pendingRef.current.values());
    if (batch.length === 0) return;
    pendingRef.current.clear();
    setPendingCount(0);
    try {
      await save(fileId, batch);
    } catch (saveError) {
      // Re-queue (without overwriting newer pending edits) so a later flush retries.
      for (const mutation of batch) {
        const id = mutation.op === "upsert" ? mutation.mark.id : mutation.id;
        if (!pendingRef.current.has(id)) pendingRef.current.set(id, mutation);
      }
      setPendingCount(pendingRef.current.size);
      setError(saveError instanceof Error ? saveError.message : "Could not save markups.");
    }
  }, [fileId, save]);

  const queue = useCallback(
    (mutation: MarkMutation) => {
      const id = mutation.op === "upsert" ? mutation.mark.id : mutation.id;
      pendingRef.current.set(id, mutation);
      setPendingCount(pendingRef.current.size);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flushNow(), FLUSH_DELAY_MS);
    },
    [flushNow],
  );

  const upsertMark = useCallback(
    (mark: Mark) => {
      const prev = marksRef.current;
      const idx = prev.findIndex((m) => m.id === mark.id);
      const clientUpdatedAt = new Date().toISOString();
      let stored: Mark;
      if (idx === -1) {
        const sequence = prev.reduce((max, m) => Math.max(max, m.sequence), 0) + 1;
        stored = { ...mark, sequence, clientUpdatedAt } as Mark;
        commit([...prev, stored]);
      } else {
        stored = { ...mark, sequence: prev[idx].sequence, clientUpdatedAt } as Mark;
        const next = prev.slice();
        next[idx] = stored;
        commit(next);
      }
      queue({ op: "upsert", mark: stored });
    },
    [commit, queue],
  );

  const deleteMark = useCallback(
    (id: string) => {
      const prev = marksRef.current;
      if (!prev.some((m) => m.id === id)) return;
      commit(prev.filter((m) => m.id !== id));
      queue({ op: "delete", id, clientUpdatedAt: new Date().toISOString() });
    },
    [commit, queue],
  );

  // Flush any pending edits when the editor closes or the file changes.
  useEffect(() => {
    return () => {
      void flushNow();
    };
  }, [flushNow]);

  return { marks, status, error, pendingCount, upsertMark, deleteMark, reload, flushNow };
}
