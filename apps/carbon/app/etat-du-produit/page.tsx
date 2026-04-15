import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "État du produit — CarbonCo",
  description:
    "Ce que CarbonCo fait aujourd'hui, ce qui est en Beta et ce qui est planifié. Transparence totale sur les fonctionnalités disponibles.",
};

type FeatureStatus = "live" | "beta" | "planned";

type Feature = {
  title: string;
  description: string;
  tag?: string;
};

const STATUS_SECTIONS: Array<{
  status: FeatureStatus;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  features: Feature[];
}> = [
  {
    status: "live",
    label: "🟢 Disponible aujourd'hui",
    subtitle: "Ces fonctionnalités sont en production et utilisables pour un rapport CSRD réel.",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    features: [
      {
        title: "Import workbook Excel + validation automatique",
        description:
          "Chargez votre fichier de collecte de données (modèle CarbonCo fourni). Le système valide la structure, détecte les cellules manquantes et remonte les erreurs avant calcul. Compatible avec les exports ERP les plus courants.",
        tag: "ESRS E1",
      },
      {
        title: "Calcul Scope 1, 2 & 3 — GHG Protocol",
        description:
          "Calcul des émissions carbone selon la méthodologie GHG Protocol avec facteurs ADEME Base Empreinte® intégrés. Couverture Scope 1 (combustion, flotte, réfrigérants), Scope 2 (électricité, chaleur), Scope 3 partiel (achats, transport, déplacements).",
        tag: "ESRS E1",
      },
      {
        title: "Dashboard interactif avec provenance des données",
        description:
          "Visualisation des émissions par scope, par poste et par période. Chaque chiffre affiché est traçable jusqu'à la source (ligne du fichier Excel, facteur d'émission utilisé, date d'import). Graphiques filtrables et comparaison N/N-1.",
      },
      {
        title: "Export PDF rapport CSRD",
        description:
          "Génération d'un rapport PDF structuré selon les exigences de présentation ESRS. Inclut les données quantitatives, les narratifs de contexte et les tableaux de conformité. Prêt pour soumission à un commissaire aux comptes.",
        tag: "ESRS E1 · ESRS 2",
      },
      {
        title: "Export Excel structuré + audit trail",
        description:
          "Export des données de calcul au format Excel avec horodatage, identifiant utilisateur et hash d'intégrité pour chaque ligne. Permet la vérification par un OTI (Organisme Tiers Indépendant).",
      },
      {
        title: "Questionnaire double matérialité — ESRS 2",
        description:
          "Formulaire guidé pour identifier et prioriser les impacts, risques et opportunités matériels selon la double matérialité ESRS. Génère une matrice de matérialité exportable et traçable.",
        tag: "ESRS 2",
      },
      {
        title: "Copilote IA NEURAL — assistant CSRD",
        description:
          "Assistant IA spécialisé en ESRS et CSRD. Répond aux questions sur les obligations de reporting, cite les articles ESRS sources, aide à interpréter les résultats de calcul. Ne calcule pas automatiquement — assiste et explique.",
      },
      {
        title: "Gestion multi-utilisateurs avec rôles",
        description:
          "Création de comptes utilisateurs avec rôles (Admin, Éditeur, Lecteur). Chaque action est tracée dans le journal d'audit avec l'identité de l'auteur. Isolation des données par organisation.",
      },
      {
        title: "Authentification sécurisée JWT + 2FA",
        description:
          "Authentification par email/mot de passe avec tokens JWT signés. Rotation automatique des refresh tokens. Journal de connexion consultable par les administrateurs.",
      },
    ],
  },
  {
    status: "beta",
    label: "🟡 Beta — En cours de stabilisation",
    subtitle: "Fonctionnels et accessibles, mais encore en validation. Des évolutions sont à prévoir.",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    features: [
      {
        title: "Questionnaire fournisseurs Scope 3 amont",
        description:
          "Envoi de questionnaires standardisés aux fournisseurs pour collecter leurs données d'émissions (catégorie 1 et 4 Scope 3). Interface de suivi des réponses et agrégation automatique. Actuellement en test avec les premiers utilisateurs.",
        tag: "ESRS E1 Scope 3",
      },
      {
        title: "Comparaison multi-exercices (snapshots)",
        description:
          "Sauvegarde d'un instantané de vos données à date et comparaison avec les exercices précédents. Fonctionnalité disponible mais l'interface de gestion des versions est en cours d'amélioration.",
      },
      {
        title: "Workflow de validation des données",
        description:
          "Processus formalisé de validation en deux étapes (saisie → proposition → validation responsable). Les données verrouillées ne peuvent plus être modifiées sans justification. Modèle de permissions en cours de finalisation.",
      },
      {
        title: "Collecte données sociales — ESRS S1",
        description:
          "Formulaire de collecte des indicateurs sociaux (effectifs, conditions de travail, égalité, santé-sécurité). Les données sont collectées et exportées en PDF, mais le scoring de conformité ESRS S1 est encore en développement.",
        tag: "ESRS S1",
      },
      {
        title: "Alertes et détection d'anomalies",
        description:
          "Système d'alertes configurables sur seuils d'émissions et écarts vs. exercice précédent. Détection basique d'anomalies par règles. L'algorithme de détection avancée est en cours d'amélioration.",
      },
    ],
  },
  {
    status: "planned",
    label: "⚪ Planifié — Sur la roadmap",
    subtitle: "Ces fonctionnalités sont sur la roadmap mais pas encore développées. Aucune date garantie.",
    color: "text-neutral-500",
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    dot: "bg-neutral-300",
    features: [
      {
        title: "Connecteurs ERP natifs",
        description:
          "Connexions directes aux principaux ERP du marché (SAP ECC/S4HANA, Oracle, Sage, Cegid, Microsoft Dynamics). Synchronisation automatique des données sans manipulation manuelle de fichiers. Priorité SAP si un client industriel le demande.",
        tag: "SAP · Oracle · Sage · Cegid",
      },
      {
        title: "Export iXBRL ESRS",
        description:
          "Format de rapport électronique structuré requis pour la soumission officielle aux autorités (OAM). Nécessite un partenaire certifié (CoreFiling, Parseport, IRIS). Coût estimé 3–8k€/an. Dépend de la traction commerciale.",
      },
      {
        title: "Signature électronique qualifiée eIDAS",
        description:
          "Signature numérique qualifiée sur les rapports CSRD pour valeur probante maximale. Partenaire envisagé : Yousign ou Universign. Déclenchable à partir de la demande client.",
      },
      {
        title: "OCR factures énergie automatisé",
        description:
          "Extraction automatique des données de consommation énergétique depuis les PDF de factures (EDF, Engie, TotalEnergies Électricité, etc.). Éliminerait 80% de la saisie manuelle pour le Scope 2.",
      },
      {
        title: "Modules ESRS E2–E5 complets",
        description:
          "Développement approfondi des standards Pollution (E2), Eau (E3), Biodiversité (E4) et Économie circulaire (E5). Priorité déterminée en fonction des demandes clients. E2 est le suivant dans la queue.",
        tag: "E2 · E3 · E4 · E5",
      },
      {
        title: "Benchmarks anonymisés inter-clients",
        description:
          "Comparaison de vos indicateurs ESRS avec la médiane sectorielle anonymisée. Disponible à partir de 5 clients payants dans le même secteur pour garantir l'anonymat.",
      },
      {
        title: "Certifications sécurité SOC 2 / ISO 27001",
        description:
          "Audits de sécurité indépendants et certifications formelles. Déclenchables à partir d'un premier client grand compte qui l'exige contractuellement. Budget estimé : 20–40k€.",
        tag: "SOC 2 · ISO 27001",
      },
      {
        title: "Infrastructure souveraine (OVH/Scaleway)",
        description:
          "Migration vers une infrastructure française ou européenne certifiée SecNumCloud si un client public ou grand compte l'impose contractuellement. L'infrastructure actuelle (Vercel/Neon EU) satisfait la majorité des besoins RGPD.",
      },
    ],
  },
];

export default function EtatDuProduitPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-neutral-950 text-white py-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Transparence produit</p>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter mb-5">
            État du produit
          </h1>
          <p className="text-lg text-neutral-400 max-w-2xl leading-relaxed">
            Pas de vaporware. Pas de fausses promesses. Voici exactement ce que CarbonCo fait aujourd&apos;hui,
            ce qui est en cours de stabilisation, et ce qui est sur la roadmap.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div className="max-w-4xl mx-auto px-8 md:px-16 py-16 space-y-16">
        {STATUS_SECTIONS.map((section) => (
          <div key={section.status}>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold mb-3 ${section.bg} ${section.border} ${section.color}`}>
              <span className={`w-2 h-2 rounded-full ${section.dot}`} />
              {section.label}
            </div>
            <p className="text-neutral-500 text-sm mb-8">{section.subtitle}</p>

            <div className="space-y-4">
              {section.features.map((feature) => (
                <div key={feature.title} className={`p-5 rounded-xl border ${section.border} ${section.bg}`}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-bold text-black text-sm">{feature.title}</h3>
                    {feature.tag && (
                      <span className="text-xs font-semibold text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                        {feature.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Footer note */}
        <div className="pt-8 border-t border-neutral-200">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Cette page est mise à jour à chaque sprint (toutes les 2 semaines).
            Si une fonctionnalité que vous attendez n&apos;est pas dans la liste planifiée,{" "}
            <a href="mailto:contact@carbonco.fr" className="text-emerald-600 hover:underline">
              contactez-nous
            </a>{" "}
            — les demandes clients remontent directement dans la priorisation de la roadmap.
          </p>
          <p className="text-xs text-neutral-300 mt-3">Dernière mise à jour : avril 2026</p>
        </div>
      </div>
    </div>
  );
}
