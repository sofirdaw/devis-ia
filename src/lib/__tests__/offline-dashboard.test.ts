import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "../offline-db";
import { buildOfflineDashboardStats } from "../offline-dashboard";

describe("offline dashboard aggregation", () => {
  it("calculates period counts, revenue, unpaid amounts and recent documents from the snapshot", () => {
    const now = new Date(2026, 9, 7, 12);
    const thisMonth = new Date(2026, 9, 2, 12).toISOString();
    const laterThisMonth = new Date(2026, 9, 3, 12).toISOString();
    const lastMonth = new Date(2026, 8, 28, 12).toISOString();
    const data = {
      quotes: [
        {
          id: "q-old",
          company_id: "company",
          client_id: "client",
          quote_number: "DEV-OLD",
          status: "draft",
          subtotal: 100,
          tax: 0,
          discount: 0,
          total: 100,
          notes: null,
          valid_until: null,
          created_at: lastMonth,
        },
        {
          id: "q-new",
          company_id: "company",
          client_id: "client",
          quote_number: "DEV-NEW",
          status: "sent",
          subtotal: 200,
          tax: 0,
          discount: 0,
          total: 200,
          notes: null,
          valid_until: null,
          created_at: thisMonth,
        },
        {
          id: "q-cancelled",
          company_id: "company",
          client_id: "client",
          quote_number: "DEV-CANCELLED",
          status: "cancelled",
          subtotal: 999,
          tax: 0,
          discount: 0,
          total: 999,
          notes: null,
          valid_until: null,
          created_at: thisMonth,
        },
      ],
      invoices: [
        {
          id: "i-paid",
          company_id: "company",
          client_id: "client",
          invoice_number: "FAC-PAID",
          status: "paid",
          subtotal: 400,
          tax: 0,
          discount: 0,
          total: 400,
          notes: null,
          due_date: null,
          created_at: thisMonth,
        },
        {
          id: "i-unpaid",
          company_id: "company",
          client_id: "client",
          invoice_number: "FAC-UNPAID",
          status: "sent",
          subtotal: 755,
          tax: 0,
          discount: 0,
          total: 755,
          notes: null,
          due_date: null,
          created_at: laterThisMonth,
        },
        {
          id: "i-cancelled",
          company_id: "company",
          client_id: "client",
          invoice_number: "FAC-CANCELLED",
          status: "cancelled",
          subtotal: 999,
          tax: 0,
          discount: 0,
          total: 999,
          notes: null,
          due_date: null,
          created_at: laterThisMonth,
        },
      ],
      receivables: [
        {
          id: "r-paid",
          company_id: "company",
          invoice_id: "i-paid",
          client_id: "client",
          total_amount: 400,
          paid_amount: 400,
          remaining_amount: 0,
          status: "paid",
          due_date: null,
          created_at: thisMonth,
          updated_at: thisMonth,
          payment_transactions: [
            {
              id: "p-paid",
              receivable_id: "r-paid",
              amount: 400,
              payment_method: "cash",
              payment_date: thisMonth,
              reference: null,
              notes: null,
              created_at: thisMonth,
            },
          ],
        },
        {
          id: "r-partial",
          company_id: "company",
          invoice_id: "i-unpaid",
          client_id: "client",
          total_amount: 755,
          paid_amount: 700,
          remaining_amount: 55,
          status: "partial",
          due_date: null,
          created_at: laterThisMonth,
          updated_at: laterThisMonth,
          payment_transactions: [
            {
              id: "p-partial",
              receivable_id: "r-partial",
              amount: 700,
              payment_method: "cash",
              payment_date: laterThisMonth,
              reference: null,
              notes: null,
              created_at: laterThisMonth,
            },
          ],
        },
        {
          id: "r-cancelled",
          company_id: "company",
          invoice_id: "i-cancelled",
          client_id: "client",
          total_amount: 999,
          paid_amount: 999,
          remaining_amount: 0,
          status: "cancelled",
          due_date: null,
          created_at: laterThisMonth,
          updated_at: laterThisMonth,
          payment_transactions: [
            {
              id: "p-cancelled",
              receivable_id: "r-cancelled",
              amount: 999,
              payment_method: "cash",
              payment_date: laterThisMonth,
              reference: null,
              notes: null,
              created_at: laterThisMonth,
            },
          ],
        },
      ],
    } satisfies Pick<OfflineSnapshot, "quotes" | "invoices" | "receivables">;

    const stats = buildOfflineDashboardStats(data, now);

    expect(stats.quotesCount).toBe(1);
    expect(stats.invoicesCount).toBe(2);
    expect(stats.totalRevenue).toBe(1100);
    expect(stats.unpaidAmount).toBe(55);
    expect(stats.unpaidCount).toBe(1);
    expect(stats.recentQuotes[0]?.quote_number).toBe("DEV-NEW");
    expect(stats.recentInvoices[0]?.invoice_number).toBe("FAC-UNPAID");
    expect(stats.monthlyRevenue[9]?.revenue).toBe(1100);
    expect(stats.recentInvoices[0]?.status).toBe("partial");
    expect(stats.recentInvoices[0]?.total).toBe(755);
    expect(stats.recentInvoices[0]?.paid_amount).toBe(700);
    expect(stats.recentInvoices[0]?.remaining_amount).toBe(55);
    expect(
      stats.recentInvoices.find((invoice) => invoice.invoice_number === "FAC-CANCELLED")
    ).toMatchObject({ status: "cancelled", paid_amount: 0, remaining_amount: 0 });
  });

  it("returns valid zero metrics for an empty local snapshot", () => {
    const stats = buildOfflineDashboardStats({ quotes: [], invoices: [], receivables: [] });

    expect(stats.quotesCount).toBe(0);
    expect(stats.invoicesCount).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.unpaidAmount).toBe(0);
    expect(stats.unpaidCount).toBe(0);
    expect(stats.monthlyRevenue).toHaveLength(12);
  });
});
