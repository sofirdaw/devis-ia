/**
 * ReceivablesTable — Tableau interactif des créances
 *
 * Composant client qui gère :
 * - L'affichage de la liste des créances
 * - La recherche en temps réel
 * - L'affichage du statut (pending, partial, paid, overdue)
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, DollarSign, Calendar, FileText, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ReceivableFormDialog } from "./ReceivableFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteReceivableAction } from "@/app/actions/receivables";
import type { PaymentTransaction, Receivable } from "@/types";
import {
  addToSyncQueue,
  getOfflineReceivables,
  getSyncQueue,
  removeQueuedMutationsForEntity,
  deleteOfflineReceivable,
  type OfflineReceivable,
} from "@/lib/offline-db";
import { useAuthStore } from "@/store/auth.store";

interface ReceivablesTableProps {
  initialReceivables: Receivable[];
}

const statusConfig = {
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700" },
  partial: { label: "Partiel", color: "bg-blue-100 text-blue-700" },
  paid: { label: "Payé", color: "bg-green-100 text-green-700" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700" },
};

export function ReceivablesTable({ initialReceivables }: ReceivablesTableProps) {
  const [search, setSearch] = useState("");
  const [offlineReceivables, setOfflineReceivables] = useState<OfflineReceivable[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const companyId = useAuthStore((state) => state.company?.id);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | undefined>();
  const [deletingReceivable, setDeletingReceivable] = useState<Receivable | undefined>();

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    const loadOffline = async () => {
      const [receivables, queue] = await Promise.all([getOfflineReceivables(), getSyncQueue()]);
      if (active) {
        setOfflineReceivables(receivables.filter((r) => r.company_id === companyId));
        setDeletedIds((current) => {
          const queuedDeletes = new Set(
            queue
              .filter(
                (item) => item.action === "DELETE_RECEIVABLE" && item.payload.company_id === companyId
              )
              .map((item) => String(item.payload.id))
          );
          return new Set([...current, ...queuedDeletes]);
        });
      }
    };
    loadOffline();
    window.addEventListener("pwa-offline-data-changed", loadOffline);
    window.addEventListener("pwa-sync-complete", loadOffline);
    return () => {
      active = false;
      window.removeEventListener("pwa-offline-data-changed", loadOffline);
      window.removeEventListener("pwa-sync-complete", loadOffline);
    };
  }, [companyId]);

  const receivables = useMemo(() => {
    const serverIds = new Set(initialReceivables.map((item) => item.id));
    const localRows: Receivable[] = offlineReceivables
      .filter(
        (r) =>
          !deletedIds.has(r.id) &&
          (!serverIds.has(r.id) ||
            r.sync_status === "pending_create" ||
            r.sync_status === "pending_update")
      )
      .map((r): Receivable => ({
        id: r.id,
        company_id: companyId ?? r.company_id ?? "",
        invoice_id: r.invoice_id ?? null,
        invoice: r.invoice_number && r.invoice_id
          ? { id: r.invoice_id, invoice_number: r.invoice_number } as Receivable["invoice"]
          : undefined,
        client_id: r.client_id ?? null,
        client: r.client_name && r.client_id
          ? { id: r.client_id, name: r.client_name } as Receivable["client"]
          : undefined,
        total_amount: r.total_amount,
        paid_amount: r.paid_amount,
        remaining_amount: r.remaining_amount,
        due_date: r.due_date ?? null,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at ?? r.created_at,
        payment_transactions: (r.payment_transactions ?? []).map((payment) => ({
          id: payment.id,
          receivable_id: r.id,
          offline_sync_id: null,
          amount: payment.amount,
          payment_method: payment.payment_method as PaymentTransaction["payment_method"],
          payment_date: payment.payment_date,
          reference: payment.reference ?? null,
          notes: payment.notes ?? null,
          created_at: r.created_at,
        })),
      }));
    const localIds = new Set(localRows.map((r) => r.id));
    return [...localRows, ...initialReceivables.filter((r) => !localIds.has(r.id) && !deletedIds.has(r.id))];
  }, [companyId, deletedIds, initialReceivables, offlineReceivables]);

  const handleDeleteReceivable = async (receivable: Receivable) => {
    setActionError(null);
    if (navigator.onLine) {
      const result = await deleteReceivableAction(receivable.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setDeletingReceivable(undefined);
      return;
    }

    const queue = await getSyncQueue();
    const pendingCreate = queue.find(
      (item) =>
        item.action === "CREATE_RECEIVABLE" &&
        (item.payload.local_receivable as OfflineReceivable | undefined)?.id === receivable.id
    );
    try {
      if (pendingCreate) {
        await removeQueuedMutationsForEntity(["CREATE_RECEIVABLE", "UPDATE_RECEIVABLE"], receivable.id);
      } else {
        await addToSyncQueue("DELETE_RECEIVABLE", {
          company_id: companyId,
          id: receivable.id,
        });
      }
      await deleteOfflineReceivable(receivable.id);
      setDeletedIds((current) => new Set(current).add(receivable.id));
      setDeletingReceivable(undefined);
    } catch (error) {
      console.error("Erreur de suppression locale de créance:", error);
      setActionError("Impossible de supprimer cette créance hors ligne.");
    }
  };

  // Filtrage local — recherche par client, facture
  const filteredReceivables = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return receivables;

    return receivables.filter(
      (r) =>
        r.client?.name?.toLowerCase().includes(term) ||
        r.invoice?.invoice_number?.toLowerCase().includes(term)
    );
  }, [receivables, search]);

  return (
    <>
      {/* Barre d'actions : recherche */}
      <div className="flex items-center justify-between mb-5 gap-4">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Rechercher une créance..."
            leftIcon={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {actionError && (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {actionError}
          </div>
        )}
      </div>

      {/* État vide */}
      {filteredReceivables.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 lg:py-16 text-center">
          <DollarSign size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search
              ? "Aucune créance trouvée pour cette recherche"
              : "Aucune créance pour le moment"}
          </p>
        </div>
      ) : (
        /* Tableau des créances */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Facture</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Client</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">
                    Montant total
                  </th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Payé</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Reste</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Statut</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">
                    Échéance
                  </th>
                  <th className="text-right font-medium text-gray-500 px-4 sm:px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReceivables.map((receivable) => {
                  const status = statusConfig[receivable.status as keyof typeof statusConfig];

                  return (
                    <tr key={receivable.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 sm:px-5 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <FileText size={14} className="text-gray-400" />
                          {receivable.invoice?.invoice_number}
                        </div>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-gray-600">{receivable.client?.name}</td>
                      <td className="px-4 sm:px-5 py-3 text-gray-900 font-medium">
                        {formatCurrency(Number(receivable.total_amount))}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-gray-600">
                        {formatCurrency(Number(receivable.paid_amount))}
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-gray-900 font-medium">
                        {formatCurrency(Number(receivable.remaining_amount))}
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <Badge className={status.color}>{status.label}</Badge>
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-gray-600">
                        {receivable.due_date ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Calendar size={12} className="text-gray-400" />
                            {formatDate(receivable.due_date)}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setEditingReceivable(receivable)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            aria-label="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => setDeletingReceivable(receivable)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            aria-label="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                          <Link href={`/receivables/${receivable.id}`}>
                            <button
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              aria-label="Voir détails"
                            >
                              <ArrowRight size={15} />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale d'édition */}
      {editingReceivable && (
        <ReceivableFormDialog
          open={!!editingReceivable}
          onOpenChange={(open) => !open && setEditingReceivable(undefined)}
          receivable={editingReceivable}
        />
      )}

      {/* Modale de confirmation suppression */}
      {deletingReceivable && (
        <ConfirmDialog
          open={!!deletingReceivable}
          onOpenChange={(open) => !open && setDeletingReceivable(undefined)}
          title="Supprimer cette créance ?"
          description={`La créance de la facture "${deletingReceivable.invoice?.invoice_number}" sera définitivement supprimée. Cette action est irréversible.`}
          onConfirm={() => handleDeleteReceivable(deletingReceivable)}
        />
      )}
    </>
  );
}
