/**
 * Textes de la page d'accueil (charte Industry, grille 1d de la maquette
 * Claude Design « Accueil Layouts »).
 *
 * Là où la maquette posait un texte provisoire, on reprend la formulation
 * déjà validée de l'ancienne home (annexe A.4 pour le programme pilote,
 * section Conformité & sécurité pour l'hébergement) : rien ici ne doit
 * promettre plus que l'ancienne page.
 */

export const HERO = {
  tag: "ESRS 2026 · NORME VOLONTAIRE · BEGES — LA PREUVE D'ABORD",
  lead:
    "Votre rapport selon la norme volontaire (ex-VSME) ou les ESRS 2026, et votre bilan GES : chaque chiffre relié à sa cellule source, chaque modification détectable, et un dossier de preuves que votre auditeur vérifie sans outil propriétaire.",
  primary: { label: "Démarrer gratuitement — 14 jours", href: "/login" },
  secondary: { label: "Voir la démo en 2 min →", href: "/demo" },
  reassurance: [
    "Aucune carte bancaire",
    "ESRS 2026 · export iXBRL bêta",
    "Traitement et stockage en UE (Francfort)",
  ],
} as const;

/** Bande d'indicateurs ; la première valeur est calculée (voir HomePage). */
export const KPIS = [
  { value: "iXBRL", label: "Export ESRS 2026 · bêta" },
  { value: "UE", label: "Traitement et stockage · Francfort" },
  { value: "14 j", label: "Essai gratuit · aucune carte" },
] as const;

export const WHY = [
  {
    n: "01",
    title: "Chaque chiffre relié à sa cellule source",
    body: "Un indicateur remonte à la ligne du fichier qui l'a produit.",
  },
  {
    n: "02",
    title: "Chaque modification détectable",
    body: "Journal append-only : chaque saisie et chaque correction est horodatée.",
  },
  {
    n: "03",
    title: "Un dossier de preuves vérifiable",
    body: "Manifeste et empreintes vérifiables publiquement, sans outil tiers.",
  },
] as const;

export const STEPS = [
  { n: "01", title: "Importer", body: "Fichiers Excel, exports comptables, factures énergie." },
  { n: "02", title: "Calculer", body: "Facteurs ADEME Base Empreinte®, GHG Protocol, référentiel EFRAG." },
  { n: "03", title: "Prouver", body: "Rapport, dossier de preuves, export iXBRL bêta." },
] as const;

/**
 * Les six modules. Chaque tuile mène à la page publique qui en parle déjà ;
 * le corps de M05 reçoit le nombre réel de matières suivies.
 */
export const MODULES = [
  { code: "M01", title: "Bilan GES", body: "BEGES · scopes 1, 2 et 3", href: "/bilan-carbone-beges" },
  { code: "M02", title: "Norme volontaire", body: "Rapport ex-VSME", href: "/guide-csrd-vsme-2026" },
  { code: "M03", title: "ESRS 2026", body: "Points de donnée · export iXBRL bêta", href: "/couverture" },
  { code: "M04", title: "Dossier de preuves", body: "Traçabilité cellule par cellule", href: "/proof" },
  { code: "M05", title: "Dépendances", body: "Matières critiques · Scope 3", href: "/materials" },
  { code: "M06", title: "Copilote NEURAL", body: "Assistant ESG v2.4", href: "/ai-act" },
] as const;

/** Repris de la section Conformité & sécurité de l'ancienne home. */
export const SECURITY = [
  "Traitement et stockage en UE — Francfort",
  "TLS 1.3 en transit, AES-256 au repos",
  "Journal append-only : toute modification devient détectable",
  "Copilote : modèles Claude hébergés aux États-Unis",
] as const;

/** Annexe A.4 du plan d'action, verbatim. */
export const PILOT = {
  badge: "3 places pour l'exercice 2026",
  body:
    "Nous équipons gratuitement trois organisations (PME, ETI ou cabinet) pour produire leur premier rapport VSME auditable, en échange d'un retour d'expérience publiable.",
  cta: "Candidater →",
  subject: "Programme pilote CarbonCo — exercice 2026",
} as const;

export const NAV_LINKS = [
  { href: "#pourquoi", label: "Pourquoi" },
  { href: "#modules", label: "Modules" },
] as const;
export const NAV_LINKS_AFTER = [
  { href: "/tarifs", label: "Tarifs" },
  { href: "/demo", label: "Démo" },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Produit",
    links: [
      { href: "/produit", label: "Modules produit" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/couverture", label: "Couverture ESRS" },
      { href: "/integrations", label: "Sources & intégrations" },
      { href: "/materials", label: "Métaux critiques" },
      { href: "/water", label: "Eau & risques hydriques" },
      { href: "/robotics", label: "Robotique & IA physique" },
      { href: "/etat-du-produit", label: "État du produit" },
    ],
  },
  {
    title: "Confiance & sécurité",
    links: [
      { href: "/trust", label: "Trust Center" },
      { href: "/trust/sub-processors", label: "Sous-traitants" },
      { href: "/trust/exit-strategy", label: "Stratégie de sortie" },
      { href: "/status", label: "Statut du service" },
      { href: "/ai-act", label: "NEURAL et l'AI Act" },
    ],
  },
  {
    title: "Ressources & légal",
    links: [
      { href: "/blog", label: "Blog CSRD & ESG" },
      { href: "/guide-csrd-vsme-2026", label: "Guide CSRD & VSME (2026)" },
      { href: "/aide", label: "Centre d'aide" },
      { href: "/brochure", label: "Brochure (imprimable)" },
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cgu", label: "CGU" },
    ],
  },
] as const;
