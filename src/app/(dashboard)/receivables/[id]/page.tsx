/**
 * Page Détail Créance — Server Component
 *
 * Affiche les détails d'une créance et l'historique des paiements
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { PaymentForm } from "@/components/receivables/PaymentForm";
import { DeletePaymentButton } from "@/components/receivables/DeletePaymentButton";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Calendar, FileText, DollarSign, User } from "lucide-react";
import Link from "next/link";
import type { Receivable, PaymentTransaction } from "@/types";

const statusConfig = {
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700" },
  partial: { label: "Partiel", color: "bg-blue-100 text-blue-700" },
  paid: { label: "Payé", color: "bg-green-100 text-green-700" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700" },
};

export default async function ReceivableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  // Récupérer la créance avec ses relations
  const { data: receivable } = await supabase
    .from("receivables")
    .select("*, client:clients(*), invoice:invoices(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();

  if (!receivable) {
    notFound();
  }

  // Récupérer les paiements de cette créance
  const { data: payments } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("receivable_id", id)
    .order("payment_date", { ascending: false });

  const status = statusConfig[receivable.status as keyof typeof statusConfig];
  const progressPercent =
    (Number(receivable.paid_amount) / Number(receivable.total_amount)) * 100;

  return (
    <>
      <Header
        title="Détail de la créance"
        description={
          <div className="flex items-center gap-2">
            <span className="text-gray-600">
              Facture {receivable.invoice?.invoice_number}
            </span>
            <span>•</span>
            <Badge className={status.color}>{status.label}</Badge>
          </div>
        }
        backButton={
          <Link href="/receivables">
            <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <ArrowLeft size={16} />
              Retour aux créances
            </button>
          </Link>
        }
      />

      <div className="page-container grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Colonne gauche : Informations de la créance */}
        <div className="lg:col-span-2 space-y-6 lg:space-y-8">
          {/* Carte résumé */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8">
            <h3 className="font-semibold text-gray-900 mb-4 lg:mb-6">
              Informations de la créance
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1 lg:mb-2 uppercase tracking-wider">
                  Client
                </p>
                <div className="flex items-center gap-2">
                  <User size={16} className="text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {receivable.client?.name}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1 lg:mb-2 uppercase tracking-wider">
                  Facture
                </p>
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  <span className="font-medium text-gray-900">
                    {receivable.invoice?.invoice_number}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1 lg:mb-2 uppercase tracking-wider">
                  Date d'échéance
                </p>
                {receivable.due_date ? (
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-gray-900">
                      {formatDate(receivable.due_date)}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1 lg:mb-2 uppercase tracking-wider">
                  Statut
                </p>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mt-6 lg:mt-8 pt-4 lg:pt-6 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-2 lg:mb-3">
                <span className="text-gray-600">Progression du paiement</span>
                <span className="font-semibold text-gray-900">
                  {progressPercent.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 lg:h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Carte montants */}
          <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8">
            <h3 className="font-semibold text-gray-900 mb-4 lg:mb-6">
              Montants
            </h3>

            <div className="space-y-3 lg:space-y-4">
              <div className="flex justify-between items-center py-2 lg:py-3 border-b border-gray-200">
                <span className="text-gray-600">Montant total</span>
                <span className="font-semibold text-gray-900 text-base lg:text-lg">
                  {formatCurrency(Number(receivable.total_amount))}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 lg:py-3 border-b border-gray-200">
                <span className="text-gray-600">Montant payé</span>
                <span className="font-semibold text-green-600 text-base lg:text-lg">
                  {formatCurrency(Number(receivable.paid_amount))}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 lg:py-3">
                <span className="text-gray-600 font-medium">Reste à payer</span>
                <span className="font-bold text-gray-900 text-lg lg:text-xl">
                  {formatCurrency(Number(receivable.remaining_amount))}
                </span>
              </div>
            </div>
          </div>

          {/* Historique des paiements */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8">
            <h3 className="font-semibold text-gray-900 mb-4 lg:mb-6">
              Historique des paiements
            </h3>

            {payments && payments.length > 0 ? (
              <div className="space-y-3 lg:space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 lg:py-4 px-4 lg:px-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="font-semibold text-gray-900 text-base lg:text-lg">
                          {formatCurrency(Number(payment.amount))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 lg:gap-3 mt-1 lg:mt-2 text-xs sm:text-sm text-gray-600">
                        <span>{formatDate(payment.payment_date)}</span>
                        <span className="text-gray-300">•</span>
                        <span className="capitalize">
                          {payment.payment_method}
                        </span>
                        {payment.reference && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span>{payment.reference}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <DeletePaymentButton
                      paymentId={payment.id}
                      receivableId={receivable.id}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 lg:py-12 text-gray-500 text-sm">
                <DollarSign
                  size={28}
                  className="text-gray-300 mx-auto mb-2 lg:mb-3"
                />
                Aucun paiement enregistré
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Formulaire d'ajout de paiement */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 lg:p-8 sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-4 lg:mb-6">
              Ajouter un paiement
            </h3>
            <PaymentForm
              receivableId={receivable.id}
              remainingAmount={Number(receivable.remaining_amount)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
