/**
 * DeletePaymentButton — Bouton de suppression de paiement (Client Component)
 */

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deletePaymentAction } from "@/app/actions/receivables";
import {
  addToSyncQueue,
  getOfflineSnapshot,
  getSyncQueue,
  removeFromSyncQueue,
  saveOfflineSnapshot,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";

interface DeletePaymentButtonProps {
  paymentId: string;
  receivableId: string;
}

export function DeletePaymentButton({ paymentId, receivableId }: DeletePaymentButtonProps) {
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const companyId = useAuthStore((state) => state.company?.id);

  const handleDelete = async () => {
    setError(null);
    if (navigator.onLine) {
      const formData = new FormData();
      formData.append("paymentId", paymentId);
      formData.append("receivableId", receivableId);
      try {
        await deletePaymentAction(formData);
        setDeleted(true);
      } catch (deleteError) {
        console.error("Échec de suppression du paiement:", deleteError);
        setError("Impossible de supprimer ce paiement.");
      }
      return;
    }

    if (!companyId) {
      setError("Entreprise locale introuvable.");
      return;
    }
    try {
      const [snapshot, queue] = await Promise.all([getOfflineSnapshot(companyId), getSyncQueue()]);
      const receivable = snapshot?.receivables.find((item) => item.id === receivableId);
      const payment = receivable?.payment_transactions?.find((item) => item.id === paymentId);
      if (!snapshot || !receivable || !payment) {
        throw new Error("Ce paiement n'est pas disponible localement.");
      }

      const pendingCreate = queue.find(
        (item) =>
          item.action === "ADD_PAYMENT" &&
          item.payload.offline_sync_id === (payment.offline_sync_id ?? payment.id) &&
          item.payload.company_id === companyId
      );
      const deleteQueueId = pendingCreate
        ? null
        : await addToSyncQueue("DELETE_PAYMENT", {
            company_id: companyId,
            payment_id: paymentId,
            receivable_id: receivableId,
          });

      const paidAmount = Math.max(0, Number(receivable.paid_amount) - Number(payment.amount));
      const remainingAmount = Math.max(0, Number(receivable.total_amount) - paidAmount);
      const today = new Date().toISOString().slice(0, 10);
      try {
        await saveOfflineSnapshot({
          ...snapshot,
          receivables: snapshot.receivables.map((item) =>
            item.id === receivableId
              ? {
                  ...item,
                  paid_amount: paidAmount,
                  remaining_amount: remainingAmount,
                  status:
                    remainingAmount === 0
                      ? "paid"
                      : paidAmount > 0
                        ? "partial"
                        : item.due_date && item.due_date < today
                          ? "overdue"
                          : "pending",
                  payment_transactions: item.payment_transactions?.filter(
                    (transaction) => transaction.id !== paymentId
                  ),
                }
              : item
          ),
        });
      } catch (saveError) {
        if (deleteQueueId) await removeFromSyncQueue(deleteQueueId);
        throw saveError;
      }
      if (pendingCreate) await removeFromSyncQueue(pendingCreate.id);
      setDeleted(true);
    } catch (deleteError) {
      console.error("Erreur de suppression locale du paiement:", deleteError);
      setError(
        deleteError instanceof Error ? deleteError.message : "Impossible de supprimer ce paiement."
      );
    }
  };

  if (deleted) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        className="text-gray-400 hover:text-red-600 transition-colors"
        title="Supprimer ce paiement"
      >
        <Trash2 size={16} />
      </button>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
