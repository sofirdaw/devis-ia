"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Receipt, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentDocumentsList } from "@/components/dashboard/RecentDocumentsList";
import { getOfflineSnapshot } from "@/lib/offline-db";
import type { DashboardStats } from "@/app/actions/dashboard";
import { formatCurrency } from "@/lib/utils";
import { buildOfflineDashboardStats } from "@/lib/offline-dashboard";

export function DashboardActivity({
  initialStats,
  companyId,
}: {
  initialStats: DashboardStats;
  companyId: string;
}) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    let active = true;
    const refreshLocalStats = async () => {
      if (navigator.onLine) return;
      try {
        const snapshot = await getOfflineSnapshot(companyId);
        if (active && snapshot) setStats(buildOfflineDashboardStats(snapshot));
      } catch (error) {
        console.error("Impossible de calculer le tableau de bord hors ligne:", error);
      }
    };
    void refreshLocalStats();
    window.addEventListener("offline", refreshLocalStats);
    window.addEventListener("pwa-offline-data-changed", refreshLocalStats);
    window.addEventListener("pwa-offline-snapshot-ready", refreshLocalStats);
    return () => {
      active = false;
      window.removeEventListener("offline", refreshLocalStats);
      window.removeEventListener("pwa-offline-data-changed", refreshLocalStats);
      window.removeEventListener("pwa-offline-snapshot-ready", refreshLocalStats);
    };
  }, [companyId]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Devis ce mois"
          value={String(stats.quotesCount)}
          icon={FileText}
          tone="blue"
        />
        <StatCard
          label="Factures ce mois"
          value={String(stats.invoicesCount)}
          icon={Receipt}
          tone="blue"
        />
        <StatCard
          label="Chiffre d'affaires"
          value={formatCurrency(stats.totalRevenue)}
          icon={TrendingUp}
          tone="green"
          subtext="Factures payées"
        />
        <StatCard
          label="Factures impayées"
          value={formatCurrency(stats.unpaidAmount)}
          icon={AlertTriangle}
          tone="orange"
          subtext={`${stats.unpaidCount} facture${stats.unpaidCount > 1 ? "s" : ""}`}
        />
      </div>
      <RevenueChart data={stats.monthlyRevenue} />
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <RecentDocumentsList
          title="Derniers devis"
          documents={stats.recentQuotes.map(({ quote_number, ...quote }) => ({
            ...quote,
            number: quote_number,
          }))}
          basePath="quotes"
          viewAllHref="/quotes"
        />
        <RecentDocumentsList
          title="Dernières factures"
          documents={stats.recentInvoices.map(({ invoice_number, ...invoice }) => ({
            ...invoice,
            number: invoice_number,
          }))}
          basePath="invoices"
          viewAllHref="/invoices"
        />
      </div>
    </>
  );
}
