import { test, expect } from "@playwright/test";

test.describe("PWA / Offline scenarios (squelette)", () => {
  test.skip("Installation PWA (display-mode: standalone) - manuel/à automatiser", async ({
    page,
  }) => {
    // TODO: automatiser l'installation PWA selon la plateforme (desktop/mobile)
    // - Vérifier que `display-mode` peut être simulé
    // - Vérifier que l'app fonctionne en standalone
  });

  test.skip("Navigation hors-ligne sans redirection après logout", async ({ page, context }) => {
    // Préconditions manuelles ou via scripts d'initialisation :
    // - Pré-remplir localStorage `devis_ia_auth_storage` pour simuler session locale
    // - Charger l'app, passer en offline (context.setOffline(true))
    // - Cliquer sur le bouton de déconnexion et vérifier qu'il n'y a pas de navigation vers /login
  });

  test.skip("Création de devis/facture offline puis sync après reconnection", async ({ page }) => {
    // Squelette :
    // - Préparer une session locale
    // - Passer en offline
    // - Créer un devis via l'UI
    // - Revenir online et vérifier que l'élément est synchronisé (API / UI)
  });
});
