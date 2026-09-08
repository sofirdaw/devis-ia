"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions/auth";
import { getSiteUrl } from "@/lib/site-url";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const result = await forgotPasswordAction({}, formData, getSiteUrl());

    setLoading(false);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl">
            IA
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h1>
          <p className="text-sm text-gray-500 mt-1">
            Entrez votre adresse email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="p-4 rounded-xl bg-green-50 text-green-700 border border-green-200 text-sm font-medium">
              Un email de réinitialisation a été envoyé si un compte correspond à cette adresse.
              Vérifiez votre boîte de réception.
            </div>
            <Link
              href="/login"
              className="inline-block w-full py-3 px-4 bg-primary-600 text-black font-medium rounded-lg text-sm hover:bg-primary-700 transition-colors shadow-sm text-center"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="votre@email.com"
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
              disabled={loading}
              className="w-full py-3 px-4 bg-primary-600 text-black font-medium rounded-lg text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </button>

            <div className="mt-4 text-center">
              <Link href="/login" className="text-xs font-medium text-gray-500 hover:text-gray-700">
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
