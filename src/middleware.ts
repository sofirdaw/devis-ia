import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Ignorer les fichiers PWA, assets statiques et manifests
  if (
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/offline.html" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  // ── Intercepter le callback OAuth Supabase arrivant sur n'importe quelle URL ──
  const code = request.nextUrl.searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  const restrictedPaths = [
    "/quotes",
    "/clients",
    "/invoices",
    "/products",
    "/receivables",
    "/suppliers",
    "/settings",
    "/settings/",
  ];
  const isRestrictedRoute = restrictedPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // The entitlement check is only relevant to these pages. Avoid a remote
  // Supabase auth + database round-trip on public pages, dashboard and billing.
  if (!isRestrictedRoute) return NextResponse.next();

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Récupérer la session locale via cookie (lisible sans connexion Internet)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let user = session?.user ?? null;

  // Si une session locale existe, tenter la vérification auprès de Supabase
  if (session) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn("Impossible de vérifier la session pour les droits d'abonnement:", error);
        return supabaseResponse;
      }
      if (data?.user) {
        user = data.user;
      } else {
        return supabaseResponse;
      }
    } catch {
      // A network failure is not evidence that an offline subscription is invalid.
      return supabaseResponse;
    }
  }

  // --- Vérifier l'abonnement de l'entreprise associée à l'utilisateur ---
  let subscriptionValid = false;
  let subscriptionStatusKnown = false;
  try {
    if (user) {
      const { data: companies, error } = await supabase
        .from("companies")
        .select(
          "id, subscription_plan, subscription_status, subscription_expires_at, trial_ends_at"
        )
        .eq("user_id", user.id)
        .limit(1);

      if (error) {
        console.warn("Impossible de vérifier l'abonnement côté serveur:", error);
      } else {
        subscriptionStatusKnown = true;
      }
      const company = Array.isArray(companies) ? companies[0] : companies;
      if (company && company.subscription_status !== "suspended") {
        const now = new Date();
        if (
          company.subscription_status === "active" &&
          company.subscription_expires_at &&
          new Date(company.subscription_expires_at) > now
        ) {
          subscriptionValid = true;
        }
        if (
          !subscriptionValid &&
          company.subscription_status === "trial" &&
          company.trial_ends_at &&
          new Date(company.trial_ends_at) > now
        ) {
          subscriptionValid = true;
        }
      }
    }
  } catch (err) {
    // A network/database failure is not evidence of a valid subscription.
    console.warn("Impossible de vérifier l'abonnement côté serveur:", err);
  }

  // Fail open only when Supabase could not provide an authoritative answer;
  // individual data actions still enforce authentication and database RLS.
  if (user && subscriptionStatusKnown && !subscriptionValid) {
    // rediriger vers le tableau de bord avec indication d'abonnement requis
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("needsSubscription", "1");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|manifest\\.json|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$).*)",
  ],
};
