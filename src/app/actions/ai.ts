/**
 * Server Actions — Génération IA de devis/factures
 *
 * Pipeline complet :
 * 1. L'utilisateur décrit son besoin en langage naturel
 * 2. GPT extrait le client + les lignes (avec le catalogue produit en contexte)
 * 3. On recherche le client en base (correspondance floue)
 * 4. On retourne tout au composant client pour pré-remplir le formulaire
 *
 * ⚠️ Cette action NE crée PAS le document directement — elle retourne les
 * données extraites pour que l'utilisateur puisse vérifier/corriger avant
 * de valider (étape t61 de la checklist : "permettre de corriger avant sauvegarde").
 */

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyForAction } from "@/lib/current-company";
import openai, {
  openaiVision,
  AI_MODEL,
  AI_VISION_MODEL,
  SYSTEM_PROMPT_BASE,
} from "@/lib/openai";
import type { Product } from "@/types";

// ── Type de retour de l'extraction IA ─────────────────────────────────────────

export type AIExtractionResult = {
  success: boolean;
  error?: string;
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
 * Le catalogue est injecté dans le prompt pour que l'IA reconnaisse les
 * produits existants et retrouve leur prix automatiquement (t69-t70).
 */
async function getContextForAI() {
  const company = await getCurrentCompanyForAction();
  if (!company) return null;

  const supabase = await createClient();

  // Le fetch Supabase (src/lib/supabase/server.ts) gère déjà les retries
  // en cas de timeout réseau, pas besoin de dupliquer cette logique ici.
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
 * C'est ce qui permet à l'IA de reconnaître "EliteBook G6" et de retrouver
 * son prix exact dans la base, plutôt que d'inventer un montant.
 */
function buildCatalogContext(products: Product[]): string {
  if (products.length === 0) return "";

  const catalogList = products
    .map((p) => `- "${p.name}" : ${p.price} FCFA`)
    .join("\n");

  return `\n\nCatalogue produits existants de l'entreprise (réutilise EXACTEMENT ces noms et prix si l'utilisateur les mentionne, même approximativement) :\n${catalogList}`;
}

// ── Action principale : extraction IA depuis un texte libre ───────────────────

export async function generateDocumentFromText(
  description: string,
): Promise<AIExtractionResult> {
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

  const systemPrompt =
    SYSTEM_PROMPT_BASE + buildCatalogContext(context.products as Product[]);

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyse cette description et extrais le nom du client, les lignes d'articles, et génère des notes pertinentes pour ce devis/facture.
Utilise la date d'aujourd'hui comme date du document.
Réponds UNIQUEMENT avec ce format JSON exact, sans aucun texte autour :
{
  "client_name": "nom du client extrait",
  "items": [
    { "designation": "nom du produit", "quantity": nombre, "unit_price": nombre }
  ],
  "notes": "notes professionnelles pertinentes pour ce document (conditions de paiement, délais, etc.)",
  "date": "YYYY-MM-DD"
}

Description de l'utilisateur :
"""
${description}
"""`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Peu de créativité : on veut de la précision, pas de l'invention
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return { success: false, error: "L'IA n'a pas pu générer de réponse" };
    }

    const parsed = JSON.parse(rawContent) as {
      client_name: string;
      items: Array<{
        designation: string;
        quantity: number;
        unit_price: number;
      }>;
      notes?: string;
      date?: string;
    };

    if (!parsed.items || parsed.items.length === 0) {
      return {
        success: false,
        error: "Aucun article détecté dans votre description",
      };
    }

    // ── Recherche du client en base (correspondance floue insensible à la casse) ──
    const matchedClient = context.clients.find(
      (c) =>
        c.name.toLowerCase().includes(parsed.client_name.toLowerCase()) ||
        parsed.client_name.toLowerCase().includes(c.name.toLowerCase()),
    );

    // ── Faire correspondre chaque ligne à un produit existant si possible ────────
    const items = parsed.items.map((item) => {
      const matchedProduct = (context.products as Product[]).find(
        (p) => p.name.toLowerCase() === item.designation.toLowerCase(),
      );

      return {
        product_id: matchedProduct?.id ?? null,
        designation: matchedProduct?.name ?? item.designation,
        quantity: item.quantity || 1,
        unit_price: matchedProduct?.price ?? item.unit_price ?? 0,
      };
    });

    return {
      success: true,
      data: {
        clientName: parsed.client_name,
        matchedClientId: matchedClient?.id ?? null,
        items,
        notes: parsed.notes,
        date: parsed.date,
      },
    };
  } catch (err) {
    console.error("Erreur génération IA :", err);
    return {
      success: false,
      error: "Erreur lors de la génération IA. Réessayez.",
    };
  }
}

// ── Action : extraction IA depuis une image (OCR via GPT Vision) ──────────────

/**
 * Analyse une photo de facture/devis papier et extrait les produits, quantités
 * et montants. Utilise GPT Vision (le même modèle gpt-4o-mini supporte la vision).
 *
 * @param imageBase64 - Image encodée en base64 (avec le préfixe data:image/...)
 */
export async function generateDocumentFromImage(
  imageBase64: string,
): Promise<AIExtractionResult> {
  const context = await getContextForAI();
  if (!context) {
    return {
      success: false,
      error: "Impossible de récupérer le contexte entreprise",
    };
  }

  const systemPrompt =
    SYSTEM_PROMPT_BASE + buildCatalogContext(context.products as Product[]);

  try {
    const completion = await openaiVision.chat.completions.create({
      model: AI_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Cette image montre une facture, un devis papier ou une note manuscrite.
Extrais le nom du client (s'il est visible), toutes les lignes d'articles avec leurs quantités et prix, et génère des notes pertinentes.
Utilise la date d'aujourd'hui comme date du document.
Réponds UNIQUEMENT avec ce format JSON exact, sans aucun texte autour :
{
  "client_name": "nom du client ou chaîne vide si non visible",
  "items": [
    { "designation": "nom du produit", "quantity": nombre, "unit_price": nombre }
  ],
  "notes": "notes professionnelles pertinentes pour ce document",
  "date": "YYYY-MM-DD"
}`,
            },
            {
              type: "image_url",
              image_url: { url: imageBase64 },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return { success: false, error: "L'IA n'a pas pu analyser cette image" };
    }

    const parsed = JSON.parse(rawContent) as {
      client_name: string;
      items: Array<{
        designation: string;
        quantity: number;
        unit_price: number;
      }>;
      notes?: string;
      date?: string;
    };

    if (!parsed.items || parsed.items.length === 0) {
      return { success: false, error: "Aucun article détecté sur cette image" };
    }

    const matchedClient = parsed.client_name
      ? context.clients.find(
          (c) =>
            c.name.toLowerCase().includes(parsed.client_name.toLowerCase()) ||
            parsed.client_name.toLowerCase().includes(c.name.toLowerCase()),
        )
      : undefined;

    const items = parsed.items.map((item) => {
      const matchedProduct = (context.products as Product[]).find(
        (p) => p.name.toLowerCase() === item.designation.toLowerCase(),
      );

      return {
        product_id: matchedProduct?.id ?? null,
        designation: matchedProduct?.name ?? item.designation,
        quantity: item.quantity || 1,
        unit_price: matchedProduct?.price ?? item.unit_price ?? 0,
      };
    });

    return {
      success: true,
      data: {
        clientName: parsed.client_name || "Client à identifier",
        matchedClientId: matchedClient?.id ?? null,
        items,
        notes: parsed.notes,
        date: parsed.date,
      },
    };
  } catch (err) {
    console.error("Erreur OCR IA :", err);
    return {
      success: false,
      error: "Erreur lors de l'analyse de l'image. Réessayez.",
    };
  }
}
