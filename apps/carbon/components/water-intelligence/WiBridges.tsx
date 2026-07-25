/**
 * components/water-intelligence/WiBridges.tsx — surface publique des ponts
 * CarbonCo (P14, Wave D).
 *
 * Remplace les deux cartes de synergies écrites à la main dans la page. Les
 * cibles ne sont plus des chaînes littérales du JSX : elles viennent du
 * registre backend, qui refuse à la construction toute cible portant un
 * paramètre ou un nom de champ tenant.
 *
 * Aucune donnée d'entreprise ne transite ici — par construction, le document
 * publié ne contient que des ponts publics, et le schéma Zod impose
 * `carries_tenant_context: false`.
 *
 * Server Component : aucune interactivité, aucun état, aucun appel réseau.
 */

import Link from "next/link";

import {
  MODULE_BRIDGES,
  bridgeAccent,
  type WiModuleBridge,
  type WiModuleBridgeDocument,
} from "@/lib/water-intelligence/module-bridges";
import { WiBadge } from "./WiPrimitives";

function WiBridgeCard({ bridge }: { bridge: WiModuleBridge }) {
  return (
    <li className={`wi-card wi-accent-${bridgeAccent(bridge.bridge_id)}`} style={{ listStyle: "none" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        {/* Le niveau suit la structure (enfant direct du h2 de section), la
            classe règle la taille — même correctif qu'en Wave C sur le Pulse. */}
        <h3 className="wi-h4">{bridge.label}</h3>
        <WiBadge
          tone={bridge.requires_authentication ? "pending" : "demo"}
          label={bridge.requires_authentication ? "Accès authentifié" : "Surface publique"}
        />
      </div>

      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
        Signal hydrique&nbsp;: {bridge.water_signal}
      </p>

      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>{bridge.reads}</p>

      <p style={{ marginTop: "0.75rem" }}>
        <Link href={bridge.target_path} className="wi-link">
          Ouvrir {bridge.label}
        </Link>
      </p>
    </li>
  );
}

/**
 * Ponts publics vers les modules CarbonCo.
 *
 * Le sens de lecture est unidirectionnel : la page publique renvoie vers le
 * cockpit, jamais l'inverse, et aucun paramètre n'accompagne le renvoi.
 */
export function WiModuleBridges({
  document = MODULE_BRIDGES,
}: {
  document?: WiModuleBridgeDocument;
}) {
  return (
    <div>
      <ul
        className="wi-grid wi-grid-2"
        style={{ marginTop: "0.5rem", paddingLeft: 0, listStyle: "none" }}
      >
        {document.bridges.map((bridge) => (
          <WiBridgeCard key={bridge.bridge_id} bridge={bridge} />
        ))}
      </ul>

      <p className="wi-muted" style={{ marginTop: "1.25rem", maxWidth: "62ch" }}>
        Ces liens sont des <strong>chemins nus</strong>&nbsp;: ils ne transportent aucun
        identifiant de site, d&apos;entreprise ou d&apos;utilisateur. Le travail sur vos
        propres données commence de l&apos;autre côté de l&apos;authentification, et
        aucune information d&apos;entreprise ne remonte jamais sur cette page.
      </p>
    </div>
  );
}
