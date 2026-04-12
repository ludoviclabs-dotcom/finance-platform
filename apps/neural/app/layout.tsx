import type { Metadata } from "next";
import { Inter, Space_Grotesk, Playfair_Display } from "next/font/google";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { NeuralProvider } from "@/lib/neural-hub/context";
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

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://neural-ai.fr"),
  title: {
    default: "NEURAL — Intelligence Augmentée pour l'Entreprise",
    template: "%s | NEURAL",
  },
  description:
    "NEURAL déploie des agents Claude AI dans vos 7 fonctions métier. " +
    "SI, RH, Marketing, Communication, Comptabilité, Finance, Supply Chain. " +
    "ROI mesuré. 80% des projets IA échouent — pas les nôtres.",
  keywords: [
    "IA entreprise",
    "Claude AI",
    "intelligence artificielle",
    "agent IA",
    "transformation digitale",
    "conseil IA",
    "intégration IA",
    "Anthropic",
    "LLM entreprise",
  ],
  authors: [{ name: "NEURAL AI Consulting" }],
  creator: "NEURAL AI Consulting",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "https://neural-ai.fr",
    siteName: "NEURAL",
    title: "NEURAL — Intelligence Augmentée pour l'Entreprise",
    description:
      "Nous déployons des agents Claude AI qui fonctionnent vraiment. " +
      "ROI mesuré, adoption durable, zéro bullshit.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "NEURAL — Intelligence Augmentée pour l'Entreprise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEURAL — Intelligence Augmentée pour l'Entreprise",
    description:
      "80% des projets IA échouent. Nous faisons partie des 20% qui réussissent.",
    images: ["/images/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${playfair.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-indigo-600 focus:text-white focus:text-sm focus:font-medium"
        >
          Aller au contenu principal
        </a>
        <NeuralProvider>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </div>
        </NeuralProvider>
      </body>
    </html>
  );
}
