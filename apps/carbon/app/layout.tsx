import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://carbonco.fr"),
  title: {
    default: "CarbonCo — Pilotage ESG & CSRD pour l'Entreprise",
    template: "%s | CarbonCo",
  },
  description:
    "CarbonCo est la plateforme SaaS B2B de pilotage ESG. " +
    "Collectez, analysez et reportez vos données extra-financières. " +
    "Conformité ESRS, Taxonomie, Scope 3, CBAM. Copilote IA intégré.",
  keywords: [
    "ESG",
    "CSRD",
    "ESRS",
    "empreinte carbone",
    "reporting extra-financier",
    "Scope 3",
    "Taxonomie verte",
    "CBAM",
    "RSE",
    "SaaS B2B",
  ],
  authors: [{ name: "CarbonCo" }],
  creator: "CarbonCo",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://carbonco.fr",
    siteName: "CarbonCo",
    title: "CarbonCo — Pilotage ESG & CSRD pour l'Entreprise",
    description:
      "La plateforme qui transforme votre reporting ESG en avantage concurrentiel. " +
      "ESRS natif, Copilote IA, Audit trail, Scope 3 automatisé.",
  },
  robots: {
    index: true,
    follow: true,
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
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
