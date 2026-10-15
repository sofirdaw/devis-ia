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
    quantity: number | string;
    unit_price: number | string;
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

function isAIExtractionPayload(value: unknown): value is AIExtractionPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Record<string, unknown>;
  if (typeof payload.client_name !== "string" || !Array.isArray(payload.items)) return false;

  return payload.items.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.designation === "string" &&
      (typeof candidate.quantity === "number" || typeof candidate.quantity === "string") &&
      (typeof candidate.unit_price === "number" || typeof candidate.unit_price === "string")
    );
  });
}

interface ProviderTarget {
  name: string;
  baseURL?: string;
  apiKey: string;
  model: string;
  isVision: boolean;
}

/**
 * Extrait les clés d'environnement sous forme de tableau (supporte les clés multiples séparées par des virgules)
 * Ignore automatiquement les clés de template/placeholder (ex: "votre_cle_openai")
 */
function getApiKeys(envVarName: string): string[] {
  const value = process.env[envVarName];
  if (!value || !value.trim()) return [];
  return value
    .split(",")
    .map((k) => k.trim())
    .filter(
      (k) =>
        k.length > 0 &&
        !k.startsWith("votre_") &&
        !k.startsWith("your_") &&
        k !== "undefined" &&
        k !== "null"
    );
}

/**
 * Génère la liste ordonnée des cibles IA pour la VISION (OCR Image)
 */
function getVisionTargets(): ProviderTarget[] {
  const targets: ProviderTarget[] = [];

  // 1. Groq Qwen multimodal
  const groqKeys = getApiKeys("GROQ_API_KEY");
  groqKeys.forEach((key, idx) => {
    targets.push({
      name: `Groq Qwen 3.8 27B Vision (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: process.env.GROQ_VISION_MODEL?.trim() || "qwen/qwen3.8-27b",
      isVision: true,
    });
  });

  // 2. Google Gemini 2.5 Flash
  const geminiKeys = getApiKeys("GEMINI_API_KEY").concat(
    getApiKeys("GOOGLE_GENERATIVE_AI_API_KEY")
  );
  geminiKeys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 2.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.8-flash",
      isVision: true,
    });
  });

  // 3. Mistral Pixtral
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

  // 4. OpenRouter Vision (GPT-4o-mini & Gemini)
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
      name: `OpenRouter Gemini 2.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "google/gemini-2.5-flash",
      isVision: true,
    });
  });

  // 5. OpenAI Vision (gpt-4o-mini)
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

  // Groq retired the former Llama models in August 2026.
  const groqKeys = getApiKeys("GROQ_API_KEY");
  groqKeys.forEach((key, idx) => {
    targets.push({
      name: `Groq GPT-OSS 20B (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: process.env.GROQ_TEXT_MODEL?.trim() || "openai/gpt-oss-20b",
      isVision: false,
    });
    targets.push({
      name: `Groq GPT-OSS 120B (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: process.env.GROQ_TEXT_FALLBACK_MODEL?.trim() || "openai/gpt-oss-120b",
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
      model: process.env.OPENROUTER_TEXT_MODEL?.trim() || "google/gemini-2.5-flash",
      isVision: false,
    });
  });

  // 4. Google Gemini 2.5 Flash
  const geminiKeys = getApiKeys("GEMINI_API_KEY").concat(
    getApiKeys("GOOGLE_GENERATIVE_AI_API_KEY")
  );
  geminiKeys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 2.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-3.8-flash",
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
        "Le service d'IA n'est pas configuré. Une clé API active doit être définie dans les variables d'environnement du serveur.",
    };
  }

  const failures: Array<{ status: number | null }> = [];

  for (const target of targets) {
    try {
      console.log(`[AI Multi-Relais] Tentative avec : ${target.name} (Modèle: ${target.model})`);

      const client = new OpenAI({
        apiKey: target.apiKey,
        baseURL: target.baseURL,
        timeout: 15000,
        maxRetries: 0,
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

      const parsedData: unknown = JSON.parse(jsonString);
      if (!isAIExtractionPayload(parsedData)) {
        throw new Error("Réponse IA incompatible avec le format attendu");
      }

      console.log(`[AI Multi-Relais] ✅ Succès avec : ${target.name}`);
      return {
        success: true,
        data: parsedData,
        providerUsed: target.name,
      };
    } catch (err) {
      const status =
        err instanceof OpenAI.APIError && typeof err.status === "number" ? err.status : null;
      console.warn(`[AI Multi-Relais] Échec de ${target.name} (HTTP ${status ?? "inconnu"}).`);
      failures.push({ status });
      // Continue automatiquement à la cible suivante
    }
  }

  const statuses = failures.map((failure) => failure.status);
  const allCredentialsRejected =
    statuses.length > 0 && statuses.every((status) => status === 401 || status === 403);
  const quotaRejected = statuses.some((status) => status === 429);
  return {
    success: false,
    error: allCredentialsRejected
      ? "Les clés API IA configurées sont refusées. Vérifiez-les et remplacez toute clé invalide dans les variables d'environnement du serveur."
      : quotaRejected
        ? "Le quota des fournisseurs d'IA configurés est temporairement atteint. Réessayez plus tard ou ajoutez un fournisseur avec une clé active."
        : "Les fournisseurs d'IA configurés sont indisponibles. Vérifiez les clés et modèles côté serveur, puis réessayez.",
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
  const userContent = `L'utilisateur a saisi la description suivante (éventuellement une transcription vocale) pour créer un devis ou une facture :

"""
${description}
"""

Analyse cette description et extrais :
- "client_name" : le nom propre du client uniquement (ex: "Amadou", "Ibrahim Diallo"). Jamais vide si mentionné.
- "items" : chaque article/prestation séparément. RÈGLES STRICTES pour chaque item :
  * "designation" : NOM D'ARTICLE PROPRE uniquement (ex: "Caméra de surveillance", "Installation", "Laptop HP"). MAX 60 caractères. JAMAIS la phrase complète, JAMAIS le nom du client, JAMAIS des virgules ou conjonctions, JAMAIS du texte d'instruction.
  * "quantity" : nombre entier (convertir les mots : "deux"→2, "trois"→3, "un"→1, etc.)
  * "unit_price" : prix unitaire en nombre (ex: "45 000 Fr" ou "45.000 FCFA" → 45000, "5000 Fr" → 5000)
- "notes" : notes professionnelles courtes et pertinentes (conditions, délai, garantie…)
- "date" : date du jour au format YYYY-MM-DD

RAPPEL CONVERSIONS :
- "deux caméras à 45 000 Fr" → quantity: 2, unit_price: 45000
- "installation 5000 Fr" → designation: "Installation", quantity: 1, unit_price: 5000
- "45.000" ou "45 000" = 45000 (séparateur de milliers, PAS décimales)

Réponds UNIQUEMENT avec ce format JSON exact, sans aucun texte autour :
{
  "client_name": "nom du client extrait",
  "items": [
    { "designation": "nom propre de l'article", "quantity": nombre, "unit_price": nombre }
  ],
  "notes": "notes professionnelles courtes",
  "date": "YYYY-MM-DD"
}

Le prix explicitement indiqué par l'utilisateur est toujours prioritaire sur le catalogue. Le catalogue sert uniquement à reconnaître un article ou compléter un prix absent. Ne rajoute aucun article qui n'est pas demandé. N'invente jamais un nom de client, un article, une quantité ou un prix.`;

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
Analyse minutieusement cette image et extrais uniquement les données utiles :
1. "client_name" : le nom du client (particulier ou entreprise), ou chaîne vide si absent.
2. "items" : la liste de tous les articles/prestations trouvés :
   - "designation" : UNIQUEMENT et STRICTEMENT le nom de l'article ou de la prestation (ex: "Powerbank", "Sac", "Installation caméra"). Ne JAMAIS inclure de phrase d'instruction, d'en-têtes de tableau (ex: "Quantité", "Total"), ni de texte de copyright/bruit OCR.
   - "quantity" : quantité numérique entière (1 par défaut si non spécifié).
   - "unit_price" : prix unitaire numérique en FCFA (sans symbole monétaire, ex: 15000, 20000). Le prix doit être lu sur l'image ou retrouvé dans le catalogue fourni.
3. "notes" : notes explicatives ou conditions particulières visibles.
4. "date" : date au format YYYY-MM-DD (ou "${todayDate}" si absente).

Ignore tout bruit OCR, logo ou ligne de titre générique.
Pour chaque ligne, distingue la quantité, le prix unitaire et le total de ligne. Si seul le total de ligne est lisible et la quantité est connue, calcule le prix unitaire uniquement si le total est divisible sans ambiguïté par la quantité. Si la quantité est absente, utilise 1 et traite le montant lisible comme le prix unitaire. Ne place jamais le texte complet du document, le nom du client ou une instruction dans "designation".
Les montants sont en FCFA. Un point séparant trois chiffres, par exemple "15.000", est un séparateur de milliers et signifie 15000. Le prix lisible sur le document est toujours prioritaire sur le catalogue. Le catalogue sert uniquement à reconnaître un article ou compléter un prix absent. Ne rajoute aucun article qui n'est pas présent sur l'image.

N'invente jamais un nom, un prix ou une quantité. Si un prix est illisible et absent du catalogue, ne retourne pas cette ligne. Si aucune ligne complète n'est lisible, retourne "items": [].

Réponds STRICTEMENT avec ce format JSON valide, sans aucun texte autour :
{
  "client_name": "nom du client",
  "items": [
    { "designation": "Nom article", "quantity": 1, "unit_price": 10000 }
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
