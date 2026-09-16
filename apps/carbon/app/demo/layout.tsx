// Layout de la démo cinématique /demo (composant serveur).
// Conteneur plein écran sombre superposé au reste de l'application.
// Ne ré-importe PAS globals.css : déjà chargé par le root layout (app/layout.tsx).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Démo Carbon&Co — 100 secondes pour comprendre",
  description:
    "Démonstration interactive : du tableur au rapport ESRS auditable, traçable jusqu'à la cellule source.",
  // Page non indexable : scène de démo, hors arborescence SEO publique.
  robots: { index: false, follow: false },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Scène plein écran : fixée, fond sombre #070909, texte blanc.
    // zIndex 60 pour passer au-dessus du chrome applicatif.
    // Le padding bas réserve la hauteur de la bannière cookies tant qu'elle
    // est affichée : la fin de la scène défile au-dessus d'elle (QA m-06).
    <div
      className="fixed inset-0 overflow-y-auto bg-[#070909] text-white"
      style={{ zIndex: 60, paddingBottom: "var(--cookie-banner-offset, 0px)" }}
    >
      {children}
    </div>
  );
}
