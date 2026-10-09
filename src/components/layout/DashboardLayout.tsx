"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";
import { hasOfflineSubscriptionAccess } from "@/lib/offline-pwa";
import { OfflineSnapshotSync } from "@/components/pwa/OfflineSnapshotSync";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [offlineAccessAllowed, setOfflineAccessAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const checkOfflineAccess = () => {
      if (navigator.onLine) {
        setOfflineAccessAllowed(null);
        return;
      }

      const { user, company } = useAuthStore.getState();
      setOfflineAccessAllowed(
        Boolean(
          user &&
          company &&
          hasOfflineSubscriptionAccess({
            status: company.subscription_status,
            expiresAt: company.subscription_expires_at,
            trialEndsAt: company.trial_ends_at,
          })
        )
      );
    };

    const loadUserAndCompany = async () => {
      // Si l'appareil est hors-ligne, conserver la session locale déjà hydratée depuis localStorage
      if (typeof window !== "undefined" && !navigator.onLine) {
        useAuthStore.getState().setLoading(false);
        checkOfflineAccess();
        return;
      }

      setOfflineAccessAllowed(null);
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
    window.addEventListener("offline", checkOfflineAccess);
    window.addEventListener("online", checkOfflineAccess);

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
      window.removeEventListener("offline", checkOfflineAccess);
      window.removeEventListener("online", checkOfflineAccess);
    };
  }, []); // Exécuté une seule fois au montage

  if (offlineAccessAllowed === false) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Accès hors ligne indisponible</h1>
          <p className="mt-2 text-sm text-gray-600">
            Connectez-vous à Internet pour vérifier votre compte et renouveler ou activer votre
            abonnement.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            L&apos;abonnement enregistré sur cet appareil est expiré ou suspendu
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh bg-gray-50 overflow-x-hidden">
      <OfflineSnapshotSync />
      <Sidebar />

      <main className="flex-1 min-w-0 ml-0 lg:ml-60 flex flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </main>
    </div>
  );
}
