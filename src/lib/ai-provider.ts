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

  // 1. Google Gemini (Gratuit - 15 req/min, 1500 req/jour via GEMINI_API_KEY)
  const geminiKeys = getApiKeys("GEMINI_API_KEY").concat(getApiKeys("GOOGLE_GENERATIVE_AI_API_KEY"));
  geminiKeys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-1.5-flash",
      isVision: true,
    });
    targets.push({
      name: `Google Gemini 2.0 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-2.0-flash",
      isVision: true,
    });
  });

  // 2. Groq Vision (Gratuit via GROQ_API_KEY)
  const groqKeys = getApiKeys("GROQ_API_KEY");
  groqKeys.forEach((key, idx) => {
    targets.push({
      name: `Groq Llama 3.2 Vision (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: "llama-3.2-11b-vision-preview",
      isVision: true,
    });
  });

  // 3. OpenRouter Free Vision (Gratuit via OPENROUTER_API_KEY)
  const openRouterKeys = getApiKeys("OPENROUTER_API_KEY");
  openRouterKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenRouter Gemini Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "google/gemini-2.0-flash-exp:free",
      isVision: true,
    });
    targets.push({
      name: `OpenRouter Llama Vision Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "meta-llama/llama-3.2-11b-vision-instruct:free",
      isVision: true,
    });
  });

  // 4. Mistral AI Pixtral (Gratuit / Essai via MISTRAL_API_KEY)
  const mistralKeys = getApiKeys("MISTRAL_API_KEY");
  mistralKeys.forEach((key, idx) => {
    targets.push({
      name: `Mistral Pixtral Vision (Clé ${idx + 1})`,
      baseURL: "https://api.mistral.ai/v1",
      apiKey: key,
      model: "pixtral-12b-2409",
      isVision: true,
    });
  });

  // 5. OpenAI Vision (Fallback payant via OPENAI_API_KEY)
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
  });

  // 2. Google Gemini (Gratuit)
  const geminiKeys = getApiKeys("GEMINI_API_KEY").concat(getApiKeys("GOOGLE_GENERATIVE_AI_API_KEY"));
  geminiKeys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 1.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-1.5-flash",
      isVision: false,
    });
  });

  // 3. OpenRouter Free
  const openRouterKeys = getApiKeys("OPENROUTER_API_KEY");
  openRouterKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenRouter Llama 3.3 Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "meta-llama/llama-3.3-70b-instruct:free",
      isVision: false,
    });
  });

  // 4. Mistral AI
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
  userMessageContent: string | Array<unknown>
): Promise<AIFallbackResponse> {
  if (targets.length === 0) {
    return {
      success: false,
      error: "Aucun fournisseur d'IA configuré. Veuillez définir au moins une clé API (GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY ou OPENAI_API_KEY).",
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
        { role: "user", content: userMessageContent as any },
      ];

      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: target.model,
        messages,
        temperature: 0.1,
      };

      // Ne forcer json_object que si le fournisseur le supporte de façon stable
      if (!target.name.includes("Groq Vision")) {
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
        jsonString = jsonString.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
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
  const userContent = [
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
  "notes": "notes professionnelles pertinentes",
  "date": "YYYY-MM-DD"
}`,
    },
    {
      type: "image_url",
      image_url: { url: imageBase64 },
    },
  ];

  return executeWithWaterfall(targets, systemPrompt, userContent);
}
