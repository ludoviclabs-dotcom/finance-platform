"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronDown } from "lucide-react";

export function SplashScreen({ onEnter }: { onEnter: () => void }) {
  const [phase, setPhase] = useState<"loading" | "reveal" | "ready">("loading");

  useEffect(() => {
    // Phase 1: loading → reveal after a short delay
    const t1 = setTimeout(() => setPhase("reveal"), 800);
    // Phase 2: reveal → ready (interactive)
    const t2 = setTimeout(() => setPhase("ready"), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleEnter = useCallback(() => {
    if (phase !== "ready") return;
    onEnter();
  }, [phase, onEnter]);

  // Scroll / click / key triggers enter
  useEffect(() => {
    if (phase !== "ready") return;

    let triggered = false;
    const trigger = () => {
      if (triggered) return;
      triggered = true;
      onEnter();
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 30) trigger();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        trigger();
      }
    };

    // Small delay so accidental scroll doesn't fire immediately
    const t = setTimeout(() => {
      window.addEventListener("wheel", onWheel, { passive: true });
      window.addEventListener("keydown", onKey);
    }, 300);

    return () => {
      clearTimeout(t);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, onEnter]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-neural-midnight"
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Background image — android */}
      <div className="absolute inset-0">
        <Image
          src="/images/neural-android.png"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-0 transition-opacity duration-[2000ms]"
          style={{ opacity: phase !== "loading" ? 0.4 : 0 }}
        />
        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-neural-midnight via-neural-midnight/60 to-neural-midnight/30" />
        {/* Violet ambient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neural-violet/5 via-transparent to-neural-violet/10" />
      </div>

      {/* Scan line effect */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
          }}
        />
      </div>

      {/* Animated grain noise */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4">
        {/* Glowing orb behind title */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.3, scale: 1 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="absolute -top-20 h-64 w-64 rounded-full bg-neural-violet/20 blur-[100px]"
        />

        {/* NEURAL title — large serif cinematic */}
        <motion.h1
          initial={{ opacity: 0, y: 30, letterSpacing: "0.5em" }}
          animate={
            phase !== "loading"
              ? { opacity: 1, y: 0, letterSpacing: "0.3em" }
              : {}
          }
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-playfair text-center text-[clamp(3rem,12vw,10rem)] font-bold leading-none tracking-[0.3em] text-white"
          style={{ fontFamily: "var(--font-playfair, 'Playfair Display')" }}
        >
          NEURAL
        </motion.h1>

        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={
            phase !== "loading" ? { scaleX: 1, opacity: 1 } : {}
          }
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-6 h-px w-32 origin-center bg-gradient-to-r from-transparent via-neural-violet-light to-transparent"
        />

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={
            phase !== "loading" ? { opacity: 1, y: 0 } : {}
          }
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-6 text-center font-display text-sm font-medium uppercase tracking-[0.25em] text-neural-violet-light/80 sm:text-base"
        >
          Intelligence Augmentée pour l&apos;Entreprise
        </motion.p>

        {/* "Entrer" CTA */}
        <AnimatePresence>
          {phase === "ready" && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              onClick={handleEnter}
              className="group mt-12 flex flex-col items-center gap-3 text-white/60 transition-colors hover:text-white"
            >
              <span className="text-xs font-medium uppercase tracking-[0.2em]">
                Entrer
              </span>
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-neural-midnight to-transparent" />

      {/* Floating particles */}
      {phase !== "loading" && (
        <>
          <Particle delay={0} x="15%" y="20%" size={2} />
          <Particle delay={0.5} x="80%" y="30%" size={1.5} />
          <Particle delay={1} x="25%" y="70%" size={1} />
          <Particle delay={1.5} x="70%" y="75%" size={2} />
          <Particle delay={0.8} x="50%" y="15%" size={1.5} />
          <Particle delay={1.2} x="90%" y="55%" size={1} />
        </>
      )}
    </motion.div>
  );
}

function Particle({
  delay,
  x,
  y,
  size,
}: {
  delay: number;
  x: string;
  y: string;
  size: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.6, 0] }}
      transition={{
        duration: 3,
        delay: delay + 1,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className="absolute rounded-full bg-neural-violet-light"
      style={{ left: x, top: y, width: size, height: size }}
    />
  );
}
