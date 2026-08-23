/**
 * Page Liste des Factures — Server Component résilient hors-ligne
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { InvoicesTable } from "@/components/documents/InvoicesTable";
import type { Invoice } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InvoicesPage() {
  const company = await requireCurrentCompany();
  let invoicesWithReceivable: Invoice[] = [];

  try {
    const supabase = await createClient();
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*, client:clients(*)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });

    const invoiceIds = (invoices ?? []).map((i) => i.id);

    const { data: receivables } = invoiceIds.length
      ? await supabase
          .from("receivables")
          .select("id, invoice_id, paid_amount, remaining_amount, status")
          .in("invoice_id", invoiceIds)
      : { data: [] };

    const receivableByInvoiceId = new Map((receivables ?? []).map((r) => [r.invoice_id, r]));

    invoicesWithReceivable = (invoices ?? []).map((invoice) => ({
      ...invoice,
      receivable: receivableByInvoiceId.get(invoice.id) ?? null,
    })) as Invoice[];
  } catch {
    // Mode hors-ligne
  }

  return (
    <>
      <Header
        title="Factures"
        description="Gérez vos factures et suivez les paiements"
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
      <div className="page-container">
        <InvoicesTable invoices={invoicesWithReceivable} />
      </div>
    </>
  );
}
