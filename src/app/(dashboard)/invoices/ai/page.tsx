/**
 * Page Facture IA — Génération de facture par description en langage naturel
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { AIGeneratorPanel } from "@/components/ai/AIGeneratorPanel";
import type { Client, Product } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InvoiceAIPage() {
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
        title="Facture IA"
        description="Créez une facture en quelques secondes grâce à l'intelligence artificielle"
        actions={
          <Link href="/invoices">
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
      <div className="page-container max-w-5xl">
        <AIGeneratorPanel
          documentType="invoice"
          clients={(clients as Client[]) ?? []}
          products={(products as Product[]) ?? []}
          taxRate={company?.tax_rate ?? 0}
        />
      </div>
    </>
  );
}
