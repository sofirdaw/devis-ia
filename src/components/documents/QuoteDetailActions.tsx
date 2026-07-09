/**
 * QuoteDetailActions — Boutons d'action sur la page de détail d'un devis
 *
 * - Changer le statut (brouillon → envoyé → accepté/refusé)
 * - Convertir en facture (si accepté)
 * - Supprimer
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Check, X, FileOutput, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  updateQuoteStatusAction,
  deleteQuoteAction,
  convertQuoteToInvoiceAction,
} from "@/app/actions/quotes";
import type { QuoteStatus } from "@/types";

interface QuoteDetailActionsProps {
  quoteId: string;
  currentStatus: QuoteStatus;
}

export function QuoteDetailActions({ quoteId, currentStatus }: QuoteDetailActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  const changeStatus = (status: QuoteStatus) => {
    startTransition(async () => {
      await updateQuoteStatusAction(quoteId, status);
      router.refresh();
    });
  };

  const convertToInvoice = () => {
    startTransition(async () => {
      await convertQuoteToInvoiceAction(quoteId);
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Bouton Modifier (brouillons uniquement) */}
        {currentStatus === "draft" && (
          <Link href={`/quotes/${quoteId}/edit`}>
            <Button variant="outline" size="sm" leftIcon={<Pencil size={14} />}>
              Modifier
            </Button>
          </Link>
        )}
        {/* Actions de changement de statut selon le statut actuel */}
        {currentStatus === "draft" && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Send size={14} />}
            onClick={() => changeStatus("sent")}
            isLoading={isPending}
          >
            Marquer comme envoyé
          </Button>
        )}

        {currentStatus === "sent" && (
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Check size={14} />}
              onClick={() => changeStatus("accepted")}
              isLoading={isPending}
            >
              Accepté
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<X size={14} />}
              onClick={() => changeStatus("refused")}
              isLoading={isPending}
            >
              Refusé
            </Button>
            <Button
              size="sm"
              leftIcon={<FileOutput size={14} />}
              onClick={convertToInvoice}
              isLoading={isPending}
            >
              Convertir en facture
            </Button>
          </>
        )}

        {currentStatus === "accepted" && (
          <Button
            size="sm"
            leftIcon={<FileOutput size={14} />}
            onClick={convertToInvoice}
            isLoading={isPending}
          >
            Convertir en facture
          </Button>
        )}

        {/* Suppression toujours disponible */}
        <button
          onClick={() => setDeleteOpen(true)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Supprimer le devis"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce devis ?"
        description="Cette action est irréversible. Le devis et ses lignes seront supprimés définitivement."
        onConfirm={async () => {
          const result = await deleteQuoteAction(quoteId);
          if (!result.error) router.push("/quotes");
          return result;
        }}
      />
    </>
  );
}
