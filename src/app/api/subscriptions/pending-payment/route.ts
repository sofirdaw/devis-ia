import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
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
    if (!company) return NextResponse.json({ payment: null });

    const { data: payment, error } = await supabase
      .from("subscription_payments")
      .select("id, plan, status, user_confirmed_at, activated_at, payment_request_expires_at")
      .eq("company_id", company.id)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ payment });
  } catch (error) {
    console.error("Pending payment lookup failed:", error);
    return NextResponse.json({ error: "Impossible de récupérer la demande." }, { status: 500 });
  }
}
