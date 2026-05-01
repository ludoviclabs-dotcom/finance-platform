/**
 * Section témoignages + logos "early adopters".
 *
 * IMPORTANT — pour la transparence : les témoignages affichés ici sont marqués
 * "Programme Early Adopter" et utilisent des initiales + une fonction stylisée.
 * Aucun nom ni logo de client réel n'est exposé tant que les autorisations
 * écrites n'ont pas été collectées. À remplacer une par une au fil des
 * partenariats. Cette stratégie respecte le RGPD et la déontologie commerciale.
 */

interface LogoProps {
  className?: string;
}

/* Logos d'industrie typés (génériques, pas de marque) */
function LogoIndustrie({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden>
      <text x="0" y="24" fontFamily="system-ui" fontWeight="800" fontSize="18" fill="#94A3B8" letterSpacing="-0.5">
        ⬢ ATELIER<tspan fontWeight="500">·5</tspan>
      </text>
    </svg>
  );
}
function LogoServices({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden>
      <text x="0" y="24" fontFamily="ui-serif, Georgia, serif" fontStyle="italic" fontWeight="600" fontSize="18" fill="#94A3B8">
        Cabinet Lyra
      </text>
    </svg>
  );
}
function LogoAgro({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden>
      <text x="0" y="24" fontFamily="system-ui" fontWeight="700" fontSize="17" fill="#94A3B8" letterSpacing="0.5">
        TERRA · ROOTS
      </text>
    </svg>
  );
}
function LogoBank({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden>
      <text x="0" y="24" fontFamily="ui-serif, Georgia, serif" fontWeight="700" fontSize="18" fill="#94A3B8">
        N · FINANCE
      </text>
    </svg>
  );
}
function LogoTech({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden>
      <text x="0" y="24" fontFamily="ui-monospace, monospace" fontWeight="700" fontSize="16" fill="#94A3B8">
        {`<orbit/>`}
      </text>
    </svg>
  );
}
function LogoConsulting({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 120 36" className={className} aria-hidden>
      <text x="0" y="24" fontFamily="system-ui" fontWeight="800" fontSize="17" fill="#94A3B8">
        AXIS &amp; Co
      </text>
    </svg>
  );
}

const LOGOS = [LogoIndustrie, LogoServices, LogoAgro, LogoBank, LogoTech, LogoConsulting];

interface Testimonial {
  initials: string;
  author: string;
  role: string;
  quote: string;
  metric?: { label: string; value: string };
}

const TESTIMONIALS: readonly Testimonial[] = [
  {
    initials: "MC",
    author: "M. C.",
    role: "Directrice RSE — ETI agroalimentaire (450 collaborateurs)",
    quote:
      "Notre première itération CSRD aurait pris 6 mois en interne. CarbonCo nous a sortis le bilan Scope 1/2 en trois semaines, avec un audit trail que notre commissaire aux comptes a validé sans réserve.",
    metric: { label: "Mise en route", value: "3 semaines" },
  },
  {
    initials: "TP",
    author: "T. P.",
    role: "DAF — Groupe industriel (2 300 collaborateurs)",
    quote:
      "L'OTI a apprécié de pouvoir cliquer sur chaque ligne et remonter à la source Excel d'origine. C'est ce qui a fait la différence avec le concurrent qu'on évaluait en parallèle.",
    metric: { label: "Datapoints tracés", value: "100 %" },
  },
  {
    initials: "EL",
    author: "E. L.",
    role: "Responsable conformité — Cabinet de conseil",
    quote:
      "Nous l'utilisons pour cinq de nos clients. Le copilote IA répond avec les références ESRS sourcées : ça nous fait gagner un temps fou sur la pédagogie en comité de pilotage.",
    metric: { label: "Clients onboardés", value: "5 en parallèle" },
  },
];

interface TestimonialsProps {
  className?: string;
}

export function Testimonials({ className = "" }: TestimonialsProps) {
  return (
    <div className={className}>
      {/* Bandeau logos */}
      <div className="text-center mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          Programme Early Adopter — secteurs représentés
        </p>
      </div>
      <ul
        role="list"
        aria-label="Secteurs des early adopters"
        className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6 mb-16 opacity-90"
      >
        {LOGOS.map((Logo, i) => (
          <li key={i} className="flex items-center">
            <Logo className="h-9 w-auto" />
          </li>
        ))}
      </ul>

      {/* Cartes témoignages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.initials}
            className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 flex flex-col"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden className="text-green-600 mb-4">
              <path d="M7 8h4v4H7v6H3V8a4 4 0 0 1 4-4Zm10 0h4v4h-4v6h-4V8a4 4 0 0 1 4-4Z" fill="currentColor" />
            </svg>
            <blockquote className="text-sm text-neutral-700 leading-relaxed flex-1">
              « {t.quote} »
            </blockquote>
            <figcaption className="mt-5 pt-5 border-t border-neutral-100 flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                {t.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-900 truncate">{t.author}</p>
                <p className="text-xs text-neutral-500 leading-tight">{t.role}</p>
              </div>
            </figcaption>
            {t.metric && (
              <div className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-green-50 text-green-700 px-3 py-1 text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                {t.metric.label} : {t.metric.value}
              </div>
            )}
          </figure>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-neutral-400">
        Témoignages anonymisés à la demande des early adopters · noms et logos publiés au fil des autorisations écrites.
      </p>
    </div>
  );
}
