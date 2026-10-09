/**
 * InvoiceDetailActions — Boutons d'action sur la page de détail d'une facture
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle, Trash2, Pencil, Ban } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { updateInvoiceStatusAction, deleteInvoiceAction } from "@/app/actions/invoices";
import type { InvoiceStatus } from "@/types";
import {
  addToSyncQueue,
  deleteOfflineInvoice,
  getOfflineInvoices,
  getSyncQueue,
  registerBackgroundSync,
  removeQueuedMutationsForEntity,
  saveOfflineInvoice,
  type OfflineInvoice,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";

interface InvoiceDetailActionsProps {
  invoiceId: string;
  currentStatus: InvoiceStatus;
}

export function InvoiceDetailActions({ invoiceId, currentStatus }: InvoiceDetailActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const router = useRouter();

  const changeStatus = (status: InvoiceStatus) => {
    startTransition(async () => {
      if (!navigator.onLine) {
        const companyId = useAuthStore.getState().company?.id;
        const invoice = (await getOfflineInvoices()).find(
          (item) => item.id === invoiceId && item.company_id === companyId
        );
        if (!invoice || !companyId) {
          setActionError("Cette facture n'est pas disponible sur cet appareil hors ligne.");
          return;
        }
        const updatedInvoice = {
          ...invoice,
          status,
          sync_status:
            invoice.sync_status === "pending_create" ? "pending_create" : "pending_update",
        } as const;
        try {
          await saveOfflineInvoice(updatedInvoice);
          await addToSyncQueue("UPDATE_INVOICE_STATUS", {
            company_id: companyId,
            id: invoiceId,
            status,
            local_invoice: updatedInvoice,
          });
          try {
            await registerBackgroundSync();
          } catch {
            // Background Sync is optional.
          }
          router.push("/invoices");
        } catch (error) {
          console.error("Erreur de mise à jour locale de la facture:", error);
          setActionError("Impossible d'enregistrer le statut hors ligne.");
        }
        return;
      }
      await updateInvoiceStatusAction(invoiceId, status);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {currentStatus === "draft" && (
          <Link href={`/invoices/${invoiceId}/edit`}>
            <Button variant="outline" size="sm" leftIcon={<Pencil size={14} />}>
              Modifier
            </Button>
          </Link>
        )}
        {currentStatus === "draft" && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Send size={14} />}
            onClick={() => changeStatus("sent")}
            isLoading={isPending}
          >
            Marquer comme envoyée
          </Button>
        )}

        {(currentStatus === "sent" || currentStatus === "overdue") && (
          <Button
            size="sm"
            leftIcon={<CheckCircle size={14} />}
            onClick={() => changeStatus("paid")}
            isLoading={isPending}
          >
            Marquer comme payée
          </Button>
        )}
        {currentStatus !== "cancelled" && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Ban size={14} />}
            onClick={() => setCancelOpen(true)}
            isLoading={isPending}
          >
            Annuler la facture
          </Button>
        )}

        <button
          onClick={() => setDeleteOpen(true)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Supprimer la facture"
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
        title="Annuler cette facture ?"
        description="La facture et son solde restant seront marqués comme annulés. Les paiements déjà enregistrés seront conservés dans l'historique mais exclus du chiffre d'affaires actif."
        onConfirm={async () => {
          if (!navigator.onLine) {
            const companyId = useAuthStore.getState().company?.id;
            const invoice = (await getOfflineInvoices()).find(
              (item) => item.id === invoiceId && item.company_id === companyId
            );
            if (!companyId || !invoice) {
              return { error: "Cette facture n'est pas disponible hors ligne." };
            }
            try {
              const updatedInvoice = { ...invoice, status: "cancelled" as const };
              await saveOfflineInvoice({
                ...updatedInvoice,
                sync_status:
                  invoice.sync_status === "pending_create" ? "pending_create" : "pending_update",
              });
              await addToSyncQueue("UPDATE_INVOICE_STATUS", {
                company_id: companyId,
                id: invoiceId,
                status: "cancelled",
                local_invoice: updatedInvoice,
              });
              await registerBackgroundSync();
              router.push("/invoices");
              return { success: true };
            } catch (error) {
              console.error("Erreur d'annulation locale de la facture:", error);
              return { error: "Impossible d'annuler la facture hors ligne." };
            }
          }
          const result = await updateInvoiceStatusAction(invoiceId, "cancelled");
          if (!result.error) router.refresh();
          return result;
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cette facture ?"
        description="Cette action est irréversible."
        onConfirm={async () => {
          if (!navigator.onLine) {
            const companyId = useAuthStore.getState().company?.id;
            if (!companyId) return { error: "Entreprise introuvable hors ligne." };
            const queue = await getSyncQueue();
            const pendingCreates = queue.filter(
              (item) =>
                item.action === "CREATE_INVOICE" &&
                (item.payload.local_invoice as OfflineInvoice | undefined)?.id === invoiceId
            );
            try {
              if (pendingCreates.length > 0) {
                await removeQueuedMutationsForEntity(
                  ["CREATE_INVOICE", "UPDATE_INVOICE", "UPDATE_INVOICE_STATUS"],
                  invoiceId
                );
              } else {
                await addToSyncQueue("DELETE_INVOICE", { company_id: companyId, id: invoiceId });
              }
              await deleteOfflineInvoice(invoiceId);
              router.push("/invoices");
              return { success: true };
            } catch (error) {
              console.error("Erreur de suppression locale de la facture:", error);
              return { error: "Impossible de supprimer la facture hors ligne." };
            }
          }
          const result = await deleteInvoiceAction(invoiceId);
          if (!result.error) router.push("/invoices");
          return result;
        }}
      />
    </>
  );
}
