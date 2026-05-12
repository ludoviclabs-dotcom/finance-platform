import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confidentialité | NEURAL",
  description:
    "Données collectées, finalités, durées, sous-traitants et droits liés au site NEURAL.",
};

const sections = [
  {
    title: "Données collectées",
    body: [
      "Formulaire de contact: nom, email, société, besoin, contexte et téléphone optionnel.",
      "Newsletter: email uniquement. À ce stade, la préinscription est non persistée dans une liste marketing automatisée.",
      "Données techniques: journaux serveur Vercel et informations nécessaires au fonctionnement du site.",
    ],
  },
  {
    title: "Finalités",
    body: [
      "Répondre aux demandes entrantes, cadrer un pilote, améliorer la robustesse du site et documenter les preuves produit.",
      "Aucune prospection automatisée, aucun retargeting publicitaire et aucune revente de données ne sont prévus.",
    ],
  },
  {
    title: "Sous-traitants et hébergement",
    body: [
      "Vercel héberge l'application. Resend peut être utilisé pour acheminer les messages du formulaire de contact si RESEND_API_KEY est configuré.",
      "Les éventuels fournisseurs IA, base de données ou observabilité ne doivent être utilisés que si leurs variables d'environnement sont configurées.",
    ],
  },
  {
    title: "Durée de conservation",
    body: [
      "Demandes de contact: durée limitée au traitement de la demande et au suivi commercial raisonnable.",
      "Newsletter: aucune conservation durable n'est annoncée tant que l'intégration d'opt-in n'est pas branchée.",
      "Journaux techniques: selon la durée de conservation des services d'hébergement et d'observabilité configurés.",
    ],
  },
  {
    title: "Droits",
    body: [
      "Vous pouvez demander l'accès, la rectification ou la suppression des informations vous concernant.",
      "Contact: ludoviclabs@gmail.com.",
    ],
  },
  {
    title: "Cookies et embeds",
    body: [
      "Le site n'affiche pas d'embed Cal.com public tant qu'un slug valide et vérifié n'est pas configuré.",
      "Aucun cookie publicitaire n'est revendiqué. Tout futur outil d'analytics ou d'embed devra être documenté ici.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-neural px-6 pb-16 pt-32 text-white md:px-12">
      <section className="mx-auto max-w-4xl rounded-[28px] border border-white/10 bg-white/[0.04] p-8 md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
          Données personnelles
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
          Politique de confidentialité
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/68">
          Cette politique décrit le fonctionnement actuel du site NEURAL. Elle
          devra être mise à jour avant tout déploiement client, collecte enrichie
          ou intégration d'outils marketing persistants.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-relaxed text-white/70">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-2xl font-bold text-white">
                {section.title}
              </h2>
              <div className="mt-2 space-y-2">
                {section.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
