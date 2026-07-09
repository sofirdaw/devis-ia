/**
 * SupplierForm — Formulaire de création/édition de fournisseur
 */

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/app/actions/suppliers";
import type { ActionResult } from "@/app/actions/auth";
import type { Supplier } from "@/types";

interface SupplierFormProps {
  supplier?: Supplier;
}

const initialState: ActionResult = {};

export function SupplierForm({ supplier }: SupplierFormProps) {
  const isEditing = !!supplier;
  const action = isEditing
    ? (prevState: ActionResult, formData: FormData) =>
        updateSupplierAction(prevState, formData, supplier.id)
    : createSupplierAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
          <Input
            name="name"
            label="Nom du fournisseur"
            placeholder="Ex: TechSolutions SARL"
            defaultValue={supplier?.name ?? ""}
            required
          />

          <Input
            name="phone"
            type="tel"
            label="Téléphone (optionnel)"
            placeholder="Ex: +226 00 00 00 00"
            defaultValue={supplier?.phone ?? ""}
          />

          <Input
            name="email"
            type="email"
            label="Email (optionnel)"
            placeholder="Ex: contact@techsolutions.com"
            defaultValue={supplier?.email ?? ""}
          />

          <Textarea
            name="address"
            label="Adresse (optionnel)"
            rows={3}
            placeholder="Ex: Ouagadougou, pissy, Burkina faso"
            defaultValue={supplier?.address ?? ""}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 lg:pt-6 border-t border-gray-100 mt-6 lg:mt-8">
          <Link href="/suppliers">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
          </Link>
          <Button
            type="submit"
            size="lg"
            isLoading={isPending}
            className="w-full sm:w-auto px-8 lg:px-10 shadow-lg"
          >
            {isPending
              ? "Enregistrement..."
              : isEditing
                ? "Enregistrer les modifications"
                : "Créer le fournisseur"}
          </Button>
        </div>
      </div>
    </form>
  );
}
