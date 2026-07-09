/**
 * Server Actions — Statistiques du Dashboard
 *
 * Centralise toutes les requêtes d'agrégation pour la page d'accueil.
 * Une seule fonction qui retourne tout, pour éviter les multiples
 * appels réseau séquentiels dans le composant page.
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
  const supabase = await createClient();

  const company = await getCurrentCompanyForAction();

  if (!company) return null;

  // Début du mois en cours (pour le compteur "ce mois")
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // ── Requêtes en parallèle pour la performance ────────────────────────────────
  const [
    { count: quotesCount },
    { count: invoicesCount },
    { data: paidInvoices },
    { data: unpaidInvoices },
    { data: recentQuotesRaw },
    { data: recentInvoicesRaw },
    { data: yearInvoices },
  ] = await Promise.all([
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

    supabase
      .from("invoices")
      .select("total")
      .eq("company_id", company.id)
      .eq("status", "paid"),

    supabase
      .from("invoices")
      .select("total")
      .eq("company_id", company.id)
      .in("status", ["sent", "overdue"]),

    supabase
      .from("quotes")
      .select(
        "id, quote_number, total, status, created_at, client:clients(name)",
      )
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("invoices")
      .select(
        "id, invoice_number, total, status, created_at, client:clients(name)",
      )
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(5),

    // Factures de l'année en cours, pour le graphique mensuel (tous les statuts)
    supabase
      .from("invoices")
      .select("total, created_at")
      .eq("company_id", company.id)
      .gte("created_at", `${new Date().getFullYear()}-01-01`),
  ]);

  const totalRevenue = (paidInvoices ?? []).reduce(
    (sum, inv) => sum + inv.total,
    0,
  );
  const unpaidAmount = (unpaidInvoices ?? []).reduce(
    (sum, inv) => sum + inv.total,
    0,
  );

  // ── Construction du graphique mensuel (12 mois, même les mois à 0) ────────────
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
  const monthlyTotals = new Array(12).fill(0);

  (yearInvoices ?? []).forEach((inv) => {
    const monthIndex = new Date(inv.created_at).getMonth();
    monthlyTotals[monthIndex] += inv.total;
  });

  const monthlyRevenue = MONTH_LABELS.map((month, i) => ({
    month,
    revenue: monthlyTotals[i],
  }));

  // Type helper pour les jointures client (Supabase retourne un objet, pas un tableau, pour les relations 1:1)
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
    quotesCount: quotesCount ?? 0,
    invoicesCount: invoicesCount ?? 0,
    totalRevenue,
    unpaidAmount,
    unpaidCount: (unpaidInvoices ?? []).length,
    recentQuotes: ((recentQuotesRaw as unknown as RawDoc[]) ?? []).map((q) => ({
      id: q.id,
      quote_number: q.quote_number!,
      total: q.total,
      status: q.status,
      created_at: q.created_at,
      client_name: q.client?.name ?? "—",
    })),
    recentInvoices: ((recentInvoicesRaw as unknown as RawDoc[]) ?? []).map(
      (inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number!,
        total: inv.total,
        status: inv.status,
        created_at: inv.created_at,
        client_name: inv.client?.name ?? "—",
      }),
    ),
    monthlyRevenue,
  };
}
