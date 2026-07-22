"use client";

/**
 * Cockpit Ressources — expositions du tenant (Module 2, PR-M2C, BETA).
 *
 * Liste `company_resource_exposure_links` : chaque exposition pointe vers un
 * objet d'un autre module (`linked_ref`) sans le recopier ni recalculer de
 * carbone (D-4). Lecture seule côté conformité ; la création d'un lien se fait
 * depuis les modules Achats / Énergie / Eau / Nomenclature.
 */

import { useCallback, useEffect, useState } from "react";
import { FeatureStatusBadge } from "@/components/ui/feature-status-badge";
import { ResourceNav } from "@/components/resources/resource-nav";
import { ExposureLinksTable } from "@/components/resources/exposure-links-table";
import {
  LINK_KIND_LABEL,
  ROLE_LABEL,
  SchemaNotReadyError,
  fetchResourceExposures,
  type LinkKind,
  type ResourceExposureLink,
  type ResourceRole,
} from "@/lib/api/resources";

type PageState = "loading" | "schema_not_ready" | "error" | "ready";

const ROLE_OPTIONS: (ResourceRole | "all")[] = [
  "all", "material", "feedstock", "energy_carrier", "process_input",
  "industrial_gas", "nuclear_fuel", "biomass", "water",
];
const LINK_KIND_OPTIONS: (LinkKind | "all")[] = [
  "all", "bom_item", "purchase_line", "energy_activity",
  "water_activity", "supplier_declaration", "manual",
];

export default function ResourceExposuresPage() {
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<ResourceExposureLink[]>([]);
  const [role, setRole] = useState<ResourceRole | "all">("all");
  const [linkKind, setLinkKind] = useState<LinkKind | "all">("all");

  const load = useCallback(
    async (r: ResourceRole | "all", lk: LinkKind | "all", signal?: AbortSignal) => {
      setState("loading");
      setError(null);
      try {
        const res = await fetchResourceExposures(
          { ...(r === "all" ? {} : { role: r }), ...(lk === "all" ? {} : { link_kind: lk }) },
          signal,
        );
        setLinks(res.items);
        setState("ready");
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (e instanceof SchemaNotReadyError) {
          setState("schema_not_ready");
          return;
        }
        setError((e as Error).message);
        setState("error");
      }
    },
    [],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(role, linkKind, ctrl.signal);
    return () => ctrl.abort();
  }, [load, role, linkKind]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Expositions ressources</h1>
          <FeatureStatusBadge status="beta" />
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Ponts entre votre chaîne de valeur (achats, énergie, eau, nomenclature) et les ressources
          stratégiques. Lecture seule — aucune donnée d&apos;un autre module n&apos;est recopiée.
        </p>
      </header>

      <ResourceNav active="exposures" />

      {state === "loading" && (
        <p data-testid="exposures-loading" className="text-sm text-[var(--color-muted-foreground)]">
          Chargement des expositions…
        </p>
      )}

      {state === "schema_not_ready" && (
        <div
          data-testid="exposures-schema-not-ready"
          className="rounded border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400"
        >
          <p className="font-semibold">Initialisation du schéma en cours</p>
          <p>Les migrations du module Ressources (042/043) ne sont pas encore appliquées.</p>
        </div>
      )}

      {state === "error" && (
        <div
          data-testid="exposures-error"
          className="rounded border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400"
        >
          <p className="font-semibold">Expositions indisponibles</p>
          <p>{error}</p>
        </div>
      )}

      {state === "ready" && (
        <div data-testid="exposures-content">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
              Rôle
              <select
                data-testid="exposures-role-filter"
                value={role}
                onChange={(e) => setRole(e.target.value as ResourceRole | "all")}
                className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === "all" ? "Tous" : ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-muted-foreground)]">
              Origine
              <select
                data-testid="exposures-kind-filter"
                value={linkKind}
                onChange={(e) => setLinkKind(e.target.value as LinkKind | "all")}
                className="rounded border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-foreground)]"
              >
                {LINK_KIND_OPTIONS.map((lk) => (
                  <option key={lk} value={lk}>
                    {lk === "all" ? "Toutes" : LINK_KIND_LABEL[lk]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ExposureLinksTable links={links} />
        </div>
      )}
    </div>
  );
}
