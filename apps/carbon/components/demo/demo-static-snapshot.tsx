"use client";

// SNAPSHOT STATIQUE — variante prefers-reduced-motion de la démo /demo.
//
// Sous mouvement réduit, l'horloge cinématique n'auto-avance pas. On rend alors
// CETTE scène : les 7 phases de la démo dans leur ÉTAT FINAL, empilées et SANS
// la moindre animation (ni transition, ni classe DEMO_CSS, ni framer-motion).
//
// AUTONOME : ce fichier n'importe AUCUNE phase animée. Il reconstruit des
// sections statiques directement à partir des données du contrat (demo-types).
// L'utilisateur navigue à la main : la barre du haut propose un bouton par phase
// qui fait défiler (scrollIntoView) vers la section correspondante (id
// "demo-phase-N"). Si le contexte timeline est présent, on synchronise aussi
// goToPhase (utile pour le phase-indicator / l'analytique) — c'est OPTIONNEL.
//
// Aucun timer (setTimeout/interval/raf) n'est posé ici : rien à nettoyer.

import Link from "next/link";

import {
  PHASE_META,
  DEMO_FILE,
  IMPORT_ROWS,
  MAPPING_ROWS,
  DEMO_FACTOR,
  DEMO_GES_TARGET,
  DEMO_GES_UNIT,
  AUDIT_TRACE_BLOCKS,
  ANOMALY_ROWS,
  AUDIT_EVENTS,
  EXPORT_FORMATS,
  PROOF_BLOCKS,
  VERIFY_CHECKS,
  DEMO_HASH_FULL,
  DEMO_TONE_CLASSES,
  type DemoPhase,
} from "@/components/demo/demo-types";
import { useDemoTimeline } from "@/lib/hooks/use-demo-timeline";

/* ── Constantes de présentation ─────────────────────────────────────────────── */

/** Classes de base d'un badge d'état (complétées par la tonalité de la donnée). */
const BADGE_BASE = "rounded-full border px-3 py-1 text-xs font-bold";

/** Kicker réutilisable (text-[0.68rem] uppercase tracking-widest emerald-300). */
const KICKER =
  "text-[0.68rem] font-bold uppercase tracking-widest text-emerald-300/80";

/** Carte standard de la scène (rounded-2xl, fond translucide, bordure discrète). */
const CARD = "rounded-2xl border border-white/10 bg-white/[0.04]";

/** Liste ordonnée des 7 phases (clés numériques typées). */
const PHASES: DemoPhase[] = [1, 2, 3, 4, 5, 6, 7];

/** Identifiant d'ancre d'une section de phase. */
function phaseAnchorId(phase: DemoPhase): string {
  return `demo-phase-${phase}`;
}

/* ── Icône NEURAL réutilisable (étoile à 8 branches + cœur, emerald-400) ─────── */

function NeuralMark({ size = 72 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#34D399"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/* ── En-tête de section (kicker + titre), commun à toutes les phases ─────────── */

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="space-y-2">
      <p className={KICKER}>{kicker}</p>
      <h2 className="text-2xl font-extrabold tracking-tight text-white">
        {title}
      </h2>
    </header>
  );
}

/* ── Coche statique (état final « validé ») ──────────────────────────────────── */

function StaticCheck({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#34D399"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ════════════════════════════════════════════════════════════════════════════ */

export function DemoStaticSnapshot() {
  // Le contexte timeline est disponible quand la scène est montée par
  // DemoExperience (qui fournit le Provider). On l'utilise UNIQUEMENT pour
  // synchroniser la phase courante au scroll — c'est purement optionnel.
  const { goToPhase } = useDemoTimeline();

  // Navigation : défile vers la section et synchronise la phase courante.
  const navigateTo = (phase: DemoPhase) => {
    if (typeof document !== "undefined") {
      const target = document.getElementById(phaseAnchorId(phase));
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    goToPhase(phase);
  };

  // Total GES figé, formaté à la française (espace insécable comme séparateur).
  const gesLabel = `${DEMO_GES_TARGET.toLocaleString("fr-FR")} ${DEMO_GES_UNIT}`;

  return (
    <div
      data-testid="demo-static-snapshot"
      style={{ backgroundColor: "#070909" }}
      className="min-h-screen text-white"
    >
      <div className="mx-auto max-w-3xl px-5 py-24">
        {/* ── Barre de navigation : un bouton par phase ─────────────────────── */}
        <nav
          aria-label="Navigation par phase de la démo"
          className="mb-12 flex flex-wrap gap-2"
        >
          {PHASES.map((phase) => (
            <button
              key={phase}
              type="button"
              onClick={() => navigateTo(phase)}
              data-testid={`demo-static-nav-${phase}`}
              aria-label={`Aller à la phase ${phase} — ${PHASE_META[phase].label}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/70 transition-colors hover:border-white/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {PHASE_META[phase].label}
            </button>
          ))}
        </nav>

        {/* Sections empilées (espacement vertical global). */}
        <div className="space-y-10">
          {/* ──────────────────────────────────────────────────────────────────
             PHASE 1 — Intro (marque + NEURAL actif).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(1)}
            data-testid="demo-static-phase-1"
            className="scroll-mt-24 space-y-5"
          >
            <SectionHeader kicker={PHASE_META[1].kicker} title="Carbon&Co" />
            <div className={`${CARD} flex flex-col items-center gap-4 p-8 text-center`}>
              <div className="flex h-[112px] w-[112px] items-center justify-center rounded-full bg-emerald-400/10">
                <NeuralMark size={60} />
              </div>
              <p className="text-4xl font-extrabold tracking-tight text-white">
                Carbon<span className="text-emerald-400">&amp;</span>Co
              </p>
              <p className="max-w-md text-sm text-white/55">
                Du tableur au rapport auditable — en 100 secondes.
              </p>
              <p
                className={`${BADGE_BASE} ${DEMO_TONE_CLASSES.green} flex items-center gap-2`}
              >
                <span aria-hidden="true">●</span>
                NEURAL Actif · v2.4 · ESRS native
              </p>
            </div>
          </section>

          {/* ──────────────────────────────────────────────────────────────────
             PHASE 2 — Import du fichier (847 lignes normalisées).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(2)}
            data-testid="demo-static-phase-2"
            className="scroll-mt-24 space-y-5"
          >
            <SectionHeader
              kicker={PHASE_META[2].kicker}
              title="Import du fichier"
            />

            {/* Badge fichier source. */}
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2">
              <span className="font-mono text-sm text-emerald-300">
                {DEMO_FILE}
              </span>
              <span className="text-sm text-white/50">14 feuilles</span>
            </div>

            {/* Lignes d'import normalisées (badge de tonalité par ligne). */}
            <ul className={`${CARD} overflow-hidden`}>
              {IMPORT_ROWS.map((row, index) => (
                <li
                  key={`${row.label}-${index}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm text-white/80">{row.label}</span>
                  <span className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[row.tone]}`}>
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>

            {/* Encart résultat. */}
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-4">
              <p className="text-[0.68rem] font-bold uppercase tracking-widest text-cyan-300/80">
                Résultat
              </p>
              <p className="mt-2 text-sm text-white/80">
                847 lignes normalisées · prêtes pour le calcul carbone
              </p>
            </div>
          </section>

          {/* ──────────────────────────────────────────────────────────────────
             PHASE 3 — Calcul des émissions (compteur figé + double preuve).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(3)}
            data-testid="demo-static-phase-3"
            className="scroll-mt-24 space-y-6"
          >
            <SectionHeader
              kicker={PHASE_META[3].kicker}
              title="Calcul des émissions"
            />

            {/* Compteur GES figé sur sa valeur cible (formaté fr-FR). */}
            <div className={`${CARD} flex flex-col items-center gap-2 p-6 text-center`}>
              <p className={KICKER}>Total des émissions calculé</p>
              <p
                data-testid="demo-static-ges"
                className="font-mono text-4xl font-extrabold text-emerald-400"
              >
                {gesLabel}
              </p>
              <span
                className={`${BADGE_BASE} ${DEMO_TONE_CLASSES.green} mt-1 inline-flex items-center gap-1.5`}
              >
                <span aria-hidden="true">✓</span> Validé par l'auditeur
              </span>
            </div>

            {/* Lignes source mappées (libellé + badge de tonalité). */}
            <div className="space-y-3">
              <p className={KICKER}>Lignes source mappées</p>
              <ul className={`${CARD} overflow-hidden`}>
                {MAPPING_ROWS.map((row, index) => (
                  <li
                    key={`${row.label}-${index}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
                  >
                    <span className="text-sm text-white/80">{row.label}</span>
                    <span className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[row.tone]}`}>
                      {row.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Justification du facteur d'émission retenu. */}
            <div className="space-y-3">
              <p className={KICKER}>Justification facteur</p>
              <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-sm font-semibold text-white">
                  {DEMO_FACTOR.name}
                </p>
                <dl className="mt-4 flex flex-col gap-3">
                  <div>
                    <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                      Valeur du facteur
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-emerald-300">
                      {DEMO_FACTOR.value}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                      Identifiant facteur conservé
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-emerald-300">
                      {DEMO_FACTOR.reference}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[0.68rem] font-bold uppercase tracking-widest text-white/40">
                      Version Base Empreinte®
                    </dt>
                    <dd className="mt-1 text-xs text-white/70">
                      {DEMO_FACTOR.source}
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>

            {/* Remontée de traçabilité auditeur : les 6 blocs (label + détail). */}
            <div className="space-y-3">
              <p className={KICKER}>Remontée de traçabilité</p>
              <ul className="flex flex-col gap-3">
                {AUDIT_TRACE_BLOCKS.map((block) => (
                  <li
                    key={block.id}
                    data-testid="demo-static-trace-block"
                    className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-white/[0.04] px-4 py-3"
                  >
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"
                      aria-hidden="true"
                    >
                      <StaticCheck size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {block.label}
                      </p>
                      <p className="mt-0.5 break-all font-mono text-xs text-white/55">
                        {block.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ──────────────────────────────────────────────────────────────────
             PHASE 4 — Contrôle qualité (état CORRIGÉ : badges « après »).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(4)}
            data-testid="demo-static-phase-4"
            className="scroll-mt-24 space-y-5"
          >
            <SectionHeader
              kicker={PHASE_META[4].kicker}
              title="Contrôle qualité"
            />

            {/* Bandeau d'état final : tout corrigé. */}
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2">
              <StaticCheck size={18} />
              <span className="text-sm font-semibold text-emerald-100">
                3 anomalies corrigées · historisées
              </span>
            </div>

            {/* Liste des anomalies avec leur badge « après » (vert). */}
            <ul className={`${CARD} overflow-hidden`}>
              {ANOMALY_ROWS.map((row) => (
                <li
                  key={row.id}
                  data-testid="demo-static-anomaly-row"
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.08] px-4 py-3 last:border-b-0"
                >
                  <span className="text-sm text-white/80">{row.label}</span>
                  <span
                    className={`${BADGE_BASE} ${DEMO_TONE_CLASSES[row.after.tone]}`}
                  >
                    {row.after.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ──────────────────────────────────────────────────────────────────
             PHASE 5 — Journal de preuve (chaîne d'événements signés).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(5)}
            data-testid="demo-static-phase-5"
            className="scroll-mt-24 space-y-5"
          >
            <SectionHeader
              kicker={PHASE_META[5].kicker}
              title="Journal de preuve"
            />
            <ul className={`${CARD} divide-y divide-white/[0.08]`}>
              {AUDIT_EVENTS.map((event) => (
                <li
                  key={event.id}
                  data-testid="demo-static-audit-event"
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    aria-hidden="true"
                  >
                    <StaticCheck size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-white/50">
                      {event.time}
                    </p>
                    <p className="mt-0.5 text-sm text-white">{event.label}</p>
                  </div>
                  <p className="shrink-0 font-mono text-xs text-emerald-300/60">
                    #{event.hash}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* ──────────────────────────────────────────────────────────────────
             PHASE 6 — Export auditeur (formats + chaîne de preuve + vérif).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(6)}
            data-testid="demo-static-phase-6"
            className="scroll-mt-24 space-y-6"
          >
            <SectionHeader
              kicker={PHASE_META[6].kicker}
              title="Export auditeur"
            />

            {/* Formats d'export — tous générés (coche emerald). */}
            <div className="grid gap-4 sm:grid-cols-3">
              {EXPORT_FORMATS.map((format) => (
                <article
                  key={format.id}
                  data-testid="demo-static-export-format"
                  className="flex flex-col rounded-2xl border border-emerald-400/30 bg-white/[0.04] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-xs font-bold text-emerald-200">
                      {format.ext}
                    </span>
                    <StaticCheck size={20} />
                  </div>
                  <p className="mt-4 text-base font-bold text-white">
                    {format.label}
                  </p>
                  <p className="mt-1 text-sm text-white/55">{format.detail}</p>
                </article>
              ))}
            </div>

            {/* Chaîne de preuve — 5 blocs signés (mini-hash visibles). */}
            <div className="space-y-3">
              <p className={KICKER}>Chaîne de preuve</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {PROOF_BLOCKS.map((block) => (
                  <div
                    key={block.id}
                    data-testid="demo-static-proof-block"
                    className="min-w-[120px] flex-1 rounded-lg border border-solid border-emerald-400/30 bg-neutral-900 px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <StaticCheck size={14} />
                      <span className="text-xs font-semibold text-white">
                        {block.label}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-white/50">
                      {block.timestamp}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-emerald-300/60">
                      #{block.miniHash}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Vérification publique — URL + 4 contrôles cochés + lien. */}
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className={KICKER}>Vérification publique</p>
                <p className="mt-1.5 whitespace-nowrap break-all font-mono text-xs text-white/80">
                  /demo/verify/sha256-{DEMO_HASH_FULL}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-400/20 bg-neutral-900 p-6">
                <div className="flex items-center gap-2">
                  <StaticCheck size={20} />
                  <span className="font-bold text-white">Rapport vérifié</span>
                </div>
                <ul className="mt-4 flex flex-col gap-3">
                  {VERIFY_CHECKS.map((check) => (
                    <li
                      key={check}
                      data-testid="demo-static-verify-check"
                      className="flex items-center gap-2"
                    >
                      <StaticCheck size={16} />
                      <span className="text-sm text-white/80">{check}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/demo/verify/${DEMO_HASH_FULL}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="demo-static-verify-link"
                  aria-label="Ouvrir la vérification publique dans un nouvel onglet"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-center font-bold text-black transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                >
                  Ouvrir la vérification publique
                </Link>
              </div>
            </div>
          </section>

          {/* ──────────────────────────────────────────────────────────────────
             PHASE 7 — CTA final (essai, vérification, retour accueil).
             ────────────────────────────────────────────────────────────────── */}
          <section
            id={phaseAnchorId(7)}
            data-testid="demo-static-phase-7"
            className="scroll-mt-24 space-y-6"
          >
            <SectionHeader
              kicker={PHASE_META[7].kicker}
              title="Votre rapport, prêt à être audité."
            />
            <p className="max-w-2xl text-white/55">
              Traçable jusqu'à la cellule source. Vérifiable sans aucun outil
              propriétaire.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              {/* CTA principal : démarrer l'essai gratuit. */}
              <Link
                href="/login"
                aria-label="Démarrer gratuitement — essai de 14 jours"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 font-bold text-black transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Démarrer gratuitement — 14 jours
              </Link>

              {/* CTA secondaire : vérification publique de la preuve. */}
              <Link
                href={`/demo/verify/${DEMO_HASH_FULL}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Vérifier la preuve publiquement dans un nouvel onglet"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-4 font-bold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Vérifier la preuve publiquement
              </Link>
            </div>

            {/* Lien discret : retour à l'accueil. */}
            <Link
              href="/"
              className="inline-block text-sm text-white/40 transition-colors hover:text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              ← Retour à l'accueil
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
