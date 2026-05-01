import type { Metadata } from "next";
import { Inter, Space_Grotesk, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { CookieBanner } from "@/components/cookie-banner";
import { THEME_INIT_SCRIPT } from "@/components/ui/theme-toggle";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://carbonco.fr"),
  title: {
    default: "CarbonCo — Plateforme de pilotage ESG & CSRD augmentée par l'IA",
    template: "%s | CarbonCo",
  },
  description:
    "Automatisez votre conformité ESRS, centralisez vos données extra-financières " +
    "et générez vos rapports ESG en quelques clics. Hébergé sur infrastructure EU.",
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
    url: "https://carbonco.fr",
    siteName: "CarbonCo",
    title: "CarbonCo — Plateforme de pilotage ESG & CSRD augmentée par l'IA",
    description:
      "Automatisez votre conformité ESRS, centralisez vos données extra-financières " +
      "et générez vos rapports ESG en quelques clics. Hébergé sur infrastructure EU.",
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
    canonical: "https://carbonco.fr",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${manrope.variable}`}
    >
      <head>
        {/* Applique le thème stocké avant la première peinture pour éviter le flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
      </body>
    </html>
  );
}
