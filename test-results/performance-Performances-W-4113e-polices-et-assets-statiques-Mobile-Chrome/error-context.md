# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: performance.spec.ts >> Performances Web Vitals & Vitesse de Chargement (0-100ms) >> mesure la vitesse de rendu des polices et assets statiques
- Location: e2e/performance.spec.ts:44:7

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 300
Received:   2933.0499999998137
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "DevisIA" [level=1] [ref=e9]
      - paragraph [ref=e10]: Créez des devis professionnels en quelques secondes grâce à l'intelligence artificielle
    - generic [ref=e11]:
      - link [ref=e12] [cursor=pointer]:
        - /url: /sign-up
        - button "S'inscrire" [ref=e13]
      - link [ref=e17] [cursor=pointer]:
        - /url: /sign-in
        - button "Se connecter" [ref=e18]
    - generic [ref=e22]:
      - generic [ref=e23]:
        - heading "Devis instantanés" [level=3] [ref=e28]
        - paragraph [ref=e29]: Générez des devis professionnels en quelques clics
      - generic [ref=e30]:
        - heading "Gestion clients" [level=3] [ref=e35]
        - paragraph [ref=e36]: Suivez vos clients et leur historique
      - generic [ref=e37]:
        - heading "IA intégrée" [level=3] [ref=e42]
        - paragraph [ref=e43]: L'IA vous aide à rédiger vos devis
  - button "Open Next.js Dev Tools" [ref=e49] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Performances Web Vitals & Vitesse de Chargement (0-100ms)", () => {
  4  |   test("mesure le temps de chargement initial de la page d'accueil (TTFB & DOM Ready)", async ({
  5  |     page,
  6  |   }) => {
  7  |     const start = performance.now();
  8  |     await page.goto("/");
  9  |     const loadTime = performance.now() - start;
  10 | 
  11 |     // Mesurer les métriques de navigation du navigateur
  12 |     const performanceTimingJson = await page.evaluate(() => {
  13 |       const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  14 |       return {
  15 |         dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
  16 |         tcpTime: nav.connectEnd - nav.connectStart,
  17 |         ttfb: nav.responseStart - nav.requestStart,
  18 |         domInteractive: nav.domInteractive - nav.startTime,
  19 |         domComplete: nav.domComplete - nav.startTime,
  20 |       };
  21 |     });
  22 | 
  23 |     console.log("\n⚡ MESURES DE PERFORMANCE PAGE D'ACCUEIL :");
  24 |     console.log(`- Temps de chargement global : ${loadTime.toFixed(2)} ms`);
  25 |     console.log(`- TTFB (Time to First Byte) : ${performanceTimingJson.ttfb.toFixed(2)} ms`);
  26 |     console.log(`- DOM Interactive : ${performanceTimingJson.domInteractive.toFixed(2)} ms`);
  27 |     console.log(`- DOM Complete : ${performanceTimingJson.domComplete.toFixed(2)} ms`);
  28 | 
  29 |     // Validation des critères de performance (en dev server JIT ou prod)
  30 |     expect(loadTime).toBeLessThan(6000);
  31 |     expect(performanceTimingJson.ttfb).toBeLessThan(500); // TTFB doit être sous 500ms
  32 |   });
  33 | 
  34 |   test("mesure la vitesse d'accès au Manifest PWA (doit être < 150ms)", async ({ page }) => {
  35 |     const start = performance.now();
  36 |     const response = await page.goto("/manifest.webmanifest");
  37 |     const duration = performance.now() - start;
  38 | 
  39 |     console.log(`\n📱 VITESSE MANIFEST PWA : ${duration.toFixed(2)} ms`);
  40 |     expect(response?.status()).toBe(200);
  41 |     expect(duration).toBeLessThan(1500);
  42 |   });
  43 | 
  44 |   test("mesure la vitesse de rendu des polices et assets statiques", async ({ page }) => {
  45 |     await page.goto("/");
  46 | 
  47 |     // Vérifier les ressources chargées depuis le cache ou le réseau
  48 |     const staticResources = await page.evaluate(() => {
  49 |       return performance
  50 |         .getEntriesByType("resource")
  51 |         .filter((r) => r.name.includes("/_next/static/") || r.name.includes("/icons/"))
  52 |         .map((r) => ({
  53 |           name: r.name.split("/").pop(),
  54 |           duration: r.duration,
  55 |         }));
  56 |     });
  57 | 
  58 |     const avgDuration =
  59 |       staticResources.length > 0
  60 |         ? staticResources.reduce((acc, curr) => acc + curr.duration, 0) / staticResources.length
  61 |         : 0;
  62 | 
  63 |     console.log(`\n📦 ASSETS STATIQUES (${staticResources.length} fichiers) :`);
  64 |     console.log(`- Vitesse moyenne de chargement des assets : ${avgDuration.toFixed(2)} ms`);
  65 | 
> 66 |     expect(avgDuration).toBeLessThan(300);
     |                         ^ Error: expect(received).toBeLessThan(expected)
  67 |   });
  68 | });
  69 | 
```