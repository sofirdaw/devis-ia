"use client";

import { useEffect, useState } from "react";
import { Check, CircleCheck, CreditCard, Copy, ShieldCheck } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/subscription";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const planOrder: PlanId[] = ["monthly", "quarter", "year"];
type PaymentStatus = "pending" | "paid";
const activationNoticeKey = "devis-ai:last-activation-notice";

export function SubscriptionPlans({
  currentPlan,
  status,
  expiresAt,
  trialEndsAt,
  trialDaysRemaining,
}: {
  currentPlan?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  trialEndsAt?: string | null;
  trialDaysRemaining?: number;
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [requestingPlan, setRequestingPlan] = useState<PlanId | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [autoActivated, setAutoActivated] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activationMessage, setActivationMessage] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPlanDetails = selectedPlan ? PLANS[selectedPlan] : null;
  const paymentCode = selectedPlanDetails ? `*144*4*6*${selectedPlanDetails.price}#` : "";

  useEffect(() => {
    let active = true;
    async function loadPendingPayment() {
      const response = await fetch("/api/subscriptions/pending-payment", { cache: "no-store" });
      if (!response.ok) return;
      const result = (await response.json()) as {
        payment?: {
          id: string;
          plan: PlanId;
          status: PaymentStatus;
          user_confirmed_at: string | null;
          activated_at: string | null;
        } | null;
      };
      if (!active || !result.payment) return;
      if (result.payment.activated_at) {
        if (window.localStorage.getItem(activationNoticeKey) !== result.payment.id) {
          window.localStorage.setItem(activationNoticeKey, result.payment.id);
          setAutoActivated(true);
        }
        setSelectedPlan(null);
        return;
      }
      setRequestId(result.payment.id);
      setSelectedPlan(result.payment.plan);
      setPaymentStatus(result.payment.status);
      setPaymentConfirmed(Boolean(result.payment.user_confirmed_at));
    }
    loadPendingPayment().catch(() => undefined);
    const interval = window.setInterval(() => loadPendingPayment().catch(() => undefined), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function requestPayment(plan: PlanId) {
    setRequestingPlan(plan);
    setError(null);
    try {
      const response = await fetch("/api/subscriptions/request-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = (await response.json()) as { error?: string; requestId?: string };
      if (!response.ok) throw new Error(result.error || "Demande non créée.");
      setRequestId(result.requestId || null);
      setPaymentStatus("pending");
      setPaymentConfirmed(false);
      setAutoActivated(false);
      window.localStorage.removeItem(activationNoticeKey);
      setSelectedPlan(plan);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Demande non créée.");
    } finally {
      setRequestingPlan(null);
    }
  }

  async function activateSubscription() {
    if (!requestId || !/^\d{6}$/.test(activationCode)) {
      setActivationMessage("Saisissez un code d'activation à 6 chiffres.");
      return;
    }
    setActivating(true);
    setActivationMessage(null);
    try {
      const response = await fetch("/api/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code: activationCode }),
      });
      const result = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok) throw new Error(result.error || "Code d'activation invalide.");
      setActivationMessage("Abonnement activé. La page va être actualisée.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (activationError) {
      setActivationMessage(
        activationError instanceof Error ? activationError.message : "Activation impossible."
      );
    } finally {
      setActivating(false);
    }
  }

  async function confirmPayment() {
    if (!requestId) return false;
    setActivationMessage(null);
    try {
      const response = await fetch("/api/subscriptions/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const result = (await response.json()) as { error?: string; alreadyConfirmed?: boolean };
      if (!response.ok) throw new Error(result.error || "Confirmation impossible.");
      setPaymentStatus("pending");
      setPaymentConfirmed(true);
      setActivationMessage("Paiement confirmé avec succès ! Votre demande a bien été envoyée à l'administrateur.");
      return true;
    } catch (confirmationError) {
      setActivationMessage(
        confirmationError instanceof Error ? confirmationError.message : "Confirmation impossible."
      );
      return false;
    }
  }

  const formattedExpiry = expiresAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(expiresAt))
    : null;
  const formattedTrialEnd = trialEndsAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(trialEndsAt))
    : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
            Orange Money
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">Choisissez votre forfait</h2>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Paiement par Orange Money. Après vérification de votre confirmation, votre accès sera
            activé.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
          <ShieldCheck size={16} className="text-green-600" /> Paiement vérifié par Orange
        </div>
      </div>

      {currentPlan && formattedExpiry && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Votre forfait actuel est actif jusqu&apos;au <strong>{formattedExpiry}</strong>.
        </div>
      )}
      {status === "trial" && formattedTrialEnd && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Essai gratuit</strong>
          <span className="ml-1">
            Il reste {trialDaysRemaining ?? 0} {trialDaysRemaining === 1 ? "jour" : "jours"},
            jusqu&apos;au {formattedTrialEnd}.
          </span>
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

      <div className="grid gap-4 md:grid-cols-3">
        {planOrder.map((planId) => {
          const plan = PLANS[planId];
          const isFeatured = planId === "year";
          return (
            <div
              key={planId}
              className={cn(
                "relative flex flex-col rounded-xl border bg-white p-5 shadow-sm",
                isFeatured ? "border-orange-400 ring-2 ring-orange-100" : "border-gray-200"
              )}
            >
              {isFeatured && (
                <span className="absolute -top-3 left-5 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white">
                  Meilleure valeur
                </span>
              )}
              <p className="text-sm font-semibold text-gray-600">{plan.label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-gray-950">
                {plan.price.toLocaleString("fr-FR")}{" "}
                <span className="text-base font-semibold text-gray-500">FCFA</span>
              </p>
              <ul className="my-5 flex-1 space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <Check size={17} className="shrink-0 text-green-600" /> Toutes les fonctionnalités
                </li>
                <li className="flex gap-2">
                  <Check size={17} className="shrink-0 text-green-600" /> Accès sans limitation
                </li>
              </ul>
              <Button
                className="w-full"
                variant={isFeatured ? "primary" : "outline"}
                isLoading={requestingPlan === planId}
                disabled={requestingPlan !== null}
                onClick={() => requestPayment(planId)}
                leftIcon={<CreditCard size={16} />}
              >
                Payer par Orange Money
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-400">
        Après paiement, envoyez la confirmation au support pour validation.
      </p>
      <Dialog open={selectedPlan !== null} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        <DialogContent
          title="Payer par Orange Money"
          description="Suivez les étapes pour terminer votre paiement."
        >
          {selectedPlanDetails && (
            <div className="space-y-4 text-sm text-gray-700">
              {paymentConfirmed && paymentStatus === "pending" ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900"
                >
                  <CircleCheck className="mt-0.5 shrink-0 text-green-600" size={20} />
                  <p>Paiement confirmé avec succès ! Votre demande a bien été envoyée à l&apos;administrateur.</p>
                </div>
              ) : (
                <>
                  <p>
                    Forfait sélectionné : <strong>{selectedPlanDetails.label}</strong>
                  </p>
                  <p>
                    Montant à payer :{" "}
                    <strong>{selectedPlanDetails.price.toLocaleString("fr-FR")} FCFA</strong>
                  </p>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-800">
                      Code à composer
                    </p>
                    <p className="break-all font-mono text-base font-bold text-gray-950">
                      {paymentCode}
                    </p>
                  </div>
                  <ol className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <li>
                      <strong>1.</strong> Composez le code et validez l&apos;opération.
                    </li>
                    <li>
                      <strong>2.</strong> Saisissez votre code secret Orange Money.
                    </li>
                    <li>
                      <strong>3.</strong> Conservez le SMS de confirmation.
                    </li>
                    <li>
                      <strong>4.</strong> Cliquez sur « J&apos;ai payé » pour envoyer la demande de
                      vérification.
                    </li>
                    <li>
                      <strong>5.</strong> Après vérification, votre abonnement sera activé
                      automatiquement.
                    </li>
                  </ol>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedPlan(null)}>
                      Fermer
                    </Button>
                    <Button
                      onClick={() => navigator.clipboard?.writeText(paymentCode)}
                      leftIcon={<Copy size={16} />}
                    >
                      Copier le code
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    onClick={async () => {
                      if (await confirmPayment()) setSelectedPlan(null);
                    }}
                    disabled={paymentConfirmed || paymentStatus === "paid"}
                  >
                    J&apos;ai payé, valider
                  </Button>
                  {activationMessage && (
                    <div
                      role="status"
                      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
                    >
                      <p>{activationMessage}</p>
                    </div>
                  )}
                </>
              )}
              {!paymentConfirmed && requestId && paymentStatus === "paid" && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-900">
                    Votre paiement est vérifié. Votre abonnement sera activé automatiquement.
                  </p>
                  <input
                    value={activationCode}
                    onChange={(event) =>
                      setActivationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.3em]"
                    aria-label="Code d'activation à 6 chiffres"
                  />
                  <Button
                    className="w-full"
                    isLoading={activating}
                    disabled={activationCode.length !== 6 || activating}
                    onClick={activateSubscription}
                  >
                    Activer mon abonnement
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={autoActivated} onOpenChange={setAutoActivated}>
        <DialogContent
          title="Abonnement activé"
          description="Votre paiement a été vérifié par l’administrateur."
        >
          <div className="space-y-4 text-center">
            <CircleCheck className="mx-auto text-green-600" size={48} />
            <p className="text-sm text-gray-700">
              Votre accès est maintenant actif. Aucun code à saisir : vous pouvez utiliser
              l&apos;application dès maintenant.
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setAutoActivated(false);
                window.location.reload();
              }}
            >
              Accéder à mon espace
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
