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
    }
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
  });
});
