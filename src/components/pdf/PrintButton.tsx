/**
 * PrintButton — Bouton pour lancer l'impression directe d'une zone avec id="print-area"
 */

"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PrintButtonProps {
  className?: string;
  variant?: "primary" | "outline" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function PrintButton({ className, variant = "outline", size = "sm" }: PrintButtonProps) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
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
