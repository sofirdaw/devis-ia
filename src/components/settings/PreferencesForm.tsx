/**
 * PreferencesForm — Préférences de numérotation et TVA par défaut
 * (préfixes DEV-/FAC-, taux de TVA appliqué aux nouveaux documents)
 */

"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from "@/components/ui/card";
import { updateCompanyPreferencesAction } from "@/app/actions/company";
import type { ActionResult } from "@/app/actions/auth";
import type { Company } from "@/types";
import { useAuthStore } from "@/store/auth.store";
import { addToSyncQueue } from "@/lib/offline-db";

interface PreferencesFormProps {
  company: Company;
}

const initialState: ActionResult = {};

export function PreferencesForm({ company }: PreferencesFormProps) {
  const action = updateCompanyPreferencesAction.bind(null, company.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [dismissed, setDismissed] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const initialCompany = useAuthStore.getState().company ?? company;

  // État contrôlé pour préserver les valeurs éditées
  const [quotePrefix, setQuotePrefix] = useState(
    initialCompany.quote_prefix || company.quote_prefix || "DEV"
  );
  const [invoicePrefix, setInvoicePrefix] = useState(
    initialCompany.invoice_prefix || company.invoice_prefix || "FAC"
  );
  const [taxRate, setTaxRate] = useState<number | string>(
    initialCompany.tax_rate !== undefined
      ? initialCompany.tax_rate
      : company.tax_rate !== undefined
        ? company.tax_rate
        : 18
  );
  const [serviceDescription, setServiceDescription] = useState(
    initialCompany.service_description ?? company.service_description ?? ""
  );
  const [quotePdfTemplate, setQuotePdfTemplate] = useState<"classic" | "modern" | "minimal">(
    initialCompany.quote_pdf_template ?? "classic"
  );
  const [invoicePdfTemplate, setInvoicePdfTemplate] = useState<"classic" | "modern" | "minimal">(
    initialCompany.invoice_pdf_template ?? "classic"
  );
  const [quotePdfUseHeader, setQuotePdfUseHeader] = useState(
    initialCompany.quote_pdf_use_header ?? true
  );
  const [invoicePdfUseHeader, setInvoicePdfUseHeader] = useState(
    initialCompany.invoice_pdf_use_header ?? true
  );

  const showSuccess = Boolean((state.success || localSuccess) && !dismissed);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setDismissed(false);
    setLocalError(null);
    const parsedTax = Number(taxRate) || 0;
    const current = useAuthStore.getState().company ?? company;
    useAuthStore.getState().setCompany({
      ...current,
      quote_prefix: quotePrefix.toUpperCase(),
      invoice_prefix: invoicePrefix.toUpperCase(),
      tax_rate: parsedTax,
      quote_pdf_template: quotePdfTemplate,
      invoice_pdf_template: invoicePdfTemplate,
      quote_pdf_use_header: quotePdfUseHeader,
      invoice_pdf_use_header: invoicePdfUseHeader,
      service_description: serviceDescription.trim() || null,
    });

    // En mode hors-ligne, éviter le crash réseau Server Action et marquer comme succès local
    if (typeof window !== "undefined" && !navigator.onLine) {
      e.preventDefault();
      try {
        await addToSyncQueue("UPDATE_COMPANY", {
          company_id: company.id,
          section: "preferences",
          fields: {
            quote_prefix: quotePrefix.toUpperCase(),
            invoice_prefix: invoicePrefix.toUpperCase(),
            tax_rate: parsedTax,
            quote_pdf_template: quotePdfTemplate,
            invoice_pdf_template: invoicePdfTemplate,
            quote_pdf_use_header: quotePdfUseHeader ? "on" : "off",
            invoice_pdf_use_header: invoicePdfUseHeader ? "on" : "off",
            service_description: serviceDescription.trim(),
          },
        });
        setLocalSuccess(true);
        setTimeout(() => {
          setLocalSuccess(false);
          setDismissed(true);
        }, 3000);
      } catch (error) {
        console.error("Échec de l'enregistrement local des préférences:", error);
        setLocalSuccess(false);
        setLocalError(
          "Préférences modifiées localement mais non ajoutées à la file de synchronisation."
        );
      }
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 lg:p-8">
        <CardTitle>Préférences de facturation</CardTitle>
        <CardDescription>
          Numérotation, TVA et apparence des PDF appliquées aux documents
        </CardDescription>
      </CardHeader>

      <form action={formAction} onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6">
        <CardBody className="p-0 space-y-4">
          {(state.error || localError) && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm"
              role="alert"
            >
              {state.error || localError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="quote_prefix"
              label="Préfixe des devis"
              value={quotePrefix}
              onChange={(e) => {
                setDismissed(false);
                setQuotePrefix(e.target.value);
              }}
              hint="Ex: DEV → DEV-2026-001"
              maxLength={10}
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Modèle PDF des devis
                <select
                  name="quote_pdf_template"
                  value={quotePdfTemplate}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "classic" || value === "modern" || value === "minimal") {
                      setQuotePdfTemplate(value);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="classic">Classique</option>
                  <option value="modern">Moderne</option>
                  <option value="minimal">Minimaliste</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700">
                Modèle PDF des factures
                <select
                  name="invoice_pdf_template"
                  value={invoicePdfTemplate}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "classic" || value === "modern" || value === "minimal") {
                      setInvoicePdfTemplate(value);
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="classic">Classique</option>
                  <option value="modern">Moderne</option>
                  <option value="minimal">Minimaliste</option>
                </select>
              </label>
            </div>
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-800">En-tête des documents PDF</p>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="quote_pdf_use_header"
                  checked={quotePdfUseHeader}
                  onChange={(event) => setQuotePdfUseHeader(event.target.checked)}
                  className="mt-1"
                />
                Utiliser l&apos;en-tête pour les devis
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="invoice_pdf_use_header"
                  checked={invoicePdfUseHeader}
                  onChange={(event) => setInvoicePdfUseHeader(event.target.checked)}
                  className="mt-1"
                />
                Utiliser l&apos;en-tête pour les factures
              </label>
              <p className="text-xs text-gray-500">
                L&apos;en-tête utilise le logo et les coordonnées, RCCM, IFU et CME renseignés dans
                les informations de l&apos;entreprise.
              </p>
            </div>
            <Input
              name="invoice_prefix"
              label="Préfixe des factures"
              value={invoicePrefix}
              onChange={(e) => {
                setDismissed(false);
                setInvoicePrefix(e.target.value);
              }}
              hint="Ex: FAC → FAC-2026-001"
              maxLength={10}
              required
            />
          </div>

          <Input
            name="tax_rate"
            type="number"
            min="0"
            max="100"
            step="0.5"
            label="Taux de TVA par défaut (%)"
            value={taxRate}
            onChange={(e) => {
              setDismissed(false);
              setTaxRate(e.target.value);
            }}
            hint="Laissez à 0 si vous n'appliquez pas de TVA"
            required
          />
          <label className="block space-y-1 text-sm font-medium text-gray-700">
            Activités et services présentés sur les PDF
            <textarea
              name="service_description"
              value={serviceDescription}
              onChange={(event) => {
                setDismissed(false);
                setServiceDescription(event.target.value);
              }}
              maxLength={140}
              rows={3}
              placeholder="Ex.Entreprise de ventes de toles de qualité et des services de construction"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal"
            />
          </label>
        </CardBody>

        <CardFooter className="p-4 sm:p-6 lg:p-8 flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {showSuccess ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <CheckCircle2 size={14} />
              Préférences enregistrées avec succès
            </span>
          ) : (
            <span />
          )}
          <Button type="submit" isLoading={isPending} className="w-full sm:w-auto">
            Enregistrer
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
