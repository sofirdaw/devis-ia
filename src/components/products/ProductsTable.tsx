/**
 * ProductsTable — Tableau interactif des produits/services
 */

"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Pencil, Trash2, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductFormDialog } from "./ProductFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteProductAction } from "@/app/actions/products";
import { formatCurrency } from "@/lib/utils";
import type { Product, Supplier } from "@/types";

interface ProductsTableProps {
  initialProducts: Product[];
  suppliers: Supplier[];
}

export function ProductsTable({
  initialProducts,
  suppliers,
}: ProductsTableProps) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [deletingProduct, setDeletingProduct] = useState<Product | undefined>();

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return initialProducts;
    return initialProducts.filter((p) => p.name.toLowerCase().includes(term));
  }, [initialProducts, search]);

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
        <Button
          leftIcon={<Plus size={16} />}
          onClick={openCreateForm}
          className="w-full sm:w-auto"
        >
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
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={openCreateForm}
            >
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
                  <h3 className="font-medium text-gray-900 truncate">
                    {product.name}
                  </h3>
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
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        suppliers={suppliers}
      />

      {deletingProduct && (
        <ConfirmDialog
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(undefined)}
          title="Supprimer ce produit ?"
          description={`"${deletingProduct.name}" sera définitivement supprimé.`}
          onConfirm={() => deleteProductAction(deletingProduct.id)}
        />
      )}
    </>
  );
}
