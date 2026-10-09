/**
 * Server Actions — Statistiques du Dashboard
 *
 * Centralise toutes les requêtes d'agrégation pour la page d'accueil.
 * Sécurisé pour éviter tout crash (500) en cas d'erreur réseau ou Supabase.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { dashboardCacheKey, getCached, setCached } from "@/lib/cache";
import { getRecentInvoiceFinance, summarizeInvoiceFinancials } from "@/lib/dashboard-financials";

export type DashboardStats = {
  quotesCount: number;
  invoicesCount: number;
  totalRevenue: number; // Somme réellement encaissée, paiements partiels inclus
  unpaidAmount: number; // Soldes restant à encaisser
  unpaidCount: number;
  recentQuotes: Array<{
    id: string;
    quote_number: string;
    total: number;
    status: string;
    created_at: string;
    client_name: string;
  }>;
  recentInvoices: Array<{
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    created_at: string;
    client_name: string;
    paid_amount: number;
    remaining_amount: number;
  }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
};

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const MONTH_LABELS = [
    "Jan",
    "Fév",
    "Mar",
    "Avr",
    "Mai",
    "Jun",
    "Jul",
    "Aoû",
    "Sep",
    "Oct",
    "Nov",
    "Déc",
  ];

  const emptyStats: DashboardStats = {
    quotesCount: 0,
    invoicesCount: 0,
    totalRevenue: 0,
    unpaidAmount: 0,
    unpaidCount: 0,
    recentQuotes: [],
    recentInvoices: [],
    monthlyRevenue: MONTH_LABELS.map((month) => ({ month, revenue: 0 })),
  };

  try {
    const supabase = await createClient();
    const company = await getCurrentCompanyForAction();

    if (!company) return null;

    const cachedStats = await getCached<DashboardStats>(dashboardCacheKey(company.id));
    if (cachedStats) return cachedStats;

    // Début du mois en cours
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Requêtes sécurisées via Promise.allSettled
    const [
      quotesRes,
      invoicesRes,
      recentQuotesRes,
      recentInvoicesRes,
      financialInvoicesRes,
      receivablesRes,
    ] = await Promise.allSettled([
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .neq("status", "cancelled")
        .gte("created_at", startOfMonth.toISOString()),

      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .neq("status", "cancelled")
        .gte("created_at", startOfMonth.toISOString()),

      supabase
        .from("quotes")
        .select("id, quote_number, total, status, created_at, client:clients(name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("invoices")
        .select("id, invoice_number, total, status, created_at, client:clients(name)")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("invoices")
        .select("id, total, status, created_at")
        .eq("company_id", company.id)
        .lte("created_at", new Date().toISOString()),

      supabase
        .from("receivables")
        .select(
          "invoice_id, total_amount, paid_amount, remaining_amount, status, payment_transactions(amount, payment_date)"
        )
        .eq("company_id", company.id),
    ]);

    const quotesCount = quotesRes.status === "fulfilled" ? (quotesRes.value.count ?? 0) : 0;
    const invoicesCount = invoicesRes.status === "fulfilled" ? (invoicesRes.value.count ?? 0) : 0;

    const recentQuotesRaw =
      recentQuotesRes.status === "fulfilled" ? (recentQuotesRes.value.data ?? []) : [];
    const recentInvoicesRaw =
      recentInvoicesRes.status === "fulfilled" ? (recentInvoicesRes.value.data ?? []) : [];

    const financialInvoices =
      financialInvoicesRes.status === "fulfilled" ? (financialInvoicesRes.value.data ?? []) : [];

    const receivables =
      receivablesRes.status === "fulfilled" ? (receivablesRes.value.data ?? []) : [];

    const {
      totalRevenue,
      unpaidAmount,
      unpaidCount,
      monthlyRevenue: monthlyTotals,
    } = summarizeInvoiceFinancials(
      financialInvoices as Array<{
        id: string;
        total: number;
        status: string;
        created_at: string;
      }>,
      receivables as Array<{
        invoice_id: string;
        total_amount: number;
        paid_amount: number;
        remaining_amount: number;
        status: string;
        payment_transactions?: Array<{ amount: number; payment_date: string }>;
      }>,
      new Date().getFullYear()
    );

    const monthlyRevenue = MONTH_LABELS.map((month, i) => ({
      month,
      revenue: monthlyTotals[i],
    }));

    type RawDoc = {
      id: string;
      total: number;
      status: string;
      created_at: string;
      client: { name: string } | null;
      quote_number?: string;
      invoice_number?: string;
      receivable?: {
        paid_amount: number;
        remaining_amount: number;
        status: string;
      };
    };

    const stats: DashboardStats = {
      quotesCount,
      invoicesCount,
      totalRevenue,
      unpaidAmount,
      unpaidCount,
      recentQuotes: (recentQuotesRaw as unknown as RawDoc[]).map((q) => ({
        id: q.id,
        quote_number: q.quote_number || "DEV-???",
        total: q.total || 0,
        status: q.status || "draft",
        created_at: q.created_at || new Date().toISOString(),
        client_name: q.client?.name ?? "—",
      })),
      recentInvoices: (recentInvoicesRaw as unknown as RawDoc[]).map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number || "FAC-???",
        total: inv.total || 0,
        ...getRecentInvoiceFinance(
          {
            id: inv.id,
            total: inv.total || 0,
            status: inv.status || "draft",
            created_at: inv.created_at || new Date().toISOString(),
          },
          (
            receivables as Array<{
              invoice_id: string;
              total_amount: number;
              paid_amount: number;
              remaining_amount: number;
              status: string;
            }>
          ).find((receivable) => receivable.invoice_id === inv.id)
        ),
        created_at: inv.created_at || new Date().toISOString(),
        client_name: inv.client?.name ?? "—",
      })),
      monthlyRevenue,
    };
    await setCached(dashboardCacheKey(company.id), stats, 30);
    return stats;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("Erreur lors de la récupération des stats du dashboard:", error);
    return emptyStats;
  }
}
