/**
 * Page Nouveau Fournisseur
 */

import { Header } from "@/components/layout";
import { SupplierForm } from "@/components/documents/SupplierForm";

export default function NewSupplierPage() {
  return (
    <>
      <Header
        title="Nouveau fournisseur"
        description="Ajoutez un nouveau fournisseur à votre base"
      />
      <div className="page-container">
        <SupplierForm />
      </div>
    </>
  );
}
