"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Play, Shield, BarChart3, Zap, X } from "lucide-react";

const stats = [
  { value: "80%", label: "des projets IA échouent", source: "RAND Corp." },
  { value: "3.2x", label: "meilleur taux de succès avec KPIs", source: "BCG" },
  { value: "<20%", label: "des POC passent en production", source: "McKinsey" },
];

const pillars = [
  {
    icon: Shield,
    title: "7 Branches",
    desc: "SI · RH · Marketing · Comms · Compta · Finance · Supply Chain",
  },
  {
    icon: BarChart3,
    title: "6 Secteurs",
    desc: "Transport · Luxe · Aéro · SaaS · Banque · Assurance",
  },
  {
    icon: Zap,
    title: "ROI mesuré",
    desc: "Chaque agent déployé a des KPIs de succès définis en amont",
  },
];

const VIDEO_SRC = "/videos/neural-demo.mp4";
const VIDEO_POSTER = "/images/neural-android.png";

export function Hero() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-neural pb-24 pt-28 text-white lg:pb-32 lg:pt-40 min-h-[90vh] flex items-center">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />

        {/* Ambient orbs */}
        <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse-slow rounded-full bg-neural-violet/15 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 h-[500px] w-[500px] animate-pulse-slow rounded-full bg-neural-violet/8 blur-[120px]" />
        <div className="absolute top-1/4 right-0 h-64 w-64 animate-pulse-slow rounded-full bg-neural-green/5 blur-[100px]" />

        <div className="relative mx-auto max-w-[1440px] w-full px-8 md:px-12">
          {/* ── 2-column layout ── */}
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">

            {/* ── LEFT: copy ── */}
            <div>
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-neural-violet/30 bg-neural-violet/10 px-4 py-1.5 text-sm font-medium text-neural-violet-light backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neural-green opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-neural-green" />
                  </span>
                  Partenaire Anthropic — Claude AI
                </span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-7 font-display text-[3.2rem] font-extrabold leading-[0.95] tracking-tighter sm:text-[3.8rem] lg:text-[4.2rem] xl:text-[4.8rem]"
              >
                L&apos;IA qui{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  fonctionne vraiment
                </span>{" "}
                en entreprise
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-6 text-lg leading-relaxed text-gray-300 max-w-xl"
              >
                80% des projets d&apos;IA en entreprise échouent.
                Nous architecturons des agents Claude AI intégrés dans vos
                processus métier, avec un ROI mesuré dès le premier mois.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="mt-9 flex flex-col gap-3 sm:flex-row"
              >
                <Link
                  href="/contact"
                  className="group inline-flex items-center justify-center rounded-xl bg-neural-violet px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-neural-violet/25 transition-all hover:bg-neural-violet-dark hover:shadow-2xl hover:shadow-neural-violet/30 hover:scale-[1.02]"
                >
                  Réserver un audit gratuit
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                  onClick={() => setVideoOpen(true)}
                  className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/25"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors group-hover:bg-neural-violet/40">
                    <Play className="h-3.5 w-3.5 fill-white" />
                  </span>
                  Voir la démo
                </button>
              </motion.div>

              {/* Trust stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="mt-12 grid grid-cols-3 gap-3"
              >
                {stats.map((stat, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm transition-all hover:bg-white/8 hover:border-white/15">
                    <div className="font-display text-xl font-bold text-neural-violet-light">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 leading-snug">{stat.label}</div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {stat.source}
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* ── RIGHT: android visual ── */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative flex items-center justify-center"
            >
              {/* Glow behind android */}
              <div className="absolute inset-0 rounded-3xl bg-neural-violet/5 blur-[40px]" />
              <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-neural-violet/10 via-transparent to-neural-green/5 blur-[30px]" />

              {/* Android image */}
              <div className="relative">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Image
                    src="/images/neural-android.png"
                    alt="NEURAL — Agent IA"
                    width={560}
                    height={680}
                    priority
                    className="relative z-10 rounded-2xl object-cover drop-shadow-2xl"
                    style={{
                      maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                      filter: "brightness(1.1) contrast(1.05)",
                    }}
                  />
                </motion.div>

                {/* Floating badge — top right */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, duration: 0.4 }}
                  className="absolute -right-4 top-8 z-20 rounded-xl border border-white/10 bg-neural-midnight/80 px-4 py-2.5 backdrop-blur-md shadow-xl"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neural-green opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-neural-green" />
                    </span>
                    <span className="text-xs font-semibold text-white">168 agents actifs</span>
                  </div>
                </motion.div>

                {/* Floating badge — bottom left */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                  className="absolute -left-4 bottom-20 z-20 rounded-xl border border-white/10 bg-neural-midnight/80 px-4 py-2.5 backdrop-blur-md shadow-xl"
                >
                  <div className="text-xs text-gray-400">ROI moyen an 1</div>
                  <div className="font-display text-lg font-bold text-neural-green">+340%</div>
                </motion.div>

                {/* Video play overlay */}
                <button
                  onClick={() => setVideoOpen(true)}
                  className="group absolute inset-0 z-10 flex items-end justify-center pb-8 opacity-0 transition-opacity hover:opacity-100"
                  aria-label="Voir la démo vidéo"
                >
                  <span className="flex items-center gap-2 rounded-full bg-neural-midnight/70 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all group-hover:bg-neural-violet/80">
                    <Play className="h-4 w-4 fill-white" />
                    Voir la démo
                  </span>
                </button>
              </div>
            </motion.div>
          </div>

          {/* ── Three pillars ── */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3"
          >
            {pillars.map((pillar, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-neural-violet/30 hover:bg-white/8"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neural-violet/20">
                  <pillar.icon className="h-5 w-5 text-neural-violet-light" />
                </div>
                <h3 className="mt-3 font-display text-base font-bold">
                  {pillar.title}
                </h3>
                <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            className="mt-16 flex justify-center"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="flex flex-col items-center gap-2 text-gray-500"
            >
              <span className="text-[10px] uppercase tracking-widest">Scroll</span>
              <div className="h-8 w-5 rounded-full border border-gray-600 flex items-start justify-center p-1">
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="h-1.5 w-1.5 rounded-full bg-neural-violet-light"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── VIDEO MODAL ── */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              className="relative mx-4 w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setVideoOpen(false)}
                className="absolute -right-3 -top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-neural-midnight shadow-2xl">
                {VIDEO_SRC.includes("youtube.com") ? (
                  <iframe
                    src={VIDEO_SRC}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={VIDEO_SRC}
                    poster={VIDEO_POSTER}
                    autoPlay
                    controls
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
