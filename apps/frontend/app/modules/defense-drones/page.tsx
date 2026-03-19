"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Shield, Target, Radar,
  ChevronRight, ChevronLeft, Play,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ Types ══ */

type Mission  = "ISR / Surveillance" | "Frappe de précision" | "Lutte anti-drone (C-UAS)" | "Appui logistique";
type Theatre  = "Europe de l'Est" | "Moyen-Orient" | "Mer de Chine méridionale" | "Sahel";
type Categorie = "MALE" | "TUAV" | "Munition rôdeuse" | "Mini-drone";

interface Systeme {
  id: string;
  nom: string;
  origine: string;
  categorie: Categorie;
  prixUnit: number; // K€
  coutEfficacite: number; // 1–10
  autonomie: number;
  precision: number;
  discretion: number;
  resilience: number;
  resume: string;
}

interface FormData {
  /* Step 1 — Contexte */
  mission: Mission;
  theatre: Theatre;
  budget: number; // K€
  /* Step 2 — Sélection & pondération */
  idA: string;
  idB: string;
  idC: string;
  poidsCout: number;      // %
  poidsAutonomie: number;
  poidsPrecision: number;
  poidsDiscretion: number;
  poidsResilience: number;
}

interface SystemeScore {
  sys: Systeme;
  scoreGlobal: number;
  unitesAcquerables: number;
}

interface Metrics {
  scores: [SystemeScore, SystemeScore, SystemeScore];
  classement: [SystemeScore, SystemeScore, SystemeScore];
  totalPoids: number;
  recommandation: string;
}

/* ══════════════════════════════════════════════════════════ Constants ══ */

const STEP_LABELS = ["Contexte opérationnel", "Systèmes & pondération"];

const MISSIONS: Mission[] = [
  "ISR / Surveillance",
  "Frappe de précision",
  "Lutte anti-drone (C-UAS)",
  "Appui logistique",
];

const THEATRES: Theatre[] = [
  "Europe de l'Est",
  "Moyen-Orient",
  "Mer de Chine méridionale",
  "Sahel",
];

/* Pondérations par défaut selon la mission — littérales pour la lisibilité */
const DEFAULT_POIDS: Record<Mission, [number, number, number, number, number]> = {
  "ISR / Surveillance":     [10, 35, 10, 30, 15],
  "Frappe de précision":    [15, 20, 35, 15, 15],
  "Lutte anti-drone (C-UAS)": [30, 15, 30, 10, 15],
  "Appui logistique":       [35, 40,  5, 10, 10],
};

/* Catalogue de systèmes */
const CATALOGUE: Systeme[] = [
  {
    id: "tb2",
    nom: "Bayraktar TB2",
    origine: "Türkiye",
    categorie: "MALE",
    prixUnit: 5_000,
    coutEfficacite: 6, autonomie: 8, precision: 7, discretion: 5, resilience: 5,
    resume: "MALE tactique polyvalent, vétéran du Haut-Karabakh et de l'Ukraine. Missile MAM-C/L, autonomie 24h, plafond 7600m.",
  },
  {
    id: "lancet3",
    nom: "Lancet-3",
    origine: "Russie",
    categorie: "Munition rôdeuse",
    prixUnit: 35,
    coutEfficacite: 9, autonomie: 5, precision: 8, discretion: 7, resilience: 4,
    resume: "Munition rôdeuse de croisière (~40km). Guidance électro-optique, tête militaire 3kg, massification possible par le coût.",
  },
  {
    id: "switchblade600",
    nom: "Switchblade 600",
    origine: "USA",
    categorie: "Munition rôdeuse",
    prixUnit: 100,
    coutEfficacite: 7, autonomie: 6, precision: 8, discretion: 8, resilience: 7,
    resume: "Munition rôdeuse anti-blindé (~40km). Warhead anti-tank, man-portable, lien de données chiffré, résistant au brouillage.",
  },
  {
    id: "harop",
    nom: "Harop (IAI)",
    origine: "Israël",
    categorie: "Munition rôdeuse",
    prixUnit: 500,
    coutEfficacite: 6, autonomie: 7, precision: 9, discretion: 7, resilience: 8,
    resume: "Loitering munition longue endurance (9h, 1000km). Guidage radar passif ou EO. Défense anti-radiation et C-RAM.",
  },
  {
    id: "mq9",
    nom: "MQ-9B SkyGuardian",
    origine: "USA",
    categorie: "MALE",
    prixUnit: 30_000,
    coutEfficacite: 3, autonomie: 9, precision: 9, discretion: 4, resilience: 9,
    resume: "MALE de référence OTAN (40h, 1850km). Capteurs multi-spectraux, liaisons satcom, résistance à la guerre électronique avancée.",
  },
  {
    id: "eurodrone",
    nom: "Eurodrone (MALE EU)",
    origine: "Europe",
    categorie: "MALE",
    prixUnit: 80_000,
    coutEfficacite: 2, autonomie: 10, precision: 8, discretion: 5, resilience: 10,
    resume: "Programme OCCAR franco-germano-hispano-italien. Certification STANAG, conformité espace aérien civil, liaison satcom dual-band.",
  },
  {
    id: "shahed136",
    nom: "Shahed-136 / Geran-2",
    origine: "Iran / Russie",
    categorie: "Munition rôdeuse",
    prixUnit: 40,
    coutEfficacite: 9, autonomie: 8, precision: 5, discretion: 6, resilience: 3,
    resume: "Munition rôdeuse à longue portée (~2000km). Navigation inertielle + GPS, faible empreinte radar, utilisé massivement contre infrastructures.",
  },
  {
    id: "fpv",
    nom: "Drone FPV kamikaze",
    origine: "Générique (UA/RU)",
    categorie: "Mini-drone",
    prixUnit: 1,
    coutEfficacite: 10, autonomie: 2, precision: 5, discretion: 9, resilience: 2,
    resume: "FPV artisanal à charge explosive (~1kg). Portée 5–15km, coût < 1 K€, pilotage vidéo temps réel. Massification tactique.",
  },
];

const CATALOGUE_IDS = CATALOGUE.map((s) => s.id);

/* Couleurs fixes pour positions A / B / C — littérales pour le scanner Tailwind */
const POS_DOT: Record<number, string> = { 0: "bg-accent",  1: "bg-warning",  2: "bg-success"  };
const POS_TXT: Record<number, string> = { 0: "text-accent", 1: "text-warning", 2: "text-success" };
const POS_BAR: Record<number, string> = { 0: "bg-accent",  1: "bg-warning",  2: "bg-success"  };
const POS_LBL: Record<number, string> = { 0: "A", 1: "B", 2: "C" };

const CRITERES = [
  { key: "coutEfficacite", label: "Coût-efficacité",    desc: "Rapport performance / coût unitaire",            poidKey: "poidsCout"       },
  { key: "autonomie",      label: "Autonomie",           desc: "Endurance, rayon d'action, portée",             poidKey: "poidsAutonomie"  },
  { key: "precision",      label: "Précision / létalité", desc: "Efficacité de frappe ou qualité capteurs ISR", poidKey: "poidsPrecision"  },
  { key: "discretion",     label: "Discrétion",          desc: "Signature acoustique, radar, thermique",        poidKey: "poidsDiscretion" },
  { key: "resilience",     label: "Résilience EW",       desc: "Résistance brouillage GPS, liaisons, leurres", poidKey: "poidsResilience" },
] as const;

const defaultFormData: FormData = {
  mission: "Frappe de précision",
  theatre: "Europe de l'Est",
  budget: 50_000,
  idA: "tb2",
  idB: "lancet3",
  idC: "switchblade600",
  poidsCout:      15,
  poidsAutonomie: 20,
  poidsPrecision: 35,
  poidsDiscretion: 15,
  poidsResilience: 15,
};

/* ═══════════════════════════════════════════════════════ Computations ══ */

function computeMetrics(d: FormData): Metrics {
  const totalPoids =
    d.poidsCout + d.poidsAutonomie + d.poidsPrecision + d.poidsDiscretion + d.poidsResilience;
  const div = totalPoids > 0 ? totalPoids : 100;

  function scoreFor(sys: Systeme): number {
    return (
      sys.coutEfficacite * d.poidsCout      / div +
      sys.autonomie      * d.poidsAutonomie  / div +
      sys.precision      * d.poidsPrecision  / div +
      sys.discretion     * d.poidsDiscretion / div +
      sys.resilience     * d.poidsResilience / div
    );
  }

  const getSys = (id: string) => CATALOGUE.find((s) => s.id === id) ?? CATALOGUE[0];

  const sA = getSys(d.idA);
  const sB = getSys(d.idB);
  const sC = getSys(d.idC);

  const toSS = (sys: Systeme): SystemeScore => ({
    sys,
    scoreGlobal: scoreFor(sys),
    unitesAcquerables: sys.prixUnit > 0 ? Math.floor(d.budget / sys.prixUnit) : 0,
  });

  const scores: [SystemeScore, SystemeScore, SystemeScore] = [toSS(sA), toSS(sB), toSS(sC)];
  const classement = [...scores].sort((a, b) => b.scoreGlobal - a.scoreGlobal) as
    [SystemeScore, SystemeScore, SystemeScore];

  /* Recommandation doctrinale */
  const winner = classement[0];
  const missionLc = d.mission.toLowerCase();
  let rec = `Dans le contexte "${d.theatre}" pour une mission "${d.mission}", `;
  rec += `le système ${winner.sys.nom} (${winner.sys.origine}) obtient le score pondéré le plus élevé `;
  rec += `(${winner.scoreGlobal.toFixed(2)}/10). `;

  if (winner.sys.categorie === "MALE") {
    rec += `En tant que drone MALE, il offre une persistance opérationnelle supérieure au détriment du coût unitaire. `;
    rec += `Le budget de ${(d.budget / 1_000).toFixed(0)} M€ permet d'acquérir ${winner.unitesAcquerables} appareil${winner.unitesAcquerables > 1 ? "s" : ""}. `;
    rec += `Recommandé pour un engagement durable nécessitant ISR continu ou frappe de précision sur cibles de haute valeur.`;
  } else if (winner.sys.categorie === "Munition rôdeuse") {
    rec += `En tant que munition rôdeuse, il permet une massification tactique : `;
    rec += `${winner.unitesAcquerables.toLocaleString("fr-FR")} unités avec le budget alloué. `;
    if (missionLc.includes("frappe") || missionLc.includes("c-uas")) {
      rec += `Cette saturation est particulièrement pertinente pour submerger les défenses adverses ou la C-RAM. `;
    }
    rec += `La doctrine d'emploi recommande des essaims par salves pour compenser la vulnérabilité aux contre-mesures EW.`;
  } else {
    rec += `Avec ${winner.unitesAcquerables.toLocaleString("fr-FR")} unités acquérables, `;
    rec += `la saturation tactique compense les limites en endurance. `;
    rec += `Usage recommandé en appui rapproché et reconnaissance de contact.`;
  }

  return { scores, classement, totalPoids, recommandation: rec };
}

function fmtKE(ke: number): string {
  if (ke >= 1_000_000) return (ke / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " Md€";
  if (ke >= 1_000)     return (ke / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M€";
  if (ke < 1)          return (ke * 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
  return ke.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " K€";
}

type BadgeResult = { cls: string; label: string };

function scoreBadge(score: number): BadgeResult {
  if (score >= 7.5) return { cls: "badge badge-success", label: "Excellent" };
  if (score >= 6.0) return { cls: "badge badge-warning", label: "Satisfaisant" };
  return { cls: "badge badge-danger", label: "Insuffisant" };
}

/* ════════════════════════════════════════════════════ Sub-components ══ */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isCurrent   = step === current;
        const isLast      = step === STEP_LABELS.length;
        return (
          <div key={step} className={`flex flex-col ${!isLast ? "flex-1" : ""}`}>
            <div className="flex items-center">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  isCompleted ? "bg-success text-white"
                  : isCurrent ? "bg-accent text-white"
                  : "bg-surface-raised border border-border text-foreground-subtle"
                }`}
              >
                {isCompleted ? "✓" : step}
              </div>
              {!isLast && (
                <div className={`flex-1 h-px ml-2 transition-colors ${step < current ? "bg-success" : "bg-border"}`} />
              )}
            </div>
            <span className={`text-xs mt-1.5 hidden sm:block whitespace-nowrap ${isCurrent ? "text-foreground font-medium" : "text-foreground-subtle"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const INPUT_CLS =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-strong transition-colors";

/* ═══════════════════════════════════════════════════════════════ Page ══ */

export default function DefenseDronesPage() {
  const [currentStep, setCurrentStep]   = useState(1);
  const [formData, setFormData]         = useState<FormData>(defaultFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  function update(patch: Partial<FormData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
  }

  function applyMissionDefaults(mission: Mission) {
    const [c, a, p, d, r] = DEFAULT_POIDS[mission];
    update({ mission, poidsCout: c, poidsAutonomie: a, poidsPrecision: p, poidsDiscretion: d, poidsResilience: r });
  }

  const metrics = computeMetrics(formData);

  /* ── Step content ───────────────────────────────────────────────────── */

  const stepContent: Record<number, React.ReactNode> = {

    /* ── Étape 1 — Contexte opérationnel ─────────────────────────────── */
    1: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Définissez le contexte opérationnel. La mission sélectionnée initialise
          automatiquement les pondérations des critères d&apos;évaluation,
          que vous pourrez ajuster à l&apos;étape suivante.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mission" className="text-sm font-medium text-foreground">Mission principale</label>
            <select
              id="mission"
              value={formData.mission}
              onChange={(e) => applyMissionDefaults(e.target.value as Mission)}
              className={INPUT_CLS}
            >
              {MISSIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-xs text-foreground-subtle">
              Détermine les pondérations initiales des 5 critères d&apos;évaluation.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="theatre" className="text-sm font-medium text-foreground">Théâtre d&apos;opérations</label>
            <select
              id="theatre"
              value={formData.theatre}
              onChange={(e) => update({ theatre: e.target.value as Theatre })}
              className={INPUT_CLS}
            >
              {THEATRES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="budget" className="text-sm font-medium text-foreground">
            Budget d&apos;acquisition
            <span className="ml-1 text-xs font-normal text-foreground-subtle">(K€)</span>
          </label>
          <input
            id="budget"
            type="number"
            min={1}
            step={1000}
            value={formData.budget}
            onChange={(e) => update({ budget: Number(e.target.value) })}
            className={INPUT_CLS}
          />
          <p className="text-xs text-foreground-subtle">
            Enveloppe allouée pour l&apos;acquisition — détermine le nombre d&apos;unités achetables par système.
          </p>
        </div>

        {/* Aperçu pondérations selon mission */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="data-label">Pondérations initiales — mission &laquo;{formData.mission}&raquo;</p>
          <div className="flex flex-col gap-2">
            {CRITERES.map(({ label, poidKey }) => {
              const val = formData[poidKey] as number;
              return (
                <div key={poidKey} className="flex items-center gap-3">
                  <span className="text-xs text-foreground-muted w-36 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-surface-raised rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${val}%` }} />
                  </div>
                  <span className="tabnum text-xs font-medium text-foreground w-8 text-right">{val} %</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    ),

    /* ── Étape 2 — Systèmes & pondération ────────────────────────────── */
    2: (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-foreground-muted leading-relaxed">
          Sélectionnez trois systèmes à comparer et affinez les pondérations selon vos
          priorités opérationnelles. La somme des pondérations est normalisée automatiquement.
        </p>

        {/* Sélection des 3 systèmes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["idA", "idB", "idC"] as const).map((key, i) => {
            const sys = CATALOGUE.find((s) => s.id === formData[key]) ?? CATALOGUE[0];
            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className={`h-5 w-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 text-white ${POS_DOT[i]}`}>
                    {POS_LBL[i]}
                  </span>
                  <label className="text-sm font-medium text-foreground">Système {POS_LBL[i]}</label>
                </div>
                <select
                  value={formData[key]}
                  onChange={(e) => update({ [key]: e.target.value } as Partial<FormData>)}
                  className={INPUT_CLS}
                >
                  {CATALOGUE.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} ({s.origine})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-foreground-subtle leading-relaxed">{sys.resume}</p>
                <p className="text-xs text-foreground-subtle">
                  Prix unitaire : <span className="font-semibold text-foreground">{fmtKE(sys.prixUnit)}</span>
                  {" · "}Catégorie : <span className="font-medium">{sys.categorie}</span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Sliders de pondération */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="data-label">Pondération des critères</p>
            <span className={`text-xs font-medium ${metrics.totalPoids === 100 ? "text-success" : "text-warning"}`}>
              Total : {metrics.totalPoids} % {metrics.totalPoids !== 100 ? "(normalisé)" : ""}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {CRITERES.map(({ label, desc, poidKey }) => (
              <div key={poidKey} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">{label}</label>
                  <span className="tabnum text-sm font-semibold text-foreground">{formData[poidKey]} %</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={formData[poidKey] as number}
                  onChange={(e) => update({ [poidKey]: Number(e.target.value) } as Partial<FormData>)}
                  className="w-full accent-accent"
                />
                <p className="text-xs text-foreground-subtle">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col min-h-svh bg-background">

      <header className="sticky top-0 z-50 bg-surface border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="badge badge-neutral">Module 7 sur 8</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 w-full py-12 flex flex-col gap-16">

        {/* ══ PART A — Éditoriale ════════════════════════════════════════ */}
        <section className="flex flex-col gap-10">

          <div className="flex flex-col gap-4">
            <span className="badge badge-info self-start">Module 7 sur 8</span>
            <h1 className="text-foreground">Défense &amp; Drones — Analyse coût-efficacité</h1>
            <p className="text-foreground-muted max-w-2xl" style={{ fontSize: "var(--text-lg)" }}>
              Comparez trois systèmes de drones sur cinq critères pondérés selon la mission
              et le théâtre d&apos;opérations. Calculez le score global et la recommandation
              doctrinale en fonction du budget alloué.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <p className="data-label">Ce que ce module analyse</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Shield,
                  title: "Scoring multicritère",
                  detail: "5 critères pondérés : coût-efficacité, autonomie, précision/létalité, discrétion (signature), résilience à la guerre électronique. Pondérations ajustables selon la mission.",
                },
                {
                  icon: Target,
                  title: "Catalogue de 8 systèmes",
                  detail: "Bayraktar TB2, Lancet-3, Switchblade 600, Harop, MQ-9B, Eurodrone, Shahed-136, FPV kamikaze. Données issues de sources ouvertes (OSINT).",
                },
                {
                  icon: Radar,
                  title: "Recommandation doctrinale",
                  detail: "Score global pondéré, nombre d'unités achetables dans le budget, et recommandation d'emploi selon le type de système (MALE, munition rôdeuse, mini-drone).",
                },
              ].map(({ icon: Icon, title, detail }) => (
                <div key={title} className="card p-5 flex flex-col gap-3">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                    <p className="text-xs text-foreground-muted leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="data-label">Critères d&apos;évaluation</p>
            <ul className="flex flex-col gap-3">
              {[
                { title: "Coût-efficacité", detail: "Rapport entre la performance opérationnelle et le coût unitaire d'acquisition. Un score élevé = système abordable pour les capacités offertes. Crucial pour les doctrines de massification." },
                { title: "Autonomie", detail: "Endurance de vol, rayon d'action et portée effective. Déterminant pour les missions ISR prolongées ou les frappes lointaines. Les MALE excellent, les FPV sont très limités." },
                { title: "Précision / létalité", detail: "Pour les missions de frappe : précision du guidage terminal et efficacité de la charge militaire. Pour l'ISR : résolution des capteurs et qualité du renseignement produit." },
                { title: "Discrétion", detail: "Signature acoustique, radar (RCS) et thermique. Un score élevé = difficile à détecter. Les FPV et mini-drones sont furtifs par leur petite taille ; les MALE sont facilement trackés." },
                { title: "Résilience EW", detail: "Résistance au brouillage GPS, leurrage de navigation inertielle et coupure des liaisons de données. Critique en Europe de l'Est (environnement EW dense). Les systèmes OTAN ont l'avantage." },
              ].map(({ title, detail }) => (
                <li key={title} className="flex gap-3 items-start">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-[7px]" />
                  <div>
                    <span className="text-sm font-semibold text-foreground">{title}</span>
                    <span className="text-sm text-foreground-muted"> — {detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ══ PART B — Wizard ════════════════════════════════════════════ */}
        <section className="flex flex-col gap-4">
          <p className="data-label">Saisie des données</p>

          <div className="card-raised p-6 sm:p-8">
            <StepIndicator current={currentStep} />

            <div className="mb-7">
              <h2 className="text-foreground" style={{ fontSize: "var(--text-xl)" }}>
                Étape {currentStep} — {STEP_LABELS[currentStep - 1]}
              </h2>
            </div>

            {stepContent[currentStep]}

            <div className="flex items-center justify-between mt-10 pt-6 border-t border-border">
              <button
                type="button"
                onClick={() => setCurrentStep((s) => s - 1)}
                disabled={currentStep === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground-muted border border-border rounded-md hover:text-foreground hover:border-border-strong transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              {currentStep < STEP_LABELS.length ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((s) => s + 1)}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setHasSubmitted(true)}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors"
                >
                  <Play className="h-4 w-4" />
                  Lancer l&apos;analyse
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ══ PART C — Résultats ═════════════════════════════════════════ */}
        {hasSubmitted && (
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <p className="data-label">Résultats de l&apos;analyse</p>
              <span className="badge badge-success">Analyse terminée</span>
            </div>

            {/* Podium — 3 KPI cards classées */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {metrics.classement.map((ss, rank) => {
                const originalIdx = metrics.scores.findIndex((s) => s.sys.id === ss.sys.id);
                return (
                  <div key={ss.sys.id} className="card p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 text-white ${POS_DOT[originalIdx]}`}>
                        {POS_LBL[originalIdx]}
                      </span>
                      <span className="data-label">{rank === 0 ? "🥇 Recommandé" : rank === 1 ? "🥈 2ème" : "🥉 3ème"}</span>
                    </div>
                    <span className="text-base font-semibold text-foreground leading-tight">{ss.sys.nom}</span>
                    <span className={`kpi-value tabnum ${POS_TXT[originalIdx]}`}>
                      {ss.scoreGlobal.toFixed(2)}<span className="text-lg font-normal text-foreground-subtle">/10</span>
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={scoreBadge(ss.scoreGlobal).cls}>{scoreBadge(ss.scoreGlobal).label}</span>
                      <span className="text-xs text-foreground-subtle">{ss.sys.categorie}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tableau des scores par critère */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="data-label">Scores détaillés par critère</p>
              <div className="flex flex-col gap-0">
                {/* En-tête */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pb-2 border-b border-border">
                  <span className="text-xs font-medium text-foreground-subtle">Critère</span>
                  {metrics.scores.map((ss, i) => (
                    <span key={ss.sys.id} className={`text-xs font-semibold text-center ${POS_TXT[i]}`}>
                      {POS_LBL[i]}
                    </span>
                  ))}
                </div>
                {/* Lignes */}
                {CRITERES.map(({ label, poidKey }) => {
                  const poids = formData[poidKey] as number;
                  const norm  = metrics.totalPoids > 0 ? poids / metrics.totalPoids * 100 : 0;
                  return (
                    <div key={poidKey} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 py-2.5 border-b border-border last:border-0 items-center">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm text-foreground">{label}</span>
                        <span className="text-xs text-foreground-subtle">pond. {norm.toFixed(0)} %</span>
                      </div>
                      {metrics.scores.map((ss, i) => {
                        const scoreKey = CRITERES.find((c) => c.poidKey === poidKey)!.key;
                        const val = ss.sys[scoreKey] as number;
                        return (
                          <div key={ss.sys.id} className="flex flex-col items-center gap-1 w-12">
                            <span className={`tabnum text-sm font-bold ${val >= 8 ? POS_TXT[i] : "text-foreground"}`}>{val}</span>
                            <div className="w-full h-1 bg-surface-raised rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${POS_BAR[i]}`} style={{ width: `${val * 10}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {/* Score global */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 pt-3 items-center">
                  <span className="text-sm font-semibold text-foreground">Score global pondéré</span>
                  {metrics.scores.map((ss, i) => (
                    <div key={ss.sys.id} className="flex flex-col items-center gap-1 w-12">
                      <span className={`tabnum text-sm font-bold ${POS_TXT[i]}`}>{ss.scoreGlobal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Budget & unités */}
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="data-label">Capacité d&apos;acquisition — budget {fmtKE(formData.budget)}</p>
                <span className="badge badge-info">{formData.theatre}</span>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {metrics.scores.map((ss, i) => (
                  <div key={ss.sys.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${POS_DOT[i]}`} />
                    <span className="text-sm font-medium text-foreground w-48">{ss.sys.nom}</span>
                    <div className="flex gap-6 ml-auto text-right">
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground-subtle">Prix unitaire</span>
                        <span className="tabnum text-sm text-foreground">{fmtKE(ss.sys.prixUnit)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-foreground-subtle">Unités</span>
                        <span className={`tabnum text-sm font-bold ${POS_TXT[i]}`}>
                          {ss.unitesAcquerables.toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommandation doctrinale */}
            <div className="card p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <p className="data-label">Recommandation doctrinale</p>
                <span className="badge badge-warning">{formData.mission}</span>
              </div>
              <p className="text-sm text-foreground-muted leading-relaxed">
                {metrics.recommandation}
              </p>
              <p className="text-xs text-foreground-subtle leading-relaxed border-t border-border pt-3 mt-1">
                Ce module s&apos;appuie sur des données OSINT (sources ouvertes) et des scores
                normalisés à des fins pédagogiques. Les performances réelles dépendent des variantes,
                configurations, environnements et doctrines d&apos;emploi spécifiques. Ce simulateur
                ne constitue pas une analyse opérationnelle ou un conseil d&apos;acquisition officiel.
              </p>
            </div>

            {/* Reset */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setHasSubmitted(false);
                  setCurrentStep(1);
                  setFormData(defaultFormData);
                }}
                className="text-sm text-foreground-subtle hover:text-foreground-muted transition-colors underline underline-offset-4"
              >
                Réinitialiser l&apos;analyse
              </button>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
