/**
 * Route API — Génération PDF d'un devis
 *
 * GET /api/pdf/quote/[id]
 * Retourne le PDF en streaming, prêt à être téléchargé ou affiché.
 *
 * Sécurité : RLS Supabase garantit qu'un utilisateur ne peut générer
 * que le PDF de SES PROPRES devis (la requête échoue silencieusement sinon).
 */

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { DocumentPDF, type PDFDocumentData } from "@/components/pdf/DocumentPDF";
import type { Quote } from "@/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Récupérer le devis avec toutes ses relations
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, client:clients(*), quote_items(*)")
    .eq("id", id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  // Récupérer l'entreprise (pour logo, coordonnées)
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", quote.company_id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  // Générer une URL publique pour le logo si elle existe
  let logoUrl = company.logo_url;
  if (logoUrl && logoUrl.startsWith("https://")) {
    // Si c'est déjà une URL complète, on la garde
    // Sinon, on génère une URL publique depuis Supabase
  } else if (logoUrl) {
    const {
      data: { publicUrl },
    } = await supabase.storage.from("logos").getPublicUrl(logoUrl);
    logoUrl = publicUrl;
  }

  const typedQuote = quote as Quote;

  // Construire les données pour le template PDF
  const pdfData: PDFDocumentData = {
    type: "quote",
    number: typedQuote.quote_number,
    status: typedQuote.status,
    date: typedQuote.created_at,
    dueOrValidDate: typedQuote.valid_until,
    client: typedQuote.client!,
    company: { ...company, logo_url: logoUrl },
    items: typedQuote.quote_items ?? [],
    subtotal: typedQuote.subtotal,
    discount: typedQuote.discount,
    tax: typedQuote.tax,
    taxRate: company.tax_rate,
    total: typedQuote.total,
    notes: typedQuote.notes,
  };

  // Générer le buffer PDF
  const pdfBuffer = await renderToBuffer(<DocumentPDF data={pdfData} />);

  // Retourner le PDF avec les bons en-têtes HTTP
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${typedQuote.quote_number}.pdf"`,
    },
  });
}
