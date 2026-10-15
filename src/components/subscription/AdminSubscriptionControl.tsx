"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search, Building2, Users, FileText, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/subscription";

type CompanyItem = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  subscription_started_at: string | null;
};

type ClientEvent = {
  id: string;
  event_type: string;
  error_code: string | null;
  route: string;
  created_at: string;
};

type CompanyDetail = {
  company: CompanyItem;
  account: {
    id: string;
    email: string | null;
    fullName: string | null;
    lastSignInAt: string | null;
    emailConfirmedAt: string | null;
    createdAt: string;
    disabled: boolean;
  } | null;
  usage: {
    clients: number;
    products: number;
    quotes: number;
    invoices: number;
    receivables: number;
    paymentRequests: number;
    activatedSubscriptions: number;
    paidTotal: number;
    sessions90Days: number;
    pageViews90Days: number;
  };
  payments: Array<{
    id: string;
    plan: string;
    amount: number;
    currency: string;
    status: string;
    order_id: string;
    orange_transaction_id: string | null;
    created_at: string;
    paid_at: string | null;
    activated_at: string | null;
  }>;
  issues: ClientEvent[];
};

type StatusFilter = "active" | "expired" | "other";

const eventLabels: Record<string, string> = {
  runtime_error: "Erreur d’interface",
  unhandled_rejection: "Erreur technique",
  session_started: "Connexion à l’application",
  page_view: "Consultation de page",
  connection_lost: "Perte de connexion",
  connection_restored: "Connexion rétablie",
  ai_generation_failed: "Échec de génération IA",
  ai_generation_succeeded: "Génération IA réussie",
};

const dateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value)
      )
    : "Non disponible";

export function AdminSubscriptionControl() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<StatusFilter>("active");
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  async function loadCompanies(showLoader = false) {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch("/api/admin/subscriptions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Utilisateurs indisponibles.");
      setCompanies(result.companies || []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Utilisateurs indisponibles.");
    } finally {
      setLoading(false);
    }
  }

  async function createCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompanyName,
          fullName: newOwnerName,
          email: newEmail,
          phone: newPhone,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Création du compte impossible.");
      setNotice("Entreprise créée. Une invitation de connexion a été envoyée par e-mail.");
      setNewCompanyName("");
      setNewOwnerName("");
      setNewEmail("");
      setNewPhone("");
      setShowCreateForm(false);
      await loadCompanies();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Création du compte impossible."
      );
    } finally {
      setCreating(false);
    }
  }

  async function loadDetail(companyId: string) {
    setSelectedId(companyId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const response = await fetch(
        `/api/admin/subscriptions?companyId=${encodeURIComponent(companyId)}`,
        { cache: "no-store" }
      );
      const result = (await response.json()) as CompanyDetail & { error?: string };
      if (!response.ok) throw new Error(result.error || "Fiche client indisponible.");
      setDetail(result);
      setCompanyName(result.company.name);
      setOwnerName(result.account?.fullName || "");
      setContactEmail(result.company.email || "");
      setPhone(result.company.phone || "");
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Fiche client indisponible.");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCompanies(true), 0);
    const interval = window.setInterval(() => void loadCompanies(), 20000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  async function updateCompany(companyId: string, payload: Record<string, unknown>) {
    setUpdating(companyId);
    setError(null);
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...payload }),
      });
      const result = (await response.json()) as { error?: string; expiresAt?: string };
      if (!response.ok) throw new Error(result.error || "Modification impossible.");
      setNotice(
        result.expiresAt
          ? `Forfait ajouté. L'accès est désormais actif jusqu'au ${dateTime(result.expiresAt)}.`
          : "Informations client mises à jour."
      );
      await Promise.all([loadCompanies(), loadDetail(companyId)]);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Modification impossible.");
    } finally {
      setUpdating(null);
    }
  }

  async function changeStatus(companyId: string, status: "active" | "suspended") {
    await updateCompany(companyId, { status });
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
      await Promise.all([loadCompanies(), loadDetail(companyId)]);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Annulation impossible.");
    } finally {
      setUpdating(null);
    }
  }

  async function deleteCompany(company: CompanyItem) {
    if (
      !window.confirm(
        `Suppression définitive du compte « ${company.name} » et de toutes ses données métier. Continuer ?`
      )
    )
      return;
    const confirmation = window.prompt(
      `Pour confirmer, saisissez exactement le nom : ${company.name}`
    );
    if (confirmation !== company.name) return;
    setUpdating(company.id);
    setError(null);
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id, confirmName: confirmation }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Suppression impossible.");
      setSelectedId(null);
      setDetail(null);
      setNotice("Compte de connexion et données de l’entreprise supprimés.");
      await loadCompanies();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
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
  const rows =
    view === "active" ? activeCompanies : view === "expired" ? expiredCompanies : otherCompanies;
  const query = search.trim().toLowerCase();
  const visibleCompanies = rows.filter(
    (company) =>
      (planFilter === "all" ||
        (planFilter === "trial"
          ? !company.subscription_plan
          : company.subscription_plan === planFilter)) &&
      [company.name, company.email, company.phone, company.user_id, company.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
  );

  if (loading) return <p className="text-sm text-gray-500">Chargement des comptes...</p>;

  return (
    <div className="space-y-4">
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowCreateForm((open) => !open)}>
          {showCreateForm ? "Fermer le formulaire" : "Créer une entreprise"}
        </Button>
      </div>
      {showCreateForm && (
        <form
          onSubmit={createCompany}
          className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 md:grid-cols-2"
        >
          <label className="grid gap-1 text-sm">
            Nom de l’entreprise
            <input
              required
              maxLength={120}
              value={newCompanyName}
              onChange={(event) => setNewCompanyName(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Nom complet du responsable
            <input
              required
              maxLength={120}
              value={newOwnerName}
              onChange={(event) => setNewOwnerName(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            E-mail de connexion et de contact
            <input
              required
              type="email"
              maxLength={254}
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Téléphone
            <input
              type="tel"
              maxLength={40}
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              className="rounded-md border border-gray-300 bg-white px-3 py-2"
            />
          </label>
          <p className="text-xs text-gray-600 md:col-span-2">
            Aucun mot de passe n’est créé ou communiqué par l’admin : la personne reçoit une
            invitation sécurisée par e-mail.
          </p>
          <div className="md:col-span-2">
            <Button type="submit" isLoading={creating} disabled={creating}>
              Créer le dossier et envoyer l’invitation
            </Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Entreprises suivies", count: companies.length, icon: Building2 },
          { title: "Abonnements actifs", count: activeCompanies.length, icon: Activity },
          { title: "Comptes expirés", count: expiredCompanies.length, icon: FileText },
          { title: "Essais / autres statuts", count: otherCompanies.length, icon: Users },
        ].map(({ title, count, icon: Icon }) => (
          <div
            key={title}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <Icon size={20} className="text-blue-600" />
            <div>
              <p className="text-xs text-gray-500">{title}</p>
              <p className="text-xl font-bold text-gray-950">{count}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les entreprises">
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
        <div className="flex gap-2">
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 text-sm"
            aria-label="Filtrer par forfait"
          >
            <option value="all">Tous les forfaits</option>
            <option value="monthly">1 mois</option>
            <option value="quarter">3 mois</option>
            <option value="year">1 an</option>
            <option value="trial">Essai / sans forfait</option>
          </select>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 sm:w-80">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Entreprise, e-mail, téléphone ou ID"
              className="w-full py-2 text-sm outline-none"
              aria-label="Rechercher une entreprise"
            />
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadCompanies(true)}
            leftIcon={<RefreshCw size={14} />}
          >
            Actualiser
          </Button>
        </div>
      </div>

      {!visibleCompanies.length && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Aucune entreprise ne correspond à ce filtre.
        </div>
      )}

      {visibleCompanies.map((company) => {
        const suspended = company.subscription_status === "suspended";
        const expired = Boolean(
          company.subscription_expires_at && new Date(company.subscription_expires_at) <= now
        );
        return (
          <section
            key={company.id}
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-gray-950">{company.name}</p>
                <p className="text-gray-500">
                  {company.email || "E-mail de contact non renseigné"}
                </p>
                <p className="text-xs text-gray-500">
                  {company.phone || "Téléphone non renseigné"} · ID entreprise {company.id}
                </p>
                <p
                  className={`text-xs font-semibold ${expired ? "text-red-600" : "text-gray-600"}`}
                >
                  Statut : {expired ? "expiré" : company.subscription_status || "inconnu"} ·{" "}
                  {company.subscription_plan || "essai"}
                  {company.subscription_expires_at &&
                    ` · jusqu’au ${dateTime(company.subscription_expires_at)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void loadDetail(company.id)}>
                  Voir le dossier client
                </Button>
                <Button
                  isLoading={updating === company.id}
                  disabled={updating !== null}
                  onClick={() => void changeStatus(company.id, suspended ? "active" : "suspended")}
                >
                  {suspended ? "Restaurer l’accès" : "Archiver / suspendre"}
                </Button>
                {!expired && !suspended && (
                  <Button
                    variant="danger"
                    size="sm"
                    isLoading={updating === company.id}
                    disabled={updating !== null}
                    onClick={() => void cancelSubscription(company.id)}
                  >
                    Annuler et rembourser
                  </Button>
                )}
              </div>
            </div>

            {selectedId === company.id && (
              <div className="space-y-5 border-t border-gray-100 pt-4">
                {detailLoading && (
                  <p className="text-sm text-gray-500">Chargement du dossier client...</p>
                )}
                {detail && (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-950">Dossier client</h3>
                      <button
                        className="text-sm text-blue-700 underline"
                        onClick={() => {
                          setSelectedId(null);
                          setDetail(null);
                        }}
                      >
                        Fermer
                      </button>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                        <h4 className="font-semibold">Entreprise et compte</h4>
                        <p className="text-sm">
                          Nom du responsable :{" "}
                          <strong>{detail.account?.fullName || "Non renseigné"}</strong>
                        </p>
                        <p className="break-all text-sm">
                          E-mail de connexion :{" "}
                          <strong>{detail.account?.email || "Non renseigné"}</strong>
                        </p>
                        <p className="break-all text-xs text-gray-500">
                          ID compte : {detail.account?.id || company.user_id}
                        </p>
                        <p className="text-sm">
                          Dernière connexion :{" "}
                          <strong>{dateTime(detail.account?.lastSignInAt)}</strong>
                        </p>
                        <p className="text-sm">
                          Compte d’authentification :{" "}
                          <strong>
                            {detail.account?.disabled
                              ? "Désactivé"
                              : !detail.account?.emailConfirmedAt
                                ? "Invitation à confirmer"
                                : "Actif"}
                          </strong>
                        </p>
                        <p className="text-sm">
                          Inscrit le : {dateTime(detail.account?.createdAt || company.created_at)}
                        </p>
                        <form
                          className="grid gap-3 border-t border-gray-200 pt-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void updateCompany(company.id, {
                              name: companyName,
                              fullName: ownerName,
                              email: contactEmail,
                              phone,
                            });
                          }}
                        >
                          <label className="grid gap-1 text-sm">
                            Nom de l’entreprise
                            <input
                              className="rounded-md border border-gray-300 px-3 py-2"
                              value={companyName}
                              onChange={(event) => setCompanyName(event.target.value)}
                              required
                              maxLength={120}
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            E-mail de contact entreprise
                            <input
                              className="rounded-md border border-gray-300 px-3 py-2"
                              type="email"
                              value={contactEmail}
                              onChange={(event) => setContactEmail(event.target.value)}
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            Téléphone
                            <input
                              className="rounded-md border border-gray-300 px-3 py-2"
                              type="tel"
                              value={phone}
                              onChange={(event) => setPhone(event.target.value)}
                              maxLength={40}
                            />
                          </label>
                          <Button
                            type="submit"
                            isLoading={updating === company.id}
                            disabled={updating !== null}
                          >
                            Enregistrer les coordonnées
                          </Button>
                        </form>
                      </div>
                      <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                        <h4 className="font-semibold">Utilisation et abonnement</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <p>
                            Clients : <strong>{detail.usage.clients}</strong>
                          </p>
                          <p>
                            Produits : <strong>{detail.usage.products}</strong>
                          </p>
                          <p>
                            Devis : <strong>{detail.usage.quotes}</strong>
                          </p>
                          <p>
                            Factures : <strong>{detail.usage.invoices}</strong>
                          </p>
                          <p>
                            Créances : <strong>{detail.usage.receivables}</strong>
                          </p>
                          <p>
                            Demandes de paiement : <strong>{detail.usage.paymentRequests}</strong>
                          </p>
                          <p>
                            Abonnements activés :{" "}
                            <strong>{detail.usage.activatedSubscriptions}</strong>
                          </p>
                          <p>
                            Connexions (90 j) : <strong>{detail.usage.sessions90Days}</strong>
                          </p>
                          <p>
                            Pages consultées (90 j) :{" "}
                            <strong>{detail.usage.pageViews90Days}</strong>
                          </p>
                          <p>
                            Total encaissé :{" "}
                            <strong>{detail.usage.paidTotal.toLocaleString("fr-FR")} FCFA</strong>
                          </p>
                        </div>
                        <p className="text-sm">
                          Forfait actuel :{" "}
                          <strong>{company.subscription_plan || "Essai gratuit"}</strong> ·{" "}
                          {company.subscription_status || "sans statut"}
                        </p>
                        <p className="text-sm">
                          Expiration :{" "}
                          {dateTime(company.subscription_expires_at || company.trial_ends_at)}
                        </p>
                        <div className="space-y-2 border-t border-gray-200 pt-3">
                          <p className="text-sm font-semibold">
                            Ajouter un forfait (prolonge l’accès existant)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(Object.keys(PLANS) as PlanId[]).map((plan) => (
                              <Button
                                key={plan}
                                size="sm"
                                variant="outline"
                                isLoading={updating === company.id}
                                disabled={updating !== null}
                                onClick={() => void updateCompany(company.id, { grantPlan: plan })}
                              >
                                Ajouter {PLANS[plan].label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="font-semibold">Historique des paiements et forfaits</h4>
                        {!detail.payments.length ? (
                          <p className="text-sm text-gray-500">Aucun paiement enregistré.</p>
                        ) : (
                          detail.payments.slice(0, 10).map((payment) => (
                            <div
                              key={payment.id}
                              className="rounded-md border border-gray-200 p-3 text-xs"
                            >
                              <p className="font-semibold">
                                {payment.plan} · {payment.amount.toLocaleString("fr-FR")}{" "}
                                {payment.currency} · {payment.status}
                              </p>
                              <p>
                                {dateTime(payment.created_at)} · Réf.{" "}
                                {payment.orange_transaction_id || payment.order_id}
                              </p>
                              {payment.activated_at && (
                                <p>Activé le {dateTime(payment.activated_at)}</p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold">
                          Erreurs et incidents techniques (90 jours)
                        </h4>
                        {!detail.issues.length ? (
                          <p className="text-sm text-gray-500">Aucun événement technique récent.</p>
                        ) : (
                          detail.issues.slice(0, 20).map((issue) => (
                            <div
                              key={issue.id}
                              className="flex justify-between gap-3 rounded-md border border-gray-200 p-3 text-xs"
                            >
                              <span>
                                {eventLabels[issue.event_type] || issue.event_type}
                                {issue.error_code && ` · ${issue.error_code}`} · {issue.route}
                              </span>
                              <time className="shrink-0 text-gray-500">
                                {dateTime(issue.created_at)}
                              </time>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-red-100 pt-3">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={updating !== null}
                        onClick={() => void deleteCompany(company)}
                      >
                        Supprimer définitivement le compte et ses données
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
