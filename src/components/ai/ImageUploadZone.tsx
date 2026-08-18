/**
 * ImageUploadZone — Zone de sélection de photo / document manuscrit
 * Avec optimisation et compression Canvas automatique côté client pour l'OCR Vision
 */

"use client";

import { useState, useRef, type DragEvent } from "react";
import { Camera, Upload, X, FileImage } from "lucide-react";

interface ImageUploadZoneProps {
  onImageReady: (base64: string) => void;
  disabled?: boolean;
}

// Compression et redimensionnement Canvas pour l'OCR IA
function optimizeImageForOCR(file: File, maxDimension: number = 1400, quality: number = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        // Amélioration de la netteté
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Export en JPEG optimisé pour les API Vision
        const optimizedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(optimizedBase64);
      };
      img.onerror = () => reject(new Error("Impossible de charger l'image"));
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsDataURL(file);
  });
}

export function ImageUploadZone({
  onImageReady,
  disabled,
}: ImageUploadZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    try {
      setIsProcessing(true);
      // Compression et optimisation automatique
      const optimizedBase64 = await optimizeImageForOCR(file, 1400, 0.88);
      setPreview(optimizedBase64);
      onImageReady(optimizedBase64);
    } catch (err) {
      console.error("Erreur optimisation image:", err);
      // Fallback vers lecture directe
      const reader = new FileReader();
      reader.onload = () => {
        const rawBase64 = reader.result as string;
        setPreview(rawBase64);
        onImageReady(rawBase64);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const clearImage = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (preview) {
    return (
      <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 shadow-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="Aperçu du document"
          className="w-full max-h-80 object-contain"
        />
        {!disabled && (
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 bg-white/90 hover:bg-white p-2.5 rounded-full shadow-md transition-colors"
            aria-label="Retirer l'image"
          >
            <X size={16} className="text-gray-700" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !isProcessing && fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl py-8 sm:py-12 px-4 sm:px-6 text-center cursor-pointer transition-all ${
        isDragging
          ? "border-primary-500 bg-primary-50/50 scale-[1.01]"
          : "border-gray-300 hover:border-primary-400 hover:bg-gray-50"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled || isProcessing}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />
      <div className="flex justify-center gap-2 mb-3">
        <Camera size={26} className="text-primary-500" />
        <Upload size={26} className="text-gray-400" />
        <FileImage size={26} className="text-primary-400" />
      </div>
      <p className="text-sm font-semibold text-gray-800">
        {isProcessing ? "Optimisation de la photo en cours..." : "Prenez une photo ou glissez un document"}
      </p>
      <p className="text-xs text-gray-500 mt-1.5 max-w-sm mx-auto">
        Facture papier, note manuscrite, bon de commande, devis rédigé à la main... — JPG, PNG
      </p>
    </div>
  );
}
