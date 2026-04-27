import Link from "next/link";
import { Code2, ArrowLeft, ArrowRight, Package, Zap, ShieldCheck, Boxes } from "lucide-react";

export const metadata = {
  title: "Embed SDK — Developer NEURAL",
  description:
    "Embed les agents NEURAL dans votre produit SaaS. SDK TypeScript/React, iframe sécurisée, audit trail propagé, RBAC client. Roadmap T1 2027.",
};

const REACT_SAMPLE = `import { NeuralAgent } from "@neural/embed";

export function MyApp() {
  return (
    <NeuralAgent
      agentSlug="green-claim-checker"
      tenant="my-tenant-id"
      auth={{ mode: "jwt", token: process.env.NEURAL_JWT }}
      onDecision={(decision) => {
        console.log("Decision:", decision);
        // decision.outcome, decision.signedBy, decision.cost…
      }}
    />
  );
}`;

const VANILLA_SAMPLE = `<!-- HTML -->
<div id="neural-agent"></div>

<script src="https://embed.neural-ai.fr/v1/loader.js"></script>
<script>
  Neural.embed({
    container: "#neural-agent",
    agent: "green-claim-checker",
    tenant: "my-tenant-id",
    jwt: "eyJhbG..."
  });
</script>`;

const FEATURES = [
  {
    icon: Package,
    title: "TypeScript + React natif",
    description: "@neural/embed npm package · types stricts · React 19 compatible · zéro runtime supplémentaire au-delà de l'iframe.",
  },
  {
    icon: ShieldCheck,
    title: "Sandbox iframe sécurisée",
    description: "Isolation cross-origin. Jamais d'accès au DOM parent. Communication par postMessage avec schéma validé.",
  },
  {
    icon: Zap,
    title: "Audit trail propagé",
    description: "Chaque décision émet un event vers votre webhook. Hash signé, version prompt, signataire — opposable juridiquement.",
  },
  {
    icon: Boxes,
    title: "RBAC client",
    description: "Authentification JWT signé. Tenant isolation côté NEURAL. Vous gardez le contrôle total des permissions par utilisateur.",
  },
];

export default function EmbedPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[1320px]">
          <Link
            href="/dev"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Developer surface
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              <Code2 className="h-3.5 w-3.5" />
              Embed SDK
            </span>
            <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/[0.10] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Roadmap T1 2027
            </span>
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold tracking-tight md:text-6xl">
            Embarquez les agents NEURAL
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">
            Pour les éditeurs SaaS qui veulent enrichir leur produit avec un agent IA conforme
            AI Act, RGPD-native et opérable depuis le jour 1. Pas besoin de réinventer
            l&apos;orchestration, le hosting EU, ou les Model Cards — embarquez et opérez.
          </p>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Capabilities</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="flex gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-400/[0.10] text-violet-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold tracking-tight text-white">
                      {f.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">{f.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="font-display text-3xl font-bold tracking-tight">Code samples</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-white/65">
            Aperçu du SDK. API susceptible d&apos;évoluer — versions stables disponibles à la
            release T1 2027.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300/70">
                React / TypeScript
              </p>
              <pre className="mt-2 overflow-auto rounded-[20px] border border-white/10 bg-black/30 p-5 font-mono text-xs leading-relaxed text-white/85">
{REACT_SAMPLE}
              </pre>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/70">
                HTML / Vanilla
              </p>
              <pre className="mt-2 overflow-auto rounded-[20px] border border-white/10 bg-black/30 p-5 font-mono text-xs leading-relaxed text-white/85">
{VANILLA_SAMPLE}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[1320px]">
          <div className="rounded-[28px] border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.10] via-white/[0.04] to-cyan-500/[0.06] p-8 md:p-12">
            <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                  Programme partenaires SaaS
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Vous éditez un SaaS B2B et voulez intégrer un agent NEURAL en preview ? Les
                  premiers partenaires bénéficient d&apos;un accès anticipé au SDK + co-marketing
                  + tarifs préférentiels.
                </p>
              </div>
              <Link
                href="/contact?source=embed-sdk"
                className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark"
              >
                Devenir partenaire <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
