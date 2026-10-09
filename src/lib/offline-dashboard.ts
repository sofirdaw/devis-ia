import type { DashboardStats } from "@/app/actions/dashboard";
import type { OfflineSnapshot } from "@/lib/offline-db";
import { getRecentInvoiceFinance, summarizeInvoiceFinancials } from "@/lib/dashboard-financials";

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

export function buildOfflineDashboardStats(
  snapshot: Pick<OfflineSnapshot, "quotes" | "invoices" | "receivables">,
  now = new Date()
): DashboardStats {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const finance = summarizeInvoiceFinancials(
    snapshot.invoices,
    snapshot.receivables,
    now.getFullYear()
  );
  const receivablesByInvoice = new Map(
    snapshot.receivables.map((receivable) => [receivable.invoice_id, receivable])
  );

  return {
    quotesCount: snapshot.quotes.filter(
      (quote) => quote.status !== "cancelled" && new Date(quote.created_at) >= startOfMonth
    ).length,
    invoicesCount: snapshot.invoices.filter(
      (invoice) => invoice.status !== "cancelled" && new Date(invoice.created_at) >= startOfMonth
    ).length,
    totalRevenue: finance.totalRevenue,
    unpaidAmount: finance.unpaidAmount,
    unpaidCount: finance.unpaidCount,
    recentQuotes: [...snapshot.quotes]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((quote) => ({
        id: quote.id,
        quote_number: quote.quote_number,
        total: Number(quote.total),
        status: quote.status,
        created_at: quote.created_at,
        client_name: quote.client?.name ?? "—",
      })),
    recentInvoices: [...snapshot.invoices]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((invoice) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total: Number(invoice.total),
        ...getRecentInvoiceFinance(invoice, receivablesByInvoice.get(invoice.id)),
        created_at: invoice.created_at,
        client_name: invoice.client?.name ?? "—",
      })),
    monthlyRevenue: MONTH_LABELS.map((month, index) => ({
      month,
      revenue: finance.monthlyRevenue[index],
    })),
  };
}
