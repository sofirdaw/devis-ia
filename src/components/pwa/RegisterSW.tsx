"use client";

import { useEffect } from "react";
import { initAutoSync } from "@/lib/offline-sync";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    initAutoSync();
    if (!("serviceWorker" in navigator)) return;

    const reloadOnControllerChange = () => {
      if (!navigator.onLine || sessionStorage.getItem("devisia:sw-updated") === "true") return;
      sessionStorage.setItem("devisia:sw-updated", "true");
      window.location.reload();
    };
    sessionStorage.removeItem("devisia:sw-updated");
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);

    if (process.env.NODE_ENV === "development") {
      // En mode développement, désactiver et désenregistrer le Service Worker
      // pour éviter les boucles d'actualisation infinies et les conflits avec Turbopack HMR
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControllerChange);
      return;
    }

    // Inscription du Service Worker en production uniquement
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker Devis IA enregistré avec succès:", reg.scope);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.warn("Échec d'enregistrement du Service Worker:", err);
        }
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControllerChange);
    };
  }, []);

  return null;
}
