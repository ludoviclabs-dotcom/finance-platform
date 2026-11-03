"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MxTheme } from "@/components/materials/MxThemeProvider";
import { industryFontVars } from "@/components/materials/industry/fonts";
import { HomeNav } from "./HomeNav";

const EASE = "cubic-bezier(.2,.7,.2,1)";
/** Sens dans lequel chaque repère s'écarte au survol d'un cadre. */
const OFF: Record<string, [number, number]> = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };

/**
 * Une page d'accueil complète sous la peau Industry, avec son propre thème.
 *
 * Le thème n'est pas persisté (contrairement à MxThemeProvider) : la page de
 * revue en pose trois côte à côte, chacune basculable seule.
 *
 * Animations reprises de la maquette, limitées au sous-arbre de la planche :
 *  - [data-reveal="n"] entre en fondu au défilement, décalé de n × 110 ms ;
 *    masqué seulement une fois le JS chargé, donc visible sans lui ;
 *  - les repères « + » des cadres tournent en place au chargement, puis
 *    s'écartent au survol ;
 *  - [data-glitch] (« prouvé. ») tressaute toutes les 6,5 s.
 */
export function Planche({
  prefix,
  defaultTheme = "clair",
  motion = true,
  showGrid = false,
  children,
}: {
  /** Préfixe des ancres de la planche (« 1a » → #1a-pourquoi). */
  prefix: string;
  defaultTheme?: MxTheme;
  motion?: boolean;
  showGrid?: boolean;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<MxTheme>(defaultTheme);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || !motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cleanups: (() => void)[] = [];

    const show = (node: HTMLElement) => {
      if (node.dataset.shown) return;
      node.dataset.shown = "1";
      node.style.opacity = "";
      node.animate([{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], {
        duration: 700,
        easing: EASE,
        delay: (Number(node.dataset.reveal) || 0) * 110,
        fill: "backwards",
      });
    };
    const reveals = [...el.querySelectorAll<HTMLElement>("[data-reveal]")];
    reveals.forEach((n) => (n.style.opacity = "0"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            io.unobserve(e.target);
            show(e.target as HTMLElement);
          }
        }),
      { threshold: 0.08 },
    );
    reveals.forEach((n) => io.observe(n));
    // Filet de sécurité de la maquette : tout est visible au bout de 2,6 s.
    const fallback = setTimeout(() => reveals.forEach(show), 2600);
    cleanups.push(() => {
      io.disconnect();
      clearTimeout(fallback);
      reveals.forEach((n) => {
        n.style.opacity = "";
        delete n.dataset.shown;
      });
    });

    el.querySelectorAll<HTMLElement>(".ind-frame > .ind-corner").forEach((c, i) =>
      c.animate([{ transform: "scale(0) rotate(-180deg)", opacity: 0 }, { transform: "none", opacity: 1 }], {
        duration: 620,
        delay: 250 + (i % 18) * 40,
        easing: EASE,
        fill: "backwards",
      }),
    );

    // Délégation : le menu Modules monte ses cadres après coup, ils
    // profitent ainsi du même survol sans nouvel abonnement.
    const hovered = new WeakMap<Element, Animation[]>();
    const corners = (frame: Element) =>
      [...frame.children].filter((c) => c.classList.contains("ind-corner")) as HTMLElement[];
    // Tous les cadres qui contiennent la cible, du plus proche au plus large :
    // un cadre peut en contenir un autre (bouton dans une carte).
    const framesOf = (target: EventTarget | null) => {
      const out: Element[] = [];
      let f = target instanceof Element ? target.closest(".ind-frame") : null;
      while (f && el.contains(f)) {
        out.push(f);
        f = f.parentElement?.closest(".ind-frame") ?? null;
      }
      return out;
    };
    const inside = (frame: Element, node: EventTarget | null) => node instanceof Node && frame.contains(node);
    const onOver = (e: PointerEvent) => {
      for (const frame of framesOf(e.target)) {
        if (hovered.has(frame) || inside(frame, e.relatedTarget)) continue;
        hovered.set(
          frame,
          corners(frame).map((c) => {
            const k = (["tl", "tr", "bl", "br"] as const).find((x) => c.classList.contains(x)) ?? "tl";
            const [x, y] = OFF[k];
            return c.animate([{ transform: "none" }, { transform: `translate(${x * 4}px, ${y * 4}px) rotate(90deg)` }], {
              duration: 300,
              easing: EASE,
              fill: "forwards",
            });
          }),
        );
      }
    };
    const onOut = (e: PointerEvent) => {
      for (const frame of framesOf(e.target)) {
        if (!hovered.has(frame) || inside(frame, e.relatedTarget)) continue;
        hovered.get(frame)?.forEach((a) => a.reverse());
        hovered.delete(frame);
      }
    };
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerout", onOut);
    cleanups.push(() => {
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerout", onOut);
    });

    const glitch = () =>
      el.querySelectorAll<HTMLElement>("[data-glitch]").forEach((g) =>
        g.animate(
          [
            { transform: "none", textShadow: "none", clipPath: "inset(0 0 0 0)" },
            { transform: "translateX(-3px)", textShadow: "3px 0 var(--color-accent-300)", clipPath: "inset(8% 0 48% 0)" },
            { transform: "translateX(3px)", textShadow: "-3px 0 var(--color-accent-300)", clipPath: "inset(52% 0 6% 0)" },
            { transform: "translateX(-1px)", textShadow: "2px 0 var(--color-accent-300)", clipPath: "inset(0 0 0 0)" },
            { transform: "none", textShadow: "none", clipPath: "inset(0 0 0 0)" },
          ],
          { duration: 460, easing: "steps(5)" },
        ),
      );
    const first = setTimeout(glitch, 1200);
    const every = setInterval(glitch, 6500);
    cleanups.push(() => {
      clearTimeout(first);
      clearInterval(every);
    });

    return () => cleanups.forEach((fn) => fn());
  }, [motion]);

  return (
    <div
      ref={root}
      data-mx
      data-mx-skin="industry"
      data-mx-theme={theme}
      className="acc-root"
      style={{ ...industryFontVars, position: "relative", boxShadow: "var(--shadow-lg)" }}
    >
      {showGrid && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "0 48px",
            zIndex: 30,
            pointerEvents: "none",
            backgroundImage:
              "repeating-linear-gradient(to right, color-mix(in srgb, var(--color-accent) 10%, transparent) 0 70px, transparent 70px 94px)",
          }}
        />
      )}
      <HomeNav theme={theme} onTheme={setTheme} motion={motion} anchor={(id) => `${prefix}-${id}`} />
      {children}
    </div>
  );
}
