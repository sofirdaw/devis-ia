/**
 * Page Créances — Server Component résilient hors-ligne
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { ReceivablesTable } from "@/components/receivables/ReceivablesTable";
import type { Receivable } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ReceivablesPage() {
  const company = await requireCurrentCompany();
  let receivables: Receivable[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("receivables")
      .select("*, client:clients(*), invoice:invoices(*)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (data) receivables = data as Receivable[];
  } catch {
    // Mode hors-ligne
  }

  return (
    <>
      <Header
        title="Créances"
        description={`${receivables.length} créance${receivables.length > 1 ? "s" : ""} enregistrée${receivables.length > 1 ? "s" : ""}`}
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
        <ReceivablesTable
          initialReceivables={receivables}
        />
      </div>
    </>
  );
}
