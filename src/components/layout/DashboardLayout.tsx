"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { setUser, setCompany, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    const loadUserAndCompany = async () => {
      setLoading(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setUser(null);
          setCompany(null);
          setLoading(false);
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
          setCompany(null);
        } else {
          setCompany(company ?? null);
        }
      } catch (error) {
        console.error("Erreur chargement utilisateur:", error);
        setUser(null);
        setCompany(null);
      } finally {
        setLoading(false);
      }
    };

    loadUserAndCompany();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        setCompany(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setCompany, setLoading]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden">
      <Sidebar />

      <main className="flex-1 min-w-0 ml-0 lg:ml-60 flex flex-col overflow-x-hidden overflow-y-hidden">
        {children}
      </main>
    </div>
  );
}