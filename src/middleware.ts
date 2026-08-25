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

  // ── Intercepter le callback OAuth Supabase arrivant sur n'importe quelle URL ──
  const code = request.nextUrl.searchParams.get("code");
  if (code && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return NextResponse.redirect(callbackUrl);
  }

  // Authentification gérée côté client/localStorage pour le mode PWA hors-ligne.
  // Les redirections serveur agressives provoquent des rechargements, des boucles de connexion
  // et empêchent l'utilisation locale des données quand l'utilisateur est déconnecté ou hors ligne.
  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|manifest\\.json|offline\\.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$).*)",
  ],
};
