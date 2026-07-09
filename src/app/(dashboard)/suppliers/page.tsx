/**
 * Page Liste des Fournisseurs
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { SuppliersTable } from "@/components/documents/SuppliersTable";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Supplier } from "@/types";

export default async function SuppliersPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("company_id", company.id)
    .order("name");

  return (
    <>
      <Header
        title="Fournisseurs"
        description="Gérez vos fournisseurs et leurs informations de contact"
      />
      <div className="page-container max-w-6xl">
        <div className="flex justify-end mb-6">
          <Link href="/suppliers/new">
            <Button leftIcon={<Plus size={16} />}>Nouveau fournisseur</Button>
          </Link>
        </div>
        <SuppliersTable suppliers={(suppliers as Supplier[]) ?? []} />
      </div>
    </>
  );
}
