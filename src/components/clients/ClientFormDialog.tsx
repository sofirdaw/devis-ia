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
import { saveOfflineClient, addToSyncQueue, registerBackgroundSync } from "@/lib/offline-db";
import type { ActionResult } from "@/app/actions/auth";
import type { Client } from "@/types";

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      // Only allow creating clients offline for now
      if (isEditMode) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      setIsSavingOffline(true);

      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const name = String(fd.get("name") ?? "").trim();
      const phone = String(fd.get("phone") ?? "").trim();
      const email = String(fd.get("email") ?? "").trim();
      const address = String(fd.get("address") ?? "").trim();

      const localId = `off_${Date.now()}`;

      const offlineClient = {
        id: localId,
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
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          local_client: offlineClient,
        });

        try {
          await registerBackgroundSync();
        } catch (err) {
          // ignore
        }
      } catch (err) {
        console.error("Erreur enregistrant client hors-ligne:", err);
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
