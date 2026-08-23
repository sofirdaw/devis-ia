/**
 * PaymentForm — Formulaire d'ajout de paiement
 */

"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addPaymentAction } from "@/app/actions/receivables";
import type { ActionResult } from "@/app/actions/auth";

interface PaymentFormProps {
  receivableId: string;
  remainingAmount: number;
}

const initialState: ActionResult = {};

export function PaymentForm({ receivableId, remainingAmount }: PaymentFormProps) {
  const [state, formAction, isPending] = useActionState(addPaymentAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="receivableId" value={receivableId} />

      {state.error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {state.success && (
        <div
          className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm"
          role="alert"
        >
          Paiement ajouté avec succès
        </div>
      )}

      <Input
        name="amount"
        type="number"
        step="0.01"
        label="Montant du paiement"
        placeholder={`Max: ${remainingAmount}`}
        max={remainingAmount}
        min="0.01"
        required
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Mode de paiement
          <span className="text-danger-500 ml-1">*</span>
        </label>
        <select
          name="payment_method"
          required
          className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 text-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent hover:border-gray-400 transition-colors"
        >
          <option value="cash">Espèces</option>
          <option value="transfer">Virement</option>
          <option value="check">Chèque</option>
          <option value="card">Carte bancaire</option>
          <option value="other">Autre</option>
        </select>
      </div>

      <Input name="payment_date" type="date" label="Date de paiement" required />

      <Input
        name="reference"
        label="Référence (optionnel)"
        placeholder="Ex: Réf banque, numéro de chèque"
      />

      <Input name="notes" label="Notes (optionnel)" placeholder="Détails supplémentaires" />

      <Button type="submit" size="lg" isLoading={isPending} className="w-full">
        {isPending ? "Enregistrement..." : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}
