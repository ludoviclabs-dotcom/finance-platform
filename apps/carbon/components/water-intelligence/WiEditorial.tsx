/**
 * WiEditorial.tsx — rendu des contenus sourcés (P12, Wave C : C12, C13, C14).
 *
 * Server Components : ce sont des textes, aucun état, aucun chargement
 * paresseux.
 *
 * `reviewed_on` et `reviewed_by` sont TOUJOURS rendus, pour tous les types :
 * un record sans revue humaine n'est pas publiable, et la surface le rend
 * visible plutôt que de le supposer.
 */

import type { WaterEditorialRecord } from "@/lib/water-intelligence/contracts";
import { EDITORIAL_ROADMAP, type WiEditorialType } from "@/lib/water-intelligence/editorial";

import { WiBadge } from "./WiPrimitives";

/* ------------------------------------------------------ Bloc générique */

function WiReviewFooter({ record }: { record: WaterEditorialRecord }) {
  return (
    <p className="wi-mono wi-muted" style={{ marginTop: "0.75rem", fontSize: "0.75rem" }}>
      Revu le {record.reviewed_on} par {record.reviewed_by} · source{" "}
      {record.source.source_code}
    </p>
  );
}

/* -------------------------------------------------- Secteurs / acteurs */

/**
 * Un secteur ou un acteur. Rendu en LISTE NON ORDONNÉE : aucun classement
 * n'est produit sans méthodologie objective publiée — un ordre visuel se lit
 * comme un rang.
 */
export function WiSectorCard({ record }: { record: WaterEditorialRecord }) {
  return (
    <article className="wi-card">
      <h3 className="wi-h3">{record.title}</h3>
      {record.jurisdiction ? (
        <p className="wi-muted" style={{ marginTop: "0.25rem", fontSize: "0.8125rem" }}>
          {record.jurisdiction}
        </p>
      ) : null}
      <p style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>{record.summary}</p>
      <WiReviewFooter record={record} />
    </article>
  );
}

/* ------------------------------------------------------------ Événement */

/**
 * Un événement. La date de l'ÉVÉNEMENT (`valid_from`) est rendue distinctement
 * de la date de publication de la source : les confondre ferait glisser un
 * commentaire vers le fait qu'il commente.
 *
 * Aucune causalité n'est ajoutée : le composant rend ce que le record dit,
 * jamais une explication climatique déduite.
 */
export function WiEventItem({ record }: { record: WaterEditorialRecord }) {
  return (
    <article className="wi-card wi-accent-stress">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "baseline" }}>
        <span className="wi-mono" style={{ fontSize: "0.8125rem", color: "var(--wi-stress)" }}>
          {record.valid_from ?? "date non communiquée"}
        </span>
        {record.jurisdiction ? (
          <span className="wi-muted" style={{ fontSize: "0.8125rem" }}>
            {record.jurisdiction}
          </span>
        ) : null}
      </div>
      <h3 className="wi-h3" style={{ marginTop: "0.375rem" }}>
        {record.title}
      </h3>
      <p style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>{record.summary}</p>
      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}>
        Date de l’événement, distincte de la date de publication de la source
        {record.source.published_at ? ` (${record.source.published_at})` : ""}.
      </p>
      <WiReviewFooter record={record} />
    </article>
  );
}

/* ---------------------------------------------------------- Innovation */

/**
 * Une innovation. Le bénéfice hydrique n'est rendu que s'il est sourcé, et les
 * arbitrages (énergie, carbone, coût) sont rendus au même niveau que le
 * bénéfice — jamais un gain net sans contrepartie.
 */
export function WiInnovationCard({ record }: { record: WaterEditorialRecord }) {
  return (
    <article className="wi-card wi-accent-adapt">
      <h3 className="wi-h3">{record.title}</h3>
      <p style={{ marginTop: "0.5rem", fontSize: "0.9375rem" }}>{record.summary}</p>
      <WiReviewFooter record={record} />
    </article>
  );
}

/* ------------------------------------------------- Section sans contenu */

/**
 * État d'une section éditoriale sans contenu publié.
 *
 * Annonce ce qui viendra, sans l'inventer : aucun titre d'exemple, aucune date,
 * aucun acteur nommé.
 */
export function WiEditorialEmpty({ type }: { type: WiEditorialType }) {
  const entry = EDITORIAL_ROADMAP.find((item) => item.type === type);
  return (
    <div className="wi-absent-fill" style={{ padding: "1.25rem" }}>
      <WiBadge tone="absent" label="Aucun contenu publié" />
      <p className="wi-muted" style={{ marginTop: "0.75rem" }}>
        {entry?.describes ?? "Contenu à publier."}
      </p>
      <p className="wi-muted" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
        Un contenu n’est publiable qu’avec une source, une date de revue et un réviseur
        identifié. Aucun n’a encore été rédigé et revu pour cette section : rien n’est
        affiché plutôt qu’un texte plausible non vérifié.
      </p>
    </div>
  );
}

/**
 * Liste d'une section éditoriale. Non ordonnée par défaut, y compris pour les
 * acteurs.
 */
export function WiEditorialList({
  type,
  records,
}: {
  type: WiEditorialType;
  records: readonly WaterEditorialRecord[];
}) {
  if (records.length === 0) return <WiEditorialEmpty type={type} />;

  const Card =
    type === "event" ? WiEventItem : type === "innovation" ? WiInnovationCard : WiSectorCard;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "1rem" }}>
      {records.map((record) => (
        <li key={record.record_id}>
          <Card record={record} />
        </li>
      ))}
    </ul>
  );
}
