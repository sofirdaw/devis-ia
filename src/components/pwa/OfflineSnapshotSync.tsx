"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getOfflineSnapshotAction } from "@/app/actions/offline-snapshot";
import {
  getOfflineClients,
  getOfflineInvoices,
  getOfflineProducts,
  getOfflineQuotes,
  getOfflineSuppliers,
  getOfflineSnapshot,
  getSyncQueue,
  saveOfflineClient,
  saveOfflineInvoice,
  saveOfflineProduct,
  saveOfflineQuote,
  saveOfflineSnapshot,
  saveOfflineSupplier,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";
import { syncPendingData } from "@/lib/offline-sync";

export function OfflineSnapshotSync() {
  const router = useRouter();
  const companyId = useAuthStore((state) => state.company?.id);
  const running = useRef(false);

  useEffect(() => {
    if (!companyId) return;
    const routes = [
      "/dashboard",
      "/quotes",
      "/quotes/new",
      "/invoices",
      "/invoices/new",
      "/clients",
      "/products",
      "/suppliers",
      "/receivables",
      "/settings",
    ];
    let active = true;
    let routeIndex = 0;
    let timer: number | undefined;
    let isPrefetching = false;

    const prefetchNextRoute = () => {
      timer = undefined;
      if (!active || !navigator.onLine || isPrefetching || routeIndex >= routes.length) return;
      isPrefetching = true;
      const path = routes[routeIndex];
      routeIndex += 1;
      router.prefetch(path);
      void fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "text/html" },
      })
        .then((response) => {
          if (response.redirected || !response.ok) {
            console.warn(`La page ${path} n'a pas pu être mise en cache hors ligne.`);
          }
        })
        .catch((error) => {
          if (navigator.onLine) {
            console.warn(`Échec du précache de ${path}:`, error);
          }
        })
        .finally(() => {
          isPrefetching = false;
          if (active && navigator.onLine && routeIndex < routes.length) {
            timer = window.setTimeout(prefetchNextRoute, 1500);
          }
        });
    };
    const startPrefetch = () => {
      if (!navigator.onLine || isPrefetching || routeIndex >= routes.length || timer) return;
      timer = window.setTimeout(prefetchNextRoute, 3000);
    };
    const stopPrefetch = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    startPrefetch();
    window.addEventListener("online", startPrefetch);
    window.addEventListener("offline", stopPrefetch);
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("online", startPrefetch);
      window.removeEventListener("offline", stopPrefetch);
    };
  }, [companyId, router]);

  const refreshSnapshot = useCallback(async () => {
    if (!companyId || !navigator.onLine || running.current) return;
    running.current = true;

    try {
      await syncPendingData();
      const result = await getOfflineSnapshotAction();
      if (!result.snapshot) {
        throw new Error(result.error ?? "Le snapshot hors-ligne est indisponible.");
      }
      if (result.snapshot.company_id !== companyId) {
        throw new Error("Le compte actif ne correspond pas au snapshot reçu.");
      }

      const [clients, products, suppliers, quotes, invoices, queue, currentSnapshot] =
        await Promise.all([
          getOfflineClients(),
          getOfflineProducts(),
          getOfflineSuppliers(),
          getOfflineQuotes(),
          getOfflineInvoices(),
          getSyncQueue(),
          getOfflineSnapshot(companyId),
        ]);
      const pendingIds = (records: Array<{ id: string; sync_status: string }>) =>
        new Set(
          records.filter((record) => record.sync_status !== "synced").map((record) => record.id)
        );

      const pendingClients = pendingIds(clients);
      const pendingProducts = pendingIds(products);
      const pendingSuppliers = pendingIds(suppliers);
      const pendingQuotes = pendingIds(quotes);
      const pendingInvoices = pendingIds(invoices);
      const deletedIds = (action: string) =>
        new Set(
          queue
            .filter((item) => item.action === action && item.payload.company_id === companyId)
            .map((item) => String(item.payload.id))
        );
      const deletedClients = deletedIds("DELETE_CLIENT");
      const deletedProducts = deletedIds("DELETE_PRODUCT");
      const deletedSuppliers = deletedIds("DELETE_SUPPLIER");
      const deletedQuotes = deletedIds("DELETE_QUOTE");
      const deletedInvoices = deletedIds("DELETE_INVOICE");

      const pendingReceivables = new Set(
        queue
          .filter(
            (item) =>
              ["ADD_PAYMENT", "UPDATE_RECEIVABLE", "DELETE_PAYMENT"].includes(item.action) &&
              item.payload.company_id === companyId
          )
          .map((item) => String(item.payload.receivable_id ?? item.payload.id))
      );
      const deletedReceivables = new Set(
        queue
          .filter(
            (item) => item.action === "DELETE_RECEIVABLE" && item.payload.company_id === companyId
          )
          .map((item) => String(item.payload.id))
      );
      const previousReceivables = new Map(
        (currentSnapshot?.receivables ?? []).map((receivable) => [receivable.id, receivable])
      );
      const snapshotToSave = {
        ...result.snapshot,
        receivables: [
          ...result.snapshot.receivables
            .filter((receivable) => !deletedReceivables.has(receivable.id))
            .map((receivable) =>
              pendingReceivables.has(receivable.id)
                ? (previousReceivables.get(receivable.id) ?? receivable)
                : receivable
            ),
          ...(currentSnapshot?.receivables.filter(
            (receivable) =>
              pendingReceivables.has(receivable.id) &&
              !deletedReceivables.has(receivable.id) &&
              !result.snapshot?.receivables.some((serverRow) => serverRow.id === receivable.id)
          ) ?? []),
        ],
      };
      await saveOfflineSnapshot(snapshotToSave);
      await Promise.all([
        ...result.snapshot.clients
          .filter((client) => !pendingClients.has(client.id))
          .filter((client) => !deletedClients.has(client.id))
          .map((client) =>
            saveOfflineClient({
              ...client,
              phone: client.phone ?? undefined,
              email: client.email ?? undefined,
              address: client.address ?? undefined,
              sync_status: "synced",
            })
          ),
        ...result.snapshot.products
          .filter((product) => !pendingProducts.has(product.id))
          .filter((product) => !deletedProducts.has(product.id))
          .map((product) =>
            saveOfflineProduct({
              id: product.id,
              company_id: companyId,
              name: product.name,
              supplier_id: product.supplier_id,
              description: product.description ?? undefined,
              unit_price: product.price,
              created_at: product.created_at,
              sync_status: "synced",
            })
          ),
        ...result.snapshot.suppliers
          .filter((supplier) => !pendingSuppliers.has(supplier.id))
          .filter((supplier) => !deletedSuppliers.has(supplier.id))
          .map((supplier) =>
            saveOfflineSupplier({
              ...supplier,
              phone: supplier.phone ?? undefined,
              email: supplier.email ?? undefined,
              address: supplier.address ?? undefined,
              sync_status: "synced",
            })
          ),
        ...result.snapshot.quotes
          .filter((quote) => !pendingQuotes.has(quote.id))
          .filter((quote) => !deletedQuotes.has(quote.id))
          .map((quote) =>
            saveOfflineQuote({
              id: quote.id,
              company_id: companyId,
              quote_number: quote.quote_number,
              client_name: quote.client?.name,
              client_id: quote.client_id,
              status: quote.status,
              total: quote.total,
              subtotal: quote.subtotal,
              tax: quote.tax,
              discount: quote.discount,
              valid_until: quote.valid_until ?? undefined,
              notes: quote.notes ?? undefined,
              created_at: quote.created_at,
              items: (quote.quote_items ?? []).map((item) => ({
                designation: item.designation,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
              })),
              sync_status: "synced",
            })
          ),
        ...result.snapshot.invoices
          .filter((invoice) => !pendingInvoices.has(invoice.id))
          .filter((invoice) => !deletedInvoices.has(invoice.id))
          .map((invoice) =>
            saveOfflineInvoice({
              id: invoice.id,
              company_id: companyId,
              invoice_number: invoice.invoice_number,
              client_name: invoice.client?.name,
              client_id: invoice.client_id,
              status: invoice.status,
              total: invoice.total,
              subtotal: invoice.subtotal,
              tax: invoice.tax,
              discount: invoice.discount,
              notes: invoice.notes ?? undefined,
              due_date: invoice.due_date ?? undefined,
              created_at: invoice.created_at,
              items: (invoice.invoice_items ?? []).map((item) => ({
                designation: item.designation,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.total,
              })),
              sync_status: "synced",
            })
          ),
      ]);

      window.dispatchEvent(new Event("pwa-offline-snapshot-ready"));
    } catch (error) {
      console.error("Échec de la mise à jour du snapshot hors-ligne:", error);
      window.dispatchEvent(
        new CustomEvent("pwa-offline-snapshot-failed", {
          detail: error instanceof Error ? error.message : "Erreur de synchronisation des données.",
        })
      );
    } finally {
      running.current = false;
    }
  }, [companyId]);

  useEffect(() => {
    void refreshSnapshot();
    window.addEventListener("online", refreshSnapshot);
    window.addEventListener("pwa-sync-complete", refreshSnapshot);
    window.addEventListener("pwa-snapshot-retry", refreshSnapshot);
    return () => {
      window.removeEventListener("online", refreshSnapshot);
      window.removeEventListener("pwa-sync-complete", refreshSnapshot);
      window.removeEventListener("pwa-snapshot-retry", refreshSnapshot);
    };
  }, [refreshSnapshot]);

  return null;
}
