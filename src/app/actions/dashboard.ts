/**
 * Server Actions — Statistiques du Dashboard
 *
 * Centralise toutes les requêtes d'agrégation pour la page d'accueil.
 * Sécurisé pour éviter tout crash (500) en cas d'erreur réseau ou Supabase.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";

export type DashboardStats = {
  quotesCount: number;
  invoicesCount: number;
  totalRevenue: number; // Somme des factures payées
  unpaidAmount: number; // Somme des factures envoyées + en retard
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

    // Début du mois en cours
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Requêtes sécurisées via Promise.allSettled
    const [
      quotesRes,
      invoicesRes,
      paidInvoicesRes,
      unpaidInvoicesRes,
      recentQuotesRes,
      recentInvoicesRes,
      yearInvoicesRes,
    ] = await Promise.allSettled([
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .gte("created_at", startOfMonth.toISOString()),

      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .gte("created_at", startOfMonth.toISOString()),

      supabase.from("invoices").select("total").eq("company_id", company.id).eq("status", "paid"),

      supabase
        .from("invoices")
        .select("total")
        .eq("company_id", company.id)
        .in("status", ["sent", "overdue"]),

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
        .select("total, created_at")
        .eq("company_id", company.id)
        .gte("created_at", `${new Date().getFullYear()}-01-01`),
    ]);

    const quotesCount = quotesRes.status === "fulfilled" ? (quotesRes.value.count ?? 0) : 0;
    const invoicesCount = invoicesRes.status === "fulfilled" ? (invoicesRes.value.count ?? 0) : 0;

    const paidInvoices =
      paidInvoicesRes.status === "fulfilled" ? (paidInvoicesRes.value.data ?? []) : [];
    const unpaidInvoices =
      unpaidInvoicesRes.status === "fulfilled" ? (unpaidInvoicesRes.value.data ?? []) : [];

    const recentQuotesRaw =
      recentQuotesRes.status === "fulfilled" ? (recentQuotesRes.value.data ?? []) : [];
    const recentInvoicesRaw =
      recentInvoicesRes.status === "fulfilled" ? (recentInvoicesRes.value.data ?? []) : [];

    const yearInvoices =
      yearInvoicesRes.status === "fulfilled" ? (yearInvoicesRes.value.data ?? []) : [];

    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

    const monthlyTotals = new Array(12).fill(0);
    yearInvoices.forEach((inv) => {
      if (inv.created_at) {
        const monthIndex = new Date(inv.created_at).getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyTotals[monthIndex] += inv.total || 0;
        }
      }
    });

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
    };

    return {
      quotesCount,
      invoicesCount,
      totalRevenue,
      unpaidAmount,
      unpaidCount: unpaidInvoices.length,
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
        status: inv.status || "draft",
        created_at: inv.created_at || new Date().toISOString(),
        client_name: inv.client?.name ?? "—",
      })),
      monthlyRevenue,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    console.error("Erreur lors de la récupération des stats du dashboard:", error);
    return emptyStats;
  }
}
