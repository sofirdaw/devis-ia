/**
 * Page Dashboard — Vue d'ensemble de l'activité de l'entreprise
 *
 * Affiche : devis du mois, factures du mois, chiffre d'affaires total,
 * factures impayées, graphique mensuel, et les 5 derniers documents.
 */

import { redirect } from "next/navigation";
import { Header } from "@/components/layout";
import { DashboardActivity } from "@/components/dashboard/DashboardActivity";
import { getDashboardStats } from "@/app/actions/dashboard";
import { requireCurrentCompany } from "@/lib/current-company";
import { getRemainingTrialDays, PLANS } from "@/lib/subscription";
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

        <DashboardActivity initialStats={stats} companyId={company.id} />
      </div>
    </>
  );
}
