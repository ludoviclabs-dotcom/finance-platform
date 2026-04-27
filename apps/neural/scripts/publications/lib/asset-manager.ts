/**
 * NEURAL — Gestion des assets pour les articles importes.
 *
 * Lit le dossier `_drafts/<slug>-assets/` (s'il existe), copie les fichiers
 * vers `public/publications/<slug>/`, et expose un manifeste pour le LLM
 * (qui suggerera les <Figure>/<ChartBlock>/<DataTable> au bon endroit).
 *
 * Conventions reconnues dans le dossier assets :
 *   - *.png/*.jpg/*.jpeg/*.svg/*.webp  → image (genere une <Figure>)
 *   - *.chart.json                      → ChartBlock (schema specifique)
 *   - *.table.json                      → DataTable
 *   - *.stat.json                       → StatBlock
 *   - cover.{png,svg,jpg,webp}          → utilise comme coverImage du frontmatter
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { z } from "zod";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]);

const chartItemSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  note: z.string().optional(),
});

export const chartJsonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  items: z.array(chartItemSchema).min(1),
});

export const tableJsonSchema = z.object({
  columns: z.array(z.string().min(1)).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number()]))).min(1),
});

export const statJsonSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string().min(1),
  source: z.string().optional(),
});

export type ChartAsset = z.infer<typeof chartJsonSchema>;
export type TableAsset = z.infer<typeof tableJsonSchema>;
export type StatAsset = z.infer<typeof statJsonSchema>;

export interface ImageAsset {
  fileName: string;       // nom dans public/publications/<slug>/
  publicPath: string;     // chemin public utilisable dans <Figure src="...">
  isCover: boolean;
}

export interface AssetManifest {
  slug: string;
  hasAssetsDir: boolean;
  images: ImageAsset[];
  charts: Array<{ key: string; data: ChartAsset }>;
  tables: Array<{ key: string; data: TableAsset }>;
  stats: Array<{ key: string; data: StatAsset }>;
  coverImage?: string;
}

function isImage(fileName: string): boolean {
  return IMAGE_EXTS.has(extname(fileName).toLowerCase());
}

function isCoverFile(fileName: string): boolean {
  const base = fileName.toLowerCase();
  return /^cover\.(png|jpe?g|svg|webp|gif)$/.test(base);
}

/**
 * Charge le manifeste d'assets pour un slug. Si le dossier n'existe pas,
 * renvoie un manifeste vide (pas une erreur — les assets sont optionnels).
 */
export async function loadAssetManifest(args: {
  slug: string;
  draftsDir: string;
  publicPublicationsDir: string;
}): Promise<AssetManifest> {
  const { slug, draftsDir, publicPublicationsDir } = args;
  const assetsDir = join(draftsDir, `${slug}-assets`);

  const empty: AssetManifest = {
    slug,
    hasAssetsDir: false,
    images: [],
    charts: [],
    tables: [],
    stats: [],
  };

  if (!existsSync(assetsDir)) return empty;

  const targetDir = join(publicPublicationsDir, slug);
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(assetsDir);
  const manifest: AssetManifest = { ...empty, hasAssetsDir: true };

  for (const fileName of entries) {
    const sourcePath = join(assetsDir, fileName);

    if (isImage(fileName)) {
      await copyFile(sourcePath, join(targetDir, fileName));
      const publicPath = `/publications/${slug}/${fileName}`;
      const isCover = isCoverFile(fileName);
      manifest.images.push({ fileName, publicPath, isCover });
      if (isCover) manifest.coverImage = publicPath;
      continue;
    }

    if (fileName.endsWith(".chart.json")) {
      const raw = JSON.parse(await readFile(sourcePath, "utf8"));
      const data = chartJsonSchema.parse(raw);
      const key = fileName.replace(/\.chart\.json$/, "");
      manifest.charts.push({ key, data });
      continue;
    }

    if (fileName.endsWith(".table.json")) {
      const raw = JSON.parse(await readFile(sourcePath, "utf8"));
      const data = tableJsonSchema.parse(raw);
      const key = fileName.replace(/\.table\.json$/, "");
      manifest.tables.push({ key, data });
      continue;
    }

    if (fileName.endsWith(".stat.json")) {
      const raw = JSON.parse(await readFile(sourcePath, "utf8"));
      const data = statJsonSchema.parse(raw);
      const key = fileName.replace(/\.stat\.json$/, "");
      manifest.stats.push({ key, data });
      continue;
    }

    // Fichier non reconnu : on l'ignore (pas d'erreur)
  }

  return manifest;
}

/**
 * Serialise le manifeste pour le LLM : liste des assets disponibles
 * avec leur chaine de placement MDX prete a coller.
 */
export function describeAssetsForPrompt(manifest: AssetManifest): string {
  if (
    !manifest.hasAssetsDir ||
    (manifest.images.length === 0 &&
      manifest.charts.length === 0 &&
      manifest.tables.length === 0 &&
      manifest.stats.length === 0)
  ) {
    return "_(aucun asset fourni — n'invente pas de Figure/Chart/Table)_";
  }

  const lines: string[] = [];

  if (manifest.images.length > 0) {
    lines.push(`### Images disponibles`);
    for (const img of manifest.images) {
      const hint = img.isCover ? " (cover — utilise plutot comme illustration d'ouverture)" : "";
      lines.push(
        `- \`${img.fileName}\`${hint} → place avec :`,
        `  <Figure src="${img.publicPath}" alt="..." caption="..." width={1600} height={900} />`,
      );
    }
    lines.push("");
  }

  if (manifest.charts.length > 0) {
    lines.push(`### Graphiques disponibles (key = nom de fichier sans .chart.json)`);
    for (const c of manifest.charts) {
      lines.push(
        `- key=\`${c.key}\` titre="${c.data.title}" (${c.data.items.length} items)`,
        `  → place exactement avec : <ChartBlock chartKey="${c.key}" />`,
      );
    }
    lines.push(
      "",
      `Le script substituera <ChartBlock chartKey="..."/> par le composant complet avec les donnees du JSON.`,
      "",
    );
  }

  if (manifest.tables.length > 0) {
    lines.push(`### Tableaux disponibles`);
    for (const t of manifest.tables) {
      lines.push(
        `- key=\`${t.key}\` (${t.data.columns.length} colonnes × ${t.data.rows.length} lignes)`,
        `  → place avec : <DataTable tableKey="${t.key}" />`,
      );
    }
    lines.push("");
  }

  if (manifest.stats.length > 0) {
    lines.push(`### Stats disponibles`);
    for (const s of manifest.stats) {
      lines.push(
        `- key=\`${s.key}\` value="${s.data.value}" label="${s.data.label}"`,
        `  → place avec : <StatBlock statKey="${s.key}" />`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Substitue les balises <ChartBlock chartKey="..."/>, <DataTable tableKey="..."/>,
 * <StatBlock statKey="..."/> par les composants complets avec leurs donnees JSON.
 *
 * Si le LLM utilise une cle inconnue, on log un warning et on retire la balise.
 */
export function expandAssetBlocks(
  body: string,
  manifest: AssetManifest,
  warnings: string[],
): string {
  const chartByKey = new Map(manifest.charts.map((c) => [c.key, c.data]));
  const tableByKey = new Map(manifest.tables.map((t) => [t.key, t.data]));
  const statByKey = new Map(manifest.stats.map((s) => [s.key, s.data]));

  // ChartBlock
  body = body.replace(
    /<ChartBlock\s+chartKey=["']([^"']+)["']\s*\/?>(?:<\/ChartBlock>)?/g,
    (_, key: string) => {
      const data = chartByKey.get(key);
      if (!data) {
        warnings.push(`ChartBlock chartKey="${key}" introuvable dans les assets — balise retiree.`);
        return "";
      }
      return renderChartBlock(data);
    },
  );

  // DataTable
  body = body.replace(
    /<DataTable\s+tableKey=["']([^"']+)["']\s*\/?>(?:<\/DataTable>)?/g,
    (_, key: string) => {
      const data = tableByKey.get(key);
      if (!data) {
        warnings.push(`DataTable tableKey="${key}" introuvable dans les assets — balise retiree.`);
        return "";
      }
      return renderDataTable(data);
    },
  );

  // StatBlock
  body = body.replace(
    /<StatBlock\s+statKey=["']([^"']+)["']\s*\/?>(?:<\/StatBlock>)?/g,
    (_, key: string) => {
      const data = statByKey.get(key);
      if (!data) {
        warnings.push(`StatBlock statKey="${key}" introuvable dans les assets — balise retiree.`);
        return "";
      }
      return renderStatBlock(data);
    },
  );

  return body;
}

function renderChartBlock(data: ChartAsset): string {
  const items = data.items
    .map((it) => {
      const note = it.note ? `, note: ${JSON.stringify(it.note)}` : "";
      return `    { label: ${JSON.stringify(it.label)}, value: ${it.value}${note} }`;
    })
    .join(",\n");
  const description = data.description
    ? `\n  description=${JSON.stringify(data.description)}`
    : "";
  return `<ChartBlock\n  title=${JSON.stringify(data.title)}${description}\n  items={[\n${items}\n  ]}\n/>`;
}

function renderDataTable(data: TableAsset): string {
  const columns = JSON.stringify(data.columns);
  const rows = data.rows
    .map((row) => `    ${JSON.stringify(row)}`)
    .join(",\n");
  return `<DataTable\n  columns={${columns}}\n  rows={[\n${rows}\n  ]}\n/>`;
}

function renderStatBlock(data: StatAsset): string {
  const source = data.source ? `\n  source=${JSON.stringify(data.source)}` : "";
  return `<StatBlock\n  value=${JSON.stringify(String(data.value))}\n  label=${JSON.stringify(data.label)}${source}\n/>`;
}
