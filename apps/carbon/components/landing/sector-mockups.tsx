"use client";

/**
 * Mockups sectoriels — 3 variantes du dashboard CarbonCo (Industrie, Services,
 * Agroalimentaire) avec sidebar interactive : chaque onglet ouvre un pane
 * dédié avec données, graphiques et indicateurs propres au secteur.
 *
 * Le but : permettre à un décideur de se reconnaître immédiatement dans la
 * prévisualisation produit selon son industrie ET d'explorer les différentes
 * vues du produit (Dashboard / Scopes / ESRS / Matérialité / Datapoints /
 * Audit / Rapports) directement depuis la landing.
 */

import { useState } from "react";

/* ============================================================
   TYPES
   ============================================================ */

type SectorId = "industrie" | "services" | "agro";
type TabId =
  | "dashboard"
  | "scopes"
  | "esrs"
  | "materialite"
  | "datapoints"
  | "audit"
  | "rapports";

interface DonutSlice {
  lbl: string;
  pct: number;
  color: string;
}
interface PosteRow {
  lbl: string;
  val: string;
}
interface ScopeKpi {
  lbl: string;
  val: string;
  pct: number;
  delta: string;
}
interface ScopeDetail {
  cat: string;
  scope: "S1" | "S2" | "S3";
  val: string;
  pct: number;
}
interface EsrsRow {
  code: string;
  name: string;
  pct: number;
  status: "ok" | "warn";
}
interface MatEnjeu {
  name: string;
  x: number;
  y: number;
  big?: boolean;
}
interface DpSource {
  name: string;
  count: number;
  status: "ok" | "warn" | "pending";
}
interface AuditEvent {
  time: string;
  action: string;
  hash: string;
  sev: "ok" | "warn";
}
interface ReportRow {
  code: string;
  name: string;
  date: string;
  pages: number;
  size: string;
  status: "prêt" | "review";
}

interface SectorData {
  id: SectorId;
  name: string;
  accent: string;
  meta: string;
  sub: string;
  total: string;
  poste: { label: string; pct: number };
  donut: DonutSlice[];
  tops: PosteRow[];
  scopes: { kpis: ScopeKpi[]; detail: ScopeDetail[] };
  esrs: { coverage: number; points: { covered: number; total: number }; standards: EsrsRow[] };
  materialite: { enjeux: MatEnjeu[]; summary: string };
  datapoints: { stats: { validated: number; pending: number; missing: number }; sources: DpSource[] };
  audit: { events: AuditEvent[] };
  rapports: { list: ReportRow[] };
}

/* ============================================================
   DATASET — 3 secteurs × 7 panes
   ============================================================ */

const SECTORS: SectorData[] = [
  {
    id: "industrie",
    name: "Industrie",
    accent: "#1F8C52",
    meta: "Métallurgie · chimie · automobile",
    sub: "Métallurgie · chimie · automobile · Période 2025 · Unité kWh / unité",
    total: "12 480",
    poste: { label: "Combustion gaz process", pct: 31 },
    donut: [
      { lbl: "S1", pct: 38, color: "#62A8FF" },
      { lbl: "S2", pct: 24, color: "#A26BFF" },
      { lbl: "S3", pct: 38, color: "#1F8C52" },
    ],
    tops: [
      { lbl: "Combustion gaz process", val: "3 871" },
      { lbl: "Électricité atelier", val: "2 245" },
      { lbl: "Achats matières (acier)", val: "1 996" },
      { lbl: "Logistique amont", val: "1 372" },
    ],
    scopes: {
      kpis: [
        { lbl: "Scope 1 direct", val: "4 742", pct: 38, delta: "−6,2 %" },
        { lbl: "Scope 2 énergie", val: "2 995", pct: 24, delta: "−12,4 %" },
        { lbl: "Scope 3 chaîne", val: "4 743", pct: 38, delta: "−4,8 %" },
      ],
      detail: [
        { cat: "Combustion fixe (gaz process)", scope: "S1", val: "2 156", pct: 17.3 },
        { cat: "Fluides frigorigènes", scope: "S1", val: "512", pct: 4.1 },
        { cat: "Électricité (location-based)", scope: "S2", val: "2 488", pct: 19.9 },
        { cat: "Cat 1 — Achats matières", scope: "S3", val: "1 996", pct: 16.0 },
        { cat: "Cat 4 — Logistique amont", scope: "S3", val: "1 372", pct: 11.0 },
      ],
    },
    esrs: {
      coverage: 92,
      points: { covered: 184, total: 200 },
      standards: [
        { code: "E1", name: "Climat", pct: 100, status: "ok" },
        { code: "E2", name: "Pollution", pct: 88, status: "ok" },
        { code: "E5", name: "Ressources & circularité", pct: 95, status: "ok" },
        { code: "S1", name: "Personnel propre", pct: 80, status: "warn" },
        { code: "G1", name: "Conduite des affaires", pct: 100, status: "ok" },
      ],
    },
    materialite: {
      enjeux: [
        { name: "Climat & énergie", x: 88, y: 92, big: true },
        { name: "Ressources", x: 72, y: 80 },
        { name: "Pollution air", x: 65, y: 70 },
        { name: "Eau industrielle", x: 55, y: 60 },
        { name: "Conditions travail", x: 50, y: 45 },
        { name: "Éthique chaîne", x: 35, y: 40 },
      ],
      summary: "6 enjeux matériels identifiés · double matérialité validée",
    },
    datapoints: {
      stats: { validated: 184, pending: 12, missing: 4 },
      sources: [
        { name: "SAP S/4 — production", count: 78, status: "ok" },
        { name: "EDF — factures site Lyon", count: 24, status: "ok" },
        { name: "Engie — factures gaz", count: 32, status: "ok" },
        { name: "Tableur logistique", count: 38, status: "warn" },
        { name: "Achats fournisseurs Tier-1", count: 12, status: "pending" },
      ],
    },
    audit: {
      events: [
        { time: "Il y a 4 min", action: "Calcul Scope 1 figé", hash: "7a3f9c…", sev: "ok" },
        { time: "Il y a 12 min", action: "Datapoint E1.6 validé", hash: "4e2b1a…", sev: "ok" },
        { time: "Il y a 38 min", action: "Anomalie facture EDF résolue", hash: "d91c44…", sev: "warn" },
        { time: "Il y a 1 h", action: "Manifest racine signé", hash: "fe88ab…", sev: "ok" },
        { time: "Il y a 3 h", action: "Import SAP terminé · 78 datapoints", hash: "0a4421…", sev: "ok" },
      ],
    },
    rapports: {
      list: [
        { code: "E1", name: "Climat", date: "12 déc 2025", pages: 18, size: "2,4 Mo", status: "prêt" },
        { code: "E2", name: "Pollution", date: "12 déc 2025", pages: 11, size: "1,3 Mo", status: "prêt" },
        { code: "E5", name: "Ressources", date: "11 déc 2025", pages: 9, size: "1,1 Mo", status: "prêt" },
        { code: "S1", name: "Personnel", date: "11 déc 2025", pages: 14, size: "1,8 Mo", status: "review" },
        { code: "G1", name: "Conduite", date: "10 déc 2025", pages: 9, size: "1,2 Mo", status: "prêt" },
      ],
    },
  },
  {
    id: "services",
    name: "Services",
    accent: "#7B4FE0",
    meta: "Conseil · banque · numérique",
    sub: "Conseil · banque · numérique · Période 2025 · Unité kgCO₂e / FTE",
    total: "1 845",
    poste: { label: "Déplacements professionnels", pct: 34 },
    donut: [
      { lbl: "S1", pct: 8, color: "#62A8FF" },
      { lbl: "S2", pct: 22, color: "#A26BFF" },
      { lbl: "S3", pct: 70, color: "#1F8C52" },
    ],
    tops: [
      { lbl: "Déplacements pro (avion)", val: "627" },
      { lbl: "Cloud & data centers", val: "295" },
      { lbl: "Locaux (élec. + chauffage)", val: "248" },
      { lbl: "Services achetés", val: "385" },
    ],
    scopes: {
      kpis: [
        { lbl: "Scope 1 direct", val: "148", pct: 8, delta: "−2,1 %" },
        { lbl: "Scope 2 énergie", val: "405", pct: 22, delta: "−18,6 %" },
        { lbl: "Scope 3 chaîne", val: "1 292", pct: 70, delta: "−7,3 %" },
      ],
      detail: [
        { cat: "Chauffage gaz bureaux", scope: "S1", val: "148", pct: 8.0 },
        { cat: "Électricité bureaux & DC", scope: "S2", val: "405", pct: 22.0 },
        { cat: "Cat 6 — Voyages pro (avion)", scope: "S3", val: "627", pct: 34.0 },
        { cat: "Cat 1 — Cloud & SaaS", scope: "S3", val: "295", pct: 16.0 },
        { cat: "Cat 1 — Services conseil", scope: "S3", val: "385", pct: 20.9 },
      ],
    },
    esrs: {
      coverage: 88,
      points: { covered: 162, total: 184 },
      standards: [
        { code: "E1", name: "Climat", pct: 100, status: "ok" },
        { code: "S1", name: "Personnel propre", pct: 95, status: "ok" },
        { code: "S2", name: "Travailleurs chaîne valeur", pct: 75, status: "warn" },
        { code: "S4", name: "Consommateurs", pct: 70, status: "warn" },
        { code: "G1", name: "Conduite des affaires", pct: 100, status: "ok" },
      ],
    },
    materialite: {
      enjeux: [
        { name: "Mobilité & voyages", x: 85, y: 88, big: true },
        { name: "Numérique responsable", x: 78, y: 72 },
        { name: "Personnel & talents", x: 75, y: 60 },
        { name: "Données clients", x: 70, y: 55 },
        { name: "Éthique IA", x: 60, y: 50 },
        { name: "Diversité", x: 45, y: 40 },
      ],
      summary: "6 enjeux matériels · enjeu social majoritaire",
    },
    datapoints: {
      stats: { validated: 162, pending: 18, missing: 4 },
      sources: [
        { name: "Pennylane — comptabilité", count: 56, status: "ok" },
        { name: "Concur — voyages", count: 42, status: "ok" },
        { name: "AWS Carbon Footprint", count: 28, status: "ok" },
        { name: "Lucca — RH & talents", count: 22, status: "ok" },
        { name: "Questionnaires fournisseurs", count: 14, status: "pending" },
      ],
    },
    audit: {
      events: [
        { time: "Il y a 6 min", action: "Calcul Scope 3 voyages figé", hash: "8c2e15…", sev: "ok" },
        { time: "Il y a 22 min", action: "Datapoint S1.10 validé", hash: "3b9f47…", sev: "ok" },
        { time: "Il y a 1 h", action: "Sync Concur · 42 voyages", hash: "a6e1c2…", sev: "ok" },
        { time: "Il y a 2 h", action: "AWS API — anomalie corrigée", hash: "5d8f30…", sev: "warn" },
        { time: "Il y a 4 h", action: "Manifest racine signé", hash: "cc4a78…", sev: "ok" },
      ],
    },
    rapports: {
      list: [
        { code: "E1", name: "Climat", date: "12 déc 2025", pages: 14, size: "1,9 Mo", status: "prêt" },
        { code: "S1", name: "Personnel", date: "12 déc 2025", pages: 16, size: "2,1 Mo", status: "prêt" },
        { code: "S2", name: "Chaîne valeur", date: "11 déc 2025", pages: 8, size: "0,9 Mo", status: "review" },
        { code: "S4", name: "Consommateurs", date: "11 déc 2025", pages: 6, size: "0,7 Mo", status: "review" },
        { code: "G1", name: "Conduite", date: "10 déc 2025", pages: 9, size: "1,2 Mo", status: "prêt" },
      ],
    },
  },
  {
    id: "agro",
    name: "Agroalimentaire",
    accent: "#D97706",
    meta: "Transformation · distribution",
    sub: "Transformation · distribution · Période 2025 · Unité kgCO₂e / tonne",
    total: "8 730",
    poste: { label: "Matières premières agricoles", pct: 42 },
    donut: [
      { lbl: "S1", pct: 14, color: "#62A8FF" },
      { lbl: "S2", pct: 16, color: "#A26BFF" },
      { lbl: "S3", pct: 70, color: "#D97706" },
    ],
    tops: [
      { lbl: "Matières premières (lait, blé)", val: "3 666" },
      { lbl: "Logistique chaîne du froid", val: "1 484" },
      { lbl: "Emballages", val: "1 047" },
      { lbl: "Procédés thermiques", val: "873" },
    ],
    scopes: {
      kpis: [
        { lbl: "Scope 1 direct", val: "1 222", pct: 14, delta: "−4,4 %" },
        { lbl: "Scope 2 énergie", val: "1 397", pct: 16, delta: "−11,2 %" },
        { lbl: "Scope 3 chaîne", val: "6 111", pct: 70, delta: "−5,9 %" },
      ],
      detail: [
        { cat: "Procédés thermiques (vapeur)", scope: "S1", val: "873", pct: 10.0 },
        { cat: "Combustion chaufferies", scope: "S1", val: "349", pct: 4.0 },
        { cat: "Électricité usine", scope: "S2", val: "1 397", pct: 16.0 },
        { cat: "Cat 1 — Matières agricoles", scope: "S3", val: "3 666", pct: 42.0 },
        { cat: "Cat 4 — Logistique froid", scope: "S3", val: "1 484", pct: 17.0 },
      ],
    },
    esrs: {
      coverage: 86,
      points: { covered: 172, total: 200 },
      standards: [
        { code: "E1", name: "Climat", pct: 100, status: "ok" },
        { code: "E3", name: "Eau & ressources marines", pct: 90, status: "ok" },
        { code: "E4", name: "Biodiversité", pct: 78, status: "warn" },
        { code: "E5", name: "Ressources & circularité", pct: 82, status: "ok" },
        { code: "S2", name: "Travailleurs chaîne valeur", pct: 70, status: "warn" },
      ],
    },
    materialite: {
      enjeux: [
        { name: "Climat & agriculture", x: 90, y: 95, big: true },
        { name: "Biodiversité", x: 78, y: 82 },
        { name: "Eau & irrigation", x: 80, y: 70 },
        { name: "Bien-être animal", x: 65, y: 75 },
        { name: "Emballages", x: 60, y: 55 },
        { name: "Travail saisonnier", x: 50, y: 45 },
      ],
      summary: "6 enjeux matériels · biodiversité priorité 2",
    },
    datapoints: {
      stats: { validated: 172, pending: 22, missing: 6 },
      sources: [
        { name: "Sage X3 — production", count: 64, status: "ok" },
        { name: "TotalEnergies — gaz process", count: 28, status: "ok" },
        { name: "EDF — élec. usines", count: 24, status: "ok" },
        { name: "API agriculteurs partenaires", count: 38, status: "warn" },
        { name: "Logistique froid (LIS)", count: 18, status: "pending" },
      ],
    },
    audit: {
      events: [
        { time: "Il y a 8 min", action: "Calcul matières agricoles figé", hash: "9d4f0a…", sev: "ok" },
        { time: "Il y a 18 min", action: "Datapoint E4.3 validé", hash: "2b7c91…", sev: "ok" },
        { time: "Il y a 45 min", action: "Sync Sage · 64 datapoints", hash: "e1a5f3…", sev: "ok" },
        { time: "Il y a 1 h", action: "API partenaire — délai dépassé", hash: "7f2e88…", sev: "warn" },
        { time: "Il y a 3 h", action: "Manifest racine signé", hash: "b4d602…", sev: "ok" },
      ],
    },
    rapports: {
      list: [
        { code: "E1", name: "Climat", date: "12 déc 2025", pages: 16, size: "2,0 Mo", status: "prêt" },
        { code: "E3", name: "Eau", date: "12 déc 2025", pages: 10, size: "1,2 Mo", status: "prêt" },
        { code: "E4", name: "Biodiversité", date: "11 déc 2025", pages: 12, size: "1,5 Mo", status: "review" },
        { code: "E5", name: "Ressources", date: "11 déc 2025", pages: 11, size: "1,3 Mo", status: "prêt" },
        { code: "S2", name: "Chaîne valeur", date: "10 déc 2025", pages: 9, size: "1,0 Mo", status: "review" },
      ],
    },
  },
];

const TABS: { id: TabId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "scopes", label: "Scopes" },
  { id: "esrs", label: "ESRS" },
  { id: "materialite", label: "Matérialité" },
  { id: "datapoints", label: "Datapoints" },
  { id: "audit", label: "Audit" },
  { id: "rapports", label: "Rapports" },
];

const STATUS_LABEL: Record<TabId, { sev: "ok" | "warn"; text: string; extra: string[] }> = {
  dashboard: { sev: "ok", text: "Statut OTI · prêt", extra: ["100 % des datapoints tracés", "0 alerte critique", "export PDF disponible"] },
  scopes: { sev: "ok", text: "Scopes 1·2·3 figés", extra: ["méthodes ADEME", "audit trail SHA-256"] },
  esrs: { sev: "ok", text: "ESRS Set 2 conforme", extra: ["datapoints couverts à jour"] },
  materialite: { sev: "ok", text: "Double matérialité validée", extra: ["CSO · 12 déc 2025"] },
  datapoints: { sev: "warn", text: "Datapoints — 22 en attente", extra: ["relance fournisseurs"] },
  audit: { sev: "ok", text: "Audit trail signé", extra: ["Merkle root vérifié"] },
  rapports: { sev: "ok", text: "Rapports CSRD prêts à signer", extra: ["format iXBRL + PDF"] },
};

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */

function ScopeDonut({ donut }: { donut: DonutSlice[] }) {
  // Pré-calcule les offsets cumulatifs sans mutation pendant le render.
  const offsets = donut.reduce<number[]>((acc, d, i) => {
    const prev = i === 0 ? 25 : acc[i - 1] - donut[i - 1].pct;
    acc.push(prev);
    return acc;
  }, []);
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="w-[64px] h-[64px] flex-shrink-0 -rotate-90">
      <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(0,0,0,.05)" strokeWidth="4.2" />
      {donut.map((d, i) => (
        <circle
          key={i}
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke={d.color}
          strokeWidth="4.2"
          strokeDasharray={`${d.pct} ${100 - d.pct}`}
          strokeDashoffset={offsets[i]}
          pathLength={100}
        />
      ))}
    </svg>
  );
}

function CoverageRing({ pct, accent }: { pct: number; accent: string }) {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="w-[70px] h-[70px] -rotate-90">
      <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="3.6" />
      <circle
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke={accent}
        strokeWidth="3.6"
        strokeDasharray={`${pct} ${100 - pct}`}
        strokeDashoffset={25}
        pathLength={100}
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ============================================================
   PANE RENDERERS
   ============================================================ */

function DashboardPane({ s }: { s: SectorData }) {
  return (
    <>
      <PaneHead title={`Bilan carbone ${s.name}`} sub={s.sub} />
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Émissions totales 2025</span>
          <strong className="text-[26px] leading-[1.05] font-bold tracking-tight text-neutral-900 tabular-nums inline-flex items-baseline gap-1.5">
            {s.total}
            <em className="text-[11px] not-italic font-medium text-neutral-600">tCO₂e</em>
          </strong>
          <span className="text-[10px] text-neutral-500 mt-0.5">Vérifié OTI ready · audit trail SHA-256</span>
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Poste principal</span>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline gap-2 text-[12px]">
              <span className="font-medium text-neutral-900 truncate">{s.poste.label}</span>
              <b className="font-bold tabular-nums text-[12px] flex-shrink-0" style={{ color: s.accent }}>
                {s.poste.pct} %
              </b>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div className="h-full rounded-inherit transition-[width] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ width: `${s.poste.pct}%`, background: s.accent }} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 @[420px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @[420px]:gap-4 pt-3.5 border-t border-neutral-100">
        <div className="min-w-0">
          <SectionLbl>Répartition Scope</SectionLbl>
          <div className="flex items-center gap-3.5">
            <ScopeDonut donut={s.donut} />
            <ul className="list-none p-0 m-0 flex flex-col gap-1 text-[11px] text-neutral-600 tabular-nums flex-1 min-w-0 overflow-hidden">
              {s.donut.map((d) => (
                <li key={d.lbl} className="grid grid-cols-[10px_auto_1fr] gap-2 items-center">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="font-medium">{d.lbl}</span>
                  <b className="text-right font-bold text-neutral-900">{d.pct} %</b>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="min-w-0">
          <SectionLbl>Top postes d&apos;émission</SectionLbl>
          <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
            {s.tops.map((t) => (
              <li key={t.lbl} className="grid grid-cols-[1fr_auto_auto] gap-2.5 items-baseline text-[11.5px] text-neutral-900">
                <span className="text-neutral-600 truncate">{t.lbl}</span>
                <b className="font-bold tabular-nums text-[12px] text-right">{t.val}</b>
                <em className="not-italic text-neutral-500 text-[10px] font-medium">tCO₂e</em>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function ScopesPane({ s }: { s: SectorData }) {
  return (
    <>
      <PaneHead title="Scopes 1, 2, 3 — détail catégoriel" sub="GHG Protocol · facteurs ADEME 2025" />
      <div className="grid grid-cols-3 gap-3">
        {s.scopes.kpis.map((k) => (
          <div key={k.lbl} className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{k.lbl}</span>
            <strong className="text-[20px] leading-[1.05] font-bold tracking-tight text-neutral-900 tabular-nums">{k.val}</strong>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[11px] text-neutral-500 tabular-nums">{k.pct} %</span>
              <span className="text-[11px] font-semibold" style={{ color: s.accent }}>▼ {k.delta}</span>
            </div>
            <div className="h-1 rounded-full bg-neutral-100 mt-1">
              <div className="h-full rounded-inherit" style={{ width: `${k.pct}%`, background: s.accent }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 pt-3 border-t border-neutral-100">
        <SectionLbl>Catégories principales</SectionLbl>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {s.scopes.detail.map((d) => (
            <li key={d.cat} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2.5 items-center text-[11.5px] text-neutral-600 py-0.5">
              <ScopeTag scope={d.scope} accent={s.accent} />
              <span className="font-medium text-neutral-900 truncate min-w-0">{d.cat}</span>
              <b className="font-bold tabular-nums text-neutral-900 text-[12px]">{d.val}</b>
              <em className="not-italic text-neutral-500 text-[10px]">tCO₂e</em>
              <span className="text-neutral-500 tabular-nums text-[11px]">{d.pct} %</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function EsrsPane({ s }: { s: SectorData }) {
  return (
    <>
      <PaneHead title="ESRS Set 2 — couverture datapoints" sub="Conforme exigences CSRD 2025" />
      <div className="grid grid-cols-[1fr_auto] gap-4 items-center pb-3.5 border-b border-neutral-100">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Couverture globale</span>
          <strong className="text-[26px] leading-[1.05] font-bold tracking-tight text-neutral-900 tabular-nums inline-flex items-baseline gap-1.5">
            {s.esrs.coverage}
            <em className="text-[14px] not-italic font-medium text-neutral-600">%</em>
          </strong>
          <span className="text-[10px] text-neutral-500 font-medium">
            {s.esrs.points.covered} / {s.esrs.points.total} datapoints
          </span>
        </div>
        <CoverageRing pct={s.esrs.coverage} accent={s.accent} />
      </div>
      <div className="flex flex-col gap-2.5">
        <SectionLbl>Standards couverts</SectionLbl>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {s.esrs.standards.map((st) => (
            <li key={st.code} className="grid grid-cols-[auto_1fr_80px_auto_auto] gap-2.5 items-center text-[11.5px] py-0.5">
              <ScopeTag scope="ESRS" accent={s.accent} code={st.code} />
              <span className="font-medium text-neutral-900 truncate">{st.name}</span>
              <span className="h-1 rounded-full bg-neutral-100 inline-block">
                <span className="block h-full rounded-inherit" style={{ width: `${st.pct}%`, background: s.accent }} />
              </span>
              <b className="font-bold tabular-nums text-neutral-900 text-[12px]">{st.pct} %</b>
              <StatusPill status={st.status} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function MaterialitePane({ s }: { s: SectorData }) {
  return (
    <>
      <PaneHead title="Double matérialité — 2025" sub={s.materialite.summary} />
      <div className="grid grid-cols-[1fr_110px] gap-4 items-stretch">
        <div className="relative bg-neutral-50 border border-neutral-100 rounded-lg h-[200px] p-2.5">
          <span className="absolute left-[-2px] bottom-1/2 origin-bottom-left text-[9px] uppercase tracking-[0.08em] font-semibold text-neutral-500" style={{ transform: "rotate(-90deg) translate(50%, -100%)" }}>
            Impact env. / social
          </span>
          <span className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.08em] font-semibold text-neutral-500">Impact financier</span>
          <div className="absolute inset-2.5 pointer-events-none">
            <span className="absolute top-0 left-0 w-1/2 h-1/2 border-r border-b border-dashed border-neutral-200" />
            <span className="absolute top-0 right-0 w-1/2 h-1/2 border-b border-dashed border-neutral-200" style={{ background: `color-mix(in oklab, ${s.accent} 5%, transparent)` }} />
            <span className="absolute bottom-0 left-0 w-1/2 h-1/2 border-r border-dashed border-neutral-200" />
          </div>
          {s.materialite.enjeux.map((e) => (
            <div
              key={e.name}
              className="absolute rounded-full"
              style={{
                left: `${e.x}%`,
                bottom: `${e.y}%`,
                width: e.big ? "14px" : "10px",
                height: e.big ? "14px" : "10px",
                background: s.accent,
                boxShadow: `0 0 0 ${e.big ? 4 : 3}px color-mix(in oklab, ${s.accent} ${e.big ? 30 : 25}%, transparent)`,
                transform: "translate(-50%, 50%)",
              }}
            >
              <span
                className="absolute left-3 top-[-2px] text-[9px] whitespace-nowrap"
                style={{ color: e.big ? s.accent : "#475569", fontWeight: e.big ? 700 : 600 }}
              >
                {e.name}
              </span>
            </div>
          ))}
        </div>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5 text-[10.5px] text-neutral-600 self-center">
          {s.materialite.enjeux.slice(0, 4).map((e, i) => (
            <li key={e.name} className="flex items-center gap-1.5">
              <span
                className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px] font-bold"
                style={{ background: `color-mix(in oklab, ${s.accent} 14%, transparent)`, color: s.accent }}
              >
                {i + 1}
              </span>
              {e.name}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function DatapointsPane({ s }: { s: SectorData }) {
  const total = s.datapoints.stats.validated + s.datapoints.stats.pending + s.datapoints.stats.missing;
  return (
    <>
      <PaneHead title="Datapoints — extraction & validation" sub={`${total} datapoints · LLM-RAG ESRS Set 2`} />
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Validés</span>
          <strong className="text-[22px] font-bold tabular-nums" style={{ color: s.accent }}>{s.datapoints.stats.validated}</strong>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">En attente</span>
          <strong className="text-[22px] font-bold tabular-nums text-amber-600">{s.datapoints.stats.pending}</strong>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500">Manquants</span>
          <strong className="text-[22px] font-bold tabular-nums text-neutral-400">{s.datapoints.stats.missing}</strong>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 pt-3 border-t border-neutral-100">
        <SectionLbl>Sources actives</SectionLbl>
        <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
          {s.datapoints.sources.map((src) => (
            <li key={src.name} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2.5 items-center text-[11.5px] py-0.5">
              <span className="w-[22px] h-[22px] rounded-md bg-gradient-to-br from-neutral-100 to-neutral-50 border border-neutral-100" />
              <span className="font-medium text-neutral-900 truncate">{src.name}</span>
              <b className="font-bold tabular-nums text-neutral-900 text-[12px]">{src.count}</b>
              <em className="not-italic text-neutral-500 text-[10px]">dp</em>
              <StatusPill status={src.status} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function AuditPane({ s }: { s: SectorData }) {
  return (
    <>
      <PaneHead title="Audit trail — événements récents" sub="Chaîne SHA-256 · append-only · vérifiable" />
      <ul className="list-none p-0 m-0 flex flex-col gap-3 relative">
        <span className="absolute left-1 top-1.5 bottom-1.5 w-px bg-gradient-to-b from-neutral-200 to-neutral-100" aria-hidden="true" />
        {s.audit.events.map((e, i) => (
          <li key={i} className="grid grid-cols-[14px_1fr] gap-2.5 items-start relative">
            <span
              className="w-[9px] h-[9px] rounded-full mt-1"
              style={{
                background: e.sev === "ok" ? "#1F8C52" : "#D97706",
                boxShadow: `0 0 0 3px ${e.sev === "ok" ? "rgba(31,140,82,.18)" : "rgba(217,119,6,.18)"}`,
              }}
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex justify-between items-baseline gap-2">
                <strong className="text-[12px] text-neutral-900 font-semibold truncate">{e.action}</strong>
                <span className="text-[10px] text-neutral-500 flex-shrink-0 tabular-nums">{e.time}</span>
              </div>
              <code className="font-mono text-[10px] text-neutral-500 bg-neutral-50 px-1.5 py-px rounded inline-block w-fit">{e.hash}</code>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function RapportsPane({ s }: { s: SectorData }) {
  return (
    <>
      <PaneHead title="Rapports CSRD — prêts à signer" sub="Format iXBRL + PDF · audit trail inclus" />
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
        {s.rapports.list.map((r) => (
          <li
            key={r.code}
            className="grid grid-cols-[38px_1fr_auto] gap-3 items-center px-3 py-2.5 border border-neutral-100 rounded-lg bg-white transition-all hover:-translate-y-px"
            style={{ borderColor: undefined }}
          >
            <span
              className="w-[38px] h-[38px] rounded-lg grid place-items-center text-[12px] font-bold tracking-wider"
              style={{ background: `color-mix(in oklab, ${s.accent} 14%, transparent)`, color: s.accent }}
            >
              {r.code}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <strong className="text-[12px] font-semibold text-neutral-900 truncate">
                Rapport {r.code} — {r.name}
              </strong>
              <span className="text-[10.5px] text-neutral-500 tabular-nums">
                {r.date} · {r.pages} pages · {r.size}
              </span>
            </div>
            <StatusPill status={r.status === "prêt" ? "ok" : "warn"} label={r.status} />
          </li>
        ))}
      </ul>
    </>
  );
}

/* ============================================================
   ATOMS
   ============================================================ */

function PaneHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-0.5 pb-3 border-b border-neutral-100">
      <h4 className="m-0 text-[14px] font-bold tracking-tight text-neutral-900">{title}</h4>
      <span className="text-[11px] text-neutral-500 tabular-nums truncate">{sub}</span>
    </div>
  );
}

function SectionLbl({ children }: { children: React.ReactNode }) {
  return <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-500 mb-2.5">{children}</span>;
}

function ScopeTag({ scope, accent, code }: { scope: "S1" | "S2" | "S3" | "ESRS"; accent: string; code?: string }) {
  let bg = "rgba(15,23,42,.06)";
  let color = "#475569";
  if (scope === "S1") {
    bg = "rgba(98,168,255,.14)";
    color = "#2C72D2";
  } else if (scope === "S2") {
    bg = "rgba(162,107,255,.14)";
    color = "#7B4FE0";
  } else if (scope === "S3" || scope === "ESRS") {
    bg = `color-mix(in oklab, ${accent} 18%, transparent)`;
    color = accent;
  }
  return (
    <span
      className="inline-flex items-center justify-center text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide min-w-[24px]"
      style={{ background: bg, color, minWidth: scope === "ESRS" ? 30 : 24 }}
    >
      {code ?? scope}
    </span>
  );
}

function StatusPill({ status, label }: { status: "ok" | "warn" | "pending"; label?: string }) {
  if (label) {
    const ok = status === "ok";
    return (
      <span
        className="inline-flex items-center justify-center text-[10px] font-medium px-2 rounded-full"
        style={{
          background: ok ? "rgba(31,140,82,.14)" : "rgba(217,119,6,.14)",
          color: ok ? "#1F8C52" : "#D97706",
        }}
      >
        {label}
      </span>
    );
  }
  const map = {
    ok: { bg: "rgba(31,140,82,.14)", color: "#1F8C52", char: "✓" },
    warn: { bg: "rgba(217,119,6,.14)", color: "#D97706", char: "!" },
    pending: { bg: "rgba(15,23,42,.06)", color: "#94A3B8", char: "…" },
  } as const;
  const m = map[status];
  return (
    <span
      className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[11px] font-bold"
      style={{ background: m.bg, color: m.color }}
    >
      {m.char}
    </span>
  );
}

/* ============================================================
   CARD
   ============================================================ */

function PaneRouter({ s, tab }: { s: SectorData; tab: TabId }) {
  switch (tab) {
    case "dashboard":
      return <DashboardPane s={s} />;
    case "scopes":
      return <ScopesPane s={s} />;
    case "esrs":
      return <EsrsPane s={s} />;
    case "materialite":
      return <MaterialitePane s={s} />;
    case "datapoints":
      return <DatapointsPane s={s} />;
    case "audit":
      return <AuditPane s={s} />;
    case "rapports":
      return <RapportsPane s={s} />;
  }
}

function SectorCard({ s }: { s: SectorData }) {
  const [tab, setTab] = useState<TabId>("dashboard");
  const status = STATUS_LABEL[tab];
  return (
    <article
      className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 hover:shadow-lg transition-shadow flex flex-col gap-4 [container-type:inline-size]"
      style={{ ["--accent" as string]: s.accent }}
    >
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Cas sectoriel</p>
        <h3 className="font-extrabold text-xl text-neutral-900 mt-1">{s.name}</h3>
        <p className="text-[13px] text-neutral-500 mt-0.5 font-medium">{s.meta}</p>
      </header>

      <div className="border border-neutral-200 rounded-xl bg-[#FBFCFD] overflow-hidden flex flex-col">
        {/* Chrome */}
        <div className="flex items-center gap-3 px-3.5 py-2 bg-neutral-50 border-b border-neutral-100">
          <span className="inline-flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neutral-300" />
            <span className="w-2 h-2 rounded-full bg-neutral-300" />
            <span className="w-2 h-2 rounded-full bg-neutral-300" />
          </span>
          <span className="text-[11px] text-neutral-500 tabular-nums">
            carbonco.fr/{tab} · {s.name}
          </span>
        </div>

        {/* Body */}
        <div className="grid grid-cols-[96px_1fr] gap-4 p-4 min-h-[420px]">
          {/* Sidebar interactive */}
          <aside className="pt-1">
            <ul className="list-none p-0 m-0 flex flex-col gap-1" role="tablist" aria-label="Vues du dashboard">
              {TABS.map((t) => {
                const active = t.id === tab;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.id)}
                      className="w-full text-left text-[11px] leading-tight px-2 py-1 rounded-md cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={{
                        color: active ? s.accent : "#64748B",
                        fontWeight: active ? 600 : 400,
                        background: active ? `color-mix(in oklab, ${s.accent} 14%, transparent)` : "transparent",
                      }}
                    >
                      {t.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Main pane (re-monté via key={tab} pour forcer le repaint propre) */}
          <div key={tab} className="flex flex-col gap-3.5 min-w-0">
            <PaneRouter s={s} tab={tab} />
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center gap-2.5 px-5 py-2.5 bg-[#F8FAF9] border-t border-neutral-100 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-2 font-semibold text-neutral-900">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: status.sev === "ok" ? "#1F8C52" : "#D97706",
                boxShadow: `0 0 0 3px ${status.sev === "ok" ? "rgba(31,140,82,.18)" : "rgba(217,119,6,.18)"}`,
              }}
            />
            {status.text}
          </span>
          {status.extra.map((e, i) => (
            <span key={i} className="contents">
              <span className="text-neutral-300">·</span>
              <span className="text-neutral-600 font-medium whitespace-nowrap">{e}</span>
            </span>
          ))}
        </footer>
      </div>

      <p className="text-xs text-neutral-500 leading-relaxed mt-1">
        Données illustratives. Cliquez sur un onglet de la sidebar pour explorer chaque vue produite par Carbon&Co.
      </p>
    </article>
  );
}

/* ============================================================
   PUBLIC EXPORTS — API préservée
   ============================================================ */

interface SectorMockupProps {
  sector: SectorId;
  className?: string;
}

/**
 * Composant carte sectorielle complète (avec sidebar interactive).
 * Conserve l'API publique d'origine pour compatibilité.
 */
export function SectorMockup({ sector, className = "" }: SectorMockupProps) {
  const data = SECTORS.find((s) => s.id === sector);
  if (!data) return null;
  return (
    <div className={className}>
      <SectorCard s={data} />
    </div>
  );
}

interface SectorShowcaseProps {
  className?: string;
}

/**
 * Grille des 3 cartes sectorielles. Chaque carte a sa sidebar 7 onglets
 * cliquables avec données contextuelles propres au secteur.
 */
export function SectorShowcase({ className = "" }: SectorShowcaseProps) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
      {SECTORS.map((s) => (
        <SectorCard key={s.id} s={s} />
      ))}
    </div>
  );
}
