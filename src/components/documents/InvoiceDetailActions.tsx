/**
 * InvoiceDetailActions — Boutons d'action sur la page de détail d'une facture
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle, Trash2, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { updateInvoiceStatusAction, deleteInvoiceAction } from "@/app/actions/invoices";
import type { InvoiceStatus } from "@/types";

interface InvoiceDetailActionsProps {
  invoiceId: string;
  currentStatus: InvoiceStatus;
}

export function InvoiceDetailActions({ invoiceId, currentStatus }: InvoiceDetailActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  const changeStatus = (status: InvoiceStatus) => {
    startTransition(async () => {
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

        <button
          onClick={() => setDeleteOpen(true)}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Supprimer la facture"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cette facture ?"
        description="Cette action est irréversible."
        onConfirm={async () => {
          const result = await deleteInvoiceAction(invoiceId);
          if (!result.error) router.push("/invoices");
          return result;
        }}
      />
    </>
  );
}
