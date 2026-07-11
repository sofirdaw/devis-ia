/**
 * Page Édition Fournisseur
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import { SupplierForm } from "@/components/documents/SupplierForm";
import type { Supplier } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .single();

  if (!supplier) notFound();

  return (
    <>
      <Header
        title={`Modifier ${supplier.name}`}
        description="Modifiez les informations du fournisseur"
        actions={
          <Link href={`/suppliers/${id}`}>
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
      <div className="page-container max-w-2xl">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8">
          <SupplierForm supplier={supplier as Supplier} />
        </div>
      </div>
    </>
  );
}
