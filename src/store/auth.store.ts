/**
 * Store Zustand — Authentification
 *
 * Gère l'état global de l'utilisateur connecté et de son entreprise.
 * Utilisé dans toute l'app pour accéder à l'utilisateur sans prop drilling.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { User } from "@supabase/supabase-js";
import type { Company } from "@/types";

type AuthState = {
  user: User | null;
  company: Company | null;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void; // Appelé à la déconnexion
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      company: null,
      isLoading: true,

      setUser: (user) => set({ user }),
      setCompany: (company) => set({ company }),
      setLoading: (isLoading) => set({ isLoading }),

      // Réinitialise tout l'état (utilisé lors du logout)
      reset: () => set({ user: null, company: null, isLoading: false }),
    }),
    {
      name: "devis_ia_auth_storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        company: state.company,
      }),
    }
  )
);
