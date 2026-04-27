/**
 * NEURAL — Construction du user prompt pour le generateur d'articles.
 *
 * Le system prompt vit dans lib/ai/router.ts (surface publication-generator).
 * Ici on serialise uniquement le brief en un message user lisible par Claude.
 */

import type { Brief, BriefSource, BriefPlanSection } from "./brief-schema";

function formatPlan(plan: BriefPlanSection[]): string {
  return plan
    .map((section, index) => {
      const points = section.points.map((p) => `  - ${p}`).join("\n");
      return `### Section ${index + 1} : ${section.section}\n${points}`;
    })
    .join("\n\n");
}

function formatSource(source: BriefSource, index: number): string {
  const lines = [`${index + 1}. **${source.title}** — ${source.url}`];
  if (source.note) lines.push(`   Note : ${source.note}`);
  if (source.quote) lines.push(`   Citation : "${source.quote}"`);
  return lines.join("\n");
}

function formatSources(sources: BriefSource[]): string {
  if (sources.length === 0) {
    return "_Aucune source fournie — n'invente aucun chiffre ni citation._";
  }
  return sources.map(formatSource).join("\n\n");
}

function formatConstraints(constraints: string[]): string {
  if (constraints.length === 0) return "_Aucune contrainte additionnelle._";
  return constraints.map((c) => `- ${c}`).join("\n");
}

export function buildUserPrompt(brief: Brief): string {
  return [
    `# Brief editorial`,
    ``,
    `**Titre** : ${brief.title}`,
    `**Sous-titre** : ${brief.subtitle}`,
    `**Categorie** : ${brief.category}`,
    `**Audience** : ${brief.audience}`,
    `**Tags** : ${brief.tags.join(", ") || "_aucun_"}`,
    `**Longueur cible** : ${brief.targetWordCount} mots (+/- 20%)`,
    `**Temps de lecture annonce** : ${brief.readingTime}`,
    ``,
    `## Style guide`,
    brief.styleGuide,
    ``,
    `## TLDR (idees cles a couvrir)`,
    ...brief.tldr.map((item) => `- ${item}`),
    ``,
    `## Contraintes specifiques`,
    formatConstraints(brief.constraints),
    ``,
    `## Plan a suivre`,
    formatPlan(brief.plan),
    ``,
    `## Sources a citer`,
    formatSources(brief.sources),
    ``,
    `---`,
    ``,
    `Redige maintenant le corps MDX complet de cet article en respectant :`,
    `- le plan exact ci-dessus (une section H2 par "section" du plan) ;`,
    `- le style guide ;`,
    `- les contraintes specifiques ;`,
    `- la longueur cible ;`,
    `- l'usage des composants MDX presentes dans le system prompt ;`,
    `- la regle de citation des sources.`,
    ``,
    `Ne genere PAS de frontmatter. Commence directement par le premier "## ${brief.plan[0].section}".`,
  ].join("\n");
}
