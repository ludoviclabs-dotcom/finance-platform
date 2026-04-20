"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Circle, Database } from "lucide-react";

import {
  BRANCHES_META,
  SECTORS_META,
  countLiveAgents,
  countLiveCells,
  getCell,
  type Branch,
  type Sector,
} from "@/lib/data/agents-registry";
import { PUBLIC_METRICS } from "@/lib/public-catalog";

const SECTORS: { id: Sector; label: string; emoji: string }[] = [
  { id: "transport", label: "Transport", emoji: SECTORS_META.transport.emoji },
  { id: "luxe", label: "Luxe", emoji: SECTORS_META.luxe.emoji },
  { id: "aeronautique", label: "Aero", emoji: SECTORS_META.aeronautique.emoji },
  { id: "saas", label: "SaaS", emoji: SECTORS_META.saas.emoji },
  { id: "banque", label: "Banque", emoji: SECTORS_META.banque.emoji },
  { id: "assurance", label: "Assurance", emoji: SECTORS_META.assurance.emoji },
];

const BRANCHES: { id: Branch; label: string }[] = [
  { id: "si", label: BRANCHES_META.si.shortLabel },
  { id: "rh", label: BRANCHES_META.rh.shortLabel },
  { id: "marketing", label: BRANCHES_META.marketing.shortLabel },
  { id: "communication", label: BRANCHES_META.communication.shortLabel },
  { id: "comptabilite", label: BRANCHES_META.comptabilite.shortLabel },
  { id: "finance", label: BRANCHES_META.finance.shortLabel },
  { id: "supply-chain", label: BRANCHES_META["supply-chain"].shortLabel },
];

function getDestination(sector: Sector, branch: Branch) {
  if (sector === "luxe" && branch === "finance") {
    return "/secteurs/luxe/finance";
  }

  if (sector === "luxe" && branch === "rh") {
    return "/secteurs/luxe/rh";
  }

  if (sector === "transport" && branch === "comptabilite") {
    return "/secteurs/transport";
  }

  return `/solutions/${branch}?sector=${sector}`;
}

export function SectorBranchMatrix() {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const liveAgents = countLiveAgents();
  const liveCells = countLiveCells();

  return (
    <section className="section-raised px-8 py-28 md:px-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-neural-violet">
            Framework
          </span>
          <h2 className="mt-4 font-display text-4xl font-extrabold tracking-tighter md:text-5xl">
            Capacite du framework, <span className="text-neural-violet">sous-ensemble prouve</span>{" "}
            en public.
          </h2>
          <p className="mt-4 text-lg text-[var(--color-foreground-muted)]">
            La matrice garde la vision complete, mais affiche explicitement ce qui est alimente
            aujourd&apos;hui
          </p>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-neural-green" />
              <span className="text-foreground-muted">
                {liveAgents} agents avec donnees reelles
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-3.5 w-3.5 fill-neural-violet text-neural-violet" />
              <span className="text-foreground-muted">
                {liveCells}/{PUBLIC_METRICS.frameworkCells} cellules alimentees
              </span>
            </span>
          </div>
          <p className="mt-3 text-xs text-[var(--color-foreground-subtle)]">
            {PUBLIC_METRICS.frameworkCells} combinaisons / {PUBLIC_METRICS.frameworkAgents} agents
            correspondent a la capacite du framework, pas au scope public live.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left text-sm font-semibold text-foreground-muted">
                  Secteur \ Branche
                </th>
                {BRANCHES.map((branch) => (
                  <th
                    key={branch.id}
                    className="p-3 text-center text-sm font-semibold text-foreground-muted"
                  >
                    {branch.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SECTORS.map((sector) => (
                <tr key={sector.id}>
                  <td className="p-3 font-medium">
                    <span className="mr-2">{sector.emoji}</span>
                    {sector.label}
                  </td>
                  {BRANCHES.map((branch) => {
                    const cellId = `${sector.id}-${branch.id}`;
                    const cell = getCell(sector.id, branch.id);
                    const hasData = Boolean(cell);
                    const isHovered = hoveredCell === cellId;
                    const theoreticalAgents = cell?.agents.length ?? 4;

                    return (
                      <td
                        key={branch.id}
                        className="p-1.5"
                        onMouseEnter={() => setHoveredCell(cellId)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <motion.div
                          whileHover={{ scale: 1.04 }}
                          className={`cursor-pointer rounded-lg p-3 text-center text-xs transition-all ${
                            isHovered
                              ? "bg-neural-violet text-white shadow-lg"
                              : hasData
                                ? "card border-neural-green/20 text-foreground-muted shadow-xs hover:shadow-sm"
                                : "card text-foreground-subtle shadow-xs hover:shadow-sm"
                          }`}
                        >
                          <div className="font-bold">
                            {hasData
                              ? `${theoreticalAgents} agent${theoreticalAgents > 1 ? "s" : ""}`
                              : `${theoreticalAgents} prevus`}
                          </div>

                          {hasData && !isHovered ? (
                            <div className="mt-0.5">
                              <Database className="mx-auto h-3 w-3 text-neural-green" />
                            </div>
                          ) : null}

                          {isHovered && cell ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-1 space-y-0.5"
                            >
                              <div className="text-[10px] font-medium">{cell.topAgent}</div>
                              <div className="text-[9px] opacity-80">{cell.roiHighlight}</div>
                              <Link
                                href={getDestination(sector.id, branch.id)}
                                className="flex items-center justify-center gap-1 text-[10px] text-white underline"
                              >
                                Ouvrir <ChevronRight className="h-3 w-3" />
                              </Link>
                            </motion.div>
                          ) : null}

                          {isHovered && !cell ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-1"
                            >
                              <Link
                                href={getDestination(sector.id, branch.id)}
                                className="flex items-center justify-center gap-1 text-[10px] text-white underline"
                              >
                                Readiness <ChevronRight className="h-3 w-3" />
                              </Link>
                            </motion.div>
                          ) : null}
                        </motion.div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
