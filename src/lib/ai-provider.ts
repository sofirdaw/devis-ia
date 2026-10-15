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

function getKeysWithFallback(dedicatedKeyName: string, generalKeyName?: string): string[] {
  const dedicated = getApiKeys(dedicatedKeyName);
  if (dedicated.length > 0) return dedicated;
  if (generalKeyName) {
    return getApiKeys(generalKeyName);
  }
  return [];
}

/**
 * Génère la liste ordonnée des cibles IA pour la VISION (OCR Image)
 */
function getVisionTargets(): ProviderTarget[] {
  const targets: ProviderTarget[] = [];

  // 1. Google Gemini 2.0 Flash
  const gemini20Keys = getKeysWithFallback("GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
  gemini20Keys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 2.5 Flash Vision (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash",
      isVision: true,
    });
  });

  // 2. Google Gemini 1.5 Flash
  const gemini15Keys = getKeysWithFallback("GEMINI_15_FLASH_KEY", "GEMINI_API_KEY");
  gemini15Keys.forEach((key, idx) => {
    targets.push({
      name: `Google Gemini 1.5 Flash Vision (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-1.5-flash",
      isVision: true,
    });
  });

  // 3. Groq Qwen multimodal
  const groqQwenKeys = getKeysWithFallback("GROQ_QWEN_KEY", "GROQ_API_KEY");
  groqQwenKeys.forEach((key, idx) => {
    targets.push({
      name: `Groq Qwen 2.5 32B Vision (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: process.env.GROQ_VISION_MODEL?.trim() || "qwen/qwen3.8-27b",
      isVision: true,
    });
  });

  // 4. Mistral Pixtral 12B
  const mistralPixtralKeys = getKeysWithFallback("MISTRAL_PIXTRAL_KEY", "MISTRAL_API_KEY");
  mistralPixtralKeys.forEach((key, idx) => {
    targets.push({
      name: `Mistral Pixtral 12B Vision (Clé ${idx + 1})`,
      baseURL: "https://api.mistral.ai/v1",
      apiKey: key,
      model: "pixtral-12b-2409",
      isVision: true,
    });
  });

  // 5. OpenRouter Llama 3.2 Vision Free
  const openRouterVisionKeys = getKeysWithFallback("OPENROUTER_API_KEY");
  openRouterVisionKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenRouter Llama 3.2 11B Vision Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "meta-llama/llama-3.2-11b-vision-instruct:free",
      isVision: true,
    });
    targets.push({
      name: `OpenRouter Qwen 2.5 VL 72B Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "qwen/qwen-2.5-vl-72b-instruct:free",
      isVision: true,
    });
    targets.push({
      name: `OpenRouter Gemini Flash Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "google/gemini-2.0-flash-exp:free",
      isVision: true,
    });
  });

  // 6. GitHub Models Vision (GPT-4o-mini)
  const githubTokens = getKeysWithFallback("GITHUB_TOKEN");
  githubTokens.forEach((key, idx) => {
    targets.push({
      name: `GitHub Models GPT-4o-mini Vision (Clé ${idx + 1})`,
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: key,
      model: "gpt-4o-mini",
      isVision: true,
    });
  });

  // 7. OpenAI Vision (Secours payant)
  const openAiKeys = getKeysWithFallback("OPENAI_API_KEY");
  openAiKeys.forEach((key, idx) => {
    targets.push({
      name: `OpenAI gpt-4o-mini Vision (Clé ${idx + 1})`,
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

  // 1. Google Gemini Flash
  const gemini20Keys = getKeysWithFallback("GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
  gemini20Keys.forEach((key, idx) => {
    targets.push({
      name: `1. Google Gemini 2.5 Flash (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash",
      isVision: false,
    });
    targets.push({
      name: `2. Google Gemini Flash Lite (Clé ${idx + 1})`,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: key,
      model: "gemini-2.5-flash-lite",
      isVision: false,
    });
  });

  // 3. Groq (GPT-OSS 20B & 120B - Inférence ultra-rapide)
  const groqKeys = getKeysWithFallback("GROQ_API_KEY");
  groqKeys.forEach((key, idx) => {
    targets.push({
      name: `3. Groq GPT-OSS 20B (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: process.env.GROQ_TEXT_MODEL?.trim() || "openai/gpt-oss-20b",
      isVision: false,
    });
    targets.push({
      name: `4. Groq GPT-OSS 120B (Clé ${idx + 1})`,
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: key,
      model: process.env.GROQ_TEXT_FALLBACK_MODEL?.trim() || "openai/gpt-oss-120b",
      isVision: false,
    });
  });

  // 5. OpenRouter Free (Modèles 100% Gratuits)
  const openRouterKeys = getKeysWithFallback("OPENROUTER_API_KEY");
  openRouterKeys.forEach((key, idx) => {
    targets.push({
      name: `5. OpenRouter Gemma 4 31B Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "google/gemma-4-31b-it:free",
      isVision: false,
    });
    targets.push({
      name: `6. OpenRouter Nemotron 3.5 Lightning Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "nvidia/nemotron-3.5-lightning:free",
      isVision: false,
    });
  });

  // 10. OpenRouter DeepSeek V3 / Chat Free
  const orDeepSeekV3 = getKeysWithFallback("OPENROUTER_DEEPSEEK_V3_KEY", "OPENROUTER_API_KEY");
  orDeepSeekV3.forEach((key, idx) => {
    targets.push({
      name: `10. OpenRouter DeepSeek V3 Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "deepseek/deepseek-chat:free",
      isVision: false,
    });
  });

  // 11. OpenRouter DeepSeek R1 Free
  const orDeepSeekR1 = getKeysWithFallback("OPENROUTER_DEEPSEEK_R1_KEY", "OPENROUTER_API_KEY");
  orDeepSeekR1.forEach((key, idx) => {
    targets.push({
      name: `11. OpenRouter DeepSeek R1 Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "deepseek/deepseek-r1:free",
      isVision: false,
    });
  });

  // 12. OpenRouter Qwen 2.5 72B Free
  const orQwen = getKeysWithFallback("OPENROUTER_QWEN_KEY", "OPENROUTER_API_KEY");
  orQwen.forEach((key, idx) => {
    targets.push({
      name: `12. OpenRouter Qwen 2.5 72B Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "qwen/qwen-2.5-72b-instruct:free",
      isVision: false,
    });
  });

  // 13. OpenRouter Qwen 2.5 Coder 32B Free
  const orQwenCoder = getKeysWithFallback("OPENROUTER_QWEN_CODER_KEY", "OPENROUTER_API_KEY");
  orQwenCoder.forEach((key, idx) => {
    targets.push({
      name: `13. OpenRouter Qwen 2.5 Coder Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "qwen/qwen-2.5-coder-32b-instruct:free",
      isVision: false,
    });
  });

  // 14. OpenRouter Mistral 7B Free
  const orMistral = getKeysWithFallback("OPENROUTER_MISTRAL_FREE_KEY", "OPENROUTER_API_KEY");
  orMistral.forEach((key, idx) => {
    targets.push({
      name: `14. OpenRouter Mistral 7B Free (Clé ${idx + 1})`,
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
      model: "mistralai/mistral-7b-instruct:free",
      isVision: false,
    });
  });

  // 15. Mistral Small
  const mistralSmallKeys = getKeysWithFallback("MISTRAL_API_KEY");
  mistralSmallKeys.forEach((key, idx) => {
    targets.push({
      name: `15. Mistral Small (Clé ${idx + 1})`,
      baseURL: "https://api.mistral.ai/v1",
      apiKey: key,
      model: "mistral-small-latest",
      isVision: false,
    });
  });

  // 16 & 17. Mistral Codestral
  const mistralCodestralKeys = getKeysWithFallback("MISTRAL_CODESTRAL_KEY", "MISTRAL_API_KEY");
  mistralCodestralKeys.forEach((key, idx) => {
    targets.push({
      name: `17. Mistral Codestral (Clé ${idx + 1})`,
      baseURL: "https://api.mistral.ai/v1",
      apiKey: key,
      model: "codestral-latest",
      isVision: false,
    });
  });

  // 18. SambaNova Llama 3.3 70B
  const sambaKeys = getKeysWithFallback("SAMBANOVA_API_KEY");
  sambaKeys.forEach((key, idx) => {
    targets.push({
      name: `18. SambaNova Llama 3.3 70B (Clé ${idx + 1})`,
      baseURL: "https://api.sambanova.ai/v1",
      apiKey: key,
      model: "Meta-Llama-3.3-70B-Instruct",
      isVision: false,
    });
  });

  // 19. SambaNova DeepSeek R1
  const sambaDeepSeek = getKeysWithFallback("SAMBANOVA_DEEPSEEK_KEY", "SAMBANOVA_API_KEY");
  sambaDeepSeek.forEach((key, idx) => {
    targets.push({
      name: `19. SambaNova DeepSeek R1 (Clé ${idx + 1})`,
      baseURL: "https://api.sambanova.ai/v1",
      apiKey: key,
      model: "DeepSeek-R1-Distill-Llama-70B",
      isVision: false,
    });
  });

  // 20. SambaNova Qwen 2.5 72B
  const sambaQwen = getKeysWithFallback("SAMBANOVA_QWEN_KEY", "SAMBANOVA_API_KEY");
  sambaQwen.forEach((key, idx) => {
    targets.push({
      name: `20. SambaNova Qwen 2.5 72B (Clé ${idx + 1})`,
      baseURL: "https://api.sambanova.ai/v1",
      apiKey: key,
      model: "Qwen2.5-72B-Instruct",
      isVision: false,
    });
  });

  // 21. Cerebras Llama 3.3 70B
  const cerebrasKeys = getKeysWithFallback("CEREBRAS_API_KEY");
  cerebrasKeys.forEach((key, idx) => {
    targets.push({
      name: `21. Cerebras Llama 3.3 70B (Clé ${idx + 1})`,
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: key,
      model: "llama-3.3-70b",
      isVision: false,
    });
  });

  // 22. Cerebras Llama 3.1 8B
  const cerebras8bKeys = getKeysWithFallback("CEREBRAS_LLAMA31_KEY", "CEREBRAS_API_KEY");
  cerebras8bKeys.forEach((key, idx) => {
    targets.push({
      name: `22. Cerebras Llama 3.1 8B (Clé ${idx + 1})`,
      baseURL: "https://api.cerebras.ai/v1",
      apiKey: key,
      model: "llama3.1-8b",
      isVision: false,
    });
  });

  // 23. GitHub Models GPT-4o-mini
  const githubTokens = getKeysWithFallback("GITHUB_TOKEN");
  githubTokens.forEach((key, idx) => {
    targets.push({
      name: `23. GitHub Models GPT-4o-mini (Clé ${idx + 1})`,
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: key,
      model: "gpt-4o-mini",
      isVision: false,
    });
  });

  // 24. GitHub Models Phi-4 / Phi-3.5
  const githubPhiTokens = getKeysWithFallback("GITHUB_PHI_TOKEN", "GITHUB_TOKEN");
  githubPhiTokens.forEach((key, idx) => {
    targets.push({
      name: `24. GitHub Models Phi-3.5-mini (Clé ${idx + 1})`,
      baseURL: "https://models.inference.ai.azure.com",
      apiKey: key,
      model: "Phi-3.5-mini-instruct",
      isVision: false,
    });
  });

  // 25. Cohere Command R
  const cohereKeys = getKeysWithFallback("COHERE_API_KEY");
  cohereKeys.forEach((key, idx) => {
    targets.push({
      name: `25. Cohere Command R (Clé ${idx + 1})`,
      baseURL: "https://api.cohere.com/compatibility/v1",
      apiKey: key,
      model: "command-r",
      isVision: false,
    });
  });

  // 26. Cloudflare Workers AI
  const cloudflareKeys = getKeysWithFallback("CLOUDFLARE_API_KEY");
  const cloudflareAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (cloudflareAccount && cloudflareKeys.length > 0) {
    cloudflareKeys.forEach((key, idx) => {
      targets.push({
        name: `26. Cloudflare Workers AI Llama 3.1 (Clé ${idx + 1})`,
        baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccount}/ai/v1`,
        apiKey: key,
        model: "@cf/meta/llama-3.1-8b-instruct",
        isVision: false,
      });
    });
  }

  // 27. OpenAI GPT-4o-mini (Ultime secours payant)
  const openAiKeys = getKeysWithFallback("OPENAI_API_KEY");
  openAiKeys.forEach((key, idx) => {
    targets.push({
      name: `27. OpenAI gpt-4o-mini (Clé ${idx + 1})`,
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
"""

Les montants sont en FCFA. Un point séparant trois chiffres, par exemple "15.000" ou "15.000fcfa" ou "15.000f" ou "15000fcfa", est un séparateur de milliers et signifie 15000 en valeur numérique pure. Le prix explicitement indiqué par l'utilisateur est toujours prioritaire sur le catalogue. Le catalogue sert uniquement à reconnaître un article ou compléter un prix absent. Ne rajoute aucun article qui n'est pas demandé.

N'invente jamais un nom de client, un article, une quantité ou un prix. Si le nom d'un article ou son prix est absent ou ambigu, ne l'ajoute pas aux lignes. Retourne une liste "items" vide si aucune ligne complète et exploitable ne peut être extraite.`;

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
Les montants sont en FCFA. Un point séparant trois chiffres, par exemple "15.000" ou "15.000fcfa" ou "15.000f" ou "15000fcfa", est un séparateur de milliers et signifie 15000 en valeur numérique pure. Le prix lisible sur le document est toujours prioritaire sur le catalogue. Le catalogue sert uniquement à reconnaître un article ou compléter un prix absent. Ne rajoute aucun article qui n'est pas présent sur l'image.

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
