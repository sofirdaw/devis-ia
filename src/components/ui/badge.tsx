/**
 * Composant Badge — Indicateur de statut
 * 
 * Utilisé pour afficher le statut des devis et factures.
 * 
 * Variantes :
 * - draft    : brouillon (gris)
 * - sent     : envoyé (bleu)
 * - accepted : accepté (vert)
 * - refused  : refusé (rouge)
 * - paid     : payé (vert)
 * - overdue  : en retard (orange)
 */

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "draft"
  | "sent"
  | "accepted"
  | "refused"
  | "paid"
  | "overdue"
  | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default:   "bg-gray-100 text-gray-700",
  draft:     "bg-gray-100 text-gray-600",
  sent:      "bg-blue-100 text-blue-700",
  accepted:  "bg-green-100 text-green-700",
  refused:   "bg-red-100 text-red-700",
  paid:      "bg-green-100 text-green-700",
  overdue:   "bg-orange-100 text-orange-700",
};

// Labels français pour chaque statut
export const STATUS_LABELS: Record<string, string> = {
  draft:    "Brouillon",
  sent:     "Envoyé",
  accepted: "Accepté",
  refused:  "Refusé",
  paid:     "Payé",
  overdue:  "En retard",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "status-badge font-medium",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// Badge de statut avec label automatique (pratique pour les listes)
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status as BadgeVariant}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
