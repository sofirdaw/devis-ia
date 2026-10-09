import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/admin-access";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";

export const runtime = "nodejs";

type ManualPaymentApproval = {
  approved_company_id: string;
  approved_user_id: string;
  subscription_expires_at: string | null;
  already_activated: boolean;
};

function isManualPaymentApproval(value: unknown): value is ManualPaymentApproval {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.approved_company_id === "string" &&
    typeof result.approved_user_id === "string" &&
    (typeof result.subscription_expires_at === "string" ||
      result.subscription_expires_at === null) &&
    typeof result.already_activated === "boolean"
  );
}

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
  const { data: approval, error } = await supabase
    .rpc("approve_manual_subscription_payment", { p_payment_id: requestId })
    .single();

  if (error || !isManualPaymentApproval(approval)) {
    const status = error?.code === "P0002" ? 404 : error?.code === "P0001" ? 409 : 500;
    const message =
      error?.message === "Cette demande a expiré."
        ? error.message
        : error?.message || "Activation impossible.";
    return NextResponse.json({ error: message }, { status });
  }

  if (!approval.already_activated) {
    await invalidateCache(
      companyCacheKey(approval.approved_user_id),
      dashboardCacheKey(approval.approved_company_id)
    );
  }

  return NextResponse.json({
    success: true,
    alreadyActivated: approval.already_activated,
    expiresAt: approval.subscription_expires_at,
  });
}
