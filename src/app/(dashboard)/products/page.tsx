/**
 * Page Produits — Server Component
 */

import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { ProductsTable } from "@/components/products/ProductsTable";
import type { Product, Supplier } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ProductsPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase
      .from("products")
      .select("*, supplier:suppliers(*)")
      .eq("company_id", company.id)
      .order("name"),
    supabase
      .from("suppliers")
      .select("*")
      .eq("company_id", company.id)
      .order("name"),
  ]);

  return (
    <>
      <Header
        title="Produits & Services"
        description={`${products?.length ?? 0} produit${(products?.length ?? 0) > 1 ? "s" : ""} dans le catalogue`}
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
        <ProductsTable
          initialProducts={(products as Product[]) ?? []}
          suppliers={(suppliers as Supplier[]) ?? []}
        />
      </div>
    </>
  );
}
