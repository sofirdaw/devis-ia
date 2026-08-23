/**
 * Route API — Génération PDF d'une facture
 * GET /api/pdf/invoice/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { DocumentPDF, type PDFDocumentData } from "@/components/pdf/DocumentPDF";
import type { Invoice } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, client:clients(*), invoice_items(*)")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", invoice.company_id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  // Générer une URL publique pour le logo si elle existe
  let logoUrl = company.logo_url;
  if (logoUrl && logoUrl.startsWith("https://")) {
    // Si c'est déjà une URL complète, on la garde
  } else if (logoUrl && !logoUrl.startsWith("data:")) {
    const {
      data: { publicUrl },
    } = await supabase.storage.from("logos").getPublicUrl(logoUrl);
    logoUrl = publicUrl;
  }

  const typedInvoice = invoice as Invoice;

  const pdfData: PDFDocumentData = {
    type: "invoice",
    number: typedInvoice.invoice_number,
    status: typedInvoice.status,
    date: typedInvoice.created_at,
    dueOrValidDate: typedInvoice.due_date,
    client: typedInvoice.client!,
    company: { ...company, logo_url: logoUrl },
    items: typedInvoice.invoice_items ?? [],
    subtotal: typedInvoice.subtotal,
    discount: typedInvoice.discount,
    tax: typedInvoice.tax,
    taxRate: company.tax_rate,
    total: typedInvoice.total,
    notes: typedInvoice.notes,
  };

  const pdfBuffer = await renderToBuffer(<DocumentPDF data={pdfData} />);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${typedInvoice.invoice_number}.pdf"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
