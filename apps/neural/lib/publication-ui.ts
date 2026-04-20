const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MONTH_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

type PublicationTheme = {
  badge: string;
  panel: string;
  accent: string;
  line: string;
  glow: string;
};

const DEFAULT_THEME: PublicationTheme = {
  badge: "border-white/12 bg-white/6 text-white/75",
  panel: "border-white/10 bg-white/[0.04] text-white/75",
  accent: "text-white",
  line: "from-white/35 to-white/5",
  glow: "from-white/10 via-white/4 to-transparent",
};

const PUBLICATION_THEMES: Record<string, PublicationTheme> = {
  Benchmark: {
    badge: "border-emerald-400/25 bg-emerald-400/12 text-emerald-200",
    panel: "border-emerald-400/18 bg-emerald-400/8 text-emerald-100",
    accent: "text-emerald-300",
    line: "from-emerald-300/65 to-emerald-300/10",
    glow: "from-emerald-400/18 via-emerald-400/6 to-transparent",
  },
  Guide: {
    badge: "border-violet-400/25 bg-violet-400/12 text-violet-200",
    panel: "border-violet-400/18 bg-violet-400/8 text-violet-100",
    accent: "text-violet-300",
    line: "from-violet-300/65 to-violet-300/10",
    glow: "from-violet-400/18 via-violet-400/6 to-transparent",
  },
  Analyse: {
    badge: "border-cyan-400/25 bg-cyan-400/12 text-cyan-200",
    panel: "border-cyan-400/18 bg-cyan-400/8 text-cyan-100",
    accent: "text-cyan-300",
    line: "from-cyan-300/65 to-cyan-300/10",
    glow: "from-cyan-400/18 via-cyan-400/6 to-transparent",
  },
  "Case Study": {
    badge: "border-amber-400/25 bg-amber-400/12 text-amber-200",
    panel: "border-amber-400/18 bg-amber-400/8 text-amber-100",
    accent: "text-amber-300",
    line: "from-amber-300/65 to-amber-300/10",
    glow: "from-amber-400/18 via-amber-400/6 to-transparent",
  },
  Perspective: {
    badge: "border-rose-400/25 bg-rose-400/12 text-rose-200",
    panel: "border-rose-400/18 bg-rose-400/8 text-rose-100",
    accent: "text-rose-300",
    line: "from-rose-300/65 to-rose-300/10",
    glow: "from-rose-400/18 via-rose-400/6 to-transparent",
  },
};

function toSafeDate(dateValue: string): Date {
  return new Date(`${dateValue}T12:00:00.000Z`);
}

function capitalizeFirst(text: string): string {
  if (text.length === 0) {
    return text;
  }

  return text[0].toUpperCase() + text.slice(1);
}

export function formatPublicationDate(dateValue: string): string {
  return capitalizeFirst(LONG_DATE_FORMATTER.format(toSafeDate(dateValue)));
}

export function formatPublicationMonth(dateValue: string): string {
  return capitalizeFirst(MONTH_DATE_FORMATTER.format(toSafeDate(dateValue)));
}

export function getPublicationTheme(category: string): PublicationTheme {
  return PUBLICATION_THEMES[category] ?? DEFAULT_THEME;
}

export function getAuthorInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "N";
}
