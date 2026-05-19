import type { ReactNode } from "react";

interface HubSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function HubSection({ title, description, children }: HubSectionProps) {
  return (
    <section className="relative pt-12">
      <div className="mx-auto max-w-[1320px] px-8 md:px-12">
        <div className="border-t border-white/8 pt-10">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/60">{description}</p>
          ) : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
