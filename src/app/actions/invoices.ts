/**
 * Server Actions — Factures (CRUD + logique métier)
 * Même pattern que quotes.ts, adapté aux factures (due_date au lieu de valid_until,
 * statuts différents : draft/sent/paid/overdue)
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { calculateTotals } from "@/lib/utils";
import type { ActionResult } from "./auth";
import type { InvoiceStatus } from "@/types";

const InvoiceItemSchema = z.object({
  product_id: z.string().nullable().optional(),
  designation: z.string().min(1, "La désignation est requise"),
  quantity: z.coerce.number().positive("La quantité doit être positive"),
  unit_price: z.coerce.number().min(0, "Le prix doit être positif"),
});

const InvoiceSchema = z.object({
  client_id: z.string().min(1, "Veuillez sélectionner un client"),
  items: z.array(InvoiceItemSchema).min(1, "Ajoutez au moins une ligne"),
  discount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  due_date: z.string().optional(),
});

async function getCurrentCompany() {
  return getCurrentCompanyForAction();
}

// ── CREATE ────────────────────────────────────────────────────────────────────────────────────────
// ── CREATE ───────────────────────────────────────────────────────────────────

export async function createInvoiceAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const itemsRaw = formData.get("items");
  let items;
  try {
    items = JSON.parse(itemsRaw as string);
  } catch {
    return { error: "Format de lignes invalide" };
  }

  const parsed = InvoiceSchema.safeParse({
    client_id: formData.get("client_id"),
    items,
    discount: formData.get("discount") || 0,
    notes: formData.get("notes"),
    due_date: formData.get("due_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  // Utiliser les notes par défaut si aucune note n'est fournie
  const notes = parsed.data.notes || company.default_invoice_notes || null;

  const supabase = await createClient();

  const { subtotal, tax, total } = calculateTotals(
    parsed.data.items,
    company.tax_rate,
    parsed.data.discount,
  );

  const { data: invoiceNumber } = await supabase.rpc("next_document_number", {
    p_company_id: company.id,
    p_table: "invoices",
    p_prefix: company.invoice_prefix,
  });

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      company_id: company.id,
      client_id: parsed.data.client_id,
      invoice_number: invoiceNumber,
      status: "draft",
      subtotal,
      tax,
      discount: parsed.data.discount,
      total,
      notes: notes,
      due_date: parsed.data.due_date || null,
    })
    .select()
    .single();

  if (invoiceError || !invoice) {
    return { error: "Erreur lors de la création de la facture" };
  }

  const itemsToInsert = parsed.data.items.map((item) => ({
    invoice_id: invoice.id,
    product_id: item.product_id || null,
    designation: item.designation,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.quantity * item.unit_price,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(itemsToInsert);

  if (itemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: "Erreur lors de l'ajout des lignes de la facture" };
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

// ── UPDATE STATUS ────────────────────────────────────────────────────────────

export async function updateInvoiceStatusAction(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status })
    .eq("id", invoiceId);

  if (error) return { error: "Erreur lors de la mise à jour du statut" };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { success: true };
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteInvoiceAction(
  invoiceId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) return { error: "Erreur lors de la suppression" };

  revalidatePath("/invoices");
  return { success: true };
}

// ── CHECK OVERDUE (utilisé par le dashboard / cron futur) ──────────────────────

/**
 * Marque automatiquement comme "en retard" les factures envoyées
 * dont la date d'échéance est dépassée.
 */
export async function markOverdueInvoices(): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .eq("status", "sent")
    .lt("due_date", new Date().toISOString().split("T")[0]);
}

// ── UPDATE (contenu complet, uniquement pour les brouillons) ──────────────────

export async function updateInvoiceAction(
  invoiceId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const itemsRaw = formData.get("items");
  let items;
  try {
    items = JSON.parse(itemsRaw as string);
  } catch {
    return { error: "Format de lignes invalide" };
  }

  const parsed = InvoiceSchema.safeParse({
    client_id: formData.get("client_id"),
    items,
    discount: formData.get("discount") || 0,
    notes: formData.get("notes"),
    due_date: formData.get("due_date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .single();

  if (!existing) return { error: "Facture introuvable" };
  if (existing.status !== "draft") {
    return { error: "Seules les factures en brouillon peuvent être modifiées" };
  }

  const { subtotal, tax, total } = calculateTotals(
    parsed.data.items,
    company.tax_rate,
    parsed.data.discount,
  );

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      client_id: parsed.data.client_id,
      subtotal,
      tax,
      discount: parsed.data.discount,
      total,
      notes: parsed.data.notes || null,
      due_date: parsed.data.due_date || null,
    })
    .eq("id", invoiceId);

  if (updateError)
    return { error: "Erreur lors de la mise à jour de la facture" };

  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);

  const itemsToInsert = parsed.data.items.map((item) => ({
    invoice_id: invoiceId,
    product_id: item.product_id || null,
    designation: item.designation,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.quantity * item.unit_price,
  }));

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(itemsToInsert);
  if (itemsError) return { error: "Erreur lors de la mise à jour des lignes" };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}`);
}
