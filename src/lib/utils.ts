/**
 * Utilitaires globaux de l'application
 * - cn() : fusion de classes Tailwind (évite les conflits de classes)
 * - formatCurrency() : formatage des montants en FCFA
 * - formatDate() : formatage des dates en français
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes Tailwind de manière intelligente.
 * Évite les conflits (ex: "p-4 p-6" → garde uniquement "p-6")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un montant en Francs CFA (FCFA)
 * @example formatCurrency(45000) → "45 000 FCFA"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formate un montant en Francs CFA pour le PDF (format spécifique)
 * @example formatCurrencyPDF(45000) → "45 000 FCFA"
 */
export function formatCurrencyPDF(amount: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  // Remplacer les séparateurs par des espaces pour garantir le format
  return `${formatted.replace(/[^\d\s]/g, "").replace(/\s/g, " ")} FCFA`;
}

/**
 * Formate une date ISO en format lisible français
 * @example formatDate("2026-06-15") → "15 juin 2026"
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Génère un numéro de document unique
 * @example generateDocNumber("DEV") → "DEV-2026-001"
 */
export function generateDocNumber(prefix: string, sequence: number): string {
  const year = new Date().getFullYear();
  const paddedSeq = String(sequence).padStart(3, "0");
  return `${prefix}-${year}-${paddedSeq}`;
}

/**
 * Calcule les totaux d'un devis ou d'une facture
 */
export function calculateTotals(
  items: Array<{ quantity: number; unit_price: number }>,
  taxRate: number = 0,
  discountAmount: number = 0
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * (taxRate / 100);
  const total = afterDiscount + tax;

  return { subtotal, tax, total };
}
