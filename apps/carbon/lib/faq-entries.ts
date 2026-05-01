/**
 * Source de vérité unique pour le centre d'aide /aide.
 *
 * Chaque entrée a :
 *   - id (slug stable, utilisé pour l'ancre URL)
 *   - category (filtre rapide)
 *   - question
 *   - answer (string ou JSX simple — ici string pour la recherche)
 *
 * On garde tout en string pour permettre une recherche client-side
 * full-text triviale (substring + score) sans indexation côté serveur.
 */

export type FaqCategory =
  | "Démarrage"
  | "CSRD"
  | "Sécurité"
  | "Données"
  | "Facturation"
  | "Intégrations";

export interface FaqEntry {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "demarrer-en-3-semaines",
    category: "Démarrage",
    question: "Combien de temps pour mettre en route un premier reporting CSRD ?",
    answer:
      "Trois semaines en moyenne, en mobilisant un référent ESG + un référent IT. Semaine 1 : import des données existantes (Excel, factures, ERP). Semaine 2 : double matérialité et mapping ESRS. Semaine 3 : revue, validation et premier export. Ce délai est conditionné à la disponibilité des données sources — pas à la plateforme.",
  },
  {
    id: "remplace-consultant-rse",
    category: "Démarrage",
    question: "Est-ce que CarbonCo remplace un consultant RSE ?",
    answer:
      "Non, CarbonCo accélère le travail des consultants. La méthodologie de double matérialité, la stratégie climat et l'arbitrage des enjeux restent du conseil humain. CarbonCo automatise la collecte, le calcul, la traçabilité et le reporting — soit 60 à 70 % du temps habituellement passé sur ces sujets en mode manuel.",
  },
  {
    id: "obligations-csrd-eti",
    category: "CSRD",
    question: "Mon ETI est-elle concernée par la CSRD ?",
    answer:
      "Vague 2 (publication 2027 sur exercice 2026) : entreprises dépassant 2 des 3 seuils suivants — 250 salariés, 50 M€ de chiffre d'affaires, 25 M€ de bilan. Vague 3 (publication 2028) : PME cotées et autres entités d'intérêt public. Si vous êtes filiale d'un groupe coté UE, vous reportez via la consolidation mère.",
  },
  {
    id: "scope-3-categorie-importante",
    category: "CSRD",
    question: "Quelle catégorie Scope 3 est généralement la plus importante ?",
    answer:
      "Pour un industriel : catégorie 11 (utilisation des produits vendus) — souvent 40 à 70 % du Scope 3. Pour un prestataire de services : catégorie 1 (achats de biens et services) ou catégorie 7 (déplacements domicile-travail). Notre module Scope 3 calcule automatiquement les 15 catégories en hypothèses ratios pour identifier les catégories matérielles à raffiner.",
  },
  {
    id: "audit-trail-sha256",
    category: "Sécurité",
    question: "À quoi sert l'audit trail SHA-256 ?",
    answer:
      "À prouver à votre commissaire aux comptes que les données publiées sont identiques à celles saisies, et n'ont pas été altérées entre temps. Chaque écriture porte un hash cryptographique lié au précédent. Toute modification rompt la chaîne de manière détectable. C'est devenu un standard de fait en assurance limitée CSRD.",
  },
  {
    id: "hebergement-rgpd",
    category: "Sécurité",
    question: "Où sont hébergées mes données ?",
    answer:
      "Infrastructure 100 % UE : compute Vercel (Frankfurt), base de données Neon (Frankfurt), stockage objet Vercel Blob (UE). Aucun transfert hors UE. Conformité RGPD documentée, DPA disponible sur demande. Les modèles IA sont accédés via Vercel AI Gateway en région UE prioritaire.",
  },
  {
    id: "import-excel-format",
    category: "Données",
    question: "Quel format de fichier Excel CarbonCo accepte ?",
    answer:
      "Tous les formats Excel courants (.xlsx, .xls, .csv, Google Sheets exporté). Pas de template imposé : le module Collecte détecte automatiquement les en-têtes et propose un mapping intelligent vers les datapoints ESRS. Vous gardez vos fichiers existants — pas de double saisie, pas de réorganisation.",
  },
  {
    id: "donnees-existantes",
    category: "Données",
    question: "Que faire des données déjà calculées dans nos Excel actuels ?",
    answer:
      "Importez-les directement dans CarbonCo avec leur historique. Le moteur recalcule en parallèle pour vérifier la cohérence et signale les écarts éventuels (changement de méthode, mise à jour facteur ADEME). Vous gardez la comparabilité interannuelle sans avoir à tout reprendre.",
  },
  {
    id: "essai-gratuit",
    category: "Facturation",
    question: "Comment fonctionne l'essai gratuit 14 jours ?",
    answer:
      "Création de compte sans carte bancaire, accès complet à toutes les fonctionnalités du plan Business. À l'issue des 14 jours, vous choisissez de souscrire ou le compte passe en mode lecture seule (vos données restent accessibles 90 jours). Pas de prélèvement automatique sans confirmation explicite.",
  },
  {
    id: "facturation-annuelle",
    category: "Facturation",
    question: "Quelle est la différence entre engagement mensuel et annuel ?",
    answer:
      "Engagement mensuel : paiement chaque mois, résiliation possible à tout moment avec préavis de 30 jours. Engagement annuel : −20 % sur le tarif mensuel, paiement annuel anticipé, résiliation à l'échéance. Le SLA est identique dans les deux cas.",
  },
  {
    id: "connecteur-erp",
    category: "Intégrations",
    question: "Pouvez-vous vous connecter à mon ERP ?",
    answer:
      "Connecteurs natifs disponibles pour Sage, Cegid, SAP S/4HANA, Microsoft Dynamics 365 et les principaux fournisseurs d'énergie (EDF, Engie, TotalEnergies). Pour un ERP custom ou métier, l'API REST documentée à /dev permet une intégration en 1-2 jours. Aucun connecteur n'est obligatoire : tout fonctionne aussi par import Excel.",
  },
  {
    id: "api-publique",
    category: "Intégrations",
    question: "L'API CarbonCo est-elle publique ?",
    answer:
      "Oui, documentation complète à /dev. 13 endpoints REST couvrant l'import de données, l'extraction de datapoints, la recherche RAG sémantique et les rapports. Authentification par token JWT, rate-limiting standard, conformité OpenAPI 3.0. Pas de surcoût sur les plans Business et Enterprise.",
  },
];

export function searchFaq(query: string): FaqEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return FAQ_ENTRIES;
  return FAQ_ENTRIES.filter(
    (e) =>
      e.question.toLowerCase().includes(q) ||
      e.answer.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
  );
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  "Démarrage",
  "CSRD",
  "Sécurité",
  "Données",
  "Facturation",
  "Intégrations",
];
