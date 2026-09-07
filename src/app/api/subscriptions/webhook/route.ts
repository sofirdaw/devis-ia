import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS, type PlanId } from "@/lib/subscription";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

export const runtime = "nodejs";

function isPaidStatus(value: unknown) {
  return ["paid", "successful", "success", "completed", "SUCCESS"].includes(String(value));
}

function addPlanDuration(from: Date, plan: PlanId) {
  const expires = new Date(from);
  if (plan === "monthly") expires.setMonth(expires.getMonth() + 1);
  if (plan === "quarter") expires.setMonth(expires.getMonth() + 3);
  if (plan === "year") expires.setFullYear(expires.getFullYear() + 1);
  return expires;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ORANGE_MONEY_WEBHOOK_SECRET;
  if (!expectedSecret || request.headers.get("x-orange-webhook-secret") !== expectedSecret) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const orderId = String(payload.order_id || payload.orderId || payload.reference || "");
    const status = payload.status || payload.payment_status || payload.state;
    if (!orderId || !isPaidStatus(status)) {
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();
    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("id, company_id, plan, amount, status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!payment) return NextResponse.json({ error: "Commande inconnue." }, { status: 404 });
    if (payment.status === "paid") return NextResponse.json({ received: true });

    const paidAmount = Number(payload.amount);
    if (!Number.isFinite(paidAmount) || paidAmount !== payment.amount) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const plan = payment.plan as PlanId;
    if (!(plan in PLANS)) return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    const { data: company } = await supabase
      .from("companies")
      .select("user_id, subscription_expires_at")
      .eq("id", payment.company_id)
      .single();
    const now = new Date();
    const currentExpiry = company?.subscription_expires_at
      ? new Date(company.subscription_expires_at)
      : now;
    const startsAt = currentExpiry > now ? currentExpiry : now;
    const expiresAt = addPlanDuration(startsAt, plan);

    const { error } = await supabase
      .from("subscription_payments")
      .update({
        status: "paid",
        orange_transaction_id:
          String(payload.transaction_id || payload.transactionId || "") || null,
        paid_at: now.toISOString(),
      })
      .eq("id", payment.id);
    if (error) throw error;

    const { error: companyError } = await supabase
      .from("companies")
      .update({
        subscription_plan: plan,
        subscription_status: "active",
        subscription_started_at: startsAt.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("id", payment.company_id);
    if (companyError) throw companyError;
    if (company?.user_id)
      await invalidateCache(
        companyCacheKey(company.user_id),
        dashboardCacheKey(payment.company_id)
      );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Orange Money webhook failed:", error);
    return NextResponse.json({ error: "Notification non traitée." }, { status: 500 });
  }
}
