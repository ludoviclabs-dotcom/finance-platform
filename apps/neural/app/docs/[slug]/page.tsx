import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, BookOpen } from "lucide-react";

import gettingStarted from "@/content/docs/getting-started.json";
import agentsArch from "@/content/docs/agents-architecture.json";
import mcp from "@/content/docs/mcp-protocol.json";
import auditTrail from "@/content/docs/audit-trail.json";

type DocData = typeof gettingStarted;

const DOCS: Record<string, DocData> = {
  "getting-started": gettingStarted,
  "agents-architecture": agentsArch,
  "mcp-protocol": mcp,
  "audit-trail": auditTrail,
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) return { title: "Documentation — NEURAL" };
  return {
    title: `${doc.title} — Documentation NEURAL`,
    description: doc.subtitle,
  };
}

function renderBody(text: string) {
  // Simple markdown-like renderer : ** = bold, • = bullet, single newlines preserved
  const parts = text.split(/\n\n/);
  return parts.map((para, i) => {
    if (para.trim().startsWith("•")) {
      const lines = para.split("\n").filter((l) => l.trim());
      return (
        <ul key={i} className="space-y-2">
          {lines.map((line, j) => {
            const clean = line.replace(/^•\s*/, "");
            return (
              <li key={j} className="flex gap-3 text-sm leading-relaxed text-white/75">
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-violet-400" />
                <span dangerouslySetInnerHTML={{ __html: clean.replace(/\*\*(.+?)\*\*/g, "<strong class='text-white font-semibold'>$1</strong>").replace(/`(.+?)`/g, "<code class='rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs'>$1</code>") }} />
              </li>
            );
          })}
        </ul>
      );
    }
    return (
      <p
        key={i}
        className="text-sm leading-relaxed text-white/75"
        dangerouslySetInnerHTML={{
          __html: para.replace(/\*\*(.+?)\*\*/g, "<strong class='text-white font-semibold'>$1</strong>").replace(/`(.+?)`/g, "<code class='rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs'>$1</code>"),
        }}
      />
    );
  });
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-emerald-500/8 blur-[120px]" />

      <section className="relative px-8 pb-12 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[920px]">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200 hover:text-violet-100"
          >
            <ArrowLeft className="h-3 w-3" />
            Documentation
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              <BookOpen className="h-3.5 w-3.5" />
              {doc.category}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/40">
              <Clock className="h-3 w-3" />
              {doc.readTime}
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/35">
              MAJ {doc.lastUpdated}
            </span>
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
            {doc.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-white/55">{doc.subtitle}</p>
        </div>
      </section>

      <section className="relative px-8 pb-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <article className="space-y-10">
            {doc.sections.map((section, i) => (
              <div key={i} className="space-y-4">
                <h2 className="font-display text-2xl font-bold tracking-tight text-white">
                  {section.heading}
                </h2>
                <div className="space-y-4">{renderBody(section.body)}</div>
              </div>
            ))}
          </article>
        </div>
      </section>

      <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
        <div className="mx-auto max-w-[920px]">
          <h2 className="font-display text-2xl font-bold tracking-tight">Aller plus loin</h2>
          <div className="mt-6 grid gap-3">
            {doc.nextSteps.map((step) => (
              <Link
                key={step.href}
                href={step.href}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06] no-underline"
              >
                <span className="text-sm font-semibold text-white">{step.label}</span>
                <ArrowRight className="h-4 w-4 text-violet-200 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
