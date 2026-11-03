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

import { getChinaShare, getMaterials } from "@/lib/crm/dataLoader";
import { dueSignalKeys, getKeyFigure, getRoboticsDataset, layersInReadingOrder, type RoboticsDataset } from "@/lib/robotics/dataLoader";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav from "@/components/materials/MxNav";
import ActorMapSection from "@/components/robotics/ActorMapSection";
import ChokepointTimeline from "@/components/robotics/ChokepointTimeline";
import ControlSection from "@/components/robotics/ControlSection";
import CostAnatomy, { ROBOT_PLACEMENT } from "@/components/robotics/CostAnatomy";
import MarketSection from "@/components/robotics/MarketSection";
import MethodPanel from "@/components/robotics/MethodPanel";
import ValueChainFlow from "@/components/robotics/ValueChainFlow";
import { formatBnUsd, formatIsoDate, institutionShort, layerShort } from "@/components/robotics/labels";

const PAGE_SOURCE = readFileSync(resolve(__dirname, "../app/robotics/page.tsx"), "utf-8");
const at = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
// Échappement de renderToStaticMarkup pour le texte attendu (&, ').
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

// Les sections reçoivent ce que la page leur passe ; ces fabriques le
// reproduisent pour rendre chaque vue isolément.
type ControlView = "pile" | "matrice" | "chine";
const control = (ds: RoboticsDataset, initialView: ControlView = "pile") => (
  <ControlSection
    initialView={initialView}
    layers={layersInReadingOrder(ds)}
    actors={ds.actors}
    keyFigures={ds.key_figures}
    materialNames={{}}
    china={{
      extraction: getKeyFigure(ds, "chine-extraction-terres-rares"),
      raffinage: getKeyFigure(ds, "chine-raffinage-terres-rares"),
      aimants: getKeyFigure(ds, "chine-aimants-frittes"),
      livraisons: getKeyFigure(ds, "part-chine-livraisons-2025"),
      extractionAimants: getKeyFigure(ds, "chine-extraction-terres-rares-aimants"),
    }}
  />
);

const cost = (ds: RoboticsDataset, initialView: "robot" | "treemap" | "trajectoire" = "robot") => (
  <CostAnatomy
    initialView={initialView}
    bom={ds.bom}
    layers={ds.layers}
    chokepoints={ds.chokepoints}
    figures={{
      actuatorsHands: getKeyFigure(ds, "bofa-actionneurs-mains-2030"),
      bom2025: getKeyFigure(ds, "bofa-bom-chine-2025"),
      bom2030: getKeyFigure(ds, "bofa-bom-chine-2030"),
      offChina: getKeyFigure(ds, "ms-bom-hors-chine"),
      avgPrice: getKeyFigure(ds, "yole-prix-moyen"),
      digitCost: getKeyFigure(ds, "agility-cout-production"),
      digitHourly: getKeyFigure(ds, "digit-cout-horaire"),
      wageUs: getKeyFigure(ds, "salaire-production-usa"),
      wageEu: getKeyFigure(ds, "salaire-moyen-ue"),
      roi: getKeyFigure(ds, "agility-retour-investissement"),
    }}
  />
);

const flow = async (ds: RoboticsDataset, initialView: "flux" | "parcours" = "flux") => {
  const { materials } = await getMaterials();
  const linked = new Set(ds.layers.flatMap(l => l.material_links.map(m => m.material_id)));
  return (
    <ValueChainFlow
      initialView={initialView}
      layers={layersInReadingOrder(ds)}
      actors={ds.actors}
      keyFigures={ds.key_figures}
      materials={materials
        .filter(m => linked.has(m.id))
        .map(m => ({ id: m.id, name: m.name_fr, chinaShare: m.top_producers.some(p => p.country === "Chine") ? getChinaShare(m) : null }))}
      trackedMaterials={materials.length}
    />
  );
};

const timeline = (ds: RoboticsDataset, today: string) => (
  <ChokepointTimeline chokepoints={ds.chokepoints} layers={layersInReadingOrder(ds)} actors={ds.actors} today={today} dueKeys={[...dueSignalKeys(ds, at(today))]} />
);

const market = (ds: RoboticsDataset, initialView: "projections" | "volumes" | "constructeurs" = "projections") => (
  <MarketSection
    initialView={initialView}
    projections={ds.projections}
    oems={ds.oems}
    actors={ds.actors}
    steps={[
      { figure: getKeyFigure(ds, "livraisons-mondiales-2025"), kind: "livraisons", caption: "livrés" },
      { figure: getKeyFigure(ds, "bofa-livraisons-2030"), kind: "livraisons", caption: "par an · BofA" },
      { figure: getKeyFigure(ds, "ms-parc-2050"), kind: "parc", caption: "en service · MS" },
    ]}
    deliveries={getKeyFigure(ds, "livraisons-mondiales-2025")}
    chinaShare={getKeyFigure(ds, "part-chine-livraisons-2025")}
    fleet={{ total: getKeyFigure(ds, "ms-parc-2050"), china: getKeyFigure(ds, "ms-parc-chine-2050"), usa: getKeyFigure(ds, "ms-parc-usa-2050") }}
    proUse={getKeyFigure(ds, "ms-usage-professionnel-2050")}
  />
);

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
  it("la pile nomme les douze couches, chacune avec son titre complet", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(control(ds));
    for (const l of ds.layers) {
      expect(html).toContain(`title="${esc(l.name)}"`);
      expect(html).toContain(esc(layerShort(l)));
    }
  });

  it("la matrice nomme l'Australie plutôt que le bloc générique « Autres »", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(control(ds, "matrice"));
    for (const l of ds.layers) expect(html).toContain(esc(l.name));
    expect(html).toContain("Australie : conteste");
    expect(html).not.toContain(">Autres<");
  });

  it("l'emprise chinoise affiche les parts mesurées, de la mine au robot", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(control(ds, "chine"));
    for (const id of ["chine-extraction-terres-rares", "chine-raffinage-terres-rares", "chine-aimants-frittes", "part-chine-livraisons-2025"]) {
      expect(html).toContain(getKeyFigure(ds, id).value_label);
    }
    // La note sous les jauges reprend la part des seules terres rares pour aimants.
    expect(html).toContain(getKeyFigure(ds, "chine-extraction-terres-rares-aimants").value_label);
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
  it("chaque poste de coût a sa place sur la silhouette", async () => {
    const ds = await getRoboticsDataset();
    for (const b of ds.bom) expect(ROBOT_PLACEMENT[b.id], b.id).toBeDefined();
    const html = renderToStaticMarkup(cost(ds));
    for (const b of ds.bom) {
      expect(html).toContain(esc(b.label));
      expect(html).toContain(`${b.max_pct} %`);
    }
  });

  it("le treemap dessine une tuile par poste de coût", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(cost(ds, "treemap"));
    for (const b of ds.bom) expect(html).toContain(`title="${esc(b.label)} — ${b.max_pct} %"`);
  });

  it("la trajectoire signale le salaire horaire comme un calcul", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(cost(ds, "trajectoire"));
    expect(html).toContain(getKeyFigure(ds, "bofa-bom-chine-2030").value_label.replace("<", "&lt;"));
    expect(html).toContain("≈ 22,6 $");
    expect(html).toContain(">Calcul<");
  });
});

describe("05 · de la mine au robot", () => {
  it("chaque couche figure dans le flux et ne renvoie qu'à de vraies fiches /materials", async () => {
    const ds = await getRoboticsDataset();
    const { materials } = await getMaterials();
    const html = renderToStaticMarkup(await flow(ds));
    for (const l of ds.layers) expect(html).toContain(`title="${esc(l.name)}"`);
    const hrefs = [...html.matchAll(/href="\/materials\/([^"]+)"/g)].map(m => m[1]);
    expect(new Set(hrefs).size).toBeGreaterThanOrEqual(10);
    const known = new Set(materials.map(m => m.id));
    for (const id of hrefs) expect(known.has(id), id).toBe(true);
  });

  it("le parcours nomme l'Australie plutôt que le bloc générique « Autres »", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(await flow(ds, "parcours"));
    expect(html).toContain("Australie : conteste");
    expect(html).toContain(">AU<");
  });
});

describe("06 · goulots d'étranglement", () => {
  it("à la date du snapshot, les échéances sont annoncées sans alerte", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(timeline(ds, ds.snapshot_date));
    expect(html).toContain("Échéance 10.11.2026 · dans 8 j");
    expect(html).toContain("Échéance J-8");
    expect(html).not.toContain("À revérifier");
  });

  it("une fois l'échéance atteinte, le signal est marqué « à revérifier »", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(timeline(ds, "2026-11-10"));
    expect(html).toContain("À revérifier depuis le 10.11.2026");
    expect(html).toContain("10.01.2027");
  });

  it("un goulot sans signal le dit au lieu de laisser une frise vide", async () => {
    const ds = await getRoboticsDataset();
    expect(ds.chokepoints.some(c => c.signals.length === 0)).toBe(true);
    const html = renderToStaticMarkup(timeline(ds, ds.snapshot_date));
    expect(html).toContain("Aucun signal daté et sourcé retenu à ce jour.");
  });
});

describe("07 · marché & volumes", () => {
  it("place chaque projection, étiquetée par son institution", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(market(ds));
    for (const p of ds.projections) {
      expect(html).toContain(`${esc(p.institution)}, ${p.horizon}`);
      if (p.max_bn_usd === p.min_bn_usd) expect(html).toContain(institutionShort(p.institution));
    }
  });

  it("affiche chaque constructeur et signale un volume non publié", async () => {
    const ds = await getRoboticsDataset();
    const html = renderToStaticMarkup(market(ds, "constructeurs"));
    const names = new Map(ds.actors.map(a => [a.id, a.name]));
    for (const o of ds.oems) expect(html).toContain(names.get(o.actor_id)!);
    expect(html).toContain("Volume non publié");
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
    const html = [
      renderToStaticMarkup(await flow(ds)),
      renderToStaticMarkup(market(ds)),
      renderToStaticMarkup(market(ds, "constructeurs")),
      renderToStaticMarkup(<MethodPanel ds={ds} />),
    ].join("");
    expect(html.match(/\$[A-Z]{2,5}\b/g)).toBeNull();
  });
});
