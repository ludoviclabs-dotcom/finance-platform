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
    <footer className="border-t border-border bg-neural-midnight text-gray-400">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-display text-sm font-semibold tracking-wider text-white">
                {category}
              </h3>
              <ul className="mt-4 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-neural-violet">
              <span className="text-xs font-bold text-white">N</span>
            </div>
            <span className="font-display text-sm font-semibold text-white">
              NEURAL AI Consulting
            </span>
          </div>
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} NEURAL AI Consulting SAS. Tous
            droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
