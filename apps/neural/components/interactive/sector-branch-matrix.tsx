"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Database, Circle } from "lucide-react";
import Link from "next/link";
import {
  SECTORS_META,
  BRANCHES_META,
  getCell,
  countLiveAgents,
  countLiveCells,
  type Sector,
  type Branch,
} from "@/lib/data/agents-registry";

const SECTORS: { id: Sector; label: string; emoji: string }[] = [
  { id: "transport",    label: "Transport",  emoji: SECTORS_META.transport.emoji },
  { id: "luxe",         label: "Luxe",       emoji: SECTORS_META.luxe.emoji },
  { id: "aeronautique", label: "Aéro",       emoji: SECTORS_META.aeronautique.emoji },
  { id: "saas",         label: "SaaS",       emoji: SECTORS_META.saas.emoji },
  { id: "banque",       label: "Banque",     emoji: SECTORS_META.banque.emoji },
  { id: "assurance",    label: "Assurance",  emoji: SECTORS_META.assurance.emoji },
];

const BRANCHES: { id: Branch; label: string }[] = [
  { id: "si",            label: BRANCHES_META.si.shortLabel },
  { id: "rh",            label: BRANCHES_META.rh.shortLabel },
  { id: "marketing",     label: BRANCHES_META.marketing.shortLabel },
  { id: "communication", label: BRANCHES_META.communication.shortLabel },
  { id: "comptabilite",  label: BRANCHES_META.comptabilite.shortLabel },
  { id: "finance",       label: BRANCHES_META.finance.shortLabel },
  { id: "supply-chain",  label: BRANCHES_META["supply-chain"].shortLabel },
];

export function SectorBranchMatrix() {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const liveAgents = countLiveAgents();
  const liveCells = countLiveCells();

  return (
    <section className="bg-surface-raised py-20">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">
            42 combinaisons.{" "}
            <span className="text-neural-violet">168 agents.</span>{" "}
            Un framework.
          </h2>
          <p className="mt-4 text-lg text-foreground-muted">
            Survolez une cellule pour découvrir les agents spécialisés
          </p>
          <div className="mt-3 flex items-center justify-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-neural-green" />
              <span className="text-foreground-muted">
                {liveAgents} agents avec données réelles
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle className="h-3.5 w-3.5 fill-neural-violet text-neural-violet" />
              <span className="text-foreground-muted">
                {liveCells}/42 cellules alimentées
              </span>
            </span>
          </div>
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
                    const isHovered = hoveredCell === cellId;
                    const cell = getCell(sector.id, branch.id);
                    const hasData = !!cell;
                    const agentCount = cell?.agents.length ?? 4;

                    return (
                      <td
                        key={branch.id}
                        className="p-1.5"
                        onMouseEnter={() => setHoveredCell(cellId)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className={`cursor-pointer rounded-lg p-3 text-center text-xs transition-all ${
                            isHovered
                              ? "bg-neural-violet text-white shadow-lg"
                              : hasData
                                ? "card border-neural-green/20 text-foreground-muted shadow-xs hover:shadow-sm"
                                : "card text-foreground-subtle shadow-xs hover:shadow-sm"
                          }`}
                        >
                          <div className="font-bold">
                            {agentCount} agent{agentCount > 1 ? "s" : ""}
                          </div>
                          {hasData && !isHovered && (
                            <div className="mt-0.5">
                              <Database className="mx-auto h-3 w-3 text-neural-green" />
                            </div>
                          )}
                          {isHovered && cell && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-1 space-y-0.5"
                            >
                              <div className="text-[10px] font-medium">
                                {cell.topAgent}
                              </div>
                              <div className="text-[9px] opacity-80">
                                {cell.roiHighlight}
                              </div>
                              <Link
                                href={`/solutions/${branch.id}?sector=${sector.id}`}
                                className="flex items-center justify-center gap-1 text-[10px] text-white underline"
                              >
                                Détails <ChevronRight className="h-3 w-3" />
                              </Link>
                            </motion.div>
                          )}
                          {isHovered && !cell && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-1"
                            >
                              <Link
                                href={`/solutions/${branch.id}?sector=${sector.id}`}
                                className="flex items-center justify-center gap-1 text-[10px] text-white underline"
                              >
                                Détails <ChevronRight className="h-3 w-3" />
                              </Link>
                            </motion.div>
                          )}
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
