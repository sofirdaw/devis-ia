/**
 * ProductFormDialog — Modale d'ajout/modification d'un produit
 * Même pattern que ClientFormDialog
 */

"use client";

import { useActionState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  createProductAction,
  updateProductAction,
} from "@/app/actions/products";
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
  suppliers,
}: ProductFormDialogProps) {
  const isEditMode = !!product;

  const action = isEditMode
    ? updateProductAction.bind(null, product.id)
    : createProductAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.success) onOpenChange(false);
  }, [state.success, onOpenChange]);

  const supplierOptions = suppliers.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  return (
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

        <form action={formAction} className="space-y-4">
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

          <Select
            name="supplier_id"
            label="Fournisseur (optionnel)"
            placeholder="Sélectionner un fournisseur"
            options={supplierOptions}
            defaultValue={product?.supplier_id ?? ""}
          />

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
            <Button
              type="submit"
              isLoading={isPending}
              className="w-full sm:w-auto"
            >
              {isEditMode ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
