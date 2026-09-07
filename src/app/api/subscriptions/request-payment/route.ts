import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { plan } = (await request.json()) as { plan?: string };
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

    const orderId = `MANUAL-${crypto.randomUUID()}`;
    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .insert({
        company_id: company.id,
        plan: plan as PlanId,
        amount: PLANS[plan as PlanId].price,
        currency: process.env.ORANGE_MONEY_CURRENCY || "XOF",
        order_id: orderId,
        status: "pending",
        payment_request_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id, order_id")
      .single();

    if (error || !payment) throw new Error(error?.message || "Demande non créée.");
    return NextResponse.json({ requestId: payment.id, orderId: payment.order_id });
  } catch (error) {
    console.error("Subscription request failed:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer la demande." }, { status: 500 });
  }
}
