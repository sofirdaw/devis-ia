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

interface PreferencesFormProps {
  company: Company;
}

const initialState: ActionResult = {};

export function PreferencesForm({ company }: PreferencesFormProps) {
  const action = updateCompanyPreferencesAction.bind(null, company.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state.success) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success]);

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 lg:p-8">
        <CardTitle>Préférences de facturation</CardTitle>
        <CardDescription>
          Numérotation automatique et taux de TVA appliqués aux nouveaux
          documents
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardBody className="p-4 sm:p-6 lg:p-8 space-y-4">
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
              defaultValue={company.quote_prefix}
              hint="Ex: DEV → DEV-2026-001"
              maxLength={10}
              required
            />
            <Input
              name="invoice_prefix"
              label="Préfixe des factures"
              defaultValue={company.invoice_prefix}
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
            defaultValue={company.tax_rate}
            hint="Laissez à 0 si vous n'appliquez pas de TVA"
            required
          />
        </CardBody>

        <CardFooter className="p-4 sm:p-6 lg:p-8 flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {showSuccess ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 size={14} />
              Préférences enregistrées
            </span>
          ) : (
            <span />
          )}
          <Button
            type="submit"
            isLoading={isPending}
            className="w-full sm:w-auto"
          >
            Enregistrer
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
