import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/sidebar";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Finance Platform",
    default: "Finance Platform — Simulateurs Professionnels",
  },
  description:
    "Plateforme de simulateurs financiers : cyber, Pilier 2, M&A, crédit, consolidation IFRS, défense, patrimoine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * data-theme="dark" → dark mode by default (finance/dashboard surface).
     * Toggle by setting data-theme="light" on this element from a client
     * component — e.g. document.documentElement.dataset.theme = "light".
     */
    <html lang="fr" data-theme="dark" className={`h-full antialiased ${playfair.variable} ${inter.variable}`}>
      <head />
      {/*
       * h-screen + overflow-hidden → sidebar + scrollable main column.
       * pt-14 on main → clears the fixed mobile top bar (h-14 = 56px).
       * lg:pt-0 → no offset on desktop where the bar is hidden.
       */}
      <body className="h-screen flex overflow-hidden bg-zinc-950 text-white">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          {children}
        </main>
      </body>
    </html>
  );
}
