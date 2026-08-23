/**
 * PrintButton — Bouton pour imprimer le PDF professionnel du document.
 *
 * Quand pdfUrl est fourni, ouvre le PDF dans un nouvel onglet pour que
 * le navigateur propose son dialogue d'impression natif sur le PDF généré
 * (même résultat que le bouton "PDF").
 */

"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintButtonProps {
  /** URL du PDF à ouvrir/imprimer (ex: /api/pdf/quote/[id]) */
  pdfUrl?: string;
  className?: string;
  variant?: "primary" | "outline" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function PrintButton({
  pdfUrl,
  className,
  variant = "outline",
  size = "sm",
}: PrintButtonProps) {
  const handlePrint = () => {
    if (typeof window === "undefined") return;

    if (pdfUrl) {
      // Ouvre le PDF avec cache-buster pour garantir un rendu à jour
      const separator = pdfUrl.includes("?") ? "&" : "?";
      window.open(`${pdfUrl}${separator}t=${Date.now()}`, "_blank");
    } else {
      // Fallback : impression de la page courante
      window.print();
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      leftIcon={<Printer size={14} />}
      onClick={handlePrint}
      className={className}
    >
      Imprimer
    </Button>
  );
}
