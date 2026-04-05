'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface NodeDetail {
  title: string;
  description: string;
  features: string[];
  context: string;
  status: 'Opérationnel' | 'En développement' | 'Planifié';
  accent: string;
}

const NODE_DETAILS: Record<string, NodeDetail> = {
  // ── Row 1: Inputs ──
  SRC_ATS: {
    title: 'Talent Pipeline',
    description:
      'Flux entrant de candidatures et de profils sourcés pour les métiers d\'art rares. Intègre les candidatures directes, cooptations et pipelines recruteurs spécialisés en artisanat luxe.',
    features: [
      'Pipeline actif de 60 talents référencés',
      'Statuts : actif, dormant, vivier passif',
      'Scoring d\'adéquation automatique par métier',
      'Alertes sur profils dormants > 6 mois',
    ],
    context: 'Source primaire — Artisan Talent & Onboarding Luxe',
    status: 'Opérationnel',
    accent: '#34D399',
  },
  SRC_ROLES: {
    title: 'Maison Roles Atlas',
    description:
      'Référentiel complet des 30+ métiers artisanaux rares : sellier-maroquinier, sertisseur, lapidaire, guillocheur, horloger. Chaque rôle intègre le score de criticité, les compétences clés et la rareté marché.',
    features: [
      '30+ métiers artisanaux référencés',
      'Score de rareté de 0 à 100 par métier',
      'Compétences associées et certifications',
      'Benchmark temps de formation par rôle',
    ],
    context: 'Référentiel central — Artisan Talent',
    status: 'Opérationnel',
    accent: '#34D399',
  },
  SRC_COMP: {
    title: 'Compensation Intelligence',
    description:
      'Données de benchmark salarial multi-pays pour 25 postes représentatifs du secteur luxe. Historique sur 5 ans (2022-2026), décomposition fixe/variable/avantages, packages expatriation.',
    features: [
      '25 postes avec grille salariale complète',
      'Données comparatives FR, IT, CH, UK, JP, US, AE',
      'Packages d\'expatriation pré-calculés',
      'CAGR salarial 2022-2026 par métier',
    ],
    context: 'Source primaire — Comp & Benchmark',
    status: 'Opérationnel',
    accent: '#60A5FA',
  },
  SRC_PERF: {
    title: 'Performance & Reviews',
    description:
      'Évaluations collaborateurs multi-dimensionnelles : performance technique, potentiel de développement, feedback manager 360°. Utilisées par les 3 agents pour contextualiser recommandations.',
    features: [
      'Grille d\'évaluation sur 5 critères',
      'Potentiel court / moyen / long terme',
      'Historique 3 ans par collaborateur',
      'Corrélation performance-rémunération',
    ],
    context: 'Source transverse — 3 agents',
    status: 'Opérationnel',
    accent: '#FBBF24',
  },
  SRC_MOB: {
    title: 'Mobility & Expat Rules',
    description:
      'Règles de mobilité internationale, critères d\'éligibilité aux packages expatriation, contraintes fiscales et sociales par pays. Couvre 7 pays clés pour les maisons de luxe.',
    features: [
      'Matrices d\'éligibilité par poste et pays',
      'Simulateur de coût total employeur expat',
      'Contraintes fiscales FR, CH, UK, JP, AE, CN, US',
      'Délais et prérequis administratifs',
    ],
    context: 'Source primaire — Comp & Benchmark',
    status: 'Opérationnel',
    accent: '#60A5FA',
  },
  SRC_CULTURE: {
    title: 'House Culture Framework',
    description:
      'Référentiel culturel de 15+ maisons de luxe : valeurs fondatrices, rituels d\'intégration, codes de la maison, histoire, savoir-faire distinctif. Base de personnalisation des parcours d\'onboarding.',
    features: [
      '15+ maisons référencées (LV, Hermès, Chanel, Cartier...)',
      'Valeurs et codes par maison',
      'Rituels et moments clés d\'intégration',
      'Modules e-learning culture associés',
    ],
    context: 'Source primaire — Onboarding Luxe',
    status: 'Opérationnel',
    accent: '#A78BFA',
  },

  // ── Row 2/3: Agents ──
  TALENT: {
    title: 'Artisan Talent',
    description:
      'Agent de cartographie des compétences rares et de gestion prévisionnelle des métiers d\'art. Détecte les gaps critiques, identifie les risques de discontinuité sur les savoir-faire uniques et propose des plans de succession personnalisés.',
    features: [
      'Cartographie de 30+ métiers artisanaux avec scoring criticité',
      'Gap analysis — 14 postes en déficit, 8 urgences critiques détectées',
      'Vivier actif de 60 talents avec alertes de dormance',
      'Plans de succession sur 12 postes titulaires sensibles',
      'Index de rareté métier actualisé trimestriellement',
    ],
    context: 'GPEC Luxe · Talent Management · Succession Planning',
    status: 'En développement',
    accent: '#34D399',
  },
  COMP: {
    title: 'Comp & Benchmark',
    description:
      'Agent de rémunération stratégique pour les métiers du luxe. Analyse la cohérence interne, benchmarke par rapport au marché, simule des packages sur-mesure et détecte les risques d\'équité salariale.',
    features: [
      'Benchmark multi-pays sur 25 postes — masse salariale 4,3M€',
      'Analyse d\'équité H/F — 11 alertes, écart médian -11%',
      'Simulateur de package fixe + variable + expatriation',
      'Compa-ratio médian 0.95 — analyse décile par décile',
      'Scénarios d\'ajustement avec impact budget prévisionnel',
    ],
    context: 'Rémunération · Benchmark · Équité salariale',
    status: 'En développement',
    accent: '#60A5FA',
  },
  ONBOARD: {
    title: 'Onboarding Luxe',
    description:
      'Agent de conception et suivi des parcours d\'intégration premium, personnalisés par maison de luxe. Pilote les jalons 30/60/90 jours, coordonne mentorat et buddy, évalue l\'intégration sur 7 critères.',
    features: [
      '26 actions d\'intégration structurées avec timeline et responsables',
      'Personnalisation par maison — 15+ cultures référencées',
      'Système buddy/mentorat avec suivi des interactions',
      '7 critères d\'évaluation sur 5 jalons (J+30 à J+365)',
      'Tableau de bord probation pour managers et RH',
    ],
    context: 'Intégration · Culture Maison · Parcours 90j',
    status: 'En développement',
    accent: '#A78BFA',
  },

  // ── Row 4: Orchestrateur ──
  ORCHESTRATOR: {
    title: 'Maison Talent Core',
    description:
      'Cerveau décisionnel du hub RH. Fusionne les signaux issus des 3 agents pour produire des recommandations cohérentes sur les talents, la rémunération et l\'intégration. Arbitre les priorités RH multi-critères en temps réel.',
    features: [
      'Priorisation dynamique des postes critiques à pourvoir',
      'Recommandation salariale contextualisée par profil et marché',
      'Génération de scénarios d\'intégration personnalisés',
      'Arbitrage RH multi-critères (coût, délai, qualité, équité)',
      'Alertes proactives sur risques de discontinuité de savoir-faire',
    ],
    context: 'Orchestration RH · Intelligence décisionnelle',
    status: 'En développement',
    accent: '#A78BFA',
  },

  // ── Row 5: Outputs ──
  OUT_SUCCESSION: {
    title: 'Succession Plan',
    description:
      'Plan de succession formalisé pour les 12 postes titulaires critiques. Identifie le vivier de relève, évalue la profondeur du pipeline et calcule le délai de montée en compétences.',
    features: [
      'Cartographie vivier par poste sensible',
      'Délai estimé de montée en compétences',
      'Plan de développement accéléré',
    ],
    context: 'Output — Artisan Talent + Maison Talent Core',
    status: 'En développement',
    accent: '#34D399',
  },
  OUT_PACKAGE: {
    title: 'Offer & Package Simulator',
    description:
      'Simulateur de proposition d\'offre salariale cohérente avec le marché et l\'équité interne. Génère des scénarios fixe / variable / avantages pour recrutement ou mobilité.',
    features: [
      'Fourchettes marché par poste et pays',
      'Simulation coût total employeur',
      'Validation équité vs grille interne',
    ],
    context: 'Output — Comp & Benchmark + Maison Talent Core',
    status: 'En développement',
    accent: '#60A5FA',
  },
  OUT_JOURNEY: {
    title: 'Onboarding Journey',
    description:
      'Roadmap d\'intégration 30/60/90 jours personnalisée par maison et par profil. Format exportable pour managers, RH et collaborateur.',
    features: [
      'Plan jalons J+30 / J+60 / J+90',
      'Assignation buddy et mentor',
      'Checklist formations et accès',
    ],
    context: 'Output — Onboarding Luxe + Maison Talent Core',
    status: 'En développement',
    accent: '#A78BFA',
  },
  OUT_RISK: {
    title: 'Talent Risk Dashboard',
    description:
      'Tableau de bord des fragilités RH : risques de départ sur postes critiques, tensions de recrutement, postes sans relève identifiée, alertes de désengagement.',
    features: [
      'Indice de fragilité par métier',
      'Risques de départ vs criticité du poste',
      'Alertes prédictives de discontinuité',
    ],
    context: 'Output — Maison Talent Core',
    status: 'Planifié',
    accent: '#FBBF24',
  },
  OUT_REPORT: {
    title: 'HR Executive Report',
    description:
      'Synthèse décisionnelle mensuelle pour DRH et direction : bilan des mouvements, alertes prioritaires, recommandations budgétaires, KPIs sociaux et indicateurs d\'équité.',
    features: [
      'Synthèse KPIs RH vs objectifs',
      'Top 5 actions prioritaires',
      'Projection masse salariale N+1',
    ],
    context: 'Output — Maison Talent Core',
    status: 'Planifié',
    accent: '#F472B6',
  },
};

const STATUS_COLORS = {
  'Opérationnel':      { bg: 'rgba(52, 211, 153, 0.15)', text: '#34D399', dot: '#34D399' },
  'En développement':  { bg: 'rgba(251, 191, 36, 0.15)', text: '#FBBF24', dot: '#FBBF24' },
  'Planifié':          { bg: 'rgba(148, 163, 184, 0.15)', text: '#94A3B8', dot: '#94A3B8' },
};

export default function TalentDetailPanel({
  nodeId,
  onClose,
}: {
  nodeId: string | null;
  onClose: () => void;
}) {
  const detail = nodeId ? NODE_DETAILS[nodeId] : null;
  const statusStyle = detail ? STATUS_COLORS[detail.status] : STATUS_COLORS['Planifié'];

  return (
    <AnimatePresence>
      {detail && (
        <motion.div
          key={nodeId}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25 }}
          className="mt-6 rounded-2xl border p-6"
          style={{
            background: 'rgba(17, 29, 53, 0.95)',
            borderColor: `${detail.accent}30`,
            boxShadow: `0 0 40px ${detail.accent}10`,
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="font-display font-bold text-lg text-white">{detail.title}</h3>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: statusStyle.bg, color: statusStyle.text }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: statusStyle.dot }}
                  />
                  {detail.status}
                </span>
              </div>
              <p className="text-xs" style={{ color: '#64748B' }}>{detail.context}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-lg p-1.5 transition-colors"
              style={{ color: '#64748B' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed mb-5" style={{ color: '#94A3B8' }}>
            {detail.description}
          </p>

          {/* Features */}
          <ul className="space-y-2">
            {detail.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#CBD5E1' }}>
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: detail.accent }}
                />
                {f}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
