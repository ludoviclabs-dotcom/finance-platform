import {
  LUXE_COMMS_SUMMARY,
  LUXE_COMMS_AGENTS,
  VOCAB_FR,
  CLAIMS_REGISTRY,
  HERITAGE_SOURCES,
  countClaimsByStatus,
  countSourcesByType,
  countByTermType,
  resolveClaimStatus,
  resolveHeritageStatus,
} from "@/lib/data/luxe-comms-catalog";

console.log("=== LUXE_COMMS_SUMMARY ===");
console.log(JSON.stringify(LUXE_COMMS_SUMMARY, null, 2));

console.log("\n=== 5 AGENTS ===");
LUXE_COMMS_AGENTS.forEach((a) => console.log(`  ${a.id}  ${a.slug.padEnd(22)}  gate=${a.primaryGate}`));

console.log("\n=== VOCAB_FR ===");
console.log("  count:", VOCAB_FR.length);
console.log("  by term_type:", countByTermType());
console.log("  first terme:", VOCAB_FR[0]?.terme);

console.log("\n=== CLAIMS_REGISTRY ===");
console.log("  count:", CLAIMS_REGISTRY.length);
console.log("  status derived:", countClaimsByStatus());
const clm1 = CLAIMS_REGISTRY.find((c) => c.claim_id === "CLM-001");
const clm9 = CLAIMS_REGISTRY.find((c) => c.claim_id === "CLM-009");
console.log("  CLM-001 (Or 80% recycle):", clm1 ? resolveClaimStatus(clm1) : "?");
console.log("  CLM-009 (Eco-responsable):", clm9 ? resolveClaimStatus(clm9) : "?");

console.log("\n=== HERITAGE_SOURCES ===");
console.log("  count:", HERITAGE_SOURCES.length);
console.log("  by type:", countSourcesByType());
const src5 = HERITAGE_SOURCES.find((s) => s.source_id === "SRC-005");
console.log("  SRC-005 (2025-01-10):", src5 ? resolveHeritageStatus(src5) : "?");

console.log("\n=== OK ===");
