import { envReport } from "@/lib/env";

export default function DashboardPage() {
  const report = envReport();
  const entries = Object.entries(report);
  const readyCount = entries.filter(([, v]) => v).length;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Article Studio</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Studio éditorial privé source-grounded — pipeline RAG × Claude API.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          État des capacités ({readyCount}/{entries.length})
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
          {entries.map(([key, ready]) => (
            <li
              key={key}
              className="flex items-center justify-between rounded border border-[color:var(--border)] px-3 py-2"
            >
              <span className="font-mono text-xs">{key}</span>
              <span className={ready ? "text-emerald-400" : "text-[color:var(--muted)]"}>
                {ready ? "✓" : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-[color:var(--muted)]">
          Configure les variables manquantes dans <code className="font-mono">.env.local</code> (cf{" "}
          <code className="font-mono">.env.example</code>).
        </p>
      </section>
    </div>
  );
}
