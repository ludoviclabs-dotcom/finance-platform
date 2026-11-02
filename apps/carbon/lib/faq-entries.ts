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
      "Depuis le 18 mars 2026, la directive (UE) 2026/470 du 24 février 2026 (Omnibus I) réserve la CSRD aux entreprises de plus de 1 000 salariés ET de plus de 450 M€ de chiffre d'affaires net : les deux critères sont cumulatifs. Pour les entreprises de la vague 2 qui restent dans le champ, le premier rapport porte sur l'exercice 2027 et est publié en 2028. La vague 3 (PME cotées) sort du champ. Les groupes non européens sont visés à partir de l'exercice 2028 s'ils réalisent plus de 450 M€ de chiffre d'affaires dans l'UE et y ont une filiale ou une succursale de plus de 200 M€. En France, la loi de transposition est en cours d'examen (échéance : 19 mars 2027) ; tant qu'elle n'est pas promulguée, le droit français reste l'ordonnance n° 2023-1142 modifiée. Si vous êtes filiale d'un groupe soumis à la CSRD, vous pouvez être couverte par le rapport consolidé de la mère. Hors du champ, vérifiez votre BEGES (au-delà de 500 salariés) et les demandes de vos clients selon la norme volontaire (VS, ex-VSME). Cette réponse est une orientation, pas un avis juridique.",
  },
  {
    id: "scope-3-categorie-importante",
    category: "CSRD",
    question: "Quelle catégorie Scope 3 est généralement la plus importante ?",
    answer:
      "Pour un industriel : catégorie 11 (utilisation des produits vendus) — souvent 40 à 70 % du Scope 3. Pour un prestataire de services : catégorie 1 (achats de biens et services) ou catégorie 7 (déplacements domicile-travail). Notre module Scope 3 calcule automatiquement les 15 catégories en hypothèses ratios pour identifier les catégories matérielles à raffiner.",
  },
  {
    id: "qui-valide-carbonco",
    category: "CSRD",
    question: "Qui valide que CarbonCo respecte la CSRD ?",
    answer:
      "Personne, et aucun éditeur ne peut le prétendre : il n'existe pas de label CSRD pour un logiciel. C'est le rapport de votre entreprise qui est certifié, par un commissaire aux comptes ou un organisme tiers indépendant inscrit à la H2A. Notre rôle est de lui fournir une piste d'audit complète. Pour l'outil lui-même, les preuves pertinentes sont une attestation sur nos contrôles (type ISAE 3402 / SOC 2) et une certification de sécurité (ISO 27001), que nous visons : planifiées, déclenchées à la demande d'un premier client grand compte.",
  },
  {
    id: "audit-trail-sha256",
    category: "Sécurité",
    question: "À quoi sert l'audit trail SHA-256 ?",
    answer:
      "À montrer à votre vérificateur (commissaire aux comptes ou OTI) que les données publiées sont identiques à celles enregistrées, et n'ont pas été modifiées depuis. Chaque écriture porte une empreinte SHA-256 liée à la précédente : toute modification rompt la chaîne de manière détectable (tamper-evident), sans pour autant l'empêcher. L'empreinte prouve l'intégrité et l'ordre des écritures ; elle ne prouve ni l'exactitude ni l'exhaustivité des données, qui se vérifient par des rapprochements avec les pièces sources.",
  },
  {
    id: "hebergement-rgpd",
    category: "Sécurité",
    question: "Où sont hébergées mes données ?",
    answer:
      "Vos données métier sont stockées en UE (base de données Neon, Francfort). Les modèles d'IA sont hébergés aux États-Unis et accédés via Vercel AI Gateway : la liste complète des sous-traitants, avec leur localisation et leur finalité, est publiée sur /trust/sub-processors. DPA disponible sur demande.",
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
      "Pas encore par connecteur natif : aucun connecteur ERP (Sage, Cegid, SAP, Dynamics…) n'est livré à ce jour, ils sont planifiés selon la demande client (voir /etat-du-produit). Aujourd'hui, tout fonctionne par import Excel structuré, et l'API REST documentée à /dev permet une intégration sur mesure.",
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
