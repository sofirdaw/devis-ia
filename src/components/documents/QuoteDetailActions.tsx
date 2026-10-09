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
import { Send, Check, X, FileOutput, Trash2, Pencil, Ban } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  updateQuoteStatusAction,
  deleteQuoteAction,
  convertQuoteToInvoiceAction,
} from "@/app/actions/quotes";
import type { QuoteStatus } from "@/types";
import {
  addToSyncQueue,
  deleteOfflineQuote,
  getOfflineQuotes,
  getSyncQueue,
  registerBackgroundSync,
  removeQueuedMutationsForEntity,
  saveOfflineQuote,
  type OfflineQuote,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";

interface QuoteDetailActionsProps {
  quoteId: string;
  currentStatus: QuoteStatus;
}

export function QuoteDetailActions({ quoteId, currentStatus }: QuoteDetailActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  const changeStatus = (status: QuoteStatus) => {
    startTransition(async () => {
      if (!navigator.onLine) {
        const companyId = useAuthStore.getState().company?.id;
        const quote = (await getOfflineQuotes()).find(
          (item) => item.id === quoteId && item.company_id === companyId
        );
        if (!quote || !companyId) {
          setActionError("Ce devis n'est pas disponible sur cet appareil hors ligne.");
          return;
        }
        const updatedQuote = {
          ...quote,
          status,
          sync_status: quote.sync_status === "pending_create" ? "pending_create" : "pending_update",
        } as const;
        try {
          await saveOfflineQuote(updatedQuote);
          await addToSyncQueue("UPDATE_QUOTE_STATUS", {
            company_id: companyId,
            id: quoteId,
            status,
            local_quote: updatedQuote,
          });
          try {
            await registerBackgroundSync();
          } catch {
            // Background Sync is optional.
          }
          router.push("/quotes");
        } catch (error) {
          console.error("Erreur de mise à jour locale du devis:", error);
          setActionError("Impossible d'enregistrer le statut hors ligne.");
        }
        return;
      }
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
      <div className="flex items-center gap-2 flex-wrap">
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
        {currentStatus !== "cancelled" && currentStatus !== "refused" && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Ban size={14} />}
            onClick={() => setCancelOpen(true)}
            disabled={isPending}
          >
            Annuler le devis
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
      {actionError && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {actionError}
        </p>
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Annuler ce devis ?"
        description="Le devis sera marqué comme annulé et ne sera plus pris en compte dans les montants actifs du tableau de bord."
        onConfirm={async () => {
          if (!navigator.onLine) {
            const companyId = useAuthStore.getState().company?.id;
            const quote = (await getOfflineQuotes()).find(
              (item) => item.id === quoteId && item.company_id === companyId
            );
            if (!companyId || !quote) return { error: "Ce devis n'est pas disponible hors ligne." };
            try {
              const updatedQuote = { ...quote, status: "cancelled" as const };
              await saveOfflineQuote({
                ...updatedQuote,
                sync_status:
                  quote.sync_status === "pending_create" ? "pending_create" : "pending_update",
              });
              await addToSyncQueue("UPDATE_QUOTE_STATUS", {
                company_id: companyId,
                id: quoteId,
                status: "cancelled",
                local_quote: updatedQuote,
              });
              await registerBackgroundSync();
              router.push("/quotes");
              return { success: true };
            } catch (error) {
              console.error("Erreur d'annulation locale du devis:", error);
              return { error: "Impossible d'annuler le devis hors ligne." };
            }
          }
          const result = await updateQuoteStatusAction(quoteId, "cancelled");
          if (!result.error) router.refresh();
          return result;
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce devis ?"
        description="Cette action est irréversible. Le devis et ses lignes seront supprimés définitivement."
        onConfirm={async () => {
          if (!navigator.onLine) {
            const companyId = useAuthStore.getState().company?.id;
            if (!companyId) return { error: "Entreprise introuvable hors ligne." };
            const queue = await getSyncQueue();
            const pendingCreates = queue.filter(
              (item) =>
                item.action === "CREATE_QUOTE" &&
                (item.payload.local_quote as OfflineQuote | undefined)?.id === quoteId
            );
            try {
              if (pendingCreates.length > 0) {
                await removeQueuedMutationsForEntity(
                  ["CREATE_QUOTE", "UPDATE_QUOTE", "UPDATE_QUOTE_STATUS"],
                  quoteId
                );
              } else {
                await addToSyncQueue("DELETE_QUOTE", { company_id: companyId, id: quoteId });
              }
              await deleteOfflineQuote(quoteId);
              router.push("/quotes");
              return { success: true };
            } catch (error) {
              console.error("Erreur de suppression locale du devis:", error);
              return { error: "Impossible de supprimer le devis hors ligne." };
            }
          }
          const result = await deleteQuoteAction(quoteId);
          if (!result.error) router.push("/quotes");
          return result;
        }}
      />
    </>
  );
}
