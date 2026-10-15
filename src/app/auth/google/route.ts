import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = getSiteUrl(requestUrl.origin);

  if (requestUrl.origin !== siteUrl) {
    return NextResponse.redirect(new URL("/auth/google", siteUrl));
  }

  try {
    const cookieStore = await cookies();
    const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet);
          },
        },
      }
    );
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

    const redirectWithCookies = (url: URL) => {
      const response = NextResponse.redirect(url);
      for (const cookie of pendingCookies) {
        response.cookies.set(cookie.name, cookie.value, cookie.options);
      }
      return response;
    };

    if (error || !data.url) {
      console.error("Impossible de démarrer l'authentification Google:", error?.message);
      return redirectWithCookies(
        new URL(
          `/login?error=${encodeURIComponent("Impossible de démarrer la connexion Google.")}`,
          siteUrl
        )
      );
    }

    return redirectWithCookies(new URL(data.url));
  } catch (error) {
    console.error("Erreur au démarrage OAuth Google:", error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Impossible de démarrer la connexion Google.")}`,
        siteUrl
      )
    );
  }
}
