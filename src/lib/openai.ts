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
 * Utilise le modèle GPT-OSS de Groq par défaut.
 */
export const AI_MODEL = process.env.GROQ_API_KEY
  ? process.env.GROQ_TEXT_MODEL?.trim() || "openai/gpt-oss-20b"
  : "gpt-4o-mini";

/**
 * Modèle GPT utilisé pour l'analyse d'image (vision)
 * Utilise gpt-4o-mini d'OpenAI qui supporte la vision
 */
export const AI_VISION_MODEL = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.8-flash";

/**
 * Prompt système de base pour la génération de devis/factures
 * Injecté dans chaque appel IA pour donner le contexte à GPT
 */
export const SYSTEM_PROMPT_BASE = `Tu es un assistant de facturation expert pour une entreprise africaine (marché FCFA).
Tu analyses des descriptions en langage naturel — y compris des transcriptions vocales dictées à voix haute — et tu en extrais les données structurées pour créer un devis ou une facture.

RÈGLES ABSOLUES :
1. Tu réponds TOUJOURS en JSON valide uniquement, sans texte avant ou après.
2. Les montants sont en FCFA. Un point entre des chiffres (ex: "45.000") est un séparateur de milliers = 45000.
3. Tu extrais le nom du client depuis des formules comme "pour Amadou", "devis pour Ibrahim", "facture pour Moussa Diallo".
4. Tu extrais chaque article séparément avec son nom PROPRE (ex: "Caméra de surveillance"), sa quantité et son prix unitaire.
5. La désignation de chaque article doit être un NOM D'ARTICLE COURT ET PROPRE uniquement (ex: "Caméra de surveillance", "Installation", "Laptop HP EliteBook").
6. NE JAMAIS mettre dans "designation" : la phrase complète dictée, des instructions ("fais-moi un devis"), le nom du client, des virgules avec d'autres articles, ni du texte de plus de 60 caractères.
7. Si l'utilisateur dit "deux caméras à 45000", quantity=2 et unit_price=45000 (PAS quantity=1).
8. Pour les prix : "45 000 Fr", "45.000 FCFA", "45k" = 45000 FCFA.
9. N'invente jamais un article, un prix ou un client non mentionné.
10. Si une information est absente ou ambiguë, omets la ligne plutôt que d'inventer.

EXEMPLE d'entrée vocale : "Fais-moi un devis pour Amadou pour achat de deux caméras de surveillance à 45 000 Fr et installation 5000 Fr"
EXEMPLE de sortie attendue :
{
  "client_name": "Amadou",
  "items": [
    { "designation": "Caméra de surveillance", "quantity": 2, "unit_price": 45000 },
    { "designation": "Installation", "quantity": 1, "unit_price": 5000 }
  ],
  "notes": "Fourniture et installation de caméras de surveillance.",
  "date": "YYYY-MM-DD"
}`;
