/**
 * ClientFormDialog — Modale d'ajout/modification d'un client
 *
 * Composant unique pour les deux cas (création + édition) :
 * - Si `client` est fourni → mode édition (formulaire pré-rempli)
 * - Si `client` est absent → mode création (formulaire vide)
 */

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClientAction, updateClientAction } from "@/app/actions/clients";
import { OfflineActionNotice } from "@/components/pwa/OfflineActionNotice";
import {
  getOfflineClients,
  saveOfflineClient,
  addToSyncQueue,
  registerBackgroundSync,
} from "@/lib/offline-db";
import type { ActionResult } from "@/app/actions/auth";
import type { Client } from "@/types";
import { useAuthStore } from "@/store/auth.store";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client; // Si fourni → mode édition
}

const initialState: ActionResult = {};

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const isEditMode = !!client;

  // Sélectionne la bonne Server Action selon le mode
  const action = isEditMode ? updateClientAction.bind(null, client.id) : createClientAction;

  const [state, formAction, isPending] = useActionState(action, initialState);

  const formRef = useRef<HTMLFormElement | null>(null);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      e.preventDefault();
      setIsSavingOffline(true);

      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const name = String(fd.get("name") ?? "").trim();
      const phone = String(fd.get("phone") ?? "").trim();
      const email = String(fd.get("email") ?? "").trim();
      const address = String(fd.get("address") ?? "").trim();
      const companyId = useAuthStore.getState().company?.id;
      if (!companyId) {
        setOfflineError("Entreprise introuvable. Reconnectez-vous avant de modifier le client.");
        setIsSavingOffline(false);
        return;
      }

      if (isEditMode) {
        const localClients = await getOfflineClients();
        const existingClient = localClients.find(
          (record) => record.id === client.id && record.company_id === companyId
        );
        if (!existingClient) {
          setOfflineError(
            "Les données de ce client ne sont pas enregistrées sur cet appareil. Reconnectez-vous pour les synchroniser."
          );
          setIsSavingOffline(false);
          return;
        }
        const updatedClient = {
          ...existingClient,
          name,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          sync_status:
            existingClient.sync_status === "pending_create" ? "pending_create" : "pending_update",
        } as const;
        try {
          await saveOfflineClient(updatedClient);
          await addToSyncQueue("UPDATE_CLIENT", {
            company_id: companyId,
            id: client.id,
            name,
            phone: phone || null,
            email: email || null,
            address: address || null,
            local_client: updatedClient,
          });
          try {
            await registerBackgroundSync();
          } catch {
            // Background Sync is optional.
          }
          setIsSavingOffline(false);
          onOpenChange(false);
        } catch (error) {
          console.error("Erreur de modification hors-ligne du client:", error);
          setOfflineError("Impossible d'enregistrer les modifications sur cet appareil.");
          setIsSavingOffline(false);
        }
        return;
      }

      const localId = crypto.randomUUID();

      const offlineClient = {
        id: localId,
        company_id: companyId,
        name,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        created_at: new Date().toISOString(),
        sync_status: "pending_create" as const,
      };

      try {
        await saveOfflineClient(offlineClient);
        await addToSyncQueue("CREATE_CLIENT", {
          company_id: companyId,
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          local_client: offlineClient,
        });

        try {
          await registerBackgroundSync();
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("Erreur enregistrant client hors-ligne:", err);
        setOfflineError("Impossible d'enregistrer ce client sur cet appareil.");
        setIsSavingOffline(false);
        return;
      }

      setIsSavingOffline(false);
      onOpenChange(false);
    }
  };

  // Fermer la modale automatiquement après un succès
  useEffect(() => {
    if (state.success) {
      onOpenChange(false);
    }
  }, [state.success, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditMode ? "Modifier le client" : "Ajouter un client"}
        description={
          isEditMode
            ? "Mettez à jour les informations du client"
            : "Renseignez les informations du nouveau client"
        }
      >
        <OfflineActionNotice />

        {state.error && (
          <div
            className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-4 text-sm"
            role="alert"
          >
            {state.error}
          </div>
        )}
        {offlineError && (
          <div
            className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-4 text-sm"
            role="alert"
          >
            {offlineError}
          </div>
        )}

        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="name"
            label="Nom complet"
            placeholder="Moussa Traoré"
            defaultValue={client?.name}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="phone"
              type="tel"
              label="Téléphone"
              placeholder="+226 70 00 00 00"
              defaultValue={client?.phone ?? ""}
            />
            <Input
              name="email"
              type="email"
              label="Email"
              placeholder="client@exemple.com"
              defaultValue={client?.email ?? ""}
            />
          </div>

          <Input
            name="address"
            label="Adresse"
            placeholder="Ouagadougou, secteur 15"
            defaultValue={client?.address ?? ""}
          />

          <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              isLoading={isPending || isSavingOffline}
              className="w-full sm:w-auto"
            >
              {isEditMode ? "Enregistrer" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
