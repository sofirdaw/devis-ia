/**
 * Server Actions — Entreprise (Company)
 *
 * Gère la création et la mise à jour des informations d'entreprise.
 * Utilisé par la page /setup (onboarding) et /settings.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./auth";

const CompanySchema = z.object({
  name: z.string().min(2, "Le nom de l'entreprise est requis"),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  address: z.string().optional(),
  rccm: z.string().optional(),
  ifu: z.string().optional(),
  cme: z.string().optional(),
  default_quote_notes: z.string().optional(),
  default_invoice_notes: z.string().optional(),
});

/**
 * Crée l'entreprise pour l'utilisateur connecté (onboarding initial).
 * Redirige vers /dashboard une fois créée.
 */
export async function createCompanyAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = CompanySchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    rccm: formData.get("rccm"),
    ifu: formData.get("ifu"),
    cme: formData.get("cme"),
    default_quote_notes: formData.get("default_quote_notes"),
    default_invoice_notes: formData.get("default_invoice_notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { userId } = await auth();
  if (!userId) {
    return { error: "Vous devez être connecté pour créer une entreprise" };
  }

  const supabase = await createClient();

  // Empêche la création de plusieurs entreprises pour le même utilisateur
  // (ex: double clic, ou retour accidentel sur /setup).
  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingCompany) {
    redirect("/dashboard");
  }

  const { error } = await supabase.from("companies").insert({
    user_id: userId,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    rccm: parsed.data.rccm || null,
    ifu: parsed.data.ifu || null,
    cme: parsed.data.cme || null,
    default_quote_notes: parsed.data.default_quote_notes || null,
    default_invoice_notes: parsed.data.default_invoice_notes || null,
  });

  if (error) {
    console.error("Erreur création entreprise:", error);
    return {
      error: `Erreur lors de la création de l'entreprise: ${error.message}`,
    };
  }

  redirect("/dashboard");
}

/**
 * Met à jour les informations de l'entreprise existante.
 * Utilisé depuis la page /settings.
 */
export async function updateCompanyAction(
  companyId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = CompanySchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    address: formData.get("address"),
    rccm: formData.get("rccm"),
    ifu: formData.get("ifu"),
    cme: formData.get("cme"),
    default_quote_notes: formData.get("default_quote_notes"),
    default_invoice_notes: formData.get("default_invoice_notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      rccm: parsed.data.rccm || null,
      ifu: parsed.data.ifu || null,
      cme: parsed.data.cme || null,
      default_quote_notes: parsed.data.default_quote_notes || null,
      default_invoice_notes: parsed.data.default_invoice_notes || null,
    })
    .eq("id", companyId);

  if (error) {
    console.error("Erreur update company:", error);
    return { error: `Erreur lors de la mise à jour: ${error.message}` };
  }

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Met à jour les préférences de numérotation et TVA.
 * Utilisé depuis la page /settings, section "Préférences".
 */
export async function updateCompanyPreferencesAction(
  companyId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const PreferencesSchema = z.object({
    quote_prefix: z.string().min(1, "Préfixe requis").max(10),
    invoice_prefix: z.string().min(1, "Préfixe requis").max(10),
    tax_rate: z.coerce.number().min(0).max(100),
  });

  const parsed = PreferencesSchema.safeParse({
    quote_prefix: formData.get("quote_prefix"),
    invoice_prefix: formData.get("invoice_prefix"),
    tax_rate: formData.get("tax_rate"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      quote_prefix: parsed.data.quote_prefix.toUpperCase(),
      invoice_prefix: parsed.data.invoice_prefix.toUpperCase(),
      tax_rate: parsed.data.tax_rate,
    })
    .eq("id", companyId);

  if (error) return { error: "Erreur lors de la mise à jour des préférences" };

  revalidatePath("/settings");
  return { success: true };
}

/**
 * Upload le logo de l'entreprise vers Supabase Storage (bucket "logos", public)
 * et met à jour le champ logo_url de l'entreprise.
 */
export async function uploadCompanyLogoAction(
  companyId: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("logo") as File | null;

  if (!file || file.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Le fichier doit être une image" };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { error: "L'image doit faire moins de 2 Mo" };
  }

  const supabase = await createClient();

  // Chemin unique : un dossier par entreprise, nom de fichier fixe "logo"
  // pour que le upsert remplace l'ancien logo automatiquement.
  const extension = file.name.split(".").pop();
  const path = `${companyId}/logo.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    console.error("Erreur upload logo:", uploadError);
    return { error: `Erreur lors de l'upload du logo: ${uploadError.message}` };
  }

  // Récupérer l'URL publique (le bucket "logos" est public)
  const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);

  // Ajouter un timestamp pour forcer le rafraîchissement du cache navigateur
  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", companyId);

  if (updateError) {
    return { error: "Erreur lors de l'enregistrement du logo" };
  }

  revalidatePath("/settings");
  return { success: true };
}
