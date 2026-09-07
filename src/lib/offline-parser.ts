/**
 * Moteur d'Extraction IA Local de Secours (100% Hors-Ligne & OCR Précis)
 *
 * Analyse le texte en langage naturel ou le résultat OCR d'une image
 * directement sur l'appareil pour extraire avec précision :
 * - Nom du client
 * - Nom de chaque article (désignation propre sans phrases d'instruction, articles définis ni bruit OCR)
 * - Auto-correction des termes courants et déchiffrement OCR (ex: guect -> Gucci, le powerbank -> Powerbank)
 * - Quantité
 * - Prix unitaire en FCFA
 */

import type { Client, Product } from "@/types";
import type { AIExtractionResult } from "@/app/actions/ai";

// Dictionnaire d'auto-correction pour les fautes de frappe et erreurs de scan OCR
const AUTO_CORRECT_DICTIONARY: Record<string, string> = {
  guect: "Gucci",
  guec: "Gucci",
  guci: "Gucci",
  guchi: "Gucci",
  guxi: "Gucci",
  gucci: "Gucci",
  powerbank: "Powerbank",
  "power bank": "Powerbank",
  "poir bank": "Powerbank",
  powabank: "Powerbank",
  iphone: "iPhone",
  "i phone": "iPhone",
  airpod: "AirPods",
  airpods: "AirPods",
  "air pod": "AirPods",
  samsung: "Samsung",
  sansung: "Samsung",
  ordinateur: "Ordinateur",
  ordi: "Ordinateur",
  ecran: "Écran",
  ecrant: "Écran",
  souris: "Souris",
  clavier: "Clavier",
  "cle usb": "Clé USB",
  "clé usb": "Clé USB",
  casque: "Casque",
  imprimante: "Imprimante",
  onduleur: "Onduleur",
  "panneau solaire": "Panneau Solaire",
  batterie: "Batterie",
  camera: "Caméra",
  routeur: "Routeur",
  chargeur: "Chargeur",
};

// Mots-clés et patterns de bruit OCR / en-têtes de colonnes à éliminer
const IGNORED_KEYWORDS = [
  "désignation",
  "designation",
  "article",
  "quantité",
  "quantite",
  "prix unitaire",
  "prix",
  "total ht",
  "total ttc",
  "total",
  "sous-total",
  "nom du produit",
  "nom du service",
  "ajouter une ligne",
  "notes",
  "conditions",
  "merci",
  "page 1",
  "tva",
  "remise",
];

const MAX_DESCRIPTION_LENGTH = 100_000;

export function parseDocumentOfflineText(
  description: string,
  clients: Client[] = [],
  products: Product[] = []
): AIExtractionResult {
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return { success: false, error: "La description est trop longue à analyser." };
  }

  const text = description.trim();
  if (!text) {
    return { success: false, error: "Veuillez saisir une description" };
  }

  // 1. Extraction du nom du client
  let extractedClientName = "";
  let matchedClientId: string | null = null;
  let workingText = text;

  // Patterns pour repérer le client
  const clientRegex =
    /(?:fais\s+(?:un\s+)?(?:devis|facture)\s+pour|créer\s+(?:un\s+)?(?:devis|facture)\s+pour|devis\s+pour|facture\s+pour|client\s*:?)\s+([A-Za-zÀ-ÿ0-9_-]+)/i;

  const clientMatch = workingText.match(clientRegex);
  if (clientMatch && clientMatch[1]) {
    const rawClient = clientMatch[1].trim();
    if (
      !["un", "une", "achat", "vente", "le", "la", "les", "ce", "cette"].includes(
        rawClient.toLowerCase()
      )
    ) {
      extractedClientName = capitalizeFirstLetter(rawClient);
      workingText = workingText.replace(clientMatch[0], "").trim();
    }
  }

  if (!extractedClientName) {
    const fallbackClientMatch = workingText.match(
      /(?:pour|client)\s+([A-ZÀ-ÿ][a-zà-ÿ0-9_-]+)(?:\s+pour|\s+avec|\s*[,;:\.\n]|$)/
    );
    if (fallbackClientMatch && fallbackClientMatch[1]) {
      extractedClientName = capitalizeFirstLetter(fallbackClientMatch[1].trim());
      workingText = workingText.replace(fallbackClientMatch[0], "").trim();
    }
  }

  // Chercher dans le catalogue clients si correspondance
  if (extractedClientName) {
    const found = clients.find(
      (c) =>
        c.name.toLowerCase().includes(extractedClientName.toLowerCase()) ||
        extractedClientName.toLowerCase().includes(c.name.toLowerCase())
    );
    if (found) {
      matchedClientId = found.id;
      extractedClientName = found.name;
    }
  }

  // Nettoyer les phrases de liaison d'introduction
  workingText = workingText
    .replace(
      /^(?:pour\s+)?(?:achat|acheté|achat\s+de|achat\s+d'|vente\s+de|fourniture\s+de)\s+/i,
      ""
    )
    .replace(/^[:\-–=,\.]\s*/, "")
    .trim();

  // 2. Découpage en segments d'articles
  const rawSegments = workingText
    .split(
      /[\n,;+]|\b(?:et\s+(?:un|une|le|la|les|d'|l'|\d+)|et\b|puis\b|ainsi que\b|avec\s+(?:un|une|\d+))\b/i
    )
    .map((s) => s.trim())
    .filter(Boolean);

  const groupedSegments: string[] = [];
  for (let i = 0; i < rawSegments.length; i += 1) {
    const segment = rawSegments[i];
    if (!segment || shouldSkipHeaderLine(segment)) continue;

    const isNumericMetadata = looksLikeItemMetadata(segment);
    if (isNumericMetadata) {
      const previous = groupedSegments[groupedSegments.length - 1];
      if (
        previous &&
        previous &&
        !shouldSkipHeaderLine(previous) &&
        !looksLikeItemMetadata(previous)
      ) {
        groupedSegments[groupedSegments.length - 1] = `${previous}\n${segment}`;
      }
      continue;
    }

    const block = [segment];
    let j = i + 1;
    while (j < rawSegments.length && looksLikeItemMetadata(rawSegments[j])) {
      block.push(rawSegments[j]);
      j += 1;
    }

    if (block.length > 1) {
      groupedSegments.push(block.join("\n"));
      i = j - 1;
      continue;
    }

    groupedSegments.push(segment);
  }

  const items: Array<{
    product_id: string | null;
    designation: string;
    quantity: number;
    unit_price: number;
  }> = [];

  for (const segment of groupedSegments) {
    parseSingleItemCandidate(segment, items, products);
  }

  // Si aucun article trouvé avec prix, tenter un matching direct sur l'ensemble du texte
  if (items.length === 0 && workingText) {
    parseSingleItemCandidate(workingText, items, products, true);
  }

  if (items.length === 0) {
    return {
      success: false,
      error: "Impossible d'extraire des articles. Exemple : '2 ordinateurs à 150000 FCFA'",
    };
  }

  return {
    success: true,
    providerUsed: "Moteur IA Local (Hors-Ligne 🟡)",
    data: {
      clientName: extractedClientName || "Client non spécifié",
      matchedClientId,
      items,
      notes: "", // On laisse vide pour que l'utilisateur décide de saisir ses conditions
      date: new Date().toISOString().split("T")[0],
    },
  };
}

function shouldSkipHeaderLine(line: string): boolean {
  const normalized = line
    .replace(/[\u00A0\s]+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return true;

  return (
    [
      "articles",
      "désignation / article",
      "designation / article",
      "quantité",
      "quantite",
      "prix unitaire",
      "total ht",
      "total ttc",
      "total",
      "sous-total",
      "nom du produit",
      "nom du service",
      "page 1",
      "tva",
      "remise",
      "notes",
      "conditions",
      "merci",
    ].includes(normalized) ||
    normalized.includes("désignation") ||
    normalized.includes("designation") ||
    normalized.includes("quantité") ||
    normalized.includes("quantite") ||
    normalized.includes("prix unitaire") ||
    normalized.includes("total ht") ||
    normalized.includes("total ttc")
  );
}

function looksLikeItemName(line: string): boolean {
  const normalized = line.replace(/[\u00A0\s]+/g, " ").trim();
  if (!normalized || /^\d+([.,]\d+)?$/.test(normalized)) return false;
  if (/^(?:[A-Za-zÀ-ÿ0-9]+(?:\s+[A-Za-zÀ-ÿ0-9]+){0,6})$/.test(normalized)) return true;
  return /[A-Za-zÀ-ÿ]/.test(normalized);
}

function looksLikeItemMetadata(line: string): boolean {
  const normalized = line.replace(/[\u00A0\s]+/g, " ").trim();
  if (!normalized || shouldSkipHeaderLine(normalized)) return false;
  return /^(?:\d+(?:[.,]\d+)?(?:\s*(?:x|fois|unités?|unites?|pieces?|pcs?|paquets?|sacs?|cartons?))?|\d{1,3}(?:[\s.\u00A0]\d{3})+(?:\s*(?:fcfa|cfa|f))?|\d+(?:[.,]\d+)?\s*(?:fcfa|cfa|f)?)$/i.test(
    normalized
  );
}

function looksLikeTableRow(line: string): boolean {
  const normalized = line.replace(/[\u00A0\s]+/g, " ").trim();
  if (!normalized) return false;
  return (
    /^\d+(?:[.,]\d+)?$/.test(normalized) ||
    /^(?:\d{1,3}(?:[\s.\u00A0]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:fcfa|cfa|f)?$/i.test(normalized)
  );
}

function parseCurrencyValue(value: string): number | null {
  const normalized = value
    .replace(/[\u00A0]/g, " ")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  const match = normalized.match(
    /(\d{1,3}(?:[\s.\u00A0]\d{3})+|\d+)(?:[.,]\d+)?\s*(?:fcfa|cfa|f)?/i
  );
  if (!match) return null;

  const digits = match[1].replace(/[\s.\u00A0]/g, "");
  const decimals = normalized.includes(",")
    ? (normalized.split(",")[1]?.replace(/[^\d]/g, "") ?? "")
    : "";
  const finalValue = decimals ? Number(`${digits}.${decimals}`) : Number(digits);
  return Number.isFinite(finalValue) && finalValue > 0 ? Math.round(finalValue) : null;
}

function parseSingleItemCandidate(
  line: string,
  items: Array<{
    product_id: string | null;
    designation: string;
    quantity: number;
    unit_price: number;
  }>,
  products: Product[] = [],
  allowZeroPrice: boolean = false
) {
  let clean = line.trim();
  const lower = clean.toLowerCase();

  if (clean.includes("\n")) {
    const blockLines = clean
      .split(/\n+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .filter((segment) => !shouldSkipHeaderLine(segment));

    if (blockLines.length >= 2) {
      const designationLine = blockLines[0];
      const numericMeta = blockLines
        .slice(1)
        .map((segment) => parseCurrencyValue(segment))
        .filter((value): value is number => value !== null);

      let quantity = 1;
      let unitPrice = 0;

      if (numericMeta.length >= 2) {
        quantity = Math.max(1, Math.round(numericMeta[0]));
        unitPrice = numericMeta[1];
      } else if (numericMeta.length === 1) {
        unitPrice = numericMeta[0];
      }

      const normalizedName = designationLine
        .replace(
          /^(?:fais\s+(?:un|une)\s+)?(?:pour\s+)?(?:achat\s+de|vente\s+de|fourniture\s+de|devis\s+pour|facture\s+pour)\s+/i,
          ""
        )
        .replace(/^(?:un|une|le|la|les|des|d'|l'|du|de|au|aux)\s+/i, "")
        .trim();

      const baseDesignation = normalizedName || designationLine;
      const finalDesignation = applyAutoCorrections(baseDesignation);
      const matchedProduct = products.find(
        (p) => p.name.toLowerCase() === finalDesignation.toLowerCase()
      );
      const finalPrice = matchedProduct?.price ?? unitPrice;

      if (!finalDesignation || finalDesignation.length < 2) return;
      if (finalPrice === 0 && !matchedProduct && !allowZeroPrice) return;

      items.push({
        product_id: matchedProduct?.id ?? null,
        designation: matchedProduct?.name ?? capitalizeFirstLetter(finalDesignation),
        quantity: Math.max(1, quantity),
        unit_price: finalPrice,
      });
      return;
    }
  }

  // 1. Filtrer les bruits OCR, en-têtes et métadonnées
  if (
    clean.includes("©") ||
    clean.includes("®") ||
    clean.length < 2 ||
    IGNORED_KEYWORDS.some(
      (kw) =>
        lower === kw ||
        lower.includes("désignation") ||
        lower.includes("prix unitaire") ||
        lower.includes("total ht")
    )
  ) {
    return;
  }

  // Nettoyer les verbes / préfixes de tête
  clean = clean
    .replace(
      /^(?:fais\s+(?:un|une)\s+)?(?:pour\s+)?(?:achat\s+de|achat\s+d'|vente\s+de|fourniture\s+de|pour\s+achat\s+de|pour)\s+/i,
      ""
    )
    .replace(/^(?:fais\s+(?:un|une)\s+)?(?:devis\s+pour|facture\s+pour)\s+/i, "")
    .replace(/^[:\-–=•\*\.]\s*/, "")
    .trim();

  // 2. Extraction de la quantité
  let quantity = 1;
  const numQtyMatch = clean.match(
    /^(\d+)\s*(?:x|\*|unités?|pièces?|pcs?|paquets?|sacs?|cartons?)?\s+/i
  );
  if (numQtyMatch) {
    quantity = parseInt(numQtyMatch[1], 10);
    clean = clean.slice(numQtyMatch[0].length).trim();
  } else {
    const wordQtyMatch = clean.match(/^(?:un|une|le|la|les|des|d'|l')\s+/i);
    if (wordQtyMatch) {
      quantity = 1;
      clean = clean.slice(wordQtyMatch[0].length).trim();
    }
  }

  // 3. Extraction du prix unitaire
  let unitPrice = 0;
  const priceRegex =
    /(?:à|au prix de|pour|coûtant|coûte|prix\s*:?|:|@)?\s*(\d{1,3}(?:[\s\.]\d{3})+|\d+k?)\s*(?:fcfa|cfa|f|frs?|francs?|\$|€)?\s*$/i;

  const priceMatch = clean.match(priceRegex);
  if (priceMatch && priceMatch[1]) {
    const rawPriceStr = priceMatch[1].toLowerCase().replace(/\s+/g, "");
    if (rawPriceStr.endsWith("k")) {
      unitPrice = parseFloat(rawPriceStr.replace("k", "")) * 1000;
    } else {
      const normalizedDigits = rawPriceStr.replace(/\./g, "");
      const parsed = parseInt(normalizedDigits, 10);
      if (!isNaN(parsed) && parsed > 0) {
        unitPrice = parsed;
      }
    }
    clean = clean.slice(0, clean.lastIndexOf(priceMatch[0])).trim();
  }

  // Supprimer les mentions de prix qui peuvent rester au milieu de la désignation
  // Exemple: "caméras solaires à 45000, installation" -> retirer "à 45000"
  clean = clean
    .replace(
      /(?:,|\s)*\s*(?:à|au prix de|@)\s*(\d{1,3}(?:[\s.\u00A0]\d{3})+|\d+k?)(?:\s*(?:fcfa|cfa|f|frs?|francs?))?/gi,
      ""
    )
    .trim();

  // Retirer les mots services collés à la suite (installation, maintenance, livraison, etc.)
  clean = clean
    .replace(/[,;\-–]\s*(installation|maintenance|livraison|service|forfait|pose|montage)\b/gi, "")
    .trim();

  // 4. Nettoyage de la désignation et retrait des articles définis / indéfinis ("le", "la", "un", "l'", etc.)
  let rawDesignation = clean
    .replace(/^[:\-–=à]\s*/, "")
    .replace(/\s*(?:à|au prix de|pour|fcfa|f|cfa|\$|€)\s*$/i, "")
    .replace(/^(?:achat\s+de|achat\s+d'|vente\s+de|fourniture\s+de)\s+/i, "")
    .replace(/^(?:un|une|le|la|les|des|d'|l'|du|de|au|aux)\s+/i, "")
    .trim();

  if (!rawDesignation || rawDesignation.length < 2) return;
  if (IGNORED_KEYWORDS.includes(rawDesignation.toLowerCase())) return;

  // 5. Auto-correction intelligente des termes (ex: "guect" -> "Gucci", "powerbank" -> "Powerbank")
  rawDesignation = applyAutoCorrections(rawDesignation);

  // 6. Correspondance produit
  const matchedProduct = products.find(
    (p) => p.name.toLowerCase() === rawDesignation.toLowerCase()
  );

  const finalPrice = matchedProduct?.price ?? unitPrice;

  // Si le prix est 0 et que le produit n'existe pas au catalogue, ignorer
  if (finalPrice === 0 && !matchedProduct && !allowZeroPrice) {
    return;
  }

  items.push({
    product_id: matchedProduct?.id ?? null,
    designation: matchedProduct?.name ?? capitalizeFirstLetter(rawDesignation),
    quantity: Math.max(1, quantity),
    unit_price: finalPrice,
  });
}

/**
 * Corrige les termes mal orthographiés ou déformés par l'OCR (ex: "sac guect" -> "Sac Gucci")
 */
function applyAutoCorrections(text: string): string {
  let result = text;
  const words = result.split(/\s+/);

  const correctedWords = words.map((w) => {
    const cleanWord = w.toLowerCase().replace(/[^a-z0-9à-ÿ]/gi, "");
    if (AUTO_CORRECT_DICTIONARY[cleanWord]) {
      return AUTO_CORRECT_DICTIONARY[cleanWord];
    }
    return w;
  });

  result = correctedWords.join(" ");

  // Remplacements pour expressions multi-mots
  for (const [key, val] of Object.entries(AUTO_CORRECT_DICTIONARY)) {
    if (key.includes(" ")) {
      const regex = new RegExp(`\\b${key}\\b`, "gi");
      result = result.replace(regex, val);
    }
  }

  return result;
}

function capitalizeFirstLetter(val: string): string {
  if (!val) return "";
  return val.charAt(0).toUpperCase() + val.slice(1);
}
