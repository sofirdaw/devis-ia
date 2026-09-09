"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { getSiteUrl } from "@/lib/site-url";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(() => {
    const errorParam = searchParams.get("error");
    return errorParam ? decodeURIComponent(errorParam) : "";
  });

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError("");

      const supabase = createClient();
      const siteUrl = getSiteUrl();

      if (window.location.origin !== siteUrl) {
        window.location.replace(`${siteUrl}/login`);
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setGoogleLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue lors de la connexion via Google.");
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await loginAction({}, formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
          IA
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
        <p className="text-sm text-gray-500 mt-1">Connectez-vous à votre compte Devis IA</p>
      </div>

      {/* Bouton Google */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {googleLoading ? (
          "Connexion avec Google..."
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M21.35 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.92-4.18 2.92-7.39Z"
              />
              <path
                fill="#34A853"
                d="M12 21.6c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.93-3.31.93-2.54 0-4.69-1.72-5.46-4.03H3.3v2.51A9.74 9.74 0 0 0 12 21.6Z"
              />
              <path
                fill="#FBBC05"
                d="M6.54 13.71a5.86 5.86 0 0 1 0-3.42V7.78H3.3a9.6 9.6 0 0 0 0 8.44l3.24-2.51Z"
              />
              <path
                fill="#EA4335"
                d="M12 6.26c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.29 14.63 2.4 12 2.4a9.74 9.74 0 0 0-8.7 5.38l3.24 2.51C6.31 7.98 8.46 6.26 12 6.26Z"
              />
            </svg>
            Continuer avec Google
          </>
        )}
      </button>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-400">ou avec email</span>
        </div>
      </div>

      {/* Formulaire Email / Password */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email</label>
          <input
            type="email"
            name="email"
            required
            placeholder="votre@email.com"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase">
              Mot de passe
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary-600 hover:text-primary-500"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            type="password"
            name="password"
            required
            placeholder="••••••••"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-3 px-4 bg-white text-black border border-gray-300 font-medium rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          {loading ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        Vous n&apos;avez pas de compte ?{" "}
        <Link href="/register" className="font-medium text-primary-600 hover:text-primary-500">
          Créer un compte
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-12">
      <Suspense fallback={<div>Chargement...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
