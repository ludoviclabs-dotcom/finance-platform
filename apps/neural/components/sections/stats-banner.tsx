const stats = [
  { value: "168", label: "Agents spécialisés" },
  { value: "42", label: "Combinaisons secteur × branche" },
  { value: "7", label: "Branches métier couvertes" },
  { value: "6", label: "Secteurs d'expertise" },
];

export function StatsBanner() {
  return (
    <section className="border-y border-border bg-surface py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="kpi-value text-neural-violet">{stat.value}</p>
            <p className="mt-2 text-sm text-foreground-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
