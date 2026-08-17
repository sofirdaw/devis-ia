/**
 * AIGeneratorPanel — Panneau de génération IA de devis/factures
 *
 * Flux UX :
 * 1. L'utilisateur tape sa description en langage naturel
 * 2. Clic "Générer avec l'IA" → appel Server Action generateDocumentFromText
 * 3. Affichage d'un aperçu éditable (client + lignes pré-remplies)
 * 4. L'utilisateur peut corriger avant de valider définitivement
 * 5. Validation → délègue à QuoteForm/InvoiceForm avec les données pré-remplies
 *
 * Ce composant est partagé entre /quotes/ai et /invoices/ai via la prop `documentType`.
 */

"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Type,
  Camera,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  generateDocumentFromText,
  generateDocumentFromImage,
  type AIExtractionResult,
} from "@/app/actions/ai";
import { QuoteForm } from "@/components/documents/QuoteForm";
import { InvoiceForm } from "@/components/documents/InvoiceForm";
import { ImageUploadZone } from "./ImageUploadZone";
import { VoiceInputButton } from "./VoiceInputButton";
import type { Client, Product } from "@/types";
import type { LineItem } from "@/components/documents/LineItemsEditor";
import { parseDocumentOfflineText } from "@/lib/offline-parser";

interface AIGeneratorPanelProps {
  documentType: "quote" | "invoice";
  clients: Client[];
  products: Product[];
  taxRate: number;
}

const EXAMPLE_PROMPTS = [
  "Devis pour Moussa : 2 caméras solaires à 45000, installation à 10000",
  "Facture pour Ibrahim, 3 HP EliteBook G6 à 250000 et une souris à 5000",
];

export function AIGeneratorPanel({
  documentType,
  clients,
  products,
  taxRate,
}: AIGeneratorPanelProps) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [description, setDescription] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<AIExtractionResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      // Détecter si l'appareil est hors-ligne
      const isOffline = typeof window !== "undefined" && !navigator.onLine;

      if (isOffline && mode === "text") {
        const offlineResult = parseDocumentOfflineText(description, clients, products);
        if (!offlineResult.success || !offlineResult.data) {
          setError(offlineResult.error ?? "Impossible de parser le texte en local");
          return;
        }
        setResult(offlineResult.data);
        return;
      }

      try {
        const response =
          mode === "text"
            ? await generateDocumentFromText(description)
            : imageBase64
              ? await generateDocumentFromImage(imageBase64)
              : {
                  success: false as const,
                  error: "Veuillez sélectionner une image",
                };

        if (!response.success || !response.data) {
          // Fallback automatique si la requête réseau échoue en mode texte
          if (mode === "text") {
            const fallbackResult = parseDocumentOfflineText(description, clients, products);
            if (fallbackResult.success && fallbackResult.data) {
              setResult(fallbackResult.data);
              return;
            }
          }
          setError(response.error ?? "Erreur inconnue");
          return;
        }

        setResult(response.data);
      } catch {
        // En cas d'exception réseau brutale
        if (mode === "text") {
          const fallbackResult = parseDocumentOfflineText(description, clients, products);
          if (fallbackResult.success && fallbackResult.data) {
            setResult(fallbackResult.data);
            return;
          }
        }
        setError("Connexion réseau indisponible. Passez en mode texte pour l'analyse locale.");
      }
    });
  };

  const handleReset = () => {
    setResult(null);
    setDescription("");
    setImageBase64(null);
    setError(null);
  };

  // ── Étape 2 : aperçu généré → afficher le formulaire pré-rempli ─────────────
  if (result) {
    const initialItems: LineItem[] = result.items;
    const FormComponent = documentType === "quote" ? QuoteForm : InvoiceForm;

    return (
      <div className="space-y-4">
        {/* Bannière de confirmation IA */}
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800">
              Document généré ! Vérifiez les informations ci-dessous.
            </p>
            {!result.matchedClientId && (
              <p className="text-xs text-green-700 mt-1">
                Client "{result.clientName}" introuvable — veuillez le
                sélectionner ou le créer manuellement.
              </p>
            )}
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-green-700 hover:text-green-900 font-medium underline shrink-0"
          >
            Recommencer
          </button>
        </div>

        {/* Formulaire pré-rempli, identique au formulaire manuel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8">
          <FormComponent
            clients={clients}
            products={products}
            taxRate={taxRate}
            initialItems={initialItems}
            initialClientId={result.matchedClientId ?? undefined}
            initialNotes={result.notes}
            initialDate={result.date}
          />
        </div>
      </div>
    );
  }

  // ── Étape 1 : zone de saisie (texte ou image) ────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-blue-600" />
        <h2 className="font-semibold text-gray-900">
          Décrivez votre {documentType === "quote" ? "devis" : "facture"}
        </h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Écrivez en langage naturel ou prenez en photo un document existant.
      </p>

      {/* Onglets Texte / Photo */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
        <button
          onClick={() => setMode("text")}
          disabled={isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "text"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Type size={14} />
          Texte
        </button>
        <button
          onClick={() => setMode("image")}
          disabled={isPending}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === "image"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Camera size={14} />
          Photo
        </button>
      </div>

      {mode === "text" ? (
        <>
          <div className="flex justify-end mb-2">
            <VoiceInputButton
              onTranscript={(text) =>
                setDescription((prev) => (prev ? prev + " " + text : text))
              }
              disabled={isPending}
            />
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`Fais un devis ou une facture pour Moussa.\n2 Caméras solaires à 45 000 FCFA\nInstallation à 10 000 FCFA`}

            rows={5}
            disabled={isPending}
          />

          {/* Exemples cliquables pour guider l'utilisateur */}
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                onClick={() => setDescription(example)}
                disabled={isPending}
                className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {example.length > 50 ? example.slice(0, 50) + "…" : example}
              </button>
            ))}
          </div>
        </>
      ) : (
        <ImageUploadZone onImageReady={setImageBase64} disabled={isPending} />
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 mt-4 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <Button
        className="mt-4 w-full sm:w-auto"
        leftIcon={<Sparkles size={16} />}
        onClick={handleGenerate}
        isLoading={isPending}
        disabled={mode === "text" ? !description.trim() : !imageBase64}
      >
        {isPending ? "Analyse en cours..." : "Générer avec l'IA"}
      </Button>
    </div>
  );
}
