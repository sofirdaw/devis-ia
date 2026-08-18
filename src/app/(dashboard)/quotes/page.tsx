/**
 * Page Liste des Devis — Server Component résilient hors-ligne
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { QuotesTable } from "@/components/documents/QuotesTable";
import type { Quote } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function QuotesPage() {
  const company = await requireCurrentCompany();
  let quotes: Quote[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("quotes")
      .select("*, client:clients(*)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (data) quotes = data as Quote[];
  } catch {
    // Mode hors-ligne
  }

  return (
    <>
      <Header
        title="Devis"
        description="Gérez vos devis et suivez leur statut"
        actions={
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
              className="flex sm:hidden"
            >
              Retour
            </Button>
          </Link>
        }
      />
      <div className="page-container">
        <QuotesTable quotes={quotes} />
      </div>
    </>
  );
}
