/**
 * Page Clients — Server Component résilient hors-ligne
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { ClientsTable } from "@/components/clients/ClientsTable";
import type { Client } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ClientsPage() {
  const company = await requireCurrentCompany();
  let clients: Client[] = [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });
    if (data) clients = data as Client[];
  } catch {
    // Mode hors-ligne
  }

  return (
    <>
      <Header
        title="Clients"
        description={`${clients.length} client${clients.length > 1 ? "s" : ""} enregistré${clients.length > 1 ? "s" : ""}`}
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
        <ClientsTable initialClients={clients} />
      </div>
    </>
  );
}
