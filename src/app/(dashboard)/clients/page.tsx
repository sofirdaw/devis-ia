/**
 * Page Clients — Server Component
 *
 * Récupère la liste des clients côté serveur (rapide, SEO-friendly)
 * puis délègue l'interactivité (recherche, modales) au composant client ClientsTable.
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { ClientsTable } from "@/components/clients/ClientsTable";
import type { Client } from "@/types";

export default async function ClientsPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  // Récupérer tous les clients de cette entreprise, triés par date d'ajout
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Header
        title="Clients"
        description={`${clients?.length ?? 0} client${(clients?.length ?? 0) > 1 ? "s" : ""} enregistré${(clients?.length ?? 0) > 1 ? "s" : ""}`}
      />
      <div className="page-container">
        <ClientsTable initialClients={(clients as Client[]) ?? []} />
      </div>
    </>
  );
}
