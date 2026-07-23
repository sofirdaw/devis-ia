/**
 * ImageUploadZone — Zone de glisser-déposer / sélection de photo
 *
 * Convertit l'image en base64 côté client puis la transmet au parent
 * pour l'envoyer à GPT Vision (Server Action).
 */

"use client";

import { useState, useRef, type DragEvent } from "react";
import { Camera, Upload, X } from "lucide-react";

interface ImageUploadZoneProps {
  onImageReady: (base64: string) => void;
  disabled?: boolean;
}

export function ImageUploadZone({
  onImageReady,
  disabled,
}: ImageUploadZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    // Limiter la taille de l'image à 5 Mo pour éviter les erreurs API
    const maxSize = 5 * 1024 * 1024; // 5 Mo
    if (file.size > maxSize) {
      alert("L'image est trop grande. Veuillez utiliser une image de moins de 5 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onImageReady(base64);
    };
    reader.readAsDataURL(file);
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
      <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="Aperçu du document"
          className="w-full max-h-80 object-contain"
        />
        {!disabled && (
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 bg-white/90 hover:bg-white p-2.5 rounded-full shadow-sm transition-colors"
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
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl py-8 sm:py-12 px-4 sm:px-6 text-center cursor-pointer transition-colors ${
        isDragging
          ? "border-blue-400 bg-blue-50"
          : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />
      <div className="flex justify-center gap-2 mb-3">
        <Camera size={24} className="text-gray-400" />
        <Upload size={24} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">
        Glissez une photo ici ou cliquez pour en sélectionner une
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Facture papier, devis manuscrit, note... — JPG, PNG
      </p>
    </div>
  );
}
