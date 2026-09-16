"use client";

/* ════════════════════════════════════════════════════════════════════════════
   ESRS / CSRD — Cockpit CarbonCo (refonte)
   Hero : jauge de conformité 270° + radar de couverture + barres par pilier ·
   Priorités : 3 normes qui bloquent l'objectif · Liste groupée par pilier ·
   Données réelles via useEsgSnapshot (matrice de matérialité).

   Chaque chiffre provient de l'API : sans snapshot ESG (404 `no_snapshot`) ou
   sans enjeu rattaché à une norme, la page affiche un état vide — plus de
   repli sur un jeu de démonstration, ni de compteurs de datapoints codés en
   dur (257/378), ni d'échéances inventées (« E1 · 15j / CSRD · 45j »).
   ════════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileSpreadsheet, Loader2 } from "lucide-react";

import { useEsgSnapshot } from "@/lib/hooks/use-esg-snapshot";

import {
  EsrsHero, EsrsPriorities, StandardsList,
  type EsrsStandard, type EsrsTotals, type EsrsPillarMap, type EsrsPillar, type EsrsPillarSummary,
} from "@/components/cockpit/esrs-sections";
import {
  deriveEsrsStandards,
  hasEsrsData,
  summarizeEsrs,
  type EsrsStandardId,
} from "@/components/cockpit/esrs-derivation";

/* ─── Palette piliers ESRS (cohérente avec le design cockpit) ─────────────── */
const PILLARS: EsrsPillarMap = {
  E:   { label: "Environnement", color: "#34D399" },
  S:   { label: "Social",        color: "#60A5FA" },
  G:   { label: "Gouvernance",   color: "#A78BFA" },
  GEN: { label: "Général",       color: "#22D3EE" },
};

/* ─── Métadonnées par norme : description, piste d'action, pilote suggéré ──
   Pistes génériques : aucune quantité propre à l'organisation n'y figure. */
const STANDARD_META: Record<EsrsStandardId, {
  code: string;
  name: string;
  pillar: EsrsPillar;
  desc: string;
  owner: string;
  action: string;
}> = {
  "ESRS E1": { code: "E1", name: "Changement climatique",      pillar: "E",   desc: "Atténuation, adaptation au changement climatique, énergie.", owner: "Dir. RSE",  action: "Finaliser le plan de transition climat (E1-1)." },
  "ESRS E2": { code: "E2", name: "Pollution",                  pillar: "E",   desc: "Pollution de l'air, de l'eau, des sols, substances préoccupantes.", owner: "Dir. Ops", action: "Compléter l'inventaire des substances préoccupantes." },
  "ESRS E3": { code: "E3", name: "Eau & ressources marines",   pillar: "E",   desc: "Consommation d'eau, rejets, écosystèmes marins.", owner: "Dir. Ops", action: "Mesurer la consommation d'eau de chaque site." },
  "ESRS E4": { code: "E4", name: "Biodiversité",               pillar: "E",   desc: "Impacts, dépendances, zones sensibles à la biodiversité.", owner: "Dir. RSE", action: "Cartographier les zones sensibles proches des sites." },
  "ESRS E5": { code: "E5", name: "Économie circulaire",        pillar: "E",   desc: "Flux de ressources, déchets, recyclage et réemploi.", owner: "Dir. Ops", action: "Tracer les flux de déchets par catégorie." },
  "ESRS S1": { code: "S1", name: "Effectifs propres",          pillar: "S",   desc: "Conditions de travail, égalité, santé & sécurité.", owner: "DRH", action: "Vérifier les indicateurs d'égalité salariale." },
  "ESRS S2": { code: "S2", name: "Travailleurs chaîne de valeur", pillar: "S", desc: "Conditions de travail, droits humains, travail forcé.", owner: "Achats", action: "Lancer le questionnaire fournisseurs droits humains." },
  "ESRS S3": { code: "S3", name: "Communautés affectées",      pillar: "S",   desc: "Droits des communautés, impact territorial.", owner: "Dir. RSE", action: "Démarrer la consultation des parties prenantes." },
  "ESRS S4": { code: "S4", name: "Consommateurs & clients",    pillar: "S",   desc: "Sécurité produits, vie privée, inclusion.", owner: "DSI", action: "Collecter les données satisfaction & vie privée." },
  "ESRS G1": { code: "G1", name: "Conduite des affaires",      pillar: "G",   desc: "Éthique, anti-corruption, lobbying, paiements.", owner: "Direction", action: "Documenter la politique anti-corruption." },
  "ESRS 1":  { code: "1",  name: "Exigences générales",        pillar: "GEN", desc: "Principes, périmètre, double matérialité.", owner: "Dir. RSE", action: "Valider le périmètre de consolidation." },
  "ESRS 2":  { code: "2",  name: "Informations générales",     pillar: "GEN", desc: "Stratégie, gouvernance, gestion des impacts (IRO).", owner: "Dir. RSE", action: "Compléter la description de la gouvernance ESG." },
};

const STANDARD_IDS_COUNT = Object.keys(STANDARD_META).length;

const TARGET = 80;

/* ─── États non nominaux ─────────────────────────────────────────────────── */

function EsrsNotice({
  tone,
  title,
  children,
}: {
  tone: "empty" | "error";
  title: string;
  children: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertTriangle : FileSpreadsheet;
  return (
    <div
      className="cc-card flex flex-col items-center gap-3 px-6 py-12 text-center"
      role={tone === "error" ? "alert" : "status"}
      data-testid={tone === "error" ? "esrs-error" : "esrs-empty"}
    >
      <Icon
        className="h-8 w-8"
        style={{ color: tone === "error" ? "var(--cc-amber)" : "var(--cc-em)" }}
        aria-hidden="true"
      />
      <h2 className="cc-card-title">{title}</h2>
      <div className="max-w-md text-sm text-[var(--cc-muted)]">{children}</div>
    </div>
  );
}

/* ─── Composant principal ───────────────────────────────────────────────── */

export function ESRSPage() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const esgSnap = useEsgSnapshot();

  // ── Standards (données réelles uniquement) ─────────────────────────
  const derived = useMemo(
    () => (esgSnap.status === "ready" ? deriveEsrsStandards(esgSnap.data.materialite?.issues ?? []) : []),
    [esgSnap],
  );
  // « Live » seulement si l'API a répondu ET que la matrice rattache au
  // moins un enjeu à une norme : une réponse vide n'est pas une conformité à 0 %.
  const isLive = esgSnap.status === "ready" && hasEsrsData(derived);

  const standards: EsrsStandard[] = useMemo(
    () =>
      derived.map((d) => {
        const meta = STANDARD_META[d.id];
        return {
          id: d.id,
          code: meta.code,
          name: meta.name,
          pillar: meta.pillar,
          progress: d.progress,
          // Aucun endpoint ne fournit le suivi des datapoints par norme.
          dp: null,
          done: null,
          missing: null,
          status: d.status,
          desc: meta.desc,
          owner: meta.owner,
          action: meta.action,
          materialIssues: d.materialIssues,
        };
      }),
    [derived],
  );

  // ── Totaux & résumé par pilier ──────────────────────────────────────
  const totals: EsrsTotals = useMemo(() => {
    const summary = summarizeEsrs(derived);
    return { ...summary, dpDone: null, dpTotal: null, target: TARGET };
  }, [derived]);

  const pillarSummary: EsrsPillarSummary[] = useMemo(() => {
    return (Object.keys(PILLARS) as EsrsPillar[]).map((p) => {
      const items = standards.filter((s) => s.pillar === p);
      const avg = items.length > 0
        ? Math.round(items.reduce((a, s) => a + s.progress, 0) / items.length)
        : 0;
      return { pillar: p, label: PILLARS[p].label, color: PILLARS[p].color, count: items.length, avg };
    });
  }, [standards]);

  return (
    <div className="cc-app">
      <div className="px-6 pt-4 pb-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-2xl leading-tight">ESRS / CSRD</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--cc-subtle)] mt-1">
              {isLive && <span className="cc-live-dot" />}
              <span>
                Conformité réglementaire · {STANDARD_IDS_COUNT} normes
                {isLive ? ` · ${totals.avg}% global` : ""}
              </span>
            </div>
          </div>
        </div>

        {esgSnap.status === "loading" && (
          <div className="flex items-center gap-2 py-10 text-sm text-[var(--cc-muted)]" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Chargement de la matrice de matérialité…
          </div>
        )}

        {esgSnap.status === "error" && esgSnap.empty && (
          <EsrsNotice tone="empty" title="Aucune donnée ESG importée">
            <p>{esgSnap.error}</p>
            <p className="mt-3">
              <Link href="/upload" className="font-semibold underline text-[var(--cc-em)]">
                Importer mes données
              </Link>
            </p>
          </EsrsNotice>
        )}

        {esgSnap.status === "error" && !esgSnap.empty && (
          <EsrsNotice tone="error" title="Conformité ESRS indisponible">
            <p>{esgSnap.error}</p>
          </EsrsNotice>
        )}

        {esgSnap.status === "ready" && !isLive && (
          <EsrsNotice tone="empty" title="Matrice de matérialité non renseignée">
            <p>
              Votre snapshot ESG ne rattache encore aucun enjeu à une norme ESRS : la conformité ne
              peut pas être calculée.
            </p>
            <p className="mt-3">
              <Link href="/materialite" className="font-semibold underline text-[var(--cc-em)]">
                Compléter la matrice de matérialité
              </Link>
            </p>
          </EsrsNotice>
        )}

        {isLive && (
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--cc-muted)]">
              <span className="cc-live-dot" />
              <span>Données réelles — dérivées de votre matrice de matérialité ESG</span>
            </div>

            {/* Hero conformité */}
            <EsrsHero
              standards={standards}
              totals={totals}
              pillars={PILLARS}
              pillarSummary={pillarSummary}
              hovered={hovered}
              setHovered={setHovered}
            />

            {/* Priorités de conformité */}
            <EsrsPriorities
              standards={standards}
              pillars={PILLARS}
              onOpen={setExpanded}
            />

            {/* Liste des normes groupée par pilier */}
            <StandardsList
              standards={standards}
              pillars={PILLARS}
              hovered={hovered}
              setHovered={setHovered}
              expanded={expanded}
              setExpanded={setExpanded}
            />

            <div className="text-center text-[11px] text-[var(--cc-subtle)] font-mono py-2">
              Conformité ESRS dérivée de la matrice de matérialité · objectif {TARGET}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}
