/**
 * CategoryChip — chip pour une catégorie roadmap, cliquable pour filtrage.
 */

const COLOR_CLASSES: Record<string, { active: string; inactive: string }> = {
  violet: {
    active: "border-violet-400/40 bg-violet-400/[0.16] text-violet-100",
    inactive: "border-violet-400/20 bg-violet-400/[0.06] text-violet-300/80",
  },
  emerald: {
    active: "border-emerald-400/40 bg-emerald-400/[0.16] text-emerald-100",
    inactive: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300/80",
  },
  cyan: {
    active: "border-cyan-400/40 bg-cyan-400/[0.16] text-cyan-100",
    inactive: "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300/80",
  },
  amber: {
    active: "border-amber-400/40 bg-amber-400/[0.16] text-amber-100",
    inactive: "border-amber-400/20 bg-amber-400/[0.06] text-amber-300/80",
  },
  rose: {
    active: "border-rose-400/40 bg-rose-400/[0.16] text-rose-100",
    inactive: "border-rose-400/20 bg-rose-400/[0.06] text-rose-300/80",
  },
};

export function CategoryChip({
  label,
  color,
  active = true,
  className = "",
}: {
  label: string;
  color: string;
  active?: boolean;
  className?: string;
}) {
  const cls = COLOR_CLASSES[color] || COLOR_CLASSES["violet"];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        active ? cls.active : cls.inactive
      } ${className}`}
    >
      {label}
    </span>
  );
}
