import { envReport } from "@/lib/env";
import { getAiGatewayAuthMode, getAiGatewayAuthLabel, getAiSurfaceReadiness } from "@/lib/ai/router";

export default function SettingsPage() {
  const report = envReport();
  const authMode = getAiGatewayAuthMode();
  const surfaces = getAiSurfaceReadiness();

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Paramètres</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          État des capacités runtime et des surfaces IA configurées.
        </p>
      </header>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Auth IA
        </h2>
        <p className="mt-2 rounded border border-[color:var(--border)] px-3 py-2 text-sm">
          <span className="font-mono text-xs">{authMode}</span> — {getAiGatewayAuthLabel(authMode)}
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Surfaces IA
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          {surfaces.map((s) => (
            <li
              key={s.id}
              className="rounded border border-[color:var(--border)] px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.label}</span>
                <span className="font-mono text-xs text-[color:var(--muted)]">{s.id}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-[color:var(--muted)]">
                {s.primaryModel} → fallback: {s.fallbackModels.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          Capacités
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {Object.entries(report).map(([key, ready]) => (
            <li
              key={key}
              className="flex items-center justify-between rounded border border-[color:var(--border)] px-3 py-2"
            >
              <span className="font-mono text-xs">{key}</span>
              <span className={ready ? "text-emerald-400" : "text-[color:var(--muted)]"}>
                {ready ? "actif" : "désactivé"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
