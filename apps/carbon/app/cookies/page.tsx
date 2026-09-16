import type { Metadata } from "next";

import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { CONSENT_VALIDITY_MONTHS } from "@/components/consent/consent-store";
import { LegalLayout, Section } from "@/components/legal/legal-layout";
import { CONTACT_EMAIL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Cookies et traceurs — CarbonCo",
  description:
    "Cookies et traceurs utilisés par CarbonCo, mesure d'audience soumise à votre accord et gestion de vos choix.",
};

/**
 * Doit rester fidèle à ce que le site dépose réellement :
 * - cookies : cc_refresh (apps/api/routers/auth.py), cc_demo_session (lib/demo/session.ts) ;
 * - stockage local : consent-store.ts, theme-toggle.tsx, MxThemeProvider.tsx,
 *   IntelligenceThemeProvider.tsx, onboarding-tour.tsx, use-audit-mode.tsx ;
 * - mesure d'audience : components/consent/consented-analytics.tsx.
 * Test de cohérence : tests/cookies-page.test.tsx.
 */

interface TrackerRow {
  name: string;
  purpose: string;
  duration: string;
}

const COOKIES: TrackerRow[] = [
  {
    name: "cc_refresh",
    purpose:
      "Maintien de la session authentifiée (renouvellement du jeton d'accès). Révoqué à la déconnexion.",
    duration: "30 jours",
  },
  {
    name: "cc_demo_session",
    purpose: "Session de l'espace de démonstration (données fictives), sans compte.",
    duration: "2 heures",
  },
];

const LOCAL_STORAGE: TrackerRow[] = [
  {
    name: "carbonco-cookie-consent",
    purpose: "Mémorise votre choix sur les cookies (acceptation ou refus) et sa date.",
    duration: `${CONSENT_VALIDITY_MONTHS} mois`,
  },
  {
    name: "carbonco-theme, carbonco-materials-theme, carbonco-wi-theme",
    purpose: "Thème clair ou sombre que vous avez choisi.",
    duration: "Jusqu'à modification ou effacement par vous",
  },
  {
    name: "carbonco-onboarding",
    purpose: "Évite de réafficher la visite guidée déjà terminée.",
    duration: "Jusqu'à effacement par vous",
  },
  {
    name: "carbon:audit-mode",
    purpose: "Affichage « mode audit » que vous avez activé dans l'application.",
    duration: "Jusqu'à modification ou effacement par vous",
  },
];

const TH = "px-3 py-2 text-left text-[var(--color-foreground)]";
const TD = "px-3 py-2 align-top";

function TrackerTable({ caption, rows }: { caption: string; rows: TrackerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-[var(--color-border)] rounded">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-[var(--color-surface)]">
            <th scope="col" className={TH}>Nom</th>
            <th scope="col" className={TH}>Finalité</th>
            <th scope="col" className={TH}>Durée</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-[var(--color-border)]">
              <td className={`${TD} font-mono break-words`}>{row.name}</td>
              <td className={TD}>{row.purpose}</td>
              <td className={`${TD} whitespace-nowrap`}>{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiesPage() {
  return (
    <LegalLayout title="Cookies et traceurs" lastUpdated="16 septembre 2026">
      <Section title="En bref">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Aucun cookie publicitaire</strong>, aucun réseau social, aucun outil de
            ciblage.
          </li>
          <li>
            Les cookies et le stockage <strong>nécessaires au service</strong> (session, sécurité,
            préférences que vous avez choisies) ne demandent pas votre accord.
          </li>
          <li>
            La <strong>mesure d&apos;audience</strong> (Vercel Web Analytics et Speed Insights)
            n&apos;est activée <strong>qu&apos;après « Tout accepter »</strong>. Tant que vous
            n&apos;avez rien choisi, rien n&apos;est chargé.
          </li>
          <li>
            Votre choix est conservé <strong>{CONSENT_VALIDITY_MONTHS} mois</strong>, puis la
            question vous est de nouveau posée. Vous pouvez le modifier à tout moment.
          </li>
        </ul>
      </Section>

      <Section title="Votre choix">
        <p>
          À votre première visite, une bannière vous propose trois boutons de même niveau :
          <strong> Tout accepter</strong>, <strong>Tout refuser</strong> et
          <strong> Essentiels uniquement</strong>. Refuser est aussi simple qu&apos;accepter, et
          retirer votre accord est aussi simple que de le donner : le bouton ci-dessous rouvre la
          bannière, qui affiche votre choix actuel et sa date de fin de validité.
        </p>
        <p>
          <CookiePreferencesButton className="mt-1 inline-flex items-center rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface)] cursor-pointer" />
        </p>
        <p>
          Un retrait prend effet immédiatement, sans rechargement : les outils de mesure sont
          retirés de la page et plus aucune donnée ne leur est transmise. Un choix (accord ou
          refus) est conservé {CONSENT_VALIDITY_MONTHS} mois ; un choix enregistré avant le
          16 septembre 2026, qui n&apos;était pas daté, vous sera redemandé une fois.
        </p>
      </Section>

      <Section title="Cookies nécessaires au service">
        <p>
          Ces cookies sont exemptés de consentement : ils sont strictement nécessaires à la
          fourniture du service que vous demandez. Ils sont <strong>HttpOnly</strong> (illisibles
          par JavaScript) et <strong>Secure</strong> en production.
        </p>
        <TrackerTable caption="Cookies nécessaires au service" rows={COOKIES} />
        <p>
          Le cookie <code>cc_refresh</code> est émis par l&apos;API CarbonCo et limité à ses
          routes d&apos;authentification ; il est en <code>SameSite=None</code> en production
          (le site et l&apos;API sont sur deux domaines distincts). Le cookie
          <code> cc_demo_session</code> est en <code>SameSite=Lax</code>.
        </p>
      </Section>

      <Section title="Stockage local du navigateur">
        <p>
          Le site enregistre aussi quelques informations dans le stockage local de votre
          navigateur (<code>localStorage</code>). Elles servent uniquement à conserver votre choix
          sur les cookies et les préférences d&apos;affichage que vous avez vous-même
          sélectionnées ; elles ne quittent pas votre navigateur.
        </p>
        <TrackerTable caption="Stockage local du navigateur" rows={LOCAL_STORAGE} />
        <p>
          <strong>Aucun jeton d&apos;authentification ni donnée personnelle</strong> n&apos;est
          conservé dans ce stockage : le jeton d&apos;accès reste en mémoire le temps de la
          session.
        </p>
      </Section>

      <Section title="Mesure d'audience (avec votre accord)">
        <p>
          Si vous choisissez « Tout accepter », et seulement dans ce cas, le site charge deux
          outils de Vercel Inc., son hébergeur :
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Vercel Web Analytics</strong> : pages vues, page d&apos;origine, pays, type
            d&apos;appareil et de navigateur. L&apos;outil ne dépose pas de cookie ; selon Vercel,
            un visiteur est reconnu par une empreinte calculée à partir de la requête, effacée
            après 24 heures, et seules des statistiques agrégées sont restituées.
          </li>
          <li>
            <strong>Vercel Speed Insights</strong> : temps de chargement et d&apos;affichage des
            pages (Core Web Vitals), sans identifiant de visiteur.
          </li>
        </ul>
        <p>
          Avant tout envoi, les jetons présents dans l&apos;adresse de la page (liens de
          questionnaire fournisseur, liens de partage d&apos;audit) sont masqués. Nous avons choisi
          de demander votre accord pour ces outils, même s&apos;ils ne déposent pas de cookie.
        </p>
      </Section>

      <Section title="Signalement d'erreurs">
        <p>
          Lorsqu&apos;il est activé, le signalement des erreurs techniques transmet uniquement le
          message d&apos;erreur, la page concernée (jetons masqués) et la version du site. Il ne
          lit ni n&apos;écrit rien sur votre terminal.
        </p>
      </Section>

      <Section title="Autres moyens d'agir">
        <p>
          Vous pouvez aussi bloquer ou supprimer les cookies et le stockage local depuis les
          réglages de votre navigateur. Supprimer le cookie de session vous déconnecte ; effacer
          le stockage local réinitialise vos préférences et fait réapparaître la bannière.
        </p>
      </Section>

      <Section title="Références">
        <ul className="list-disc pl-5 space-y-1">
          <li>Article 82 de la loi n° 78-17 du 6 janvier 1978 (« Informatique et Libertés »).</li>
          <li>
            CNIL, lignes directrices « cookies et autres traceurs », délibération n° 2020-091 du
            17 septembre 2020.
          </li>
          <li>
            CNIL, recommandation « cookies et autres traceurs », délibération n° 2020-092 du
            17 septembre 2020 (version consolidée du 16 janvier 2026) : conservation des choix
            pendant 6 mois.
          </li>
        </ul>
        <p>
          Pour toute question, écrivez à <strong>{CONTACT_EMAIL}</strong>.
        </p>
      </Section>
    </LegalLayout>
  );
}
