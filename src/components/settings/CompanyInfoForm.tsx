/**
 * CompanyInfoForm — Formulaire des informations générales de l'entreprise
 * (nom, téléphone, email, adresse)
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
import { updateCompanyAction } from "@/app/actions/company";
import type { ActionResult } from "@/app/actions/auth";
import type { Company } from "@/types";
import { useAuthStore } from "@/store/auth.store";

interface CompanyInfoFormProps {
  company: Company;
}

const initialState: ActionResult = {};

export function CompanyInfoForm({ company }: CompanyInfoFormProps) {
  const action = updateCompanyAction.bind(null, company.id);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [dismissed, setDismissed] = useState(false);
  const [localSuccess, setLocalSuccess] = useState(false);
  const { setCompany, company: currentCompany } = useAuthStore();

  // État local pour les valeurs du formulaire
  const [formData, setFormData] = useState({
    name: currentCompany?.name || company.name || "",
    phone: currentCompany?.phone ?? company.phone ?? "",
    email: currentCompany?.email ?? company.email ?? "",
    address: currentCompany?.address ?? company.address ?? "",
    rccm: currentCompany?.rccm ?? company.rccm ?? "",
    ifu: currentCompany?.ifu ?? company.ifu ?? "",
    cme: currentCompany?.cme ?? company.cme ?? "",
    default_quote_notes: currentCompany?.default_quote_notes ?? company.default_quote_notes ?? "",
    default_invoice_notes:
      currentCompany?.default_invoice_notes ?? company.default_invoice_notes ?? "",
  });

  const showSuccess = Boolean((state.success || localSuccess) && !dismissed);

  // Synchroniser vers le store Zustand
  const syncToStore = (data: typeof formData) => {
    if (currentCompany) {
      setCompany({
        ...currentCompany,
        ...data,
      });
    }
  };

  useEffect(() => {
    if (state.success) {
      if (currentCompany) {
        setCompany({
          ...currentCompany,
          ...formData,
        });
      }
      const timer = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.success, currentCompany, formData, setCompany]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDismissed(false);
    const updated = {
      ...formData,
      [e.target.name]: e.target.value,
    };
    setFormData(updated);
    syncToStore(updated);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setDismissed(false);
    syncToStore(formData);

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
        <CardTitle>Informations de l&apos;entreprise</CardTitle>
        <CardDescription>Ces informations apparaissent sur vos devis et factures</CardDescription>
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

          <Input
            name="name"
            label="Nom de l'entreprise"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              name="phone"
              type="tel"
              label="Téléphone"
              value={formData.phone}
              onChange={handleChange}
            />
            <Input
              name="email"
              type="email"
              label="Email professionnel"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <Input name="address" label="Adresse" value={formData.address} onChange={handleChange} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              name="rccm"
              label="RCCM"
              placeholder="Registre du Commerce"
              value={formData.rccm}
              onChange={handleChange}
            />
            <Input
              name="ifu"
              label="IFU"
              placeholder="Identifiant Fiscal"
              value={formData.ifu}
              onChange={handleChange}
            />
            <Input
              name="cme"
              label="CME"
              placeholder="Centre des Métiers"
              value={formData.cme}
              onChange={handleChange}
            />
          </div>

          <Input
            name="default_quote_notes"
            label="Notes par défaut (Devis)"
            placeholder="Notes automatiques pour les devis"
            value={formData.default_quote_notes}
            onChange={handleChange}
          />

          <Input
            name="default_invoice_notes"
            label="Notes par défaut (Factures)"
            placeholder="Notes automatiques pour les factures"
            value={formData.default_invoice_notes}
            onChange={handleChange}
          />
        </CardBody>

        <CardFooter className="p-4 sm:p-6 lg:p-8 flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {showSuccess ? (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 size={14} />
              Modifications enregistrées
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
