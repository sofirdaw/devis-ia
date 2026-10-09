"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import type { OfflineSnapshot } from "@/lib/offline-db";

type OfflineSnapshotResult = {
  snapshot?: OfflineSnapshot;
  error?: string;
};

export async function getOfflineSnapshotAction(): Promise<OfflineSnapshotResult> {
  const company = await getCurrentCompanyForAction();
  if (!company) return { error: "Entreprise introuvable" };

  const supabase = await createClient();
  const [clients, products, suppliers, quotes, invoices, receivables] = await Promise.all([
    supabase.from("clients").select("*").eq("company_id", company.id),
    supabase.from("products").select("*, supplier:suppliers(*)").eq("company_id", company.id),
    supabase.from("suppliers").select("*").eq("company_id", company.id),
    supabase
      .from("quotes")
      .select("*, client:clients(*), quote_items(*)")
      .eq("company_id", company.id),
    supabase
      .from("invoices")
      .select("*, client:clients(*), invoice_items(*)")
      .eq("company_id", company.id),
    supabase
      .from("receivables")
      .select("*, client:clients(*), invoice:invoices(*)")
      .eq("company_id", company.id),
  ]);

  const queryError =
    clients.error ??
    products.error ??
    suppliers.error ??
    quotes.error ??
    invoices.error ??
    receivables.error;
  if (queryError) {
    console.error("Erreur de chargement du snapshot hors-ligne:", queryError.message);
    return { error: "Impossible de télécharger les données pour le mode hors-ligne." };
  }

  const receivableRows = receivables.data ?? [];
  const receivableIds = receivableRows.map((receivable) => receivable.id);
  const payments =
    receivableIds.length > 0
      ? await supabase.from("payment_transactions").select("*").in("receivable_id", receivableIds)
      : { data: [], error: null };

  if (payments.error) {
    console.error("Erreur de chargement des paiements hors-ligne:", payments.error.message);
    return { error: "Impossible de télécharger l'historique des paiements." };
  }

  const paymentRows = payments.data ?? [];
  const snapshot: OfflineSnapshot = {
    company_id: company.id,
    fetched_at: new Date().toISOString(),
    clients: (clients.data ?? []) as OfflineSnapshot["clients"],
    products: (products.data ?? []) as OfflineSnapshot["products"],
    suppliers: (suppliers.data ?? []) as OfflineSnapshot["suppliers"],
    quotes: (quotes.data ?? []) as OfflineSnapshot["quotes"],
    invoices: (invoices.data ?? []) as OfflineSnapshot["invoices"],
    receivables: receivableRows.map((receivable) => ({
      ...receivable,
      payment_transactions: paymentRows.filter(
        (payment) => payment.receivable_id === receivable.id
      ),
    })) as OfflineSnapshot["receivables"],
  };

  return { snapshot };
}
