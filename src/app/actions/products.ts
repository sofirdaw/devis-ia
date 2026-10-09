/**
 * Server Actions — Produits (CRUD complet)
 *
 * Le catalogue produits est central pour la feature IA (Semaine 3) :
 * GPT pourra reconnaître un produit existant et réutiliser son prix.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./auth";

const ProductSchema = z.object({
  name: z.string().min(2, "Le nom du produit est requis"),
  description: z.string().optional(),
  supplier_id: z.string().min(1, "Veuillez sélectionner un fournisseur"),
  price: z.coerce.number().min(0, "Le prix doit être positif"),
});

const OFFLINE_UUID = "00000000-0000-0000-0000-000000000000";

async function getCurrentCompanyId(): Promise<string | null> {
  const company = await getCurrentCompanyForAction();
  return company?.id ?? null;
}

// ── CREATE ───────────────────────────────────────────────────────────────────

export async function createProductAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supplierIdRaw = formData.get("supplier_id");
  const supplier_id =
    typeof supplierIdRaw === "string" && supplierIdRaw.trim() ? supplierIdRaw : undefined;

  const parsed = ProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    supplier_id,
    price: formData.get("price"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) return { error: "Entreprise introuvable" };

  const offlineSyncIdValue = formData.get("offline_sync_id");
  const offlineSyncId =
    typeof offlineSyncIdValue === "string" &&
    z.string().uuid().safeParse(offlineSyncIdValue).success
      ? offlineSyncIdValue
      : null;
  if (offlineSyncIdValue && !offlineSyncId)
    return { error: "Identifiant local de synchronisation invalide." };
  if (companyId === OFFLINE_UUID)
    return { error: "Connexion requise pour synchroniser le produit." };

  const supabase = await createClient();
  if (offlineSyncId) {
    const { data: existing, error: lookupError } = await supabase
      .from("products")
      .select("id")
      .eq("id", offlineSyncId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (lookupError) return { error: "Impossible de vérifier le produit déjà synchronisé." };
    if (existing) return { success: true };
  }

  const { error } = await supabase.from("products").insert({
    ...(offlineSyncId ? { id: offlineSyncId } : {}),
    company_id: companyId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    supplier_id: parsed.data.supplier_id || null,
    price: parsed.data.price,
  });

  if (error) {
    if (offlineSyncId && error.code === "23505") {
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("id", offlineSyncId)
        .eq("company_id", companyId)
        .maybeSingle();
      if (existing) return { success: true };
    }
    return { error: "Erreur lors de la création du produit" };
  }

  revalidatePath("/products");
  return { success: true };
}

// ── UPDATE ───────────────────────────────────────────────────────────────────

export async function updateProductAction(
  productId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supplierIdRaw = formData.get("supplier_id");
  const supplier_id =
    typeof supplierIdRaw === "string" && supplierIdRaw.trim() ? supplierIdRaw : undefined;

  const parsed = ProductSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    supplier_id,
    price: formData.get("price"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) return { error: "Entreprise introuvable" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      supplier_id: parsed.data.supplier_id || null,
      price: parsed.data.price,
    })
    .eq("id", productId)
    .eq("company_id", companyId);

  if (error) return { error: "Erreur lors de la mise à jour" };

  revalidatePath("/products");
  return { success: true };
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { error: "Entreprise introuvable" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("company_id", companyId);

  if (error) return { error: "Erreur lors de la suppression" };

  revalidatePath("/products");
  return { success: true };
}

// ── SEARCH (utilisé par l'IA en Semaine 3) ─────────────────────────────────────

/**
 * Récupère tous les produits d'une entreprise (pour injection dans le prompt IA)
 */
export async function getAllProducts() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .order("name");

  return data ?? [];
}
