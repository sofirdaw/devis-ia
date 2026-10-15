import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error || errorDescription) {
    console.error("Erreur OAuth retournée par Supabase:", error, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        errorDescription || error || "Erreur d'authentification OAuth"
      )}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Erreur Supabase exchangeCodeForSession:", exchangeError.message);
    const errorMessage = exchangeError.message.includes("PKCE code verifier not found")
      ? "La tentative de connexion Google a expiré ou le cookie de vérification est indisponible. Relancez la connexion depuis cette page, dans le même navigateur."
      : exchangeError.message;
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMessage)}`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error("Utilisateur absent après le callback OAuth:", userError?.message);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (companyError) {
    console.error("Erreur de vérification de l'entreprise après OAuth:", companyError.message);
    return NextResponse.redirect(`${origin}/setup?error=company_lookup_failed`);
  }
  if (!company) return NextResponse.redirect(`${origin}/setup`);

  const next = searchParams.get("next") ?? "/dashboard";

  return NextResponse.redirect(`${origin}${next}`);
}
