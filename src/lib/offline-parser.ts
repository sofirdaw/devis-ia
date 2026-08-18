/**
 * Moteur d'Extraction IA Local de Secours (100% Hors-Ligne)
 *
 * Analyse la description en langage naturel saisie par l'utilisateur
 * directement sur l'appareil (sans envoyer de requête réseau).
 */

import type { Client, Product } from "@/types";
import type { AIExtractionResult } from "@/app/actions/ai";

export function parseDocumentOfflineText(
  description: string,
  clients: Client[] = [],
  products: Product[] = []
): AIExtractionResult {
  const text = description.trim();
  if (!text) {
    return { success: false, error: "Veuillez saisir une description" };
  }

  // 1. Extraction du nom du client
  let extractedClientName = "";
  let matchedClientId: string | null = null;

  const clientPatterns = [
    /(?:devis|facture)?\s*pour\s+([A-ZÀ-ÿa-z0-9\s'-]+?)(?::|,|\.|et|\n|\d|$)/i,
    /client\s+([A-ZÀ-ÿa-z0-9\s'-]+?)(?::|,|\.|et|\n|\d|$)/i,
  ];

  for (const pattern of clientPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      extractedClientName = match[1].trim();
      break;
    }
  }

  // Si un nom de client est trouvé, chercher dans le catalogue clients
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

  // 2. Extraction des lignes d'articles
  // On découpe la description par retours à la ligne ou par virgules/conjonctions
  const lines = text
    .split(/\n|,|;|\bet\b/i)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: Array<{
    product_id: string | null;
    designation: string;
    quantity: number;
    unit_price: number;
  }> = [];

  for (const line of lines) {
    // Si la ligne ne contient que le nom du client ou un titre, on passe
    if (
      line.toLowerCase().startsWith("devis pour") ||
      line.toLowerCase().startsWith("facture pour")
    ) {
      // Si la ligne contient un ':', on extrait la partie après le ':'
      if (line.includes(":")) {
        const afterColon = line.split(":")[1].trim();
        if (afterColon) {
          parseSingleItem(afterColon, items, products);
        }
      }
      continue;
    }

    parseSingleItem(line, items, products);
  }

  // Si aucun article n'a été extrait par découpage, tenter une extraction globale sur l'ensemble du texte
  if (items.length === 0) {
    parseSingleItem(text, items, products);
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
      notes: "Généré en mode 100% hors-ligne (moteur local)",
      date: new Date().toISOString().split("T")[0],
    },
  };
}

function parseSingleItem(
  line: string,
  items: Array<{
    product_id: string | null;
    designation: string;
    quantity: number;
    unit_price: number;
  }>,
  products: Product[] = []
) {
  // Nettoyer la phrase (retirer les mots de liaison au début)
  let cleanLine = line.replace(/^(pour|avec|client|devis|facture)\s+/i, "").trim();

  // Pattern pour repérer : [Quantité] [Désignation] [à / pour] [Prix] [Devise]
  // Exemple: "2 caméras solaires à 45000 FCFA" ou "3 ordinateurs 250000"
  const qtyMatch = cleanLine.match(/(\d+)\s*(?:x|\*|unités?|pièces?)?\s+/i);
  let quantity = 1;

  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
    // Retirer la quantité du texte pour isoler la désignation et le prix
    cleanLine = cleanLine.replace(qtyMatch[0], "").trim();
  }

  // Recherche du prix (nombres à la fin de la ligne ou précédés de 'à', 'au prix de', 'à 45000', etc.)
  const priceMatch = cleanLine.match(/(?:à|au prix de|:|=|@)?\s*(\d[\d\s]*)\s*(?:fcfa|f|cfa|\$|€|francs?)?/i);
  let unitPrice = 0;

  if (priceMatch) {
    const digitsOnly = priceMatch[1].replace(/\s+/g, "");
    const parsedPrice = parseInt(digitsOnly, 10);
    if (!isNaN(parsedPrice) && parsedPrice > 0) {
      unitPrice = parsedPrice;
      cleanLine = cleanLine.replace(priceMatch[0], "").trim();
    }
  }

  // Ce qui reste est la désignation
  const designation = cleanLine
    .replace(/^[:\-–=à]\s*/, "")
    .replace(/\s*(?:à|pour|fcfa|f|cfa|\$|€)\s*$/i, "")
    .trim();

  // Ignorer les fragments vides ou non pertinents
  if (!designation || designation.length < 2) return;

  // Tenter un matching avec le catalogue produit existant
  const matchedProduct = products.find(
    (p) => p.name.toLowerCase() === designation.toLowerCase()
  );

  items.push({
    product_id: matchedProduct?.id ?? null,
    designation: matchedProduct?.name ?? capitalizeFirstLetter(designation),
    quantity: Math.max(1, quantity),
    unit_price: matchedProduct?.price ?? unitPrice,
  });
}

function capitalizeFirstLetter(val: string): string {
  return val.charAt(0).toUpperCase() + val.slice(1);
}
