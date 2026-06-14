"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CloudOff, RefreshCcw, Trash2, UploadCloud, Wifi } from "lucide-react";
import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  listOfflineQueue,
  removeOfflineQueueItem,
} from "@/lib/offline-sync/queue";
import { syncAllQueuedItems } from "@/lib/offline-sync/sync-runner";
import type { OfflineQueueItem } from "@/lib/offline-sync/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

function summarizeItem(item: OfflineQueueItem) {
  if (item.kind === "NOTE_CREATE") return item.payload.content;
  if (item.kind === "DAILY_REPORT_CREATE") return item.payload.workPerformed;
  if (item.kind === "TASK_CREATE") return item.payload.title;
  if (item.kind === "MARKUP_SAVE") {
    const count = item.payload.mutations.length;
    return `${count} markup change${count === 1 ? "" : "s"}`;
  }
  return item.payload.originalName;
}

function itemTypeLabel(item: OfflineQueueItem) {
  if (item.kind === "NOTE_CREATE") return item.payload.type === "PROGRESS" ? "Progress" : "Note";
  if (item.kind === "DAILY_REPORT_CREATE") return "Daily report";
  if (item.kind === "TASK_CREATE") return item.payload.type === "PUNCH_LIST" ? "Punch list" : "Task";
  if (item.kind === "MARKUP_SAVE") return "Markup";
  return "File";
}

export function SyncStatusIndicator() {
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueue = useCallback(async () => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setItems(await listOfflineQueue());
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refreshQueue);

    window.addEventListener("online", refreshQueue);
    window.addEventListener("offline", refreshQueue);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshQueue);

    return () => {
      window.removeEventListener("online", refreshQueue);
      window.removeEventListener("offline", refreshQueue);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, refreshQueue);
    };
  }, [refreshQueue]);

  const failedCount = items.filter((item) => item.status === "FAILED").length;
  const queuedCount = items.length;
  const label = useMemo(() => {
    if (!isOnline) return "Offline";
    if (isSyncing) return "Syncing";
    if (failedCount > 0) return "Sync issue";
    if (queuedCount > 0) return `${queuedCount} pending`;
    return "Synced";
  }, [failedCount, isOnline, isSyncing, queuedCount]);

  const Icon = !isOnline ? CloudOff : failedCount > 0 ? AlertCircle : queuedCount > 0 || isSyncing ? UploadCloud : Wifi;

  async function retrySync() {
    setIsSyncing(true);
    try {
      await syncAllQueuedItems();
      await refreshQueue();
    } finally {
      setIsSyncing(false);
    }
  }

  async function removeItem(id: string) {
    await removeOfflineQueueItem(id);
    await refreshQueue();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors",
          !isOnline || failedCount > 0
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
            : queuedCount > 0 || isSyncing
              ? "border-brand/30 bg-brand/10 text-brand-light"
              : "border-zinc-800 bg-zinc-900/50 text-zinc-400",
        )}
        aria-label={`${label}, ${queuedCount} pending sync items, ${failedCount} failed`}
      >
        <Icon size={15} />
        <span className="hidden sm:inline">{label}</span>
        {queuedCount > 0 && <span>{queuedCount}</span>}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Pending sync">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">
              {queuedCount === 0
                ? "All offline captures have synced."
                : `${queuedCount} item${queuedCount === 1 ? "" : "s"} waiting to sync.`}
            </p>
            <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={retrySync} disabled={isSyncing}>
              <RefreshCcw size={15} />
              Retry sync
            </Button>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{itemTypeLabel(item)}</p>
                      <p className="mt-1 truncate text-sm font-medium text-zinc-200">{summarizeItem(item)}</p>
                      {item.lastError && <p className="mt-1 text-xs text-red-400">{item.lastError}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${summarizeItem(item)}`}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
