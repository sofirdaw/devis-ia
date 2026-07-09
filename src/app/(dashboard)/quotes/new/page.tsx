/**
 * Page Nouveau Devis — Server Component qui charge les données
 * puis délègue le formulaire interactif à QuoteForm
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { QuoteForm } from "@/components/documents/QuoteForm";
import type { Client, Product } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewQuotePage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  // Charger clients et produits en parallèle pour le formulaire
  const [{ data: clients }, { data: products }] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("company_id", company.id)
      .order("name"),
    supabase
      .from("products")
      .select("*")
      .eq("company_id", company.id)
      .order("name"),
  ]);

  return (
    <>
      <Header
        title="Nouveau devis"
        description="Créez un devis manuellement"
        actions={
          <Link href="/quotes">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
            >
              Retour
            </Button>
          </Link>
        }
      />
      <div className="page-container">
        <QuoteForm
          clients={(clients as Client[]) ?? []}
          products={(products as Product[]) ?? []}
          taxRate={company?.tax_rate ?? 0}
          defaultNotes={company?.default_quote_notes ?? ""}
        />
      </div>
    </>
  );
}
