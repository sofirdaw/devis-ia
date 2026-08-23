/**
 * Moteur Muti-IA avec Basculement Automatique (Waterfall / Fallback Engine)
 *
 * Ce module gère l'exécution des requêtes d'extraction Texte et Vision (OCR)
 * à travers plusieurs fournisseurs d'IA gratuits et payants (Gemini, Groq, OpenRouter, Mistral, OpenAI).
 *
 * Si un fournisseur renvoie une erreur 429 (Quota dépassé), 401 (Clé invalide) ou 5xx,
 * le système bascule immédiatement sur le fournisseur suivant sans interrompre l'utilisateur.
 *
 * Supporte la rotation de clés multiples (séparées par des virgules dans les variables d'environnement).
 */

import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

export type AIExtractionPayload = {
  client_name: string;
  items: Array<{
    designation: string;
    quantity: number;
    unit_price: number;
  }>;
  notes?: string;
  date?: string;
};

export type AIFallbackResponse = {
  success: boolean;
  data?: AIExtractionPayload;
  providerUsed?: string;
  error?: string;
};

interface ProviderTarget {
  name: string;
  baseURL?: string;
  apiKey: string;
  model: string;
  isVision: boolean;
}

/**
 * Extrait les clés d'environnement sous forme de tableau (supporte les clés multiples séparées par des virgules)
 */
function getApiKeys(envVarName: string): string[] {
  const value = process.env[envVarName];
  if (!value || !value.trim()) return [];
  return value
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/**
 * Génère la liste ordonnée des cibles IA pour la VISION (OCR Image)
 */
function getVisionTargets(): ProviderTarget[] {
  const targets: ProviderTarget[] = [];

  // 1. Mistral AI Pixtral & Small (Spécialiste OCR & manuscrit - Stable & Actif)
  const mistralKeys = getApiKeys("MISTRAL_API_KEY");
  mistralKeys.forEach((key, idx) => {
    targets.push({
      name: `Mistral Pixtral 12B Vision (Clé ${idx + 1})`,
      baseURL: "https://api.mistral.ai/v1",
      apiKey: key,
      model: "pixtral-12b-2409",
      isVision: true,
    });
  });

  // 2. OpenRouter Vision (GPT-4o-mini & Gemini)
  const openRouterKeys = getApiKeys("OPENROUTER_API_KEY");
  openRouterKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenRouter GPT-4o Mini Vision (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "openai/gpt-4o-mini",
      isVision: true,
    });
    targets.push({
      name: `OpenRouter Gemini 2.0 Flash (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "google/gemini-2.0-flash-exp:free",
      isVision: true,
    });
  });

  // 3. Google Gemini Direct (via GEMINI_API_KEY)
  const geminiKeys = getApiKeys("GEMINI_API_KEY").concat(
    getApiKeys("GOOGLE_GENERATIVE_AI_API_KEY")
  );
  geminiKeys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 2.0 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-2.0-flash",
      isVision: true,
    });
    targets.push({
      name: `Google Gemini 1.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-1.5-flash",
      isVision: true,
    });
  });

  // 4. OpenAI Vision (gpt-4o-mini)

  const openAiKeys = getApiKeys("OPENAI_API_KEY");
  openAiKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenAI gpt-4o-mini (Clé ${idx + 1})`,
      apiKey: key,
      model: "gpt-4o-mini",
      isVision: true,
    });
  });

  return targets;
}

/**
 * Génère la liste ordonnée des cibles IA pour le TEXTE (Description libre)
 */
function getTextTargets(): ProviderTarget[] {
  const targets: ProviderTarget[] = [];

  // 1. Groq (Ultra-rapide & Gratuit)
  const groqKeys = getApiKeys("GROQ_API_KEY");
  groqKeys.forEach((key, idx) => {
    targets.push({
      name: `Groq Llama 3.3 70B (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: "llama-3.3-70b-versatile",
      isVision: false,
    });
    targets.push({
      name: `Groq Llama 3.1 8B (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: "llama-3.1-8b-instant",
      isVision: false,
    });
  });

  // 2. Mistral AI (Ultra-stable)
  const mistralKeys = getApiKeys("MISTRAL_API_KEY");
  mistralKeys.forEach((key, idx) => {
    targets.push({
      name: `Mistral Small (Clé ${idx + 1})`,
      baseURL: "https://api.mistral.ai/v1",
      apiKey: key,
      model: "mistral-small-latest",
      isVision: false,
    });
  });

  // 3. OpenRouter Gemini 2.5 Flash
  const openRouterKeys = getApiKeys("OPENROUTER_API_KEY");
  openRouterKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenRouter Gemini 2.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "google/gemini-2.5-flash",
      isVision: false,
    });
  });

  // 4. Google Gemini Direct
  const geminiKeys = getApiKeys("GEMINI_API_KEY").concat(
    getApiKeys("GOOGLE_GENERATIVE_AI_API_KEY")
  );
  geminiKeys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 1.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-1.5-flash",
      isVision: false,
    });
  });

  // 5. OpenAI
  const openAiKeys = getApiKeys("OPENAI_API_KEY");
  openAiKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenAI gpt-4o-mini (Clé ${idx + 1})`,
      apiKey: key,
      model: "gpt-4o-mini",
      isVision: false,
    });
  });

  return targets;
}

/**
 * Exécute une requête avec basculement automatique sur la liste des cibles fournies
 */
async function executeWithWaterfall(
  targets: ProviderTarget[],
  systemPrompt: string,
  userMessageContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"]
): Promise<AIFallbackResponse> {
  if (targets.length === 0) {
    return {
      success: false,
      error:
        "Aucun fournisseur d'IA configuré. Veuillez définir au moins une clé API (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY ou OPENAI_API_KEY).",
    };
  }

  const errors: string[] = [];

  for (const target of targets) {
    try {
      console.log(`[AI Multi-Relais] Tentative avec : ${target.name} (Modèle: ${target.model})`);

      const client = new OpenAI({
        apiKey: target.apiKey,
        baseURL: target.baseURL,
        timeout: 25000, // 25 secondes max par fournisseur
      });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessageContent },
      ];

      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: target.model,
        messages,
        temperature: 0.1,
        max_tokens: 2000,
      };

      // Ne forcer json_object que si le fournisseur le supporte de façon stable
      if (!target.name.includes("Groq Vision") && !target.name.includes("Pixtral")) {
        completionParams.response_format = { type: "json_object" };
      }

      const completion = await client.chat.completions.create(completionParams);
      const rawContent = completion.choices[0]?.message?.content;

      if (!rawContent) {
        throw new Error("Réponse vide de l'IA");
      }

      // Nettoyage au cas où l'IA retourne des balises markdown ```json ... ```
      let jsonString = rawContent.trim();
      if (jsonString.startsWith("```")) {
        jsonString = jsonString
          .replace(/^```[a-z]*\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
      }

      const parsedData = JSON.parse(jsonString) as AIExtractionPayload;

      console.log(`[AI Multi-Relais] ✅ Succès avec : ${target.name}`);
      return {
        success: true,
        data: parsedData,
        providerUsed: target.name,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[AI Multi-Relais] ⚠️ Échec de ${target.name}: ${errMsg}`);
      errors.push(`${target.name}: ${errMsg}`);
      // Continue automatiquement à la cible suivante
    }
  }

  return {
    success: false,
    error: `Toutes les options IA ont échoué. Détails : ${errors.slice(0, 3).join(" | ")}`,
  };
}

/**
 * Extraction depuis un texte avec basculement automatique
 */
export async function extractDocumentFromTextWithFallback(
  description: string,
  systemPrompt: string
): Promise<AIFallbackResponse> {
  const targets = getTextTargets();
  const userContent = `Analyse cette description et extrais le nom du client, les lignes d'articles, et génère des notes pertinentes pour ce devis/facture.
Utilise la date d'aujourd'hui comme date du document.
Réponds UNIQUEMENT avec ce format JSON exact, sans aucun texte autour :
{
  "client_name": "nom du client extrait",
  "items": [
    { "designation": "nom du produit", "quantity": nombre, "unit_price": nombre }
  ],
  "notes": "notes professionnelles pertinentes",
  "date": "YYYY-MM-DD"
}

Description de l'utilisateur :
"""
${description}
"""`;

  return executeWithWaterfall(targets, systemPrompt, userContent);
}

/**
 * Extraction depuis une image (Vision OCR) avec basculement automatique
 */
export async function extractDocumentFromImageWithFallback(
  imageBase64: string,
  systemPrompt: string
): Promise<AIFallbackResponse> {
  const targets = getVisionTargets();
  const todayDate = new Date().toISOString().split("T")[0];
  const userContent: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `Tu es un expert en reconnaissance d'écriture manuscrite (OCR manuscrit) et en analyse de documents commerciaux (devis, factures, reçus, carnets de notes, bons de commande manuscrits ou imprimés).
Analyse minutieusement cette image (même si elle est écrite à la main, froissée, penchée ou prise en photo avec un smartphone) et extrais :
1. "client_name" : le nom du client (particulier ou entreprise), ou chaîne vide si absent.
2. "items" : la liste de tous les articles/prestations trouvés :
   - "designation" : nom clair du produit ou service (déchiffre l'écriture manuscrite avec soin).
   - "quantity" : quantité numérique (1 par défaut si non spécifié).
   - "unit_price" : prix unitaire numérique (sans symbole monétaire).
3. "notes" : notes explicatives ou conditions particulières visibles.
4. "date" : date au format YYYY-MM-DD (ou "${todayDate}" si absente).

Réponds STRICTEMENT avec ce format JSON valide, sans aucun texte autour :
{
  "client_name": "nom du client",
  "items": [
    { "designation": "nom de l'article ou service", "quantity": 1, "unit_price": 10000 }
  ],
  "notes": "notes ou conditions",
  "date": "${todayDate}"
}`,
    },
    {
      type: "image_url",
      image_url: { url: imageBase64 },
    },
  ];

  return executeWithWaterfall(targets, systemPrompt, userContent);
}
