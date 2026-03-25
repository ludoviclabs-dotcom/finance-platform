import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const forfaits = [
  {
    name: "Starter",
    subtitle: "AI Essentials",
    price: "290 – 1 290",
    users: "1–50 users",
    features: ["1-2 branches", "Agents pré-configurés", "Support email", "Dashboard basique"],
    highlighted: false,
  },
  {
    name: "Business",
    subtitle: "AI Accelerator",
    price: "4 900 – 16 500",
    users: "50–500 users",
    features: ["3-4 branches", "Agents customisés", "Support prioritaire", "Analytics avancés"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    subtitle: "AI Transformation",
    price: "35 000 – 110 000",
    users: "500–5 000 users",
    features: ["5-7 branches", "Agents sur mesure", "CSM dédié", "SLA 99.9%"],
    highlighted: false,
  },
];

export function PricingPreview() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">
            Des forfaits adaptés à votre ambition
          </h2>
          <p className="mt-4 text-lg text-foreground-muted">
            Du POC à la transformation complète
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {forfaits.map((f) => (
            <div
              key={f.name}
              className={`card relative p-8 ${
                f.highlighted
                  ? "border-2 border-neural-violet shadow-lg"
                  : ""
              }`}
            >
              {f.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neural-violet px-4 py-1 text-xs font-semibold text-white">
                  Populaire
                </div>
              )}
              <h3 className="font-display text-xl font-bold">{f.name}</h3>
              <p className="text-sm text-foreground-muted">{f.subtitle}</p>
              <p className="mt-4">
                <span className="tabnum text-3xl font-bold text-neural-violet">
                  {f.price}
                </span>
                <span className="text-sm text-foreground-muted"> &euro;/mois</span>
              </p>
              <p className="text-xs text-foreground-subtle">{f.users}</p>
              <ul className="mt-6 space-y-3">
                {f.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-neural-green" />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link
                href="/forfaits"
                className="mt-8 flex items-center justify-center rounded-lg border border-neural-violet px-6 py-2.5 text-sm font-semibold text-neural-violet transition-colors hover:bg-neural-violet hover:text-white"
              >
                En savoir plus
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/forfaits/simulateur"
            className="inline-flex items-center gap-2 text-sm font-medium text-neural-violet hover:underline"
          >
            Simuler mon prix personnalisé
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
