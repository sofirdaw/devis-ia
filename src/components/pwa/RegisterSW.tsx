"use client";

import { useEffect } from "react";
import { initAutoSync } from "@/lib/offline-sync";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Inscription du Service Worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log(" Service Worker Devis IA enregistré avec succès:", reg.scope);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn(" Échec d'enregistrement du Service Worker:", err);
          }
        });

      // Initialiser la synchronisation automatique
      initAutoSync();
    }
  }, []);

  return null;
}
