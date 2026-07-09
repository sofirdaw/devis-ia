/**
 * Composant UserMenu — Menu déroulant utilisateur
 *
 * Affiche l'avatar de l'utilisateur connecté (initiales ou photo de profil Clerk)
 * avec un dropdown permettant :
 * - Voir le profil (nom, email)
 * - Ouvrir le modal Clerk pour modifier le profil / changer le mot de passe
 * - Se déconnecter
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User,
  KeyRound,
  LogOut,
  ChevronDown,
  Settings2,
  Loader2,
} from "lucide-react";
import Image from "next/image";

interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps = {}) {
  const { user, isLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
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
    await signOut();
    router.push("/sign-in");
  };

  const handleOpenProfile = (initialPage?: "profile" | "security") => {
    setOpen(false);
    // Clerk UserProfile modal — ouvre directement sur la bonne section
    openUserProfile(
      initialPage === "security" ? { additionalOAuthScopes: {} } : undefined,
    );
  };

  // Avatar : photo Clerk ou initiales
  const avatarUrl = user?.imageUrl;
  const displayName =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Utilisateur";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  if (!isLoaded) {
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
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-gray-100 transition-colors group"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-600 flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-primary-200 group-hover:ring-primary-400 transition-all">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Nom affiché (masqué sur petits écrans) */}
        <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
          {displayName}
        </span>

        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
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
                    alt={displayName}
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
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 truncate">{email}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <button
              id="user-menu-profile"
              onClick={() => handleOpenProfile("profile")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <User size={14} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Mon profil</p>
                <p className="text-xs text-gray-400">Nom, prénom, photo…</p>
              </div>
            </button>

            <button
              id="user-menu-security"
              onClick={() => handleOpenProfile("security")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              role="menuitem"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <KeyRound size={14} className="text-amber-600" />
              </div>
              <div className="text-left">
                <p className="font-medium">Sécurité</p>
                <p className="text-xs text-gray-400">Mot de passe, 2FA…</p>
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
