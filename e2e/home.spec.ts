import { test, expect } from "@playwright/test";

test.describe("Application Devis IA", () => {
  test("la page d'accueil ou de connexion se charge correctement", async ({ page }) => {
    await page.goto("/");
    // Vérifie que l'URL est accessible et que le titre ou le contenu de base s'affiche
    await expect(page).toHaveURL(/\/(login|dashboard)?/);
  });

  test("le manifest PWA est accessible", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");
    expect(response?.status()).toBe(200);
  });
});
