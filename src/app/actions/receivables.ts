/**
 * Server Actions — Créances (Receivables) & Paiements
 *
 * Gestion des paiements partiels et du suivi des créances.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./auth";
import type { PaymentTransactionInsert } from "@/types";

const PaymentSchema = z.object({
  amount: z.number().positive("Le montant doit être positif"),
  payment_method: z.enum(["cash", "transfer", "check", "card", "other"]),
  payment_date: z.string().min(1, "La date de paiement est requise"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

async function getCurrentCompany() {
  return getCurrentCompanyForAction();
}

// ── ADD PAYMENT ───────────────────────────────────────────────────────────────

export async function addPaymentAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const receivableId = formData.get("receivableId") as string;

  const parsed = PaymentSchema.safeParse({
    amount: parseFloat(formData.get("amount") as string),
    payment_method: formData.get("payment_method"),
    payment_date: formData.get("payment_date"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  const supabase = await createClient();

  // Vérifier que la créance appartient à l'entreprise
  const { data: receivable } = await supabase
    .from("receivables")
    .select("*")
    .eq("id", receivableId)
    .eq("company_id", company.id)
    .single();

  if (!receivable) {
    return { error: "Créance introuvable" };
  }

  // Vérifier que le paiement ne dépasse pas le reste à payer
  if (parsed.data.amount > receivable.remaining_amount) {
    return { error: "Le paiement dépasse le reste à payer" };
  }

  const paymentData: PaymentTransactionInsert = {
    receivable_id: receivableId,
    amount: parsed.data.amount,
    payment_method: parsed.data.payment_method,
    payment_date: parsed.data.payment_date,
    reference: parsed.data.reference ?? null,
    notes: parsed.data.notes ?? null,
  };

  const { error } = await supabase.from("payment_transactions").insert(paymentData);

  if (error) {
    console.error("Supabase error:", error);
    return { error: `Erreur lors de l'ajout du paiement: ${error.message}` };
  }

  revalidatePath("/receivables");
  revalidatePath(`/receivables/${receivableId}`);
  return { success: true };
}

// ── DELETE PAYMENT ─────────────────────────────────────────────────────────────

export async function deletePaymentAction(formData: FormData): Promise<void> {
  const paymentId = formData.get("paymentId") as string;
  const receivableId = formData.get("receivableId") as string;

  const supabase = await createClient();
  const company = await getCurrentCompany();

  if (!company) throw new Error("Entreprise introuvable");

  // Vérifier que le paiement appartient à une créance de l'entreprise
  const { data: payment } = await supabase
    .from("payment_transactions")
    .select("*, receivable:receivables(*)")
    .eq("id", paymentId)
    .single();

  if (!payment || payment.receivable?.company_id !== company.id) {
    throw new Error("Paiement introuvable");
  }

  // Supprimer le paiement (le trigger mettra à jour la créance automatiquement)
  const { error } = await supabase.from("payment_transactions").delete().eq("id", paymentId);

  if (error) throw new Error("Erreur lors de la suppression du paiement");

  revalidatePath("/receivables");
  revalidatePath(`/receivables/${receivableId}`);
}

// ── UPDATE RECEIVABLE ───────────────────────────────────────────────────────────

export async function updateReceivableAction(
  receivableId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const dueDate = formData.get("due_date") as string | null;
  const totalAmount = parseFloat(formData.get("total_amount") as string);

  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  const supabase = await createClient();

  // Vérifier que la créance appartient à l'entreprise
  const { data: receivable } = await supabase
    .from("receivables")
    .select("*")
    .eq("id", receivableId)
    .eq("company_id", company.id)
    .single();

  if (!receivable) {
    return { error: "Créance introuvable" };
  }

  // Vérifier que le nouveau montant total n'est pas inférieur au montant déjà payé
  if (totalAmount < Number(receivable.paid_amount)) {
    return {
      error: "Le montant total ne peut pas être inférieur au montant déjà payé",
    };
  }

  const { error } = await supabase
    .from("receivables")
    .update({
      due_date: dueDate || null,
      total_amount: totalAmount,
    })
    .eq("id", receivableId);

  if (error) {
    console.error("Supabase error:", error);
    return {
      error: `Erreur lors de la mise à jour de la créance: ${error.message}`,
    };
  }

  revalidatePath("/receivables");
  revalidatePath(`/receivables/${receivableId}`);
  return { success: true };
}

// ── DELETE RECEIVABLE ───────────────────────────────────────────────────────────

export async function deleteReceivableAction(receivableId: string): Promise<ActionResult> {
  const company = await getCurrentCompany();
  if (!company) return { error: "Entreprise introuvable" };

  const supabase = await createClient();

  // Vérifier que la créance appartient à l'entreprise
  const { data: receivable } = await supabase
    .from("receivables")
    .select("*")
    .eq("id", receivableId)
    .eq("company_id", company.id)
    .single();

  if (!receivable) {
    return { error: "Créance introuvable" };
  }

  // Empêcher la suppression si des paiements existent
  const { count: paymentCount } = await supabase
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("receivable_id", receivableId);

  if ((paymentCount ?? 0) > 0) {
    return {
      error: "Impossible de supprimer : des paiements sont associés à cette créance",
    };
  }

  const { error } = await supabase.from("receivables").delete().eq("id", receivableId);

  if (error) {
    console.error("Supabase error:", error);
    return {
      error: `Erreur lors de la suppression de la créance: ${error.message}`,
    };
  }

  revalidatePath("/receivables");
  return { success: true };
}

// ── GET RECEIVABLE STATS ───────────────────────────────────────────────────────

export async function getReceivableStats() {
  const supabase = await createClient();
  const company = await getCurrentCompany();

  if (!company) return null;

  const { data: stats } = await supabase
    .from("receivables")
    .select("status, total_amount, paid_amount, remaining_amount")
    .eq("company_id", company.id);

  if (!stats) return null;

  const totalAmount = stats.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const totalPaid = stats.reduce((sum, r) => sum + Number(r.paid_amount), 0);
  const totalRemaining = stats.reduce((sum, r) => sum + Number(r.remaining_amount), 0);

  const byStatus = stats.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalAmount,
    totalPaid,
    totalRemaining,
    byStatus,
  };
}
