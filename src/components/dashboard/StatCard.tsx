/**
 * StatCard — Carte de statistique pour le dashboard
 * Affiche un chiffre clé avec icône, label et couleur thématique
 */

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "blue" | "green" | "orange" | "gray";
  subtext?: string;
}

const TONE_STYLES = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600" },
  green: { bg: "bg-green-50", icon: "text-green-600" },
  orange: { bg: "bg-orange-50", icon: "text-orange-600" },
  gray: { bg: "bg-gray-100", icon: "text-gray-600" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  subtext,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
        <span className="text-xs sm:text-sm text-gray-500 truncate">
          {label}
        </span>
        <div
          className={cn(
            "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0",
            styles.bg,
          )}
        >
          <Icon size={14} className={cn("sm:hidden", styles.icon)} />
          <Icon size={16} className={cn("hidden sm:block", styles.icon)} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl font-semibold text-gray-900 wrap-break-word">{value}</p>
      {subtext && (
        <p className="text-xs text-gray-400 mt-1 truncate">{subtext}</p>
      )}
    </div>
  );
}
