"use server";

import { createClient } from "@/lib/supabase/server";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

type Plan = "monthly" | "quarter" | "year";

/**
 * Active un abonnement pour l'entreprise de l'utilisateur connecté.
 * Définit `subscription_status` à `active` et `subscription_expires_at` selon le plan choisi.
 */
export async function subscribeCompanyAction(plan: Plan) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Utilisateur non connecté" };

  const { data: company } = await supabase
    .from("companies")
    .select("id, subscription_expires_at, trial_ends_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company?.id) return { error: "Entreprise introuvable" };

  const now = new Date();
  const currentExpiry = company.subscription_expires_at
    ? new Date(company.subscription_expires_at)
    : now;
  const trialExpiry = company.trial_ends_at ? new Date(company.trial_ends_at) : now;
  const startsAt = new Date(
    Math.max(now.getTime(), currentExpiry.getTime(), trialExpiry.getTime())
  );
  const expires = new Date(startsAt);
  if (plan === "monthly") {
    expires.setMonth(expires.getMonth() + 1);
  } else if (plan === "quarter") {
    expires.setMonth(expires.getMonth() + 3);
  } else if (plan === "year") {
    expires.setFullYear(expires.getFullYear() + 1);
  }

  const { error } = await supabase
    .from("companies")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_started_at: startsAt.toISOString(),
      subscription_expires_at: expires.toISOString(),
    })
    .eq("id", company.id);

  if (error) return { error: error.message };
  await invalidateCache(companyCacheKey(user.id), dashboardCacheKey(company.id));
  return { success: true };
}
