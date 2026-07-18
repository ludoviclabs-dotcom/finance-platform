/**
 * LicenseWarning — restitue l'état de licence d'une source (PR-04).
 *
 * Jamais un booléen nu : la décision de licence est structurée (raisons +
 * avertissements), reprise telle quelle de `license_policy.evaluate` côté API.
 * Badge LICENSED (ok) / BLOCKED (anomalie) + détail des raisons.
 */

interface Props {
  licenseOk: boolean;
  allowDisplay?: boolean;
  allowDerivedUse?: boolean;
  reasons?: string[];
  warnings?: string[];
  className?: string;
}

export function LicenseWarning({
  licenseOk,
  allowDisplay,
  allowDerivedUse,
  reasons = [],
  warnings = [],
  className = "",
}: Props) {
  const hasDetail = reasons.length > 0 || warnings.length > 0;
  return (
    <div className={className}>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            licenseOk
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
              : "bg-rose-500/10 text-rose-300 border-rose-500/30"
          }`}
          data-testid="license-badge"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${licenseOk ? "bg-emerald-400" : "bg-rose-400"}`} />
          {licenseOk ? "Licence OK" : "Licence bloquée"}
        </span>
        {allowDisplay != null && (
          <span className="text-[10px] text-zinc-500">
            Affichage : {allowDisplay ? "autorisé" : "interdit"}
          </span>
        )}
        {allowDerivedUse != null && (
          <span className="text-[10px] text-zinc-500">
            Usage dérivé : {allowDerivedUse ? "autorisé" : "réservé"}
          </span>
        )}
      </div>
      {hasDetail && (
        <ul className="mt-2 space-y-1">
          {reasons.map((r, i) => (
            <li key={`r-${i}`} className="text-[11px] text-rose-300/90 flex gap-1.5">
              <span aria-hidden>✕</span>
              <span>{r}</span>
            </li>
          ))}
          {warnings.map((w, i) => (
            <li key={`w-${i}`} className="text-[11px] text-amber-300/90 flex gap-1.5">
              <span aria-hidden>⚠</span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LicenseWarning;
