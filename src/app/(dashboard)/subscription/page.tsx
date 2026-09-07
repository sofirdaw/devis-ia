import { CreditCard, ArrowLeft, Clock3 } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { SubscriptionPlans } from "@/components/subscription/SubscriptionPlans";
import { requireCurrentCompany } from "@/lib/current-company";
import { getRemainingTrialDays } from "@/lib/subscription";
import type { Company } from "@/types";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const company = (await requireCurrentCompany()) as Company;
  const isTrial =
    company.subscription_status === "trial" &&
    company.trial_ends_at &&
    new Date(company.trial_ends_at) > new Date();
  const trialEnd =
    isTrial && company.trial_ends_at
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
          new Date(company.trial_ends_at)
        )
      : null;
  const trialDaysRemaining = getRemainingTrialDays(company.trial_ends_at);

  return (
    <>
      <Header
        title="Abonnement"
        description="Gardez votre espace de gestion actif"
        actions={
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Tableau de bord
            </Button>
          </Link>
        }
      />
      <main className="page-container max-w-6xl space-y-8">
        {isTrial && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
            <Clock3 className="mt-0.5 shrink-0 text-blue-600" size={20} />
            <div>
              <p className="font-semibold">Votre essai gratuit est actif</p>
              <p className="mt-1 text-sm text-blue-800">
                Il vous reste{" "}
                <strong>
                  {trialDaysRemaining} {trialDaysRemaining === 1 ? "jour" : "jours"}
                </strong>
                , jusqu&apos;au {trialEnd}.
              </p>
            </div>
          </div>
        )}
        <div className="rounded-xl bg-gray-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex max-w-2xl items-start gap-4">
            <div className="rounded-lg bg-orange-500 p-3">
              <CreditCard size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
                Devis IA
              </p>
              <h1 className="mt-2 text-2xl font-bold">Un accès simple, au juste prix.</h1>
              <p className="mt-2 text-sm leading-6 text-gray-300">
                Activez votre forfait via Orange Money pour continuer à gérer vos devis, factures,
                clients et créances.
              </p>
            </div>
          </div>
        </div>
        <SubscriptionPlans
          currentPlan={company.subscription_plan}
          status={company.subscription_status}
          expiresAt={company.subscription_expires_at}
          trialEndsAt={company.trial_ends_at}
          trialDaysRemaining={trialDaysRemaining}
        />
      </main>
    </>
  );
}
