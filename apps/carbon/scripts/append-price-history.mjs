#!/usr/bin/env node
// Accumule le point de prix courant du snapshot CRM dans data/crm_price_history.json.
// Idempotent : un point n'est ajouté que si sa date (celle du price_snapshot, pas celle
// du run) n'est pas déjà enregistrée — relancer le script sans nouveau snapshot = no-op.
// Exécuté chaque lundi par .github/workflows/materials-price-history.yml.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

const snapshotFile = readdirSync(dataDir)
  .filter(f => /^crm_full_34_snapshot_.*\.json$/.test(f))
  .sort()
  .at(-1);
if (!snapshotFile) {
  console.error("Aucun fichier crm_full_34_snapshot_*.json trouvé dans", dataDir);
  process.exit(1);
}

const historyPath = join(dataDir, "crm_price_history.json");
const snapshot = JSON.parse(readFileSync(join(dataDir, snapshotFile), "utf8"));
const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, "utf8")) : {};

let added = 0;
for (const m of snapshot.materials) {
  const p = m.price_snapshot;
  if (!p || typeof p.value !== "number" || !p.date) continue;
  const series = history[m.id] ?? (history[m.id] = []);
  if (series.some(pt => pt.date === p.date)) continue;
  series.push({ date: p.date, value: p.value, unit: p.unit });
  series.sort((a, b) => a.date.localeCompare(b.date));
  added++;
}

writeFileSync(historyPath, JSON.stringify(history, null, 2) + "\n");
console.log(
  `price-history: snapshot=${snapshotFile} → ${added} point(s) ajouté(s), ` +
  `${Object.keys(history).length} matière(s) suivie(s)`
);
