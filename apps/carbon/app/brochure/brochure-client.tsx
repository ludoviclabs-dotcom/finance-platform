"use client";

/**
 * Brochure CarbonCo — 8 pages, imprimable et téléchargeable.
 *
 * Le rendu vise deux usages :
 *   1. Visualisation web (max-width A4 + ombres) — partageable par lien.
 *   2. Impression / sauvegarde PDF par le navigateur (Cmd/Ctrl+P) avec
 *      pagination respectée grâce à @page + page-break-after.
 *
 * Aucun moteur PDF côté serveur : on s'appuie sur la fenêtre d'impression
 * du navigateur, ce qui élimine toute dépendance lourde et garantit que la
 * qualité visuelle correspond exactement au design web.
 */

import { useCallback } from "react";
import Link from "next/link";
import {
  CollecteIllustration,
  CalculIllustration,
  AuditIllustration,
  RapportIllustration,
  Scope1Illustration,
  Scope2Illustration,
  Scope3Illustration,
  OtiIllustration,
} from "@/components/landing/illustrations";
import { TrustBadges } from "@/components/landing/trust-badges";
import { SecurityArchitecture } from "@/components/landing/security-architecture";
import {
  ScopesInfographic,
  CsrdCalendarInfographic,
  ExcelToReportInfographic,
} from "@/components/landing/infographies";
import { CompetitorComparison } from "@/components/landing/competitor-comparison";

const PRINT_STYLE = `
  @page { size: A4; margin: 0; }
  @media print {
    html, body { background: #ffffff !important; }
    .brochure-toolbar { display: none !important; }
    .brochure-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
    .brochure-page:last-child { page-break-after: auto; }
  }
`;

function Page({
  index,
  title,
  children,
}: {
  index: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="brochure-page bg-white shadow-2xl mx-auto my-8 p-12 print:my-0 print:shadow-none"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
      }}
    >
      <header className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-200">
        <span className="text-xs font-extrabold tracking-tighter text-black">
          Carbon<span className="text-green-600">&amp;</span>Co
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
          Brochure {index}
        </span>
      </header>
      {title && (
        <h2 className="text-3xl font-extrabold tracking-tighter text-neutral-900 mb-6">
          {title}
        </h2>
      )}
      <div className="text-neutral-700 leading-relaxed">{children}</div>
      <footer className="mt-12 pt-4 border-t border-neutral-200 flex justify-between text-[10px] text-neutral-400">
        <span>carbonco.fr · contact@carbonco.fr</span>
        <span>Édition 2026 · Confidentiel</span>
      </footer>
    </section>
  );
}

export function BrochureClient() {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="bg-neutral-100 min-h-screen pb-16">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />

      {/* Barre d'actions (masquée à l'impression) */}
      <div className="brochure-toolbar sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              CarbonCo
            </p>
            <h1 className="text-xl font-extrabold text-neutral-900">
              Brochure commerciale — 8 pages
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              ← Retour
            </Link>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer"
            >
              Imprimer / Sauver en PDF
            </button>
          </div>
        </div>
      </div>

      {/* Page 1 — couverture */}
      <Page index="01">
        <div className="flex flex-col items-center justify-center text-center min-h-[600px]">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-8">
            Plateforme ESG & CSRD · Édition 2026
          </div>
          <h1 className="text-6xl font-extrabold tracking-tighter text-neutral-900 leading-[0.95] mb-6">
            Du tableur au rapport
            <br />
            <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              auditable.
            </span>
          </h1>
          <p className="text-lg text-neutral-600 max-w-xl mb-12 leading-relaxed">
            CarbonCo automatise la conformité ESRS, sécurise la traçabilité de
            chaque chiffre et met en route votre reporting CSRD en moins de trois
            semaines.
          </p>
          <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-green-600">3 sem.</p>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Mise en route</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-green-600">100 %</p>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Datapoints tracés</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-green-600">UE</p>
              <p className="text-xs text-neutral-500 uppercase tracking-widest mt-1">Hébergement & IA</p>
            </div>
          </div>
        </div>
      </Page>

      {/* Page 2 — sommaire + positionnement */}
      <Page index="02" title="Pourquoi CarbonCo">
        <p className="mb-6">
          Le règlement CSRD impose désormais à plus de 50 000 entreprises européennes de
          publier un reporting de durabilité aussi rigoureux que leurs comptes financiers.
          Les ETI se retrouvent face à un défi simple à formuler, complexe à exécuter :
          <strong> produire un rapport ESRS auditable sans alourdir leurs équipes.</strong>
        </p>
        <p className="mb-6">
          CarbonCo répond à ce défi avec une plateforme conçue dès l&apos;origine pour la
          traçabilité OTI : chaque donnée porte sa provenance, sa méthode et un hash
          cryptographique de chaîne. Le résultat : un rapport que votre commissaire aux
          comptes peut auditer ligne par ligne.
        </p>
        <h3 className="font-bold text-lg text-neutral-900 mt-8 mb-4">Sommaire</h3>
        <ol className="space-y-2 text-sm">
          <li>03 · Le produit en un coup d&apos;œil</li>
          <li>04 · Architecture sécurité & conformité</li>
          <li>05 · Scope 1 / 2 / 3 — couverture intégrale</li>
          <li>06 · Calendrier CSRD & ESRS</li>
          <li>07 · Tarifs et offres</li>
          <li>08 · Comparatif et contact</li>
        </ol>
      </Page>

      {/* Page 3 — produit en un coup d'œil */}
      <Page index="03" title="Le produit en un coup d'œil">
        <div className="grid grid-cols-2 gap-4">
          {[
            { Comp: CollecteIllustration, t: "Collecte simplifiée",   d: "Import Excel + connecteurs API. Lignée préservée." },
            { Comp: CalculIllustration,  t: "Calcul automatique",    d: "Facteurs ADEME · IPCC · DEFRA. Méthodes tracées." },
            { Comp: AuditIllustration,   t: "Audit trail intégral",  d: "Hash SHA-256 à chaque écriture. Append-only." },
            { Comp: RapportIllustration, t: "Rapport prêt OTI",      d: "PDF signé. Provenance et méthode incluses." },
          ].map(({ Comp, t, d }) => (
            <div key={t} className="rounded-2xl border border-neutral-200 p-4">
              <Comp className="mb-2" />
              <p className="font-bold text-sm text-neutral-900">{t}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <ExcelToReportInfographic />
        </div>
      </Page>

      {/* Page 4 — sécurité */}
      <Page index="04" title="Architecture sécurité & conformité">
        <p className="mb-6">
          Vos données extra-financières sont aussi sensibles que vos données financières.
          CarbonCo applique le même niveau d&apos;exigence : chiffrement AES-256 au repos,
          TLS 1.3 en transit, audit trail immuable et hébergement entièrement européen.
        </p>
        <div className="my-6">
          <SecurityArchitecture />
        </div>
        <h3 className="font-bold text-base text-neutral-900 mt-6 mb-4">
          Conformité native et certifications
        </h3>
        <TrustBadges />
      </Page>

      {/* Page 5 — Scope 1/2/3 + illustrations */}
      <Page index="05" title="Scope 1 · 2 · 3 — couverture intégrale">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { Comp: Scope1Illustration, t: "Scope 1", d: "Émissions directes (combustion, flotte, fluides)." },
            { Comp: Scope2Illustration, t: "Scope 2", d: "Énergie achetée (électricité, chaleur, vapeur)." },
            { Comp: Scope3Illustration, t: "Scope 3", d: "Chaîne de valeur (achats, transport, usage, fin de vie)." },
          ].map(({ Comp, t, d }) => (
            <div key={t} className="rounded-2xl border border-neutral-200 p-3">
              <Comp className="mb-2" />
              <p className="font-bold text-sm text-neutral-900">{t}</p>
              <p className="text-xs text-neutral-500">{d}</p>
            </div>
          ))}
        </div>
        <ScopesInfographic />
        <p className="mt-6 text-sm">
          Le copilote IA propose en continu des hypothèses pour les postes Scope 3 les plus
          difficiles à modéliser, en citant les références ESRS source.
        </p>
      </Page>

      {/* Page 6 — calendrier CSRD */}
      <Page index="06" title="Calendrier CSRD & ESRS">
        <p className="mb-6">
          La CSRD se déploie par vagues. Comprendre votre échéance est la première étape
          pour cadrer un projet réaliste : périmètre, ressources, délai d&apos;audit.
        </p>
        <CsrdCalendarInfographic />
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-green-50 p-4 border border-green-200">
            <OtiIllustration className="mb-2" />
            <p className="text-xs text-neutral-700">
              CarbonCo aligne sa roadmap sur les guidelines EFRAG 2025-2026 et fait évoluer
              les datapoints au fil des publications.
            </p>
          </div>
          <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200">
            <p className="text-xs font-bold text-neutral-900 mb-1">À retenir</p>
            <p className="text-xs text-neutral-600 leading-relaxed">
              ESRS E1 (climat) reste prioritaire pour 2026 : c&apos;est le standard sur lequel
              les commissaires aux comptes concentreront leurs travaux d&apos;assurance.
            </p>
          </div>
        </div>
      </Page>

      {/* Page 7 — tarifs */}
      <Page index="07" title="Tarifs et offres">
        <div className="grid grid-cols-3 gap-4">
          {[
            { name: "Starter",    price: "490 €", target: "PME en reporting volontaire",      bullets: ["Scope 1 & 2", "ESRS E1", "1 utilisateur", "Export PDF"] },
            { name: "Business",   price: "1 290 €", target: "ETI fournisseur grands comptes", bullets: ["Scope 1, 2 & 3", "Copilote IA", "5 utilisateurs", "API REST"], highlight: true },
            { name: "Enterprise", price: "Sur devis", target: "Groupes multi-sites",          bullets: ["Multi-sites", "SSO + RBAC", "Support dédié", "Onboarding"] },
          ].map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-4 flex flex-col ${
                p.highlight ? "border-green-500 bg-green-50" : "border-neutral-200"
              }`}
            >
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{p.name}</p>
              <p className="mt-2 text-2xl font-extrabold text-neutral-900">{p.price}</p>
              <p className="text-[11px] text-neutral-500 mt-1">/mois</p>
              <p className="mt-3 text-xs text-neutral-600 leading-snug">{p.target}</p>
              <ul className="mt-4 space-y-1.5 text-xs text-neutral-700 flex-1">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-1.5">
                    <span className="text-green-600 mt-0.5">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-neutral-500">
          Engagement mensuel ou annuel (−20 %) · Essai gratuit 14 jours · Résiliation à tout moment.
        </p>
      </Page>

      {/* Page 8 — comparatif & contact */}
      <Page index="08" title="Comparatif et contact">
        <CompetitorComparison />
        <div className="mt-8 rounded-2xl bg-neutral-900 text-white p-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-green-400 font-bold mb-1">
              Pour aller plus loin
            </p>
            <p className="font-bold text-lg">contact@carbonco.fr</p>
            <p className="text-sm text-neutral-300">Réponse sous 24 h ouvrées · démo 30 min sur invitation.</p>
          </div>
          <a
            href="mailto:contact@carbonco.fr?subject=Demande%20de%20d%C3%A9mo%20CarbonCo"
            className="px-5 py-3 rounded-lg bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors"
          >
            Demander une démo
          </a>
        </div>
      </Page>
    </div>
  );
}
