/**
 * Server Actions — Authentification
 *
 * Utilise NextAuth.js avec PostgreSQL direct (sans Supabase Auth)
 * Appelées directement depuis les composants client avec "use server".
 */

"use server";

import { signIn } from "@/lib/auth";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { createClient } from "@/lib/supabase/server";

// Connexion à la base de données PostgreSQL (utilise DIRECT_URL pour éviter IPv6)
const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

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

// Type de retour standard pour les actions
export type ActionResult = {
  error?: string;
  success?: boolean;
};

// ── Action : Connexion ────────────────────────────────────────────────────────

export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // 1. Valider les données du formulaire
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password } = parsed.data;

  // 2. Connexion via Supabase Auth d'abord puis NextAuth.js
  try {
    console.log('Tentative de connexion pour:', email);

    // Connexion Supabase Auth (pose les cookies Supabase)
    const supabase = await createClient();
    const { error: sbError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sbError) {
      console.error('Supabase Auth error:', sbError.message);
      return { error: "Email ou mot de passe incorrect" };
    }

    console.log('Connexion Supabase Auth réussie, connexion NextAuth...');

    // Connexion NextAuth
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });

    return { success: true };
  } catch (error: any) {
    // Si c'est une redirection Next.js (succès de signIn), on DOIT la propager
    unstable_rethrow(error);

    console.error('Login error:', error);

    // Si erreur d'identification
    if (error && (error.type === "CredentialsSignin" || error.code === "credentials" || error.message?.includes("CredentialsSignin"))) {
      return { error: "Email ou mot de passe incorrect" };
    }

    return { error: "Erreur de connexion. Réessayez." };
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
    // 1. Vérifier si l'email existe déjà
    const existingUser = await pool.query(
      "SELECT id FROM auth.users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return { error: "Cet email est déjà utilisé" };
    }

    // 2. Créer l'utilisateur via Supabase Auth
    const supabase = await createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      console.error('Supabase signup error:', signUpError.message);
      return { error: signUpError.message };
    }

    const userId = signUpData.user?.id;
    if (!userId) {
      return { error: "Erreur lors de la création de l'utilisateur" };
    }

    // 3. Confirmer l'email via SQL directement (bypasser l'email rate limit / envoi d'email)
    await pool.query(
      `UPDATE auth.users SET email_confirmed_at = NOW() WHERE id = $1`,
      [userId]
    );

    // 4. Récupérer le password hash généré par Supabase pour s'assurer qu'il est dans companies
    const userRow = await pool.query(
      `SELECT encrypted_password FROM auth.users WHERE id = $1`,
      [userId]
    );
    const passwordHash = userRow.rows[0].encrypted_password;

    // 5. Insérer dans la table companies pour NextAuth
    await pool.query(
      `INSERT INTO companies (user_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)`,
      [userId, fullName, email, passwordHash]
    );

    console.log('Utilisateur créé via Supabase Auth + SQL:', { userId, email, fullName });

    // 6. Redirection vers le setup de l'entreprise après inscription
    redirect("/setup");
  } catch (error) {
    unstable_rethrow(error);
    console.error('Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return { error: `Erreur: ${errorMessage}` };
  }
}

// ── Action : Déconnexion ──────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  // NextAuth gère la déconnexion automatiquement
  redirect("/login");
}
