/**
 * Server Actions — Génération IA de devis/factures
 *
 * Utilise un moteur multi-fournisseurs (Gemini, Groq, OpenRouter, Mistral, OpenAI)
 * avec basculement automatique en cas de quota dépassé ou panne.
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import { SYSTEM_PROMPT_BASE } from "@/lib/openai";
import {
  extractDocumentFromTextWithFallback,
  extractDocumentFromImageWithFallback,
} from "@/lib/ai-provider";
import { parseDocumentOfflineText } from "@/lib/offline-parser";
import type { Client, Product } from "@/types";

// ── Type de retour de l'extraction IA ─────────────────────────────────────────

export type AIExtractionResult = {
  success: boolean;
  error?: string;
  providerUsed?: string;
  data?: {
    clientName: string;
    matchedClientId: string | null; // null si aucun client trouvé en base
    items: Array<{
      product_id: string | null;
      designation: string;
      quantity: number;
      unit_price: number;
    }>;
    notes?: string; // Notes générées automatiquement
    date?: string; // Date au format YYYY-MM-DD
  };
};

/**
 * Récupère l'entreprise courante + son catalogue produit + ses clients.
 */
async function getContextForAI() {
  const company = await getCurrentCompanyForAction();
  if (!company) return null;

  const supabase = await createClient();

  const [{ data: products }, { data: clients }] = await Promise.all([
    supabase.from("products").select("*").eq("company_id", company.id),
    supabase.from("clients").select("id, name").eq("company_id", company.id),
  ]);

  return {
    companyId: company.id,
    products: products ?? [],
    clients: clients ?? [],
  };
}

/**
 * Construit le prompt système enrichi avec le catalogue produit de l'entreprise.
 */
function buildCatalogContext(products: Product[]): string {
  if (products.length === 0) return "";

  const catalogList = products.map((p) => `- "${p.name}" : ${p.price} FCFA`).join("\n");

  return `\n\nCatalogue produits existants de l'entreprise (réutilise EXACTEMENT ces noms et prix si l'utilisateur les mentionne, même approximativement) :\n${catalogList}`;
}

function looksLikeMalformedAIItem(item: {
  designation: string;
  quantity?: number;
  unit_price?: number;
}) {
  const designation = (item.designation ?? "").trim();
  if (!designation) return true;

  const hasHeaderNoise =
    /(articles?|désignation|designation|quantité|quantite|prix unitaire|total ht|total ttc)/i.test(
      designation
    );
  const hasPriceInName = /\s+à\s+\d{2,}(?:[\s.,]\d{3})*(?:\s*(?:fcfa|cfa|f))?/i.test(designation);
  const hasCommaThenWord =
    /,\s*(installation|maintenance|livraison|service|forfait|article|livre)/i.test(designation);

  return hasHeaderNoise || hasPriceInName || hasCommaThenWord;
}

function sanitizeAIItems(
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
    product_id?: string | null;
  }>,
  description: string,
  clients: Array<{ id: string; name: string }>,
  products: Product[]
): Array<{ product_id: string | null; designation: string; quantity: number; unit_price: number }> {
  if (items.length === 0)
    return items as Array<{
      product_id: string | null;
      designation: string;
      quantity: number;
      unit_price: number;
    }>;

  const hasMalformed = items.some((item) => looksLikeMalformedAIItem(item));
  if (!hasMalformed) {
    return items.map((item) => ({
      product_id: item.product_id ?? null,
      designation: item.designation,
      quantity: item.quantity || 1,
      unit_price: item.unit_price ?? 0,
    }));
  }

  const parserClients: Client[] = clients.map((client) => ({
    id: client.id,
    company_id: "",
    name: client.name,
    phone: null,
    email: null,
    address: null,
    created_at: "",
  }));
  const fallback = parseDocumentOfflineText(description, parserClients, products);
  if (!fallback.success || !fallback.data) {
    return items.map((item) => ({
      product_id: item.product_id ?? null,
      designation: item.designation,
      quantity: item.quantity || 1,
      unit_price: item.unit_price ?? 0,
    }));
  }

  return fallback.data.items.map((item) => {
    const matchedProduct = products.find(
      (p) => p.name.toLowerCase() === item.designation.toLowerCase()
    );

    return {
      product_id: matchedProduct?.id ?? null,
      designation: matchedProduct?.name ?? item.designation,
      quantity: item.quantity || 1,
      unit_price: matchedProduct?.price ?? item.unit_price ?? 0,
    };
  });
}

// ── Action principale : extraction IA depuis un texte libre ───────────────────

export async function generateDocumentFromText(description: string): Promise<AIExtractionResult> {
  if (!description.trim()) {
    return { success: false, error: "Veuillez décrire votre devis ou facture" };
  }

  const context = await getContextForAI();
  if (!context) {
    return {
      success: false,
      error: "Impossible de récupérer le contexte entreprise",
    };
  }

  const systemPrompt = SYSTEM_PROMPT_BASE + buildCatalogContext(context.products as Product[]);

  const result = await extractDocumentFromTextWithFallback(description, systemPrompt);

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || "Erreur lors de la génération IA",
    };
  }

  const parsed = result.data;

  if (!parsed.items || parsed.items.length === 0) {
    return {
      success: false,
      error: "Aucun article détecté dans votre description",
    };
  }

  // ── Recherche du client en base (correspondance floue insensible à la casse) ──
  const matchedClient = parsed.client_name
    ? context.clients.find(
        (c) =>
          c.name.toLowerCase().includes(parsed.client_name.toLowerCase()) ||
          parsed.client_name.toLowerCase().includes(c.name.toLowerCase())
      )
    : undefined;

  // ── Faire correspondre chaque ligne à un produit existant si possible ────────
  const items = sanitizeAIItems(
    parsed.items.map((item) => ({
      product_id: null,
      designation: item.designation,
      quantity: item.quantity || 1,
      unit_price: item.unit_price ?? 0,
    })),
    description,
    context.clients,
    context.products as Product[]
  );

  return {
    success: true,
    providerUsed: result.providerUsed,
    data: {
      clientName: parsed.client_name || "Client non spécifié",
      matchedClientId: matchedClient?.id ?? null,
      items,
      notes: parsed.notes,
      date: parsed.date,
    },
  };
}

// ── Action : extraction IA depuis une image (OCR via Vision) ──────────────

export async function generateDocumentFromImage(imageBase64: string): Promise<AIExtractionResult> {
  // Vérifier que l'image est en base64 valide
  if (!imageBase64 || !imageBase64.startsWith("data:image/")) {
    return {
      success: false,
      error: "Format d'image invalide",
    };
  }

  const context = await getContextForAI();
  if (!context) {
    return {
      success: false,
      error: "Impossible de récupérer le contexte entreprise",
    };
  }

  const systemPrompt = SYSTEM_PROMPT_BASE + buildCatalogContext(context.products as Product[]);

  const result = await extractDocumentFromImageWithFallback(imageBase64, systemPrompt);

  if (!result.success || !result.data) {
    return {
      success: false,
      error:
        result.error || "Erreur lors de l'analyse de l'image. Réessayez ou utilisez le mode texte.",
    };
  }

  const parsed = result.data;

  if (!parsed.items || parsed.items.length === 0) {
    return { success: false, error: "Aucun article détecté sur cette image" };
  }

  const matchedClient = parsed.client_name
    ? context.clients.find(
        (c) =>
          c.name.toLowerCase().includes(parsed.client_name.toLowerCase()) ||
          parsed.client_name.toLowerCase().includes(c.name.toLowerCase())
      )
    : undefined;

  const items = sanitizeAIItems(
    parsed.items.map((item) => ({
      product_id: null,
      designation: item.designation,
      quantity: item.quantity || 1,
      unit_price: item.unit_price ?? 0,
    })),
    `Image analysée : ${parsed.client_name ?? ""}`,
    context.clients,
    context.products as Product[]
  );

  return {
    success: true,
    providerUsed: result.providerUsed,
    data: {
      clientName: parsed.client_name || "Client à identifier",
      matchedClientId: matchedClient?.id ?? null,
      items,
      notes: parsed.notes,
      date: parsed.date,
    },
  };
}
