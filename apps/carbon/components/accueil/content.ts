/**
 * Contenu commun aux trois grilles de l'accueil (maquette Claude Design
 * « Accueil Layouts », tour 1). Les trois planches montrent le même texte
 * organisé autrement : il vit donc ici, une seule fois. La maquette le dit
 * elle-même — hors hero, les textes de section sont provisoires.
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

/** Bande d'indicateurs. `short` sert au rail étroit de la grille 1b. */
export const KPIS = [
  { value: "67/100", label: "ESRS E1 · couverture climat (exemple)", short: "ESRS E1 · climat (exemple)" },
  { value: "iXBRL", label: "Export ESRS 2026 · bêta", short: "Export ESRS 2026 · bêta" },
  { value: "UE", label: "Traitement et stockage · Francfort", short: "Stockage · Francfort" },
  { value: "14 j", label: "Essai gratuit · aucune carte", short: "Essai gratuit · sans carte" },
] as const;

export const WHY = [
  { n: "01", title: "Chaque chiffre relié à sa cellule source", body: "Un clic sur un indicateur ouvre la ligne du fichier qui l'a produit." },
  { n: "02", title: "Chaque modification détectable", body: "Historique horodaté de chaque saisie et de chaque correction." },
  { n: "03", title: "Un dossier de preuves vérifiable", body: "Votre auditeur le contrôle sans outil propriétaire." },
] as const;

/** `short` : la version resserrée de la colonne étroite de la grille 1c. */
export const STEPS = [
  { n: "01", title: "Importer", body: "Fichiers Excel, exports comptables, factures énergie.", short: "Excel, exports comptables, factures énergie." },
  { n: "02", title: "Calculer", body: "Facteurs ADEME, GHG Protocol, référentiel EFRAG.", short: "ADEME, GHG Protocol, EFRAG." },
  { n: "03", title: "Prouver", body: "Rapport, dossier de preuves, export iXBRL.", short: "Rapport, preuves, export iXBRL." },
] as const;

/**
 * Les six modules du menu et des tuiles. La maquette pointe tout vers
 * #modules ; ici chaque tuile mène à la page publique qui en parle déjà.
 */
export const MODULES = [
  { code: "M01", title: "Bilan GES", body: "BEGES · scopes 1, 2 et 3", href: "/bilan-carbone-beges" },
  { code: "M02", title: "Norme volontaire", body: "Rapport ex-VSME", href: "/guide-csrd-vsme-2026" },
  { code: "M03", title: "ESRS 2026", body: "Points de donnée · export iXBRL bêta", href: "/couverture" },
  { code: "M04", title: "Dossier de preuves", body: "Traçabilité cellule par cellule", href: "/proof" },
  { code: "M05", title: "Dépendances", body: "34 matières critiques · Scope 3", href: "/materials" },
  { code: "M06", title: "Copilote NEURAL", body: "Assistant ESG v2.4", href: "/ai-act" },
] as const;

export const SECTORS = ["Industrie", "Agroalimentaire", "BTP", "Transport & logistique", "Distribution", "Services"] as const;

export const SECURITY = [
  "Hébergement UE — Francfort",
  "Journal d'audit horodaté",
  "Export ouvert, sans outil propriétaire",
] as const;

export const PILOT = {
  title: "Rejoindre le pilote",
  body: "Accompagnement sur votre premier rapport, retours intégrés à la feuille de route.",
  cta: "Candidater →",
} as const;

export const CALC = {
  title: "Êtes-vous concerné ?",
  body: "Trois questions pour savoir quel référentiel s'applique : norme volontaire, ESRS ou BEGES.",
} as const;

export const FOOTER_LINKS = [
  { label: "Matières critiques", href: "/materials" },
  { label: "Tarifs", href: "/tarifs" },
  { label: "Démo", href: "/demo" },
] as const;

/** Les ancres de la barre de navigation, dans l'ordre de la maquette. */
export const NAV_ANCHORS = [
  { id: "pourquoi", label: "Pourquoi" },
  { id: "comment", label: "Comment" },
] as const;
export const NAV_ANCHORS_AFTER = [
  { id: "secteurs", label: "Secteurs" },
  { id: "pilote", label: "Pilote" },
  { id: "securite", label: "Sécurité" },
] as const;
