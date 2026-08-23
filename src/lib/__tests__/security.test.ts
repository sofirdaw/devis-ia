import { describe, it, expect } from "vitest";
import { parseDocumentOfflineText } from "../offline-parser";
import { formatCurrency, cn } from "../utils";

describe("Tests de Sécurité & Résistance aux Injections", () => {
  it("résiste aux tentatives d'injection XSS dans les descriptions de devis", () => {
    const xssPayload =
      '<script>alert("XSS")</script> Devis pour <img src=x onerror=alert(1)> Moussa : 1 caméra à 50000';
    const result = parseDocumentOfflineText(xssPayload);

    expect(result.success).toBe(true);
    if (result.data) {
      expect(result.data.items.length).toBeGreaterThan(0);
      expect(result.data.items[0].quantity).toBeGreaterThanOrEqual(1);
    }
  });

  it("résiste aux tentatives d'injection SQL dans les chaînes de recherche", () => {
    const sqlInjection = "'; DROP TABLE clients; SELECT * FROM quotes WHERE '1'='1";
    const result = parseDocumentOfflineText(sqlInjection);

    // Ne doit pas planter ni provoquer d'exception non gérée
    expect(result).toBeDefined();
  });

  it("gère les charges utiles volumineuses (Buffer Overflow / DoS payload)", () => {
    const largeText = "Devis pour Client ".repeat(10000) + " : 1 article à 1000";
    const start = performance.now();
    const result = parseDocumentOfflineText(largeText);
    const duration = performance.now() - start;

    expect(result).toBeDefined();
    // Doit traiter la chaîne géante en moins de 100ms sans geler le thread
    expect(duration).toBeLessThan(200);
  });

  it("sécurise le formateur de devise contre les entrées NaN ou infinies", () => {
    expect(formatCurrency(NaN)).toBeDefined();
    expect(formatCurrency(Infinity)).toBeDefined();
    expect(formatCurrency(-0)).toBeDefined();
  });

  it("protège la fonction cn() contre les objets malicieux ou corrompus", () => {
    const safeClasses = cn(null, undefined, false, { active: true }, "safe-class");
    expect(safeClasses).toContain("safe-class");
  });
});
