"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Quote, Loader2, AlertTriangle, Download } from "lucide-react";
import { pageVariants, staggerContainer, staggerItem } from "@/lib/animations";
import { useStrategicMapping } from "@/lib/hooks/use-strategic-mapping";
import { API_BASE_URL } from "@/lib/api";
import type { MappingSegment, MappingPersona, MappingHorizon } from "@/lib/api";
import { MappingHero } from "@/components/strategic-mapping/mapping-hero";
import { InvestmentAndValueChain } from "@/components/strategic-mapping/investment-and-value-chain";
import { BeforeAfterPanel } from "@/components/strategic-mapping/before-after-panel";
import { ImpactPanel } from "@/components/strategic-mapping/impact-panel";
import { CarbonCoLeverPanel } from "@/components/strategic-mapping/carbonco-lever";

export function AdhesionVolontairePage() {
  const [segment, setSegment] = useState<MappingSegment>("generic");
  const [persona, setPersona] = useState<MappingPersona>("generic");
  const [horizon, setHorizon] = useState<MappingHorizon>("generic");

  const { data, loading, error } = useStrategicMapping({ segment, persona, horizon });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[var(--color-foreground-muted)]">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Chargement du mapping stratégique…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-red-400">
        <AlertTriangle className="w-5 h-5" />
        <span className="text-sm">{error ?? "Données indisponibles"}</span>
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-[var(--color-background)] p-6 space-y-10"
    >
      <motion.div variants={staggerContainer} animate="animate" className="max-w-6xl mx-auto space-y-10">

        {/* Bloc 1 — Hero + filtres */}
        <MappingHero
          hero={data.hero}
          groundedKpis={data.groundedKpis}
          segment={segment}
          persona={persona}
          horizon={horizon}
          onSegmentChange={setSegment}
          onPersonaChange={setPersona}
          onHorizonChange={setHorizon}
        />

        {/* Bloc 2 — Messages exécutifs par persona */}
        {data.executiveMessages.length > 0 && (
          <motion.div variants={staggerItem} className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
              {data.executiveMessages.length === 1
                ? "Message pour votre fonction"
                : "Messages par fonction décisionnaire"}
            </h2>
            <div className={`grid gap-4 ${data.executiveMessages.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 max-w-2xl"}`}>
              {data.executiveMessages.map((msg) => (
                <div
                  key={msg.persona}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <Quote className="w-4 h-4 text-[var(--color-primary)] mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1">
                        {msg.personaLabel}
                      </p>
                      <p className="font-semibold text-[var(--color-foreground)] leading-snug">
                        {msg.headline}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-1.5 pl-7">
                    {msg.supporting.map((s, i) => (
                      <li key={i} className="text-sm text-[var(--color-foreground-muted)] flex gap-2">
                        <span className="text-[var(--color-primary)] mt-0.5 shrink-0">·</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Bloc 3 — Investissements + chaîne de valeur */}
        <InvestmentAndValueChain
          investments={data.investments}
          valueChain={data.valueChain}
        />

        {/* Bloc 4 — Avant / Après */}
        <BeforeAfterPanel items={data.beforeAfter} />

        {/* Bloc 5 — Gains financiers + externalités */}
        <ImpactPanel
          financialGains={data.financialGains}
          externalities={data.externalities}
        />

        {/* Bloc 6 — Carbon & Co levers */}
        <CarbonCoLeverPanel levers={data.carbonCoLevers} />

        {/* Footer sources + export */}
        <motion.div variants={staggerItem}>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--color-foreground-muted)]">
              <span className="font-medium">Version {data.meta.version}</span>
              {" · "}Dernière révision : {data.meta.lastReviewedAt}
              {" · "}Prochaine révision prévue : {data.meta.nextReviewScheduled}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--color-foreground-muted)]">
                {data.meta.contentOwner} — Sources vérifiées · Gains formulés en potentiel conditionnel
              </span>
              <a
                href={`${API_BASE_URL}/strategic-mapping/adhesion-volontaire/export.xlsx?segment=${segment}&persona=${persona}&horizon=${horizon}`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                .xlsx
              </a>
              <a
                href={`${API_BASE_URL}/strategic-mapping/adhesion-volontaire/export.pdf?segment=${segment}&persona=${persona}&horizon=${horizon}`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                .pdf
              </a>
            </div>
          </div>
        </motion.div>

      </motion.div>
    </motion.div>
  );
}
