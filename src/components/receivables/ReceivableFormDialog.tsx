/**
 * ReceivableFormDialog — Formulaire d'édition de créance
 */

"use client";

import { useActionState, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateReceivableAction } from "@/app/actions/receivables";
import type { ActionResult } from "@/app/actions/auth";
import type { Receivable } from "@/types";
import {
  addToSyncQueue,
  getOfflineSnapshot,
  removeFromSyncQueue,
  saveOfflineSnapshot,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";

interface ReceivableFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: Receivable;
}

const initialState: ActionResult = {};

export function ReceivableFormDialog({
  open,
  onOpenChange,
  receivable,
}: ReceivableFormDialogProps) {
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [state, formAction, isPending] = useActionState(
    (prevState: ActionResult, formData: FormData) =>
      updateReceivableAction(receivable.id, prevState, formData),
    initialState
  );

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (navigator.onLine) return;
    event.preventDefault();
    setOfflineError(null);
    setOfflineSaved(false);

    const companyId = useAuthStore.getState().company?.id;
    if (!companyId) {
      setOfflineError("Entreprise locale introuvable. Reconnectez-vous pour synchroniser.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const totalAmount = Number(formData.get("total_amount"));
    const dueDate = String(formData.get("due_date") ?? "") || null;

    try {
      const snapshot = await getOfflineSnapshot(companyId);
      const current = snapshot?.receivables.find((item) => item.id === receivable.id);
      if (!snapshot || !current) throw new Error("Cette créance n'est pas disponible localement.");
      if (!Number.isFinite(totalAmount) || totalAmount < Number(current.paid_amount)) {
        throw new Error("Le montant total ne peut pas être inférieur au montant déjà payé.");
      }

      const remainingAmount = totalAmount - Number(current.paid_amount);
      const updated = {
        ...current,
        total_amount: totalAmount,
        remaining_amount: remainingAmount,
        due_date: dueDate,
        status:
          remainingAmount === 0
            ? ("paid" as const)
            : Number(current.paid_amount) > 0
              ? ("partial" as const)
              : dueDate && dueDate < new Date().toISOString().slice(0, 10)
                ? ("overdue" as const)
                : ("pending" as const),
        updated_at: new Date().toISOString(),
      };
      const queueId = await addToSyncQueue("UPDATE_RECEIVABLE", {
        company_id: companyId,
        id: receivable.id,
        total_amount: totalAmount,
        due_date: dueDate ?? "",
      });

      try {
        await saveOfflineSnapshot({
          ...snapshot,
          receivables: snapshot.receivables.map((item) =>
            item.id === receivable.id ? updated : item
          ),
        });
      } catch (error) {
        await removeFromSyncQueue(queueId);
        throw error;
      }

      setOfflineSaved(true);
      onOpenChange(false);
    } catch (error) {
      console.error("Erreur de modification locale de la créance:", error);
      setOfflineError(
        error instanceof Error ? error.message : "Impossible d'enregistrer la créance hors ligne."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifier la créance">
        <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
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
              Créance mise à jour avec succès
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
          {offlineSaved && (
            <div
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700"
              role="status"
            >
              Modification enregistrée sur cet appareil et en attente de synchronisation.
            </div>
          )}

          <Input
            name="total_amount"
            type="number"
            step="0.01"
            label="Montant total"
            defaultValue={Number(receivable.total_amount)}
            min={Number(receivable.paid_amount)}
            required
          />

          <Input
            name="due_date"
            type="date"
            label="Date d'échéance"
            defaultValue={receivable.due_date || ""}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
