import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

export const runtime = "nodejs";

type OrangePaymentActivation = {
  activated_company_id: string;
  activated_user_id: string;
  already_activated: boolean;
};

function isOrangePaymentActivation(value: unknown): value is OrangePaymentActivation {
  if (typeof value !== "object" || value === null) return false;
  const activation = value as Record<string, unknown>;
  return (
    typeof activation.activated_company_id === "string" &&
    typeof activation.activated_user_id === "string" &&
    typeof activation.already_activated === "boolean"
  );
}

function isPaidStatus(value: unknown) {
  return ["paid", "successful", "success", "completed", "SUCCESS"].includes(String(value));
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
    const paidAmount = Number(payload.amount);
    if (!Number.isSafeInteger(paidAmount) || paidAmount <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const transactionId = String(payload.transaction_id || payload.transactionId || "");
    const { data: activation, error } = await supabase
      .rpc("activate_orange_subscription_payment", {
        p_order_id: orderId,
        p_transaction_id: transactionId,
        p_paid_amount: paidAmount,
      })
      .single();
    if (error) {
      if (error.code === "P0002")
        return NextResponse.json({ error: "Commande inconnue." }, { status: 404 });
      if (error.code === "P0001" || error.code === "22023")
        return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    if (!isOrangePaymentActivation(activation)) {
      throw new Error("Réponse d'activation Orange Money invalide.");
    }

    if (!activation.already_activated)
      await invalidateCache(
        companyCacheKey(activation.activated_user_id),
        dashboardCacheKey(activation.activated_company_id)
      );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Orange Money webhook failed:", error);
    return NextResponse.json({ error: "Notification non traitée." }, { status: 500 });
  }
}
