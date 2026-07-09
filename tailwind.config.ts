/**
 * Configuration Tailwind CSS
 * 
 * Design system de l'application :
 * - Couleur principale : Bleu professionnel (#2563EB et variantes)
 * - Police : Inter (lisibilité optimale pour les chiffres et tableaux)
 * - Radius : Coins légèrement arrondis pour un look moderne mais sérieux
 */

import type { Config } from "tailwindcss";

const config: Config = {
  // Activer le mode dark si besoin futur
  darkMode: "class",
  
  // Fichiers à scanner pour purger le CSS inutilisé
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      // ── Couleurs du design system ──────────────────────────────────────────
      colors: {
        // Couleur principale — utilisée pour les boutons CTA, liens actifs
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb", // ← Couleur principale
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        // Couleur de succès — facture payée, devis accepté
        success: {
          50:  "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
        },
        // Couleur d'alerte — facture en retard, action requise
        warning: {
          50:  "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
        },
        // Couleur d'erreur — suppression, refus
        danger: {
          50:  "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
        },
      },

      // ── Polices ────────────────────────────────────────────────────────────
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"], // Pour les numéros de documents
      },

      // ── Animations ─────────────────────────────────────────────────────────
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
    },
  },

  plugins: [],
};

export default config;
