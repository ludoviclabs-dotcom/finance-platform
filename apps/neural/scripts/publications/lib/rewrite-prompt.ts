/**
 * NEURAL — Construction du user prompt pour la commande pub:import.
 *
 * Different de prompt-builder.ts (utilise par pub:gen) :
 * ici on demande au LLM de REECRIRE un draft existant en MDX, en preservant
 * autant que possible les mots et le plan de l'auteur, et en plaçant
 * les composants MDX (Figure/ChartBlock/DataTable/StatBlock) aux bons endroits
 * d'apres le manifeste d'assets fourni.
 */

import type { Brief } from "./brief-schema";
import type { AssetManifest } from "./asset-manager";
import { describeAssetsForPrompt } from "./asset-manager";

export interface RewritePromptArgs {
  brief: Brief;
  draftText: string;
  sourceFormat: string;
  manifest: AssetManifest;
}

export function buildRewriteUserPrompt(args: RewritePromptArgs): string {
  const { brief, draftText, sourceFormat, manifest } = args;

  return [
    `# Reecriture editoriale d'un draft existant`,
    ``,
    `**Source** : draft fourni par l'auteur, format ${sourceFormat}.`,
    `**Slug cible** : ${brief.slug}`,
    `**Titre** : ${brief.title}`,
    `**Sous-titre** : ${brief.subtitle}`,
    `**Categorie** : ${brief.category}`,
    `**Audience** : ${brief.audience}`,
    `**Tags** : ${brief.tags.join(", ") || "_aucun_"}`,
    `**Longueur cible** : ${brief.targetWordCount} mots (+/- 20%)`,
    ``,
    `## Style guide`,
    brief.styleGuide,
    ``,
    `## Contraintes`,
    brief.constraints.length > 0
      ? brief.constraints.map((c) => `- ${c}`).join("\n")
      : "_(aucune)_",
    ``,
    `## Assets disponibles a integrer`,
    ``,
    describeAssetsForPrompt(manifest),
    ``,
    `## Draft source de l'auteur`,
    ``,
    "```",
    draftText.trim(),
    "```",
    ``,
    `---`,
    ``,
    `Ta tache : reecrire ce draft en corps MDX NEURAL valide.`,
    ``,
    `Regles strictes :`,
    `1. PRESERVE le plan et les idees de l'auteur autant que possible — tu re-formates et tu enrichis, tu ne reinventes pas.`,
    `2. Conserve la voix et les formulations cles ; ameliore uniquement la fluidite, la structure Hn, et la clarte.`,
    `3. Place les assets aux endroits pertinents :`,
    `   - utilise <ChartBlock chartKey="..."/>, <DataTable tableKey="..."/>, <StatBlock statKey="..."/> avec les keys EXACTES listees ci-dessus (le script substituera les donnees reelles).`,
    `   - utilise <Figure src="..." .../> pour les images, avec le chemin EXACT donne ci-dessus.`,
    `4. N'invente AUCUN asset (pas de Figure/Chart/Table avec des cles ou chemins absents de la liste).`,
    `5. Ajoute des <Callout>/<PullQuote> uniquement si l'auteur a deja insiste sur le point dans son draft.`,
    `6. Ne genere PAS de frontmatter — commence directement par "## ${brief.plan[0]?.section ?? "..."}" ou la premiere section H2 du plan reconstitue.`,
    `7. Si le draft est plus long que la cible, condense ; s'il est plus court, ne dilue pas — reste fidele.`,
    `8. Cite les sources externes si l'auteur les a deja inclues sous forme d'URL.`,
    ``,
    `Sortie : UNIQUEMENT le corps MDX, sans preambule ni balise de code englobante.`,
  ].join("\n");
}
