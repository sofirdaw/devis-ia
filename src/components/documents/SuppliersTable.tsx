/**
 * SuppliersTable — Tableau des fournisseurs
 *
 * Affiche la liste des fournisseurs avec actions de modification/suppression
 */

"use client";

import Link from "next/link";
import { Pencil, Trash2, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useEffect, useState } from "react";
import type { Supplier } from "@/types";
import {
  addToSyncQueue,
  deleteOfflineSupplier,
  getOfflineSuppliers,
  getSyncQueue,
  removeQueuedMutationsForEntity,
  type OfflineSupplier,
} from "@/lib/offline-db";

interface SuppliersTableProps {
  suppliers: Supplier[];
  companyId: string;
}

export function SuppliersTable({ suppliers, companyId }: SuppliersTableProps) {
  const [deleteOpen, setDeleteOpen] = useState<string | null>(null);
  const [offlineSuppliers, setOfflineSuppliers] = useState<OfflineSupplier[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadOffline = async () => {
      const [records, queue] = await Promise.all([getOfflineSuppliers(), getSyncQueue()]);
      if (active) {
        setOfflineSuppliers(records.filter((record) => record.company_id === companyId));
        setDeletedIds((current) => {
          const queuedDeletes = new Set(
            queue
              .filter(
                (item) => item.action === "DELETE_SUPPLIER" && item.payload.company_id === companyId
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

  const combinedSuppliers = [
    ...offlineSuppliers
      .filter(
        (local) =>
          !deletedIds.has(local.id) &&
          (!suppliers.some((supplier) => supplier.id === local.id) ||
            local.sync_status === "pending_create" ||
            local.sync_status === "pending_update")
      )
      .map((local): Supplier => ({
        id: local.id,
        company_id: companyId,
        name: local.name,
        phone: local.phone ?? null,
        email: local.email ?? null,
        address: local.address ?? null,
        created_at: local.created_at,
      })),
    ...suppliers.filter((supplier) => !deletedIds.has(supplier.id)),
  ];

  const handleDelete = async (id: string) => {
    setActionError(null);
    if (!navigator.onLine) {
      const queue = await getSyncQueue();
      const pendingCreate = queue.find(
        (item) =>
          item.action === "CREATE_SUPPLIER" &&
          (item.payload.local_supplier as OfflineSupplier | undefined)?.id === id
      );
      try {
        if (pendingCreate) {
          await removeQueuedMutationsForEntity(["CREATE_SUPPLIER", "UPDATE_SUPPLIER"], id);
        } else {
          await addToSyncQueue("DELETE_SUPPLIER", { company_id: companyId, id });
        }
        await deleteOfflineSupplier(id);
        setDeletedIds((current) => new Set(current).add(id));
        setDeleteOpen(null);
      } catch (error) {
        console.error("Erreur de suppression locale du fournisseur:", error);
        setActionError("Impossible de supprimer ce fournisseur hors ligne.");
      }
      return;
    }

    const { deleteSupplierAction } = await import("@/app/actions/suppliers");
    const result = await deleteSupplierAction(id);
    if (result.error) {
      setActionError(result.error);
    } else {
      setDeleteOpen(null);
    }
  };

  if (combinedSuppliers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 lg:p-8 text-center">
        <p className="text-gray-500">Aucun fournisseur pour le moment.</p>
      </div>
    );
  }

  return (
    <>
      {actionError && (
        <div
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {actionError}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="text-left px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Adresse
                </th>
                <th className="text-right px-4 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {combinedSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4">
                    <Link
                      href={`/suppliers/${supplier.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {supplier.name}
                    </Link>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="space-y-1">
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone size={14} />
                          {supplier.phone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail size={14} />
                          {supplier.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    {supplier.address && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 max-w-[150px] sm:max-w-[250px] truncate">
                        <MapPin size={14} className="shrink-0" />
                        {supplier.address}
                      </div>
                    )}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/suppliers/${supplier.id}/edit`}>
                        <Button variant="ghost" size="sm" leftIcon={<Pencil size={14} />}>
                          Modifier
                        </Button>
                      </Link>
                      <button
                        onClick={() => setDeleteOpen(supplier.id)}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {deleteOpen && (
        <ConfirmDialog
          open={!!deleteOpen}
          onOpenChange={() => setDeleteOpen(null)}
          title="Supprimer ce fournisseur ?"
          description="Cette action est irréversible. Le fournisseur sera supprimé définitivement."
          onConfirm={() => handleDelete(deleteOpen!)}
        />
      )}
    </>
  );
}
