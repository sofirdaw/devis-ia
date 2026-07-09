/**
 * Client OpenAI centralisé
 *
 * Utilise Groq comme alternative gratuite à OpenAI.
 * Groq offre un quota gratuit généreux et des modèles très performants.
 *
 * ⚠️ Ce fichier est côté serveur uniquement (Server Actions / API Routes)
 */

import OpenAI from "openai";

// Instance unique du client OpenAI (singleton)
// Utilise Groq comme alternative gratuite
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined,
});

export default openai;

/**
 * Client OpenAI pour la vision (analyse d'image)
 * Utilise OpenAI car Groq ne supporte pas la vision
 */
const openaiVision = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export { openaiVision };

/**
 * Modèle GPT utilisé pour la génération de documents
 * Utilise Llama 3.3 de Groq (gratuit et très performant)
 */
export const AI_MODEL = process.env.GROQ_API_KEY ? "llama-3.3-70b-versatile" : "gpt-4o-mini";

/**
 * Modèle GPT utilisé pour l'analyse d'image (vision)
 * Utilise gpt-4o-mini d'OpenAI qui supporte la vision
 */
export const AI_VISION_MODEL = "gpt-4o-mini";

/**
 * Prompt système de base pour la génération de devis/factures
 * Injecté dans chaque appel IA pour donner le contexte à GPT
 */
export const SYSTEM_PROMPT_BASE = `Tu es un assistant de facturation pour une entreprise africaine.
Tu aides à créer des devis et des factures à partir de descriptions en langage naturel.
Tu réponds TOUJOURS en JSON valide uniquement, sans texte avant ou après.
Les montants sont en FCFA (Francs CFA).
Si un nom de client est mentionné, tu l'extrais tel quel.
Si une quantité n'est pas précisée, tu mets 1 par défaut.`;
