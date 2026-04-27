import type { Metadata } from "next";
import {
  Inter,
  Instrument_Serif,
  JetBrains_Mono,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { NeuralChatLauncher } from "@/components/chat/neural-chat-launcher";
import { NeuralProvider } from "@/lib/neural-hub/context";
import { SITE_URL } from "@/lib/site-config";
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

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-instrument",
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NEURAL — Framework multi-secteurs pour agents metier",
    template: "%s | NEURAL",
  },
  description:
    "NEURAL expose un framework multi-secteurs avec un sous-ensemble deja live : " +
    "data hub, surfaces Luxe Finance/RH, demo orchestree Transport et page trust explicite.",
  keywords: [
    "IA entreprise",
    "Claude",
    "intelligence artificielle",
    "agent IA",
    "data hub",
    "verticale luxe",
    "demo orchestration",
    "Anthropic",
  ],
  authors: [{ name: "NEURAL AI Consulting" }],
  creator: "NEURAL AI Consulting",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: SITE_URL,
    siteName: "NEURAL",
    title: "NEURAL — Framework multi-secteurs pour agents metier",
    description:
      "Framework multi-secteurs, noyau Luxe deja live, demo orchestree Transport et page trust.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "NEURAL — Framework multi-secteurs pour agents metier",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEURAL — Framework multi-secteurs pour agents metier",
    description: "Noyau Luxe live, demo Transport et statuts publics explicites.",
    images: ["/opengraph-image"],
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${playfair.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Aller au contenu principal
        </a>
        <NeuralProvider>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <NeuralChatLauncher />
        </NeuralProvider>
      </body>
    </html>
  );
}
