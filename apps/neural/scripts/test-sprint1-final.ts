/**
 * Sprint 1 — Verification finale integration Luxe / Communication
 * au catalogue public neural-ai.fr.
 */
import { getBranchEntry, getAgentEntry, AGENT_ENTRIES, PUBLIC_METRICS } from "@/lib/public-catalog";
import { getCell, countLiveAgents } from "@/lib/data/agents-registry";
import { LUXE_COMMS_SUMMARY } from "@/lib/data/luxe-comms-catalog";

console.log("=== PUBLIC_METRICS ===");
console.log(PUBLIC_METRICS);

console.log("\n=== BRANCHE communication ===");
const branche = getBranchEntry("communication");
if (!branche) {
  console.error("  KO : branche communication introuvable");
  process.exit(1);
}
console.log(`  status=${branche.status}  proofLevel=${branche.proofLevel}`);
console.log(`  tagline="${branche.tagline}"`);

console.log("\n=== 5 AGENT_ENTRIES (expected: live + runtime_data) ===");
const slugs = [
  "maison-voice-guard",
  "luxe-press-agent",
  "luxe-event-comms",
  "heritage-comms",
  "green-claim-checker",
] as const;
let missingAgents = 0;
for (const slug of slugs) {
  const a = getAgentEntry(slug);
  if (!a) {
    console.log(`  [MISSING] ${slug}`);
    missingAgents++;
    continue;
  }
  const status = `${a.status}/${a.proofLevel}`;
  console.log(`  [OK] ${slug.padEnd(24)} ${status.padEnd(22)} ${a.label}`);
}

console.log("\n=== MATRIX cell luxe × communication ===");
const cell = getCell("luxe", "communication");
if (!cell) {
  console.error("  KO : cellule matrix introuvable");
  process.exit(1);
}
console.log(`  excelSource: ${cell.excelSource}`);
console.log(`  agents: ${cell.agents.length} (live: ${cell.agents.filter(a => a.status === "live").length})`);
console.log(`  topAgent: ${cell.topAgent}`);

console.log("\n=== countLiveAgents ===");
console.log(`  total live agents (toutes branches): ${countLiveAgents()}`);

console.log("\n=== AGENT_ENTRIES total ===");
console.log(`  ${AGENT_ENTRIES.length} entries (should include the 5 new Luxe Comms)`);

console.log("\n=== LUXE_COMMS_SUMMARY ===");
console.log(LUXE_COMMS_SUMMARY);

console.log("\n=== VERDICT SPRINT 1 ===");
const ok =
  branche.status === "live" &&
  missingAgents === 0 &&
  cell.agents.filter((a) => a.status === "live").length === 5 &&
  LUXE_COMMS_SUMMARY.brandRulesCount > 0 &&
  LUXE_COMMS_SUMMARY.claimsTotal > 0;
console.log(ok ? "  >>> OK — Sprint 1 livre" : "  >>> KO — un check a echoue");
process.exit(ok ? 0 : 1);
