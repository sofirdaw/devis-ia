/**
 * Server Actions — Devis (CRUD + logique métier)
 *
 * Particularité : un devis a des lignes (quote_items) imbriquées.
 * On reçoit les lignes sous forme de JSON stringifié dans le FormData
 * (plus simple que de gérer des inputs[] dynamiques côté FormData natif).
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { calculateTotals } from "@/lib/utils";
import type { ActionResult } from "./auth";
import type { QuoteStatus } from "@/types";

// Une ligne de devis envoyée depuis le formulaire
const QuoteItemSchema = z.object({
  product_id: z.string().nullable().optional(),
  designation: z.string().min(1, "La désignation est requise"),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  unit_price: z.coerce.number().min(0, "Le prix doit être positif"),
});

const QuoteSchema = z.object({
  client_id: z.string().min(1, "Veuillez sélectionner un client"),
  items: z.array(QuoteItemSchema).min(1, "Ajoutez au moins une ligne"),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  valid_until: z.string().optional(),
});

async function getCurrentCompany() {
  return getCurrentCompanyForAction();
}

// ── CREATE ───────────────────────────────────────────────────────────────────

export async function createQuoteAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const itemsRaw = formData.get("items");
  let items;
  try {
    items = JSON.parse(itemsRaw as string);
  } catch {
    return { error: "Format de lignes invalide" };
  }

  const parsed = QuoteSchema.safeParse({
    client_id: formData.get("client_id"),
    items,
    discount: formData.get("discount") || 0,
    notes: formData.get("notes"),
    valid_until: formData.get("valid_until"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  // Utiliser les notes par défaut si aucune note n'est fournie
  const notes = parsed.data.notes || company.default_quote_notes || null;

  const supabase = await createClient();

  // 1. Calculer les totaux
  const { subtotal, tax, total } = calculateTotals(
    parsed.data.items,
    company.tax_rate,
    parsed.data.discount
  );

  // 2. Générer le numéro de devis via la fonction SQL
  const { data: quoteNumber } = await supabase.rpc("next_document_number", {
    p_company_id: company.id,
    p_table: "quotes",
    p_prefix: company.quote_prefix,
  });

  // 3. Créer le devis
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      company_id: company.id,
      client_id: parsed.data.client_id,
      quote_number: quoteNumber,
      status: "draft",
      subtotal,
      tax,
      discount: parsed.data.discount,
      total,
      notes: notes,
      valid_until: parsed.data.valid_until || null,
    })
    .select()
    .single();

  if (quoteError || !quote) {
    return { error: "Erreur lors de la création du devis" };
  }

  // 4. Créer les lignes du devis
  const itemsToInsert = parsed.data.items.map((item) => ({
    quote_id: quote.id,
    product_id: item.product_id || null,
    designation: item.designation,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.quantity * item.unit_price,
  }));

  const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);

  if (itemsError) {
    // Rollback manuel : supprimer le devis si les lignes échouent
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "Erreur lors de l'ajout des lignes du devis" };
  }

  revalidatePath("/quotes");
  redirect(`/quotes/${quote.id}`);
}

// ── UPDATE (contenu complet, uniquement pour les brouillons) ──────────────────

/**
 * Met à jour le contenu complet d'un devis (client, lignes, remise, notes).
 * Restreint aux devis en statut "draft" pour éviter de modifier silencieusement
 * un document déjà envoyé au client.
 */
export async function updateQuoteAction(
  quoteId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const itemsRaw = formData.get("items");
  let items;
  try {
    items = JSON.parse(itemsRaw as string);
  } catch {
    return { error: "Format de lignes invalide" };
  }

  const parsed = QuoteSchema.safeParse({
    client_id: formData.get("client_id"),
    items,
    discount: formData.get("discount") || 0,
    notes: formData.get("notes"),
    valid_until: formData.get("valid_until"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  const supabase = await createClient();

  // Vérifier que le devis est bien un brouillon avant de le modifier
  const { data: existingQuote } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();

  if (!existingQuote) return { error: "Devis introuvable" };
  if (existingQuote.status !== "draft") {
    return { error: "Seuls les devis en brouillon peuvent être modifiés" };
  }

  const { subtotal, tax, total } = calculateTotals(
    parsed.data.items,
    company.tax_rate,
    parsed.data.discount
  );

  // Mettre à jour l'en-tête du devis
  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      client_id: parsed.data.client_id,
      subtotal,
      tax,
      discount: parsed.data.discount,
      total,
      notes: parsed.data.notes || null,
      valid_until: parsed.data.valid_until || null,
    })
    .eq("id", quoteId);

  if (updateError) return { error: "Erreur lors de la mise à jour du devis" };

  // Remplacer toutes les lignes : suppression puis ré-insertion
  // (plus simple et plus sûr que de tenter un diff ligne par ligne)
  await supabase.from("quote_items").delete().eq("quote_id", quoteId);

  const itemsToInsert = parsed.data.items.map((item) => ({
    quote_id: quoteId,
    product_id: item.product_id || null,
    designation: item.designation,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.quantity * item.unit_price,
  }));

  const { error: itemsError } = await supabase.from("quote_items").insert(itemsToInsert);

  if (itemsError) return { error: "Erreur lors de la mise à jour des lignes" };

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}`);
}

// ── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function updateQuoteStatusAction(
  quoteId: string,
  status: QuoteStatus
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ status }).eq("id", quoteId);

  if (error) return { error: "Erreur lors de la mise à jour du statut" };

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${quoteId}`);
  return { success: true };
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteQuoteAction(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  // quote_items est supprimé en cascade automatiquement (ON DELETE CASCADE)
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);

  if (error) return { error: "Erreur lors de la suppression" };

  revalidatePath("/quotes");
  return { success: true };
}

// ── CONVERT TO INVOICE ──────────────────────────────────────────────────────

/**
 * Convertit un devis accepté en facture en un clic.
 * Copie les lignes du devis vers une nouvelle facture.
 */
export async function convertQuoteToInvoiceAction(quoteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  // Récupérer le devis avec ses lignes
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", quoteId)
    .single();

  if (!quote) return { error: "Devis introuvable" };

  // Générer le numéro de facture
  const { data: invoiceNumber } = await supabase.rpc("next_document_number", {
    p_company_id: company.id,
    p_table: "invoices",
    p_prefix: company.invoice_prefix,
  });

  // Créer la facture à partir du devis
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      company_id: company.id,
      client_id: quote.client_id,
      quote_id: quote.id,
      invoice_number: invoiceNumber,
      status: "draft",
      subtotal: quote.subtotal,
      tax: quote.tax,
      discount: quote.discount,
      total: quote.total,
      notes: quote.notes,
    })
    .select()
    .single();

  if (invoiceError || !invoice) {
    return { error: "Erreur lors de la création de la facture" };
  }

  // Copier les lignes
  const itemsToInsert = quote.quote_items.map(
    (item: {
      product_id: string | null;
      designation: string;
      quantity: number;
      unit_price: number;
      total: number;
    }) => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      designation: item.designation,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })
  );

  await supabase.from("invoice_items").insert(itemsToInsert);

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}
