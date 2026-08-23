/**
 * Page Nouveau Devis — Server Component sécurisé pour le mode hors-ligne
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { QuoteForm } from "@/components/documents/QuoteForm";
import type { Client, Product } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewQuotePage() {
  const company = await requireCurrentCompany();

  let clients: Client[] = [];
  let products: Product[] = [];

  try {
    const supabase = await createClient();
    const [clientsRes, productsRes] = await Promise.allSettled([
      supabase.from("clients").select("*").eq("company_id", company.id).order("name"),
      supabase.from("products").select("*").eq("company_id", company.id).order("name"),
    ]);

    if (clientsRes.status === "fulfilled" && clientsRes.value.data) {
      clients = clientsRes.value.data as Client[];
    }
    if (productsRes.status === "fulfilled" && productsRes.value.data) {
      products = productsRes.value.data as Product[];
    }
  } catch {
    console.warn("Mode hors-ligne : utilisation des listes vides pour nouveau devis");
  }

  return (
    <>
      <Header
        title="Nouveau devis"
        description="Créez un devis manuellement"
        actions={
          <Link href="/quotes">
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
        <QuoteForm
          clients={clients}
          products={products}
          taxRate={company?.tax_rate ?? 0}
          defaultNotes={company?.default_quote_notes ?? ""}
        />
      </div>
    </>
  );
}
