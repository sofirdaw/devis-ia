"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createQuickSupplierAction } from "@/app/actions/suppliers";

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
