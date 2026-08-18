"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkRealConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch("/favicon.ico", {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setIsOnline(res.ok);
      } catch {
        setIsOnline(false);
      }
    };

    // Vérification initiale
    checkRealConnectivity();

    const handleOnline = () => {
      checkRealConnectivity();
    };

    const handleOffline = () => setIsOnline(false);

    const handleSyncStart = () => {
      setIsSyncing(true);
    };

    const handleSyncComplete = (e: Event) => {
      setIsSyncing(false);
      const customEvent = e as CustomEvent<{ syncedCount?: number }>;
      const count = customEvent.detail?.syncedCount || 0;
      if (count > 0) {
        setSyncMessage(`${count} document(s) synchronisé(s) !`);
        setTimeout(() => setSyncMessage(""), 4000);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pwa-sync-start", handleSyncStart);
    window.addEventListener("pwa-sync-complete", handleSyncComplete);

    // Vérification périodique toutes les 8 secondes
    const intervalId = setInterval(checkRealConnectivity, 8000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pwa-sync-start", handleSyncStart);
      window.removeEventListener("pwa-sync-complete", handleSyncComplete);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full border transition-all">
      {isSyncing ? (
        <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 border-blue-200 px-2 py-0.5 rounded-full animate-pulse">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          Synchro Cloud...
        </span>
      ) : isOnline ? (
        <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border-emerald-200 px-2 py-0.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          En ligne (Cloud)
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border-amber-200 px-2 py-0.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Mode Hors-ligne (Local)
        </span>
      )}

      {syncMessage && (
        <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full animate-bounce">
          {syncMessage}
        </span>
      )}
    </div>
  );
}
