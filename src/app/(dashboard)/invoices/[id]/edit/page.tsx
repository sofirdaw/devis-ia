/**
 * Page Édition Facture — Accessible uniquement si brouillon
 */

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { InvoiceEditForm } from "@/components/documents/InvoiceEditForm";
import type { Client, Product, Invoice } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();

  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/invoices/${id}`);

  const [{ data: clients }, { data: products }] = await Promise.all([
    supabase.from("clients").select("*").eq("company_id", company.id).order("name"),
    supabase.from("products").select("*").eq("company_id", company.id).order("name"),
  ]);

  return (
    <>
      <Header
        title={`Modifier ${invoice.invoice_number}`}
        description="Modifiez cette facture brouillon"
        actions={
          <Link href={`/invoices/${id}`}>
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
        <InvoiceEditForm
          invoice={invoice as Invoice}
          clients={(clients as Client[]) ?? []}
          products={(products as Product[]) ?? []}
          taxRate={company?.tax_rate ?? 0}
        />
      </div>
    </>
  );
}
