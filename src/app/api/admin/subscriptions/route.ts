import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/admin-access";
import { companyCacheKey, dashboardCacheKey, invalidateCache } from "@/lib/cache";
import { PLANS, type PlanId } from "@/lib/subscription";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const supabase = createAdminClient();
  const companyId = new URL(request.url).searchParams.get("companyId");
  if (companyId) {
    const result = await getCompanyDetail(companyId, supabase);
    if ("error" in result) {
      const status = result.error === "Entreprise introuvable." ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await supabase
    .from("client_issue_events")
    .delete()
    .lt("created_at", cutoff);
  if (cleanupError && cleanupError.code !== "42P01") {
    console.error("Impossible de purger les anciens événements clients:", cleanupError.message);
  }

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, user_id, name, phone, email, address, created_at, subscription_plan, subscription_status, subscription_started_at, subscription_expires_at, trial_started_at, trial_ends_at"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: data || [] });
}

export async function PATCH(request: Request) {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const body = (await request.json()) as {
    companyId?: string;
    name?: string;
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    status?: "active" | "suspended";
    action?: "cancel_subscription";
    grantPlan?: string;
  };
  if (typeof body.companyId !== "string" || !body.companyId)
    return NextResponse.json({ error: "Entreprise manquante." }, { status: 400 });
  if (
    (body.name !== undefined && typeof body.name !== "string") ||
    (body.fullName !== undefined && typeof body.fullName !== "string") ||
    (body.email !== undefined && body.email !== null && typeof body.email !== "string") ||
    (body.phone !== undefined && body.phone !== null && typeof body.phone !== "string") ||
    (body.status !== undefined && body.status !== "active" && body.status !== "suspended") ||
    (body.action !== undefined && body.action !== "cancel_subscription") ||
    (body.grantPlan !== undefined && typeof body.grantPlan !== "string")
  ) {
    return NextResponse.json({ error: "Informations de modification invalides." }, { status: 400 });
  }
  const hasProfileUpdate =
    body.name !== undefined ||
    body.fullName !== undefined ||
    body.email !== undefined ||
    body.phone !== undefined;
  if (
    (hasProfileUpdate && (body.status !== undefined || body.action || body.grantPlan)) ||
    (body.grantPlan !== undefined && (body.status !== undefined || body.action || hasProfileUpdate))
  ) {
    return NextResponse.json(
      { error: "Une seule opération est autorisée à la fois." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, user_id, trial_ends_at, subscription_expires_at")
    .eq("id", body.companyId)
    .single();
  if (companyError || !company)
    return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  if (body.grantPlan !== undefined) {
    if (!Object.hasOwn(PLANS, body.grantPlan)) {
      return NextResponse.json({ error: "Forfait invalide." }, { status: 400 });
    }
    const plan = body.grantPlan as PlanId;
    const now = new Date();
    const paidExpiry = company.subscription_expires_at
      ? new Date(company.subscription_expires_at)
      : now;
    const trialExpiry = company.trial_ends_at ? new Date(company.trial_ends_at) : now;
    const startsAt = new Date(Math.max(now.getTime(), paidExpiry.getTime(), trialExpiry.getTime()));
    const expiresAt = new Date(startsAt);
    expiresAt.setMonth(expiresAt.getMonth() + PLANS[plan].months);
    const { error } = await supabase
      .from("companies")
      .update({
        subscription_plan: plan,
        subscription_status: "active",
        subscription_started_at: startsAt.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq("id", body.companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await invalidateCache(companyCacheKey(company.user_id), dashboardCacheKey(company.id));
    return NextResponse.json({ success: true, expiresAt: expiresAt.toISOString() });
  }

  const profileUpdate: Record<string, string | null> = {};
  let fullName: string | null = null;
  if (body.fullName !== undefined) {
    fullName = body.fullName.trim();
    if (!fullName || fullName.length > 120) {
      return NextResponse.json(
        { error: "Le nom complet doit contenir entre 1 et 120 caractères." },
        { status: 400 }
      );
    }
  }
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 120) {
      return NextResponse.json(
        { error: "Le nom doit contenir entre 1 et 120 caractères." },
        { status: 400 }
      );
    }
    profileUpdate.name = name;
  }
  if (body.email !== undefined) {
    const email = body.email?.trim() || null;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }
    profileUpdate.email = email;
  }
  if (body.phone !== undefined) {
    const phone = body.phone?.trim() || null;
    if (phone && phone.length > 40) {
      return NextResponse.json({ error: "Le numéro de téléphone est trop long." }, { status: 400 });
    }
    profileUpdate.phone = phone;
  }
  if (fullName !== null) {
    const { data: authResult, error: authError } = await supabase.auth.admin.getUserById(
      company.user_id
    );
    if (authError || !authResult.user) {
      return NextResponse.json({ error: "Compte de connexion introuvable." }, { status: 404 });
    }
    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(company.user_id, {
      user_metadata: { ...authResult.user.user_metadata, full_name: fullName },
    });
    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
    }
  }
  if (Object.keys(profileUpdate).length) {
    const { error } = await supabase
      .from("companies")
      .update(profileUpdate)
      .eq("id", body.companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await invalidateCache(companyCacheKey(company.user_id), dashboardCacheKey(company.id));
    return NextResponse.json({ success: true });
  }
  if (body.fullName !== undefined) return NextResponse.json({ success: true });

  if (!body.status) return NextResponse.json({ error: "Statut manquant." }, { status: 400 });

  if (body.action === "cancel_subscription") {
    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("id, amount, currency")
      .eq("company_id", body.companyId)
      .eq("status", "paid")
      .not("activated_at", "is", null)
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (payment) {
      const { error: paymentError } = await supabase
        .from("subscription_payments")
        .update({ status: "cancelled", refund_status: "pending" })
        .eq("id", payment.id)
        .eq("status", "paid");
      if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 });
    }

    const trialIsValid = company.trial_ends_at && new Date(company.trial_ends_at) > new Date();
    const { error: cancelError } = await supabase
      .from("companies")
      .update({
        subscription_plan: null,
        subscription_status: trialIsValid ? "trial" : "expired",
        subscription_started_at: null,
        subscription_expires_at: null,
      })
      .eq("id", body.companyId);
    if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 });

    await invalidateCache(companyCacheKey(company.user_id), dashboardCacheKey(company.id));
    return NextResponse.json({ success: true, refundStatus: payment ? "pending" : null });
  }

  const { error } = await supabase
    .from("companies")
    .update({ subscription_status: body.status })
    .eq("id", body.companyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateCache(companyCacheKey(company.user_id), dashboardCacheKey(company.id));
  return NextResponse.json({ success: true });
}

export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });

  const body = (await request.json()) as {
    name?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
  const name = body.name?.trim();
  const fullName = body.fullName?.trim();
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim() || null;
  if (!name || name.length > 120 || !fullName || fullName.length > 120) {
    return NextResponse.json(
      { error: "Le nom de l’entreprise et le nom du responsable sont requis." },
      { status: 400 }
    );
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }
  if (phone && phone.length > 40) {
    return NextResponse.json({ error: "Le numéro de téléphone est trop long." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const origin = new URL(request.url).origin;
  const siteUrl = getSiteUrl(origin);
  const { data: invitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name: fullName },
      redirectTo: `${siteUrl}/auth/callback?next=/setup`,
    }
  );
  if (inviteError || !invitation.user) {
    return NextResponse.json(
      { error: inviteError?.message || "Invitation du compte impossible." },
      { status: 500 }
    );
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ user_id: invitation.user.id, name, email, phone })
    .select("id, user_id, name, email, phone, created_at")
    .single();
  if (companyError) {
    console.error("Invitation envoyée mais création entreprise échouée:", companyError.message);
    return NextResponse.json(
      {
        error:
          "Invitation envoyée, mais création de l’entreprise impossible. Vérifiez le dossier avant de réessayer.",
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ company }, { status: 201 });
}

async function getCompanyDetail(companyId: string, supabase: ReturnType<typeof createAdminClient>) {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, user_id, name, phone, email, address, created_at, subscription_plan, subscription_status, subscription_started_at, subscription_expires_at, trial_started_at, trial_ends_at"
    )
    .eq("id", companyId)
    .maybeSingle();
  if (companyError || !company) return { error: "Entreprise introuvable." };

  const [
    authResult,
    clientCount,
    productCount,
    quoteCount,
    invoiceCount,
    receivableCount,
    paymentCount,
    paidPayments,
    paidAmounts,
    activationCount,
    sessionCount,
    pageViewCount,
    issueEvents,
  ] = await Promise.all([
    supabase.auth.admin.getUserById(company.user_id),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("receivables")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("subscription_payments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("subscription_payments")
      .select(
        "id, plan, amount, currency, status, order_id, orange_transaction_id, created_at, paid_at, activated_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("subscription_payments")
      .select("amount")
      .eq("company_id", companyId)
      .eq("status", "paid"),
    supabase
      .from("subscription_activations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId),
    supabase
      .from("client_issue_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("event_type", "session_started")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("client_issue_events")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("event_type", "page_view")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("client_issue_events")
      .select("id, event_type, error_code, route, created_at")
      .eq("company_id", companyId)
      .in("event_type", [
        "runtime_error",
        "unhandled_rejection",
        "connection_lost",
        "connection_restored",
        "ai_generation_failed",
      ])
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (authResult.error) {
    console.error("Impossible de lire le compte d'authentification:", authResult.error.message);
    return { error: "Impossible de charger les informations du compte." };
  }

  const queryError =
    clientCount.error ??
    productCount.error ??
    quoteCount.error ??
    invoiceCount.error ??
    receivableCount.error ??
    paymentCount.error ??
    paidPayments.error ??
    paidAmounts.error ??
    activationCount.error ??
    sessionCount.error ??
    pageViewCount.error ??
    issueEvents.error;
  if (queryError) return { error: queryError.message };

  const authUser = authResult.data.user;
  return {
    company,
    account: authUser
      ? {
          id: authUser.id,
          email: authUser.email ?? null,
          fullName:
            (typeof authUser.user_metadata?.full_name === "string" &&
              authUser.user_metadata.full_name) ||
            (typeof authUser.user_metadata?.name === "string" && authUser.user_metadata.name) ||
            null,
          lastSignInAt: authUser.last_sign_in_at ?? null,
          emailConfirmedAt: authUser.email_confirmed_at ?? null,
          createdAt: authUser.created_at,
          disabled: Boolean(authUser.banned_until && new Date(authUser.banned_until) > new Date()),
        }
      : null,
    usage: {
      clients: clientCount.count ?? 0,
      products: productCount.count ?? 0,
      quotes: quoteCount.count ?? 0,
      invoices: invoiceCount.count ?? 0,
      receivables: receivableCount.count ?? 0,
      paymentRequests: paymentCount.count ?? 0,
      activatedSubscriptions: activationCount.count ?? 0,
      paidTotal: (paidAmounts.data ?? []).reduce((sum, payment) => sum + payment.amount, 0),
      sessions90Days: sessionCount.count ?? 0,
      pageViews90Days: pageViewCount.count ?? 0,
    },
    payments: paidPayments.data ?? [],
    issues: issueEvents.data ?? [],
  };
}

export async function DELETE(request: Request) {
  if (!(await isCurrentUserAdmin()))
    return NextResponse.json({ error: "Accès interdit." }, { status: 403 });
  const body = (await request.json()) as { companyId?: string; confirmName?: string };
  if (!body.companyId || !body.confirmName) {
    return NextResponse.json({ error: "Confirmation de suppression manquante." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, user_id, name")
    .eq("id", body.companyId)
    .maybeSingle();
  if (companyError || !company) {
    return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  }
  if (body.confirmName !== company.name) {
    return NextResponse.json(
      { error: "Le nom de confirmation ne correspond pas." },
      { status: 400 }
    );
  }

  const { error: purgeError } = await supabase.rpc("admin_purge_company_data", {
    p_company_id: company.id,
  });
  if (purgeError) {
    console.error("Le nettoyage des données de l'entreprise a échoué:", purgeError.message);
    return NextResponse.json(
      { error: "Le nettoyage des données a échoué. Le compte de connexion est toujours actif." },
      { status: 500 }
    );
  }
  const { error: authError } = await supabase.auth.admin.deleteUser(company.user_id);
  if (authError && !authError.message.toLowerCase().includes("user not found")) {
    console.error("Données supprimées mais suppression du compte impossible:", authError.message);
    return NextResponse.json(
      {
        error:
          "Les données de l’entreprise ont été supprimées, mais le compte de connexion reste actif. Contactez l’assistance technique.",
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true });
}
