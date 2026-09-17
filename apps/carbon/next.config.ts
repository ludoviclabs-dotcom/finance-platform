import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    /*
      Cache disque de build Turbopack désactivé (actif par défaut dans
      Next 16.3.5). Relu depuis `.next/cache`, que Vercel restaure d'un
      déploiement à l'autre, il ressert une ancienne version de
      `app/globals.css` : la PR #185 est partie en production sans aucune
      règle de la peau « Industry » de /materials, alors que les utilitaires
      Tailwind des nouveaux composants, eux, étaient bien générés.

      Reproduit en local avec Next 16.3.5 : un build sans cache contient les
      règles ; un build qui reprend le cache d'un build antérieur ne les
      contient pas, et le build suivant non plus — l'écart ne se résorbe pas
      tout seul. À réactiver seulement quand un build repris du cache
      reflète une modification de globals.css.
    */
    turbopackFileSystemCacheForBuild: false,
  },
  async redirects() {
    return [
      // Guide renommé après l'Omnibus (T0.3.5) — préserve le SEO de l'ancienne URL.
      {
        source: "/guide-csrd-2027",
        destination: "/guide-csrd-vsme-2026",
        permanent: true,
      },
      /*
        La vitrine hydrique publique a quitté `/water-intelligence` pour
        `/water` (Phase A). L'ancienne URL était indexable, déclarée au
        sitemap et liée depuis la navigation publique, le pied de page et la
        section « Intelligence environnementale » : la laisser en 404 aurait
        cassé des liens réellement publiés.

        `permanent: true` — donc 308, qui préserve la méthode HTTP là où un 301
        autorise les intermédiaires à transformer un POST en GET. La
        destination est une page publique en lecture seule, mais le choix ne
        dépend pas de ce qu'on y fait aujourd'hui.

        La redirection ne concerne QUE le chemin de page du frontend. Le
        préfixe HTTP `/water-intelligence` du backend
        (`apps/api/routers/water_intelligence.py`) est servi par une autre
        application, sur un autre domaine, et n'est pas touché.
      */
      {
        source: "/water-intelligence",
        destination: "/water",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
