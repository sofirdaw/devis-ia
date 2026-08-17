/**
 * Moteur de synchronisation automatique avec Supabase Cloud lors du retour du réseau.
 */

import { getSyncQueue, removeFromSyncQueue, saveOfflineQuote } from "./offline-db";
import { createQuoteAction } from "@/app/actions/quotes";

let isSyncing = false;

export async function syncPendingData(): Promise<{ syncedCount: number }> {
  if (isSyncing || typeof window === "undefined" || !navigator.onLine) {
    return { syncedCount: 0 };
  }

  isSyncing = true;
  let syncedCount = 0;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      isSyncing = false;
      return { syncedCount: 0 };
    }

    // Émettre un événement de début de synchro
    window.dispatchEvent(new CustomEvent("pwa-sync-start"));

    for (const item of queue) {
      try {
        if (item.action === "CREATE_QUOTE") {
          const formData = new FormData();
          formData.append("client_id", item.payload.client_id || "");
          formData.append("discount", item.payload.discount || 0);
          formData.append("notes", item.payload.notes || "");
          formData.append("items", JSON.stringify(item.payload.items || []));

          const result = await createQuoteAction({}, formData);

          if (!result?.error) {
            // Marquer comme synchro localement
            if (item.payload.local_quote) {
              await saveOfflineQuote({
                ...item.payload.local_quote,
                sync_status: "synced",
              });
            }
            await removeFromSyncQueue(item.id);
            syncedCount++;
          }
        }
      } catch (err) {
        console.error("Erreur lors de la synchronisation de l'élément:", item, err);
      }
    }

    // Émettre l'événement de fin de synchro
    window.dispatchEvent(
      new CustomEvent("pwa-sync-complete", { detail: { syncedCount } })
    );
  } catch (error) {
    console.error("Erreur globale lors de la synchronisation hors-ligne:", error);
  } finally {
    isSyncing = false;
  }

  return { syncedCount };
}

export function initAutoSync() {
  if (typeof window === "undefined") return;

  // Lancer la synchro immédiatement si en ligne
  if (navigator.onLine) {
    syncPendingData();
  }

  // Écouter le retour de la connexion
  window.addEventListener("online", () => {
    console.log("📶 Connexion Internet rétablie. Démarrage de la synchronisation...");
    syncPendingData();
  });
}
