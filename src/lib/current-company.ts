/**
 * Résolution de l'entreprise courante — à partir de l'utilisateur Supabase Auth connecté.
 * Support du mode hors-ligne pour la PWA (fallback local).
 */

import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types";
import { companyCacheKey, getCached, setCached } from "@/lib/cache";
import { redirect } from "next/navigation";

async function startInitialTrial(company: Company): Promise<Company> {
  if (
    company.subscription_status ||
    company.subscription_plan ||
    company.subscription_expires_at ||
    company.trial_started_at ||
    company.trial_ends_at
  ) {
    return company;
  }

  const supabase = await createClient();
  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setDate(endsAt.getDate() + 30);
  const { data, error } = await supabase
    .from("companies")
    .update({
      subscription_status: "trial",
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
    })
    .eq("id", company.id)
    .is("subscription_status", null)
    .is("subscription_plan", null)
    .is("subscription_expires_at", null)
    .is("trial_started_at", null)
    .is("trial_ends_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Impossible d'initialiser l'essai de l'entreprise:", error.message);
    return company;
  }
  if (data) return data as Company;

  const { data: latestCompany, error: lookupError } = await supabase
    .from("companies")
    .select("*")
    .eq("id", company.id)
    .maybeSingle();
  if (lookupError) {
    console.error(
      "Impossible de relire l'entreprise après l'initialisation de l'essai:",
      lookupError.message
    );
    return company;
  }
  return (latestCompany as Company | null) ?? company;
}

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
    let companyNotFound = false;
    try {
      const cachedCompany = await getCached<Company>(companyCacheKey(user.id));
      if (cachedCompany && cachedCompany.id !== "00000000-0000-0000-0000-000000000000") {
        const currentCompany = await startInitialTrial(cachedCompany);
        if (currentCompany !== cachedCompany) {
          await setCached(companyCacheKey(user.id), currentCompany, 60);
        }
        return currentCompany;
      }

      const { data: company, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (company) {
        const typedCompany = await startInitialTrial(company as Company);
        await setCached(companyCacheKey(user.id), typedCompany, 60);
        return typedCompany;
      }
      if (!error) {
        companyNotFound = true;
      } else {
        console.error("Impossible de vérifier l'entreprise de l'utilisateur:", error.message);
      }
    } catch {
      // La base Supabase peut être injoignable hors-ligne.
    }
    if (companyNotFound) redirect("/setup");
  }

  if (!user) redirect("/login");

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
    const cachedCompany = await getCached<Company>(companyCacheKey(user.id));
    if (cachedCompany && cachedCompany.id !== "00000000-0000-0000-0000-000000000000") {
      return cachedCompany;
    }

    const { data: company, error } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (company) {
      const typedCompany = company as Company;
      await setCached(companyCacheKey(user.id), typedCompany, 60);
      return typedCompany;
    }
    if (error) {
      console.error("Impossible de vérifier l'entreprise de l'utilisateur:", error.message);
    }
  } catch {
    // Ignorer
  }

  return null;
}
