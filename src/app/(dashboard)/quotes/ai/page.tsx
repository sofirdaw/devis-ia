/**
 * Page Devis IA — Génération de devis par description en langage naturel
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { AIGeneratorPanel } from "@/components/ai/AIGeneratorPanel";
import type { Client, Product } from "@/types";

export default async function QuoteAIPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

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
        title="Devis IA"
        description="Créez un devis en quelques secondes grâce à l'intelligence artificielle"
      />
      <div className="page-container max-w-5xl">
        <AIGeneratorPanel
          documentType="quote"
          clients={(clients as Client[]) ?? []}
          products={(products as Product[]) ?? []}
          taxRate={company?.tax_rate ?? 0}
        />
      </div>
    </>
  );
}
