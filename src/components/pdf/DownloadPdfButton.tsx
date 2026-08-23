/**
 * DownloadPdfButton — Bouton de téléchargement/visualisation PDF
 *
 * Ouvre le PDF dans un nouvel onglet (génération à la demande côté serveur).
 * Pas besoin de state de chargement complexe : le navigateur gère l'ouverture.
 */

"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DownloadPdfButtonProps {
  type: "quote" | "invoice";
  documentId: string;
}

export function DownloadPdfButton({ type, documentId }: DownloadPdfButtonProps) {
  const handleOpenPdf = () => {
    const pdfUrl = `/api/pdf/${type}/${documentId}?t=${Date.now()}`;
    window.open(pdfUrl, "_blank");
  };

  return (
    <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={handleOpenPdf}>
      PDF
    </Button>
  );
}
