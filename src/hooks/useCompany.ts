/**
 * Hook — Récupère et met en cache les infos de l'entreprise connectée
 * 
 * Utilise le store Zustand pour éviter de refaire la requête Supabase
 * à chaque rendu. Charge automatiquement l'entreprise au premier appel.
 * 
 * Usage :
 *   const { company, isLoading } = useCompany();
 */

"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth.store";

export function useCompany() {
  const { company, setCompany, user } = useAuthStore();

  useEffect(() => {
    // Ne charger que si l'utilisateur est connecté et que l'entreprise n'est pas déjà chargée
    if (!user || company) return;

    const fetchCompany = async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Erreur chargement entreprise:", error.message);
        return;
      }

      setCompany(data);
    };

    fetchCompany();
  }, [user, company, setCompany]);

  return { company };
}
