/**
 * DataStatusBadge — pastille de qualité d'une donnée affichée.
 *
 * Vocabulaire stable (voir PLAN_ACTION Intelligence, §17) :
 *   VERIFIED · ESTIMATED · MANUAL · STALE
 *
 * Contrairement à FeatureStatusBadge (statut PRODUIT, thème clair), ce badge
 * qualifie une VALEUR de donnée et est stylé pour les surfaces sombres du
 * module /materials. Il ne code aucune logique : on lui passe l'état résolu.
 */

export type DataStatus = "VERIFIED" | "ESTIMATED" | "MANUAL" | "STALE";

const STATUS_CONFIG: Record<DataStatus, { cls: string; dot: string; label: string; help: string }> = {
  VERIFIED: {
    cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
    label: "Vérifié",
    help: "Valeur issue d'une source vérifiée et datée.",
  },
  ESTIMATED: {
    cls: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
    label: "Estimé",
    help: "Valeur estimée à partir de repères publics — non vérifiée, non normative.",
  },
  MANUAL: {
    cls: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
    label: "Saisie manuelle",
    help: "Valeur saisie manuellement, sans source automatisée.",
  },
  STALE: {
    cls: "bg-zinc-500/10 text-zinc-300 border-zinc-500/30",
    dot: "bg-zinc-400",
    label: "Périmé",
    help: "Snapshot ancien — la valeur peut ne plus refléter la réalité.",
  },
};

/** Mappe une valeur `data_quality` du dataset vers un état de badge. */
export function statusFromQuality(q: "verified" | "estimated" | "manual"): DataStatus {
  return q === "verified" ? "VERIFIED" : q === "manual" ? "MANUAL" : "ESTIMATED";
}

/**
 * Mapping UNIQUE `data_status` backend → badge front (WAVE_2_INTERFACE_CONTRACTS §2).
 *
 * Le vocabulaire backend (`verified/estimated/manual/inferred`) ne coïncide pas
 * avec le vocabulaire badge (`VERIFIED/ESTIMATED/MANUAL/STALE`) :
 *   - `inferred` n'a pas de badge dédié → affiché `ESTIMATED` (libellé « Inféré »
 *     à porter côté appelant via la prop `label`) ;
 *   - `STALE` est un état DÉRIVÉ (fraîcheur), jamais une valeur backend :
 *     `isStale=true` force `STALE`, quel que soit le `data_status`.
 * Centralisé ici pour ne pas disperser la logique entre modules Wave 2.
 */
export function dataStatusToBadge(
  dataStatus: "verified" | "estimated" | "manual" | "inferred",
  isStale = false,
): DataStatus {
  if (isStale) return "STALE";
  if (dataStatus === "verified") return "VERIFIED";
  if (dataStatus === "manual") return "MANUAL";
  return "ESTIMATED"; // estimated + inferred
}

interface Props {
  status: DataStatus;
  /** Texte optionnel remplaçant le libellé par défaut (ex. « Estimation snapshot »). */
  label?: string;
  size?: "xs" | "sm";
  className?: string;
}

export function DataStatusBadge({ status, label, size = "xs", className = "" }: Props) {
  const { cls, dot, label: defaultLabel, help } = STATUS_CONFIG[status];
  const text = label ?? defaultLabel;
  const sizeCls = size === "xs" ? "text-[10px] px-2 py-0.5 gap-1" : "text-xs px-2.5 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${sizeCls} ${cls} ${className}`}
      title={help}
      aria-label={`Qualité de la donnée : ${text}. ${help}`}
      data-testid={`data-status-badge-${status.toLowerCase()}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
      {text}
    </span>
  );
}
