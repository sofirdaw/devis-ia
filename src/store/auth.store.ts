/**
 * Store Zustand — Authentification
 * 
 * Gère l'état global de l'utilisateur connecté et de son entreprise.
 * Utilisé dans toute l'app pour accéder à l'utilisateur sans prop drilling.
 */

import { create } from "zustand";
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setCompany: (company) => set({ company }),
  setLoading: (isLoading) => set({ isLoading }),

  // Réinitialise tout l'état (utilisé lors du logout)
  reset: () => set({ user: null, company: null, isLoading: false }),
}));
