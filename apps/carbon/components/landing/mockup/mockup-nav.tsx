"use client";

import { motion } from "framer-motion";
import { LayoutDashboard, BarChart3, PieChart, Layers, Sparkles, FileText } from "lucide-react";
import type { ScreenId } from "./mockup-data";

const NAV_ITEMS: { id: ScreenId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "kpis", label: "KPIs", icon: BarChart3 },
  { id: "scopes", label: "Scopes", icon: PieChart },
  { id: "postes", label: "Postes", icon: Layers },
  { id: "actions", label: "Actions", icon: Sparkles },
  { id: "rapports", label: "Rapports", icon: FileText },
];

export function MockupNav({
  activeScreen,
  onNavigate,
}: {
  activeScreen: ScreenId;
  onNavigate: (id: ScreenId) => void;
}) {
  return (
    <div className="flex flex-col w-[48px] md:w-[54px] bg-white/[0.03] border-r border-white/[0.06] py-2 gap-0.5 flex-shrink-0">
      {/* Brand mark */}
      <div className="flex items-center justify-center mb-2 pb-2 border-b border-white/[0.06]">
        <div className="w-5 h-5 md:w-6 md:h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
          <span className="text-[8px] md:text-[9px] font-extrabold text-white">C</span>
        </div>
      </div>

      {NAV_ITEMS.map((item) => {
        const isActive = activeScreen === item.id;
        const Icon = item.icon;
        return (
          <motion.button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="relative flex flex-col items-center gap-0.5 py-1.5 px-1 mx-1 rounded-lg cursor-pointer border-0 bg-transparent"
            whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            whileTap={{ scale: 0.95 }}
          >
            {isActive && (
              <motion.div
                layoutId="mockup-nav-indicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full"
                style={{ background: "#16a34a" }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <Icon
              size={14}
              strokeWidth={isActive ? 2 : 1.5}
              className="md:w-4 md:h-4"
              style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.35)" }}
            />
            <span
              className="text-[6px] md:text-[7px] font-medium leading-none"
              style={{ color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
