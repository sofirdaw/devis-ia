"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/subscription";

type RequestItem = {
  id: string;
  plan: PlanId;
  amount: number;
  currency: string;
  order_id: string;
  created_at: string;
  user_confirmed_at: string | null;
  company: { name: string; email: string | null; phone: string | null } | null;
};

export function AdminSubscriptionRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [activationCodes, setActivationCodes] = useState<Record<string, string>>({});
  const [newRequestNotice, setNewRequestNotice] = useState(false);
  const knownRequestCount = useRef<number | null>(null);

  async function loadRequests() {
    const response = await fetch("/api/admin/subscription-requests", { cache: "no-store" });
    const result = (await response.json()) as { requests?: RequestItem[]; error?: string };
    if (!response.ok) throw new Error(result.error || "Demandes indisponibles.");
    const nextRequests = result.requests || [];
    if (knownRequestCount.current !== null && nextRequests.length > knownRequestCount.current) {
      setNewRequestNotice(true);
    }
    knownRequestCount.current = nextRequests.length;
    setRequests(nextRequests);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      loadRequests()
        .catch((requestError) =>
          setError(requestError instanceof Error ? requestError.message : "Demandes indisponibles.")
        )
        .finally(() => setLoading(false));
    }, 0);
    const interval = window.setInterval(() => loadRequests().catch(() => undefined), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, []);

  async function approve(requestId: string) {
    setApproving(requestId);
    setError(null);
    try {
      const response = await fetch("/api/admin/subscription-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Activation impossible.");
      setRequests((current) => current.filter((item) => item.id !== requestId));
      setActivationCodes((current) => ({ ...current, [requestId]: "activated" }));
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Activation impossible.");
    } finally {
      setApproving(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Chargement des demandes...</p>;
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
      {newRequestNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
        >
          <span>Nouvelle demande d&apos;abonnement reçue.</span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => setNewRequestNotice(false)}
          >
            Fermer
          </button>
        </div>
      )}
      {Object.keys(activationCodes).map((id) => (
        <div
          key={id}
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
        >
          Abonnement activé. L&apos;utilisateur reçoit automatiquement l&apos;accès à son espace.
        </div>
      ))}
      {!requests.length && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Aucune demande en attente.
        </div>
      )}
      {!!requests.length && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
          {requests.length} demande{requests.length > 1 ? "s" : ""} en attente
        </div>
      )}
      {requests.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1 text-sm text-gray-700">
            <p className="font-semibold text-gray-950">
              {item.company?.name || "Entreprise inconnue"}
            </p>
            <p>
              {PLANS[item.plan]?.label} · {item.amount.toLocaleString("fr-FR")} {item.currency}
            </p>
            <p className="text-xs text-gray-500">
              {item.company?.email || item.company?.phone || "Contact non renseigné"} ·{" "}
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(item.created_at)
              )}
            </p>
            <p className="font-mono text-xs text-gray-400">{item.order_id}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              isLoading={approving === item.id}
              disabled={approving !== null}
              onClick={() => approve(item.id)}
            >
              Vérifier et activer l&apos;abonnement
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
