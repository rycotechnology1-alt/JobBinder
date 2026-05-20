"use client";

import { useCallback, useEffect, useRef } from "react";
import { syncAllQueuedItems } from "@/lib/offline-sync/sync-runner";

export function OfflineSyncProvider() {
  const isSyncingRef = useRef(false);

  const runSync = useCallback(async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    isSyncingRef.current = true;
    try {
      await syncAllQueuedItems();
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("online", runSync);
    window.addEventListener("focus", runSync);
    document.addEventListener("visibilitychange", runSync);

    const intervalId = window.setInterval(runSync, 60_000);
    runSync();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(runSync).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", runSync);
      window.removeEventListener("focus", runSync);
      document.removeEventListener("visibilitychange", runSync);
      window.clearInterval(intervalId);
    };
  }, [runSync]);

  return null;
}
