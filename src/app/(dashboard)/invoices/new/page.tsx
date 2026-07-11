/**
 * Page Nouvelle Facture — Server Component
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { InvoiceForm } from "@/components/documents/InvoiceForm";
import type { Client, Product } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewInvoicePage() {
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
        title="Nouvelle facture"
        description="Créez une facture manuellement"
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
      <div className="page-container">
        <InvoiceForm
          clients={(clients as Client[]) ?? []}
          products={(products as Product[]) ?? []}
          taxRate={company?.tax_rate ?? 0}
          defaultNotes={company?.default_invoice_notes ?? ""}
        />
      </div>
    </>
  );
}
