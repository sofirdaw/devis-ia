/**
 * Page Setup — Onboarding après inscription
 *
 * Demande les infos de l'entreprise juste après la création du compte.
 * Pas de sidebar ici (l'utilisateur n'a pas encore d'entreprise).
 */

"use client";

import { useActionState, useState, useRef } from "react";
import { Building2, Upload, X } from "lucide-react";
import { createCompanyAction } from "@/app/actions/company";
import type { ActionResult } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionResult = {};

export default function SetupPage() {
  const [state, formAction, isPending] = useActionState(createCompanyAction, initialState);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
  };

  const clearLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Parlez-nous de votre entreprise</h1>
          <p className="text-gray-500 text-sm mt-1">
            Ces informations apparaîtront sur vos devis et factures
          </p>
        </div>

        {/* Carte formulaire */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {state.error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm"
              role="alert"
            >
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            {/* Upload du logo */}
            <div className="flex flex-col items-center gap-4 pb-6 border-b border-gray-100 mb-6">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Logo de l'entreprise"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Building2 size={32} className="text-gray-300" />
                )}
                {logoPreview && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="absolute top-1 right-1 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-sm transition-colors"
                    aria-label="Supprimer le logo"
                  >
                    <X size={14} className="text-gray-700" />
                  </button>
                )}
              </div>
              <div className="text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  name="logo"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Upload size={14} />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                >
                  {logoPreview ? "Changer le logo" : "Ajouter un logo"}
                </Button>
                <p className="text-xs text-gray-400 mt-2">PNG ou JPG, 2 Mo maximum (optionnel)</p>
              </div>
            </div>

            <Input
              name="name"
              label="Nom de l'entreprise"
              placeholder="Ma Petite Entreprise SARL"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input name="phone" type="tel" label="Téléphone" placeholder="+226 70 00 00 00" />
              <Input
                name="email"
                type="email"
                label="Email professionnel"
                placeholder="contact@entreprise.com"
              />
            </div>

            <Input name="address" label="Adresse" placeholder="Ouagadougou, Burkina Faso" />

            <div className="grid grid-cols-3 gap-4">
              <Input name="rccm" label="RCCM" placeholder="Registre du Commerce" />
              <Input name="ifu" label="IFU" placeholder="Identifiant Fiscal" />
              <Input name="cme" label="CME" placeholder="Centre des Métiers" />
            </div>

            {/*<Input
              name="default_quote_notes"
              label="Notes par défaut (Devis)"
              placeholder="Notes automatiques pour les devis"
            />

            {<Input
              name="default_invoice_notes"
              label="Notes par défaut (Factures)"
              placeholder="Notes automatiques pour les factures"
            />
*/}
            <Button type="submit" className="w-full" size="lg" isLoading={isPending}>
              {isPending ? "Création..." : "Continuer vers le tableau de bord"}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Vous pourrez modifier ces informations à tout moment dans les paramètres
          </p>
        </div>
      </div>
    </div>
  );
}
