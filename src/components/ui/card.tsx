/**
 * Composant Card — Carte de contenu réutilisable
 *
 * Sous-composants :
 * - Card        : conteneur principal (ombre + fond blanc + radius)
 * - CardHeader  : zone en-tête avec titre et description
 * - CardBody    : zone de contenu principal
 * - CardFooter  : zone pied de carte (boutons d'action)
 */

import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

// ── Card (conteneur) ──────────────────────────────────────────────────────────
export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ── CardHeader ────────────────────────────────────────────────────────────────
export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-100", className)} {...props}>
      {children}
    </div>
  );
}

// ── CardTitle ─────────────────────────────────────────────────────────────────
export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-semibold text-gray-900", className)} {...props}>
      {children}
    </h3>
  );
}

// ── CardDescription ───────────────────────────────────────────────────────────
export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-gray-500 mt-0.5", className)} {...props}>
      {children}
    </p>
  );
}

// ── CardBody ──────────────────────────────────────────────────────────────────
export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-4", className)} {...props}>
      {children}
    </div>
  );
}

// ── CardFooter ────────────────────────────────────────────────────────────────
export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4 border-t border-gray-100 flex items-center gap-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}
