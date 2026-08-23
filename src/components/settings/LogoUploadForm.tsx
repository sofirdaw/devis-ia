/**
 * LogoUploadForm — Upload et aperçu du logo de l'entreprise
 * Avec compression d'image côté client et mise à jour instantanée du store
 */

"use client";

import { useState, useRef, useTransition } from "react";
import { Building2, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from "@/components/ui/card";
import { uploadCompanyLogoAction } from "@/app/actions/company";
import { useAuthStore } from "@/store/auth.store";

interface LogoUploadFormProps {
  companyId: string;
  currentLogoUrl: string | null;
}

// Fonction de compression d'image côté client (Canvas)
async function compressImageFile(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.85
): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressed);
            } else {
              resolve(file);
            }
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export function LogoUploadForm({ companyId, currentLogoUrl }: LogoUploadFormProps) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { company, setCompany } = useAuthStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    // Aperçu local immédiat avant l'upload
    const localPreview = URL.createObjectURL(rawFile);
    setPreview(localPreview);
    setError(null);
    setSuccess(false);

    // Compression ultra-rapide côté client
    const file = await compressImageFile(rawFile, 800, 0.85);

    // Convertir en Data URL Base64 pour persistance 100% hors-ligne dans localStorage
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64DataUrl = reader.result as string;
      setPreview(base64DataUrl);
      if (company) {
        setCompany({
          ...company,
          logo_url: base64DataUrl,
        });
      }
    };

    // Si connecté, synchroniser vers Supabase Storage en arrière-plan
    const isOnline = typeof window !== "undefined" && navigator.onLine;
    if (isOnline) {
      const formData = new FormData();
      formData.append("logo", file);

      startTransition(async () => {
        try {
          const result = await uploadCompanyLogoAction(companyId, formData);
          if (result.error) {
            // Même si Supabase échoue, le logo local reste sauvegardé
            console.warn("Upload Supabase échoué, logo conservé localement:", result.error);
          } else if ((result as { logoUrl?: string }).logoUrl) {
            if (company) {
              setCompany({
                ...company,
                logo_url: (result as { logoUrl?: string }).logoUrl!,
              });
            }
          }
        } catch {
          // Hors-ligne / réseau instable
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      });
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 lg:p-8">
        <CardTitle>Logo de l&apos;entreprise</CardTitle>
        <CardDescription>
          Apparaît en haut de vos devis et factures PDF, ainsi que dans votre menu
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
                className="w-full h-full object-contain p-1"
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
              PNG, JPG ou WebP (optimisé automatiquement)
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
                Logo mis à jour avec succès
              </p>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
