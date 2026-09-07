# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> Application Devis IA >> la page d'accueil ou de connexion se charge correctement
- Location: e2e/home.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Application Devis IA", () => {
  4  |   test("la page d'accueil ou de connexion se charge correctement", async ({ page }) => {
> 5  |     await page.goto("/");
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  6  |     // Vérifie que l'URL est accessible et que le titre ou le contenu de base s'affiche
  7  |     await expect(page).toHaveURL(/\/(login|dashboard)?/);
  8  |   });
  9  | 
  10 |   test("le manifest PWA est accessible", async ({ page }) => {
  11 |     const response = await page.goto("/manifest.webmanifest");
  12 |     expect(response?.status()).toBe(200);
  13 |   });
  14 | });
  15 | 
```