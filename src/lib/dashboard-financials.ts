type InvoiceRow = {
  id: string;
  total: number;
  status: string;
  created_at: string;
};

type ReceivableRow = {
  invoice_id: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  payment_transactions?: Array<{ amount: number; payment_date: string }>;
};

export type RecentInvoiceFinance = {
  status: string;
  paid_amount: number;
  remaining_amount: number;
};

export function getRecentInvoiceFinance(
  invoice: InvoiceRow,
  receivable?: ReceivableRow
): RecentInvoiceFinance {
  const cancelled = invoice.status === "cancelled" || receivable?.status === "cancelled";
  const total = Number(invoice.total) || 0;
  const paid = cancelled
    ? 0
    : receivable
      ? Number(receivable.paid_amount) || 0
      : invoice.status === "paid"
        ? total
        : 0;
  const remaining = cancelled
    ? 0
    : receivable
      ? Math.max(0, Number(receivable.remaining_amount) || 0)
      : invoice.status === "paid"
        ? 0
        : invoice.status === "sent" || invoice.status === "overdue"
          ? total
          : 0;

  const status = cancelled
    ? "cancelled"
    : remaining === 0 && paid > 0
      ? "paid"
      : paid > 0
        ? "partial"
        : invoice.status;

  return { status, paid_amount: paid, remaining_amount: remaining };
}

export function summarizeInvoiceFinancials(
  invoices: InvoiceRow[],
  receivables: ReceivableRow[],
  year: number
) {
  const receivablesByInvoice = new Map(receivables.map((item) => [item.invoice_id, item]));
  const months = new Array<number>(12).fill(0);
  let totalRevenue = 0;
  let unpaidAmount = 0;
  let unpaidCount = 0;

  for (const invoice of invoices) {
    const receivable = receivablesByInvoice.get(invoice.id);
    const summary = getRecentInvoiceFinance(invoice, receivable);
    if (summary.status === "cancelled") continue;

    totalRevenue += summary.paid_amount;
    if (summary.remaining_amount > 0) {
      unpaidAmount += summary.remaining_amount;
      unpaidCount += 1;
    }

    const payments = receivable?.payment_transactions ?? [];
    let recordedPayments = 0;
    for (const payment of payments) {
      const amount = Number(payment.amount) || 0;
      recordedPayments += amount;
      const paymentDate = new Date(payment.payment_date);
      if (Number.isFinite(paymentDate.getTime()) && paymentDate.getFullYear() === year) {
        months[paymentDate.getMonth()] += amount;
      }
    }

    const unrecordedRevenue = Math.max(0, summary.paid_amount - recordedPayments);
    const invoiceDate = new Date(invoice.created_at);
    if (
      unrecordedRevenue > 0 &&
      Number.isFinite(invoiceDate.getTime()) &&
      invoiceDate.getFullYear() === year
    ) {
      months[invoiceDate.getMonth()] += unrecordedRevenue;
    }
  }

  return { totalRevenue, unpaidAmount, unpaidCount, monthlyRevenue: months };
}
