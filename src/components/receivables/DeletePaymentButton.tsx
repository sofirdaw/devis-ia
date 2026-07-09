/**
 * DeletePaymentButton — Bouton de suppression de paiement (Client Component)
 */

"use client";

import { Trash2 } from "lucide-react";
import { deletePaymentAction } from "@/app/actions/receivables";

interface DeletePaymentButtonProps {
  paymentId: string;
  receivableId: string;
}

export function DeletePaymentButton({ paymentId, receivableId }: DeletePaymentButtonProps) {
  return (
    <form action={deletePaymentAction}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="receivableId" value={receivableId} />
      <button
        type="submit"
        className="text-gray-400 hover:text-red-600 transition-colors"
        title="Supprimer ce paiement"
      >
        <Trash2 size={16} />
      </button>
    </form>
  );
}
