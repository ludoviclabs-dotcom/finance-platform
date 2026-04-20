"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Database, Radar, ShieldCheck } from "lucide-react";

import { StatusBadge } from "@/components/site/status-badge";
import { PUBLIC_METRICS, SECTOR_ENTRIES } from "@/lib/public-catalog";

export function Hero() {
  const primarySectors = SECTOR_ENTRIES.slice(0, 3);

  return (
    <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-gradient-neural pb-24 pt-28 text-white lg:pb-32 lg:pt-40">
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />
      <div className="absolute -left-40 -top-40 h-96 w-96 animate-pulse-slow rounded-full bg-neural-violet/15 blur-[120px]" />
      <div className="absolute -bottom-40 right-1/3 h-[500px] w-[500px] animate-pulse-slow rounded-full bg-neural-violet/8 blur-[120px]" />
      <div className="absolute top-1/4 right-0 h-64 w-64 animate-pulse-slow rounded-full bg-neural-green/5 blur-[100px]" />

      <div className="relative mx-auto w-full max-w-[1440px] px-8 md:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-neural-violet/30 bg-neural-violet/10 px-4 py-1.5 text-sm font-medium text-neural-violet-light backdrop-blur-sm">
                Framework multi-secteurs · source de verite publique
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-7 font-display text-[3.2rem] font-extrabold leading-[0.95] tracking-tighter sm:text-[3.8rem] lg:text-[4.2rem] xl:text-[4.8rem]"
            >
              Un framework{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                multi-secteurs
              </span>{" "}
              avec un noyau deja live
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-gray-300"
            >
              NEURAL expose maintenant une seule verite publique :{" "}
              <strong className="font-semibold text-white">
                {PUBLIC_METRICS.liveAgents} agents avec donnees reelles
              </strong>
              ,{" "}
              <strong className="font-semibold text-white">
                {PUBLIC_METRICS.liveCells}/{PUBLIC_METRICS.frameworkCells} cellules alimentees
              </strong>{" "}
              et{" "}
              <strong className="font-semibold text-white">
                {PUBLIC_METRICS.runtimeWorkbooks} workbooks runtime
              </strong>
              . Le reste reste visible, mais clairement qualifie comme demo ou preparation.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/secteurs/luxe"
                className="group inline-flex items-center justify-center rounded-xl bg-neural-violet px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-neural-violet/25 transition-all hover:scale-[1.02] hover:bg-neural-violet-dark hover:shadow-2xl hover:shadow-neural-violet/30"
              >
                Explorer le noyau live
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/trust"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10"
              >
                Voir la page trust
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  <Database className="h-3.5 w-3.5" />
                  Preuve runtime
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/68">
                  Le Data Hub et les exports montrent deja une sortie metier, pas seulement une
                  interface.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                  <Radar className="h-3.5 w-3.5" />
                  Cadre vs realite
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/68">
                  Les {PUBLIC_METRICS.frameworkAgents} agents decrivent la capacite du framework,
                  pas le perimetre public deja operable.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Clarite produit
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/68">
                  Chaque page publique est maintenant qualifiee comme live, demo orchestree ou en
                  preparation.
                </p>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute inset-0 rounded-3xl bg-neural-violet/5 blur-[40px]" />
            <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-neural-violet/10 via-transparent to-neural-green/5 blur-[30px]" />

            <div className="relative">
              <Image
                src="/images/neural-android.png"
                alt="NEURAL interface hero"
                width={560}
                height={680}
                priority
                className="relative z-10 rounded-2xl object-cover drop-shadow-2xl"
                style={{
                  maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
                  filter: "brightness(1.05) contrast(1.02)",
                }}
              />

              <div className="absolute -right-3 top-6 z-20 rounded-2xl border border-white/10 bg-neural-midnight/82 px-4 py-3 backdrop-blur-md shadow-xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Perimetre live
                </p>
                <p className="mt-1 font-display text-xl font-bold text-white">
                  {PUBLIC_METRICS.liveAgents} agents
                </p>
              </div>

              <div className="absolute -left-3 bottom-24 z-20 rounded-2xl border border-white/10 bg-neural-midnight/82 px-4 py-3 backdrop-blur-md shadow-xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Matrice active
                </p>
                <p className="mt-1 font-display text-xl font-bold text-white">
                  {PUBLIC_METRICS.liveCells}/{PUBLIC_METRICS.frameworkCells}
                </p>
              </div>

              <div className="absolute inset-x-6 bottom-6 z-20 rounded-[24px] border border-white/10 bg-neural-midnight/82 p-4 backdrop-blur-md shadow-xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Statuts publics
                </p>
                <div className="mt-3 space-y-3">
                  {primarySectors.map((entry) => (
                    <div key={entry.slug} className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.label}</p>
                        <p className="text-xs text-white/45">{entry.tagline}</p>
                      </div>
                      <StatusBadge status={entry.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
              Branches
            </p>
            <p className="mt-3 font-display text-3xl font-bold">{PUBLIC_METRICS.publicBranches}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Toutes les branches restent visibles, mais leur niveau de preparation est explicite.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Secteurs
            </p>
            <p className="mt-3 font-display text-3xl font-bold">{PUBLIC_METRICS.publicSectors}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Luxe reste la verticale la plus prouvee, Transport la demo la plus avancee.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Runtime IA
            </p>
            <p className="mt-3 font-display text-3xl font-bold">AI Gateway</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Claude Sonnet 4.6 pilote le chat public, avec GPT-5.4 prepare en fallback via une
              couche de routage unifiee.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
