/**
 * QuoteForm — Formulaire complet de création de devis
 *
 * Orchestre : sélection client, lignes (LineItemsEditor), totaux (TotalsSummary),
 * notes et date de validité. Soumet via Server Action createQuoteAction.
 *
 * Les lignes sont sérialisées en JSON dans un input caché car FormData
 * ne gère pas nativement les tableaux d'objets imbriqués.
 */

"use client";

import { useState, useActionState, useRef } from "react";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LineItemsEditor, type LineItem } from "./LineItemsEditor";
import { TotalsSummary } from "./TotalsSummary";
import { createQuoteAction } from "@/app/actions/quotes";
import { useRouter } from "next/navigation";
import { saveOfflineQuote, addToSyncQueue } from "@/lib/offline-db";
import type { ActionResult } from "@/app/actions/auth";
import type { Client, Product } from "@/types";

interface QuoteFormProps {
  clients: Client[];
  products: Product[];
  taxRate: number;
  /** Pré-remplissage optionnel — utilisé par la génération IA (Semaine 3) */
  initialItems?: LineItem[];
  initialClientId?: string;
  initialNotes?: string;
  initialDate?: string;
  /** Notes par défaut de l'entreprise (paramètres) */
  defaultNotes?: string;
}

const initialState: ActionResult = {};

export function QuoteForm({
  clients,
  products,
  taxRate,
  initialItems,
  initialClientId,
  initialNotes,
  initialDate,
  defaultNotes,
}: QuoteFormProps) {
  const router = useRouter();
  const [items, setItems] = useState<LineItem[]>(
    initialItems?.length
      ? initialItems
      : [{ product_id: null, designation: "", quantity: 1, unit_price: 0 }]
  );
  const [discount, setDiscount] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(initialClientId);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [state, formAction, isPending] = useActionState(createQuoteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.name }));
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined" && !navigator.onLine) {
      e.preventDefault();
      setIsSavingOffline(true);

      const localId = `off_${Date.now()}`;
      const quoteNum = `DEV-OFF-${Math.floor(100 + Math.random() * 900)}`;

      const subtotal = items.reduce(
        (acc, item) => acc + (item.quantity || 0) * (item.unit_price || 0),
        0
      );
      const tax = (subtotal - discount) * (taxRate / 100);
      const total = subtotal - discount + tax;

      const notesInput = formRef.current?.querySelector('[name="notes"]') as HTMLTextAreaElement;

      const offlineQuote = {
        id: localId,
        quote_number: quoteNum,
        client_name: selectedClient?.name || "Client Local",
        client_id: selectedClientId,
        status: "draft" as const,
        total,
        subtotal,
        tax,
        discount,
        notes: notesInput?.value || defaultNotes || "",
        created_at: new Date().toISOString(),
        items: items.map((i) => ({
          designation: i.designation,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.quantity * i.unit_price,
        })),
        sync_status: "pending_create" as const,
      };

      await saveOfflineQuote(offlineQuote);
      await addToSyncQueue("CREATE_QUOTE", {
        client_id: selectedClientId,
        discount,
        notes: offlineQuote.notes,
        items,
        local_quote: offlineQuote,
      });

      setIsSavingOffline(false);
      router.push("/quotes");
    }
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {state.error && (
        <div
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
          role="alert"
        >
          {state.error}
        </div>
      )}

      {/* Lignes cachées pour transmettre les données complexes au Server Action */}
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="discount" value={discount} />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            {/* Client Selection & Information Card */}
            <div className="space-y-3 lg:space-y-4">
              <Select
                name="client_id"
                label="Client"
                placeholder="Sélectionner un client"
                options={clientOptions}
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
              />
              {selectedClient && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 sm:p-5 text-sm text-gray-600 space-y-1 lg:space-y-2 shadow-sm transition-all duration-200 animate-fadeIn">
                  <p className="font-semibold text-blue-900 text-xs uppercase tracking-wider mb-1 lg:mb-2">
                    Informations Client
                  </p>
                  {selectedClient.email && (
                    <p className="flex items-center gap-1.5 lg:gap-2">
                      <span className="font-medium text-gray-700 w-16 lg:w-20">Email:</span>{" "}
                      {selectedClient.email}
                    </p>
                  )}
                  {selectedClient.phone && (
                    <p className="flex items-center gap-1.5 lg:gap-2">
                      <span className="font-medium text-gray-700 w-16 lg:w-20">Téléphone:</span>{" "}
                      {selectedClient.phone}
                    </p>
                  )}
                  {selectedClient.address && (
                    <p className="flex items-center gap-1.5 lg:gap-2">
                      <span className="font-medium text-gray-700 w-16 lg:w-20">Adresse:</span>{" "}
                      {selectedClient.address}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Lignes du devis */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-100 p-4 sm:p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3 lg:mb-4">
                Articles
              </label>
              <LineItemsEditor items={items} onChange={setItems} products={products} />
            </div>

            {/* Notes */}
            <Textarea
              name="notes"
              label="Notes (optionnel)"
              placeholder="Conditions de paiement, informations complémentaires..."
              rows={3}
              defaultValue={initialNotes || defaultNotes}
            />
          </div>

          {/* Colonne latérale : totaux + validité (Sticky) */}
          <div className="space-y-4 lg:space-y-6 lg:sticky lg:top-4 h-fit">
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5">
              <Input
                name="valid_until"
                type="date"
                label="Valide jusqu'au"
                defaultValue={initialDate}
              />
            </div>

            <TotalsSummary
              items={items}
              taxRate={taxRate}
              discount={discount}
              onDiscountChange={setDiscount}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4 lg:pt-6 border-t border-gray-100 mt-6 lg:mt-8">
          <Button
            type="submit"
            size="lg"
            isLoading={isPending || isSavingOffline}
            className="w-full sm:w-auto px-8 lg:px-10 shadow-lg"
          >
            {isSavingOffline
              ? "Sauvegarde locale..."
              : isPending
                ? "Création..."
                : "Créer le devis"}
          </Button>
        </div>
      </div>
    </form>
  );
}
