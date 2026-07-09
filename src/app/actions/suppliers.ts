/**
 * Server Actions pour les fournisseurs
 *
 * Opérations CRUD sur les fournisseurs
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import type { ActionResult } from "./auth";
import type { SupplierInsert } from "@/types";

export async function createSupplierAction(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string | null;
  const email = formData.get("email") as string | null;
  const address = formData.get("address") as string | null;

  if (!name) {
    return { error: "Le nom du fournisseur est requis" };
  }

  const company = await getCurrentCompanyForAction();

  if (!company) {
    return { error: "Entreprise introuvable" };
  }

  const supplierData: SupplierInsert = {
    company_id: company.id,
    name,
    phone: phone || null,
    email: email || null,
    address: address || null,
  };

  const { error } = await supabase.from("suppliers").insert(supplierData);

  if (error) {
    console.error("Supabase error:", error);
    return {
      error: `Erreur lors de la création du fournisseur: ${error.message}`,
    };
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function updateSupplierAction(
  _prevState: ActionResult,
  formData: FormData,
  supplierId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string | null;
  const email = formData.get("email") as string | null;
  const address = formData.get("address") as string | null;

  if (!name) {
    return { error: "Le nom du fournisseur est requis" };
  }

  const company = await getCurrentCompanyForAction();
  if (!company) {
    return { error: "Entreprise introuvable" };
  }

  const { error } = await supabase
    .from("suppliers")
    .update({
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
    })
    .eq("id", supplierId)
    .eq("company_id", company.id);

  if (error) {
    return { error: "Erreur lors de la mise à jour du fournisseur" };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  redirect(`/suppliers/${supplierId}`);
}

export async function deleteSupplierAction(
  supplierId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const company = await getCurrentCompanyForAction();
  if (!company) {
    return { error: "Entreprise introuvable" };
  }

  const { error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", supplierId)
    .eq("company_id", company.id);

  if (error) {
    return { error: "Erreur lors de la suppression du fournisseur" };
  }

  revalidatePath("/suppliers");
  redirect("/suppliers");
}
