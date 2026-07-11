/**
 * Page Créances — Server Component
 *
 * Récupère la liste des créances côté serveur
 * puis délègue l'interactivité au composant client ReceivablesTable.
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
  const supabase = await createClient();

  // Récupérer toutes les créances avec les infos client et facture
  const { data: receivables } = await supabase
    .from("receivables")
    .select("*, client:clients(*), invoice:invoices(*)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header
        title="Créances"
        description={`${receivables?.length ?? 0} créance${(receivables?.length ?? 0) > 1 ? "s" : ""} enregistrée${(receivables?.length ?? 0) > 1 ? "s" : ""}`}
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
          initialReceivables={(receivables as Receivable[]) ?? []}
        />
      </div>
    </>
  );
}
