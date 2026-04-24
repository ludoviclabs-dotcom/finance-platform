"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { ABOUT_COPY } from "./about-data";
import { AvatarStage } from "./avatar-stage";
import { BgOrb } from "./bg-orb";
import { HeroConstellation } from "./hero-constellation";
import { ProofConsole } from "./proof-console";

function useScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll(".np-reveal").forEach((el) => el.classList.add("np-in"));
      return;
    }

    const els = document.querySelectorAll(".np-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("np-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "-40px 0px -40px 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useMagneticCursor(hintRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hint = hintRef.current;
    if (!hint) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const loop = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      hint.style.left = `${cx}px`;
      hint.style.top = `${cy}px`;
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };
    const onEnter = () => hint.classList.add("np-on");
    const onLeave = () => hint.classList.remove("np-on");

    window.addEventListener("mousemove", onMove);
    const magnets = document.querySelectorAll<HTMLElement>("[data-magnet]");
    magnets.forEach((el) => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    });
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      magnets.forEach((el) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
      });
    };
  }, [hintRef]);
}

function SectionHead({
  kicker,
  title1,
  title2,
  titleIt,
  aside,
}: {
  kicker: string;
  title1: string;
  title2?: string;
  titleIt?: string;
  aside?: string;
}) {
  return (
    <div className="np-section-head np-reveal">
      <div>
        <div className="np-kicker np-eyebrow">{kicker}</div>
        <h2>
          {title1}
          {title2 ? ` ${title2}` : null}
          {titleIt ? (
            <>
              {" "}
              <span className="np-it">{titleIt}</span>
            </>
          ) : null}
        </h2>
      </div>
      {aside ? <div className="np-aside">{aside}</div> : null}
    </div>
  );
}

function Hero() {
  const h = ABOUT_COPY.hero;
  return (
    <section className="np-hero">
      <HeroConstellation />
      <div className="np-shell np-hero-grid">
        <div className="np-reveal" style={{ position: "relative", zIndex: 2 }}>
          <span className="np-hero-tag">
            <span className="np-dot" /> {h.tag}
          </span>
          <h1 className="np-hero-title">
            {h.title1}
            <br />
            <span className="np-it">{h.title2}</span>
            <br />
            {h.title3}
            <span className="np-thin">{h.kickerLine}</span>
          </h1>
          <p className="np-hero-sub" dangerouslySetInnerHTML={{ __html: h.sub }} />
          <div className="np-hero-ctas">
            <Link href="/contact" className="np-btn-primary" data-magnet>
              {h.cta1} <span aria-hidden="true">→</span>
            </Link>
            <Link href="#preuves" className="np-btn-ghost">
              {h.cta2}
            </Link>
          </div>
        </div>
        <div className="np-reveal" style={{ position: "relative", zIndex: 2 }}>
          <AvatarStage />
        </div>
      </div>
    </section>
  );
}

function Principles() {
  const p = ABOUT_COPY.principles;
  return (
    <section className="np-section">
      <div className="np-shell">
        <SectionHead
          kicker={p.kicker}
          title1={p.title1}
          title2={p.title2}
          titleIt={p.titleIt}
          aside={p.aside}
        />
        <div className="np-manifesto np-reveal">
          {p.items.map((item) => (
            <div key={item.n} className="np-principle">
              <div className="np-num">
                <span>PRINCIPE {item.n}</span>
                <span className="np-glyph">{item.g}</span>
              </div>
              <h3>
                {item.t1} <span className="np-it">{item.tIt}</span>
              </h3>
              <p>{item.d}</p>
              <div className="np-foot">
                <span>{item.foot1}</span>
                <span>{item.foot2}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trajectory() {
  const t = ABOUT_COPY.trajectory;
  return (
    <section className="np-section">
      <div className="np-shell">
        <SectionHead
          kicker={t.kicker}
          title1={t.title1}
          titleIt={t.titleIt}
          aside={t.aside}
        />
        <div className="np-trajectory np-reveal">
          <div className="np-rail">
            <span className="np-rail-label">{t.rail}</span>
            {t.items.length} jalons
          </div>
          <div className="np-milestones">
            {t.items.map((m, i) => (
              <div key={i} className="np-milestone">
                <div className="np-date">{m.date}</div>
                <div className="np-body">
                  <h4>{m.t}</h4>
                  <p>{m.d}</p>
                </div>
                <div className={`np-state${m.cls ? ` np-${m.cls}` : ""}`}>
                  <span className="np-bullet" />
                  {m.s}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Proof() {
  const p = ABOUT_COPY.proof;
  return (
    <section className="np-section" id="preuves">
      <div className="np-shell">
        <SectionHead
          kicker={p.kicker}
          title1={p.title1}
          title2={p.title2}
          titleIt={p.titleIt}
          aside={p.aside}
        />
        <ProofConsole />
      </div>
    </section>
  );
}

function Pull() {
  const p = ABOUT_COPY.pull;
  return (
    <section className="np-pull">
      <div className="np-shell np-reveal">
        <q>
          {p.q1} <span className="np-it">{p.qIt}</span> {p.q2}
        </q>
        <div className="np-sig">
          <span className="np-line" />
          {p.sig}
        </div>
      </div>
    </section>
  );
}

function Sectors() {
  const s = ABOUT_COPY.sectors;
  return (
    <section className="np-section">
      <div className="np-shell">
        <SectionHead
          kicker={s.kicker}
          title1={s.title1}
          title2={s.title2}
          titleIt={s.titleIt}
          aside={s.aside}
        />
        <div className="np-sectors np-reveal">
          {s.items.map((item) => (
            <div key={item.n} className="np-sector">
              <div>
                <div className="np-idx">{item.n}</div>
                <div className="np-name">{item.name}</div>
              </div>
              <div className={`np-state np-${item.state}`}>
                <span className="np-b" />
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  const c = ABOUT_COPY.cta;
  return (
    <div className="np-shell">
      <div className="np-cta-band np-reveal">
        <div>
          <h2>
            {c.t1} <span className="np-it">{c.tIt}</span> {c.t2}
          </h2>
          <p>{c.d}</p>
        </div>
        <div className="np-cta-actions">
          <Link href="/contact" className="np-btn-primary" data-magnet>
            {c.b1} <span aria-hidden="true">→</span>
          </Link>
          <Link href="/secteurs/transport" className="np-btn-ghost">
            {c.b2}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AboutContent() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  useScrollReveal();
  useMagneticCursor(cursorRef);

  return (
    <div className="np-about">
      <BgOrb />
      <div className="np-page-wrap">
        <Hero />
        <Principles />
        <Trajectory />
        <Proof />
        <Pull />
        <Sectors />
        <Cta />
      </div>
      <div className="np-cursor-hint" ref={cursorRef} aria-hidden="true" />
    </div>
  );
}
