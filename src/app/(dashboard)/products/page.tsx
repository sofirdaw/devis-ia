/**
 * Page Produits — Server Component résilient hors-ligne
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
  let products: Product[] = [];
  let suppliers: Supplier[] = [];

  try {
    const supabase = await createClient();
    const [prodRes, suppRes] = await Promise.allSettled([
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

    if (prodRes.status === "fulfilled" && prodRes.value.data) {
      products = prodRes.value.data as Product[];
    }
    if (suppRes.status === "fulfilled" && suppRes.value.data) {
      suppliers = suppRes.value.data as Supplier[];
    }
  } catch {
    // Mode hors-ligne
  }

  return (
    <>
      <Header
        title="Produits & Services"
        description={`${products.length} produit${products.length > 1 ? "s" : ""} dans le catalogue`}
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
          initialProducts={products}
          suppliers={suppliers}
        />
      </div>
    </>
  );
}
