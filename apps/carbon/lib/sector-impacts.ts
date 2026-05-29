/**
 * sector-impacts.ts — Données du module « Impacts sectoriels » (drawer landing).
 *
 * Angle : les impacts environnementaux RÉELS que le reporting ESG doit rendre
 * mesurables, par thème environnemental. Distinct du SectorShowcase (aperçu
 * PRODUIT par secteur métier) et des infographies réglementaires.
 *
 * RÈGLE DE SOURCING (cœur de l'auditabilité Carbon&Co) :
 *   - tag "réel"        → chiffre traçable à une source publique nommée (année + URL).
 *   - tag "illustratif" → ordre de grandeur indicatif, non figé sur une source unique.
 * Toute valeur "réel" ci-dessous a été vérifiée contre sa source en mai 2026.
 * Sources : Citepa (Secten éd. 2024, données 2023), RTE (Bilan électrique 2023),
 * SDES (L'eau en France / prélèvements 2023), ADEME (Base Carbone), CDP.
 */

export type ProofTag = "réel" | "illustratif";

export interface ImpactMetric {
  /** Valeur pré-formatée fr-FR, unité incluse (ex: "≈ 32 gCO₂/kWh"). */
  value: string;
  /** Libellé court de la métrique. */
  label: string;
  /** Source publique nommée. */
  source: string;
  /** URL publique vérifiable. */
  sourceUrl: string;
  /** Année de référence de la donnée. */
  year: string;
  /** Niveau de preuve. */
  tag: ProofTag;
  /** Une phrase : ce que Carbon&Co en fait (mesurable / traçable / auditable). */
  carbonLink: string;
}

export interface ImpactTheme {
  id: "industrie" | "eau-pollution" | "energie" | "agri-viti";
  /** Libellé d'onglet. */
  label: string;
  /** Emoji cohérent avec la landing. */
  icon: string;
  /** Couleur d'accent (palette existante : infographies / sector-mockups). */
  accent: string;
  /** 1–2 phrases : le point de pression environnemental. */
  intro: string;
  /** 3 métriques sourcées. */
  metrics: ImpactMetric[];
  /** Standards ESRS reliés (relie au moteur ESRS du produit). */
  esrsRefs: string[];
  /** Phrase de clôture reliant l'impact à Carbon&Co. */
  carbonAngle: string;
}

const SRC = {
  citepa: {
    source: "Citepa — inventaire Secten (éd. 2024)",
    sourceUrl: "https://www.citepa.org/fr/2024_05_a02/",
    year: "2023",
  },
  rte: {
    source: "RTE — Bilan électrique 2023",
    sourceUrl: "https://analysesetdonnees.rte-france.com/bilan-electrique-2023/emissions",
    year: "2023",
  },
  sdes: {
    source: "SDES — L'eau en France (Bilan environnemental)",
    sourceUrl: "https://www.statistiques.developpement-durable.gouv.fr/leau-en-france-ressource-et-utilisation-extrait-du-bilan-environnemental-2024",
    year: "2023",
  },
  ademeElec: {
    source: "ADEME — Base Carbone® (mix moyen France)",
    sourceUrl: "https://prod-basecarbonesolo.ademe-dri.fr/documentation/UPLOAD_DOC_FR/electricite_reglementaire.htm",
    year: "2022",
  },
  ademeVin: {
    source: "ADEME — éco-conception des emballages du vin",
    sourceUrl: "https://www.adelphe.fr/sites/default/files/documentation/guideecoconceptionvin_2018.pdf",
    year: "2018",
  },
  cdp: {
    source: "CDP — Global Supply Chain Report",
    sourceUrl: "https://www.cdp.net/en/research",
    year: "2023",
  },
} as const;

export const SECTOR_IMPACTS: ImpactTheme[] = [
  {
    id: "industrie",
    label: "Industrie & production",
    icon: "🏭",
    accent: "#475569", // slate / acier
    intro:
      "L'industrie manufacturière concentre des émissions directes (procédés, combustion) et une longue chaîne d'approvisionnement amont — l'essentiel de l'empreinte se cache souvent hors des murs de l'usine.",
    metrics: [
      {
        value: "≈ 18 %",
        label: "des émissions de GES de la France (industrie manufacturière)",
        ...SRC.citepa,
        tag: "réel",
        carbonLink:
          "Carbon&Co rattache chaque tonne à sa source et son facteur d'émission, traçable pour l'auditeur.",
      },
      {
        value: "≈ 75 %",
        label: "part du Scope 3 (chaîne de valeur) dans l'empreinte d'une entreprise, en moyenne",
        ...SRC.cdp,
        tag: "réel",
        carbonLink:
          "Le questionnaire fournisseurs Carbon&Co collecte le Scope 3 amont sans tableur dispersé.",
      },
      {
        value: "−6,1 Mt CO₂e",
        label: "baisse des émissions de l'industrie manufacturière FR entre 2022 et 2023",
        ...SRC.citepa,
        tag: "réel",
        carbonLink:
          "Une trajectoire ne vaut que si elle est mesurée année après année avec la même méthode — c'est ce que fige l'audit trail.",
      },
    ],
    esrsRefs: ["E1", "E5"],
    carbonAngle:
      "Des données industrielles dispersées deviennent des indicateurs consolidés, datés et opposables à un tiers.",
  },
  {
    id: "eau-pollution",
    label: "Eau & pollution",
    icon: "💧",
    accent: "#0891B2", // cyan
    intro:
      "Au-delà du carbone, le reporting ESG (ESRS E2/E3) couvre l'eau et les rejets. Les volumes prélevés sont massifs et inégalement répartis entre usages.",
    metrics: [
      {
        value: "≈ 29 Md m³",
        label: "d'eau douce prélevés par an en France (hors hydroélectricité)",
        ...SRC.sdes,
        tag: "réel",
        carbonLink:
          "Carbon&Co structure les relevés de prélèvement par site et par source, datapoint par datapoint.",
      },
      {
        value: "45 %",
        label: "des prélèvements servent au refroidissement des centrales électriques (13,1 Md m³)",
        ...SRC.sdes,
        tag: "réel",
        carbonLink:
          "La consommation nette réelle (~0,4 Md m³) diffère du prélèvement brut : la nuance doit être tracée, pas approximée.",
      },
      {
        value: "82 %",
        label: "des prélèvements proviennent des eaux de surface (vulnérables aux sécheresses)",
        ...SRC.sdes,
        tag: "réel",
        carbonLink:
          "Relier volume, source et risque physique alimente directement l'analyse de double matérialité.",
      },
    ],
    esrsRefs: ["E2", "E3"],
    carbonAngle:
      "Des prélèvements et rejets épars deviennent un suivi auditable, prêt pour les standards ESRS E2 et E3.",
  },
  {
    id: "energie",
    label: "Énergie",
    icon: "⚡",
    accent: "#D97706", // amber
    intro:
      "L'intensité carbone de l'énergie consommée pilote une grande part du Scope 2. En France, le mix électrique très bas-carbone change radicalement le calcul — encore faut-il utiliser le bon facteur.",
    metrics: [
      {
        value: "≈ 32 gCO₂/kWh",
        label: "intensité carbone de l'électricité en France 2023 (vs ≈ 175 g en moyenne UE+)",
        ...SRC.rte,
        tag: "réel",
        carbonLink:
          "Le bon facteur, la bonne année : Carbon&Co versionne les facteurs pour éviter les calculs périmés.",
      },
      {
        value: "0,052 kgCO₂e/kWh",
        label: "facteur d'émission du mix moyen « électricité France » (Base Carbone)",
        ...SRC.ademeElec,
        tag: "réel",
        carbonLink:
          "Chaque kWh est converti via un facteur ADEME identifié par fact_id, reproductible par l'auditeur.",
      },
      {
        value: "≈ 5 %",
        label: "part de la production d'électricité dans les émissions FR (vs ≈ 21 % en moyenne UE)",
        ...SRC.rte,
        tag: "réel",
        carbonLink:
          "Comparer un site français et un site étranger exige des facteurs distincts — l'outil le gère par périmètre.",
      },
    ],
    esrsRefs: ["E1"],
    carbonAngle:
      "Le bon facteur d'émission, daté et sourcé, transforme une facture d'énergie en donnée de Scope 2 défendable.",
  },
  {
    id: "agri-viti",
    label: "Agriculture & viticulture",
    icon: "🌾",
    accent: "#059669", // emerald
    intro:
      "L'agriculture est dominée par des gaz non-CO₂ (méthane, protoxyde d'azote) difficiles à mesurer. La viticulture illustre l'impact à l'échelle d'un produit fini : la bouteille.",
    metrics: [
      {
        value: "≈ 19 %",
        label: "des émissions de GES de la France (2ᵉ secteur émetteur)",
        ...SRC.citepa,
        tag: "réel",
        carbonLink:
          "Carbon&Co relie les intrants agricoles aux facteurs ADEME pour sortir du forfait approximatif.",
      },
      {
        value: "CH₄ + N₂O",
        label: "gaz dominants des émissions agricoles (élevage, fertilisation azotée)",
        ...SRC.citepa,
        tag: "réel",
        carbonLink:
          "Convertir méthane et N₂O en équivalent CO₂ exige des PRG explicites, tracés à la source.",
      },
      {
        value: "≈ 1,1 kgCO₂e",
        label: "par bouteille de vin 75 cl, dont ≈ 46 % liés à l'emballage verre",
        ...SRC.ademeVin,
        tag: "illustratif",
        carbonLink:
          "Un cas concret : Carbon&Co rend l'empreinte lisible jusqu'à l'échelle du produit fini.",
      },
    ],
    esrsRefs: ["E1", "E4"],
    carbonAngle:
      "Des impacts diffus (sols, élevage, emballage) deviennent une empreinte chiffrée, du champ à la bouteille.",
  },
];
