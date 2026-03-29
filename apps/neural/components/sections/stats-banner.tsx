"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useReveal } from "@/lib/use-reveal";

const stats = [
  { value: 168, suffix: "", label: "Agents spécialisés" },
  { value: 42, suffix: "", label: "Combinaisons secteur × branche" },
  { value: 7, suffix: "", label: "Branches métier couvertes" },
  { value: 6, suffix: "", label: "Secteurs d'expertise" },
];

function CountUp({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  const animate = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { animate(); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animate]);

  return (
    <span ref={ref} className="tabnum">
      {count}{suffix}
    </span>
  );
}

export function StatsBanner() {
  const sectionRef = useReveal();

  return (
    <section ref={sectionRef} className="relative border-y border-[var(--color-border)] bg-[var(--color-surface)] py-16 overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-[600px] rounded-full bg-neural-violet/5 blur-[100px]" />

      <div className="relative mx-auto grid max-w-[1440px] grid-cols-2 gap-8 px-8 md:grid-cols-4 md:px-12">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="reveal text-center"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="inline-flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-6 py-5 transition-all hover:border-neural-violet/20 hover:shadow-md">
              <p className="text-3xl font-bold text-neural-violet font-display">
                <CountUp target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
