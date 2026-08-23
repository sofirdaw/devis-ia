/**
 * Server Actions — Clients (CRUD complet)
 *
 * Toutes les actions vérifient implicitement la sécurité via RLS Supabase :
 * un utilisateur ne peut jamais lire/modifier les clients d'une autre entreprise,
 * même s'il essaie de forcer un company_id différent.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./auth";

const ClientSchema = z.object({
  name: z.string().min(2, "Le nom est requis (2 caractères min)"),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  address: z.string().optional(),
});

/**
 * Récupère l'id de l'entreprise de l'utilisateur Supabase connecté.
 * Utilisé au début de chaque action pour scoper les requêtes.
 */
async function getCurrentCompanyId(): Promise<string | null> {
  const company = await getCurrentCompanyForAction();
  return company?.id ?? null;
}

// ── CREATE ───────────────────────────────────────────────────────────────────

export async function createClientAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = ClientSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) return { error: "Entreprise introuvable" };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({
    company_id: companyId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
  });

  if (error) {
    console.error("Erreur Supabase création client:", error);
    return { error: `Erreur lors de la création du client: ${error.message}` };
  }

  revalidatePath("/clients");
  return { success: true };
}

// ── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateClientAction(
  clientId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = ClientSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
    })
    .eq("id", clientId);

  if (error) return { error: "Erreur lors de la mise à jour" };

  revalidatePath("/clients");
  return { success: true };
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteClientAction(clientId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // Empêcher la suppression si le client a des devis/factures liés
  const { count: quoteCount } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);

  if ((quoteCount ?? 0) > 0 || (invoiceCount ?? 0) > 0) {
    return {
      error: "Impossible de supprimer : ce client a des devis ou factures liés",
    };
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) return { error: "Erreur lors de la suppression" };

  revalidatePath("/clients");
  return { success: true };
}

// ── SEARCH (utilisé aussi par l'IA en Semaine 3) ───────────────────────────────

/**
 * Recherche un client par nom (recherche partielle insensible à la casse).
 * Retourne le premier résultat ou null.
 */
export async function findClientByName(name: string) {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", companyId)
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();

  return data;
}
