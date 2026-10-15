import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { requestId, transactionReference } = (await request.json()) as {
      requestId?: string;
      transactionReference?: string;
    };
    const reference = transactionReference?.trim();
    if (!requestId || !reference || reference.length < 4 || reference.length > 80) {
      return NextResponse.json(
        { error: "Saisissez une référence de transaction valide (4 à 80 caractères)." },
        { status: 400 }
      );
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

    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .select("id, status, payment_request_expires_at, user_confirmed_at, activated_at")
      .eq("id", requestId)
      .eq("company_id", company.id)
      .maybeSingle();
    if (error || !payment)
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    if (payment.activated_at)
      return NextResponse.json({ error: "Cette demande a déjà été activée." }, { status: 409 });
    if (
      payment.payment_request_expires_at &&
      new Date(payment.payment_request_expires_at) <= new Date()
    ) {
      return NextResponse.json({ error: "Cette demande de paiement a expiré." }, { status: 410 });
    }
    if (payment.status !== "pending")
      return NextResponse.json(
        { error: "Cette demande ne peut plus être confirmée." },
        { status: 409 }
      );
    if (payment.user_confirmed_at) {
      const { data: confirmedPayment, error: referenceError } = await supabase
        .from("subscription_payments")
        .select("orange_transaction_id")
        .eq("id", requestId)
        .eq("company_id", company.id)
        .maybeSingle();
      if (referenceError) {
        return NextResponse.json(
          { error: "Impossible de vérifier la référence." },
          { status: 500 }
        );
      }
      if (confirmedPayment?.orange_transaction_id !== reference) {
        return NextResponse.json(
          { error: "Cette demande a déjà été envoyée avec une autre référence." },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    }

    const { data: updatedPayment, error: updateError } = await supabase
      .from("subscription_payments")
      .update({
        orange_transaction_id: reference,
        user_confirmed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("company_id", company.id)
      .is("user_confirmed_at", null)
      .select("orange_transaction_id")
      .maybeSingle();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    if (!updatedPayment) {
      const { data: currentPayment, error: currentPaymentError } = await supabase
        .from("subscription_payments")
        .select("orange_transaction_id")
        .eq("id", requestId)
        .eq("company_id", company.id)
        .maybeSingle();
      if (currentPaymentError) {
        return NextResponse.json({ error: "Impossible de vérifier la demande." }, { status: 500 });
      }
      if (currentPayment?.orange_transaction_id !== reference) {
        return NextResponse.json(
          { error: "Cette demande a déjà été envoyée avec une autre référence." },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Payment confirmation failed:", error);
    return NextResponse.json({ error: "Impossible de confirmer le paiement." }, { status: 500 });
  }
}
