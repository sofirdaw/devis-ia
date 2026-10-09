/**
 * Moteur de base de données locale IndexedDB pour le mode 100% hors-ligne.
 * Permet de lire, créer, modifier et synchroniser des devis et factures sans réseau.
 */

import type {
  Client,
  Invoice,
  PaymentTransaction,
  Product,
  Quote,
  Receivable,
  Supplier,
} from "@/types";

const DB_NAME = "DevisIA_OfflineDB";
const DB_VERSION = 5;

export interface OfflineSnapshot {
  company_id: string;
  fetched_at: string;
  clients: Client[];
  products: Product[];
  suppliers: Supplier[];
  quotes: Array<Quote & { quote_items?: NonNullable<Quote["quote_items"]> }>;
  invoices: Array<Invoice & { invoice_items?: NonNullable<Invoice["invoice_items"]> }>;
  receivables: Array<Receivable & { payment_transactions?: PaymentTransaction[] }>;
}

export interface OfflineQuote {
  id: string;
  company_id?: string;
  quote_number: string;
  client_name?: string;
  client_id?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "refused" | "expired" | "cancelled";
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  valid_until?: string;
  notes?: string;
  created_at: string;
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  sync_status: "synced" | "pending_create" | "pending_update" | "pending_delete";
}

export interface OfflineInvoice {
  id: string;
  company_id?: string;
  invoice_number: string;
  client_name?: string;
  client_id?: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  notes?: string;
  due_date?: string;
  created_at: string;
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  sync_status: "synced" | "pending_create" | "pending_update" | "pending_delete";
}

export interface OfflineProduct {
  id: string;
  company_id?: string;
  name: string;
  supplier_id?: string | null;
  description?: string;
  unit_price: number;
  cost_price?: number;
  unit?: string;
  category?: string;
  created_at: string;
  sync_status: "synced" | "pending_create" | "pending_update" | "pending_delete";
}

export interface OfflineSupplier {
  id: string;
  company_id?: string;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
  sync_status: "synced" | "pending_create" | "pending_update" | "pending_delete";
}

export interface OfflineClient {
  id: string;
  company_id?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
  sync_status: "synced" | "pending_create" | "pending_update" | "pending_delete";
}

export interface SyncQueueItem {
  id: string;
  action:
    | "CREATE_QUOTE"
    | "UPDATE_QUOTE"
    | "DELETE_QUOTE"
    | "CREATE_INVOICE"
    | "UPDATE_INVOICE"
    | "DELETE_INVOICE"
    | "CREATE_CLIENT"
    | "UPDATE_CLIENT"
    | "DELETE_CLIENT"
    | "CREATE_PRODUCT"
    | "UPDATE_PRODUCT"
    | "DELETE_PRODUCT"
    | "CREATE_SUPPLIER"
    | "UPDATE_SUPPLIER"
    | "DELETE_SUPPLIER"
    | "UPDATE_QUOTE_STATUS"
    | "UPDATE_INVOICE_STATUS"
    | "ADD_PAYMENT"
    | "UPDATE_RECEIVABLE"
    | "DELETE_RECEIVABLE"
    | "DELETE_PAYMENT"
    | "UPDATE_COMPANY"
    | "UPDATE_COMPANY_LOGO";
  payload: Record<string, unknown>;
  created_at: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB n'est pas disponible"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("quotes")) {
        const quoteStore = db.createObjectStore("quotes", { keyPath: "id" });
        quoteStore.createIndex("sync_status", "sync_status", { unique: false });
      }

      if (!db.objectStoreNames.contains("invoices")) {
        const invoiceStore = db.createObjectStore("invoices", { keyPath: "id" });
        invoiceStore.createIndex("sync_status", "sync_status", { unique: false });
      }

      if (!db.objectStoreNames.contains("clients")) {
        db.createObjectStore("clients", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("products")) {
        const productStore = db.createObjectStore("products", { keyPath: "id" });
        productStore.createIndex("sync_status", "sync_status", { unique: false });
      }

      if (!db.objectStoreNames.contains("suppliers")) {
        const supplierStore = db.createObjectStore("suppliers", { keyPath: "id" });
        supplierStore.createIndex("sync_status", "sync_status", { unique: false });
      }

      if (!db.objectStoreNames.contains("sync_queue")) {
        db.createObjectStore("sync_queue", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "company_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn("Ouverture IndexedDB bloquée par une ancienne connexion");
    };
  });
}

function notifyOfflineDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pwa-offline-data-changed"));
  }
}

export async function getOfflineSnapshot(companyId: string): Promise<OfflineSnapshot | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("snapshots", "readonly").objectStore("snapshots").get(companyId);
    request.onsuccess = () => resolve((request.result as OfflineSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction("snapshots", "readwrite").objectStore("snapshots").put(snapshot);
    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── DEVIS ───────────────────────────────────────────────────────────────────

export async function getOfflineQuotes(): Promise<OfflineQuote[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("quotes", "readonly");
      const store = transaction.objectStore("quotes");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture quotes IndexedDB:", err);
    return [];
  }
}

export async function saveOfflineQuote(quote: OfflineQuote): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("quotes", "readwrite");
    const store = transaction.objectStore("quotes");
    const request = store.put(quote);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineQuote(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("quotes", "readwrite");
    const store = transaction.objectStore("quotes");
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── FACTURES ────────────────────────────────────────────────────────────────

export async function getOfflineInvoices(): Promise<OfflineInvoice[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("invoices", "readonly");
      const store = transaction.objectStore("invoices");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture invoices IndexedDB:", err);
    return [];
  }
}

export async function saveOfflineInvoice(invoice: OfflineInvoice): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("invoices", "readwrite");
    const store = transaction.objectStore("invoices");
    const request = store.put(invoice);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineInvoice(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("invoices", "readwrite");
    const store = transaction.objectStore("invoices");
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── PRODUITS ────────────────────────────────────────────────────────────────

export async function getOfflineProducts(): Promise<OfflineProduct[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("products", "readonly");
      const store = transaction.objectStore("products");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture products IndexedDB:", err);
    return [];
  }
}

export async function saveOfflineProduct(product: OfflineProduct): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("products", "readwrite");
    const store = transaction.objectStore("products");
    const request = store.put(product);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineProduct(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("products", "readwrite");
    const store = transaction.objectStore("products");
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── CLIENTS ────────────────────────────────────────────────────────────────

export async function getOfflineClients(): Promise<OfflineClient[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("clients", "readonly");
      const store = transaction.objectStore("clients");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture clients IndexedDB:", err);
    return [];
  }
}

export async function saveOfflineClient(client: OfflineClient): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("clients", "readwrite");
    const store = transaction.objectStore("clients");
    const request = store.put(client);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineClient(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("clients", "readwrite");
    const store = transaction.objectStore("clients");
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── FOURNISSEURS ────────────────────────────────────────────────────────────

export async function getOfflineSuppliers(): Promise<OfflineSupplier[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("suppliers", "readonly");
      const store = transaction.objectStore("suppliers");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture suppliers IndexedDB:", err);
    return [];
  }
}

export async function saveOfflineSupplier(supplier: OfflineSupplier): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("suppliers", "readwrite");
    const store = transaction.objectStore("suppliers");
    const request = store.put(supplier);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineSupplier(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("suppliers", "readwrite");
    const store = transaction.objectStore("suppliers");
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyOfflineDataChanged();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ── FILE D'ATTENTE DE SYNCHRONISATION ────────────────────────────────────────

export async function addToSyncQueue(
  action: SyncQueueItem["action"],
  payload: Record<string, unknown>
): Promise<string> {
  const db = await openDB();
  const item: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    action,
    payload,
    created_at: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sync_queue", "readwrite");
    const store = transaction.objectStore("sync_queue");
    const request = store.put(item);

    request.onsuccess = () => resolve(item.id);
    request.onerror = () => reject(request.error);
  });
}

// Note: l'enregistrement du Background Sync est fait côté client après
// l'appel à `addToSyncQueue`. Cependant, pour compatibilité, on expose
// une petite aide utilitaire ci-dessous que le client peut appeler.

export async function registerBackgroundSync(tag = "devisia-sync"): Promise<void> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("SyncManager" in window)
  )
    return;

  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (reg.sync) {
      await reg.sync.register(tag);
    }
  } catch (err) {
    // échec discret si le SyncManager n'est pas supporté
    console.debug("Background Sync non disponible:", err);
  }
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("sync_queue", "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () =>
        resolve((request.result || []).sort((a, b) => a.created_at.localeCompare(b.created_at)));
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture sync_queue IndexedDB:", err);
    return [];
  }
}

export async function removeQueuedMutationsForEntity(
  actions: SyncQueueItem["action"][],
  entityId: string
): Promise<number> {
  const queue = await getSyncQueue();
  const nestedIds = (payload: Record<string, unknown>) =>
    ["local_client", "local_product", "local_supplier", "local_quote", "local_invoice"]
      .map((key) => (payload[key] as { id?: string } | undefined)?.id)
      .filter((id): id is string => Boolean(id));
  const matches = queue.filter(
    (item) =>
      actions.includes(item.action) &&
      (item.payload.id === entityId || nestedIds(item.payload).includes(entityId))
  );
  await Promise.all(matches.map((item) => removeFromSyncQueue(item.id)));
  return matches.length;
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("sync_queue", "readwrite");
    const store = transaction.objectStore("sync_queue");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
