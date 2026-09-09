/**
 * Composant Header — En-tête de page dans le dashboard
 *
 * Affiche :
 * - Titre et description de la page courante
 * - Actions optionnelles (boutons à droite)
 * - Menu utilisateur Supabase Auth (avatar, profil, sécurité, déconnexion)
 */

"use client";

import { UserMenu } from "./UserMenu";

interface HeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode; // Boutons d'action passés depuis la page
  backButton?: React.ReactNode; // Bouton retour éventuel
}

export function Header({ title, description, actions, backButton }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4 max-lg:pr-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Titre de page avec bouton retour optionnel */}
        <div className="flex items-center gap-3">
          {backButton}
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h1>
            {description && <div className="text-sm text-gray-500 mt-0.5">{description}</div>}
          </div>
        </div>

        {/* Actions + Menu utilisateur */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Boutons d'action passés par la page parente */}
          {actions}

          {/* Menu utilisateur — avatar Supabase avec dropdown profil */}
          <div className="hidden lg:block">
            <UserMenu />
          </div>
        </div>
      </div>

      {/* Menu utilisateur mobile - positionné en haut à droite */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <UserMenu />
      </div>
    </header>
  );
}
