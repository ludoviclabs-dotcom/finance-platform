/**
 * ExposureLinksTable — expositions du tenant vers les ressources (Module 2,
 * PR-M2C).
 *
 * Chaque ligne pointe vers un objet d'un autre module (`linked_ref`, ex.
 * « purchase_line:842 ») — jamais une recopie de cet objet (D-4). Masse, dépense,
 * part d'approvisionnement et couverture de stock sont affichées telles quelles,
 * avec le statut de la donnée. Purement présentationnel → testable au rendu serveur.
 */

import {
  LINK_KIND_LABEL,
  ROLE_LABEL,
  formatPct,
  type ResourceExposureLink,
} from "@/lib/api/resources";
import { ResourceDataStatus } from "./resource-data-status";
import { EmptyNote } from "./section";

function fmtNum(v: number | null, suffix = ""): string {
  if (v == null || Number.isNaN(v)) return "n. d.";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)}${suffix}`;
}

export function ExposureLinksTable({
  links,
}: {
  links: ResourceExposureLink[];
}) {
  if (links.length === 0) {
    return (
      <EmptyNote testId="exposures-empty">
        Aucune exposition ressource enregistrée pour ce tenant. Les liens se créent depuis les
        modules Achats, Énergie, Eau ou Nomenclature.
      </EmptyNote>
    );
  }
  return (
    <div className="overflow-x-auto" data-testid="exposures-table">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Expositions du tenant vers les ressources stratégiques</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
            <th scope="col" className="py-2 pr-4 font-semibold">Ressource</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Rôle</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Origine</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Masse / an</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Dépense / an</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Part appro.</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Couv. stock</th>
            <th scope="col" className="py-2 pr-4 font-semibold">Qualité</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => (
            <tr
              key={l.id}
              className="border-b border-[var(--color-border)]/60"
              data-testid={`exposure-row-${l.id}`}
            >
              <td className="py-2 pr-4 font-medium text-[var(--color-foreground)]">
                {l.resource_slug ?? `#${l.resource_id}`}
              </td>
              <td className="py-2 pr-4 text-[var(--color-muted-foreground)]">{ROLE_LABEL[l.role]}</td>
              <td className="py-2 pr-4">
                <span className="text-[var(--color-muted-foreground)]">
                  {LINK_KIND_LABEL[l.link_kind]}
                </span>
                {l.linked_ref && (
                  <span className="ml-1 font-mono text-[11px] text-[var(--color-muted-foreground)]">
                    ({l.linked_ref})
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 font-mono text-[var(--color-foreground)]">
                {fmtNum(l.annual_mass_kg, " kg")}
              </td>
              <td className="py-2 pr-4 font-mono text-[var(--color-foreground)]">
                {fmtNum(l.annual_spend_eur, " €")}
              </td>
              <td className="py-2 pr-4 font-mono text-[var(--color-foreground)]">
                {formatPct(l.share_of_supply_pct)}
              </td>
              <td className="py-2 pr-4 font-mono text-[var(--color-foreground)]">
                {fmtNum(l.stock_coverage_days, " j")}
              </td>
              <td className="py-2 pr-4">
                <ResourceDataStatus status={l.data_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ExposureLinksTable;
