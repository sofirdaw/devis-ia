/**
 * ConfirmDialog — Modale de confirmation générique
 *
 * Réutilisée partout dans l'app pour confirmer une action destructive
 * (suppression d'un client, d'un produit, d'un devis, etc.)
 */

"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<{ error?: string } | void>;
  confirmLabel?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Supprimer",
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);

    const result = await onConfirm();

    if (result?.error) {
      setError(result.error);
      setIsPending(false);
      return;
    }

    setIsPending(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} size="sm">
        <div className="flex gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-600" />
          </div>
          <p className="text-sm text-gray-600 pt-1.5">{description}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mt-4 text-sm" role="alert">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm} isLoading={isPending}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
