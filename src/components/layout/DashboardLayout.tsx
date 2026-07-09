/**
 * Composant DashboardLayout — Layout principal des pages protégées
 *
 * Structure :
 * ┌──────────┬──────────────────────────────┐
 * │ Sidebar  │ Header                       │
 * │  (240px) ├──────────────────────────────┤
 * │          │ <children> (contenu de page) │
 * └──────────┴──────────────────────────────┘
 *
 * Utilise Clerk (useUser) pour récupérer l'utilisateur connecté,
 * puis charge l'entreprise depuis Supabase via son Clerk user ID.
 */

"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuthStore } from "@/store/auth.store";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user: clerkUser, isLoaded } = useUser();
  const { setUser, setCompany, setLoading } = useAuthStore();

  // Charger les données entreprise depuis Supabase une fois Clerk prêt
  useEffect(() => {
    if (!isLoaded) return;

    const loadCompany = async () => {
      setLoading(true);

      if (!clerkUser) {
        setUser(null);
        setCompany(null);
        setLoading(false);
        return;
      }

      // Clerk fournit l'user — on met un objet compatible dans le store
      // (Le store attend un User Supabase, on adapte avec les infos Clerk)
      setUser({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
        user_metadata: {
          full_name: clerkUser.fullName ?? clerkUser.username ?? "",
          avatar_url: clerkUser.imageUrl,
        },
        app_metadata: {},
        aud: "authenticated",
        created_at: clerkUser.createdAt?.toISOString() ?? "",
      } as any);

      // Charger l'entreprise liée à cet utilisateur depuis Supabase
      try {
        const supabase = createClient();
        const { data: company } = await supabase
          .from("companies")
          .select("*")
          .eq("user_id", clerkUser.id)
          .maybeSingle();

        setCompany(company ?? null);
      } catch (err) {
        console.error("Erreur chargement entreprise:", err);
        setCompany(null);
      }

      setLoading(false);
    };

    loadCompany();
  }, [isLoaded, clerkUser, setUser, setCompany, setLoading]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      {/* Navigation latérale fixe */}
      <Sidebar />

      {/* Zone de contenu principale (décalée de 240px à gauche sur desktop) */}
      <main className="flex-1 min-w-0 ml-0 lg:ml-60 flex flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </main>
    </div>
  );
}
