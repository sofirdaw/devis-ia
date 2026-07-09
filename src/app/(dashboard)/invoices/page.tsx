/**
 * Page Liste des Factures — Server Component
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { InvoicesTable } from "@/components/documents/InvoicesTable";
import type { Invoice } from "@/types";

export default async function InvoicesPage() {
  const company = await requireCurrentCompany();
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

  const receivableByInvoiceId = new Map(
    (receivables ?? []).map((r) => [r.invoice_id, r]),
  );

  const invoicesWithReceivable = (invoices ?? []).map((invoice) => ({
    ...invoice,
    receivable: receivableByInvoiceId.get(invoice.id) ?? null,
  }));

  return (
    <>
      <Header
        title="Factures"
        description="Gérez vos factures et suivez les paiements"
      />
      <div className="page-container">
        <InvoicesTable invoices={invoicesWithReceivable as Invoice[]} />
      </div>
    </>
  );
}
