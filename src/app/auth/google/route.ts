import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = getSiteUrl(requestUrl.origin);

  if (requestUrl.origin !== siteUrl) {
    return NextResponse.redirect(new URL("/auth/google", siteUrl));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error || !data.url) {
      console.error("Impossible de démarrer l'authentification Google:", error?.message);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("Impossible de démarrer la connexion Google.")}`,
          siteUrl
        )
      );
    }

    return NextResponse.redirect(data.url);
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
