'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface NodeDetail {
  title: string;
  description: string;
  features: string[];
  regulation: string;
  status: 'Disponible' | 'En développement' | 'Planifié';
  accent: string;
}

const NODE_DETAILS: Record<string, NodeDetail> = {
  S1: {
    title: 'ERP / SAP',
    description:
      "Connecteur API natif vers SAP S/4HANA, Oracle et Sage. Extraction automatique des données d'activité, consommations énergétiques et flux logistiques pour le calcul carbone.",
    features: [
      'Connecteur SAP certifié',
      'Synchronisation temps réel',
      'Mapping automatique des comptes',
      'Historique 5 ans intégré',
    ],
    regulation: 'ESRS E1 §38 — Données d\'activité',
    status: 'Disponible',
    accent: '#3498DB',
  },
  S2: {
    title: 'SIRH',
    description:
      "Import des données sociales : effectifs, formation, diversité, santé-sécurité. Couvre les normes ESRS S1 à S4 automatiquement à partir de votre SIRH existant.",
    features: [
      'Import Workday / SAP SuccessFactors',
      'Mapping ESRS S1-S4 natif',
      'Indicateurs sociaux automatiques',
      'Audit trail par donnée',
    ],
    regulation: 'ESRS S1-S4 — Données sociales',
    status: 'Disponible',
    accent: '#3498DB',
  },
  S3: {
    title: 'Comptabilité',
    description:
      "Extraction des données financières nécessaires au reporting ESRS : charges environnementales, provisions, investissements verts (CapEx/OpEx taxonomie).",
    features: [
      'Extraction plan comptable automatique',
      'CapEx / OpEx taxonomie UE',
      'Provisions environnementales',
      'Réconciliation inter-systèmes',
    ],
    regulation: 'ESRS E1 §AR 39 — Données financières climat',
    status: 'Disponible',
    accent: '#3498DB',
  },
  S4: {
    title: 'Achats / Supply Chain',
    description:
      "Collecte des données fournisseurs pour le Scope 3 : factures, volumes, pays d'origine, certifications. Calcul automatique de l'empreinte amont.",
    features: [
      'Questionnaire fournisseurs intégré',
      'Scope 3 catégories 1-8',
      'Facteurs d\'émission ADEME + Ecoinvent',
      'Score carbone par fournisseur',
    ],
    regulation: 'GHG Protocol Scope 3, CBAM Art. 35',
    status: 'Disponible',
    accent: '#3498DB',
  },
  S5: {
    title: 'Documents',
    description:
      "Extraction automatique de données ESG depuis des documents non structurés (PDF, scans, emails) grâce à l'OCR et aux LLM. Classification et structuration automatiques.",
    features: [
      'OCR multi-langues haute précision',
      'LLM extraction (Claude / GPT)',
      'Classification automatique ESRS',
      'Validation humaine optionnelle',
    ],
    regulation: 'EU AI Act Art. 6 — IA à risque limité',
    status: 'En développement',
    accent: '#E67E22',
  },
  C1: {
    title: 'Collecte & Structuration',
    description:
      "Moteur de collecte centralisé : déduplique, normalise, score la qualité des données et génère automatiquement un audit trail pour chaque point de donnée ESG.",
    features: [
      'Score qualité 0-100 par donnée',
      'Déduplication intelligente',
      'Audit trail ISO 14064 compliant',
      'Alertes données manquantes',
    ],
    regulation: 'ESRS 1 §77 — Qualité des données',
    status: 'Disponible',
    accent: '#2ECC71',
  },
  P1: {
    title: 'Conformité ESRS',
    description:
      "Mapping natif des 12 normes ESRS (E1-E5, S1-S4, G1-G2). Intègre les simplifications Omnibus 2025 et le standard VSME pour les PME.",
    features: [
      '12 normes ESRS natives',
      'Simplification Omnibus intégrée',
      'Standard VSME automatique',
      'Matrice de double matérialité',
    ],
    regulation: 'CSRD Art. 29a, ESRS Set 1, Omnibus 2025',
    status: 'Disponible',
    accent: '#2ECC71',
  },
  P2: {
    title: 'Bilan Carbone',
    description:
      "Calcul automatique des émissions GES sur les 3 scopes. Base de facteurs d'émission ADEME + Ecoinvent. Trajectoire SBTi et analyse de sensibilité.",
    features: [
      'Scopes 1, 2, 3 complets',
      'Base ADEME 2025 + Ecoinvent 3.10',
      'Trajectoire SBTi 1.5°C / 2°C',
      'Analyse de sensibilité intégrée',
    ],
    regulation: 'GHG Protocol, ISO 14064, ESRS E1',
    status: 'Disponible',
    accent: '#2ECC71',
  },
  P3: {
    title: 'Taxonomie & CBAM',
    description:
      "Analyse d'éligibilité et d'alignement aux 6 objectifs de la Taxonomie UE. Gestion des certificats CBAM et calcul du contenu carbone importé.",
    features: [
      '6 objectifs Taxonomie UE',
      'Critères DNSH automatiques',
      'Certificats CBAM (période transitoire)',
      'Export déclaratif douanes',
    ],
    regulation: 'Règlement Taxonomie 2020/852, CBAM 2023/956',
    status: 'Disponible',
    accent: '#3498DB',
  },
  AI: {
    title: 'Copilote IA CarbonCo',
    description:
      "Moteur RAG avec 5 agents LLM spécialisés par secteur. Détecte le greenwashing, suggère des améliorations, rédige les narratifs ESRS. Conforme EU AI Act.",
    features: [
      'RAG sur corpus réglementaire UE complet',
      '5 agents LLM sectoriels (énergie, industrie, finance, transport, bâtiment)',
      'Détection anti-greenwashing',
      'Rédaction automatique narratifs ESRS',
    ],
    regulation: 'EU AI Act Art. 6, ESRS 1 §126',
    status: 'Disponible',
    accent: '#2ECC71',
  },
  O1: {
    title: 'Reporting ESG',
    description:
      "Génération automatique des rapports ESRS et ISSB. Export multi-format : PDF structuré, Word éditable, XBRL pour dépôt réglementaire.",
    features: [
      'Template ESRS natif',
      'Export PDF / Word / XBRL',
      'Piste d\'audit intégrée',
      'Versioning et comparaison N/N-1',
    ],
    regulation: 'CSRD Art. 29d, ESEF XBRL',
    status: 'Disponible',
    accent: '#2ECC71',
  },
  O2: {
    title: 'Dashboard & Alertes',
    description:
      "Tableaux de bord temps réel avec KPIs ESG, alertes de non-conformité, suivi des trajectoires et reporting investisseurs automatisé.",
    features: [
      'KPIs temps réel configurables',
      'Alertes seuils réglementaires',
      'Suivi trajectoire SBTi',
      'Export investisseurs (CDP, SFDR)',
    ],
    regulation: 'SFDR Art. 4, 6, 7 — PAI indicators',
    status: 'Disponible',
    accent: '#3498DB',
  },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Disponible': { bg: 'rgba(46, 204, 113, 0.15)', text: '#2ECC71' },
  'En développement': { bg: 'rgba(230, 126, 34, 0.15)', text: '#E67E22' },
  'Planifié': { bg: 'rgba(52, 152, 219, 0.15)', text: '#3498DB' },
};

interface DetailPanelProps {
  nodeId: string | null;
  onClose: () => void;
}

export default function DetailPanel({ nodeId, onClose }: DetailPanelProps) {
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
              background: 'rgba(13, 27, 42, 0.97)',
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
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#7F8C8D' }}>
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

              {/* Regulation */}
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
                  Référence réglementaire
                </h4>
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                  {detail.regulation}
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
