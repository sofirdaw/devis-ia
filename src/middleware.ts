import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
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
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        user = data.user;
      }
    } catch {
      // En mode hors-ligne, conserver la session locale valide
    }
  }

  const pathname = request.nextUrl.pathname;

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

  const isProtectedPath =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/quotes") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/receivables") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/suppliers") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/setup");

  // ── Intercepter le callback OAuth Supabase arrivant sur n'importe quelle URL ──
  // Supabase redirige parfois vers `/?code=...` au lieu de `/auth/callback?code=...`
  // On renvoie systématiquement le code vers la bonne route de callback.
  const code = request.nextUrl.searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  // Si non connecté et essaie d'accéder à une page protégée -> Redirection vers /login
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Si connecté et essaie d'accéder à une page d'auth -> Redirection vers /dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
