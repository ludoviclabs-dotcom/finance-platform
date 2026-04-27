import Link from "next/link";
import { Webhook, ArrowLeft } from "lucide-react";

import { WebhookTester } from "@/components/dev/webhook-tester";

export const metadata = {
  title: "Webhooks — Developer NEURAL",
  description:
    "Format des webhooks NEURAL : agent decisions, policy blocks, audit exports, cost alerts. Payloads JSON + cURL + sécurité HMAC-SHA256.",
};

export default function WebhooksPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-cyan-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <Link
            href="/dev"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Developer surface
          </Link>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            <Webhook className="h-3.5 w-3.5" />
            Developer · Webhooks
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Webhooks NEURAL
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/68">
            4 types d&apos;événements émis par l&apos;Operator Gateway. Format JSON signé
            HMAC-SHA256, retry exponentiel, tolérance horloge ±5 min. Cette page sert de référence
            pour configurer votre endpoint receiver.
          </p>
        </div>
      </section>

      <section className="relative px-8 pb-24 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <WebhookTester />
        </div>
      </section>
    </div>
  );
}
