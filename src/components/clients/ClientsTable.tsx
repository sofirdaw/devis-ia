/**
 * ClientsTable — Tableau interactif des clients
 *
 * Composant client qui gère :
 * - L'affichage de la liste
 * - La recherche en temps réel (filtrage local, pas de requête réseau)
 * - L'ouverture des modales d'édition/suppression
 */

"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Pencil, Trash2, Phone, Mail, MapPin, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "./ClientFormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { deleteClientAction } from "@/app/actions/clients";
import { formatDate } from "@/lib/utils";
import type { Client } from "@/types";

interface ClientsTableProps {
  initialClients: Client[];
}

export function ClientsTable({ initialClients }: ClientsTableProps) {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [deletingClient, setDeletingClient] = useState<Client | undefined>();

  // Filtrage local — recherche par nom, téléphone ou email
  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return initialClients;

    return initialClients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
    );
  }, [initialClients, search]);

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
          onConfirm={() => deleteClientAction(deletingClient.id)}
        />
      )}
    </>
  );
}
