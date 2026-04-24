export type Principle = {
  n: string;
  g: string;
  t1: string;
  tIt: string;
  d: string;
  foot1: string;
  foot2: string;
};

export type Milestone = {
  date: string;
  t: string;
  d: string;
  s: string;
  cls: "" | "active" | "pending";
};

export type AgentTab = {
  id: string;
  g: string;
  name: string;
  state: string;
  stateCls: "pill-done" | "pill-now" | "pill-next";
};

export type Kpi = {
  k: string;
  v: string;
  u: string;
  d: string;
};

export type LadderRung = {
  s: string;
  t: string;
  p: string;
  c: "pill-done" | "pill-now" | "pill-next";
};

export type AgentDemo = {
  prompt: string;
  meta: string;
  kpis: Kpi[];
  ladder: LadderRung[];
};

export type Sector = {
  n: string;
  name: string;
  state: "live" | "demo" | "prep";
  label: string;
};

export const ABOUT_COPY = {
  hero: {
    tag: "À PROPOS — V.2026",
    title1: "Poser la",
    title2: "trajectoire",
    title3: "à découvert.",
    sub: "NEURAL est un <b>framework multi-secteurs</b> pour agents métier. Cette page sert à poser la logique de <b>truth layer</b> qui guide la marque — sans extrapoler au-delà du périmètre visible.",
    cta1: "Contacter NEURAL",
    cta2: "Voir les preuves",
    kickerLine: "Manifeste · Trajectoire · Console de preuves",
  },
  principles: {
    kicker: "Manifeste",
    title1: "Trois principes,",
    title2: "un même",
    titleIt: "engagement.",
    aside:
      "Une promesse simple : des agents métier pensés par verticalité, un accompagnement en prise directe avec vos équipes, et un gain de temps et de productivité mesuré à chaque sprint — jamais extrapolé.",
    items: [
      {
        n: "01",
        g: "§",
        t1: "Pensé par",
        tIt: "verticalité.",
        d: "Chaque agent est calibré pour un métier précis — Finance, RH, Luxe, Banque — avec son vocabulaire, ses KPI et ses points de supervision humaine explicites. Pas d'IA généraliste repackagée.",
        foot1: "Verticalité",
        foot2: "Métier par métier",
      },
      {
        n: "02",
        g: "¶",
        t1: "Accompagnement",
        tIt: "en direct.",
        d: "Nous travaillons aux côtés de vos équipes, pas à côté. Cadrage, déploiement supervisé, relecture hebdomadaire : chaque jalon est co-piloté — jamais livré par-dessus le mur.",
        foot1: "Accompagnement",
        foot2: "Sprint par sprint",
      },
      {
        n: "03",
        g: "¤",
        t1: "Gain de temps",
        tIt: "mesuré.",
        d: "La productivité ne se raconte pas, elle se compte. Chaque brique porte une mesure de valeur — heures rendues, cycles réduits, erreurs évitées — avant tout déploiement plus large.",
        foot1: "Productivité",
        foot2: "Mesurée, pas promise",
      },
    ] satisfies Principle[],
  },
  trajectory: {
    kicker: "Trajectoire",
    title1: "Quelques sprints,",
    titleIt: "pas une refonte.",
    aside:
      "La trajectoire publique de NEURAL, jalon par jalon. Les états reflètent ce qui est visible aujourd'hui — rien de plus.",
    rail: "Roadmap publique",
    items: [
      {
        date: "2025 · Q2",
        t: "Premier truth layer éditorial",
        d: "Mise en ligne du premier périmètre avec hiérarchie explicite des niveaux de preuve par brique.",
        s: "Livré",
        cls: "",
      },
      {
        date: "2025 · Q4",
        t: "Démos orchestrées par secteur",
        d: "Luxe, Transport, Banque. Scénarios bout-en-bout, avec données réelles ou synthétiques nommées comme telles.",
        s: "Livré",
        cls: "",
      },
      {
        date: "2026 · Q1",
        t: "Industrialisation des briques Live",
        d: "Passage de Finance, Communication et Luxe en production surveillée avec données réelles.",
        s: "En cours",
        cls: "active",
      },
      {
        date: "2026 · Q2",
        t: "Ouverture Supply Chain / SI",
        d: "Cadrage en cours avec partenaires. Pas encore ouvert publiquement — pas encore promis ici.",
        s: "À venir",
        cls: "pending",
      },
      {
        date: "2026 · Q3",
        t: "Layer équipe et case studies",
        d: "Enrichissement du périmètre éditorial par des preuves clients complètes et un parcours équipe.",
        s: "À venir",
        cls: "pending",
      },
    ] satisfies Milestone[],
  },
  proof: {
    kicker: "Console de preuves",
    title1: "Voyez-les",
    title2: "travailler,",
    titleIt: "pas juste en parler.",
    aside:
      "Chaque agent NEURAL est mesuré sur le terrain. Choisissez une verticale — prompt réel, KPI réels, état d'industrialisation réel. Le reste est du bruit.",
    live: "LIVE",
    labelAgents: "Agents",
    ladderTitle: "Échelle de preuve",
    agents: [
      { id: "finance", g: "§", name: "Finance", state: "Live", stateCls: "pill-done" },
      { id: "luxe", g: "¶", name: "Luxe", state: "Live", stateCls: "pill-done" },
      { id: "rh", g: "¤", name: "Ressources Humaines", state: "Démo", stateCls: "pill-now" },
      { id: "compta", g: "◊", name: "Comptabilité", state: "Démo", stateCls: "pill-now" },
      { id: "supply", g: "†", name: "Supply Chain", state: "Prép.", stateCls: "pill-next" },
    ] satisfies AgentTab[],
    demos: {
      finance: {
        prompt:
          "Clôture mensuelle — réconcilie les écarts de trésorerie, produit le rapport CFO, signale les anomalies > 0,5%.",
        meta: "Déployé · 14 clients",
        kpis: [
          { k: "Temps rendu", v: "72", u: "h/mois", d: "<b>−83%</b> sur la clôture" },
          { k: "Anomalies captées", v: "99,4", u: "%", d: "<b>+12 pts</b> vs. baseline" },
          { k: "Supervision", v: "1", u: "revue/sem.", d: "Humain dans la boucle" },
        ],
        ladder: [
          {
            s: "N1",
            t: "<b>Données réelles</b> — data finance cliente en production",
            p: "Fait",
            c: "pill-done",
          },
          {
            s: "N2",
            t: "<b>Livrable stable</b> — rapport CFO généré chaque mois",
            p: "Fait",
            c: "pill-done",
          },
          {
            s: "N3",
            t: "<b>Mesure publiée</b> — heures rendues + taux d'anomalie",
            p: "En cours",
            c: "pill-now",
          },
        ],
      },
      luxe: {
        prompt:
          "Analyse des retours client post-vente — trie par urgence, propose une réponse alignée voix de marque, escalade les cas VIP.",
        meta: "Déployé · 3 maisons",
        kpis: [
          { k: "Délai 1re réponse", v: "4", u: "min", d: "<b>−94%</b> vs. SLA initial" },
          { k: "Voix de marque", v: "96", u: "%", d: "<b>validé</b> direction com." },
          { k: "Cas VIP escaladés", v: "100", u: "%", d: "Zéro faux négatif" },
        ],
        ladder: [
          {
            s: "N1",
            t: "<b>Données réelles</b> — tickets CRM + guide voix de marque",
            p: "Fait",
            c: "pill-done",
          },
          {
            s: "N2",
            t: "<b>Livrable stable</b> — pré-réponses validées avant envoi",
            p: "Fait",
            c: "pill-done",
          },
          {
            s: "N3",
            t: "<b>Mesure publiée</b> — SLA, NPS post-interaction",
            p: "En cours",
            c: "pill-now",
          },
        ],
      },
      rh: {
        prompt:
          "Pré-qualifie les candidatures entrantes, croise avec la grille poste, rédige la note de synthèse au manager.",
        meta: "Démo orchestrée · pilote Q2",
        kpis: [
          { k: "Gain estimé", v: "60", u: "%", d: "sur pré-qualif." },
          { k: "Biais détectés", v: "3", u: "checks", d: "avant envoi manager" },
          { k: "Supervision", v: "Double", u: "", d: "<b>RH + manager</b>" },
        ],
        ladder: [
          {
            s: "N1",
            t: "<b>Données synthétiques</b> — corpus CV anonymisés",
            p: "Fait",
            c: "pill-done",
          },
          {
            s: "N2",
            t: "<b>Livrable démo</b> — note de synthèse type",
            p: "En cours",
            c: "pill-now",
          },
          {
            s: "N3",
            t: "<b>Mesure publiée</b> — à ouvrir avec le pilote client",
            p: "À venir",
            c: "pill-next",
          },
        ],
      },
      compta: {
        prompt:
          "Rapproche factures/bons de commande, détecte les doublons, prépare les écritures à valider.",
        meta: "Démo orchestrée · pilote Q3",
        kpis: [
          { k: "Gain estimé", v: "50", u: "%", d: "sur saisie" },
          { k: "Doublons captés", v: "100", u: "%", d: "sur scénario test" },
          { k: "Supervision", v: "1", u: "comptable", d: "Valide les écritures" },
        ],
        ladder: [
          {
            s: "N1",
            t: "<b>Données synthétiques</b> — jeu de factures type PME",
            p: "Fait",
            c: "pill-done",
          },
          {
            s: "N2",
            t: "<b>Livrable démo</b> — écritures pré-remplies",
            p: "En cours",
            c: "pill-now",
          },
          {
            s: "N3",
            t: "<b>Mesure publiée</b> — à ouvrir avec le pilote",
            p: "À venir",
            c: "pill-next",
          },
        ],
      },
      supply: {
        prompt:
          "Aucun prompt exposé. Brique en cadrage — périmètre data, partenaires et mesure à aligner avant ouverture.",
        meta: "En préparation · cadrage Q2",
        kpis: [
          { k: "Périmètre", v: "—", u: "", d: "à cadrer" },
          { k: "Partenaires", v: "2", u: "en discussion", d: "<b>NDA</b> signés" },
          { k: "Ouverture", v: "Q3", u: "", d: "non garanti" },
        ],
        ladder: [
          {
            s: "N1",
            t: "<b>Cadrage data</b> — en cours avec partenaires",
            p: "En cours",
            c: "pill-now",
          },
          {
            s: "N2",
            t: "<b>Livrable</b> — non démarré",
            p: "À venir",
            c: "pill-next",
          },
          {
            s: "N3",
            t: "<b>Mesure</b> — non démarrée",
            p: "À venir",
            c: "pill-next",
          },
        ],
      },
    } satisfies Record<string, AgentDemo>,
  },
  pull: {
    q1: "Nous ne vendons pas une refonte globale.",
    qIt: "Nous livrons un jalon,",
    q2: "une mesure, puis le suivant.",
    sig: "Direction NEURAL — avril 2026",
  },
  sectors: {
    kicker: "Périmètre",
    title1: "Sept secteurs,",
    title2: "un même",
    titleIt: "framework.",
    aside:
      "Tous les secteurs n'avancent pas à la même vitesse. Chaque carte affiche son état réel, pas un état souhaité.",
    items: [
      { n: "01", name: "Luxe", state: "live", label: "Live — données réelles" },
      { n: "02", name: "Transport", state: "demo", label: "Démo orchestrée" },
      { n: "03", name: "Banque", state: "demo", label: "Démo orchestrée" },
      { n: "04", name: "Aéronautique", state: "prep", label: "En préparation" },
      { n: "05", name: "SaaS", state: "prep", label: "En préparation" },
      { n: "06", name: "Assurance", state: "prep", label: "En préparation" },
      { n: "07", name: "Finance", state: "live", label: "Live — données réelles" },
      { n: "08", name: "Communication", state: "live", label: "Live — données réelles" },
    ] satisfies Sector[],
  },
  cta: {
    t1: "Un cadrage de",
    tIt: "30 minutes.",
    t2: "Pas une refonte.",
    d: "Le point d'entrée utile : identifier ensemble le premier jalon que NEURAL peut absorber chez vous, le périmètre data nécessaire, et la mesure qui prouvera sa valeur.",
    b1: "Planifier un cadrage",
    b2: "Voir une démo orchestrée",
  },
} as const;

export type AboutCopy = typeof ABOUT_COPY;
