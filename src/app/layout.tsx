/**
 * Layout racine de l'application Next.js avec support PWA complet
 */

import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "Devis IA — Devis & Factures Intelligents 100% Hors-Ligne",
  description:
    "Créez des devis et factures professionnels en quelques secondes avec ou sans connexion Internet.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Devis IA",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="antialiased selection:bg-primary-500 selection:text-white">
        <RegisterSW />
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
