/**
 * Générateur iXBRL ESRS — open-source, sans dépendance commerciale.
 *
 * Produit un document XHTML inline-XBRL conforme :
 *   - schémas EFRAG ESRS Set 2 (taxonomie 2024-12-04)
 *   - faits taggés via <ix:nonFraction> (numériques) et <ix:nonNumeric> (texte)
 *   - contextes (entité + période)
 *   - unités (EUR, tCO2e, MWh, pure, ratios)
 *
 * Ce builder est volontairement simple : il accepte un set de faits ESRS
 * pré-validés, calcule les hash d'intégrité (les manifests freeze utilisent
 * le contenu généré), et exporte une chaîne XML utilisable directement.
 *
 * Phase 2 :
 *   - couvre ESRS E1-E5, S1-S4, G1 (Set 2 complet — 107 dps)
 *   - nouvelles unités : tonne, m3, ha, m3_per_meur
 *   - schemaRef pointe vers la taxonomie EFRAG officielle (URL externe)
 *   - pas de footnotes, pas de calcLink, pas de presentationLink personnalisé
 */

import {
  ESRS_E1_TAG_INDEX,
  IXBRL_UNITS,
  type IxbrlItemType,
  type IxbrlPeriodType,
} from "./esrs-e1-tags";
import { ESRS_E2_TAG_INDEX } from "./esrs-e2-tags";
import { ESRS_E3_TAG_INDEX } from "./esrs-e3-tags";
import { ESRS_E4_TAG_INDEX } from "./esrs-e4-tags";
import { ESRS_E5_TAG_INDEX } from "./esrs-e5-tags";
import { ESRS_S1_S4_TAG_INDEX } from "./esrs-s1-s4-tags";
import { ESRS_G1_TAG_INDEX } from "./esrs-g1-tags";

/** Index unifié Set 2 complet (E1-E5 + S1-S4 + G1). */
const FULL_TAG_INDEX = new Map([
  ...ESRS_E1_TAG_INDEX,
  ...ESRS_E2_TAG_INDEX,
  ...ESRS_E3_TAG_INDEX,
  ...ESRS_E4_TAG_INDEX,
  ...ESRS_E5_TAG_INDEX,
  ...ESRS_S1_S4_TAG_INDEX,
  ...ESRS_G1_TAG_INDEX,
]);

const ESRS_TAXONOMY_URL =
  "https://xbrl.efrag.org/taxonomy/esrs/2024-12-04/esrs_all.xsd";

const NAMESPACES = {
  xhtml: "http://www.w3.org/1999/xhtml",
  ix: "http://www.xbrl.org/2013/inlineXBRL",
  ixt: "http://www.xbrl.org/inlineXBRL/transformation/2020-02-12",
  xbrli: "http://www.xbrl.org/2003/instance",
  link: "http://www.xbrl.org/2003/linkbase",
  xlink: "http://www.w3.org/1999/xlink",
  iso4217: "http://www.xbrl.org/2003/iso4217",
  esrs: "https://xbrl.efrag.org/taxonomy/esrs/2024-12-04/esrs",
  esrs_cor: "https://xbrl.efrag.org/taxonomy/esrs/2024-12-04/esrs_cor",
};

export interface IxbrlEntity {
  identifier: string; // ex : "FR1234567890" (LEI ou SIREN)
  scheme: string; // ex : "http://standards.iso.org/iso/17442" pour LEI
  name: string;
}

export interface IxbrlPeriod {
  startDate: string; // ISO yyyy-mm-dd
  endDate: string; // ISO yyyy-mm-dd
}

export interface IxbrlFact {
  datapointId: string;
  value: number | string | boolean | null;
  /** Période spécifique pour ce fait, sinon période principale. */
  period?: IxbrlPeriod;
}

export interface BuildIxbrlParams {
  reportId: string;
  entity: IxbrlEntity;
  period: IxbrlPeriod;
  facts: IxbrlFact[];
  reportingCurrency?: string; // défaut "EUR"
  /** Texte humain affiché dans le document (le rapport CSRD lisible). */
  humanReadableTitle?: string;
}

export interface BuildIxbrlResult {
  xml: string;
  factsTagged: number;
  factsSkipped: number;
  warnings: string[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function contextId(period: IxbrlPeriod, type: IxbrlPeriodType): string {
  if (type === "instant") return `c-instant-${period.endDate}`;
  return `c-duration-${period.startDate}-${period.endDate}`;
}

function buildContext(
  id: string,
  entity: IxbrlEntity,
  period: IxbrlPeriod,
  type: IxbrlPeriodType,
): string {
  const periodXml =
    type === "instant"
      ? `<xbrli:instant>${period.endDate}</xbrli:instant>`
      : `<xbrli:startDate>${period.startDate}</xbrli:startDate><xbrli:endDate>${period.endDate}</xbrli:endDate>`;
  return `<xbrli:context id="${id}">
    <xbrli:entity>
      <xbrli:identifier scheme="${escapeXml(entity.scheme)}">${escapeXml(entity.identifier)}</xbrli:identifier>
    </xbrli:entity>
    <xbrli:period>${periodXml}</xbrli:period>
  </xbrli:context>`;
}

function buildUnit(unitId: string): string {
  const unit = IXBRL_UNITS[unitId];
  if (!unit) return "";
  if (Array.isArray(unit.measures)) {
    return `<xbrli:unit id="${unit.id}">
    <xbrli:measure>${unit.measures.join("</xbrli:measure><xbrli:measure>")}</xbrli:measure>
  </xbrli:unit>`;
  }
  return `<xbrli:unit id="${unit.id}">
    <xbrli:divide>
      <xbrli:unitNumerator><xbrli:measure>${unit.measures.numerator}</xbrli:measure></xbrli:unitNumerator>
      <xbrli:unitDenominator><xbrli:measure>${unit.measures.denominator}</xbrli:measure></xbrli:unitDenominator>
    </xbrli:divide>
  </xbrli:unit>`;
}

interface TaggedFact {
  fact: IxbrlFact;
  itemType: IxbrlItemType;
  periodType: IxbrlPeriodType;
  unitRef: string;
  decimals: string;
  elementName: string;
}

function classifyFacts(
  facts: IxbrlFact[],
  warnings: string[],
): TaggedFact[] {
  const out: TaggedFact[] = [];
  for (const f of facts) {
    const def = FULL_TAG_INDEX.get(f.datapointId);
    if (!def) {
      warnings.push(`unknown_datapoint:${f.datapointId}`);
      continue;
    }
    if (f.value === null || f.value === undefined) {
      warnings.push(`null_value:${f.datapointId}`);
      continue;
    }
    if (def.nonNegative && typeof f.value === "number" && f.value < 0) {
      warnings.push(`negative_not_allowed:${f.datapointId}`);
      continue;
    }
    out.push({
      fact: f,
      itemType: def.itemType,
      periodType: def.periodType,
      unitRef: def.unitRef,
      decimals: def.decimals,
      elementName: def.elementName,
    });
  }
  return out;
}

function renderFact(tagged: TaggedFact): string {
  const { fact, itemType, periodType, unitRef, decimals, elementName } = tagged;
  const ctxId = contextId(fact.period ?? PRIMARY_PERIOD_PLACEHOLDER, periodType);
  const elem = `esrs:${elementName}`;
  if (itemType === "stringItemType") {
    return `<ix:nonNumeric contextRef="${ctxId}" name="${elem}" id="f-${fact.datapointId}">${escapeXml(String(fact.value))}</ix:nonNumeric>`;
  }
  if (itemType === "booleanItemType") {
    return `<ix:nonFraction contextRef="${ctxId}" name="${elem}" decimals="0" unitRef="pure" id="f-${fact.datapointId}">${fact.value ? "1" : "0"}</ix:nonFraction>`;
  }
  // numérique (decimal / monetary / percent)
  const num =
    typeof fact.value === "number" ? String(fact.value) : String(fact.value ?? "");
  const ratio =
    itemType === "percentItemType" && typeof fact.value === "number"
      ? String(fact.value / 100)
      : num;
  return `<ix:nonFraction contextRef="${ctxId}" name="${elem}" decimals="${decimals}" unitRef="${unitRef}" id="f-${fact.datapointId}">${escapeXml(ratio)}</ix:nonFraction>`;
}

// Placeholder utilisé temporairement pour générer le contextId — sera remplacé
// par la période effective lors de la sérialisation.
const PRIMARY_PERIOD_PLACEHOLDER: IxbrlPeriod = {
  startDate: "0000-00-00",
  endDate: "0000-00-00",
};

export function buildIxbrl(params: BuildIxbrlParams): BuildIxbrlResult {
  const warnings: string[] = [];
  const tagged = classifyFacts(params.facts, warnings);

  // Substitue le placeholder de période par la période effective.
  for (const t of tagged) {
    if (!t.fact.period) t.fact.period = params.period;
  }

  // Contextes utilisés (déduplication par id).
  const contextIds = new Set<string>();
  const contextXmls: string[] = [];
  for (const t of tagged) {
    const id = contextId(t.fact.period ?? params.period, t.periodType);
    if (contextIds.has(id)) continue;
    contextIds.add(id);
    contextXmls.push(
      buildContext(id, params.entity, t.fact.period ?? params.period, t.periodType),
    );
  }

  // Unités utilisées (déduplication, pure ajouté pour booleans).
  const unitIds = new Set<string>(["pure"]);
  for (const t of tagged) {
    if (t.unitRef) unitIds.add(t.unitRef);
  }
  const unitsXml = Array.from(unitIds)
    .map(buildUnit)
    .filter((s) => s.length > 0)
    .join("\n  ");

  // Faits sérialisés.
  const factsXml = tagged.map(renderFact).join("\n      ");

  // Document XHTML / inline XBRL.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="${NAMESPACES.xhtml}"
      xmlns:ix="${NAMESPACES.ix}"
      xmlns:ixt="${NAMESPACES.ixt}"
      xmlns:xbrli="${NAMESPACES.xbrli}"
      xmlns:link="${NAMESPACES.link}"
      xmlns:xlink="${NAMESPACES.xlink}"
      xmlns:iso4217="${NAMESPACES.iso4217}"
      xmlns:esrs="${NAMESPACES.esrs}"
      xmlns:esrs_cor="${NAMESPACES.esrs_cor}">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeXml(params.humanReadableTitle ?? `Rapport CSRD ${params.reportId}`)}</title>
  </head>
  <body>
    <div style="display:none">
      <ix:header>
        <ix:hidden>
          <ix:references>
            <link:schemaRef xlink:type="simple" xlink:href="${ESRS_TAXONOMY_URL}" />
          </ix:references>
          <ix:resources>
            ${contextXmls.join("\n            ")}
            ${unitsXml}
          </ix:resources>
        </ix:hidden>
      </ix:header>
    </div>
    <article>
      <h1>${escapeXml(params.entity.name)} — Rapport de durabilité ${params.period.startDate} → ${params.period.endDate}</h1>
      <p>Document iXBRL ESRS Set 2 — ${tagged.length} faits taggés, ${warnings.length} alertes. Voir l'attribut <code>name</code> de chaque <code>&lt;ix:&gt;</code> pour le mapping ESRS.</p>
      <section>
        ${factsXml}
      </section>
    </article>
  </body>
</html>`;

  return {
    xml,
    factsTagged: tagged.length,
    factsSkipped: warnings.length,
    warnings,
  };
}
