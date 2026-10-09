/**
 * PaymentForm — Formulaire d'ajout de paiement
 */

"use client";

import { useActionState, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addPaymentAction } from "@/app/actions/receivables";
import type { ActionResult } from "@/app/actions/auth";
import {
  addToSyncQueue,
  getOfflineSnapshot,
  registerBackgroundSync,
  removeFromSyncQueue,
  saveOfflineSnapshot,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";
import type { PaymentMethod } from "@/types";

interface PaymentFormProps {
  receivableId: string;
  remainingAmount: number;
}

function parsePaymentMethod(value: string): PaymentMethod | null {
  switch (value) {
    case "cash":
    case "transfer":
    case "check":
    case "card":
    case "other":
      return value;
    default:
      return null;
  }
}

const initialState: ActionResult = {};

export function PaymentForm({ receivableId, remainingAmount }: PaymentFormProps) {
  const [state, formAction, isPending] = useActionState(addPaymentAction, initialState);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineSuccess, setOfflineSuccess] = useState(false);
  const offlineSubmitInProgress = useRef(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (navigator.onLine) return;
    event.preventDefault();
    if (offlineSubmitInProgress.current) return;
    offlineSubmitInProgress.current = true;
    setIsSavingOffline(true);
    setOfflineError(null);
    setOfflineSuccess(false);

    const companyId = useAuthStore.getState().company?.id;
    if (!companyId) {
      setOfflineError("Entreprise introuvable. Reconnectez-vous avant d'ajouter un paiement.");
      setIsSavingOffline(false);
      offlineSubmitInProgress.current = false;
      return;
    }

    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const paymentMethod = parsePaymentMethod(String(formData.get("payment_method") ?? ""));
    if (!Number.isFinite(amount) || amount <= 0 || !paymentMethod) {
      setOfflineError("Montant ou mode de paiement invalide.");
      setIsSavingOffline(false);
      offlineSubmitInProgress.current = false;
      return;
    }
    const paymentDate = String(formData.get("payment_date") ?? "");
    if (!paymentDate) {
      setOfflineError("La date de paiement est requise.");
      setIsSavingOffline(false);
      offlineSubmitInProgress.current = false;
      return;
    }

    try {
      const snapshot = await getOfflineSnapshot(companyId);
      const receivable = snapshot?.receivables.find((item) => item.id === receivableId);
      if (!snapshot || !receivable) {
        throw new Error("Cette créance n'a pas été synchronisée sur cet appareil.");
      }
      if (amount > Number(receivable.remaining_amount)) {
        throw new Error(
          `Le montant dépasse le reste à payer (${Number(receivable.remaining_amount)}).`
        );
      }

      const offlineSyncId = crypto.randomUUID();
      const roundedAmount = Math.round(amount * 100) / 100;
      const paidAmount = Math.round((Number(receivable.paid_amount) + roundedAmount) * 100) / 100;
      const remaining = Math.max(
        0,
        Math.round((Number(receivable.total_amount) - paidAmount) * 100) / 100
      );
      const status: (typeof receivable)["status"] =
        remaining === 0
          ? "paid"
          : paidAmount > 0
            ? "partial"
            : receivable.due_date && receivable.due_date < paymentDate
              ? "overdue"
              : "pending";
      const updatedReceivable = {
        ...receivable,
        paid_amount: paidAmount,
        remaining_amount: remaining,
        status,
        payment_transactions: [
          {
            id: offlineSyncId,
            offline_sync_id: offlineSyncId,
            receivable_id: receivableId,
            amount: roundedAmount,
            payment_method: paymentMethod,
            payment_date: paymentDate,
            reference: String(formData.get("reference") ?? "") || null,
            notes: String(formData.get("notes") ?? "") || null,
            created_at: new Date().toISOString(),
          },
          ...(receivable.payment_transactions ?? []),
        ],
      };
      const queueId = await addToSyncQueue("ADD_PAYMENT", {
        company_id: companyId,
        offline_sync_id: offlineSyncId,
        receivable_id: receivableId,
        amount: roundedAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        reference: String(formData.get("reference") ?? "") || null,
        notes: String(formData.get("notes") ?? "") || null,
      });
      try {
        await saveOfflineSnapshot({
          ...snapshot,
          receivables: snapshot.receivables.map((item) =>
            item.id === receivableId ? updatedReceivable : item
          ),
        });
      } catch (error) {
        await removeFromSyncQueue(queueId);
        throw error;
      }

      try {
        await registerBackgroundSync();
      } catch {
        // The online event retries the queued payment if Background Sync is unavailable.
      }
      setOfflineSuccess(true);
    } catch (error) {
      console.error("Erreur d'enregistrement du paiement hors-ligne:", error);
      setOfflineError(
        error instanceof Error ? error.message : "Impossible d'enregistrer le paiement hors ligne."
      );
    } finally {
      setIsSavingOffline(false);
      offlineSubmitInProgress.current = false;
    }
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
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
      {offlineError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {offlineError}
        </div>
      )}
      {offlineSuccess && (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
          role="status"
        >
          Paiement enregistré sur cet appareil. Il sera synchronisé dès le retour du réseau.
        </div>
      )}

      <Input
        name="amount"
        type="number"
        step="0.01"
        label="Montant du paiement"
        placeholder={`Max: ${remainingAmount}`}
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

      <Button type="submit" size="lg" isLoading={isPending || isSavingOffline} className="w-full">
        {isPending || isSavingOffline ? "Enregistrement..." : "Enregistrer le paiement"}
      </Button>
    </form>
  );
}
