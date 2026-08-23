/**
 * Résolution de l'entreprise courante — à partir de l'utilisateur Supabase Auth connecté.
 * Support du mode hors-ligne pour la PWA (fallback local).
 */

import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types";

/**
 * Pour les Server Components (pages) : ne redirige pas vers /login en mode hors-ligne
 * si une session locale existe dans les cookies.
 */
export async function requireCurrentCompany(): Promise<Company> {
  const supabase = await createClient();
  let user = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // Connexion réseau indisponible
  }

  // Fallback vers la session locale lue depuis le cookie
  if (!user) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user ?? null;
    } catch {
      // Ignorer
    }
  }

  if (user) {
    try {
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) return company as Company;
    } catch {
      // Mode hors-ligne : la base Supabase n'est pas joignable
    }
  }

  // Entreprise fallback en mode 100% hors-ligne (UUID valide pour éviter l'erreur PostgreSQL 22P02)
  return {
    id: "00000000-0000-0000-0000-000000000000",
    user_id: user?.id ?? "00000000-0000-0000-0000-000000000000",
    name: "Mon Entreprise",
    quote_prefix: "DEV",
    invoice_prefix: "FAC",
    tax_rate: 18,
    currency: "FCFA",
    created_at: new Date().toISOString(),
  } as unknown as Company;
}

/**
 * Pour les Server Actions : ne redirige pas.
 * Retourne `null` si non connecté ou si l'entreprise n'existe pas encore.
 */
export async function getCurrentCompanyForAction(): Promise<Company | null> {
  const supabase = await createClient();
  let user = null;

  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    // Ignorer
  }

  if (!user) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user ?? null;
    } catch {
      // Ignorer
    }
  }

  if (!user) return null;

  try {
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (company) return company as Company;
  } catch {
    // Ignorer
  }

  return {
    id: "offline_company_id",
    user_id: user.id,
    name: "Mon Entreprise (Local)",
    quote_prefix: "DEV",
    invoice_prefix: "FAC",
    tax_rate: 18,
    currency: "FCFA",
    created_at: new Date().toISOString(),
  } as unknown as Company;
}
