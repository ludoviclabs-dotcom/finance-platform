import Link from "next/link";
import { Leaf } from "lucide-react";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold tracking-tight">CarbonCo</span>
          </Link>
          <Link
            href="/login"
            className="text-xs text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">{title}</h1>
        <p className="text-xs text-[var(--color-foreground-muted)] mb-10">
          Dernière mise à jour : {lastUpdated}
        </p>
        <div className="prose prose-invert max-w-none space-y-6 text-sm leading-relaxed text-[var(--color-foreground-muted)]">
          {children}
        </div>
      </main>

      <footer className="border-t border-[var(--color-border)] mt-16">
        <div className="max-w-3xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-foreground-muted)]">
          <span>© {new Date().getFullYear()} CarbonCo — Plateforme ESG &amp; CSRD</span>
          <nav className="flex flex-wrap gap-4">
            <Link href="/mentions-legales" className="hover:text-[var(--color-foreground)]">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="hover:text-[var(--color-foreground)]">
              Confidentialité
            </Link>
            <Link href="/cookies" className="hover:text-[var(--color-foreground)]">
              Cookies
            </Link>
            <Link href="/cgu" className="hover:text-[var(--color-foreground)]">
              CGU
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-base font-semibold text-[var(--color-foreground)] mb-2 mt-6">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
