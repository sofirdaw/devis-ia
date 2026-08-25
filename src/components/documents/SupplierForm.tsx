/**
 * SupplierForm — Formulaire de création/édition de fournisseur
 */

"use client"; 
import { useRef, useState } from "react";

import { useActionState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createSupplierAction, updateSupplierAction } from "@/app/actions/suppliers";
import type { ActionResult } from "@/app/actions/auth";
import type { Supplier } from "@/types";
import { OfflineActionNotice } from "@/components/pwa/OfflineActionNotice";
import { saveOfflineSupplier, addToSyncQueue, registerBackgroundSync } from "@/lib/offline-db";
import { useRouter } from "next/navigation";

interface SupplierFormProps {
  supplier?: Supplier;
}

const initialState: ActionResult = {};

export function SupplierForm({ supplier }: SupplierFormProps) {
  const isEditing = !!supplier;
  const action = isEditing
    ? (prevState: ActionResult, formData: FormData) =>
        updateSupplierAction(prevState, formData, supplier.id)
    : createSupplierAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      e.preventDefault();
      if (isEditing) {
        setLocalError("Impossible de modifier un fournisseur hors-ligne.");
        return;
      }

      setIsSavingOffline(true);
      const fd = new FormData(e.currentTarget as HTMLFormElement);
      const name = String(fd.get("name") ?? "").trim();
      const phone = String(fd.get("phone") ?? "").trim();
      const email = String(fd.get("email") ?? "").trim();
      const address = String(fd.get("address") ?? "").trim();

      const localId = `off_sup_${Date.now()}`;
      const offlineSupplier = {
        id: localId,
        name,
        contact_name: undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
        created_at: new Date().toISOString(),
        sync_status: "pending_create" as const,
      };

      try {
        await saveOfflineSupplier(offlineSupplier);
        await addToSyncQueue("CREATE_SUPPLIER", {
          name,
          phone: phone || null,
          email: email || null,
          address: address || null,
          local_supplier: offlineSupplier,
        });

        try {
          await registerBackgroundSync();
        } catch (err) {
          // ignore
        }
      } catch (err) {
        console.error("Erreur enregistrant fournisseur hors-ligne:", err);
      }

      setIsSavingOffline(false);
      router.push("/suppliers");
    }
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <OfflineActionNotice />
      {state.error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {localError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm" role="alert">
          {localError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
          <Input
            name="name"
            label="Nom du fournisseur"
            placeholder="Ex: TechSolutions SARL"
            defaultValue={supplier?.name ?? ""}
            required
          />

          <Input
            name="phone"
            type="tel"
            label="Téléphone (optionnel)"
            placeholder="Ex: +226 00 00 00 00"
            defaultValue={supplier?.phone ?? ""}
          />

          <Input
            name="email"
            type="email"
            label="Email (optionnel)"
            placeholder="Ex: contact@techsolutions.com"
            defaultValue={supplier?.email ?? ""}
          />

          <Textarea
            name="address"
            label="Adresse (optionnel)"
            rows={3}
            placeholder="Ex: Ouagadougou, pissy, Burkina faso"
            defaultValue={supplier?.address ?? ""}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-4 lg:pt-6 border-t border-gray-100 mt-6 lg:mt-8">
          <Link href="/suppliers">
            <Button type="button" variant="outline" className="w-full sm:w-auto">
              Annuler
            </Button>
          </Link>
          <Button
            type="submit"
            size="lg"
            isLoading={isPending || isSavingOffline}
            className="w-full sm:w-auto px-8 lg:px-10 shadow-lg"
          >
            {isPending
              ? "Enregistrement..."
              : isEditing
                ? "Enregistrer les modifications"
                : "Créer le fournisseur"}
          </Button>
        </div>
      </div>
    </form>
  );
}
