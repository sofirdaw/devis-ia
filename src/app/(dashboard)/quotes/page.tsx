/**
 * Page Liste des Devis — Server Component
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { QuotesTable } from "@/components/documents/QuotesTable";
import type { Quote } from "@/types";

export default async function QuotesPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  // Jointure avec le client pour afficher son nom directement
  const { data: quotes } = await supabase
    .from("quotes")
    .select("*, client:clients(*)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header
        title="Devis"
        description="Gérez vos devis et suivez leur statut"
      />
      <div className="page-container">
        <QuotesTable quotes={(quotes as Quote[]) ?? []} />
      </div>
    </>
  );
}
