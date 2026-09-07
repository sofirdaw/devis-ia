"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type CompanyItem = {
  id: string;
  name: string;
  email: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  subscription_started_at: string | null;
};

export function AdminSubscriptionControl() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"active" | "expired" | "other">("active");
  const [notice, setNotice] = useState<string | null>(null);

  async function loadCompanies(showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      const result = (await response.json()) as { companies?: CompanyItem[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Utilisateurs indisponibles.");
      setCompanies(result.companies || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Utilisateurs indisponibles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadCompanies(true).catch(() => undefined), 0);
    const interval = window.setInterval(() => loadCompanies().catch(() => undefined), 5000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  async function changeStatus(companyId: string, status: "active" | "suspended") {
    setUpdating(companyId);
    setError(null);
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Modification impossible.");
      await loadCompanies();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Modification impossible.");
    } finally {
      setUpdating(null);
    }
  }

  async function cancelSubscription(companyId: string) {
    if (!window.confirm("Annuler cet abonnement et lancer le remboursement ?")) return;
    setUpdating(companyId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, status: "active", action: "cancel_subscription" }),
      });
      const result = (await response.json()) as { error?: string; refundStatus?: string | null };
      if (!response.ok) throw new Error(result.error || "Annulation impossible.");
      setNotice(
        result.refundStatus === "pending"
          ? "Abonnement annulé. Le remboursement est enregistré et doit être effectué via Orange Money."
          : "Abonnement annulé. Le compte revient à l'offre gratuite."
      );
      await loadCompanies();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Annulation impossible.");
    } finally {
      setUpdating(null);
    }
  }

  const now = new Date();
  const activeCompanies = companies.filter(
    (company) =>
      company.subscription_status === "active" &&
      company.subscription_expires_at &&
      new Date(company.subscription_expires_at) > now
  );
  const expiredCompanies = companies.filter(
    (company) =>
      (company.subscription_status === "active" &&
        company.subscription_expires_at &&
        new Date(company.subscription_expires_at) <= now) ||
      company.subscription_status === "expired"
  );
  const otherCompanies = companies.filter(
    (company) => !activeCompanies.includes(company) && !expiredCompanies.includes(company)
  );
  const visibleCompanies =
    view === "active" ? activeCompanies : view === "expired" ? expiredCompanies : otherCompanies;

  if (loading) return <p className="text-sm text-gray-500">Chargement des comptes...</p>;
  if (error)
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        {error}
      </div>
    );

  return (
    <div className="space-y-3">
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          {notice}
        </div>
      )}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadCompanies(true)}
          leftIcon={<RefreshCw size={14} />}
        >
          Actualiser
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Liste des abonnements">
        {(["active", "expired", "other"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            onClick={() => setView(tab)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${view === tab ? "bg-gray-950 text-white" : "border border-gray-200 bg-white text-gray-600"}`}
          >
            {tab === "active"
              ? `Actifs (${activeCompanies.length})`
              : tab === "expired"
                ? `Expirés (${expiredCompanies.length})`
                : `Autres (${otherCompanies.length})`}
          </button>
        ))}
      </div>
      {!visibleCompanies.length && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Aucun abonnement dans cette liste.
        </div>
      )}
      {visibleCompanies.map((company) => {
        const suspended = company.subscription_status === "suspended";
        const expired = Boolean(
          company.subscription_expires_at && new Date(company.subscription_expires_at) <= now
        );
        return (
          <div
            key={company.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="text-sm">
              <p className="font-semibold text-gray-950">{company.name}</p>
              <p className="text-gray-500">{company.email || "Email non renseigné"}</p>
              <p className={`text-xs font-semibold ${expired ? "text-red-600" : "text-gray-500"}`}>
                Statut : {expired ? "expiré" : company.subscription_status || "inconnu"} ·{" "}
                {company.subscription_plan || "essai"}
              </p>
              {company.subscription_status === "trial" ? (
                <p className="text-xs text-gray-500">
                  Essai :{" "}
                  {company.trial_started_at
                    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                        new Date(company.trial_started_at)
                      )
                    : "-"}
                  {" -> "}
                  {company.trial_ends_at
                    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                        new Date(company.trial_ends_at)
                      )
                    : "-"}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Abonnement :{" "}
                  {company.subscription_started_at
                    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                        new Date(company.subscription_started_at)
                      )
                    : "-"}
                  {" -> "}
                  {company.subscription_expires_at
                    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                        new Date(company.subscription_expires_at)
                      )
                    : "-"}
                </p>
              )}
            </div>
            <Button
              isLoading={updating === company.id}
              disabled={updating !== null}
              onClick={() => changeStatus(company.id, suspended ? "active" : "suspended")}
            >
              {suspended ? "Réactiver" : "Suspendre"}
            </Button>
            {!expired && !suspended && (
              <Button
                variant="danger"
                size="sm"
                isLoading={updating === company.id}
                disabled={updating !== null}
                onClick={() => cancelSubscription(company.id)}
              >
                Annuler et rembourser
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
