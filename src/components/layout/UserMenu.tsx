/**
 * Composant UserMenu — Menu déroulant utilisateur avec Supabase Auth
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Loader2,
} from "lucide-react";
import Image from "next/image";

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps = {}) {
  const { user, company, reset, isLoading } = useAuthStore();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu en cliquant en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    reset();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleOpenSettings = () => {
    setOpen(false);
    router.push("/settings");
  };

  // Infomations utilisateur Supabase
  const email = user?.email ?? "";
  const fullName =
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    company?.name ||
    email.split("@")[0] ||
    "Utilisateur";

  const avatarUrl =
    (user?.user_metadata?.avatar_url as string) ||
    (user?.user_metadata?.picture as string) ||
    null;

  const initials = fullName.slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
        <Loader2 size={14} className="text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      {/* Bouton déclencheur */}
      <button
        id="user-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors group"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-primary-200 group-hover:ring-primary-400 transition-all">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={fullName}
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Nom affiché */}
        <span className="hidden sm:block text-sm font-semibold text-gray-900 max-w-[140px] truncate">
          {fullName}
        </span>

        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""
            }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          role="menu"
        >
          {/* En-tête profil */}
          <div className="px-4 py-3 bg-gradient-to-br from-primary-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-primary-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={fullName}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {fullName}
                </p>
                <p className="text-xs text-gray-500 truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              id="user-menu-profile"
              onClick={handleOpenSettings}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <User size={14} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Mon profil & Paramètres</p>
                <p className="text-xs text-gray-400">Entreprise, devises, logo…</p>
              </div>
            </button>
          </div>

          {/* Séparateur + Déconnexion */}
          <div className="border-t border-gray-100 py-1">
            <button
              id="user-menu-logout"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              role="menuitem"
            >
              <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={14} className="text-red-500" />
              </div>
              <p className="font-medium">Déconnexion</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
