/**
 * Page Détail Fournisseur
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentCompany } from "@/lib/current-company";
import { Header } from "@/components/layout";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Pencil, Phone, Mail, MapPin, ArrowLeft } from "lucide-react";
import type { Supplier } from "@/types";

export default async function SupplierDetailPage({
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

  const typedSupplier = supplier as Supplier;

  return (
    <>
      <Header title={typedSupplier.name} description="Détails du fournisseur" />
      <div className="page-container max-w-3xl">
        <div className="mb-4">
          <Link href="/suppliers">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={14} />}
            >
              Retour aux fournisseurs
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations de contact
              </h3>
              <div className="space-y-3">
                {typedSupplier.phone && (
                  <div className="flex items-center gap-3 text-gray-600 min-w-0">
                    <Phone size={18} className="text-gray-400 shrink-0" />
                    <span className="break-words">{typedSupplier.phone}</span>
                  </div>
                )}
                {typedSupplier.email && (
                  <div className="flex items-center gap-3 text-gray-600 min-w-0">
                    <Mail size={18} className="text-gray-400 shrink-0" />
                    <span className="break-words">{typedSupplier.email}</span>
                  </div>
                )}
                {typedSupplier.address && (
                  <div className="flex items-start gap-3 text-gray-600 min-w-0">
                    <MapPin
                      size={18}
                      className="text-gray-400 shrink-0 mt-0.5"
                    />
                    <span className="break-words">{typedSupplier.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <Link href={`/suppliers/${typedSupplier.id}/edit`}>
                <Button leftIcon={<Pencil size={14} />}>Modifier</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
