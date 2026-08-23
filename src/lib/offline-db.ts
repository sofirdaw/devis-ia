/**
 * Moteur de base de données locale IndexedDB pour le mode 100% hors-ligne.
 * Permet de lire, créer, modifier et synchroniser des devis et factures sans réseau.
 */

const DB_NAME = "DevisIA_OfflineDB";
const DB_VERSION = 4;

export interface OfflineQuote {
  id: string;
  quote_number: string;
  client_name?: string;
  client_id?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
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
  name: string;
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
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
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
    | "CREATE_PRODUCT"
    | "UPDATE_PRODUCT"
    | "DELETE_PRODUCT"
    | "CREATE_SUPPLIER";
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn("Ouverture IndexedDB bloquée par une ancienne connexion");
    };
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

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineQuote(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("quotes", "readwrite");
    const store = transaction.objectStore("quotes");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
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

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineInvoice(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("invoices", "readwrite");
    const store = transaction.objectStore("invoices");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
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

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineProduct(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("products", "readwrite");
    const store = transaction.objectStore("products");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
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

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineSupplier(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("suppliers", "readwrite");
    const store = transaction.objectStore("suppliers");
    const request = store.delete(id);

    request.onsuccess = () => resolve();
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

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("sync_queue", "readonly");
      const store = transaction.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Erreur lecture sync_queue IndexedDB:", err);
    return [];
  }
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
