/**
 * WiSnapshotBanner.tsx — bandeau snapshot / provenance (P04).
 *
 * Affiche l'identité du manifest actuellement rendu et son état. Tant qu'aucun
 * connecteur réel n'existe (avant P05), cet état est « Démonstration » et le
 * bandeau le dit explicitement, en toutes lettres — pas seulement par une
 * couleur.
 *
 * Server Component : aucune donnée n'est récupérée ici, le manifest est passé
 * en prop depuis la page (elle-même rendue au build). Aucun appel réseau.
 */

import { WiBadge } from "./WiPrimitives";
import { formatIsoDate } from "@/lib/water-intelligence/fixture-manifest";
import type { WaterIntelligenceManifest } from "@/lib/water-intelligence/contracts";

export function WiSnapshotBanner({ manifest }: { manifest: WaterIntelligenceManifest }) {
  const source = manifest.sources[0];

  return (
    <aside
      className="wi-card wi-accent-stress"
      aria-label="État du snapshot affiché"
      style={{ marginTop: "1.5rem" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <WiBadge tone="demo" label="Démonstration" />
        <span style={{ fontWeight: 600 }}>
          Aucune donnée réelle n&apos;est affichée sur cette page.
        </span>
      </div>

      <p className="wi-muted" style={{ marginTop: "0.625rem", fontSize: "0.9375rem" }}>
        Les valeurs visibles proviennent d&apos;un manifest de <strong>fixture</strong> servant à
        valider les contrats de données. Elles ne constituent ni une observation, ni une mesure, ni
        une base de décision. Les connecteurs vers les sources officielles ne sont pas encore
        branchés.
      </p>

      <dl
        className="wi-mono"
        style={{
          marginTop: "0.875rem",
          display: "grid",
          gap: "0.375rem 1.25rem",
          gridTemplateColumns: "auto 1fr",
          color: "var(--wi-muted)",
        }}
      >
        <dt>Manifest</dt>
        <dd style={{ margin: 0 }}>version {manifest.manifest_version}</dd>

        <dt>Étiquette</dt>
        <dd style={{ margin: 0 }}>{manifest.fixture_label ?? "aucune"}</dd>

        <dt>Source</dt>
        <dd style={{ margin: 0 }}>{source.source_code}</dd>

        <dt>Release</dt>
        <dd style={{ margin: 0 }}>{source.release_key}</dd>

        <dt>Récupéré le</dt>
        <dd style={{ margin: 0 }}>{formatIsoDate(source.retrieved_at)}</dd>

        <dt>Empreinte</dt>
        <dd style={{ margin: 0, wordBreak: "break-all" }}>
          {source.checksum_sha256.slice(0, 16)}…
        </dd>
      </dl>

      {manifest.warnings.length > 0 ? (
        <ul
          className="wi-muted"
          style={{ marginTop: "0.875rem", paddingLeft: "1.125rem", fontSize: "0.875rem" }}
        >
          {manifest.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}
