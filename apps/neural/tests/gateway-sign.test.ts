import { describe, expect, it } from "vitest";

import {
  hashPrompt,
  shortSig,
  signEvent,
  verifyChain,
  type ChainEvent,
  type SignableEvent,
} from "@/lib/gateway/sign";
import { lookupSignature } from "@/lib/gateway/lookup";
import { getLiveGatewayState } from "@/lib/gateway/state";

function makeEvent(overrides: Partial<SignableEvent> = {}): SignableEvent {
  return {
    sequence: 1,
    tenantId: "default",
    agentId: "demo-agent",
    agentVersion: "v1.0.0",
    model: "anthropic/claude-sonnet-4-6",
    promptHash: hashPrompt("hello"),
    decision: "ALLOW",
    recordedAtMs: 1747300000000,
    ...overrides,
  };
}

describe("signEvent", () => {
  it("is deterministic for the same inputs", () => {
    const ev = makeEvent();
    const a = signEvent("", ev);
    const b = signEvent("", ev);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when the previous signature changes", () => {
    const ev = makeEvent();
    const a = signEvent("", ev);
    const b = signEvent("a".repeat(64), ev);
    expect(a).not.toBe(b);
  });

  it("changes when any field of the event changes", () => {
    const base = makeEvent();
    const baseSig = signEvent("", base);
    for (const change of [
      { agentId: "other-agent" },
      { agentVersion: "v2.0.0" },
      { promptHash: hashPrompt("different-prompt") },
      { decision: "BLOCK" as const },
      { model: "other-model" },
      { sequence: 2 },
      { tenantId: "other-tenant" },
      { recordedAtMs: 1747300000001 },
    ]) {
      const sig = signEvent("", { ...base, ...change });
      expect(sig).not.toBe(baseSig);
    }
  });

  it("is robust to model = null", () => {
    const a = signEvent("", makeEvent({ model: null }));
    const b = signEvent("", makeEvent({ model: null }));
    expect(a).toBe(b);
  });
});

describe("verifyChain", () => {
  function chain(n: number): ChainEvent[] {
    const events: ChainEvent[] = [];
    let prev = "";
    for (let i = 1; i <= n; i += 1) {
      const ev = makeEvent({
        sequence: i,
        recordedAtMs: 1747300000000 + i * 1000,
        promptHash: hashPrompt(`prompt-${i}`),
      });
      const sig = signEvent(prev, ev);
      events.push({ ...ev, prevSignature: prev, signature: sig });
      prev = sig;
    }
    return events;
  }

  it("validates an empty chain", () => {
    const v = verifyChain([]);
    expect(v.valid).toBe(true);
    expect(v.total).toBe(0);
    expect(v.brokenAt).toBeNull();
  });

  it("validates a fresh, well-formed chain", () => {
    const events = chain(5);
    const v = verifyChain(events);
    expect(v.valid).toBe(true);
    expect(v.total).toBe(5);
    expect(v.brokenAt).toBeNull();
  });

  it("validates the chain regardless of input order", () => {
    const events = chain(5);
    const v = verifyChain([events[4], events[0], events[2], events[1], events[3]]);
    expect(v.valid).toBe(true);
  });

  it("detects a tampered decision in the middle of the chain", () => {
    const events = chain(5);
    // Mutate event #3's decision without re-signing — the stored signature
    // becomes inconsistent with the (now changed) inputs.
    events[2] = { ...events[2], decision: "BLOCK" };
    const v = verifyChain(events);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(3);
    expect(v.brokenReason).toBe("signature-mismatch");
  });

  it("detects a missing event creating a prev-signature mismatch", () => {
    const events = chain(5);
    // Remove event #3 — event #4 still claims prevSignature = sig of #3,
    // which is no longer in the chain.
    const tampered = events.filter((_, i) => i !== 2);
    const v = verifyChain(tampered);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(4);
    expect(v.brokenReason).toBe("prev-signature-mismatch");
  });

  it("detects a swapped signature value", () => {
    const events = chain(3);
    events[1] = { ...events[1], signature: "0".repeat(64) };
    const v = verifyChain(events);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(2);
  });
});

describe("hashPrompt + shortSig", () => {
  it("hashes prompts to 64 hex chars", () => {
    expect(hashPrompt("any prompt")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("yields different hashes for different prompts", () => {
    expect(hashPrompt("a")).not.toBe(hashPrompt("b"));
  });

  it("shortens a signature with an ellipsis", () => {
    const sig = "a".repeat(32) + "b".repeat(32);
    expect(shortSig(sig)).toBe(`${sig.slice(0, 8)}…${sig.slice(-8)}`);
  });
});

describe("lookup + state with no DB", () => {
  it("lookupSignature returns invalid-format for non-hex input", async () => {
    const r = await lookupSignature("not-a-hash");
    expect(r.kind).toBe("invalid-format");
  });

  it("lookupSignature returns db-unavailable for valid hash without DB", async () => {
    const r = await lookupSignature("a".repeat(64));
    expect(r.kind).toBe("db-unavailable");
  });

  it("getLiveGatewayState returns null without DB", async () => {
    const s = await getLiveGatewayState();
    expect(s).toBeNull();
  });
});
