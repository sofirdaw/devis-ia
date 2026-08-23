/**
 * Page Détail Facture
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { StatusBadge } from "@/components/ui/badge";
import { InvoiceDetailActions } from "@/components/documents/InvoiceDetailActions";
import { DownloadPdfButton } from "@/components/pdf/DownloadPdfButton";
import { PrintButton } from "@/components/pdf/PrintButton";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(*), invoice_items(*)")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();

  if (!invoice) notFound();

  const { data: receivable } = await supabase
    .from("receivables")
    .select("id, paid_amount, remaining_amount, status")
    .eq("invoice_id", id)
    .maybeSingle();

  const typedInvoice = { ...invoice, receivable } as Invoice;

  return (
    <>
      <Header
        title={typedInvoice.invoice_number}
        description={`Facture pour ${typedInvoice.client?.name}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/invoices">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft size={14} />}
                className="flex sm:hidden"
              >
                Retour
              </Button>
            </Link>
            <PrintButton pdfUrl={`/api/pdf/invoice/${typedInvoice.id}`} />
            <DownloadPdfButton type="invoice" documentId={typedInvoice.id} />
            <InvoiceDetailActions invoiceId={typedInvoice.id} currentStatus={typedInvoice.status} />
          </div>
        }
      />

      <div className="page-container max-w-5xl">
        <div
          id="print-area"
          className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <StatusBadge status={typedInvoice.status} />
            <div className="text-right text-sm text-gray-500">
              <p>Émise le {formatDate(typedInvoice.created_at)}</p>
              {typedInvoice.due_date && <p>Échéance le {formatDate(typedInvoice.due_date)}</p>}
            </div>
          </div>

          <div className="border-t border-b border-gray-100 py-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Client</p>
            <p className="font-medium text-gray-900">{typedInvoice.client?.name}</p>
            {typedInvoice.client?.phone && (
              <p className="text-sm text-gray-500">{typedInvoice.client.phone}</p>
            )}
            {typedInvoice.client?.address && (
              <p className="text-sm text-gray-500">{typedInvoice.client.address}</p>
            )}
          </div>

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
                {typedInvoice.invoice_items?.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 text-gray-900">{item.designation}</td>
                    <td className="py-2.5 text-right text-gray-600">{item.quantity}</td>
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

          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sous-total</span>
                <span className="text-gray-900">{formatCurrency(typedInvoice.subtotal)}</span>
              </div>
              {typedInvoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Remise</span>
                  <span className="text-gray-900">-{formatCurrency(typedInvoice.discount)}</span>
                </div>
              )}
              {typedInvoice.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA</span>
                  <span className="text-gray-900">{formatCurrency(typedInvoice.tax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-medium text-gray-700">Total</span>
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(typedInvoice.total)}
                </span>
              </div>
            </div>
          </div>

          {typedInvoice.receivable && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Suivi du paiement</p>
                <Link
                  href={`/receivables/${typedInvoice.receivable.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Voir la créance →
                </Link>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">
                  Payé : {formatCurrency(typedInvoice.receivable.paid_amount)}
                </span>
                <span className="text-gray-500">
                  Reste : {formatCurrency(typedInvoice.receivable.remaining_amount)}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (Number(typedInvoice.receivable.paid_amount) /
                        Number(typedInvoice.total || 1)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {typedInvoice.notes && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{typedInvoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
