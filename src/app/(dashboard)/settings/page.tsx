/**
 * Page Paramètres — Configuration de l'entreprise
 *
 * Trois sections : informations générales, logo, préférences de facturation.
 */

import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { CompanyInfoForm } from "@/components/settings/CompanyInfoForm";
import { LogoUploadForm } from "@/components/settings/LogoUploadForm";
import { PreferencesForm } from "@/components/settings/PreferencesForm";
import type { Company } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const company = await requireCurrentCompany();

  const typedCompany = company as Company;

  return (
    <>
      <Header
        title="Paramètres"
        description="Gérez les informations de votre entreprise"
        actions={
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              className="flex sm:hidden"
            >
              Retour
            </Button>
          </Link>
        }
      />
      <div className="page-container max-w-2xl space-y-6">
        <LogoUploadForm companyId={typedCompany.id} currentLogoUrl={typedCompany.logo_url} />
        <CompanyInfoForm company={typedCompany} />
        <PreferencesForm company={typedCompany} />
      </div>
    </>
  );
}
