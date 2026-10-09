/**
 * Server Actions — Entreprise (Company)
 *
 * Gère la création et la mise à jour des informations d'entreprise.
 * Utilisé par la page /setup (onboarding) et /settings.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "./auth";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";
import { convertLogoToJpeg } from "@/lib/company-logo";

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
  use_pdf_header: z.enum(["on", "off"]).optional(),
});

/**
 * Crée l'entreprise pour l'utilisateur connecté (onboarding initial).
 * Redirige vers /dashboard une fois créée.
 */
export async function createCompanyAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = CompanySchema.safeParse({
    name: formData.get("name") || "",
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    rccm: formData.get("rccm") || undefined,
    ifu: formData.get("ifu") || undefined,
    cme: formData.get("cme") || undefined,
    default_quote_notes: formData.get("default_quote_notes") || undefined,
    default_invoice_notes: formData.get("default_invoice_notes") || undefined,
    use_pdf_header: formData.get("use_pdf_header") === "on" ? "on" : "off",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Vous devez être connecté pour créer une entreprise" };
  }

  const userId = user.id;

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

  const { data: company, error: insertError } = await supabase
    .from("companies")
    .insert({
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
      quote_pdf_template: "classic",
      invoice_pdf_template: "classic",
      quote_pdf_use_header: parsed.data.use_pdf_header === "on",
      invoice_pdf_use_header: parsed.data.use_pdf_header === "on",
      subscription_status: "trial",
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Erreur création entreprise:", insertError);
    return {
      error: `Erreur lors de la création de l'entreprise: ${insertError.message}`,
    };
  }

  // Upload du logo si un fichier est fourni
  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    if (!logoFile.type.startsWith("image/")) {
      return { error: "Le fichier doit être une image" };
    }

    if (logoFile.size > 2 * 1024 * 1024) {
      return { error: "L'image doit faire moins de 2 Mo" };
    }

    const jpegLogo = await convertLogoToJpeg(logoFile);
    const path = `${company.id}/logo.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, jpegLogo, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      console.error("Erreur upload logo:", uploadError);
      return { error: `Erreur lors de l'upload du logo: ${uploadError.message}` };
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Mettre à jour l'entreprise avec l'URL du logo
    const { data: updatedCompany, error: updateError } = await supabase
      .from("companies")
      .update({ logo_url: logoUrl })
      .eq("id", company.id)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedCompany) {
      console.error("Erreur update logo_url:", updateError);
      return { error: "Erreur lors de l'enregistrement du logo" };
    }
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
  formData: FormData
): Promise<ActionResult> {
  const parsed = CompanySchema.safeParse({
    name: formData.get("name") || "",
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    rccm: formData.get("rccm") || undefined,
    ifu: formData.get("ifu") || undefined,
    cme: formData.get("cme") || undefined,
    default_quote_notes: formData.get("default_quote_notes") || undefined,
    default_invoice_notes: formData.get("default_invoice_notes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  let targetCompanyId = companyId;
  if (
    !targetCompanyId ||
    targetCompanyId === "00000000-0000-0000-0000-000000000000" ||
    targetCompanyId.startsWith("offline")
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: realComp } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (realComp?.id) targetCompanyId = realComp.id;
      }
    } catch {
      // Hors-ligne
    }
  }

  if (
    !targetCompanyId ||
    targetCompanyId === "00000000-0000-0000-0000-000000000000" ||
    targetCompanyId.startsWith("offline")
  ) {
    return { success: true };
  }

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
    .eq("id", targetCompanyId);

  if (error) {
    console.error("Erreur update company:", error);
    return { error: `Erreur lors de la mise à jour: ${error.message}` };
  }

  const {
    data: { user: updatedByUser },
  } = await supabase.auth.getUser();
  if (updatedByUser) {
    await invalidateCache(companyCacheKey(updatedByUser.id), dashboardCacheKey(targetCompanyId));
  }

  return { success: true };
}

/**
 * Met à jour les préférences de numérotation et TVA.
 * Utilisé depuis la page /settings, section "Préférences".
 */
export async function updateCompanyPreferencesAction(
  companyId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const PreferencesSchema = z.object({
    quote_prefix: z.string().min(1, "Préfixe requis").max(10),
    invoice_prefix: z.string().min(1, "Préfixe requis").max(10),
    tax_rate: z.coerce.number().min(0).max(100),
    quote_pdf_template: z.enum(["classic", "modern", "minimal"]),
    invoice_pdf_template: z.enum(["classic", "modern", "minimal"]),
    quote_pdf_use_header: z.enum(["on", "off"]),
    invoice_pdf_use_header: z.enum(["on", "off"]),
    service_description: z.string().max(140, "La description ne peut pas dépasser 140 caractères"),
  });

  const parsed = PreferencesSchema.safeParse({
    quote_prefix: formData.get("quote_prefix"),
    invoice_prefix: formData.get("invoice_prefix"),
    tax_rate: formData.get("tax_rate"),
    quote_pdf_template: formData.get("quote_pdf_template") || "classic",
    invoice_pdf_template: formData.get("invoice_pdf_template") || "classic",
    quote_pdf_use_header: formData.get("quote_pdf_use_header") === "on" ? "on" : "off",
    invoice_pdf_use_header: formData.get("invoice_pdf_use_header") === "on" ? "on" : "off",
    service_description: formData.get("service_description") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  let targetCompanyId = companyId;
  if (
    !targetCompanyId ||
    targetCompanyId === "00000000-0000-0000-0000-000000000000" ||
    targetCompanyId.startsWith("offline")
  ) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: realComp } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (realComp?.id) targetCompanyId = realComp.id;
      }
    } catch {
      // Hors-ligne
    }
  }

  if (
    !targetCompanyId ||
    targetCompanyId === "00000000-0000-0000-0000-000000000000" ||
    targetCompanyId.startsWith("offline")
  ) {
    return { success: true };
  }

  const { error } = await supabase
    .from("companies")
    .update({
      quote_prefix: parsed.data.quote_prefix.toUpperCase(),
      invoice_prefix: parsed.data.invoice_prefix.toUpperCase(),
      tax_rate: parsed.data.tax_rate,
      quote_pdf_template: parsed.data.quote_pdf_template,
      invoice_pdf_template: parsed.data.invoice_pdf_template,
      quote_pdf_use_header: parsed.data.quote_pdf_use_header === "on",
      invoice_pdf_use_header: parsed.data.invoice_pdf_use_header === "on",
      service_description: parsed.data.service_description.trim() || null,
    })
    .eq("id", targetCompanyId);

  if (error) return { error: "Erreur lors de la mise à jour des préférences" };

  return { success: true };
}

/**
 * Upload le logo de l'entreprise vers Supabase Storage (bucket "logos", public)
 * et met à jour le champ logo_url de l'entreprise.
 */
export async function uploadCompanyLogoAction(
  companyId: string,
  formData: FormData
): Promise<ActionResult & { logoUrl?: string }> {
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
  const jpegLogo = await convertLogoToJpeg(file);
  const path = `${companyId}/logo.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, jpegLogo, { upsert: true, contentType: "image/jpeg" });

  if (uploadError) {
    console.error("Erreur upload logo:", uploadError);
    return { error: `Erreur lors de l'upload du logo: ${uploadError.message}` };
  }

  // Récupérer l'URL publique (le bucket "logos" est public)
  const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);

  // Ajouter un timestamp pour forcer le rafraîchissement du cache navigateur
  const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { data: updatedCompany, error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", companyId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedCompany) {
    console.error("Erreur update logo_url:", updateError);
    return {
      error: updateError
        ? `Erreur lors de l'enregistrement du logo: ${updateError.message}`
        : "Entreprise introuvable pour enregistrer le logo",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true, logoUrl };
}
