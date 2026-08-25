"use client";

import { useEffect, useState } from "react";
import { CloudOff, CloudUpload } from "lucide-react";

export function OfflineActionNotice() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
      <CloudOff className="h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">Mode hors ligne actif</p>
        <p className="text-xs text-amber-700">
          Les données seront enregistrées localement et synchronisées automatiquement dès que la connexion revient.
        </p>
      </div>
      <CloudUpload className="h-4 w-4 shrink-0" />
    </div>
  );
}
