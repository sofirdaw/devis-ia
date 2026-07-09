/**
 * ReceivableFormDialog — Formulaire d'édition de créance
 */

"use client";

import { useActionState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateReceivableAction } from "@/app/actions/receivables";
import type { ActionResult } from "@/app/actions/auth";
import type { Receivable } from "@/types";

interface ReceivableFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivable: Receivable;
}

const initialState: ActionResult = {};

export function ReceivableFormDialog({ open, onOpenChange, receivable }: ReceivableFormDialogProps) {
  const [state, formAction, isPending] = useActionState(
    (prevState: ActionResult, formData: FormData) => updateReceivableAction(receivable.id, prevState, formData),
    initialState
  );

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Modifier la créance">
        <form action={formAction} className="space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm" role="alert">
              {state.error}
            </div>
          )}

          {state.success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm" role="alert">
              Créance mise à jour avec succès
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
