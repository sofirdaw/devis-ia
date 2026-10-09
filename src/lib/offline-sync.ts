/**
 * Moteur de synchronisation automatique avec Supabase Cloud lors du retour du réseau.
 */

import {
  getSyncQueue,
  removeFromSyncQueue,
  deleteOfflineClient,
  deleteOfflineProduct,
  deleteOfflineSupplier,
  saveOfflineQuote,
  saveOfflineInvoice,
  saveOfflineClient,
  saveOfflineProduct,
  saveOfflineSupplier,
  type OfflineClient,
  type OfflineInvoice,
  type OfflineProduct,
  type OfflineQuote,
  type OfflineSupplier,
} from "./offline-db";
import {
  createQuoteAction,
  deleteQuoteAction,
  updateQuoteAction,
  updateQuoteStatusAction,
} from "@/app/actions/quotes";
import {
  createInvoiceAction,
  deleteInvoiceAction,
  updateInvoiceAction,
  updateInvoiceStatusAction,
} from "@/app/actions/invoices";
import { createClientAction, deleteClientAction, updateClientAction } from "@/app/actions/clients";
import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/app/actions/products";
import {
  createSupplierAction,
  deleteSupplierAction,
  updateSupplierAction,
} from "@/app/actions/suppliers";
import { addPaymentAction } from "@/app/actions/receivables";
import {
  deleteReceivableAction,
  deletePaymentAction,
  updateReceivableAction,
} from "@/app/actions/receivables";
import {
  updateCompanyAction,
  updateCompanyPreferencesAction,
  uploadCompanyLogoAction,
} from "@/app/actions/company";
import { useAuthStore } from "@/store/auth.store";
import type { InvoiceStatus, QuoteStatus } from "@/types";

let isSyncing = false;
let syncPromise: Promise<{ syncedCount: number }> | null = null;
let autoSyncInitialized = false;

function parseQuoteStatus(value: unknown): QuoteStatus | null {
  if (value === "rejected") return "refused";
  if (
    value === "draft" ||
    value === "sent" ||
    value === "accepted" ||
    value === "refused" ||
    value === "expired" ||
    value === "cancelled"
  ) {
    return value;
  }
  return null;
}

function parseInvoiceStatus(value: unknown): InvoiceStatus | null {
  if (
    value === "draft" ||
    value === "sent" ||
    value === "paid" ||
    value === "overdue" ||
    value === "cancelled"
  ) {
    return value;
  }
  return null;
}

function getMutationEntityId(item: { action: string; payload: Record<string, unknown> }) {
  if (typeof item.payload.id === "string") return item.payload.id;
  if (
    (item.action === "UPDATE_COMPANY" || item.action === "UPDATE_COMPANY_LOGO") &&
    typeof item.payload.company_id === "string"
  ) {
    return item.payload.company_id;
  }
  const localKeys = [
    "local_client",
    "local_product",
    "local_supplier",
    "local_quote",
    "local_invoice",
  ];
  for (const key of localKeys) {
    const id = (item.payload[key] as { id?: unknown } | undefined)?.id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

export function syncPendingData(): Promise<{ syncedCount: number }> {
  if (syncPromise) return syncPromise;
  if (typeof window === "undefined" || !navigator.onLine) {
    return Promise.resolve({ syncedCount: 0 });
  }
  syncPromise = runSync();
  return syncPromise;
}

async function runSync(): Promise<{ syncedCount: number }> {
  if (isSyncing) return { syncedCount: 0 };
  isSyncing = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const queue = await getSyncQueue();
    if (queue.length === 0) {
      isSyncing = false;
      return { syncedCount: 0 };
    }

    // Émettre un événement de début de synchro
    window.dispatchEvent(new CustomEvent("pwa-sync-start"));
    const failedEntityIds = new Set<string>();

    for (const item of queue) {
      const entityId = getMutationEntityId(item);
      if (entityId && failedEntityIds.has(entityId)) {
        failedCount++;
        console.error(
          "Synchronisation reportée car une opération précédente sur le même élément a échoué:",
          item.id
        );
        continue;
      }
      try {
        // Cast payload to a typed helper for safe FormData construction
        const p = item.payload as Record<string, unknown>;
        const currentCompanyId = useAuthStore.getState().company?.id;
        if (!currentCompanyId || p.company_id !== currentCompanyId) {
          throw new Error(
            "La file hors-ligne appartient à une autre entreprise ou ne peut pas être vérifiée."
          );
        }

        if (item.action === "CREATE_QUOTE") {
          const formData = new FormData();
          const localQuote = p.local_quote as OfflineQuote | undefined;
          formData.append("client_id", String(p.client_id ?? ""));
          formData.append("discount", String(p.discount ?? 0));
          formData.append("notes", String(p.notes ?? ""));
          formData.append("valid_until", String(p.valid_until ?? ""));
          formData.append("items", JSON.stringify(p.items ?? []));
          if (localQuote?.id) formData.append("offline_sync_id", localQuote.id);

          const result = await createQuoteAction({}, formData);

          if (result?.error) throw new Error(result.error);
          if (localQuote) {
            await saveOfflineQuote({ ...localQuote, sync_status: "synced" });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "CREATE_INVOICE") {
          const formData = new FormData();
          const localInvoice = p.local_invoice as OfflineInvoice | undefined;
          formData.append("client_id", String(p.client_id ?? ""));
          formData.append("discount", String(p.discount ?? 0));
          formData.append("due_date", String(p.due_date ?? ""));
          formData.append("notes", String(p.notes ?? ""));
          formData.append("items", JSON.stringify(p.items ?? []));
          if (localInvoice?.id) formData.append("offline_sync_id", localInvoice.id);

          const result = await createInvoiceAction({}, formData);

          if (result?.error) throw new Error(result.error);
          if (localInvoice) {
            await saveOfflineInvoice({ ...localInvoice, sync_status: "synced" });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "CREATE_CLIENT") {
          const formData = new FormData();
          const localClient = p.local_client as OfflineClient | undefined;
          formData.append("name", String(p.name ?? ""));
          formData.append("phone", String(p.phone ?? ""));
          formData.append("email", String(p.email ?? ""));
          formData.append("address", String(p.address ?? ""));
          if (localClient?.id) formData.append("offline_sync_id", localClient.id);

          const result = await createClientAction({}, formData);
          if (result?.error) throw new Error(result.error);
          if (localClient) {
            await saveOfflineClient({ ...localClient, sync_status: "synced" });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "CREATE_PRODUCT") {
          const formData = new FormData();
          const localProduct = p.local_product as OfflineProduct | undefined;
          formData.append("name", String(p.name ?? ""));
          formData.append("description", String(p.description ?? ""));
          formData.append("supplier_id", String(p.supplier_id ?? ""));
          formData.append("price", String(p.price ?? ""));
          if (localProduct?.id) formData.append("offline_sync_id", localProduct.id);

          const result = await createProductAction({}, formData);
          if (result?.error) throw new Error(result.error);
          if (localProduct) {
            await saveOfflineProduct({ ...localProduct, sync_status: "synced" });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "CREATE_SUPPLIER") {
          const formData = new FormData();
          const localSupplier = p.local_supplier as OfflineSupplier | undefined;
          formData.append("name", String(p.name ?? ""));
          formData.append("phone", String(p.phone ?? ""));
          formData.append("email", String(p.email ?? ""));
          formData.append("address", String(p.address ?? ""));
          if (localSupplier?.id) formData.append("offline_sync_id", localSupplier.id);

          const result = await createSupplierAction({}, formData);
          if (result?.error) throw new Error(result.error);
          if (localSupplier) {
            await saveOfflineSupplier({ ...localSupplier, sync_status: "synced" });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_CLIENT") {
          const formData = new FormData();
          formData.append("name", String(p.name ?? ""));
          formData.append("phone", String(p.phone ?? ""));
          formData.append("email", String(p.email ?? ""));
          formData.append("address", String(p.address ?? ""));
          const result = await updateClientAction(String(p.id ?? ""), {}, formData);
          if (result?.error) throw new Error(result.error);
          const local = p.local_client as OfflineClient | undefined;
          if (local) await saveOfflineClient({ ...local, sync_status: "synced" });
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_CLIENT") {
          const result = await deleteClientAction(String(p.id ?? ""));
          if (result?.error) throw new Error(result.error);
          await deleteOfflineClient(String(p.id ?? ""));
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_PRODUCT") {
          const formData = new FormData();
          formData.append("name", String(p.name ?? ""));
          formData.append("description", String(p.description ?? ""));
          formData.append("supplier_id", String(p.supplier_id ?? ""));
          formData.append("price", String(p.price ?? ""));
          const result = await updateProductAction(String(p.id ?? ""), {}, formData);
          if (result?.error) throw new Error(result.error);
          const local = p.local_product as OfflineProduct | undefined;
          if (local) await saveOfflineProduct({ ...local, sync_status: "synced" });
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_PRODUCT") {
          const result = await deleteProductAction(String(p.id ?? ""));
          if (result?.error) throw new Error(result.error);
          await deleteOfflineProduct(String(p.id ?? ""));
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_SUPPLIER") {
          const formData = new FormData();
          formData.append("name", String(p.name ?? ""));
          formData.append("phone", String(p.phone ?? ""));
          formData.append("email", String(p.email ?? ""));
          formData.append("address", String(p.address ?? ""));
          formData.append("offline_sync", "true");
          const result = await updateSupplierAction({}, formData, String(p.id ?? ""));
          if (result?.error) throw new Error(result.error);
          const local = p.local_supplier as OfflineSupplier | undefined;
          if (local) await saveOfflineSupplier({ ...local, sync_status: "synced" });
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_SUPPLIER") {
          const result = await deleteSupplierAction(String(p.id ?? ""), true);
          if (result?.error) throw new Error(result.error);
          await deleteOfflineSupplier(String(p.id ?? ""));
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_QUOTE_STATUS") {
          const status = parseQuoteStatus(p.status);
          if (!status) throw new Error("Statut de devis invalide dans la file hors-ligne.");
          const result = await updateQuoteStatusAction(String(p.id ?? ""), status);
          if (result?.error) throw new Error(result.error);
          const local = p.local_quote as OfflineQuote | undefined;
          if (local) await saveOfflineQuote({ ...local, sync_status: "synced" });
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_INVOICE_STATUS") {
          const status = parseInvoiceStatus(p.status);
          if (!status) throw new Error("Statut de facture invalide dans la file hors-ligne.");
          const result = await updateInvoiceStatusAction(String(p.id ?? ""), status);
          if (result?.error) throw new Error(result.error);
          const local = p.local_invoice as OfflineInvoice | undefined;
          if (local) await saveOfflineInvoice({ ...local, sync_status: "synced" });
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_QUOTE") {
          const result = await deleteQuoteAction(String(p.id ?? ""));
          if (result?.error) throw new Error(result.error);
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_INVOICE") {
          const result = await deleteInvoiceAction(String(p.id ?? ""));
          if (result?.error) throw new Error(result.error);
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_QUOTE" || item.action === "UPDATE_INVOICE") {
          const formData = new FormData();
          formData.append("client_id", String(p.client_id ?? ""));
          formData.append("discount", String(p.discount ?? 0));
          formData.append("notes", String(p.notes ?? ""));
          formData.append("valid_until", String(p.valid_until ?? ""));
          formData.append("due_date", String(p.due_date ?? ""));
          formData.append("items", JSON.stringify(p.items ?? []));
          formData.append("offline_sync", "true");
          const result =
            item.action === "UPDATE_QUOTE"
              ? await updateQuoteAction(String(p.id ?? ""), {}, formData)
              : await updateInvoiceAction(String(p.id ?? ""), {}, formData);
          if (result?.error) throw new Error(result.error);
          if (item.action === "UPDATE_QUOTE") {
            const local = p.local_quote as OfflineQuote | undefined;
            if (local) await saveOfflineQuote({ ...local, sync_status: "synced" });
          } else {
            const local = p.local_invoice as OfflineInvoice | undefined;
            if (local) await saveOfflineInvoice({ ...local, sync_status: "synced" });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "ADD_PAYMENT") {
          const formData = new FormData();
          formData.append("receivableId", String(p.receivable_id ?? ""));
          formData.append("amount", String(p.amount ?? ""));
          formData.append("payment_method", String(p.payment_method ?? ""));
          formData.append("payment_date", String(p.payment_date ?? ""));
          formData.append("reference", String(p.reference ?? ""));
          formData.append("notes", String(p.notes ?? ""));
          formData.append("offline_sync_id", String(p.offline_sync_id ?? ""));
          const result = await addPaymentAction({}, formData);
          if (result?.error) throw new Error(result.error);
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_RECEIVABLE") {
          const formData = new FormData();
          formData.append("total_amount", String(p.total_amount ?? ""));
          formData.append("due_date", String(p.due_date ?? ""));
          const result = await updateReceivableAction(String(p.id ?? ""), {}, formData);
          if (result?.error) throw new Error(result.error);
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_RECEIVABLE") {
          const result = await deleteReceivableAction(String(p.id ?? ""));
          if (result?.error) throw new Error(result.error);
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "DELETE_PAYMENT") {
          const formData = new FormData();
          formData.append("paymentId", String(p.payment_id ?? ""));
          formData.append("receivableId", String(p.receivable_id ?? ""));
          await deletePaymentAction(formData);
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_COMPANY") {
          const fields = p.fields as Record<string, unknown>;
          const formData = new FormData();
          for (const [key, value] of Object.entries(fields)) {
            formData.append(key, String(value ?? ""));
          }
          const result =
            p.section === "preferences"
              ? await updateCompanyPreferencesAction(String(p.company_id), {}, formData)
              : await updateCompanyAction(String(p.company_id), {}, formData);
          if (result?.error) throw new Error(result.error);
          const localCompany = useAuthStore.getState().company;
          if (localCompany?.id === p.company_id) {
            const updatedCompany =
              p.section === "preferences"
                ? {
                    ...localCompany,
                    quote_prefix: String(fields.quote_prefix ?? localCompany.quote_prefix),
                    invoice_prefix: String(fields.invoice_prefix ?? localCompany.invoice_prefix),
                    tax_rate: Number(fields.tax_rate ?? localCompany.tax_rate),
                    quote_pdf_template:
                      fields.quote_pdf_template === "modern" ||
                      fields.quote_pdf_template === "minimal" ||
                      fields.quote_pdf_template === "classic"
                        ? fields.quote_pdf_template
                        : (localCompany.quote_pdf_template ?? "classic"),
                    invoice_pdf_template:
                      fields.invoice_pdf_template === "modern" ||
                      fields.invoice_pdf_template === "minimal" ||
                      fields.invoice_pdf_template === "classic"
                        ? fields.invoice_pdf_template
                        : (localCompany.invoice_pdf_template ?? "classic"),
                    quote_pdf_use_header:
                      fields.quote_pdf_use_header === "on" ||
                      fields.quote_pdf_use_header === true ||
                      (fields.quote_pdf_use_header === undefined &&
                        (localCompany.quote_pdf_use_header ?? true)),
                    invoice_pdf_use_header:
                      fields.invoice_pdf_use_header === "on" ||
                      fields.invoice_pdf_use_header === true ||
                      (fields.invoice_pdf_use_header === undefined &&
                        (localCompany.invoice_pdf_use_header ?? true)),
                    service_description:
                      fields.service_description === undefined
                        ? (localCompany.service_description ?? null)
                        : String(fields.service_description).trim() || null,
                  }
                : {
                    ...localCompany,
                    name: String(fields.name ?? localCompany.name),
                    phone: String(fields.phone ?? "") || null,
                    email: String(fields.email ?? "") || null,
                    address: String(fields.address ?? "") || null,
                    rccm: String(fields.rccm ?? "") || null,
                    ifu: String(fields.ifu ?? "") || null,
                    cme: String(fields.cme ?? "") || null,
                    default_quote_notes: String(fields.default_quote_notes ?? "") || null,
                    default_invoice_notes: String(fields.default_invoice_notes ?? "") || null,
                  };
            useAuthStore.getState().setCompany(updatedCompany);
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else if (item.action === "UPDATE_COMPANY_LOGO") {
          const response = await fetch(String(p.data_url));
          const blob = await response.blob();
          const file = new File([blob], String(p.file_name), { type: String(p.mime_type) });
          const formData = new FormData();
          formData.append("logo", file);
          const result = await uploadCompanyLogoAction(String(p.company_id), formData);
          if (result.error) throw new Error(result.error);
          const company = useAuthStore.getState().company;
          if (company && result.logoUrl) {
            useAuthStore.getState().setCompany({ ...company, logo_url: result.logoUrl });
          }
          await removeFromSyncQueue(item.id);
          syncedCount++;
        } else {
          throw new Error(`Type de synchronisation non pris en charge : ${item.action}`);
        }
      } catch (err) {
        failedCount++;
        if (entityId) failedEntityIds.add(entityId);
        console.error("Synchronisation en échec; l'élément reste en attente:", item.id, err);
      }
    }
  } catch (error) {
    console.error("Erreur globale lors de la synchronisation hors-ligne:", error);
  } finally {
    isSyncing = false;
    window.dispatchEvent(
      new CustomEvent("pwa-sync-complete", { detail: { syncedCount, failedCount } })
    );
    syncPromise = null;
  }

  return { syncedCount };
}

export function initAutoSync() {
  if (typeof window === "undefined" || autoSyncInitialized) return;
  autoSyncInitialized = true;

  // Lancer la synchro immédiatement si en ligne
  if (navigator.onLine) {
    syncPendingData();
  }

  // Écouter le retour de la connexion
  window.addEventListener("online", () => {
    console.log("📶 Connexion Internet rétablie. Démarrage de la synchronisation...");
    syncPendingData();
  });

  // Écouter les messages en provenance du Service Worker (Background Sync déclenché)
  if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
    navigator.serviceWorker.addEventListener("message", (ev: MessageEvent) => {
      try {
        const data = ev.data || {};
        if (data && data.type === "DEVISIA_SYNC") {
          console.log("SW requested sync via message. Lancement de syncPendingData().");
          syncPendingData();
        }
      } catch {
        // ignore
      }
    });
  }
}
