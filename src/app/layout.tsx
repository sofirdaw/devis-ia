/**
 * Layout racine de l'application Next.js
 * Appliqué à toutes les pages — contient uniquement le <html> et <body>
 */

import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import "./globals.css";

export const metadata: Metadata = {
  title: "DevisIA — Devis & Factures intelligents",
  description:
    "Créez des devis et factures professionnels en quelques secondes grâce à l'IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="fr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
