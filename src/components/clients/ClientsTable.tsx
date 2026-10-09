/**
 * ClientsTable — Tableau interactif des clients
 *
 * Composant client qui gère :
 * - L'affichage de la liste
 * - La recherche en temps réel (filtrage local, pas de requête réseau)
 * - L'ouverture des modales d'édition/suppression
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Pencil, Trash2, Phone, Mail, MapPin, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "./ClientFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteClientAction } from "@/app/actions/clients";
import { formatDate } from "@/lib/utils";
import type { Client } from "@/types";
import {
  addToSyncQueue,
  deleteOfflineClient,
  getOfflineClients,
  getSyncQueue,
  removeQueuedMutationsForEntity,
  type OfflineClient,
} from "@/lib/offline-db";

interface ClientsTableProps {
  initialClients: Client[];
  companyId: string;
}

export function ClientsTable({ initialClients, companyId }: ClientsTableProps) {
  const [search, setSearch] = useState("");
  const [offlineClients, setOfflineClients] = useState<OfflineClient[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [deletingClient, setDeletingClient] = useState<Client | undefined>();

  useEffect(() => {
    let active = true;
    const loadOffline = async () => {
      const clients = await getOfflineClients();
      const queue = await getSyncQueue();
      if (!active) return;
      setOfflineClients(clients.filter((client) => client.company_id === companyId));
      setDeletedIds((current) => {
        const queuedDeletes = new Set(
          queue
            .filter(
              (item) => item.action === "DELETE_CLIENT" && item.payload.company_id === companyId
            )
            .map((item) => String(item.payload.id))
        );
        return new Set([...current, ...queuedDeletes]);
      });
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

  const combinedClients = useMemo(() => {
    const serverIds = new Set(initialClients.map((client) => client.id));
    const localClients: Client[] = offlineClients
      .filter(
        (client) =>
          (!deletedIds.has(client.id) && !serverIds.has(client.id)) ||
          (!deletedIds.has(client.id) &&
            (client.sync_status === "pending_create" || client.sync_status === "pending_update"))
      )
      .map((client) => ({
        id: client.id,
        company_id: companyId,
        name: client.name,
        phone: client.phone ?? null,
        email: client.email ?? null,
        address: client.address ?? null,
        created_at: client.created_at,
      }));
    const localIds = new Set(localClients.map((client) => client.id));
    return [
      ...localClients,
      ...initialClients.filter((client) => !localIds.has(client.id) && !deletedIds.has(client.id)),
    ];
  }, [companyId, deletedIds, initialClients, offlineClients]);

  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    setActionError(null);
    if (navigator.onLine) {
      const result = await deleteClientAction(deletingClient.id);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setDeletingClient(undefined);
      return;
    }

    const queue = await getSyncQueue();
    const pendingCreate = queue.find(
      (item) =>
        item.action === "CREATE_CLIENT" &&
        (item.payload.local_client as OfflineClient | undefined)?.id === deletingClient.id
    );
    try {
      if (pendingCreate) {
        await removeQueuedMutationsForEntity(["CREATE_CLIENT", "UPDATE_CLIENT"], deletingClient.id);
      } else {
        await addToSyncQueue("DELETE_CLIENT", {
          company_id: companyId,
          id: deletingClient.id,
        });
      }
      await deleteOfflineClient(deletingClient.id);
      setDeletedIds((current) => new Set(current).add(deletingClient.id));
      setDeletingClient(undefined);
    } catch (error) {
      console.error("Erreur de suppression locale du client:", error);
      setActionError("Impossible de supprimer ce client hors ligne.");
    }
  };

  // Filtrage local — recherche par nom, téléphone ou email
  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return combinedClients;

    return combinedClients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
  }, [combinedClients, search]);

  const openCreateForm = () => {
    setEditingClient(undefined);
    setFormOpen(true);
  };

  const openEditForm = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  return (
    <>
      {/* Barre d'actions : recherche + bouton ajouter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Rechercher un client..."
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
        <Button leftIcon={<Plus size={16} />} onClick={openCreateForm} className="w-full sm:w-auto">
          Ajouter un client
        </Button>
      </div>

      {/* État vide */}
      {filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 lg:py-16 text-center">
          <Users size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {search ? "Aucun client trouvé pour cette recherche" : "Aucun client pour le moment"}
          </p>
          {!search && (
            <Button variant="outline" size="sm" className="mt-4" onClick={openCreateForm}>
              Ajouter votre premier client
            </Button>
          )}
        </div>
      ) : (
        /* Tableau des clients */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Nom</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Contact</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">Adresse</th>
                  <th className="text-left font-medium text-gray-500 px-4 sm:px-5 py-3">
                    Ajouté le
                  </th>
                  <th className="text-right font-medium text-gray-500 px-4 sm:px-5 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 sm:px-5 py-3 font-medium text-gray-900">
                      <span className="block max-w-35 sm:max-w-55 truncate">{client.name}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-gray-600">
                      <div className="space-y-0.5 max-w-35 sm:max-w-50">
                        {client.phone && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone size={12} className="text-gray-400 shrink-0" />
                            <span className="min-w-0 truncate">{client.phone}</span>
                          </div>
                        )}
                        {client.email && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail size={12} className="text-gray-400 shrink-0" />
                            <span className="min-w-0 truncate">{client.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-gray-600">
                      {client.address ? (
                        <div className="flex items-center gap-1.5 text-xs max-w-37.5 sm:max-w-50">
                          <MapPin size={12} className="text-gray-400 shrink-0" />
                          <span className="min-w-0 truncate">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-4 sm:px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEditForm(client)}
                          className="p-1.5 min-h-9 min-w-9 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          aria-label="Modifier"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingClient(client)}
                          className="p-1.5 min-h-9 min-w-9 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          aria-label="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale de création/édition */}
      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editingClient} />

      {/* Modale de confirmation suppression */}
      {deletingClient && (
        <ConfirmDialog
          open={!!deletingClient}
          onOpenChange={(open) => !open && setDeletingClient(undefined)}
          title="Supprimer ce client ?"
          description={`"${deletingClient.name}" sera définitivement supprimé. Cette action est irréversible.`}
          onConfirm={handleDeleteClient}
        />
      )}
    </>
  );
}
