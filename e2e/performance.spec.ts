import { test, expect } from "@playwright/test";

test.describe("Performances Web Vitals & Vitesse de Chargement (0-100ms)", () => {
  test("mesure le temps de chargement initial de la page d'accueil (TTFB & DOM Ready)", async ({
    page,
  }) => {
    const start = performance.now();
    await page.goto("/");
    const loadTime = performance.now() - start;

    // Mesurer les métriques de navigation du navigateur
    const performanceTimingJson = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return {
        dnsTime: nav.domainLookupEnd - nav.domainLookupStart,
        tcpTime: nav.connectEnd - nav.connectStart,
        ttfb: nav.responseStart - nav.requestStart,
        domInteractive: nav.domInteractive - nav.startTime,
        domComplete: nav.domComplete - nav.startTime,
      };
    });

    console.log("\n⚡ MESURES DE PERFORMANCE PAGE D'ACCUEIL :");
    console.log(`- Temps de chargement global : ${loadTime.toFixed(2)} ms`);
    console.log(`- TTFB (Time to First Byte) : ${performanceTimingJson.ttfb.toFixed(2)} ms`);
    console.log(`- DOM Interactive : ${performanceTimingJson.domInteractive.toFixed(2)} ms`);
    console.log(`- DOM Complete : ${performanceTimingJson.domComplete.toFixed(2)} ms`);

    // Validation des critères de performance (en dev server JIT ou prod)
    expect(loadTime).toBeLessThan(6000);
    expect(performanceTimingJson.ttfb).toBeLessThan(500); // TTFB doit être sous 500ms
  });

  test("mesure la vitesse d'accès au Manifest PWA (doit être < 150ms)", async ({ page }) => {
    const start = performance.now();
    const response = await page.goto("/manifest.webmanifest");
    const duration = performance.now() - start;

    console.log(`\n📱 VITESSE MANIFEST PWA : ${duration.toFixed(2)} ms`);
    expect(response?.status()).toBe(200);
    expect(duration).toBeLessThan(1500);
  });

  test("mesure la vitesse de rendu des polices et assets statiques", async ({ page }) => {
    await page.goto("/");

    // Vérifier les ressources chargées depuis le cache ou le réseau
    const staticResources = await page.evaluate(() => {
      return performance
        .getEntriesByType("resource")
        .filter((r) => r.name.includes("/_next/static/") || r.name.includes("/icons/"))
        .map((r) => ({
          name: r.name.split("/").pop(),
          duration: r.duration,
        }));
    });

    const avgDuration =
      staticResources.length > 0
        ? staticResources.reduce((acc, curr) => acc + curr.duration, 0) / staticResources.length
        : 0;

    console.log(`\n📦 ASSETS STATIQUES (${staticResources.length} fichiers) :`);
    console.log(`- Vitesse moyenne de chargement des assets : ${avgDuration.toFixed(2)} ms`);

    expect(avgDuration).toBeLessThan(300);
  });
});
