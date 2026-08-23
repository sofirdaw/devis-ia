/**
 * InvoicesTable — Liste des factures avec filtre par statut, KPIs et recherche
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Receipt, Plus, AlertCircle, Sparkles, Search, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getOfflineInvoices, type OfflineInvoice } from "@/lib/offline-db";
import type { Invoice, InvoiceStatus, Client } from "@/types";

interface InvoicesTableProps {
  invoices: Invoice[];
}

const STATUS_FILTERS: { value: InvoiceStatus | "all"; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "draft", label: "Brouillons" },
  { value: "sent", label: "Envoyées" },
  { value: "paid", label: "Payées" },
  { value: "overdue", label: "En retard" },
];

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [offlineInvoices, setOfflineInvoices] = useState<OfflineInvoice[]>([]);

  useEffect(() => {
    async function loadOffline() {
      const offline = await getOfflineInvoices();
      setOfflineInvoices(offline);
    }
    loadOffline();

    const handleSyncComplete = () => {
      loadOffline();
    };

    window.addEventListener("pwa-sync-complete", handleSyncComplete);
    return () => window.removeEventListener("pwa-sync-complete", handleSyncComplete);
  }, []);

  const combinedInvoices = useMemo(() => {
    const formattedOffline: Invoice[] = offlineInvoices
      .filter((off) => off.sync_status === "pending_create")
      .map(
        (off) =>
          ({
            id: off.id,
            invoice_number: `${off.invoice_number} (Local 🟡)`,
            client: { name: off.client_name || "Client Local" } as unknown as Client,
            company_id: "offline_company",
            client_id: off.client_id || "",
            status: off.status,
            total: off.total,
            subtotal: off.subtotal,
            tax: off.tax,
            discount: off.discount,
            notes: off.notes || "",
            due_date: off.due_date || null,
            paid_at: null,
            created_at: off.created_at,
            receivable: null,
            is_offline: true,
          }) as unknown as Invoice
      );
    return [...formattedOffline, ...invoices];
  }, [invoices, offlineInvoices]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = combinedInvoices.length;

    const paidAmount = combinedInvoices.reduce((sum, i) => {
      if (i.receivable) return sum + Number(i.receivable.paid_amount);
      return sum + (i.status === "paid" ? Number(i.total) : 0);
    }, 0);

    const unpaidAmount = combinedInvoices.reduce((sum, i) => {
      if (i.receivable) return sum + Number(i.receivable.remaining_amount);
      return sum + (i.status === "paid" ? 0 : Number(i.total));
    }, 0);

    return { totalCount, paidAmount, unpaidAmount };
  }, [combinedInvoices]);

  const filteredInvoices = useMemo(() => {
    return combinedInvoices.filter((i) => {
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      const matchesSearch =
        i.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.client?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [combinedInvoices, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Barre de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <Receipt size={20} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">Total des Factures</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{kpis.totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-green-50 text-green-600 rounded-lg shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">Montant Encaissé (Payé)</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600 font-mono">
              {formatCurrency(kpis.paidAmount)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-red-50 text-red-600 rounded-lg shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Montant Reste à Recouvrer
            </p>
            <p className="text-xl sm:text-2xl font-bold text-red-600 font-mono">
              {formatCurrency(kpis.unpaidAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Filtres par statut + recherche + bouton création */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="w-full sm:w-60">
            <Input
              placeholder="Rechercher par N° ou client..."
              leftIcon={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-gray-50/50"
            />
          </div>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  statusFilter === filter.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 shrink-0 -ml-5">
          <Link href="/invoices/ai">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles size={14} className="text-blue-600" />}
            >
              Générer avec l&apos;IA
            </Button>
          </Link>
          <Link href="/invoices/new">
            <Button size="sm" leftIcon={<Plus size={14} />}>
              Nouvelle facture
            </Button>
          </Link>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 lg:py-16 text-center shadow-sm">
          <Receipt size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">Aucune facture trouvée</p>
          <p className="text-gray-400 text-xs mt-1">
            Essayez d&apos;ajuster vos critères de recherche ou de filtre
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75">
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    N° Facture
                  </th>
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    Client
                  </th>
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    Échéance
                  </th>
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    Statut
                  </th>
                  <th className="text-right font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-700 font-medium">
                      {invoice.client?.name ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      <div className="flex items-center gap-1.5">
                        {invoice.status === "overdue" && (
                          <AlertCircle size={12} className="text-orange-500" />
                        )}
                        {invoice.due_date ? formatDate(invoice.due_date) : "—"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="px-5 py-4 text-right font-mono">
                      <div className="font-bold text-gray-900">{formatCurrency(invoice.total)}</div>
                      {invoice.receivable && invoice.receivable.status === "partial" && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          Payé {formatCurrency(invoice.receivable.paid_amount)} · Reste{" "}
                          {formatCurrency(invoice.receivable.remaining_amount)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
