/**
 * Server Actions — Authentification via Supabase Auth
 */

"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// ── Schémas de validation Zod ─────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe trop court (6 caractères min)"),
});

const RegisterSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Mot de passe trop court (6 caractères min)"),
  fullName: z.string().min(2, "Nom trop court"),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

const ResetPasswordSchema = z.object({
  password: z.string().min(6, "Mot de passe trop court (6 caractères min)"),
});

export type ActionResult = {
  error?: string;
  success?: boolean;
};

// ── Action : Connexion ────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Supabase login error:", error.message);
      return { error: "Email ou mot de passe incorrect" };
    }

    redirect("/dashboard");
  } catch (error: unknown) {
    unstable_rethrow(error);
    console.error("Login action error:", error);
    return { error: "Erreur de connexion. Veuillez rééteindre ou réessayer." };
  }
}

// ── Action : Inscription ──────────────────────────────────────────────────────

export async function registerAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password, fullName } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      console.error("Supabase register error:", error.message);
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Erreur lors de la création de l'utilisateur." };
    }

    redirect("/setup");
  } catch (error) {
    unstable_rethrow(error);
    console.error("Registration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return { error: `Erreur: ${errorMessage}` };
  }
}

// ── Action : Demande de réinitialisation de mot de passe ──────────────────────

export async function forgotPasswordAction(
  _prevState: ActionResult,
  formData: FormData,
  origin: string
): Promise<ActionResult> {
  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email } = parsed.data;

  try {
    const supabase = await createClient();
    const redirectTo = `${origin}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("Supabase resetPassword error:", error.message);
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Forgot password action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return { error: `Erreur: ${errorMessage}` };
  }
}

// ── Action : Modification du mot de passe ──────────────────────────────────────

export async function resetPasswordAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { password } = parsed.data;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Supabase updateUser password error:", error.message);
      return { error: error.message };
    }

    redirect("/dashboard");
  } catch (error) {
    unstable_rethrow(error);
    console.error("Reset password action error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return { error: `Erreur: ${errorMessage}` };
  }
}

// ── Action : Déconnexion ──────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
