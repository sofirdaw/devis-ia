import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/subscription";

export const runtime = "nodejs";

type ManualPaymentRequest = {
  request_id: string;
  request_order_id: string;
  request_plan: PlanId;
  request_user_confirmed_at: string | null;
  reused: boolean;
};

function isManualPaymentRequest(value: unknown): value is ManualPaymentRequest {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.request_id === "string" &&
    typeof result.request_order_id === "string" &&
    typeof result.request_plan === "string" &&
    Object.hasOwn(PLANS, result.request_plan) &&
    (typeof result.request_user_confirmed_at === "string" ||
      result.request_user_confirmed_at === null) &&
    typeof result.reused === "boolean"
  );
}

export async function POST(request: Request) {
  try {
    const { plan } = (await request.json()) as { plan?: string };
    if (!plan || !Object.hasOwn(PLANS, plan)) {
      return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

    const orderId = `MANUAL-${crypto.randomUUID()}`;
    const { data: payment, error } = await supabase
      .rpc("create_or_reuse_manual_subscription_payment", {
        p_company_id: company.id,
        p_plan: plan as PlanId,
        p_amount: PLANS[plan as PlanId].price,
        p_currency: process.env.ORANGE_MONEY_CURRENCY || "XOF",
        p_order_id: orderId,
        p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .single();

    if (error || !isManualPaymentRequest(payment)) {
      throw new Error(error?.message || "Réponse invalide lors de la création de la demande.");
    }
    return NextResponse.json({
      requestId: payment.request_id,
      orderId: payment.request_order_id,
      plan: payment.request_plan,
      alreadyConfirmed: Boolean(payment.request_user_confirmed_at),
      reused: payment.reused,
    });
  } catch (error) {
    console.error("Subscription request failed:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer la demande." }, { status: 500 });
  }
}
