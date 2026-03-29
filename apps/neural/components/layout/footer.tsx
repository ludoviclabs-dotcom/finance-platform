import Link from "next/link";

const footerLinks = {
  Solutions: [
    { label: "Systèmes d'Information", href: "/solutions/si" },
    { label: "Ressources Humaines", href: "/solutions/rh" },
    { label: "Marketing", href: "/solutions/marketing" },
    { label: "Communication", href: "/solutions/communication" },
    { label: "Comptabilité", href: "/solutions/comptabilite" },
    { label: "Finance", href: "/solutions/finance" },
    { label: "Supply Chain", href: "/solutions/supply-chain" },
  ],
  Secteurs: [
    { label: "Transport", href: "/secteurs/transport" },
    { label: "Luxe", href: "/secteurs/luxe" },
    { label: "Aéronautique", href: "/secteurs/aeronautique" },
    { label: "SaaS", href: "/secteurs/saas" },
    { label: "Banque", href: "/secteurs/banque" },
    { label: "Assurance", href: "/secteurs/assurance" },
  ],
  Ressources: [
    { label: "Blog", href: "/resources/blog" },
    { label: "Études de cas", href: "/resources/case-studies" },
    { label: "White Papers", href: "/resources/white-papers" },
    { label: "Calculateur ROI", href: "/resources/outils/roi" },
    { label: "Audit maturité IA", href: "/resources/outils/maturity-score" },
  ],
  Entreprise: [
    { label: "À propos", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Forfaits", href: "/forfaits" },
    { label: "Mentions légales", href: "/legal" },
    { label: "Confidentialité", href: "/legal/confidentialite" },
  ],
};

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-neural-midnight text-gray-400 overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute left-1/2 -top-32 -translate-x-1/2 h-64 w-[800px] rounded-full bg-neural-violet/5 blur-[120px]" />

      <div className="relative mx-auto max-w-[1440px] px-8 py-16 md:px-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-display text-xs font-bold tracking-widest uppercase text-white/80">
                {category}
              </h3>
              <ul className="mt-5 space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neural-violet shadow-lg shadow-neural-violet/15">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="font-display text-sm font-bold tracking-tight text-white">
              NEURAL AI Consulting
            </span>
          </div>
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} NEURAL AI Consulting SAS. Tous
            droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
