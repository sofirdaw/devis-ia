import { describe, it, expect } from "vitest";
import { parseDocumentOfflineText } from "../offline-parser";
import type { Client, Product } from "@/types";

describe("Moteur de Parsing Hors-Ligne (NLP Heuristique)", () => {
  const mockClients: Client[] = [
    {
      id: "cli_1",
      company_id: "comp_1",
      name: "Moussa Diop",
      email: "moussa@example.com",
      phone: "770000000",
      address: "Dakar",
      created_at: new Date().toISOString(),
    },
  ];

  const mockProducts: Product[] = [
    {
      id: "prod_1",
      company_id: "comp_1",
      name: "Caméra Solaire",
      description: "4G HD",
      price: 45000,
      supplier_id: null,
      created_at: new Date().toISOString(),
    },
  ];

  it("extrait le nom du client et les articles avec prix et quantité", () => {
    const input = "Devis pour Moussa : 2 caméras solaires à 45000 et installation à 10000";
    const result = parseDocumentOfflineText(input, mockClients, mockProducts);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.data) {
      expect(result.data.clientName.toLowerCase()).toContain("moussa");
      expect(result.data.items.length).toBeGreaterThanOrEqual(1);
      expect(result.data.notes).toBe("");
    }
  });

  it("sépare correctement un produit et une installation lorsqu'ils sont exprimés dans la même phrase", () => {
    const input = "Devis pour Moussa : 2 caméras solaires à 45000, installation à 10000";
    const result = parseDocumentOfflineText(input, mockClients, mockProducts);

    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.items[0].designation).toMatch(/caméra|camera|solaire/i);
    expect(result.data?.items[0].quantity).toBe(2);
    expect(result.data?.items[0].unit_price).toBe(45000);
    expect(result.data?.items[1].designation).toMatch(/installation/i);
    expect(result.data?.items[1].unit_price).toBe(10000);
  });

  it("gère une entrée vide avec une erreur explicite", () => {
    const result = parseDocumentOfflineText("", mockClients, mockProducts);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("extrait un devis avec plusieurs articles", () => {
    const input = "Facture pour Ibrahim, 3 HP EliteBook à 250000 et 1 souris à 5000";
    const result = parseDocumentOfflineText(input, mockClients, mockProducts);

    expect(result.success).toBe(true);
    expect(result.data?.items.length).toBeGreaterThanOrEqual(2);
    expect(result.data?.notes).toBe("");
  });

  it("extrait proprement les noms d'articles (avec correction guect -> Gucci et sans le/la) et laisse les notes vides", () => {
    const input = `Articles
Désignation / Article
Quantité
Prix unitaire
Total HT
Fais un devis pour albert pour achat de le powerbank 15.000f + un sac guect à 20.000
Fosses Burenness © décesace cop
Nom du produit ou service...`;

    const result = parseDocumentOfflineText(input, mockClients, mockProducts);

    expect(result.success).toBe(true);
    expect(result.data?.clientName).toBe("Albert");
    expect(result.data?.notes).toBe("");
    expect(result.data?.items).toHaveLength(2);

    expect(result.data?.items[0].designation).toBe("Powerbank");
    expect(result.data?.items[0].unit_price).toBe(15000);
    expect(result.data?.items[0].quantity).toBe(1);

    expect(result.data?.items[1].designation).toBe("Sac Gucci");
    expect(result.data?.items[1].unit_price).toBe(20000);
    expect(result.data?.items[1].quantity).toBe(1);
  });

  it("ignore les en-têtes du tableau et extrait les lignes d'articles avec quantité et prix", () => {
    const input = `Articles
Désignation / Article
Quantité
Prix unitaire
Total HT
Fais une pour achat de Souris sans fil
1
1000
1 000 F CFA

Livre
1
2000
2 000 F CFA`;

    const result = parseDocumentOfflineText(input, mockClients, mockProducts);

    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.items[0].designation).toBe("Souris sans fil");
    expect(result.data?.items[0].quantity).toBe(1);
    expect(result.data?.items[0].unit_price).toBe(1000);
    expect(result.data?.items[1].designation).toBe("Livre");
    expect(result.data?.items[1].quantity).toBe(1);
    expect(result.data?.items[1].unit_price).toBe(2000);
  });
});
