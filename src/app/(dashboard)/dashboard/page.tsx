/**
 * Page Dashboard — Vue d'ensemble de l'activité de l'entreprise
 *
 * Affiche : devis du mois, factures du mois, chiffre d'affaires total,
 * factures impayées, graphique mensuel, et les 5 derniers documents.
 */

import { redirect } from "next/navigation";
import { FileText, Receipt, TrendingUp, AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout";
import { StatCard } from "@/components/dashboard/StatCard";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { RecentDocumentsList } from "@/components/dashboard/RecentDocumentsList";
import { getDashboardStats } from "@/app/actions/dashboard";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  // Rediriger vers setup si l'utilisateur n'a pas d'entreprise
  if (!stats) {
    redirect("/setup");
  }

  return (
    <>
      <Header title="Tableau de bord" description="Vue d'ensemble de votre activité" />
      <div className="page-container space-y-4 sm:space-y-6">
        {/* ── Cartes de statistiques ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Devis ce mois"
            value={String(stats?.quotesCount ?? 0)}
            icon={FileText}
            tone="blue"
          />
          <StatCard
            label="Factures ce mois"
            value={String(stats?.invoicesCount ?? 0)}
            icon={Receipt}
            tone="blue"
          />
          <StatCard
            label="Chiffre d'affaires"
            value={formatCurrency(stats?.totalRevenue ?? 0)}
            icon={TrendingUp}
            tone="green"
            subtext="Factures payées"
          />
          <StatCard
            label="Factures impayées"
            value={formatCurrency(stats?.unpaidAmount ?? 0)}
            icon={AlertTriangle}
            tone="orange"
            subtext={`${stats?.unpaidCount ?? 0} facture${(stats?.unpaidCount ?? 0) > 1 ? "s" : ""}`}
          />
        </div>

        {/* ── Graphique de revenus ────────────────────────────────────────── */}
        <RevenueChart data={stats?.monthlyRevenue ?? []} />

        {/* ── Listes récentes ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <RecentDocumentsList
            title="Derniers devis"
            documents={(stats?.recentQuotes ?? []).map((q) => ({
              id: q.id,
              number: q.quote_number,
              total: q.total,
              status: q.status,
              created_at: q.created_at,
              client_name: q.client_name,
            }))}
            basePath="quotes"
            viewAllHref="/quotes"
          />
          <RecentDocumentsList
            title="Dernières factures"
            documents={(stats?.recentInvoices ?? []).map((inv) => ({
              id: inv.id,
              number: inv.invoice_number,
              total: inv.total,
              status: inv.status,
              created_at: inv.created_at,
              client_name: inv.client_name,
            }))}
            basePath="invoices"
            viewAllHref="/invoices"
          />
        </div>
      </div>
    </>
  );
}
