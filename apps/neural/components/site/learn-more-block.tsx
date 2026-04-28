import Link from "next/link";
import { ArrowRight, BookOpen, Library, Wrench } from "lucide-react";

export type LearnMoreItem = {
  label: string;
  description: string;
  href: string;
  kind: "doc" | "glossary" | "tool";
};

const KIND_META: Record<LearnMoreItem["kind"], { icon: typeof BookOpen; eyebrow: string; border: string; text: string; gradient: string }> = {
  doc: {
    icon: BookOpen,
    eyebrow: "Doc",
    border: "border-violet-400/25",
    text: "text-violet-200",
    gradient: "from-violet-500/[0.08] via-white/[0.03] to-violet-500/[0.03]",
  },
  glossary: {
    icon: Library,
    eyebrow: "Glossaire",
    border: "border-cyan-400/25",
    text: "text-cyan-200",
    gradient: "from-cyan-500/[0.08] via-white/[0.03] to-cyan-500/[0.03]",
  },
  tool: {
    icon: Wrench,
    eyebrow: "Outil",
    border: "border-emerald-400/25",
    text: "text-emerald-200",
    gradient: "from-emerald-500/[0.08] via-white/[0.03] to-emerald-500/[0.03]",
  },
};

export function LearnMoreBlock({
  title = "Pour aller plus loin",
  subtitle,
  items,
}: {
  title?: string;
  subtitle?: string;
  items: LearnMoreItem[];
}) {
  return (
    <section className="relative border-t border-white/8 px-8 py-16 md:px-12">
      <div className="mx-auto max-w-[1320px]">
        <div className="max-w-3xl">
          <h2 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-3 text-sm leading-relaxed text-white/60">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              <div
                key={item.href}
                className={`group relative flex flex-col gap-3 rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.gradient} p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20`}
              >
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${meta.border} ${meta.text}`}
                >
                  <Icon className="h-3 w-3" />
                  {meta.eyebrow}
                </span>
                <div>
                  <p className="font-display text-base font-bold tracking-tight text-white">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{item.description}</p>
                </div>
                <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-violet-200 opacity-80 group-hover:opacity-100">
                  <span>Ouvrir</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </div>
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
