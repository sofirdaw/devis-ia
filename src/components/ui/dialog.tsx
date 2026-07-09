/**
 * Composant Dialog — Modale réutilisable
 *
 * Basé sur Radix UI Dialog pour l'accessibilité (focus trap, Escape, aria).
 *
 * Usage :
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent title="Ajouter un client">
 *     <form>...</form>
 *   </DialogContent>
 * </Dialog>
 */

"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg"; // Largeur de la modale
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RadixDialog.Root>
  );
}

export function DialogContent({
  title,
  description,
  children,
  className,
  size = "md",
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      {/* Fond sombre derrière la modale */}
      <RadixDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in" />

      {/* Contenu de la modale */}
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
          "bg-white rounded-xl shadow-xl w-[calc(100vw-2rem)] sm:w-full mx-4",
          "max-h-[85vh] flex flex-col",
          "animate-fade-in",
          SIZES[size],
          className,
        )}
        aria-describedby="dialog-description"
      >
        {/* En-tête */}
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <RadixDialog.Title className="text-base font-semibold text-gray-900">
              {title}
            </RadixDialog.Title>
            {description ? (
              <RadixDialog.Description
                id="dialog-description"
                className="text-sm text-gray-500 mt-0.5"
              >
                {description}
              </RadixDialog.Description>
            ) : (
              <RadixDialog.Description
                id="dialog-description"
                className="sr-only"
              >
                {title}
              </RadixDialog.Description>
            )}
          </div>

          {/* Bouton fermeture */}
          <RadixDialog.Close
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4 mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
            aria-label="Fermer"
          >
            <X size={18} />
          </RadixDialog.Close>
        </div>

        {/* Corps */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
