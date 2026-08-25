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

interface PreferencesFormProps {
  company: Company;
}

const initialState: ActionResult = {};

export function PreferencesForm({ company }: PreferencesFormProps) {
  const action = updateCompanyPreferencesAction.bind(null, company.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [dismissed, setDismissed] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);

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

  const showSuccess = Boolean((state.success || localSuccess) && !dismissed);

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setDismissed(false);
    const parsedTax = Number(taxRate) || 0;
    const current = useAuthStore.getState().company ?? company;
    useAuthStore.getState().setCompany({
      ...current,
      quote_prefix: quotePrefix.toUpperCase(),
      invoice_prefix: invoicePrefix.toUpperCase(),
      tax_rate: parsedTax,
    });

    // En mode hors-ligne, éviter le crash réseau Server Action et marquer comme succès local
    if (typeof window !== "undefined" && !navigator.onLine) {
      e.preventDefault();
      setLocalSuccess(true);
      setTimeout(() => {
        setLocalSuccess(false);
        setDismissed(true);
      }, 3000);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 lg:p-8">
        <CardTitle>Préférences de facturation</CardTitle>
        <CardDescription>
          Numérotation automatique et taux de TVA appliqués aux nouveaux documents
        </CardDescription>
      </CardHeader>

      <form action={formAction} onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6">
        <CardBody className="p-0 space-y-4">
          {state.error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm"
              role="alert"
            >
              {state.error}
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
