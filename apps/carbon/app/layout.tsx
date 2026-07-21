import type { Metadata } from "next";
import { Inter, Space_Grotesk, Manrope, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastProvider } from "@/components/ui/toast";
import { CookieBanner } from "@/components/cookie-banner";
import { THEME_INIT_SCRIPT } from "@/components/ui/theme-toggle";
import { JsonLd } from "@/components/seo/json-ld";
import { siteUrl, CONTACT_EMAIL } from "@/lib/site-url";
import "./globals.css";

// Organization schema — servi sur toutes les pages via le root layout.
// Référence : https://developers.google.com/search/docs/appearance/structured-data/organization
const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CarbonCo",
  alternateName: "Carbon&Co",
  url: siteUrl(),
  logo: `${siteUrl()}/logo.png`,
  description:
    "Plateforme de pilotage ESG & CSRD augmentée par l'IA. Données métier hébergées en zone UE.",
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: CONTACT_EMAIL,
      availableLanguage: ["French", "English"],
    },
  ],
} as const;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: true,
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  preload: false, // secondary font, non-critical
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false, // used only by /materials's numeric/mono accents
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "CarbonCo — Plateforme de pilotage ESG & CSRD augmentée par l'IA",
    template: "%s | CarbonCo",
  },
  description:
    "Automatisez votre conformité ESRS, centralisez vos données extra-financières " +
    "et générez vos rapports ESG en quelques clics. Données métier en zone UE (Neon Postgres).",
  keywords: [
    "ESG",
    "CSRD",
    "ESRS",
    "empreinte carbone",
    "reporting extra-financier",
    "Scope 1 2 3",
    "Taxonomie verte",
    "CBAM",
    "RSE",
    "SaaS B2B",
    "conformité ESG",
    "pilotage ESG",
    "rapport ESG IA",
  ],
  authors: [{ name: "CarbonCo" }],
  creator: "CarbonCo",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "CarbonCo",
    title: "CarbonCo — Plateforme de pilotage ESG & CSRD augmentée par l'IA",
    description:
      "Automatisez votre conformité ESRS, centralisez vos données extra-financières " +
      "et générez vos rapports ESG en quelques clics. Données métier en zone UE (Neon Postgres).",
    // OG image: served dynamically by app/opengraph-image.tsx (Next.js convention)
  },
  twitter: {
    card: "summary_large_image",
    title: "CarbonCo — Plateforme de pilotage ESG & CSRD augmentée par l'IA",
    description:
      "Automatisez votre conformité ESRS, centralisez vos données extra-financières " +
      "et générez vos rapports ESG en quelques clics.",
    // Twitter image: served dynamically by app/opengraph-image.tsx
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      className={`${inter.variable} ${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
      // `data-theme` est réécrit par THEME_INIT_SCRIPT avant la première peinture
      // (cf. <script> dans <head> ci-dessous) pour respecter la préférence stockée
      // dans localStorage ou `prefers-color-scheme`. Sans `suppressHydrationWarning`,
      // React détecte la différence SSR vs DOM et émet un avertissement d'hydratation.
      // Pattern standard recommandé par Next.js et utilisé par next-themes.
      suppressHydrationWarning
    >
      <head>
        {/* Applique le thème stocké avant la première peinture pour éviter le flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Organization schema — Rich Results Google */}
        <JsonLd data={ORGANIZATION_SCHEMA} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-carbon-emerald focus:text-white focus:text-sm focus:font-medium"
        >
          Aller au contenu principal
        </a>
        <ToastProvider>
          {children}
          <CookieBanner />
        </ToastProvider>
        {/* Vercel Analytics & Speed Insights — Core Web Vitals + events */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
