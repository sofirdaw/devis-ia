import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrangeMoneyPayment } from "@/lib/orange-money";
import { PLANS, type PlanId } from "@/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plan?: string };
    const plan = body.plan as PlanId;
    if (!plan || !(plan in PLANS)) {
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

    const orderId = `DVI-${crypto.randomUUID()}`;
    const origin = new URL(request.url).origin;
    const { data: payment, error: insertError } = await supabase
      .from("subscription_payments")
      .insert({
        company_id: company.id,
        plan,
        amount: PLANS[plan].price,
        currency: process.env.ORANGE_MONEY_CURRENCY || "XOF",
        order_id: orderId,
      })
      .select("id")
      .single();
    if (insertError || !payment) throw new Error(insertError?.message || "Paiement non créé.");

    try {
      const orangePayment = await createOrangeMoneyPayment({
        plan,
        orderId,
        returnUrl: `${origin}/subscription?payment=return`,
        cancelUrl: `${origin}/subscription?payment=cancelled`,
        notificationUrl: `${origin}/api/subscriptions/webhook`,
      });
      await supabase
        .from("subscription_payments")
        .update({
          orange_payment_token: orangePayment.paymentToken,
        })
        .eq("id", payment.id);
      return NextResponse.json({ paymentUrl: orangePayment.paymentUrl });
    } catch (error) {
      await supabase
        .from("subscription_payments")
        .update({ status: "failed" })
        .eq("id", payment.id);
      throw error;
    }
  } catch (error) {
    console.error("Orange Money payment creation failed:", error);
    return NextResponse.json(
      { error: "Impossible de démarrer le paiement Orange Money." },
      { status: 502 }
    );
  }
}
