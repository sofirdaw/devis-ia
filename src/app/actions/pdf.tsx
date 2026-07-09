/**
 * Server Actions — Gestion des PDF dans Supabase Storage
 *
 * Permet de :
 * - Sauvegarder un PDF généré dans le bucket "pdfs" (privé)
 * - Générer un lien de partage temporaire (signed URL) pour l'envoyer au client
 *
 * Le bucket "pdfs" est privé : on ne peut pas y accéder sans une URL signée,
 * ce qui protège les documents tant qu'on ne choisit pas explicitement de les partager.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPDF, type PDFDocumentData } from "@/components/pdf/DocumentPDF";
import type { Quote, Invoice } from "@/types";

/**
 * Génère le PDF d'un devis et le sauvegarde dans Supabase Storage.
 * Retourne le chemin de stockage (pas l'URL — l'URL signée se génère à la demande).
 */
export async function saveQuotePdfToStorage(quoteId: string): Promise<{ path?: string; error?: string }> {
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, client:clients(*), quote_items(*)")
    .eq("id", quoteId)
    .single();

  if (!quote) return { error: "Devis introuvable" };

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", quote.company_id)
    .single();

  if (!company) return { error: "Entreprise introuvable" };

  const typedQuote = quote as Quote;

  const pdfData: PDFDocumentData = {
    type: "quote",
    number: typedQuote.quote_number,
    status: typedQuote.status,
    date: typedQuote.created_at,
    dueOrValidDate: typedQuote.valid_until,
    client: typedQuote.client!,
    company,
    items: typedQuote.quote_items ?? [],
    subtotal: typedQuote.subtotal,
    discount: typedQuote.discount,
    tax: typedQuote.tax,
    taxRate: company.tax_rate,
    total: typedQuote.total,
    notes: typedQuote.notes,
  };

  const pdfBuffer = await renderToBuffer(<DocumentPDF data={pdfData} />);

  // Chemin organisé par entreprise pour respecter les policies Storage
  const path = `${company.id}/quotes/${typedQuote.quote_number}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true, // Remplace si le devis a été régénéré
    });

  if (uploadError) return { error: "Erreur lors de la sauvegarde du PDF" };

  return { path };
}

/**
 * Génère le PDF d'une facture et le sauvegarde dans Supabase Storage.
 */
export async function saveInvoicePdfToStorage(invoiceId: string): Promise<{ path?: string; error?: string }> {
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*), invoice_items(*)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return { error: "Facture introuvable" };

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", invoice.company_id)
    .single();

  if (!company) return { error: "Entreprise introuvable" };

  const typedInvoice = invoice as Invoice;

  const pdfData: PDFDocumentData = {
    type: "invoice",
    number: typedInvoice.invoice_number,
    status: typedInvoice.status,
    date: typedInvoice.created_at,
    dueOrValidDate: typedInvoice.due_date,
    client: typedInvoice.client!,
    company,
    items: typedInvoice.invoice_items ?? [],
    subtotal: typedInvoice.subtotal,
    discount: typedInvoice.discount,
    tax: typedInvoice.tax,
    taxRate: company.tax_rate,
    total: typedInvoice.total,
    notes: typedInvoice.notes,
  };

  const pdfBuffer = await renderToBuffer(<DocumentPDF data={pdfData} />);

  const path = `${company.id}/invoices/${typedInvoice.invoice_number}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) return { error: "Erreur lors de la sauvegarde du PDF" };

  return { path };
}

/**
 * Génère une URL signée temporaire (valide 1h) pour partager un PDF stocké.
 * Utilisé pour le bouton "Partager" (envoi WhatsApp/Email en V2).
 */
export async function getSignedPdfUrl(storagePath: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("pdfs")
    .createSignedUrl(storagePath, 3600); // 1 heure

  if (error || !data) return { error: "Impossible de générer le lien de partage" };

  return { url: data.signedUrl };
}
