"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useEffect(() => {
    const supabase = createClient();

    const loadUserAndCompany = async () => {
      // Si l'appareil est hors-ligne, conserver la session locale déjà hydratée depuis localStorage
      if (typeof window !== "undefined" && !navigator.onLine) {
        useAuthStore.getState().setLoading(false);
        return;
      }

      const { setUser, setCompany, setLoading } = useAuthStore.getState();
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          // Ne réinitialiser QUE si l'erreur n'est pas un problème de connectivité réseau
          if (navigator.onLine && !useAuthStore.getState().user) {
            useAuthStore.getState().setUser(null);
            useAuthStore.getState().setCompany(null);
          }
          useAuthStore.getState().setLoading(false);
          return;
        }

        setUser(user);

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (companyError) {
          console.error("Erreur chargement entreprise:", companyError.message);
        } else if (company) {
          setCompany(company);
        }
      } catch (error) {
        console.warn(
          "Réseau indisponible pour vérifier l'utilisateur, utilisation du cache local:",
          error
        );
        // Conserver les données locales en cas d'erreur de connexion
      } finally {
        useAuthStore.getState().setLoading(false);
      }
    };

    loadUserAndCompany();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        useAuthStore.getState().setUser(session.user);
      } else {
        useAuthStore.getState().setUser(null);
        useAuthStore.getState().setCompany(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Exécuté une seule fois au montage

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />

      <main className="flex-1 min-w-0 ml-0 lg:ml-60 flex flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </main>
    </div>
  );
}
