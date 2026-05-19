import type { ReactNode } from "react";

interface HubHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  icon?: ReactNode;
}

export function HubHeader({ eyebrow, title, description, icon }: HubHeaderProps) {
  return (
    <header className="relative pt-30 lg:pt-36">
      <div className="mx-auto max-w-[1320px] px-8 md:px-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
          {icon}
          {eyebrow}
        </span>
        <h1 className="mt-6 font-display text-5xl font-bold tracking-tight text-white md:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/68">{description}</p>
      </div>
    </header>
  );
}
