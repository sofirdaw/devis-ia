"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createQuickSupplierAction } from "@/app/actions/suppliers";
import { saveOfflineSupplier, addToSyncQueue, registerBackgroundSync } from "@/lib/offline-db";

interface SupplierQuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierCreated: (supplier: { id: string; name: string }) => void;
}

export function SupplierQuickCreateDialog({
  open,
  onOpenChange,
  onSupplierCreated,
}: SupplierQuickCreateDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (typeof window !== "undefined" && !navigator.onLine) {
      // Offline quick create: save locally and queue sync
      const localId = `off_sup_${Date.now()}`;
      const offlineSupplier = {
        id: localId,
        name: name.trim(),
        contact_name: undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: null,
        created_at: new Date().toISOString(),
        sync_status: "pending_create" as const,
      };

      try {
        await saveOfflineSupplier(offlineSupplier as any);
        await addToSyncQueue("CREATE_SUPPLIER", {
          name: offlineSupplier.name,
          phone: offlineSupplier.phone || null,
          email: offlineSupplier.email || null,
          local_supplier: offlineSupplier,
        });

        try {
          await registerBackgroundSync();
        } catch (err) {
          // ignore
        }

        setLoading(false);
        onSupplierCreated({ id: offlineSupplier.id, name: offlineSupplier.name });
        setName("");
        setPhone("");
        setEmail("");
        onOpenChange(false);
        return;
      } catch (err) {
        console.error("Erreur création rapide fournisseur hors-ligne:", err);
        setLoading(false);
        setError("Impossible de créer le fournisseur hors-ligne");
        return;
      }
    }

    const res = await createQuickSupplierAction(name, phone, email);

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.supplier) {
      onSupplierCreated(res.supplier);
      setName("");
      setPhone("");
      setEmail("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Nouveau fournisseur"
        description="Créez le fournisseur et sélectionnez-le automatiquement"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nom du fournisseur"
            placeholder="Fournisseur Sarl"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Téléphone (optionnel)"
              placeholder="+226 70 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label="Email (optionnel)"
              type="email"
              placeholder="fournisseur@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={loading}>
              Créer le fournisseur
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
