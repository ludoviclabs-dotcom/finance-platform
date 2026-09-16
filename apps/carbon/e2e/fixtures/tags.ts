/**
 * Étiquettes Playwright partagées par les specs et `playwright.config.ts`.
 *
 * `SANS_API` marque un test exécutable contre un simple `next start`, sans
 * backend FastAPI ni compte de test : c'est le périmètre du projet `sans-api`,
 * joué à chaque push sur master (workflow `e2e.yml`). Tout test non étiqueté
 * relève du projet `avec-api`.
 */
export const SANS_API = "@sans-api";
