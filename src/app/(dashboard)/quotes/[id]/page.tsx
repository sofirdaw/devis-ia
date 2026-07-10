/**
 * Page Détail Devis — Affiche le devis complet en lecture
 * + actions de changement de statut / conversion / suppression
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { StatusBadge } from "@/components/ui/badge";
import { QuoteDetailActions } from "@/components/documents/QuoteDetailActions";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { PrintButton } from "@/components/pdf/PrintButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Quote } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, client:clients(*), quote_items(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();

  if (!quote) notFound();

  const typedQuote = quote as Quote;

  return (
    <>
      <Header
        title={typedQuote.quote_number}
        description={`Devis pour ${typedQuote.client?.name}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/quotes">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={14} />}
              >
                Retour
              </Button>
            </Link>
            <PrintButton />
            <DownloadPdfButton type="quote" documentId={typedQuote.id} />
            <QuoteDetailActions
              quoteId={typedQuote.id}
              currentStatus={typedQuote.status}
            />
          </div>
        }
      />

      <div className="page-container max-w-5xl">
        <div
          id="print-area"
          className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8 shadow-sm"
        >
          {/* En-tête : statut + dates */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <StatusBadge status={typedQuote.status} />
            <div className="text-right text-sm text-gray-500">
              <p>Créé le {formatDate(typedQuote.created_at)}</p>
              {typedQuote.valid_until && (
                <p>Valide jusqu'au {formatDate(typedQuote.valid_until)}</p>
              )}
            </div>
          </div>

          {/* Infos client */}
          <div className="border-t border-b border-gray-100 py-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Client</p>
            <p className="font-medium text-gray-900">
              {typedQuote.client?.name}
            </p>
            {typedQuote.client?.phone && (
              <p className="text-sm text-gray-500">{typedQuote.client.phone}</p>
            )}
            {typedQuote.client?.address && (
              <p className="text-sm text-gray-500">
                {typedQuote.client.address}
              </p>
            )}
          </div>

          {/* Tableau des lignes */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm mb-6 min-w-120 sm:min-w-0">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-2 font-medium">Désignation</th>
                  <th className="text-right py-2 font-medium">Qté</th>
                  <th className="text-right py-2 font-medium">Prix unitaire</th>
                  <th className="text-right py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {typedQuote.quote_items?.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 text-gray-900">{item.designation}</td>
                    <td className="py-2.5 text-right text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 text-right text-gray-600">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-gray-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totaux */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span className="text-gray-900">
                  {formatCurrency(typedQuote.subtotal)}
                </span>
              </div>
              {typedQuote.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Remise</span>
                  <span className="text-gray-900">
                    -{formatCurrency(typedQuote.discount)}
                  </span>
                </div>
              )}
              {typedQuote.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA</span>
                  <span className="text-gray-900">
                    {formatCurrency(typedQuote.tax)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-medium text-gray-700">Total</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(typedQuote.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {typedQuote.notes && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{typedQuote.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
