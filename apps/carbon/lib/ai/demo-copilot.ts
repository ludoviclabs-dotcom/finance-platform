/**
 * Réponses scriptées du copilote en mode démonstration (NEURAL_MODE=demo).
 *
 * Aucune API n'est appelée : on renvoie une réponse déterministe, structurée et
 * clairement étiquetée « Démonstration ». Quand des indicateurs réels sont
 * fournis (bundle d'outils), on les reflète ; sinon on s'appuie sur le jeu de
 * démonstration « Exemplia Industrie ».
 */

import type { UIMessage } from "ai";

type DemoTools = {
  carbon?: {
    totalS123Tco2e?: number | null;
    scope1Tco2e?: number | null;
    scope2LbTco2e?: number | null;
    scope3Tco2e?: number | null;
    company?: string | null;
  } | null;
  vsme?: { scorePct?: number | null; statut?: string | null; raisonSociale?: string | null } | null;
} | null;

/** Valeurs du jeu de démonstration (cohérentes avec data/demo-dataset.json). */
const DEMO = { total: 12847, scope1: 3210, scope2: 2415, scope3: 7222 };

const BANNER =
  "> 🟡 **Démonstration — réponses préenregistrées.** Le copilote IA en direct " +
  "(citations ESRS sourcées par le modèle Claude) s'active avec `NEURAL_MODE=live`.\n\n";

function fmt(v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

/** Concatène le texte du dernier message utilisateur. */
function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = (m.parts ?? []) as Array<{ type: string; text?: string }>;
    return parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join(" ");
  }
  return "";
}

export function buildDemoCopilotAnswer(messages: UIMessage[], tools: DemoTools): string {
  const q = lastUserText(messages).toLowerCase();
  const total = tools?.carbon?.totalS123Tco2e ?? DEMO.total;
  const s1 = tools?.carbon?.scope1Tco2e ?? DEMO.scope1;
  const s2 = tools?.carbon?.scope2LbTco2e ?? DEMO.scope2;
  const s3 = tools?.carbon?.scope3Tco2e ?? DEMO.scope3;

  const has = (...kw: string[]) => kw.some((k) => q.includes(k));

  let body: string;

  if (q.trim() === "" || has("bonjour", "salut", "aide", "que peux-tu", "que peux tu", "comment")) {
    body =
      "Je suis le copilote ESG de CarbonCo. Je peux vous aider à :\n\n" +
      "- **Lire votre bilan GES** (Scopes 1, 2 & 3, intensité carbone)\n" +
      "- **Interpréter le VSME** et votre complétude par module\n" +
      "- **Naviguer la CSRD post-Omnibus** (seuils, VSME, BEGES)\n" +
      "- **Estimer une exposition CBAM** et des trajectoires de réduction\n" +
      "- **Expliquer la chaîne de preuve** (audit trail, hash, vérification publique)\n\n" +
      "Posez votre question — par exemple « Quel est mon Scope 3 ? ».";
  } else if (has("scope", "émission", "emission", "ges", "carbone", "bilan", "tco2", "co2")) {
    body =
      "**Répartition de votre bilan GES (méthodologie GHG Protocol)**\n\n" +
      `- Scope 1 (combustion directe) : **${fmt(s1)} tCO₂e**\n` +
      `- Scope 2 (électricité, location-based) : **${fmt(s2)} tCO₂e**\n` +
      `- Scope 3 (chaîne de valeur) : **${fmt(s3)} tCO₂e**\n` +
      `- **Total S1+S2+S3 : ${fmt(total)} tCO₂e**\n\n` +
      "Le Scope 3 domine — c'est typique de l'industrie. Pour le fiabiliser, importez vos " +
      "factures et votre FEC (screening monétaire) afin de passer des estimations aux données " +
      "d'activité réelles.";
  } else if (has("vsme")) {
    body =
      "**Module VSME (standard volontaire EFRAG)**\n\n" +
      "Le VSME se compose des modules **Basic B1–B11** et **Comprehensive C1–C9**. CarbonCo " +
      "pré-remplit automatiquement B1–B3 à partir de votre profil et de votre bilan E1, puis " +
      "vous guide sur les datapoints manquants (chaque saisie devient un fact tracé).\n\n" +
      "Le rapport VSME (PDF + annexe Excel à hash par ligne) est généré et intégré à votre " +
      "Evidence Pack vérifiable.";
  } else if (has("csrd", "omnibus", "réglement", "reglement", "obligation", "seuil")) {
    body =
      "**CSRD après l'Omnibus (2026)**\n\n" +
      "- La CSRD ne s'applique plus qu'aux entreprises **> 1 000 salariés ET > 450 M€** de CA " +
      "(premiers rapports 2028 sur l'exercice 2027).\n" +
      "- Pour toutes les autres, le standard volontaire **VSME** devient le langage de la " +
      "chaîne de valeur (banques, donneurs d'ordre).\n" +
      "- En France, le **BEGES** reste obligatoire pour les entreprises de **plus de 500 salariés**.";
  } else if (has("cbam")) {
    body =
      "**CBAM (mécanisme d'ajustement carbone aux frontières)**\n\n" +
      "Régime définitif depuis le 1ᵉʳ janvier 2026. En dessous de **50 t/an** de marchandises " +
      "couvertes importées, vous êtes exempté ; au-delà, statut de déclarant agréé requis et " +
      "achat de certificats à partir de février 2027. CarbonCo aide à estimer votre exposition.";
  } else if (has("réduction", "reduction", "sbti", "trajectoire", "levier", "action", "abattement", "macc")) {
    body =
      "**Leviers de réduction**\n\n" +
      "La page **Plan d'action** trie vos leviers par **coût d'abattement** " +
      "(`coût marginal = CapEx / (réduction tCO₂e/an × durée de vie)`) et projette la " +
      "trajectoire d'émissions selon les actions engagées vs réalisées. Commencez par les " +
      "postes les plus émissifs de votre Scope 3.";
  } else if (has("preuve", "audit", "hash", "vérif", "verif", "trace", "auditeur")) {
    body =
      "**Chaîne de preuve**\n\n" +
      "Chaque chiffre porte sa source (fichier, onglet, cellule), sa méthode et un **hash " +
      "SHA-256 chaîné**. Chaque export génère un **Evidence Pack** vérifiable publiquement sur " +
      "`/verify`, sans compte ni outil propriétaire. Votre auditeur dispose d'un accès lecture " +
      "seule par lien. Voir la **méthodologie** pour le détail.";
  } else {
    body =
      "En mode démonstration, je réponds sur des thèmes prédéfinis : **bilan GES / scopes**, " +
      "**VSME**, **CSRD & Omnibus**, **CBAM**, **leviers de réduction** et **chaîne de preuve**.\n\n" +
      "Pour des réponses libres et sourcées sur l'intégralité du corpus ESRS, activez le mode " +
      "live (`NEURAL_MODE=live`).";
  }

  return BANNER + body;
}
