'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface NodeDetail {
  title: string;
  description: string;
  features: string[];
  norme: string;
  status: 'Opérationnel' | 'En développement' | 'Planifié';
  accent: string;
}

const NODE_DETAILS: Record<string, NodeDetail> = {
  // ── Row 1: Sources de données ──
  SRC_ERP: {
    title: 'ERP Maison Aurelia',
    description:
      "Extraction automatique des données comptables et opérationnelles depuis SAP S/4HANA. Couvre les 7 entités du groupe réparties sur 6 pays : France, Italie, Royaume-Uni, Japon, Suisse, Émirats Arabes Unis.",
    features: [
      'Connecteur SAP S/4HANA certifié',
      '7 entités synchronisées en temps réel',
      'Plan comptable multi-pays normalisé',
      'Historique 5 exercices pour comparatifs',
    ],
    norme: 'IFRS 10 §B86 — Données d\'activité consolidées',
    status: 'Opérationnel',
    accent: '#A78BFA',
  },
  SRC_FX: {
    title: 'Flux de trésorerie & Change',
    description:
      "12 mois de taux de change pour 7 devises (EUR/USD/GBP/JPY/CHF/CNY/AED). Calcul automatique des taux de clôture, d'ouverture et moyens nécessaires à la conversion IAS 21.",
    features: [
      '7 devises suivies en continu',
      'Taux clôture, ouverture, moyen mensuels',
      'Taux historique pour goodwill IFRS 3',
      'Alimentation automatique des 3 agents',
    ],
    norme: 'IAS 21 §8 — Définition des taux de change',
    status: 'Opérationnel',
    accent: '#60A5FA',
  },
  SRC_INV: {
    title: 'Stocks & Supply Chain',
    description:
      "Données de valorisation des stocks par catégorie luxe : matières premières (cuir, métaux précieux, pierres), en-cours de production artisanale, et produits finis haute couture.",
    features: [
      'Ventilation matières / en-cours / produits finis',
      'Coûts de revient artisanaux traçables',
      'Quantités et prix unitaires par référence',
      'Données supply chain inter-maisons',
    ],
    norme: 'IAS 2 §9 — Évaluation des stocks au coût',
    status: 'Opérationnel',
    accent: '#34D399',
  },
  SRC_JUR: {
    title: 'Juridique & Contrats',
    description:
      "Périmètre de consolidation, participations, contrats de licence de marque, conventions de trésorerie et accords de couverture IFRS 9 entre entités du groupe.",
    features: [
      'Périmètre de consolidation mis à jour',
      'Taux de détention et de contrôle par entité',
      'Contrats de licence et royalties',
      'Instruments de couverture documentés',
    ],
    norme: 'IFRS 10 §5-6 — Définition du contrôle',
    status: 'Opérationnel',
    accent: '#FBBF24',
  },

  // ── Row 2: Agent MultiCurrency ──
  MULTI: {
    title: 'Agent MultiCurrency IAS 21',
    description:
      "Gestion centralisée des taux de change pour les 7 devises du groupe Maison Aurelia. Convertit les états financiers de chaque filiale en EUR, calcule les écarts de conversion (OCI), gère la comptabilité de couverture IFRS 9 (part efficace / inefficace) et mesure l'impact P&L des variations de change.",
    features: [
      'Conversion des bilans au taux de clôture (IAS 21 §39)',
      'Conversion du P&L au taux moyen de l\'exercice',
      'Écarts de conversion comptabilisés en OCI',
      'Couverture de flux : part efficace en OCI, inefficace en P&L (IFRS 9)',
      'Impact P&L change calculé par entité et devise',
      'Dérivés actifs / passifs valorisés au mark-to-market',
    ],
    norme: 'IAS 21 §39-42, IFRS 9 §6.5 — Conversion & Couverture',
    status: 'Opérationnel',
    accent: '#60A5FA',
  },

  // ── Row 3: Agent Inventaire Luxe ──
  INVENT: {
    title: 'Agent Inventaire Luxe',
    description:
      "Valorisation des stocks multi-maisons spécialisée luxe. Calcule la valeur nette de réalisation (NRV) pour chaque catégorie (maroquinerie, joaillerie, horlogerie), applique les tests de dépréciation IAS 2/IAS 36, et élimine les marges internes sur les transferts de produits finis entre entités du groupe.",
    features: [
      'Valorisation au plus bas du coût et de la NRV (IAS 2 §9)',
      'Test NRV automatique : prix de vente estimé − coûts d\'achèvement',
      'Dépréciation des stocks à rotation lente (haute couture saisonnière)',
      'Élimination des marges intra-groupe sur stocks aval (IFRS 10)',
      'Ventilation par maison : Aurelia Paris, Aurelia Milano, Aurelia London…',
      'Reporting par devise avec conversion au taux de clôture',
    ],
    norme: 'IAS 2 §28-33, IAS 36, IFRS 10 §B86(c) — Stocks & éliminations',
    status: 'En développement',
    accent: '#34D399',
  },

  // ── Row 2-3: Flux de données inter-agents ──
  FLOW_FX: {
    title: 'Flux : Taux de change → Inventaire',
    description:
      "Les taux de clôture et moyens calculés par l'agent MultiCurrency alimentent directement l'agent Inventaire pour la conversion des stocks des filiales étrangères.",
    features: [
      'Taux de clôture pour stocks au bilan',
      'Taux moyen pour flux de stock en P&L',
      'Propagation temps réel : modification FX → recalcul stocks',
    ],
    norme: 'IAS 21 §39 — Actifs non monétaires au taux historique/clôture',
    status: 'Opérationnel',
    accent: '#60A5FA',
  },

  // ── Row 4: Agent Consolidation ──
  CONSO: {
    title: 'Agent Consolidation Groupe',
    description:
      "Consolide les états financiers des 7 entités du groupe Maison Aurelia. Calcule le goodwill IFRS 3 (méthode partielle ou complète), exécute les tests de dépréciation IAS 36 par DCF avec valeur terminale, élimine toutes les transactions intercompagnies (CA, stocks, royalties, dividendes, créances/dettes) et produit le bilan et P&L consolidés avec répartition part du groupe / part des NCI.",
    features: [
      'Goodwill IFRS 3 : méthode partielle ou complète au choix',
      'Tests de dépréciation IAS 36 : DCF 5 ans + valeur terminale',
      'WACC paramétrable (8-15%), taux de croissance terminal ajustable',
      'Éliminations interco : CA, stocks, royalties, dividendes, créances',
      'P&L consolidé : du CA à l\'EBIT, au résultat net, part groupe/NCI',
      'Bilan consolidé : actifs, passifs, capitaux propres détaillés',
    ],
    norme: 'IFRS 10, IFRS 3, IAS 36 §66-106 — Consolidation complète',
    status: 'Opérationnel',
    accent: '#A78BFA',
  },

  // ── Row 4: Flux vers Consolidation ──
  FLOW_STOCKS: {
    title: 'Flux : Stocks valorisés → Consolidation',
    description:
      "L'agent Inventaire transmet au Consolidation la valeur nette des stocks après dépréciation et le montant des marges internes à éliminer sur les transferts inter-maisons.",
    features: [
      'Valeur nette des stocks par entité',
      'Marge interne à éliminer (taux moyen groupe)',
      'Impact sur le résultat et les capitaux propres consolidés',
    ],
    norme: 'IFRS 10 §B86(c) — Élimination des profits latents',
    status: 'En développement',
    accent: '#34D399',
  },
  FLOW_CHANGE: {
    title: 'Flux : Impact change → Consolidation',
    description:
      "L'agent MultiCurrency transmet les écarts de conversion, l'impact P&L change et les fair values des dérivés directement au bilan et P&L consolidés.",
    features: [
      'Écarts de conversion en OCI consolidé',
      'Impact P&L change intégré au résultat financier',
      'Dérivés actifs/passifs au bilan consolidé',
    ],
    norme: 'IAS 21 §39, IFRS 9 §6.5 — Conversion & dérivés consolidés',
    status: 'Opérationnel',
    accent: '#60A5FA',
  },

  // ── Row 5: Outputs ──
  OUT_REPORT: {
    title: 'Reporting IFRS consolidé',
    description:
      "Génération automatique des états financiers consolidés : bilan, P&L, tableau de flux, variation des capitaux propres. Export multi-format pour auditeurs et direction.",
    features: [
      'Bilan consolidé IFRS complet',
      'P&L consolidé avec part groupe / NCI',
      'Export Excel structuré (.xlsx)',
      'Piste d\'audit par ligne comptable',
    ],
    norme: 'IAS 1 §10 — Présentation des états financiers',
    status: 'Opérationnel',
    accent: '#A78BFA',
  },
  OUT_EXCEL: {
    title: 'Export Excel & Pack complet',
    description:
      "Pack de 4 fichiers Excel interconnectés : Consolidation, Inventaire, MultiCurrency, Royalties. Les taux de change et les marges se propagent automatiquement entre les fichiers.",
    features: [
      'Consolidation : paramètres, goodwill, bilan, P&L',
      'Inventaire : stocks par catégorie, test NRV',
      'MultiCurrency : taux mensuels, écarts de conversion',
      'Export ZIP avec README de documentation',
    ],
    norme: 'Pack export inter-agents — format auditeur',
    status: 'Opérationnel',
    accent: '#FBBF24',
  },
  OUT_DASH: {
    title: 'Dashboard KPIs temps réel',
    description:
      "Tableaux de bord avec KPIs consolidés en temps réel : CA groupe, résultat net, goodwill, stocks nets, impact change. Alertes de dépassement de seuils.",
    features: [
      'CA consolidé et résultat net live',
      'Goodwill net et tests de dépréciation',
      'Valeur nette des stocks par maison',
      'Impact P&L change et couverture OCI',
    ],
    norme: 'Pilotage groupe — données interconnectées',
    status: 'Opérationnel',
    accent: '#34D399',
  },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Opérationnel': { bg: 'rgba(46, 204, 113, 0.15)', text: '#2ECC71' },
  'En développement': { bg: 'rgba(230, 126, 34, 0.15)', text: '#E67E22' },
  'Planifié': { bg: 'rgba(52, 152, 219, 0.15)', text: '#3498DB' },
};

interface LuxeDetailPanelProps {
  nodeId: string | null;
  onClose: () => void;
}

export default function LuxeDetailPanel({ nodeId, onClose }: LuxeDetailPanelProps) {
  const detail = nodeId ? NODE_DETAILS[nodeId] : null;

  return (
    <AnimatePresence>
      {detail && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l"
            style={{
              background: 'rgba(10, 22, 40, 0.97)',
              borderColor: `${detail.accent}30`,
            }}
          >
            <div className="p-6">
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>

              {/* Status */}
              <span
                className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold mb-4"
                style={{
                  background: STATUS_COLORS[detail.status]?.bg,
                  color: STATUS_COLORS[detail.status]?.text,
                }}
              >
                {detail.status}
              </span>

              {/* Title */}
              <h3
                className="font-display text-2xl font-bold mb-2"
                style={{ color: '#FFFFFF' }}
              >
                {detail.title}
              </h3>

              {/* Description */}
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#94A3B8' }}>
                {detail.description}
              </p>

              {/* Features */}
              <div className="mb-6">
                <h4
                  className="text-[11px] font-bold uppercase tracking-wider mb-3"
                  style={{ color: detail.accent }}
                >
                  Fonctionnalités
                </h4>
                <ul className="space-y-2">
                  {detail.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{ background: detail.accent }}
                      />
                      <span className="text-sm" style={{ color: '#B0BEC5' }}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Norme */}
              <div
                className="rounded-xl p-4 mb-6"
                style={{
                  background: `${detail.accent}10`,
                  border: `1px solid ${detail.accent}25`,
                }}
              >
                <h4
                  className="text-[11px] font-bold uppercase tracking-wider mb-2"
                  style={{ color: detail.accent }}
                >
                  Référence IFRS
                </h4>
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                  {detail.norme}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
