/**
 * Moteur OCR 100% Hors-Ligne (In-Browser WebAssembly)
 *
 * Utilise Tesseract.js pour extraire le texte des images photographiées
 * ou importées (notes manuscrites, reçus, factures) directement sur l'appareil
 * de l'utilisateur sans aucun appel réseau.
 */

import { createWorker } from "tesseract.js";
import { parseDocumentOfflineText } from "./offline-parser";
import type { Client, Product } from "@/types";
import type { AIExtractionResult } from "@/app/actions/ai";

let workerInstance: Awaited<ReturnType<typeof createWorker>> | null = null;

/**
 * Initialise ou réutilise un worker Tesseract pour optimiser les performances
 */
async function getOCRWorker() {
  if (!workerInstance) {
    const worker = await createWorker("fra"); // Reconnaissance en français
    workerInstance = worker;
  }
  return workerInstance;
}

/**
 * Extrait le texte d'une image en local et parse les éléments de devis/facture
 */
export async function extractDocumentFromImageOffline(
  imageSource: string | File | Blob,
  clients: Client[] = [],
  products: Product[] = []
): Promise<AIExtractionResult> {
  try {
    const worker = await getOCRWorker();
    const ret = await worker.recognize(imageSource);
    const extractedText = ret.data.text;

    if (!extractedText || !extractedText.trim()) {
      return {
        success: false,
        error: "Aucun texte lisible détecté sur l'image locale.",
      };
    }

    // Parser le texte brut avec le moteur heuristique local
    return parseDocumentOfflineText(extractedText, clients, products);
  } catch (error) {
    console.error("Erreur lors de l'OCR local:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de reconnaissance OCR locale",
    };
  }
}
