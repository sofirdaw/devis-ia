/**
 * Résolution de l'entreprise courante — à partir de l'utilisateur Clerk connecté.
 *
 * Remplace l'ancien pattern "Temporairement: prendre la première entreprise
 * (sans auth)" qui était dupliqué dans ~20 fichiers. Ce pattern piochait la
 * toute première ligne de la table `companies` (tous utilisateurs confondus,
 * sans ordre garanti), ce qui pouvait faire "sauter" les données d'un
 * utilisateur à l'autre de façon incohérente (créer un fournisseur pour une
 * entreprise, puis le voir disparaître car une page suivante récupère une
 * autre entreprise "première" par hasard).
 *
 * Utiliser ces helpers partout où l'ancien pattern était utilisé.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/types";

/**
 * Pour les Server Components (pages) : redirige automatiquement si
 * l'utilisateur n'est pas connecté ou n'a pas encore créé son entreprise.
 */
export async function requireCurrentCompany(): Promise<Company> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!company) redirect("/setup");

  return company as Company;
}

/**
 * Pour les Server Actions : ne redirige pas (on ne peut pas rediriger au
 * milieu d'une mutation sans casser le retour d'état du formulaire).
 * Retourne `null` si non connecté ou si l'entreprise n'existe pas encore.
 */
export async function getCurrentCompanyForAction(): Promise<Company | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return (company as Company) ?? null;
}
