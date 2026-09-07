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
import { requireCurrentCompany } from "@/lib/current-company";
import { getRemainingTrialDays, PLANS } from "@/lib/subscription";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const company = await requireCurrentCompany();
  const trialDaysRemaining = getRemainingTrialDays(company.trial_ends_at);

  // Rediriger vers setup si l'utilisateur n'a pas d'entreprise
  if (!stats) {
    redirect("/setup");
  }

  return (
    <>
      <Header title="Tableau de bord" description="Vue d'ensemble de votre activité" />
      <div className="page-container space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">
              Forfait actuel :{" "}
              {company.subscription_status === "trial"
                ? "Essai gratuit"
                : company.subscription_plan && company.subscription_plan in PLANS
                  ? PLANS[company.subscription_plan as keyof typeof PLANS].label
                  : "À choisir"}
            </p>
            {company.subscription_status === "trial" && company.trial_ends_at && (
              <p className="mt-1 text-orange-800">
                Il vous reste{" "}
                <strong>
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? "jour" : "jours"}
                </strong>
                , jusqu&apos;au{" "}
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                  new Date(company.trial_ends_at)
                )}
                .
              </p>
            )}
          </div>
          <Link
            href="/subscription"
            className="font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-900"
          >
            Voir les forfaits
          </Link>
        </div>

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
