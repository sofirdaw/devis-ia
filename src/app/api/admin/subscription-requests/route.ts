import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanId } from "@/lib/subscription";
import { isCurrentUserAdmin } from "@/lib/admin-access";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const supabase = createAdminClient();
  const { data: payments, error } = await supabase
    .from("subscription_payments")
    .select(
      "id, company_id, plan, amount, currency, order_id, status, created_at, payment_request_expires_at, user_confirmed_at"
    )
    .eq("status", "pending")
    .not("user_confirmed_at", "is", null)
    .gt("payment_request_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const companyIds = [...new Set((payments || []).map((payment) => payment.company_id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name, email, phone").in("id", companyIds)
    : { data: [] };
  const companyById = new Map((companies || []).map((company) => [company.id, company]));

  return NextResponse.json({
    requests: (payments || []).map((payment) => ({
      ...payment,
      company: companyById.get(payment.company_id) || null,
    })),
  });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const { requestId } = (await request.json()) as { requestId?: string };
  if (!requestId) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: payment, error: paymentError } = await supabase
    .from("subscription_payments")
    .select("id, company_id, plan, amount, status, user_confirmed_at, payment_request_expires_at")
    .eq("id", requestId)
    .eq("status", "pending")
    .single();
  if (paymentError || !payment)
    return NextResponse.json({ error: "Demande introuvable ou déjà traitée." }, { status: 404 });
  if (!payment.user_confirmed_at)
    return NextResponse.json(
      { error: "L'utilisateur n'a pas encore confirmé son paiement." },
      { status: 409 }
    );
  if (
    payment.payment_request_expires_at &&
    new Date(payment.payment_request_expires_at) <= new Date()
  )
    return NextResponse.json({ error: "Cette demande a expiré." }, { status: 410 });

  const plan = payment.plan as PlanId;
  if (!(plan in PLANS)) return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });

  const now = new Date();
  const currentCompany = await supabase
    .from("companies")
    .select("user_id, subscription_expires_at")
    .eq("id", payment.company_id)
    .single();
  if (currentCompany.error || !currentCompany.data)
    return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  const currentExpiry = currentCompany.data.subscription_expires_at
    ? new Date(currentCompany.data.subscription_expires_at)
    : now;
  const startsAt = currentExpiry > now ? currentExpiry : now;
  const expiresAt = new Date(startsAt);
  if (plan === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
  if (plan === "quarter") expiresAt.setMonth(expiresAt.getMonth() + 3);
  if (plan === "year") expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { error: updatePaymentError } = await supabase
    .from("subscription_payments")
    .update({
      status: "paid",
      paid_at: now.toISOString(),
      activated_at: now.toISOString(),
    })
    .eq("id", payment.id)
    .eq("status", "pending");
  if (updatePaymentError)
    return NextResponse.json({ error: updatePaymentError.message }, { status: 500 });

  const { error: companyUpdateError } = await supabase
    .from("companies")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_started_at: startsAt.toISOString(),
      subscription_expires_at: expiresAt.toISOString(),
    })
    .eq("id", payment.company_id);
  if (companyUpdateError)
    return NextResponse.json({ error: companyUpdateError.message }, { status: 500 });

  const { error: activationError } = await supabase.from("subscription_activations").insert({
    payment_id: payment.id,
    company_id: payment.company_id,
    plan,
  });
  if (activationError)
    return NextResponse.json({ error: activationError.message }, { status: 500 });

  await invalidateCache(
    companyCacheKey(currentCompany.data.user_id),
    dashboardCacheKey(payment.company_id)
  );
  return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() });
}
