"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

export function OfflineStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncOnlineState = () => {
      setIsOnline(navigator.onLine);
    };

    const handleSyncStart = () => setIsSyncing(true);
    const handleSyncComplete = () => setIsSyncing(false);

    syncOnlineState();
    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);
    window.addEventListener("pwa-sync-start", handleSyncStart);
    window.addEventListener("pwa-sync-complete", handleSyncComplete);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
      window.removeEventListener("pwa-sync-start", handleSyncStart);
      window.removeEventListener("pwa-sync-complete", handleSyncComplete);
    };
  }, []);

  if (isOnline && !isSyncing) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 top-3 z-[60] flex justify-center">
      <div
        className={[
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm",
          isSyncing
            ? "border-blue-200 bg-blue-50 text-blue-700"
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
          {isSyncing
            ? "Synchronisation en cours…"
            : isOnline
              ? "Connexion restaurée"
              : "Mode hors ligne actif — données locales disponibles"}
        </span>
      </div>
    </div>
  );
}
