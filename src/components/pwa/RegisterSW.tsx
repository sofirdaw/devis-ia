"use client";

import { useEffect } from "react";
import { initAutoSync } from "@/lib/offline-sync";

export function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      // En mode développement, désactiver et désenregistrer le Service Worker
      // pour éviter les boucles d'actualisation infinies et les conflits avec Turbopack HMR
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    // Inscription du Service Worker en production uniquement
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("Service Worker Devis IA enregistré avec succès:", reg.scope);

        // Pré-mise en cache en arrière-plan des routes principales après le chargement initial
        const coreRoutes = [
          "/dashboard",
          "/quotes",
          "/quotes/new",
          "/invoices",
          "/invoices/new",
          "/clients",
          "/products",
          "/suppliers",
          "/settings",
          "/receivables",
        ];

        setTimeout(() => {
          coreRoutes.forEach((route) => {
            fetch(route, { priority: "low" }).catch(() => {});
          });
        }, 2000);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.warn("Échec d'enregistrement du Service Worker:", err);
        }
      });

    // Initialiser la synchronisation automatique
    initAutoSync();
  }, []);

  return null;
}

