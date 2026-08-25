/**
 * ProductFormDialog — Modale d'ajout/modification d'un produit avec création rapide de fournisseur
 */

"use client";

import { useActionState, useEffect, useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SupplierQuickCreateDialog } from "@/components/suppliers/SupplierQuickCreateDialog";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import { OfflineActionNotice } from "@/components/pwa/OfflineActionNotice";
import { saveOfflineProduct, addToSyncQueue, registerBackgroundSync } from "@/lib/offline-db";
import type { ActionResult } from "@/app/actions/auth";
import type { Product, Supplier } from "@/types";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  suppliers: Supplier[];
}

const initialState: ActionResult = {};

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  suppliers: initialSuppliers,
}: ProductFormDialogProps) {
  const isEditMode = !!product;

  const [extraSuppliers, setExtraSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [customSupplierId, setCustomSupplierId] = useState<string | null>(null);
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false);

  const selectedSupplierId = customSupplierId ?? product?.supplier_id ?? "";

  // Déduplication stricte des fournisseurs par ID et par Nom
  const rawList = [...initialSuppliers, ...extraSuppliers];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const supplierList: Array<{ id: string; name: string }> = [];

  for (const s of rawList) {
    if (!s || !s.id) continue;
    const normName = s.name?.trim().toLowerCase();
    if (!seenIds.has(s.id) && (!normName || !seenNames.has(normName))) {
      seenIds.add(s.id);
      if (normName) seenNames.add(normName);
      supplierList.push(s);
    }
  }

  const action = isEditMode ? updateProductAction.bind(null, product.id) : createProductAction;

  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isSavingOffline, setIsSavingOffline] = useState(false);

  useEffect(() => {
    if (state.success) onOpenChange(false);
  }, [state.success, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      if (isEditMode) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      setIsSavingOffline(true);

      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const name = String(fd.get("name") ?? "").trim();
      const description = String(fd.get("description") ?? "").trim();
      const supplier_id = String(fd.get("supplier_id") ?? "").trim() || null;
      const priceRaw = fd.get("price");
      const price = priceRaw ? Number(priceRaw) : 0;

      const localId = `off_prod_${Date.now()}`;

      const offlineProduct = {
        id: localId,
        name,
        description: description || undefined,
        unit_price: price,
        cost_price: undefined,
        unit: undefined,
        category: undefined,
        created_at: new Date().toISOString(),
        sync_status: "pending_create" as const,
      };

      try {
        await saveOfflineProduct(offlineProduct);
        await addToSyncQueue("CREATE_PRODUCT", {
          name,
          description: description || null,
          supplier_id: supplier_id || null,
          price,
          local_product: offlineProduct,
        });

        try {
          await registerBackgroundSync();
        } catch (err) {
          // ignore
        }
      } catch (err) {
        console.error("Erreur enregistrant produit hors-ligne:", err);
      }

      setIsSavingOffline(false);
      onOpenChange(false);
    }
  };

  const handleSupplierCreated = (newSupplier: { id: string; name: string }) => {
    setExtraSuppliers((prev) => [...prev, newSupplier]);
    setCustomSupplierId(newSupplier.id);
  };

  const supplierOptions = supplierList.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title={isEditMode ? "Modifier le produit" : "Ajouter un produit"}
          description="Ce produit sera disponible pour vos devis et factures"
        >
          {state.error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-4 text-sm"
              role="alert"
            >
              {state.error}
            </div>
          )}

          <OfflineActionNotice />

          <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="name"
              label="Nom du produit / service"
              placeholder="Caméra solaire"
              defaultValue={product?.name}
              required
            />

            <Textarea
              name="description"
              label="Description (optionnel)"
              placeholder="Caméra de surveillance solaire haute résolution"
              rows={2}
              defaultValue={product?.description ?? ""}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase">
                  Fournisseur <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setQuickSupplierOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  <Plus size={12} />
                  Nouveau fournisseur
                </button>
              </div>

              <Select
                name="supplier_id"
                placeholder="Sélectionner un fournisseur"
                options={supplierOptions}
                value={selectedSupplierId}
                onChange={(e) => setCustomSupplierId(e.target.value)}
                required
              />
            </div>

            <Input
              name="price"
              type="number"
              step="0.01"
              min="0"
              label="Prix unitaire (FCFA)"
              placeholder="45000"
              defaultValue={product?.price}
              required
            />

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button type="submit" isLoading={isPending || isSavingOffline} className="w-full sm:w-auto">
                {isEditMode ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pop-up de création rapide de fournisseur */}
      <SupplierQuickCreateDialog
        open={quickSupplierOpen}
        onOpenChange={setQuickSupplierOpen}
        onSupplierCreated={handleSupplierCreated}
      />
    </>
  );
}
