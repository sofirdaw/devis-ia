import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/admin-access";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, user_id, name, email, subscription_plan, subscription_status, subscription_started_at, subscription_expires_at, trial_started_at, trial_ends_at"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: data || [] });
}

export async function PATCH(request: Request) {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const body = (await request.json()) as {
    companyId?: string;
    status?: "active" | "suspended";
    action?: "cancel_subscription";
  };
  if (!body.companyId || !body.status)
    return NextResponse.json({ error: "Entreprise ou statut manquant." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, user_id, trial_ends_at")
    .eq("id", body.companyId)
    .single();
  if (companyError || !company)
    return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  if (body.action === "cancel_subscription") {
    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("id, amount, currency")
      .eq("company_id", body.companyId)
      .eq("status", "paid")
      .not("activated_at", "is", null)
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment) {
      const { error: paymentError } = await supabase
        .from("subscription_payments")
        .update({ status: "cancelled", refund_status: "pending" })
        .eq("id", payment.id)
        .eq("status", "paid");
      if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    const trialIsValid = company.trial_ends_at && new Date(company.trial_ends_at) > new Date();
    const { error: cancelError } = await supabase
      .from("companies")
      .update({
        subscription_plan: null,
        subscription_status: trialIsValid ? "trial" : "expired",
        subscription_started_at: null,
        subscription_expires_at: null,
      })
      .eq("id", body.companyId);
    if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 });

    await invalidateCache(companyCacheKey(company.user_id), dashboardCacheKey(company.id));
    return NextResponse.json({ success: true, refundStatus: payment ? "pending" : null });
  }

  const { error } = await supabase
    .from("companies")
    .update({ subscription_status: body.status })
    .eq("id", body.companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateCache(companyCacheKey(company.user_id), dashboardCacheKey(company.id));
  return NextResponse.json({ success: true });
}
