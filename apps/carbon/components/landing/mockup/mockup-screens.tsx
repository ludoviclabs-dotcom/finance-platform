"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ScreenId } from "./mockup-data";
import { KPI_DATA, SCOPE_DATA, POSTES_DATA, ACTIONS_DATA, RAPPORTS_DATA } from "./mockup-data";

const screenTransition = { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const };

/* ── Mini sparkline SVG ── */
function Sparkline({ data, color, width = 40, height = 14 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   OVERVIEW – Vue globale (default)
   ═══════════════════════════════════════════ */
function OverviewScreen() {
  return (
    <div className="p-2.5 md:p-4 h-full flex flex-col gap-2 md:gap-3">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-1.5 md:gap-2">
        {KPI_DATA.map((kpi) => (
          <div key={kpi.label} className="bg-white/5 border border-white/10 rounded-lg p-1.5 md:p-3">
            <div className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-wider mb-0.5 md:mb-1">{kpi.label}</div>
            <div className="text-[10px] md:text-lg font-extrabold text-white">{kpi.value}</div>
            <div className="flex items-center justify-between mt-0.5 md:mt-1">
              <span className="text-[7px] md:text-[10px] font-bold" style={{ color: kpi.color }}>{kpi.change} YoY</span>
              <Sparkline data={kpi.trend} color={kpi.color} width={32} height={10} />
            </div>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-1.5 md:gap-2 flex-1 min-h-0">
        {/* Scope chart */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 md:p-3">
          <div className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-wider mb-1.5 md:mb-3">Repartition Scopes</div>
          <div className="flex items-end gap-1 md:gap-1.5 h-[50px] md:h-[100px]">
            {SCOPE_DATA.map((s, i) => (
              <motion.div
                key={s.name}
                className="flex-1 rounded-t"
                style={{ background: s.color }}
                initial={{ height: 0 }}
                animate={{ height: `${s.pct * 1.6}%` }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
              />
            ))}
          </div>
          <div className="flex gap-1 md:gap-1.5 mt-1 md:mt-1.5">
            {["S1", "S2", "S3"].map((s) => (
              <span key={s} className="text-[6px] md:text-[9px] text-white/30 flex-1 text-center">{s}</span>
            ))}
          </div>
        </div>

        {/* Postes */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 md:p-3">
          <div className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-wider mb-1.5 md:mb-3">Postes d&apos;emission</div>
          <div className="space-y-1 md:space-y-1.5">
            {POSTES_DATA.map((p) => (
              <div key={p.name}>
                <div className="flex justify-between text-[6px] md:text-[9px] text-white/50 mb-0.5">
                  <span>{p.name}</span>
                  <span>{p.pct}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: p.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.pct}%` }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions IA */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 md:p-3">
          <div className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-wider mb-1.5 md:mb-3">Actions IA</div>
          <div className="space-y-1 md:space-y-1.5">
            {ACTIONS_DATA.slice(0, 3).map((a) => (
              <div key={a.text} className="bg-white/5 rounded-md p-1 md:p-1.5">
                <div className="text-[6px] md:text-[9px] text-white/70 font-medium">{a.text}</div>
                <div className="flex items-center gap-1 md:gap-1.5 mt-0.5">
                  <span className="text-[6px] md:text-[8px] font-bold text-green-400">{a.impact}</span>
                  <span className="text-[5px] md:text-[7px] px-1 py-px rounded-full bg-white/10 text-white/40">{a.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reports bar */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 md:p-3 flex items-center justify-between">
        <div>
          <div className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-wider">Rapports CSRD</div>
          <div className="text-[8px] md:text-xs text-white/70 mt-0.5">3 rapports prets · E1, S1, G1</div>
        </div>
        <div className="flex items-center gap-1 md:gap-1.5">
          <span className="text-[6px] md:text-[9px] px-2 py-1 rounded-full bg-green-600/20 text-green-400 font-bold border border-green-500/30">Telecharger PDF</span>
          <span className="text-[6px] md:text-[9px] px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">Excel</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCOPES – Analyse des scopes GHG
   ═══════════════════════════════════════════ */
function ScopesScreen() {
  const total = SCOPE_DATA.reduce((s, d) => s + d.value, 0);
  return (
    <div className="p-2.5 md:p-4 h-full flex flex-col gap-2 md:gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] md:text-sm font-bold text-white">Analyse des Scopes</div>
          <div className="text-[7px] md:text-[10px] text-white/40">GHG Protocol · Annee 2025</div>
        </div>
        <div className="text-right">
          <div className="text-xs md:text-xl font-extrabold text-white">{total.toLocaleString("fr-FR")}</div>
          <div className="text-[7px] md:text-[10px] text-green-400 font-bold">tCO2e total</div>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 md:space-y-2 min-h-0">
        {SCOPE_DATA.map((scope, i) => (
          <motion.div
            key={scope.name}
            className="bg-white/5 border border-white/10 rounded-lg p-2 md:p-3"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1 md:mb-1.5">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: scope.color }} />
                <span className="text-[8px] md:text-xs font-semibold text-white">{scope.name}</span>
              </div>
              <div className="text-right">
                <span className="text-[8px] md:text-sm font-extrabold text-white">{scope.value.toLocaleString("fr-FR")}</span>
                <span className="text-[7px] md:text-[10px] text-white/40 ml-1">tCO2e</span>
              </div>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scope.color }}
                initial={{ width: 0 }}
                animate={{ width: `${scope.pct}%` }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              />
            </div>
            <div className="text-[6px] md:text-[9px] text-white/30 mt-1">{scope.details}</div>
          </motion.div>
        ))}
      </div>

      {/* Stacked total bar */}
      <div className="h-2.5 md:h-4 rounded-full overflow-hidden flex">
        {SCOPE_DATA.map((s, i) => (
          <motion.div
            key={s.name}
            className="h-full"
            style={{ background: s.color }}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   KPIs – Indicateurs carbone
   ═══════════════════════════════════════════ */
function KpisScreen() {
  return (
    <div className="p-2.5 md:p-4 h-full flex flex-col gap-2 md:gap-3">
      <div>
        <div className="text-[10px] md:text-sm font-bold text-white">Indicateurs Carbone</div>
        <div className="text-[7px] md:text-[10px] text-white/40">Evolution Year-over-Year · Trajectoire SBTi</div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 md:gap-2 flex-1 min-h-0">
        {KPI_DATA.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            className="bg-white/5 border border-white/10 rounded-lg p-2 md:p-3 flex flex-col justify-between"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div>
              <div className="text-[7px] md:text-[10px] text-white/40 uppercase tracking-wider">{kpi.label}</div>
              <div className="text-sm md:text-2xl font-extrabold text-white mt-0.5 md:mt-1">{kpi.value}</div>
            </div>
            <div className="flex items-center justify-between mt-1.5 md:mt-2">
              <div className="flex items-center gap-1 md:gap-1.5">
                <span className="text-[8px] md:text-xs font-bold" style={{ color: kpi.color }}>{kpi.change}</span>
                <span className="text-[6px] md:text-[9px] text-white/30">vs 2024</span>
              </div>
              <Sparkline data={kpi.trend} color={kpi.color} width={48} height={16} />
            </div>
            <div className="mt-1.5 md:mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `${kpi.color}80` }}
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   POSTES – Ventilation par poste
   ═══════════════════════════════════════════ */
function PostesScreen() {
  return (
    <div className="p-2.5 md:p-4 h-full flex flex-col gap-2 md:gap-3">
      <div>
        <div className="text-[10px] md:text-sm font-bold text-white">Postes d&apos;emission</div>
        <div className="text-[7px] md:text-[10px] text-white/40">Ventilation par categorie · Facteurs ADEME</div>
      </div>

      <div className="flex-1 space-y-1.5 md:space-y-2 min-h-0">
        {POSTES_DATA.map((p, i) => (
          <motion.div
            key={p.name}
            className="bg-white/5 border border-white/10 rounded-lg p-2 md:p-3"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <div className="flex items-center justify-between mb-1 md:mb-1.5">
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[10px] md:text-sm">{p.icon}</span>
                <span className="text-[8px] md:text-xs font-semibold text-white">{p.name}</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[8px] md:text-xs font-extrabold text-white">{p.value}</span>
                <span
                  className="text-[7px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: `${p.color}20`, color: p.color }}
                >
                  {p.pct}%
                </span>
              </div>
            </div>
            <div className="h-1.5 md:h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: p.color }}
                initial={{ width: 0 }}
                animate={{ width: `${p.pct * 2.8}%` }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 md:p-3 flex items-center justify-between">
        <span className="text-[8px] md:text-xs text-white/50">Total emissions</span>
        <span className="text-[9px] md:text-sm font-extrabold text-white">12 847 tCO2e</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ACTIONS – Plan d'action IA
   ═══════════════════════════════════════════ */
function ActionsScreen() {
  return (
    <div className="p-2.5 md:p-4 h-full flex flex-col gap-2 md:gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] md:text-sm font-bold text-white">Plan d&apos;Action IA</div>
          <div className="text-[7px] md:text-[10px] text-white/40">Recommandations NEURAL · Par impact</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] md:text-sm font-extrabold text-green-400">-1 850 tCO2e</div>
          <div className="text-[6px] md:text-[9px] text-white/40">impact estime</div>
        </div>
      </div>

      <div className="flex-1 space-y-1 md:space-y-1.5 min-h-0">
        {ACTIONS_DATA.map((a, i) => (
          <motion.div
            key={a.text}
            className="bg-white/5 border border-white/10 rounded-lg p-2 md:p-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-[8px] md:text-xs font-semibold text-white">{a.text}</div>
                <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 md:mt-1">
                  <span className="text-[7px] md:text-[10px] font-bold text-green-400">{a.impact}</span>
                  <span
                    className="text-[6px] md:text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: `${a.color}20`, color: a.color }}
                  >
                    {a.priority}
                  </span>
                  <span className="text-[6px] md:text-[9px] text-white/30">{a.status}</span>
                </div>
              </div>
            </div>
            <div className="mt-1.5 md:mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-green-500/60"
                initial={{ width: 0 }}
                animate={{ width: `${a.progress}%` }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   RAPPORTS – Rapports CSRD
   ═══════════════════════════════════════════ */
function RapportsScreen() {
  return (
    <div className="p-2.5 md:p-4 h-full flex flex-col gap-2 md:gap-3">
      <div>
        <div className="text-[10px] md:text-sm font-bold text-white">Rapports CSRD</div>
        <div className="text-[7px] md:text-[10px] text-white/40">Generation automatique · Conformite reglementaire</div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 md:gap-2 flex-1 min-h-0">
        {RAPPORTS_DATA.map((r, i) => (
          <motion.div
            key={r.name}
            className="bg-white/5 border border-white/10 rounded-lg p-2 md:p-3 flex flex-col justify-between"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5 md:mb-2">
                <span className="text-[8px] md:text-xs font-semibold text-white">{r.name}</span>
                <span
                  className="text-[6px] md:text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{
                    background: r.progress === 100 ? "rgba(22,163,74,0.2)" : "rgba(234,88,12,0.2)",
                    color: r.progress === 100 ? "#16a34a" : "#ea580c",
                  }}
                >
                  {r.status}
                </span>
              </div>
              <div className="text-[6px] md:text-[9px] text-white/30">{r.date}</div>
            </div>
            <div className="mt-1.5 md:mt-2">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: r.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${r.progress}%` }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                />
              </div>
              <div className="text-[6px] md:text-[9px] text-white/30 mt-0.5 text-right">{r.progress}%</div>
            </div>
            {r.progress === 100 && (
              <div className="flex gap-1 mt-1">
                <span className="text-[5px] md:text-[8px] px-1.5 py-0.5 rounded bg-green-600/20 text-green-400 font-bold border border-green-500/30 cursor-pointer">PDF</span>
                <span className="text-[5px] md:text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10 cursor-pointer">Excel</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN RENDERER with animated transitions
   ═══════════════════════════════════════════ */
export function MockupScreen({ activeScreen }: { activeScreen: ScreenId }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeScreen}
        className="h-full"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={screenTransition}
      >
        {activeScreen === "overview" && <OverviewScreen />}
        {activeScreen === "scopes" && <ScopesScreen />}
        {activeScreen === "kpis" && <KpisScreen />}
        {activeScreen === "postes" && <PostesScreen />}
        {activeScreen === "actions" && <ActionsScreen />}
        {activeScreen === "rapports" && <RapportsScreen />}
      </motion.div>
    </AnimatePresence>
  );
}
