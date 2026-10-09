"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { syncPendingData } from "@/lib/offline-sync";

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncOnlineState = () => {
      setIsOnline(navigator.onLine);
    };

    const handleSyncStart = () => {
      setIsSyncing(true);
      setFailedCount(0);
    };
    const handleSyncComplete = (event: Event) => {
      setIsSyncing(false);
      const detail = (event as CustomEvent<{ failedCount?: number }>).detail;
      setFailedCount(detail?.failedCount ?? 0);
    };
    const handleSnapshotFailure = (event: Event) => {
      setSnapshotError((event as CustomEvent<string>).detail);
    };
    const handleSnapshotReady = () => setSnapshotError(null);

    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    window.addEventListener("pwa-sync-start", handleSyncStart);
    window.addEventListener("pwa-sync-complete", handleSyncComplete);
    window.addEventListener("pwa-offline-snapshot-failed", handleSnapshotFailure);
    window.addEventListener("pwa-offline-snapshot-ready", handleSnapshotReady);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
      window.removeEventListener("pwa-sync-start", handleSyncStart);
      window.removeEventListener("pwa-sync-complete", handleSyncComplete);
      window.removeEventListener("pwa-offline-snapshot-failed", handleSnapshotFailure);
      window.removeEventListener("pwa-offline-snapshot-ready", handleSnapshotReady);
    };
  }, []);

  if (isOnline && !isSyncing && failedCount === 0 && !snapshotError) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex justify-center">
      <div
        className={[
          "pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm",
          isSyncing
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : snapshotError || failedCount > 0
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
        ].join(" ")}
      >
        {isSyncing ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : isOnline ? (
          <Wifi className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        <span>
          {snapshotError
            ? snapshotError
            : isSyncing
              ? "Synchronisation en cours…"
              : failedCount > 0
                ? `${failedCount} opération${failedCount > 1 ? "s" : ""} en attente de synchronisation`
                : isOnline
                  ? "Connexion restaurée"
                  : "Mode hors ligne actif — données locales disponibles"}
        </span>
        {isOnline && snapshotError && (
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => window.dispatchEvent(new Event("pwa-snapshot-retry"))}
          >
            Réessayer
          </button>
        )}
        {isOnline && failedCount > 0 && !snapshotError && !isSyncing && (
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => syncPendingData()}
          >
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
}
