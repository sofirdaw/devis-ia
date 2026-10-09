/**
 * ProductsTable — Tableau interactif des produits/services
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Pencil, Trash2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "./ProductFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteProductAction } from "@/app/actions/products";
import { formatCurrency } from "@/lib/utils";
import type { Product, Supplier } from "@/types";
import {
  getOfflineProducts,
  getOfflineSuppliers,
  addToSyncQueue,
  deleteOfflineProduct,
  getSyncQueue,
  removeQueuedMutationsForEntity,
  type OfflineProduct,
  type OfflineSupplier,
} from "@/lib/offline-db";

interface ProductsTableProps {
  initialProducts: Product[];
  suppliers: Supplier[];
  companyId: string;
}

export function ProductsTable({ initialProducts, suppliers, companyId }: ProductsTableProps) {
  const [search, setSearch] = useState("");
  const [offlineProducts, setOfflineProducts] = useState<OfflineProduct[]>([]);
  const [offlineSuppliers, setOfflineSuppliers] = useState<OfflineSupplier[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [deletingProduct, setDeletingProduct] = useState<Product | undefined>();

  useEffect(() => {
    let active = true;
    const loadOffline = async () => {
      const [products, offlineSupplierRows, queue] = await Promise.all([
        getOfflineProducts(),
        getOfflineSuppliers(),
        getSyncQueue(),
      ]);
      if (!active) return;
      setOfflineProducts(products.filter((product) => product.company_id === companyId));
      setOfflineSuppliers(
        offlineSupplierRows.filter((supplier) => supplier.company_id === companyId)
      );
      setDeletedIds((current) => {
        const queuedDeletes = new Set(
          queue
            .filter(
              (item) => item.action === "DELETE_PRODUCT" && item.payload.company_id === companyId
            )
            .map((item) => String(item.payload.id))
        );
        return new Set([...current, ...queuedDeletes]);
      });
    };
    loadOffline();
    window.addEventListener("pwa-offline-data-changed", loadOffline);
    window.addEventListener("pwa-sync-complete", loadOffline);
    return () => {
      active = false;
      window.removeEventListener("pwa-offline-data-changed", loadOffline);
      window.removeEventListener("pwa-sync-complete", loadOffline);
    };
  }, [companyId]);

  const combinedSuppliers = useMemo(() => {
    const serverIds = new Set(suppliers.map((supplier) => supplier.id));
    const localRows = offlineSuppliers
      .filter((supplier) => !serverIds.has(supplier.id))
      .map((supplier): Supplier => ({
        id: supplier.id,
        company_id: companyId,
        name: supplier.name,
        phone: supplier.phone ?? null,
        email: supplier.email ?? null,
        address: supplier.address ?? null,
        created_at: supplier.created_at,
      }));
    return [...localRows, ...suppliers];
  }, [companyId, offlineSuppliers, suppliers]);

  const combinedProducts = useMemo(() => {
    const serverIds = new Set(initialProducts.map((product) => product.id));
    const localRows = offlineProducts
      .filter(
        (product) =>
          !deletedIds.has(product.id) &&
          (!serverIds.has(product.id) ||
            product.sync_status === "pending_create" ||
            product.sync_status === "pending_update")
      )
      .map((product): Product => ({
        id: product.id,
        company_id: companyId,
        name: product.name,
        description: product.description ?? null,
        supplier_id: product.supplier_id ?? null,
        price: product.unit_price,
        created_at: product.created_at,
        supplier: combinedSuppliers.find((supplier) => supplier.id === product.supplier_id) ?? null,
      }));
    const localIds = new Set(localRows.map((product) => product.id));
    return [
      ...localRows,
      ...initialProducts.filter(
        (product) => !localIds.has(product.id) && !deletedIds.has(product.id)
      ),
    ];
  }, [companyId, combinedSuppliers, deletedIds, initialProducts, offlineProducts]);

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setActionError(null);
    if (navigator.onLine) {
      const result = await deleteProductAction(deletingProduct.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setDeletingProduct(undefined);
      return;
    }

    const queue = await getSyncQueue();
    const pendingCreate = queue.find(
      (item) =>
        item.action === "CREATE_PRODUCT" &&
        (item.payload.local_product as OfflineProduct | undefined)?.id === deletingProduct.id
    );
    try {
      if (pendingCreate) {
        await removeQueuedMutationsForEntity(
          ["CREATE_PRODUCT", "UPDATE_PRODUCT"],
          deletingProduct.id
        );
      } else {
        await addToSyncQueue("DELETE_PRODUCT", {
          company_id: companyId,
          id: deletingProduct.id,
        });
      }
      await deleteOfflineProduct(deletingProduct.id);
      setDeletedIds((current) => new Set(current).add(deletingProduct.id));
      setDeletingProduct(undefined);
    } catch (error) {
      console.error("Erreur de suppression locale du produit:", error);
      setActionError("Impossible de supprimer ce produit hors ligne.");
    }
  };

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return combinedProducts;
    return combinedProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [combinedProducts, search]);

  const openCreateForm = () => {
    setEditingProduct(undefined);
    setFormOpen(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Rechercher un produit..."
            leftIcon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {actionError && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {actionError}
          </div>
        )}
        <Button leftIcon={<Plus size={16} />} onClick={openCreateForm} className="w-full sm:w-auto">
          Ajouter un produit
        </Button>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 lg:py-16 text-center">
          <Package size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? "Aucun produit trouvé" : "Aucun produit pour le moment"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreateForm}>
              Ajouter votre premier produit
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                  {product.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                  {product.supplier && (
                    <p className="text-xs text-blue-600 mt-1">
                      Fournisseur : {product.supplier.name}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button
                    onClick={() => openEditForm(product)}
                    className="p-1.5 min-h-9 min-w-9 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    aria-label="Modifier"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeletingProduct(product)}
                    className="p-1.5 min-h-9 min-w-9 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-lg font-semibold text-blue-600 mt-3">
                {formatCurrency(product.price)}
              </p>
            </div>
          ))}
        </div>
      )}

      <ProductFormDialog
        key={editingProduct ? editingProduct.id : formOpen ? "new-open" : "new-closed"}
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        suppliers={combinedSuppliers}
      />

      {deletingProduct && (
        <ConfirmDialog
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(undefined)}
          title="Supprimer ce produit ?"
          description={`"${deletingProduct.name}" sera définitivement supprimé.`}
          onConfirm={handleDeleteProduct}
        />
      )}
    </>
  );
}
