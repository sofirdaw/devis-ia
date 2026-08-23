/**
 * Moteur de synchronisation automatique avec Supabase Cloud lors du retour du réseau.
 */

import {
  getSyncQueue,
  removeFromSyncQueue,
  saveOfflineQuote,
  saveOfflineInvoice,
} from "./offline-db";
import { createQuoteAction } from "@/app/actions/quotes";
import { createInvoiceAction } from "@/app/actions/invoices";

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
        // Cast payload to a typed helper for safe FormData construction
        const p = item.payload as Record<string, unknown>;

        if (item.action === "CREATE_QUOTE") {
          const formData = new FormData();
          formData.append("client_id", String(p.client_id ?? ""));
          formData.append("discount", String(p.discount ?? 0));
          formData.append("notes", String(p.notes ?? ""));
          formData.append("items", JSON.stringify(p.items ?? []));

          const result = await createQuoteAction({}, formData);

          if (!result?.error) {
            if (p.local_quote) {
              await saveOfflineQuote({
                ...(p.local_quote as object),
                sync_status: "synced",
              } as Parameters<typeof saveOfflineQuote>[0]);
            }
            await removeFromSyncQueue(item.id);
            syncedCount++;
          }
        } else if (item.action === "CREATE_INVOICE") {
          const formData = new FormData();
          formData.append("client_id", String(p.client_id ?? ""));
          formData.append("discount", String(p.discount ?? 0));
          formData.append("due_date", String(p.due_date ?? ""));
          formData.append("notes", String(p.notes ?? ""));
          formData.append("items", JSON.stringify(p.items ?? []));

          const result = await createInvoiceAction({}, formData);

          if (!result?.error) {
            if (p.local_invoice) {
              await saveOfflineInvoice({
                ...(p.local_invoice as object),
                sync_status: "synced",
              } as Parameters<typeof saveOfflineInvoice>[0]);
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
    window.dispatchEvent(new CustomEvent("pwa-sync-complete", { detail: { syncedCount } }));
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
