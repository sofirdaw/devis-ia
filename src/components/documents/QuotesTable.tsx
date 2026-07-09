/**
 * QuotesTable — Liste des devis avec filtre par statut, KPIs et recherche
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Sparkles,
  Search,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Quote, QuoteStatus } from "@/types";

interface QuotesTableProps {
  quotes: Quote[];
}

const STATUS_FILTERS: { value: QuoteStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "sent", label: "Envoyés" },
  { value: "accepted", label: "Acceptés" },
  { value: "refused", label: "Refusés" },
];

export function QuotesTable({ quotes }: QuotesTableProps) {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = quotes.length;
    const acceptedAmount = quotes
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + Number(q.total), 0);
    const pendingAmount = quotes
      .filter((q) => q.status === "sent" || q.status === "draft")
      .reduce((sum, q) => sum + Number(q.total), 0);

    return { totalCount, acceptedAmount, pendingAmount };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const matchesStatus = statusFilter === "all" || q.status === statusFilter;
      const matchesSearch =
        q.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.client?.name ?? "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [quotes, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Barre de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-lg shrink-0">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Total des Devis
            </p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {kpis.totalCount}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-green-50 text-green-600 rounded-lg shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Montant Accepté
            </p>
            <p className="text-xl sm:text-2xl font-bold text-green-600 font-mono">
              {formatCurrency(kpis.acceptedAmount)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-yellow-50 text-yellow-600 rounded-lg shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-500">
              Montant en Cours
            </p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 font-mono">
              {formatCurrency(kpis.pendingAmount)}
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

        <div className="flex gap-1 shrink-0 -ml-5">
          <Link href="/quotes/ai">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles size={10} className="text-blue-600" />}
            >
              Générer avec l'IA
            </Button>
          </Link>
          <Link href="/quotes/new">
            <Button size="sm" leftIcon={<Plus size={10} />}>
              Nouveau devis
            </Button>
          </Link>
        </div>
      </div>

      {filteredQuotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 lg:py-16 text-center shadow-sm">
          <FileText size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            Aucun devis trouvé
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Essayez d'ajuster vos critères de recherche ou de filtre
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75">
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    N° Devis
                  </th>
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    Client
                  </th>
                  <th className="text-left font-semibold text-gray-500 px-5 py-4 uppercase tracking-wider text-xs">
                    Date
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
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                      >
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-700 font-medium">
                      {quote.client?.name ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {formatDate(quote.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-gray-900 font-mono">
                      {formatCurrency(quote.total)}
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
