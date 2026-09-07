import { describe, it, expect } from "vitest";
import { parseDocumentOfflineText } from "../offline-parser";
import type { Client, Product } from "@/types";

describe("Test de Charge & Concurrence Locale (Stress Test)", () => {
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

  it("traite 1 000 requêtes simultanées de parsing sans ralentissement", async () => {
    const startTime = performance.now();
    const NUM_CONCURRENT_USERS = 1000;

    const promises = Array.from({ length: NUM_CONCURRENT_USERS }).map((_, i) => {
      return new Promise<{ success: boolean; duration: number }>((resolve) => {
        const itemStart = performance.now();
        const res = parseDocumentOfflineText(
          `Devis pour Moussa : ${i + 1} caméras solaires à 45000 et installation à 10000`,
          mockClients,
          mockProducts
        );
        resolve({ success: res.success, duration: performance.now() - itemStart });
      });
    });

    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;

    const allSuccessful = results.every((r) => r.success);
    const avgDuration =
      results.reduce((acc, curr) => acc + curr.duration, 0) / NUM_CONCURRENT_USERS;

    console.log(`\n📊 RÉSULTATS DU BENCHMARK :`);
    console.log(`- Utilisateurs/Requêtes simultanés : ${NUM_CONCURRENT_USERS}`);
    console.log(
      `- Temps total de traitement : ${totalTime.toFixed(2)} ms (${(totalTime / 1000).toFixed(3)} s)`
    );
    console.log(`- Temps moyen par requête : ${avgDuration.toFixed(4)} ms`);
    console.log(
      `- Débit (Throughput) : ${((NUM_CONCURRENT_USERS / totalTime) * 1000).toFixed(0)} requêtes/seconde`
    );

    expect(allSuccessful).toBe(true);
    // Le seuil garde une marge pour les runners partagés et les suites parallèles.
    expect(totalTime).toBeLessThan(2000);
  });
});
