/**
 * Page Édition Devis — Formulaire pré-rempli avec les données existantes
 * Accessible uniquement si le devis est en statut "draft"
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { QuoteEditForm } from "@/components/documents/QuoteEditForm";
import type { Client, Product, Quote } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();

  if (!quote) notFound();
  if (quote.status !== "draft") redirect(`/quotes/${id}`);

  const [{ data: clients }, { data: products }] = await Promise.all([
    supabase.from("clients").select("*").eq("company_id", company.id).order("name"),
    supabase.from("products").select("*").eq("company_id", company.id).order("name"),
  ]);

  return (
    <>
      <Header
        title={`Modifier ${quote.quote_number}`}
        description="Modifiez ce devis brouillon"
        actions={
          <Link href={`/quotes/${id}`}>
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
      <div className="page-container">
        <QuoteEditForm
          quote={quote as Quote}
          clients={(clients as Client[]) ?? []}
          products={(products as Product[]) ?? []}
          taxRate={company?.tax_rate ?? 0}
        />
      </div>
    </>
  );
}
