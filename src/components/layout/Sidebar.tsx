/**
 * Composant Sidebar — Navigation latérale de l'application
 *
 * Affiche :
 * - Logo de l'app
 * - Menu de navigation principal
 * - Nom de l'entreprise connectée
 * - Bouton de déconnexion
 */

"use client";

import Link from "next/link";
import Image from "next/image";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Receipt,
  Settings,
  LogOut,
  Sparkles,
  DollarSign,
  Factory,
  Menu,
  X,
  CreditCard,
} from "lucide-react";

// Définition des items de navigation
const NAV_ITEMS: {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  highlight?: boolean;
}[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Devis IA",
    href: "/quotes",
    icon: Sparkles,
    /* highlight: true,*/
  },
  {
    label: "Factures",
    href: "/invoices",
    icon: Receipt,
  },
  {
    label: "Créances",
    href: "/receivables",
    icon: DollarSign,
  },
  {
    label: "Clients",
    href: "/clients",
    icon: Users,
  },
  {
    label: "Produits",
    href: "/products",
    icon: Package,
  },
  {
    label: "Fournisseurs",
    href: "/suppliers",
    icon: Factory,
  },
];

const BOTTOM_ITEMS = [
  {
    label: "Abonnement",
    href: "/subscription",
    icon: CreditCard,
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { company, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Déconnexion via Supabase Auth
  const handleLogout = async () => {
    const supabase = createClient();
    const isOffline = typeof window !== "undefined" && !navigator.onLine;

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Déconnexion Supabase non disponible hors ligne:", error);
    }

    logout();

    if (isOffline) {
      router.replace("/login");
      return;
    }

    router.replace("/login");
  };

  // Fermer le menu mobile lors de la navigation
  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(true)}
           className="lg:hidden fixed top-3 right-1 sm:top-4 sm:right-4 z-50 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-gray-900 text-white shadow-lg transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
style={{marginRight: "4rem"}}
        aria-label="Ouvrir le menu"
        aria-expanded={isOpen}
        aria-controls="dashboard-sidebar"
      >
        <Menu size={22} />
      </button>

      {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={cn(
          "fixed left-0 top-0 h-dvh w-[min(15rem,calc(100vw-1rem))] bg-gray-900 flex flex-col shrink-0 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0 z-40" : "-translate-x-full z-40",
          "lg:translate-x-0 lg:z-20"
        )}
      >
        {/* Logo + Close button mobile */}
        <div className="px-4 py-4 border-b border-gray-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 min-w-0"
              onClick={handleLinkClick}
            >
              {company?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logo_url}
                  alt={company.name || "Logo"}
                  className="w-7 h-7 object-contain rounded-lg bg-white p-0.5 shadow-sm shrink-0"
                />
              ) : (
                <Image
                  src="/icons/icon-192x192.png"
                  width={28}
                  height={28}
                  alt="Devis IA"
                  className="rounded-lg shadow-sm shrink-0"
                />
              )}
              <span className="font-semibold text-white text-sm truncate">
                {company?.name ? (
                  company.name
                ) : (
                  <>
                    Devis<span className="text-primary-400">IA</span>
                  </>
                )}
              </span>
            </Link>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-white"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Badge réseau PWA */}
          <div className="mt-1">
            <OfflineIndicator />
          </div>
        </div>

        {/* Navigation principale */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            // Un item est actif si le pathname commence par son href
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-600 text-white"
                    : item.highlight
                      ? "text-primary-400 hover:bg-gray-800 hover:text-primary-300"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon size={18} />
                {item.label}
                {/* Badge "IA" pour les features IA */}
                {item.highlight && !isActive && (
                  <span className="ml-auto text-[10px] bg-primary-600/30 text-primary-400 px-1.5 py-0.5 rounded-full">
                    IA
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Section bas — Entreprise + Settings + Logout */}
        <div className="border-t border-gray-800 px-3 py-3 space-y-1">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {/* Bouton déconnexion */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
