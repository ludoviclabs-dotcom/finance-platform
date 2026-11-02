/**
 * Page /robotics — rendu des sections (phase 2 du module « Robotique & IA
 * physique »).
 *
 * Rendu statique (renderToStaticMarkup), comme le reste du projet : les
 * sections serveur sont rendues telles quelles, les sections client sous
 * MxThemeProvider. On vérifie ce que la page promet : chaque couche est
 * présente et renvoie à de vraies fiches /materials, les signaux arrivés à
 * échéance sont marqués, aucun contenu d'investissement n'apparaît.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMaterials } from "@/lib/crm/dataLoader";
import { dueSignalKeys, getKeyFigure, getRoboticsDataset, layersInReadingOrder } from "@/lib/robotics/dataLoader";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav from "@/components/materials/MxNav";
import ActorMapSection from "@/components/robotics/ActorMapSection";
import BomTreemap from "@/components/robotics/BomTreemap";
import ChokepointsList from "@/components/robotics/ChokepointsList";
import LayerControlMatrix from "@/components/robotics/LayerControlMatrix";
import MarketOverview from "@/components/robotics/MarketOverview";
import MethodPanel from "@/components/robotics/MethodPanel";
import ValueChainLayers from "@/components/robotics/ValueChainLayers";
import { formatBnUsd, formatIsoDate } from "@/components/robotics/labels";

const PAGE_SOURCE = readFileSync(resolve(__dirname, "../app/robotics/page.tsx"), "utf-8");
const at = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
// Échappement de renderToStaticMarkup pour le texte attendu (&, ').
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

describe("formats d'affichage", () => {
  it("formatIsoDate découpe la chaîne sans passer par Date()", () => {
    expect(formatIsoDate("2026-11-02")).toBe("02.11.2026");
    expect(formatIsoDate("2026-02")).toBe("02.2026");
    expect(formatIsoDate("2025")).toBe("2025");
    expect(formatIsoDate("T2 2026")).toBe("T2 2026");
  });

  it("formatBnUsd écrit les milliards à la française", () => {
    expect(formatBnUsd(6.5)).toBe("6,5 Md$");
    expect(formatBnUsd(7500).replace(/\s/g, " ")).toBe("7 500 Md$");
  });
});

describe("page — chiffres clés", () => {
  it("chaque chiffre clé appelé par la page existe dans le snapshot", async () => {
    const ds = await getRoboticsDataset();
    const ids = [...PAGE_SOURCE.matchAll(/fig\("([^"]+)"\)/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) expect(() => getKeyFigure(ds, id), id).not.toThrow();
  });

  it("un chiffre clé inconnu fait échouer le rendu plutôt qu'afficher une case vide", async () => {
    const ds = await getRoboticsDataset();
    expect(() => getKeyFigure(ds, "inconnu")).toThrow(/inconnu/);
  });
});

describe("02 · contrôle de la chaîne", () => {
  it("liste les douze couches et les parts chinoises mesurées", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(
      <LayerControlMatrix
        layers={layersInReadingOrder(ds)}
        chinaFigures={["chine-extraction-terres-rares", "chine-aimants-frittes"].map(id => getKeyFigure(ds, id))}
      />,
    );
    for (const l of ds.layers) expect(html).toContain(esc(l.name));
    expect(html).toContain("69 %");
    expect(html).toContain("94 %");
    // La colonne « Autres » n'existe que parce qu'une couche y renvoie.
    expect(html).toContain(">Autres<");
  });
});

describe("03 · cartographie des acteurs", () => {
  it("classe les États-Unis en tête, avec le nombre d'acteurs du snapshot", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(
      <MxThemeProvider skin="industry">
        <ActorMapSection actors={ds.actors} layers={ds.layers} />
      </MxThemeProvider>,
    );
    const us = ds.actors.filter(a => a.countries.includes("US")).length;
    expect(html).toMatch(/>01<\/td><td><button[^>]*>États-Unis<\/button>/);
    expect(html).toContain(`>${us}</td>`);
  });
});

describe("04 · anatomie du coût", () => {
  it("dessine une tuile par poste de coût", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(<BomTreemap items={ds.bom} layers={ds.layers} />);
    for (const b of ds.bom) expect(html).toContain(`title="${b.label} — ${b.max_pct} %"`);
  });
});

describe("05 · de la mine au robot", () => {
  it("chaque couche a son ancre et ne renvoie qu'à de vraies fiches /materials", async () => {
    const ds = await getRoboticsDataset();
    const { materials } = await getMaterials();
    const html = renderToStaticMarkup(<ValueChainLayers ds={ds} materials={materials} />);
    for (const l of ds.layers) expect(html).toContain(`id="couche-${l.id}"`);
    const hrefs = [...html.matchAll(/href="\/materials\/([^"]+)"/g)].map(m => m[1]);
    expect(new Set(hrefs).size).toBeGreaterThanOrEqual(10);
    const known = new Set(materials.map(m => m.id));
    for (const id of hrefs) expect(known.has(id), id).toBe(true);
  });

  it("nomme l'Australie plutôt que le bloc générique « Autres »", async () => {
    const ds = await getRoboticsDataset();
    const { materials } = await getMaterials();
    const html = renderToStaticMarkup(<ValueChainLayers ds={ds} materials={materials} />);
    expect(html).toContain("contesté par États-Unis, Australie");
  });
});

describe("06 · goulots d'étranglement", () => {
  it("à la date du snapshot, les échéances sont annoncées sans alerte", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(<ChokepointsList ds={ds} dueKeys={dueSignalKeys(ds, at(ds.snapshot_date))} />);
    expect(html).toContain("Échéance : 10.11.2026");
    expect(html).not.toContain("À revérifier");
  });

  it("une fois l'échéance atteinte, le signal est marqué « à revérifier »", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(<ChokepointsList ds={ds} dueKeys={dueSignalKeys(ds, at("2026-11-10"))} />);
    expect(html).toContain("À revérifier depuis le 10.11.2026");
    expect(html).toContain("Échéance : 10.01.2027");
  });
});

describe("07 · marché & volumes", () => {
  it("affiche chaque constructeur et signale un volume non publié", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(<MarketOverview ds={ds} />);
    const names = new Map(ds.actors.map(a => [a.id, a.name]));
    for (const o of ds.oems) expect(html).toContain(names.get(o.actor_id)!);
    expect(html).toContain("Non publié");
  });
});

describe("08 · méthode", () => {
  it("liste les corrections et relie chaque source à son URL", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(<MethodPanel ds={ds} />);
    for (const c of ds.corrections) expect(html).toContain(esc(c.claim));
    expect(html).toContain("Retiré : aucune source trouvée");
    for (const s of ds.sources) expect(html).toContain(`href="${esc(s.url)}"`);
  });
});

describe("MxNav partagée avec /materials", () => {
  it("garde les sections de /materials par défaut", () => {
    const html = renderToStaticMarkup(
      <MxThemeProvider skin="industry">
        <MxNav snapshotDateLabel="30.06.2026" />
      </MxThemeProvider>,
    );
    expect(html).toContain("Matières critiques");
    expect(html).toContain('href="#chine"');
  });

  it("rend les sections et le libellé passés par /robotics", () => {
    const html = renderToStaticMarkup(
      <MxThemeProvider skin="industry">
        <MxNav snapshotDateLabel="02.11.2026" sections={[{ id: "goulots", label: "Goulots" }]} moduleLabel="Robotique & IA physique" />
      </MxThemeProvider>,
    );
    expect(html).toContain("Robotique &amp; IA physique");
    expect(html).toContain('href="#goulots"');
    expect(html).not.toContain('href="#chine"');
  });
});

describe("hors périmètre — aucun contenu d'investissement rendu", () => {
  it("aucun symbole boursier dans les sections rendues", async () => {
    const ds = await getRoboticsDataset();
    const { materials } = await getMaterials();
    const html = [
      renderToStaticMarkup(<ValueChainLayers ds={ds} materials={materials} />),
      renderToStaticMarkup(<MarketOverview ds={ds} />),
      renderToStaticMarkup(<MethodPanel ds={ds} />),
    ].join("");
    expect(html.match(/\$[A-Z]{2,5}\b/g)).toBeNull();
  });
});
