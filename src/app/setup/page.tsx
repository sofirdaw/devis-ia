/**
 * Page Setup — Onboarding après inscription
 *
 * Demande les infos de l'entreprise juste après la création du compte.
 * Pas de sidebar ici (l'utilisateur n'a pas encore d'entreprise).
 */

"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { createCompanyAction } from "@/app/actions/company";
import type { ActionResult } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionResult = {};

export default function SetupPage() {
  const [state, formAction, isPending] = useActionState(createCompanyAction, initialState);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-xl mb-4">
            <Building2 size={22} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Parlez-nous de votre entreprise
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Ces informations apparaîtront sur vos devis et factures
          </p>
        </div>

        {/* Carte formulaire */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm" role="alert">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <Input
              name="name"
              label="Nom de l'entreprise"
              placeholder="Ma Petite Entreprise SARL"
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                name="phone"
                type="tel"
                label="Téléphone"
                placeholder="+226 70 00 00 00"
              />
              <Input
                name="email"
                type="email"
                label="Email professionnel"
                placeholder="contact@entreprise.com"
              />
            </div>

            <Input
              name="address"
              label="Adresse"
              placeholder="Ouagadougou, Burkina Faso"
            />

            <div className="grid grid-cols-3 gap-4">
              <Input
                name="rccm"
                label="RCCM"
                placeholder="Registre du Commerce"
              />
              <Input
                name="ifu"
                label="IFU"
                placeholder="Identifiant Fiscal"
              />
              <Input
                name="cme"
                label="CME"
                placeholder="Centre des Métiers"
              />
            </div>

            <Input
              name="default_quote_notes"
              label="Notes par défaut (Devis)"
              placeholder="Notes automatiques pour les devis"
            />

            <Input
              name="default_invoice_notes"
              label="Notes par défaut (Factures)"
              placeholder="Notes automatiques pour les factures"
            />

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
