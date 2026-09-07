import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashActivationCode } from "@/lib/activation-code";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

export const runtime = "nodejs";
const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const { requestId, code } = (await request.json()) as { requestId?: string; code?: string };
    if (!requestId || !/^\d{6}$/.test(code || "")) {
      return NextResponse.json({ error: "Le code doit contenir 6 chiffres." }, { status: 400 });
    }

    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

    const { data: company } = await userClient
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("subscription_payments")
      .select(
        "id, company_id, plan, status, activation_code_hash, activation_code_expires_at, activation_attempts, activated_at"
      )
      .eq("id", requestId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (!payment) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    if (payment.activated_at)
      return NextResponse.json({ error: "Ce code a déjà été utilisé." }, { status: 409 });
    if (payment.status !== "paid" || !payment.activation_code_hash)
      return NextResponse.json(
        { error: "Le paiement doit d'abord être vérifié par l'administrateur." },
        { status: 409 }
      );
    if ((payment.activation_attempts || 0) >= MAX_ATTEMPTS)
      return NextResponse.json({ error: "Nombre maximal de tentatives atteint." }, { status: 429 });
    if (
      !payment.activation_code_expires_at ||
      new Date(payment.activation_code_expires_at) <= new Date()
    )
      return NextResponse.json({ error: "Le code d'activation a expiré." }, { status: 410 });

    const attempts = (payment.activation_attempts || 0) + 1;
    const isValid = hashActivationCode(code!) === payment.activation_code_hash;
    await admin
      .from("subscription_payments")
      .update({ activation_attempts: attempts })
      .eq("id", payment.id);
    if (!isValid)
      return NextResponse.json(
        { error: `Code incorrect. Tentatives restantes : ${MAX_ATTEMPTS - attempts}.` },
        { status: 400 }
      );

    const now = new Date();
    const currentCompany = await admin
      .from("companies")
      .select("subscription_expires_at")
      .eq("id", company.id)
      .single();
    const currentExpiry = currentCompany.data?.subscription_expires_at
      ? new Date(currentCompany.data.subscription_expires_at)
      : now;
    const startsAt = currentExpiry > now ? currentExpiry : now;
    const expiresAt = new Date(startsAt);
    if (payment.plan === "monthly") expiresAt.setMonth(expiresAt.getMonth() + 1);
    if (payment.plan === "quarter") expiresAt.setMonth(expiresAt.getMonth() + 3);
    if (payment.plan === "year") expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error: companyError } = await admin
      .from("companies")
      .update({
        subscription_plan: payment.plan,
        subscription_status: "active",
        subscription_started_at: startsAt.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("id", company.id);
    if (companyError) return NextResponse.json({ error: companyError.message }, { status: 500 });

    const { error: paymentError } = await admin
      .from("subscription_payments")
      .update({ activated_at: now.toISOString() })
      .eq("id", payment.id)
      .is("activated_at", null);
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });

    const { error: activationError } = await admin.from("subscription_activations").insert({
      payment_id: payment.id,
      company_id: company.id,
      plan: payment.plan,
    });
    if (activationError)
      return NextResponse.json({ error: activationError.message }, { status: 500 });

    await invalidateCache(companyCacheKey(user.id), dashboardCacheKey(company.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription activation failed:", error);
    return NextResponse.json({ error: "Activation impossible." }, { status: 500 });
  }
}
