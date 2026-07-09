/**
 * LogoUploadForm — Upload et aperçu du logo de l'entreprise
 *
 * Utilise une Server Action appelée manuellement (pas useActionState car
 * elle prend un FormData natif avec fichier, pas de validation Zod complexe ici).
 */

"use client";

import { useState, useRef, useTransition } from "react";
import { Building2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from "@/components/ui/card";
import { uploadCompanyLogoAction } from "@/app/actions/company";

interface LogoUploadFormProps {
  companyId: string;
  currentLogoUrl: string | null;
}

export function LogoUploadForm({
  companyId,
  currentLogoUrl,
}: LogoUploadFormProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Aperçu local immédiat avant l'upload
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setError(null);
    setSuccess(false);

    // Upload réel vers Supabase Storage
    const formData = new FormData();
    formData.append("logo", file);

    startTransition(async () => {
      const result = await uploadCompanyLogoAction(companyId, formData);

      if (result.error) {
        setError(result.error);
        setPreview(currentLogoUrl); // Revenir à l'ancien logo en cas d'échec
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 lg:p-8">
        <CardTitle>Logo de l'entreprise</CardTitle>
        <CardDescription>
          Apparaît en haut de vos devis et factures PDF
        </CardDescription>
      </CardHeader>

      <CardBody className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
          {/* Aperçu du logo */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Logo de l'entreprise"
                className="w-full h-full object-contain"
              />
            ) : (
              <Building2 size={28} className="text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={isPending}
            />
            <Button
              type="button"
              variant="outline"
              leftIcon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              isLoading={isPending}
            >
              {preview ? "Changer le logo" : "Ajouter un logo"}
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              PNG ou JPG, 2 Mo maximum
            </p>

            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2">
                <AlertCircle size={12} />
                {error}
              </p>
            )}
            {success && (
              <p className="flex items-center gap-1.5 text-xs text-green-600 mt-2">
                <CheckCircle2 size={12} />
                Logo mis à jour
              </p>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
