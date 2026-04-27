"use client";

import { useState } from "react";
import { Webhook, ChevronDown, Copy, CheckCircle2 } from "lucide-react";

const EVENT_SAMPLES = [
  {
    type: "agent.decision.created",
    description: "Émis à chaque décision agent",
    sample: {
      event: "agent.decision.created",
      timestamp: "2026-04-27T08:29:47.123Z",
      tenant: "client_ABC",
      agent: { slug: "green-claim-checker", version: "v3.2.1" },
      decision: "REVIEW",
      promptHash: "sha256:a83f...91ed",
      model: "claude-sonnet-4-6",
      tokens: 1842,
      latencyMs: 1380,
      cost: { amount: 0.018, currency: "EUR" },
      signedBy: "GreenClaimChecker@v3.2.1",
      outcome: "Claim CRITICAL escaladé Legal+ESG Lead",
    },
  },
  {
    type: "agent.policy.blocked",
    description: "Émis quand une policy bloque une décision",
    sample: {
      event: "agent.policy.blocked",
      timestamp: "2026-04-27T08:29:38.456Z",
      tenant: "client_DEF",
      agent: { slug: "sapin2-compliance", version: "v1.5.3" },
      policy: { id: "p-decision-art22", label: "Article 22 RGPD" },
      reason: "Tier identifié dans liste OFAC SDN secondaire",
      requiresHumanReview: true,
    },
  },
  {
    type: "operator.audit.exported",
    description: "Émis quand un audit trail est exporté",
    sample: {
      event: "operator.audit.exported",
      timestamp: "2026-04-27T08:30:00.000Z",
      tenant: "client_ABC",
      exportedBy: "user_42",
      range: { from: "2026-04-01", to: "2026-04-27" },
      decisionsCount: 9247,
      format: "JSONL",
      signature: "sha256:7ef...3a9",
    },
  },
  {
    type: "operator.cost.alert",
    description: "Émis quand un cost cap est dépassé",
    sample: {
      event: "operator.cost.alert",
      timestamp: "2026-04-27T08:31:00.000Z",
      tenant: "client_GHI",
      thresholdReached: "80%",
      currentSpend: { amount: 4287, currency: "EUR", period: "monthly" },
      cap: { amount: 5000, currency: "EUR" },
    },
  },
];

export function WebhookTester() {
  const [activeEventIdx, setActiveEventIdx] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState("https://your-app.example.com/webhooks/neural");
  const [copied, setCopied] = useState(false);

  const activeEvent = EVENT_SAMPLES[activeEventIdx];
  const payloadStr = JSON.stringify(activeEvent.sample, null, 2);
  const curlCmd = `curl -X POST ${webhookUrl} \\\n  -H "Content-Type: application/json" \\\n  -H "X-Neural-Signature: t=...,v1=..." \\\n  -d '${JSON.stringify(activeEvent.sample)}'`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payloadStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            URL de votre endpoint (test uniquement)
          </span>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
          />
        </label>
        <p className="mt-2 text-[11px] text-white/40">
          Aucune requête réelle n&apos;est envoyée — cette page sert à montrer le format payload.
        </p>
      </div>

      {/* Event selector */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
          Type d&apos;événement
        </p>
        {EVENT_SAMPLES.map((evt, i) => {
          const isActive = activeEventIdx === i;
          return (
            <button
              key={evt.type}
              type="button"
              onClick={() => setActiveEventIdx(i)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${
                isActive
                  ? "border-violet-400/50 bg-violet-400/[0.10]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                    isActive
                      ? "border-violet-400/40 bg-violet-400/[0.16] text-violet-200"
                      : "border-white/10 bg-white/[0.04] text-white/55"
                  }`}
                >
                  <Webhook className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-mono text-xs text-white">{evt.type}</p>
                  <p className="mt-0.5 text-[11px] text-white/55">{evt.description}</p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-white/40 transition-transform ${
                  isActive ? "rotate-180" : ""
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Payload preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
            Payload JSON
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                Copié
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copier
              </>
            )}
          </button>
        </div>
        <pre className="overflow-auto rounded-[20px] border border-white/10 bg-black/30 p-5 font-mono text-xs leading-relaxed text-white/85">
{payloadStr}
        </pre>
      </div>

      {/* curl */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">
          Exemple cURL
        </p>
        <pre className="overflow-auto rounded-[20px] border border-white/10 bg-black/30 p-5 font-mono text-xs leading-relaxed text-white/75">
{curlCmd}
        </pre>
      </div>

      {/* Security notes */}
      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">
          Sécurité webhook
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-white/65">
          <li>• Header <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">X-Neural-Signature</code> contient timestamp + HMAC-SHA256 du payload</li>
          <li>• Vérifier la signature côté serveur avant de traiter l&apos;événement</li>
          <li>• Tolérance horloge : ±5 min (rejet si timestamp trop ancien ou futur)</li>
          <li>• Retry exponential backoff : 5 tentatives max sur 24h</li>
          <li>• Réponse attendue : <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">200 OK</code> sous 5 secondes — sinon retry</li>
        </ul>
      </div>
    </div>
  );
}
