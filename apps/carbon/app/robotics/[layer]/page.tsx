import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getChinaShare, getMaterials } from "@/lib/crm/dataLoader";
import { countryLabelFr } from "@/lib/iso3166";
import {
  getActorsForLayer,
  getBomForLayer,
  getChokepointsForLayer,
  getKeyFigure,
  getLayerById,
  getRoboticsDataset,
  layersInReadingOrder,
  resolveLayerMaterials,
} from "@/lib/robotics/dataLoader";
import { MxThemeProvider } from "@/components/materials/MxThemeProvider";
import MxNav, { type MxNavSection } from "@/components/materials/MxNav";
import { Frame } from "@/components/materials/industry/Frame";
import { Section } from "@/components/materials/industry/Section";
import { SectionKicker } from "@/components/materials/industry/SectionKicker";
import { industryFontVars } from "@/components/materials/industry/fonts";
import { KeyFigure } from "@/components/robotics/KeyFigure";
import SourceList from "@/components/robotics/SourceList";
import { SEGMENT_DESC, SEGMENT_LABEL, blocDisplayName, formatIsoDate } from "@/components/robotics/labels";

interface PageProps { params: Promise<{ layer: string }> }

export async function generateStaticParams() {
  const ds = await getRoboticsDataset();
  return ds.layers.map(l => ({ layer: l.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { layer: id } = await params;
  const layer = getLayerById(await getRoboticsDataset(), id);
  if (!layer) return { title: "Couche introuvable | Carbon&Co Intelligence" };
  return {
    title: `${layer.name} — Robotique & IA physique | Carbon&Co Intelligence`,
    description: `${layer.name}, couche ${layer.order} de la chaîne de valeur des robots humanoïdes : ${layer.dominance_note}`,
    alternates: { canonical: `/robotics/${layer.id}` },
  };
}

const h3Style: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-heading)",
  fontWeight: 600,
  fontSize: 22,
  lineHeight: "24px",
  letterSpacing: ".02em",
  textTransform: "uppercase",
};

export default async function RoboticsLayerPage({ params }: PageProps) {
  const { layer: id } = await params;
  const ds = await getRoboticsDataset();
  const layer = getLayerById(ds, id);
  if (!layer) notFound();

  const { materials } = await getMaterials();
  const ordered = layersInReadingOrder(ds);
  const index = ordered.findIndex(l => l.id === layer.id);
  const previous = ordered[index - 1] ?? null;
  const next = ordered[index + 1] ?? null;

  const actors = getActorsForLayer(ds, layer.id);
  const linked = resolveLayerMaterials(layer, materials);
  const rationale = new Map(layer.material_links.map(l => [l.material_id, l.rationale]));
  const figures = layer.key_figure_ids.map(k => getKeyFigure(ds, k));
  const chokepoints = getChokepointsForLayer(ds, layer.id);
  const bom = getBomForLayer(ds, layer.id);

  // La barre ne propose que les sections que la couche remplit.
  const sections: MxNavSection[] = [
    { id: "controle", label: "Contrôle" },
    { id: "acteurs", label: "Acteurs" },
    ...(linked.length > 0 ? [{ id: "matieres", label: "Matières" }] : []),
    ...(chokepoints.length > 0 || bom.length > 0 ? [{ id: "enjeux", label: "Enjeux" }] : []),
  ];

  return (
    <MxThemeProvider skin="industry" style={industryFontVars}>
      <main id="main-content" className="min-h-screen">
        <MxNav snapshotDateLabel={formatIsoDate(ds.snapshot_date)} sections={sections} moduleLabel="Robotique & IA physique" />

        <div className="mx-auto" style={{ maxWidth: 1200, padding: "0 clamp(20px,5vw,72px)" }}>
          <header className="ind-reveal" style={{ padding: "48px 0 32px" }}>
            <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13, marginBottom: 24 }}>
              <Link href="/robotics">Robotique &amp; IA physique</Link>
              <span aria-hidden="true" style={{ color: "var(--ink-55)" }}>/</span>
              <span style={{ color: "var(--ink-70)" }}>Couche {String(layer.order).padStart(2, "0")}</span>
            </nav>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
              {String(layer.order).padStart(2, "0")} / {String(ordered.length).padStart(2, "0")} · {SEGMENT_LABEL[layer.segment]} — {SEGMENT_DESC[layer.segment]}
            </span>
            <h1
              style={{
                margin: "12px 0 0 -0.04em",
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: "clamp(36px,5vw,64px)",
                lineHeight: 1.04,
                letterSpacing: ".01em",
                textTransform: "uppercase",
              }}
            >
              {layer.name}
            </h1>
          </header>

          <Section id="controle" revealDelay={0.1}>
            <SectionKicker>01 · Qui contrôle la couche</SectionKicker>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-12 gap-y-6">
              <div className="flex flex-col gap-4">
                <p style={{ margin: 0, fontSize: 17, lineHeight: "26px", color: "var(--ink-78)" }}>{layer.dominance_note}</p>
                <div className="flex flex-wrap gap-1.5">
                  {layer.dominant_blocs.map(b => (
                    <span key={b} className="ind-tag ind-tag-accent">Domine : {blocDisplayName(b, actors)}</span>
                  ))}
                  {layer.challenger_blocs.map(b => (
                    <span key={b} className="ind-tag ind-tag-outline">Conteste : {blocDisplayName(b, actors)}</span>
                  ))}
                </div>
              </div>
              <SourceList ds={ds} provenance={layer.provenance} />
            </div>

            {figures.length > 0 && (
              <div className="flex flex-col gap-8" style={{ marginTop: 40 }}>
                {figures.map(f => (
                  <Frame key={f.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-x-12 gap-y-4" style={{ padding: 24 }}>
                    <KeyFigure figure={f} size={36} />
                    <SourceList ds={ds} provenance={f.provenance} />
                  </Frame>
                ))}
              </div>
            )}
          </Section>

          <Section id="acteurs" revealDelay={0.2}>
            <SectionKicker>02 · Acteurs de la couche</SectionKicker>
            <div className="overflow-x-auto">
              <table className="ind-table" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th scope="col">Acteur</th>
                    <th scope="col">Pays</th>
                    <th scope="col">Rôle</th>
                  </tr>
                </thead>
                <tbody>
                  {actors.map(a => (
                    <tr key={a.id} style={{ verticalAlign: "top" }}>
                      <td style={{ fontWeight: 600, paddingTop: 12, paddingBottom: 12 }}>{a.name}</td>
                      <td style={{ paddingTop: 12, whiteSpace: "nowrap" }}>{a.countries.map(countryLabelFr).join(" / ")}</td>
                      <td style={{ paddingTop: 12, paddingBottom: 12 }}>
                        <span style={{ display: "block", marginBottom: a.provenance.data_quality === "manual" ? 0 : 6 }}>{a.role}</span>
                        {a.provenance.data_quality !== "manual" && <SourceList ds={ds} provenance={a.provenance} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
              Sélection d’acteurs du dossier d’origine, non exhaustive. Rôles sans source : qualification éditoriale.
            </p>
          </Section>

          {linked.length > 0 && (
            <Section id="matieres" revealDelay={0.3}>
              <SectionKicker>03 · Matières critiques consommées</SectionKicker>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {linked.map(m => (
                  <Frame key={m.id} className="flex flex-col gap-2" style={{ padding: 20 }}>
                    <p style={{ ...h3Style, fontSize: 20 }}>{m.name_fr}</p>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--ink-78)" }}>{rationale.get(m.id)}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                      Part chinoise de production : {getChinaShare(m)} % (snapshot /materials, valeur estimée)
                    </p>
                    <Link href={`/materials/${m.id}`} className="ind-btn ind-btn-secondary" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
                      Fiche matière →
                    </Link>
                  </Frame>
                ))}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
                Liens éditoriaux entre la couche et les matières qu’elle consomme ; les parts de production viennent du
                snapshot de démonstration de Matières critiques, distinct de ce module.
              </p>
            </Section>
          )}

          {(chokepoints.length > 0 || bom.length > 0) && (
            <Section id="enjeux" revealDelay={0.4}>
              <SectionKicker>{linked.length > 0 ? "04" : "03"} · Enjeux de la couche</SectionKicker>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chokepoints.map(c => (
                  <Frame key={c.id} className="flex flex-col gap-2" style={{ padding: 20 }}>
                    <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
                      Goulot d’étranglement
                    </span>
                    <p style={{ ...h3Style, fontSize: 20 }}>{c.title}</p>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--ink-78)" }}>{c.issue}</p>
                    <Link href="/robotics#goulots" style={{ fontSize: 13, marginTop: "auto" }}>
                      Signaux datés →
                    </Link>
                  </Frame>
                ))}
                {bom.map(b => (
                  <Frame key={b.id} className="flex flex-col gap-2" style={{ padding: 20 }}>
                    <span style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, color: "var(--ink-70)" }}>
                      Poste de coût
                    </span>
                    <p style={{ ...h3Style, fontSize: 20 }}>
                      {b.label} · {b.min_pct === b.max_pct ? `${b.max_pct} %` : `${b.min_pct}–${b.max_pct} %`}
                    </p>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", color: "var(--ink-78)" }}>{b.detail}</p>
                    <SourceList ds={ds} provenance={b.provenance} />
                  </Frame>
                ))}
              </div>
            </Section>
          )}

          <footer
            className="flex items-center justify-between gap-6 flex-wrap"
            style={{ borderTop: "1px solid var(--color-divider)", padding: "36px 0 48px", marginTop: 24 }}
          >
            <div className="flex flex-wrap gap-2.5">
              {previous && (
                <Link href={`/robotics/${previous.id}`} className="ind-btn ind-btn-secondary">
                  ← {previous.name}
                </Link>
              )}
              {next && (
                <Link href={`/robotics/${next.id}`} className="ind-btn ind-btn-secondary">
                  {next.name} →
                </Link>
              )}
            </div>
            <Link href="/robotics" className="ind-btn ind-btn-primary">Toute la chaîne →</Link>
          </footer>
        </div>
      </main>
    </MxThemeProvider>
  );
}
