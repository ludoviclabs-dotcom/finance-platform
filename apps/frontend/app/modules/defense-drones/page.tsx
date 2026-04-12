// TODO(refactor): This file is ~1450 lines with 21 useState hooks.
// Recommended decomposition:
//   1. Extract simulation parameters into a useSimulationState hook
//   2. Extract each scenario panel into its own component
//   3. Extract chart sections into shared components
//   4. Move drone/defense computation logic into a pure utility module

'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area, ReferenceLine,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type {
  DefenseSystem, SystemScores, TCOInput,
  CPEInput, WargameInput, WargameAttacker, WargameDefender, WargameTarget,
  CriticalMaterial, StockEntry, Doctrine,
  Mission, Theatre,
} from '@/lib/types/defense';
import { calculateTCO, calculateCPE, runWargame, calculateSurgeTimeline } from '@/lib/calculs/defense';

// ================================================================
// DONNEES — 17 systemes
// ================================================================
const SYSTEMS: DefenseSystem[] = [
  {
    id: 'fpv', name: 'Drone FPV kamikaze', country: 'Ukraine/Russie', countryCode: 'UA',
    manufacturer: 'Artisanal', category: 'FPV', status: 'Combat_Proven',
    specs: { mass_kg: 1.2, max_speed_kmh: 140, range_km: 10, endurance_hours: 0.3, payload_kg: 1, warhead_kg: 0.8, propulsion: 'Electric', guidance: ['FPV vid\u00E9o'] },
    costs: { unit_cost_usd: 500, unit_cost_display: '500$', learning_rate: 0.95 },
    scores: { cost: 10, range: 1, precision: 5, stealth: 9, ai_autonomy: 1, ew_resistance: 2, scalability: 10, combat_proven: 10 },
    operational: { combat_proven: true, conflicts_used: ['Ukraine 2022-2025'], operators: ['Ukraine', 'Russie'], total_produced: 2000000, attrition_rate: 100 },
    supply_chain: { critical_components: 2, max_dependency_pct: 70, main_dependency_country: 'Chine', weak_point: 'Composants \u00E9lectroniques grand public' },
    description: 'FPV artisanal \u00E0 charge explosive. Co\u00FBt < 500$, pilotage vid\u00E9o temps r\u00E9el. Massification tactique.',
  },
  {
    id: 'lancet3', name: 'Lancet-3M', country: 'Russie', countryCode: 'RU',
    manufacturer: 'ZALA Aero (Kalashnikov)', category: 'Loitering_Munition', status: 'Combat_Proven',
    specs: { mass_kg: 12, max_speed_kmh: 300, range_km: 70, endurance_hours: 0.7, payload_kg: 5, warhead_kg: 3, propulsion: 'Electric', guidance: ['EO/IR', 'IA reconnaissance cible'] },
    costs: { unit_cost_usd: 35000, unit_cost_display: '35K$', learning_rate: 0.88 },
    scores: { cost: 9, range: 5, precision: 8, stealth: 7, ai_autonomy: 3, ew_resistance: 4, scalability: 8, combat_proven: 9 },
    operational: { combat_proven: true, conflicts_used: ['Ukraine 2022-2025', 'Syrie'], operators: ['Russie'], total_produced: 50000, attrition_rate: 100 },
    supply_chain: { critical_components: 5, max_dependency_pct: 40, main_dependency_country: 'Chine', weak_point: 'Optronique, processeurs IA' },
    description: 'Munition r\u00F4deuse de croisi\u00E8re. Guidance EO + IA, t\u00EAte militaire 3kg, massification par le co\u00FBt.',
  },
  {
    id: 'switchblade600', name: 'Switchblade 600', country: 'USA', countryCode: 'US',
    manufacturer: 'AeroVironment', category: 'Loitering_Munition', status: 'Operational',
    specs: { mass_kg: 23, max_speed_kmh: 185, range_km: 80, endurance_hours: 0.7, payload_kg: 15, warhead_kg: 6, propulsion: 'Electric', guidance: ['EO/IR', 'GPS/INS', 'Datalink chiffr\u00E9'] },
    costs: { unit_cost_usd: 100000, unit_cost_display: '100K$', learning_rate: 0.85 },
    scores: { cost: 7, range: 6, precision: 8, stealth: 8, ai_autonomy: 2, ew_resistance: 7, scalability: 6, combat_proven: 6 },
    operational: { combat_proven: true, conflicts_used: ['Ukraine 2023'], operators: ['USA', 'Ukraine'], total_produced: 5000 },
    supply_chain: { critical_components: 8, max_dependency_pct: 15, main_dependency_country: 'USA', weak_point: 'Warhead anti-tank certifi\u00E9' },
    description: 'Munition r\u00F4deuse anti-blind\u00E9, man-portable. Lien de donn\u00E9es chiffr\u00E9, r\u00E9sistant au brouillage.',
  },
  {
    id: 'harop', name: 'Harop (IAI)', country: 'Isra\u00EBl', countryCode: 'IL',
    manufacturer: 'IAI', category: 'Loitering_Munition', status: 'Combat_Proven',
    specs: { mass_kg: 135, max_speed_kmh: 400, range_km: 1000, endurance_hours: 9, payload_kg: 23, warhead_kg: 16, propulsion: 'Piston', guidance: ['EO', 'Radar passif', 'Anti-radiation'] },
    costs: { unit_cost_usd: 500000, unit_cost_display: '500K$', learning_rate: 0.82 },
    scores: { cost: 6, range: 7, precision: 9, stealth: 7, ai_autonomy: 3, ew_resistance: 8, scalability: 5, combat_proven: 8 },
    operational: { combat_proven: true, conflicts_used: ['Haut-Karabakh 2020', 'Inde-Pakistan'], operators: ['Isra\u00EBl', 'Inde', 'Azerba\u00EFdjan'], total_produced: 2000 },
    supply_chain: { critical_components: 10, max_dependency_pct: 25, main_dependency_country: 'Isra\u00EBl', weak_point: 'Capteur radar passif sp\u00E9cialis\u00E9' },
    description: 'Munition r\u00F4deuse longue endurance (9h, 1000km). Guidage radar passif ou EO. Anti-radiation et C-RAM.',
  },
  {
    id: 'shahed136', name: 'Shahed-136 / Geran-2', country: 'Iran/Russie', countryCode: 'IR',
    manufacturer: 'HESA / Alabuga', category: 'Loitering_Munition', status: 'Combat_Proven',
    specs: { mass_kg: 200, max_speed_kmh: 185, range_km: 2000, endurance_hours: 4, payload_kg: 40, warhead_kg: 36, propulsion: 'Piston', guidance: ['INS', 'GPS', 'EO terminal'] },
    costs: { unit_cost_usd: 40000, unit_cost_display: '40K$', learning_rate: 0.90 },
    scores: { cost: 9, range: 8, precision: 5, stealth: 6, ai_autonomy: 1, ew_resistance: 3, scalability: 9, combat_proven: 9 },
    operational: { combat_proven: true, conflicts_used: ['Ukraine 2022-2025'], operators: ['Iran', 'Russie', 'Houthis'], total_produced: 100000, attrition_rate: 100 },
    supply_chain: { critical_components: 3, max_dependency_pct: 50, main_dependency_country: 'Chine', weak_point: 'Moteur MD550, composants GPS civils' },
    description: 'Munition r\u00F4deuse longue port\u00E9e (~2000km). Navigation INS+GPS, massification contre infrastructures.',
  },
  {
    id: 'hero400', name: 'Hero-400EC', country: 'Isra\u00EBl', countryCode: 'IL',
    manufacturer: 'UVision', category: 'Loitering_Munition', status: 'Operational',
    specs: { mass_kg: 40, max_speed_kmh: 240, range_km: 150, endurance_hours: 2, payload_kg: 10, warhead_kg: 8, propulsion: 'Electric', guidance: ['EO/IR', 'GPS', 'Datalink'] },
    costs: { unit_cost_usd: 200000, unit_cost_display: '200K$', learning_rate: 0.84 },
    scores: { cost: 7, range: 6, precision: 9, stealth: 7, ai_autonomy: 2, ew_resistance: 7, scalability: 6, combat_proven: 5 },
    operational: { combat_proven: false, operators: ['Isra\u00EBl', 'Allemagne', 'Singapour'], total_produced: 3000 },
    supply_chain: { critical_components: 7, max_dependency_pct: 20, main_dependency_country: 'Isra\u00EBl', weak_point: 'T\u00EAte militaire polyvalente' },
    description: 'Munition r\u00F4deuse tactique multi-r\u00F4le. Adopt\u00E9e par la Bundeswehr et les forces singapouriennes.',
  },
  {
    id: 'tb2', name: 'Bayraktar TB2', country: 'T\u00FCrkiye', countryCode: 'TR',
    manufacturer: 'Baykar', category: 'MALE', status: 'Combat_Proven',
    specs: { mass_kg: 700, max_speed_kmh: 222, range_km: 150, endurance_hours: 24, ceiling_m: 7600, payload_kg: 150, propulsion: 'Piston', guidance: ['EO/IR', 'Laser', 'GPS'] },
    costs: { unit_cost_usd: 5000000, unit_cost_display: '5M$', mco_annual_pct: 8, learning_rate: 0.85, training_cost_usd: 200000 },
    scores: { cost: 6, range: 6, precision: 7, stealth: 5, ai_autonomy: 2, ew_resistance: 5, scalability: 7, combat_proven: 10 },
    operational: { combat_proven: true, conflicts_used: ['Haut-Karabakh 2020', 'Libye 2020', 'Ukraine 2022'], operators: ['T\u00FCrkiye', 'Ukraine', 'Azerba\u00EFdjan', 'Qatar', 'Niger', 'Maroc'], total_produced: 500 },
    supply_chain: { critical_components: 12, max_dependency_pct: 30, main_dependency_country: 'Canada/UK', weak_point: 'Moteur Rotax, optronique WESCAM' },
    description: 'MALE tactique polyvalent, v\u00E9t\u00E9ran du Haut-Karabakh et de l\'Ukraine. Missile MAM-C/L, autonomie 24h.',
  },
  {
    id: 'mq9', name: 'MQ-9B SkyGuardian', country: 'USA', countryCode: 'US',
    manufacturer: 'General Atomics', category: 'MALE', status: 'Operational',
    specs: { mass_kg: 2223, max_speed_kmh: 480, range_km: 1850, endurance_hours: 40, ceiling_m: 15000, payload_kg: 2177, propulsion: 'Turboprop', guidance: ['Multi-spectral', 'SAR', 'SIGINT', 'Satcom'] },
    costs: { unit_cost_usd: 30000000, unit_cost_display: '30M$', mco_annual_pct: 12, learning_rate: 0.82, training_cost_usd: 2000000 },
    scores: { cost: 3, range: 9, precision: 9, stealth: 4, ai_autonomy: 3, ew_resistance: 9, scalability: 3, combat_proven: 9 },
    operational: { combat_proven: true, conflicts_used: ['Afghanistan', 'Irak', 'Syrie', 'Libye'], operators: ['USA', 'UK', 'France', 'Italie', 'Japon'], total_produced: 400 },
    supply_chain: { critical_components: 25, max_dependency_pct: 10, main_dependency_country: 'USA', weak_point: 'Moteur TPE331, certification STANAG' },
    description: 'MALE de r\u00E9f\u00E9rence OTAN (40h, 1850km). Capteurs multi-spectraux, liaisons satcom, guerre \u00E9lectronique avanc\u00E9e.',
  },
  {
    id: 'akinci', name: 'Bayraktar Ak\u0131nc\u0131', country: 'T\u00FCrkiye', countryCode: 'TR',
    manufacturer: 'Baykar', category: 'UCAV', status: 'Operational',
    specs: { mass_kg: 3300, max_speed_kmh: 361, range_km: 300, endurance_hours: 24, ceiling_m: 12200, payload_kg: 1350, propulsion: 'Turboprop', guidance: ['AESA radar', 'EO/IR', 'SIGINT', 'Satcom'] },
    costs: { unit_cost_usd: 15000000, unit_cost_display: '15M$', mco_annual_pct: 10, learning_rate: 0.83, training_cost_usd: 1000000 },
    scores: { cost: 5, range: 8, precision: 8, stealth: 5, ai_autonomy: 3, ew_resistance: 7, scalability: 5, combat_proven: 6 },
    operational: { combat_proven: false, operators: ['T\u00FCrkiye', 'Pakistan'], total_produced: 30 },
    supply_chain: { critical_components: 18, max_dependency_pct: 25, main_dependency_country: 'Ukraine/T\u00FCrkiye', weak_point: 'Moteur AI-450C ukrainien' },
    description: 'UCAV lourd avec radar AESA. Emporte missiles de croisi\u00E8re SOM-J et munitions guid\u00E9es.',
  },
  {
    id: 'eurodrone', name: 'Eurodrone (MALE RPAS)', country: 'Europe', countryCode: 'EU',
    manufacturer: 'Airbus DS', category: 'MALE', status: 'Development',
    specs: { mass_kg: 5000, max_speed_kmh: 500, range_km: 2000, endurance_hours: 40, ceiling_m: 13700, payload_kg: 2300, propulsion: 'Turboprop', guidance: ['Multi-sensor', 'Satcom dual-band', 'STANAG'] },
    costs: { unit_cost_usd: 80000000, unit_cost_display: '80M$', mco_annual_pct: 15, learning_rate: 0.80, training_cost_usd: 5000000 },
    scores: { cost: 2, range: 9, precision: 8, stealth: 5, ai_autonomy: 3, ew_resistance: 10, scalability: 2, combat_proven: 0 },
    operational: { combat_proven: false, operators: ['France', 'Allemagne', 'Espagne', 'Italie'], total_produced: 0 },
    supply_chain: { critical_components: 30, max_dependency_pct: 5, main_dependency_country: 'Europe', weak_point: 'Int\u00E9gration OCCAR multi-nations' },
    description: 'Programme OCCAR franco-germano-hispano-italien. Certification STANAG, conformit\u00E9 espace a\u00E9rien civil.',
  },
  {
    id: 'ironbeam', name: 'Iron Beam', country: 'Isra\u00EBl', countryCode: 'IL',
    manufacturer: 'Rafael', category: 'C-UAS_Laser', status: 'Testing',
    specs: { mass_kg: 5000, range_km: 7, propulsion: 'None', guidance: ['Tracking EO/IR', 'Radar'] },
    costs: { unit_cost_usd: 50000000, unit_cost_display: '50M$ (syst\u00E8me)', learning_rate: 0.80 },
    scores: { cost: 8, range: 3, precision: 9, stealth: 1, ai_autonomy: 4, ew_resistance: 10, scalability: 7, combat_proven: 3 },
    operational: { combat_proven: true, conflicts_used: ['Gaza 2024 (tests op\u00E9rationnels)'], operators: ['Isra\u00EBl'] },
    supply_chain: { critical_components: 15, max_dependency_pct: 15, main_dependency_country: 'Isra\u00EBl', weak_point: 'Source laser haute puissance' },
    description: 'Laser C-UAS haute \u00E9nergie. Co\u00FBt par tir ~3.50$. Interception drones et roquettes \u00E0 courte port\u00E9e.',
  },
  {
    id: 'leonidas', name: 'Leonidas (HPM)', country: 'USA', countryCode: 'US',
    manufacturer: 'Epirus', category: 'C-UAS_EW', status: 'Testing',
    specs: { mass_kg: 800, range_km: 1, propulsion: 'None', guidance: ['Directional HPM'] },
    costs: { unit_cost_usd: 10000000, unit_cost_display: '10M$ (syst\u00E8me)', learning_rate: 0.82 },
    scores: { cost: 7, range: 1, precision: 6, stealth: 2, ai_autonomy: 3, ew_resistance: 10, scalability: 8, combat_proven: 2 },
    operational: { combat_proven: false, operators: ['USA'], total_produced: 10 },
    supply_chain: { critical_components: 8, max_dependency_pct: 10, main_dependency_country: 'USA', weak_point: 'Composants micro-ondes haute puissance' },
    description: 'Arme \u00E0 micro-ondes haute puissance (HPM). Neutralise essaims de drones instantan\u00E9ment. Co\u00FBt par tir ~1$.',
  },
  {
    id: 'seababy', name: 'Sea Baby', country: 'Ukraine', countryCode: 'UA',
    manufacturer: 'SBU / HUR', category: 'Naval_USV', status: 'Combat_Proven',
    specs: { mass_kg: 1000, max_speed_kmh: 80, range_km: 800, payload_kg: 850, warhead_kg: 850, propulsion: 'Hybrid', guidance: ['GPS', 'Starlink', 'EO'] },
    costs: { unit_cost_usd: 250000, unit_cost_display: '250K$', learning_rate: 0.88 },
    scores: { cost: 8, range: 7, precision: 6, stealth: 7, ai_autonomy: 2, ew_resistance: 5, scalability: 7, combat_proven: 9 },
    operational: { combat_proven: true, conflicts_used: ['Mer Noire 2023-2025'], operators: ['Ukraine'], total_produced: 200 },
    supply_chain: { critical_components: 5, max_dependency_pct: 40, main_dependency_country: 'Occident', weak_point: 'Moteur jet-ski, Starlink' },
    description: 'USV kamikaze ukrainien. A neutralis\u00E9 le croiseur Moskva et d\u00E9ni\u00E9 la mer Noire \u00E0 la flotte russe.',
  },
  {
    id: 'magura', name: 'MAGURA V5', country: 'Ukraine', countryCode: 'UA',
    manufacturer: 'HUR / SBU', category: 'Naval_USV', status: 'Combat_Proven',
    specs: { mass_kg: 500, max_speed_kmh: 78, range_km: 800, payload_kg: 300, warhead_kg: 250, propulsion: 'Electric', guidance: ['GPS', 'Starlink', 'EO/IR'] },
    costs: { unit_cost_usd: 200000, unit_cost_display: '200K$', learning_rate: 0.88 },
    scores: { cost: 8, range: 7, precision: 7, stealth: 8, ai_autonomy: 2, ew_resistance: 5, scalability: 7, combat_proven: 8 },
    operational: { combat_proven: true, conflicts_used: ['Mer Noire 2024-2025'], operators: ['Ukraine'], total_produced: 150 },
    supply_chain: { critical_components: 5, max_dependency_pct: 40, main_dependency_country: 'Occident', weak_point: 'Batteries, liaison Starlink' },
    description: 'USV naval furtif avec missiles Neptune R. A coul\u00E9 des patrouilleurs et endommag\u00E9 des navires russes.',
  },
  {
    id: 'fury', name: 'Fury (CCA)', country: 'USA', countryCode: 'US',
    manufacturer: 'Anduril', category: 'Loyal_Wingman', status: 'Development',
    specs: { mass_kg: 2500, max_speed_kmh: 1000, range_km: 3000, endurance_hours: 5, ceiling_m: 15000, payload_kg: 500, propulsion: 'Turbojet', guidance: ['IA autonome', 'Satcom', 'Mesh network'] },
    costs: { unit_cost_usd: 10000000, unit_cost_display: '10M$', learning_rate: 0.82 },
    scores: { cost: 5, range: 9, precision: 8, stealth: 8, ai_autonomy: 4, ew_resistance: 8, scalability: 5, combat_proven: 0 },
    operational: { combat_proven: false, operators: ['USA (USAF CCA)'], total_produced: 5 },
    supply_chain: { critical_components: 20, max_dependency_pct: 10, main_dependency_country: 'USA', weak_point: 'IA combat certifi\u00E9e, moteur abordable' },
    description: 'Loyal Wingman programme CCA. Autonomie IA compl\u00E8te, op\u00E9ration en essaim avec chasseur pilot\u00E9.',
  },
  {
    id: 'kizilelma', name: 'Bayraktar K\u0131z\u0131lelma', country: 'T\u00FCrkiye', countryCode: 'TR',
    manufacturer: 'Baykar', category: 'UCAV', status: 'Testing',
    specs: { mass_kg: 6000, max_speed_kmh: 900, range_km: 930, endurance_hours: 5, ceiling_m: 10700, payload_kg: 1500, propulsion: 'Turbofan', guidance: ['AESA', 'EO/IR', 'Datalink'] },
    costs: { unit_cost_usd: 20000000, unit_cost_display: '20M$', mco_annual_pct: 10, learning_rate: 0.83 },
    scores: { cost: 4, range: 8, precision: 8, stealth: 6, ai_autonomy: 3, ew_resistance: 7, scalability: 4, combat_proven: 0 },
    operational: { combat_proven: false, operators: ['T\u00FCrkiye'], total_produced: 3 },
    supply_chain: { critical_components: 20, max_dependency_pct: 20, main_dependency_country: 'Ukraine/T\u00FCrkiye', weak_point: 'Moteur AI-322F ukrainien' },
    description: 'UCAV furtif embarqu\u00E9 (TCG Anadolu). Appontage autonome, capacit\u00E9 air-air et air-sol.',
  },
  {
    id: 'themis', name: 'THeMIS UGV', country: 'Estonie', countryCode: 'EE',
    manufacturer: 'Milrem Robotics', category: 'UGV', status: 'Operational',
    specs: { mass_kg: 1630, max_speed_kmh: 20, range_km: 50, endurance_hours: 12, payload_kg: 750, propulsion: 'Hybrid', guidance: ['GPS', 'LiDAR', 'IA navigation'] },
    costs: { unit_cost_usd: 500000, unit_cost_display: '500K$', mco_annual_pct: 5, learning_rate: 0.85 },
    scores: { cost: 6, range: 3, precision: 7, stealth: 5, ai_autonomy: 3, ew_resistance: 6, scalability: 6, combat_proven: 4 },
    operational: { combat_proven: true, conflicts_used: ['Ukraine 2024 (tests)'], operators: ['Estonie', 'Pays-Bas', 'UK', 'Norv\u00E8ge'], total_produced: 100 },
    supply_chain: { critical_components: 10, max_dependency_pct: 20, main_dependency_country: 'Europe', weak_point: 'Batteries, IA navigation' },
    description: 'Robot terrestre modulaire. Transport logistique, ISR, RCWS. D\u00E9ploy\u00E9 dans plusieurs arm\u00E9es OTAN.',
  },
];

// --- MATIERES CRITIQUES ---
const MATERIALS: CriticalMaterial[] = [
  { id: 'gallium', name: 'Gallium', defense_usage: 'Semi-conducteurs GaN, radars AESA, EW', world_production_tons: 600, china_share_pct: 98, west_share_pct: 1, risk_level: 'Critical', substitution_delay_months: 36, alternative: 'GaAs (performances r\u00E9duites)' },
  { id: 'germanium', name: 'Germanium', defense_usage: 'Optique IR, fibres optiques, capteurs', world_production_tons: 140, china_share_pct: 68, west_share_pct: 10, risk_level: 'Critical', substitution_delay_months: 24, alternative: 'Silicium (partiel)' },
  { id: 'tungsten', name: 'Tungst\u00E8ne', defense_usage: 'P\u00E9n\u00E9trateurs cin\u00E9tiques, blindage', world_production_tons: 84000, china_share_pct: 84, west_share_pct: 5, risk_level: 'Critical', substitution_delay_months: 18, alternative: 'Uranium appauvri (controvers\u00E9)' },
  { id: 'cobalt', name: 'Cobalt', defense_usage: 'Batteries Li-ion, superalliages turbines', world_production_tons: 190000, china_share_pct: 75, west_share_pct: 5, risk_level: 'High', substitution_delay_months: 24, alternative: 'Batteries LFP (sans cobalt)' },
  { id: 'titanium', name: 'Titane', defense_usage: 'Cellules a\u00E9ronautiques, moteurs', world_production_tons: 240000, china_share_pct: 32, west_share_pct: 25, risk_level: 'High', substitution_delay_months: 18, alternative: 'Composites carbone (partiel)' },
  { id: 'ree', name: 'Terres rares (NdFeB)', defense_usage: 'Moteurs drones, guidage, \u00E9lectronique', world_production_tons: 300000, china_share_pct: 70, west_share_pct: 15, risk_level: 'Critical', substitution_delay_months: 48, alternative: 'Aimants ferrite (10x plus lourd)' },
  { id: 'lithium', name: 'Lithium', defense_usage: 'Batteries drones, v\u00E9hicules, stockage', world_production_tons: 130000, china_share_pct: 60, west_share_pct: 25, risk_level: 'High', substitution_delay_months: 12, alternative: 'Sodium-ion (\u00E9mergent)' },
];

// --- STOCKS & PRODUCTION ---
const STOCKS: StockEntry[] = [
  { id: 's1', country: 'USA', system_name: 'Switchblade 600', system_id: 'switchblade600', estimated_stock: 3000, monthly_production: 200, annual_production: 2400, surge_capacity_18m: 6000, monthly_wartime_consumption: 500, months_of_stock_wartime: 6, limiting_factor: 'T\u00EAtes militaires anti-char', confidence_level: 4 },
  { id: 's2', country: 'Russie', system_name: 'Lancet-3M', system_id: 'lancet3', estimated_stock: 15000, monthly_production: 3000, annual_production: 36000, surge_capacity_18m: 80000, monthly_wartime_consumption: 5000, months_of_stock_wartime: 3, limiting_factor: 'Composants \u00E9lectroniques', confidence_level: 3 },
  { id: 's3', country: 'Iran/Russie', system_name: 'Shahed-136', system_id: 'shahed136', estimated_stock: 20000, monthly_production: 4000, annual_production: 48000, surge_capacity_18m: 120000, monthly_wartime_consumption: 3000, months_of_stock_wartime: 7, limiting_factor: 'Moteurs MD550', confidence_level: 2 },
  { id: 's4', country: 'Ukraine', system_name: 'FPV kamikaze', system_id: 'fpv', estimated_stock: 200000, monthly_production: 100000, annual_production: 1200000, surge_capacity_18m: 3000000, monthly_wartime_consumption: 80000, months_of_stock_wartime: 2.5, limiting_factor: 'Op\u00E9rateurs form\u00E9s', confidence_level: 3 },
  { id: 's5', country: 'USA', system_name: 'MQ-9B', system_id: 'mq9', estimated_stock: 300, monthly_production: 3, annual_production: 36, surge_capacity_18m: 70, limiting_factor: 'Moteurs certifi\u00E9s + optronique', confidence_level: 5 },
  { id: 's6', country: 'Isra\u00EBl', system_name: 'Harop', system_id: 'harop', estimated_stock: 500, monthly_production: 20, annual_production: 240, surge_capacity_18m: 600, monthly_wartime_consumption: 50, months_of_stock_wartime: 10, limiting_factor: 'Capteurs radar passif', confidence_level: 3 },
];

// --- DOCTRINES ---
const DOCTRINES: Doctrine[] = [
  { country: 'USA', countryCode: 'US', dronization_level: 8, employment_concept: 'Pr\u00E9cision', budget_2025_bds: 842000, pct_gdp_2025: 3.4, drone_share_pct: 6, objective_2030_pct: 15, strategic_focus: 'CCA Loyal Wingman, essaims IA, pr\u00E9cision OTAN', key_systems: ['mq9', 'switchblade600', 'fury'] },
  { country: 'Chine', countryCode: 'CN', dronization_level: 7, employment_concept: 'Masse + Pr\u00E9cision', budget_2025_bds: 296000, pct_gdp_2025: 1.6, drone_share_pct: 8, objective_2030_pct: 20, strategic_focus: 'A2/AD, essaims navals, IA combat autonome', key_systems: [] },
  { country: 'Russie', countryCode: 'RU', dronization_level: 7, employment_concept: 'Masse', budget_2025_bds: 109000, pct_gdp_2025: 6.7, drone_share_pct: 12, objective_2030_pct: 25, strategic_focus: 'Massification FPV/Lancet, attrition par saturation', key_systems: ['lancet3', 'shahed136', 'fpv'] },
  { country: 'T\u00FCrkiye', countryCode: 'TR', dronization_level: 9, employment_concept: 'Hybride', budget_2025_bds: 41000, pct_gdp_2025: 1.9, drone_share_pct: 15, objective_2030_pct: 30, strategic_focus: 'Export massif, gamme compl\u00E8te FPV \u00E0 UCAV, souverainet\u00E9', key_systems: ['tb2', 'akinci', 'kizilelma'] },
  { country: 'Isra\u00EBl', countryCode: 'IL', dronization_level: 9, employment_concept: 'Pr\u00E9cision', budget_2025_bds: 28000, pct_gdp_2025: 5.5, drone_share_pct: 18, objective_2030_pct: 30, strategic_focus: 'C-UAS laser, loitering munitions, IA autonome', key_systems: ['harop', 'hero400', 'ironbeam'] },
  { country: 'France', countryCode: 'FR', dronization_level: 5, employment_concept: 'Pr\u00E9cision', budget_2025_bds: 56000, pct_gdp_2025: 2.1, drone_share_pct: 3, objective_2030_pct: 10, strategic_focus: 'Eurodrone, SCAF, souverainet\u00E9 europ\u00E9enne', key_systems: ['eurodrone'] },
  { country: 'Ukraine', countryCode: 'UA', dronization_level: 10, employment_concept: 'Masse', budget_2025_bds: 15000, pct_gdp_2025: 26, drone_share_pct: 35, objective_2030_pct: 50, strategic_focus: 'FPV massifi\u00E9s, USV navals, innovation terrain', key_systems: ['fpv', 'seababy', 'magura'] },
  { country: 'Iran', countryCode: 'IR', dronization_level: 7, employment_concept: 'Masse + Proxy', budget_2025_bds: 10000, pct_gdp_2025: 2.5, drone_share_pct: 20, objective_2030_pct: 35, strategic_focus: 'Export proxies (Houthis, Hezbollah), saturation', key_systems: ['shahed136'] },
];

// ================================================================
// HELPERS UI
// ================================================================
const fmt = (n: number, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n);
const fmtUSD = (n: number) => {
  if (n >= 1_000_000_000) return `${fmt(n / 1_000_000_000, 1)} Md$`;
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 1)} M$`;
  if (n >= 1_000) return `${fmt(n / 1_000, 0)} K$`;
  return `${fmt(n, 0)}$`;
};
const fmtPct = (n: number) => `${fmt(n * 100, 1)}%`;
const tooltipFmt = (v: ValueType | undefined) => `${Number(v ?? 0).toLocaleString('fr-FR')}`;

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
const RISK_COLORS: Record<string, string> = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#22c55e' };
const STATUS_COLORS: Record<string, string> = {
  Combat_Proven: '#22c55e', Operational: '#3b82f6', Testing: '#f59e0b',
  Development: '#8b5cf6', Concept: '#6b7280', Prototype: '#06b6d4', Retired: '#374151',
};

const SCORE_AXES: { key: keyof SystemScores; label: string }[] = [
  { key: 'cost', label: 'Co\u00FBt' }, { key: 'range', label: 'Port\u00E9e' },
  { key: 'precision', label: 'Pr\u00E9cision' }, { key: 'stealth', label: 'Furtivit\u00E9' },
  { key: 'ai_autonomy', label: 'IA' }, { key: 'ew_resistance', label: 'R\u00E9s. EW' },
  { key: 'scalability', label: 'Scalabilit\u00E9' }, { key: 'combat_proven', label: 'Combat' },
];

// ================================================================
// WIZARD SCORING
// ================================================================
const MISSION_WEIGHTS: Record<Mission, Partial<Record<keyof SystemScores, number>>> = {
  'ISR / Surveillance': { range: 2.0, precision: 1.5, stealth: 1.0, cost: 0.8, ew_resistance: 1.0, scalability: 0.8, combat_proven: 0.8, ai_autonomy: 1.0 },
  'Frappe de pr\u00E9cision': { precision: 2.0, stealth: 1.5, ew_resistance: 1.5, range: 1.0, cost: 0.8, scalability: 0.7, combat_proven: 1.0, ai_autonomy: 0.8 },
  'Lutte anti-drone (C-UAS)': { ew_resistance: 2.0, cost: 1.5, scalability: 1.5, precision: 1.0, range: 0.5, stealth: 0.5, combat_proven: 1.0, ai_autonomy: 1.2 },
  'Appui logistique': { range: 1.8, cost: 1.5, scalability: 1.0, precision: 0.5, stealth: 0.5, ew_resistance: 0.8, combat_proven: 0.8, ai_autonomy: 1.0 },
};

const THEATRE_BONUSES: Record<Theatre, Partial<Record<keyof SystemScores, number>>> = {
  "Europe de l'Est": { combat_proven: 1.5, scalability: 1.3, cost: 1.2, ew_resistance: 1.0, range: 1.0, precision: 1.0, stealth: 1.0, ai_autonomy: 1.0 },
  'Moyen-Orient': { ew_resistance: 1.5, precision: 1.3, combat_proven: 1.2, cost: 1.0, range: 1.0, stealth: 1.0, scalability: 1.0, ai_autonomy: 1.0 },
  'Mer de Chine m\u00E9ridionale': { range: 1.5, stealth: 1.3, ew_resistance: 1.2, precision: 1.0, cost: 1.0, scalability: 1.0, combat_proven: 1.0, ai_autonomy: 1.0 },
  'Sahel': { cost: 1.5, scalability: 1.2, range: 1.0, precision: 1.0, stealth: 1.0, ew_resistance: 1.0, combat_proven: 1.0, ai_autonomy: 1.0 },
};

function getWizardScore(sys: DefenseSystem, mission: Mission, theatre: Theatre): number {
  const mw = MISSION_WEIGHTS[mission];
  const tb = THEATRE_BONUSES[theatre];
  let total = 0;
  let weightSum = 0;
  for (const ax of SCORE_AXES) {
    const mWeight = mw[ax.key] ?? 1.0;
    const tBonus = tb[ax.key] ?? 1.0;
    const combinedWeight = mWeight * tBonus;
    total += sys.scores[ax.key] * combinedWeight;
    weightSum += combinedWeight;
  }
  return total / weightSum;
}

// ================================================================
// MISSIONS & THEATRES for wizard
// ================================================================
const MISSIONS: Mission[] = ['ISR / Surveillance', 'Frappe de pr\u00E9cision', 'Lutte anti-drone (C-UAS)', 'Appui logistique'];
const THEATRES: Theatre[] = ["Europe de l'Est", 'Moyen-Orient', 'Mer de Chine m\u00E9ridionale', 'Sahel'];

const MISSION_ICONS: Record<Mission, string> = {
  'ISR / Surveillance': '\u{1F50D}',
  'Frappe de pr\u00E9cision': '\u{1F3AF}',
  'Lutte anti-drone (C-UAS)': '\u{1F6E1}',
  'Appui logistique': '\u{1F69A}',
};

const THEATRE_ICONS: Record<Theatre, string> = {
  "Europe de l'Est": '\u{1F30D}',
  'Moyen-Orient': '\u{2600}',
  'Mer de Chine m\u00E9ridionale': '\u{1F30A}',
  'Sahel': '\u{1F3DC}',
};

const MISSION_DESCRIPTIONS: Record<Mission, string> = {
  'ISR / Surveillance': 'Reconnaissance, surveillance persistante, collecte de renseignements',
  'Frappe de pr\u00E9cision': 'Engagement de cibles de haute valeur avec un minimum de dommages collat\u00E9raux',
  'Lutte anti-drone (C-UAS)': 'D\u00E9fense contre les essaims de drones et menaces a\u00E9riennes non conventionnelles',
  'Appui logistique': 'Transport de mat\u00E9riel, ravitaillement, \u00E9vacuation sanitaire',
};

const THEATRE_DESCRIPTIONS: Record<Theatre, string> = {
  "Europe de l'Est": 'Conflit conventionnel, guerre de tranch\u00E9es, guerre \u00E9lectronique intense',
  'Moyen-Orient': 'Environnement d\u00E9sertique, menaces asym\u00E9triques, pr\u00E9cision chirurgicale',
  'Mer de Chine m\u00E9ridionale': 'Contr\u00F4le maritime, A2/AD, longue port\u00E9e, furtivit\u00E9',
  'Sahel': 'Vaste zone, budget limit\u00E9, endurance et autonomie essentielles',
};

// ================================================================
// TABS
// ================================================================
const TABS = [
  { id: 1, label: 'Dashboard' },
  { id: 2, label: 'Catalogue' },
  { id: 3, label: 'Comparateur' },
  { id: 4, label: 'TCO' },
  { id: 5, label: 'Co\u00FBt/Effet' },
  { id: 6, label: 'Wargame' },
  { id: 7, label: 'Supply Chain' },
  { id: 8, label: 'Stocks & Doctrines' },
];

// ================================================================
// PAGE
// ================================================================
export default function DefenseDronesPage() {
  const [activeTab, setActiveTab] = useState(1);

  // Wizard state
  const [dashStep, setDashStep] = useState(0);
  const [selectedMission, setSelectedMission] = useState<Mission>('ISR / Surveillance');
  const [selectedTheatre, setSelectedTheatre] = useState<Theatre>("Europe de l'Est");
  const [wizardBudget, setWizardBudget] = useState(500_000_000);
  const [selectedDoctrine, setSelectedDoctrine] = useState('USA');
  const [categoryFilters, setCategoryFilters] = useState<Set<string>>(new Set());
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());

  // Comparateur state
  const [compA, setCompA] = useState('tb2');
  const [compB, setCompB] = useState('lancet3');

  // TCO state
  const [tcoSystem, setTcoSystem] = useState('tb2');
  const [tcoQty, setTcoQty] = useState(50);
  const [tcoYears, setTcoYears] = useState(15);

  // CPE state
  const [cpeSystem, setCpeSystem] = useState('lancet3');
  const [cpeTargetValue, setCpeTargetValue] = useState(5000000);
  const [cpePHit, setCpePHit] = useState(0.7);
  const [cpePKill, setCpePKill] = useState(0.8);

  // Wargame state
  const [wgAttackers, setWgAttackers] = useState<WargameAttacker[]>([
    { systemId: 'shahed136', name: 'Shahed-136', quantity: 100, unitCost: 40000, pHit: 0.6, pKill: 0.8 },
    { systemId: 'lancet3', name: 'Lancet-3M', quantity: 50, unitCost: 35000, pHit: 0.7, pKill: 0.85 },
  ]);
  const [wgDefenders, setWgDefenders] = useState<WargameDefender[]>([
    { systemId: 'ironbeam', name: 'Iron Beam', quantity: 4, unitCost: 3, pIntercept: 0.90, maxEngagements: 30 },
  ]);
  const [wgTargets] = useState<WargameTarget[]>([
    { name: 'Centre de commandement', value: 50000000, quantity: 1, hardness: 0.3 },
    { name: 'D\u00E9p\u00F4t logistique', value: 20000000, quantity: 3, hardness: 0.1 },
  ]);

  // --- Computed ---
  const sysA = SYSTEMS.find(s => s.id === compA) ?? SYSTEMS[0];
  const sysB = SYSTEMS.find(s => s.id === compB) ?? SYSTEMS[1];

  const radarData = SCORE_AXES.map(ax => ({
    axis: ax.label, [sysA.name]: sysA.scores[ax.key], [sysB.name]: sysB.scores[ax.key],
  }));

  const tcoSys = SYSTEMS.find(s => s.id === tcoSystem) ?? SYSTEMS[0];
  const tcoInput: TCOInput = {
    unitCost: tcoSys.costs.unit_cost_usd, quantity: tcoQty,
    learningRate: tcoSys.costs.learning_rate ?? 0.85,
    mcoAnnualPct: tcoSys.costs.mco_annual_pct ?? 0,
    trainingCostPerUnit: tcoSys.costs.training_cost_usd ?? 0,
    attritionRateAnnual: tcoSys.operational.attrition_rate ?? 2,
    yearsOfService: tcoYears, inflationRate: 0.035,
    isConsumable: ['FPV', 'Loitering_Munition'].includes(tcoSys.category),
  };
  const tcoResult = useMemo(() => calculateTCO(tcoInput), [tcoSystem, tcoQty, tcoYears]);

  const cpeSys = SYSTEMS.find(s => s.id === cpeSystem) ?? SYSTEMS[1];
  const cpeInput: CPEInput = { munitionCost: cpeSys.costs.unit_cost_usd, pHit: cpePHit, pKillGivenHit: cpePKill, targetValue: cpeTargetValue };
  const cpeResult = useMemo(() => calculateCPE(cpeInput), [cpeSystem, cpeTargetValue, cpePHit, cpePKill]);

  const wgInput: WargameInput = { attackSystems: wgAttackers, defenseSystems: wgDefenders, targets: wgTargets };
  const wgResult = useMemo(() => runWargame(wgInput), [wgAttackers, wgDefenders, wgTargets]);

  // --- KPI Dashboard (used by old dashboard & wizard step 3) ---
  const totalSystems = SYSTEMS.length;
  const combatProvenCount = SYSTEMS.filter(s => s.operational.combat_proven).length;
  const avgCostScore = SYSTEMS.reduce((s, sys) => s + sys.scores.cost, 0) / totalSystems;
  const avgAIScore = SYSTEMS.reduce((s, sys) => s + sys.scores.ai_autonomy, 0) / totalSystems;
  const maxDep = Math.max(...SYSTEMS.map(s => s.supply_chain.max_dependency_pct));
  const categoryDist = SYSTEMS.reduce((acc, s) => { acc[s.category] = (acc[s.category] || 0) + 1; return acc; }, {} as Record<string, number>);

  // --- Wizard computed ---
  const allCategories = useMemo(() => [...new Set(SYSTEMS.map(s => s.category))], []);
  const allStatuses = useMemo(() => [...new Set(SYSTEMS.map(s => s.status))], []);

  const wizardFilteredSystems = useMemo(() => {
    return SYSTEMS.filter(sys => {
      if (categoryFilters.size > 0 && !categoryFilters.has(sys.category)) return false;
      if (statusFilters.size > 0 && !statusFilters.has(sys.status)) return false;
      if (sys.costs.unit_cost_usd > wizardBudget) return false;
      return true;
    });
  }, [categoryFilters, statusFilters, wizardBudget]);

  const wizardScoredSystems = useMemo(() => {
    return wizardFilteredSystems
      .map(sys => ({
        system: sys,
        score: getWizardScore(sys, selectedMission, selectedTheatre),
      }))
      .sort((a, b) => b.score - a.score);
  }, [wizardFilteredSystems, selectedMission, selectedTheatre]);

  const wizardTop3 = useMemo(() => wizardScoredSystems.slice(0, 3), [wizardScoredSystems]);

  const wizardRadarData = useMemo(() => {
    if (wizardTop3.length === 0) return [];
    return SCORE_AXES.map(ax => {
      const entry: Record<string, string | number> = { axis: ax.label };
      wizardTop3.forEach(({ system }) => {
        entry[system.name] = system.scores[ax.key];
      });
      return entry;
    });
  }, [wizardTop3]);

  const wizardDoctrine = useMemo(() => {
    return DOCTRINES.find(d => d.country === selectedDoctrine) ?? DOCTRINES[0];
  }, [selectedDoctrine]);

  const wizardDoctrineAlignment = useMemo(() => {
    if (wizardScoredSystems.length === 0) return 0;
    const docSystems = wizardDoctrine.key_systems;
    const matchingInFiltered = wizardFilteredSystems.filter(s => docSystems.includes(s.id)).length;
    const totalDocSystems = docSystems.length || 1;
    return Math.min(1, matchingInFiltered / totalDocSystems);
  }, [wizardDoctrine, wizardFilteredSystems, wizardScoredSystems]);

  const wizardBudgetUtilization = useMemo(() => {
    if (wizardScoredSystems.length === 0) return 0;
    const totalCostTop = wizardTop3.reduce((sum, { system }) => sum + system.costs.unit_cost_usd, 0);
    return Math.min(1, totalCostTop / wizardBudget);
  }, [wizardTop3, wizardBudget, wizardScoredSystems]);

  const fmtBudgetSlider = (val: number) => {
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)} Md$`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} M$`;
    return `${(val / 1_000).toFixed(0)} K$`;
  };

  const toggleCategoryFilter = (cat: string) => {
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleStatusFilter = (st: string) => {
    setStatusFilters(prev => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st); else next.add(st);
      return next;
    });
  };

  const resetWizard = () => {
    setDashStep(0);
    setSelectedMission('ISR / Surveillance');
    setSelectedTheatre("Europe de l'Est");
    setWizardBudget(500_000_000);
    setSelectedDoctrine('USA');
    setCategoryFilters(new Set());
    setStatusFilters(new Set());
  };

  const WIZARD_STEPS = [
    { num: 0, label: 'Accueil' },
    { num: 1, label: 'Contexte' },
    { num: 2, label: 'Filtres' },
    { num: 3, label: 'R\u00E9sultats' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">D\u00E9fense & Drones — Simulateur Strat\u00E9gique</h1>
        <p className="text-gray-400 mt-1">{totalSystems} syst\u00E8mes · 7 mat\u00E9riaux critiques · 8 doctrines · Donn\u00E9es OSINT Mars 2026</p>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-emerald-600 text-white shadow' : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">

        {/* ======= 1. DASHBOARD (WIZARD) ======= */}
        {activeTab === 1 && (
          <section>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {WIZARD_STEPS.map((step, idx) => (
                <div key={step.num} className="flex items-center">
                  <button
                    onClick={() => { if (step.num <= dashStep) setDashStep(step.num); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      dashStep === step.num
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                        : dashStep > step.num
                          ? 'bg-emerald-900/50 text-emerald-400 cursor-pointer hover:bg-emerald-800/50'
                          : 'bg-gray-800 text-gray-500 cursor-default'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      dashStep >= step.num ? 'bg-emerald-500/30' : 'bg-gray-700'
                    }`}>{step.num}</span>
                    {step.label}
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${dashStep > step.num ? 'bg-emerald-600' : 'bg-gray-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* ===== STEP 0: Welcome ===== */}
            {dashStep === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                <div className="relative mb-8">
                  <div className="absolute -inset-4 bg-emerald-500/10 rounded-full blur-xl animate-pulse" />
                  <div className="relative text-6xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                    DEFENCE & DRONES
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Simulateur Strat\u00E9gique</h2>
                <p className="text-gray-400 text-lg mb-8 max-w-2xl">
                  Analysez {totalSystems} syst\u00E8mes d&apos;armes autonomes, comparez les doctrines de {DOCTRINES.length} nations,
                  \u00E9valuez les vuln\u00E9rabilit\u00E9s de {MATERIALS.length} mat\u00E9riaux critiques et simulez des sc\u00E9narios d&apos;engagement.
                </p>

                <div className="grid grid-cols-3 gap-6 mb-10 max-w-xl w-full">
                  {[
                    { val: `${totalSystems}`, label: 'Syst\u00E8mes', sub: `${combatProvenCount} combat proven` },
                    { val: '7', label: 'Mat\u00E9riaux critiques', sub: '4 en risque critique' },
                    { val: '8', label: 'Doctrines', sub: 'OTAN + adversaires' },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                      <p className="text-3xl font-black text-emerald-400">{item.val}</p>
                      <p className="text-sm font-semibold text-white mt-1">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-6 mb-8 max-w-2xl text-left">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Capacit\u00E9s du simulateur</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      'Analyse multi-crit\u00E8res par mission et th\u00E9\u00E2tre',
                      'Scoring contextuel pond\u00E9r\u00E9',
                      'Comparaison radar 8 axes',
                      'Calcul TCO avec courbe de Wright',
                      'Simulation wargame attaque/d\u00E9fense',
                      'Analyse supply chain critique',
                    ].map(cap => (
                      <div key={cap} className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5 shrink-0">&#9654;</span>
                        <span className="text-gray-300">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setDashStep(1)}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-lg transition-all shadow-lg shadow-emerald-900/50 hover:shadow-emerald-800/50 hover:scale-105"
                >
                  Commencer l&apos;analyse
                </button>
              </div>
            )}

            {/* ===== STEP 1: Context ===== */}
            {dashStep === 1 && (
              <div>
                <h2 className="text-xl font-bold mb-2">S\u00E9lection du contexte op\u00E9rationnel</h2>
                <p className="text-gray-400 text-sm mb-6">D\u00E9finissez la mission, le th\u00E9\u00E2tre d&apos;op\u00E9rations et l&apos;enveloppe budg\u00E9taire.</p>

                {/* Mission */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Type de mission</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {MISSIONS.map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedMission(m)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedMission === m
                            ? 'bg-emerald-900/40 border-emerald-500 shadow-lg shadow-emerald-900/30'
                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                        }`}
                      >
                        <div className="text-2xl mb-2">{MISSION_ICONS[m]}</div>
                        <p className={`font-semibold text-sm ${selectedMission === m ? 'text-emerald-400' : 'text-white'}`}>{m}</p>
                        <p className="text-xs text-gray-500 mt-1">{MISSION_DESCRIPTIONS[m]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theatre */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Th\u00E9\u00E2tre d&apos;op\u00E9rations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {THEATRES.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTheatre(t)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedTheatre === t
                            ? 'bg-emerald-900/40 border-emerald-500 shadow-lg shadow-emerald-900/30'
                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                        }`}
                      >
                        <div className="text-2xl mb-2">{THEATRE_ICONS[t]}</div>
                        <p className={`font-semibold text-sm ${selectedTheatre === t ? 'text-emerald-400' : 'text-white'}`}>{t}</p>
                        <p className="text-xs text-gray-500 mt-1">{THEATRE_DESCRIPTIONS[t]}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Budget slider */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Enveloppe budg\u00E9taire unitaire max</h3>
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-gray-500">10 M$</span>
                      <span className="text-2xl font-black text-emerald-400">{fmtBudgetSlider(wizardBudget)}</span>
                      <span className="text-xs text-gray-500">10 Md$</span>
                    </div>
                    <input
                      type="range"
                      min={10_000_000}
                      max={10_000_000_000}
                      step={10_000_000}
                      value={wizardBudget}
                      onChange={e => setWizardBudget(+e.target.value)}
                      className="w-full accent-emerald-500"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Syst\u00E8mes dont le co\u00FBt unitaire d\u00E9passe ce seuil seront exclus de l&apos;analyse.
                    </p>
                  </div>
                </div>

                {/* Nav */}
                <div className="flex justify-between">
                  <button onClick={() => setDashStep(0)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors border border-gray-700">
                    Retour
                  </button>
                  <button onClick={() => setDashStep(2)} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/30">
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* ===== STEP 2: Doctrine & Filters ===== */}
            {dashStep === 2 && (
              <div>
                <h2 className="text-xl font-bold mb-2">Doctrine & filtres</h2>
                <p className="text-gray-400 text-sm mb-6">Affinez l&apos;analyse en s\u00E9lectionnant une doctrine de r\u00E9f\u00E9rence et en filtrant les cat\u00E9gories.</p>

                {/* Doctrine selector */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Doctrine de r\u00E9f\u00E9rence</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {DOCTRINES.map(d => (
                      <button
                        key={d.country}
                        onClick={() => setSelectedDoctrine(d.country)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedDoctrine === d.country
                            ? 'bg-emerald-900/40 border-emerald-500'
                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <p className={`font-semibold text-sm ${selectedDoctrine === d.country ? 'text-emerald-400' : 'text-white'}`}>{d.country}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{d.employment_concept}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <div className="flex-1 h-1.5 bg-gray-700 rounded-full">
                            <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${d.dronization_level * 10}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{d.dronization_level}/10</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category filters */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                    Cat\u00E9gories <span className="text-gray-500 font-normal">(vide = toutes)</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          categoryFilters.has(cat)
                            ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {cat.replace(/_/g, ' ')}
                        {categoryFilters.has(cat) && <span className="ml-1">&#10003;</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status filters */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                    Statut <span className="text-gray-500 font-normal">(vide = tous)</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allStatuses.map(st => (
                      <button
                        key={st}
                        onClick={() => toggleStatusFilter(st)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          statusFilters.has(st)
                            ? 'border-emerald-500 text-emerald-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                        style={{
                          backgroundColor: statusFilters.has(st)
                            ? (STATUS_COLORS[st] ?? '#22c55e') + '20'
                            : undefined,
                        }}
                      >
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: STATUS_COLORS[st] }} />
                        {st.replace(/_/g, ' ')}
                        {statusFilters.has(st) && <span className="ml-1">&#10003;</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-8">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">R\u00E9sum\u00E9 des s\u00E9lections</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Mission</p>
                      <p className="text-white font-semibold">{selectedMission}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Th\u00E9\u00E2tre</p>
                      <p className="text-white font-semibold">{selectedTheatre}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Budget max</p>
                      <p className="text-emerald-400 font-semibold">{fmtBudgetSlider(wizardBudget)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Doctrine</p>
                      <p className="text-white font-semibold">{selectedDoctrine}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    {wizardFilteredSystems.length} syst\u00E8me{wizardFilteredSystems.length > 1 ? 's' : ''} correspondant{wizardFilteredSystems.length > 1 ? 's' : ''} aux crit\u00E8res
                  </p>
                </div>

                {/* Nav */}
                <div className="flex justify-between">
                  <button onClick={() => setDashStep(1)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors border border-gray-700">
                    Pr\u00E9c\u00E9dent
                  </button>
                  <button onClick={() => setDashStep(3)} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-900/30">
                    Voir les r\u00E9sultats
                  </button>
                </div>
              </div>
            )}

            {/* ===== STEP 3: Results ===== */}
            {dashStep === 3 && (
              <div>
                <h2 className="text-xl font-bold mb-2">R\u00E9sultats de l&apos;analyse</h2>
                <p className="text-gray-400 text-sm mb-6">
                  {selectedMission} / {selectedTheatre} / Budget \u2264 {fmtBudgetSlider(wizardBudget)} / Doctrine {selectedDoctrine}
                </p>

                {/* KPI cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Syst\u00E8mes retenus</p>
                    <p className="text-2xl font-bold text-white mt-1">{wizardScoredSystems.length}</p>
                    <p className="text-xs text-gray-500 mt-1">sur {totalSystems} au total</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Utilisation budget</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{fmtPct(wizardBudgetUtilization)}</p>
                    <p className="text-xs text-gray-500 mt-1">co\u00FBt top 3 / budget</p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Meilleur syst\u00E8me</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1 truncate">
                      {wizardTop3.length > 0 ? wizardTop3[0].system.name : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {wizardTop3.length > 0 ? `Score: ${wizardTop3[0].score.toFixed(2)}` : '-'}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Alignement doctrinal</p>
                    <p className={`text-2xl font-bold mt-1 ${wizardDoctrineAlignment >= 0.5 ? 'text-emerald-400' : wizardDoctrineAlignment > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {fmtPct(wizardDoctrineAlignment)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">doctrine {selectedDoctrine}</p>
                  </div>
                </div>

                {wizardScoredSystems.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-2xl text-gray-500 mb-4">Aucun syst\u00E8me ne correspond aux crit\u00E8res</p>
                    <p className="text-gray-600 text-sm mb-6">Essayez d&apos;augmenter le budget ou de retirer des filtres.</p>
                    <button onClick={() => setDashStep(2)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg border border-gray-700">
                      Modifier les filtres
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Filtered systems table */}
                    <div className="mb-8">
                      <h3 className="font-semibold text-gray-300 mb-3">Classement des syst\u00E8mes</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-700 text-gray-400">
                              {['#', 'Syst\u00E8me', 'Pays', 'Cat\u00E9gorie', 'Co\u00FBt unit.', 'Score', 'Co\u00FBt', 'Pr\u00E9c.', 'EW', 'Port\u00E9e'].map(h => (
                                <th key={h} className="py-2 px-3 text-left text-xs">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {wizardScoredSystems.map(({ system: sys, score }, idx) => (
                              <tr key={sys.id} className={`border-b border-gray-800 hover:bg-gray-800/50 ${idx < 3 ? 'bg-emerald-900/10' : ''}`}>
                                <td className="py-2 px-3 text-gray-500 font-mono text-xs">{idx + 1}</td>
                                <td className="py-2 px-3 font-semibold text-white">
                                  {idx === 0 && <span className="text-emerald-400 mr-1">&#9733;</span>}
                                  {sys.name}
                                </td>
                                <td className="py-2 px-3 text-gray-300">{sys.country}</td>
                                <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs bg-gray-700">{sys.category.replace(/_/g, ' ')}</span></td>
                                <td className="py-2 px-3 tabular-nums text-emerald-400">{sys.costs.unit_cost_display}</td>
                                <td className="py-2 px-3 tabular-nums font-bold text-cyan-400">{score.toFixed(2)}</td>
                                <td className="py-2 px-3 tabular-nums">{sys.scores.cost}/10</td>
                                <td className="py-2 px-3 tabular-nums">{sys.scores.precision}/10</td>
                                <td className="py-2 px-3 tabular-nums">{sys.scores.ew_resistance}/10</td>
                                <td className="py-2 px-3 tabular-nums">{fmt(sys.specs.range_km)} km</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Radar chart top 3 */}
                      {wizardTop3.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-300 mb-3">
                            Radar — Top {Math.min(3, wizardTop3.length)}
                          </h3>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart data={wizardRadarData}>
                                <PolarGrid stroke="#333" />
                                <PolarAngleAxis dataKey="axis" tick={{ fill: '#999', fontSize: 11 }} />
                                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#666' }} />
                                {wizardTop3.map(({ system }, i) => (
                                  <Radar
                                    key={system.id}
                                    name={system.name}
                                    dataKey={system.name}
                                    stroke={COLORS[i]}
                                    fill={COLORS[i]}
                                    fillOpacity={0.15}
                                  />
                                ))}
                                <Legend />
                                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Bar chart all filtered by score */}
                      <div>
                        <h3 className="font-semibold text-gray-300 mb-3">Scores contextuels</h3>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={wizardScoredSystems.slice(0, 10).map(({ system, score }) => ({
                                name: system.name.length > 14 ? system.name.substring(0, 14) + '...' : system.name,
                                score: +score.toFixed(2),
                              }))}
                              layout="vertical"
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis type="number" domain={[0, 10]} tick={{ fill: '#999' }} />
                              <YAxis dataKey="name" type="category" tick={{ fill: '#999', fontSize: 10 }} width={120} />
                              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                              <Bar dataKey="score" fill="#22c55e" name="Score contextuel" radius={[0, 4, 4, 0]}>
                                {wizardScoredSystems.slice(0, 10).map((_, i) => (
                                  <Cell key={i} fill={i < 3 ? '#22c55e' : i < 6 ? '#3b82f6' : '#6b7280'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Doctrinal recommendation */}
                    <div className="bg-gradient-to-r from-emerald-900/30 to-gray-800/50 rounded-xl p-6 mb-8 border border-emerald-900/30">
                      <h3 className="font-semibold text-emerald-400 mb-3">Recommandation doctrinale — {selectedDoctrine}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500">Concept d&apos;emploi</p>
                          <p className="text-white font-semibold">{wizardDoctrine.employment_concept}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Budget d\u00E9fense 2025</p>
                          <p className="text-white font-semibold">{fmtUSD(wizardDoctrine.budget_2025_bds * 1_000_000)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Objectif dronisation 2030</p>
                          <p className="text-emerald-400 font-semibold">{wizardDoctrine.objective_2030_pct}%</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 mb-3">{wizardDoctrine.strategic_focus}</p>
                      {wizardDoctrine.key_systems.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Syst\u00E8mes cl\u00E9s de la doctrine :</p>
                          <div className="flex flex-wrap gap-2">
                            {wizardDoctrine.key_systems.map(sysId => {
                              const sys = SYSTEMS.find(s => s.id === sysId);
                              const isInFiltered = wizardFilteredSystems.some(s => s.id === sysId);
                              return (
                                <span
                                  key={sysId}
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    isInFiltered
                                      ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'
                                      : 'bg-gray-800 text-gray-500 border border-gray-700'
                                  }`}
                                >
                                  {sys?.name ?? sysId} {isInFiltered ? '(retenu)' : '(exclu)'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Nav */}
                <div className="flex justify-between">
                  <button onClick={() => setDashStep(2)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors border border-gray-700">
                    Pr\u00E9c\u00E9dent
                  </button>
                  <button onClick={resetWizard} className="px-6 py-2 bg-red-900/50 hover:bg-red-900/70 text-red-400 font-medium rounded-lg transition-colors border border-red-800/50">
                    R\u00E9initialiser
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======= 2. CATALOGUE ======= */}
        {activeTab === 2 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Catalogue — {SYSTEMS.length} syst\u00E8mes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    {['Syst\u00E8me', 'Pays', 'Cat\u00E9gorie', 'Statut', 'Co\u00FBt unit.', 'Port\u00E9e', 'Co\u00FBt', 'Pr\u00E9c.', 'EW', 'IA'].map(h => (
                      <th key={h} className="py-2 px-3 text-left text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SYSTEMS.map(sys => (
                    <tr key={sys.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-3 font-semibold text-white">{sys.name}</td>
                      <td className="py-2 px-3 text-gray-300">{sys.country}</td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs bg-gray-700">{sys.category.replace(/_/g, ' ')}</span></td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: STATUS_COLORS[sys.status] + '30', color: STATUS_COLORS[sys.status] }}>{sys.status.replace(/_/g, ' ')}</span></td>
                      <td className="py-2 px-3 tabular-nums text-emerald-400">{sys.costs.unit_cost_display}</td>
                      <td className="py-2 px-3 tabular-nums">{fmt(sys.specs.range_km)} km</td>
                      <td className="py-2 px-3 tabular-nums font-bold">{sys.scores.cost}/10</td>
                      <td className="py-2 px-3 tabular-nums">{sys.scores.precision}/10</td>
                      <td className="py-2 px-3 tabular-nums">{sys.scores.ew_resistance}/10</td>
                      <td className="py-2 px-3 tabular-nums">{sys.scores.ai_autonomy}/4</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ======= 3. COMPARATEUR RADAR ======= */}
        {activeTab === 3 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Comparateur — 8 axes</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-400">Syst\u00E8me A (bleu)</label>
                <select value={compA} onChange={e => setCompA(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1">
                  {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.country})</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Syst\u00E8me B (rouge)</label>
                <select value={compB} onChange={e => setCompB(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1">
                  {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name} ({s.country})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Radar */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: '#999', fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#666' }} />
                    <Radar name={sysA.name} dataKey={sysA.name} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    <Radar name={sysB.name} dataKey={sysB.name} stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                    <Legend />
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Ratio asymetrique */}
              <div className="flex flex-col gap-4">
                <div className="bg-gray-800 rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-400">Ratio co\u00FBt unitaire</p>
                  <p className="text-5xl font-black text-emerald-400 mt-2">
                    {sysA.costs.unit_cost_usd > sysB.costs.unit_cost_usd
                      ? `${fmt(sysA.costs.unit_cost_usd / sysB.costs.unit_cost_usd, 0)}\u00D7`
                      : sysB.costs.unit_cost_usd > sysA.costs.unit_cost_usd
                        ? `${fmt(sysB.costs.unit_cost_usd / sysA.costs.unit_cost_usd, 0)}\u00D7`
                        : '1\u00D7'
                    }
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {sysA.costs.unit_cost_display} vs {sysB.costs.unit_cost_display}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-700"><th className="py-2 text-left text-gray-400">Axe</th><th className="py-2 text-right text-blue-400">{sysA.name}</th><th className="py-2 text-right text-red-400">{sysB.name}</th></tr></thead>
                    <tbody>
                      {SCORE_AXES.map(ax => (
                        <tr key={ax.key} className="border-b border-gray-800">
                          <td className="py-1.5 text-gray-300">{ax.label}</td>
                          <td className={`py-1.5 text-right tabular-nums font-semibold ${sysA.scores[ax.key] >= sysB.scores[ax.key] ? 'text-blue-400' : 'text-gray-500'}`}>{sysA.scores[ax.key]}</td>
                          <td className={`py-1.5 text-right tabular-nums font-semibold ${sysB.scores[ax.key] >= sysA.scores[ax.key] ? 'text-red-400' : 'text-gray-500'}`}>{sysB.scores[ax.key]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ======= 4. TCO ======= */}
        {activeTab === 4 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Simulateur TCO — Co\u00FBt total de possession</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-400">Syst\u00E8me</label>
                <select value={tcoSystem} onChange={e => setTcoSystem(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1">
                  {SYSTEMS.map(s => <option key={s.id} value={s.id}>{s.name} — {s.costs.unit_cost_display}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Quantit\u00E9 : {tcoQty.toLocaleString('fr-FR')}</label>
                <input type="range" min={1} max={10000} value={tcoQty} onChange={e => setTcoQty(+e.target.value)} className="w-full mt-1 accent-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">Ann\u00E9es de service : {tcoYears}</label>
                <input type="range" min={1} max={30} value={tcoYears} onChange={e => setTcoYears(+e.target.value)} className="w-full mt-1 accent-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'TCO Total', val: fmtUSD(tcoResult.totalTCO), color: 'text-white' },
                { label: 'TCO / unit\u00E9', val: fmtUSD(tcoResult.tcoPerUnit), color: 'text-emerald-400' },
                { label: 'TCO / an', val: fmtUSD(tcoResult.tcoPerYear), color: 'text-blue-400' },
                { label: '\u00C9conomie learning', val: fmtUSD(tcoResult.savingsVsLinear), color: 'text-amber-400' },
              ].map(k => (
                <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.val}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TCO breakdown pie */}
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">D\u00E9composition TCO</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tcoResult.tcoBreakdown.filter(b => b.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                        label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {tcoResult.tcoBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip formatter={(v: ValueType | undefined) => fmtUSD(Number(v ?? 0))} contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Learning curve */}
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">Courbe d&apos;apprentissage (Wright)</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={tcoResult.learningCurveData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="unit" tick={{ fill: '#999', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#999', fontSize: 10 }} tickFormatter={(v: number) => fmtUSD(v)} />
                      <Tooltip formatter={(v: ValueType | undefined) => fmtUSD(Number(v ?? 0))} contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                      <Legend />
                      <Line type="monotone" dataKey="cost" stroke="#3b82f6" name="Co\u00FBt unit\u00E9 N" dot={false} />
                      <Line type="monotone" dataKey="avgCost" stroke="#22c55e" name="Co\u00FBt moyen" dot={false} strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ======= 5. CPE ======= */}
        {activeTab === 5 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Co\u00FBt par Effet (CPE)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-400">Munition</label>
                <select value={cpeSystem} onChange={e => setCpeSystem(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1">
                  {SYSTEMS.filter(s => ['FPV', 'Loitering_Munition', 'Naval_USV'].includes(s.category)).map(s => <option key={s.id} value={s.id}>{s.name} — {s.costs.unit_cost_display}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Valeur cible ($)</label>
                <input type="number" value={cpeTargetValue} onChange={e => setCpeTargetValue(+e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-gray-400">P(touch\u00E9) : {(cpePHit * 100).toFixed(0)}%</label>
                <input type="range" min={0.1} max={1} step={0.05} value={cpePHit} onChange={e => setCpePHit(+e.target.value)} className="w-full mt-1 accent-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400">P(kill|touch\u00E9) : {(cpePKill * 100).toFixed(0)}%</label>
                <input type="range" min={0.1} max={1} step={0.05} value={cpePKill} onChange={e => setCpePKill(+e.target.value)} className="w-full mt-1 accent-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'CPE', val: fmt(cpeResult.cpe, 4), color: cpeResult.isEconomicallyViable ? 'text-emerald-400' : 'text-red-400' },
                { label: 'Ratio d\'\u00E9change', val: `${fmt(cpeResult.exchangeRatio, 0)}\u00D7`, color: 'text-blue-400' },
                { label: 'Co\u00FBt / kill', val: fmtUSD(cpeResult.costPerKill), color: 'text-white' },
                { label: 'Kills / 1M$', val: fmt(cpeResult.expectedKillsPerMillion, 1), color: 'text-amber-400' },
                { label: 'Viable', val: cpeResult.isEconomicallyViable ? 'OUI' : 'NON', color: cpeResult.isEconomicallyViable ? 'text-emerald-400' : 'text-red-400' },
              ].map(k => (
                <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.val}</p>
                </div>
              ))}
            </div>

            {/* CPE comparison across all munitions */}
            <h3 className="font-semibold text-gray-300 mb-3">Comparaison CPE — toutes munitions vs cible \u00E0 {fmtUSD(cpeTargetValue)}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={SYSTEMS.filter(s => ['FPV', 'Loitering_Munition', 'Naval_USV'].includes(s.category)).map(s => {
                  const r = calculateCPE({ munitionCost: s.costs.unit_cost_usd, pHit: 0.7, pKillGivenHit: 0.8, targetValue: cpeTargetValue });
                  return { name: s.name.substring(0, 15), ratio: +r.exchangeRatio.toFixed(0), cpe: +r.cpe.toFixed(4) };
                })} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" tick={{ fill: '#999' }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#999', fontSize: 10 }} width={120} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                  <Bar dataKey="ratio" fill="#22c55e" name="Ratio d'\u00E9change" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ======= 6. WARGAME ======= */}
        {activeTab === 6 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Wargame — Simulation d&apos;engagement</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Attaquants */}
              <div className="bg-gray-800 rounded-lg p-4 border border-red-900/50">
                <h3 className="text-red-400 font-semibold text-sm mb-3">Attaquant</h3>
                {wgAttackers.map((a, i) => (
                  <div key={i} className="mb-2 text-xs text-gray-300">
                    <span className="font-semibold">{a.name}</span> \u00D7 {a.quantity} — {fmtUSD(a.unitCost)}/u
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">Co\u00FBt total : <span className="text-red-400 font-semibold">{fmtUSD(wgResult.totalAttackCost)}</span></p>
              </div>
              {/* Defenseurs */}
              <div className="bg-gray-800 rounded-lg p-4 border border-blue-900/50">
                <h3 className="text-blue-400 font-semibold text-sm mb-3">D\u00E9fenseur</h3>
                {wgDefenders.map((d, i) => (
                  <div key={i} className="mb-2 text-xs text-gray-300">
                    <span className="font-semibold">{d.name}</span> \u00D7 {d.quantity} — P(int) {(d.pIntercept * 100).toFixed(0)}%
                  </div>
                ))}
                <p className="text-xs text-gray-500 mt-2">Co\u00FBt total : <span className="text-blue-400 font-semibold">{fmtUSD(wgResult.totalDefenseCost)}</span></p>
              </div>
              {/* Cibles */}
              <div className="bg-gray-800 rounded-lg p-4 border border-amber-900/50">
                <h3 className="text-amber-400 font-semibold text-sm mb-3">Cibles</h3>
                {wgTargets.map((t, i) => (
                  <div key={i} className="mb-2 text-xs text-gray-300">
                    <span className="font-semibold">{t.name}</span> \u00D7 {t.quantity} — {fmtUSD(t.value)}
                  </div>
                ))}
              </div>
            </div>

            {/* Resultat */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Menaces lanc\u00E9es', val: fmt(wgResult.threatsLaunched), color: 'text-red-400' },
                { label: 'Intercept\u00E9es', val: fmt(wgResult.threatsIntercepted), color: 'text-blue-400' },
                { label: 'P\u00E9n\u00E9trantes', val: fmt(wgResult.threatsPenetrating), color: 'text-amber-400' },
                { label: 'Dommages estim\u00E9s', val: fmtUSD(wgResult.expectedDamageValue), color: 'text-white' },
              ].map(k => (
                <div key={k.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-xs text-gray-400">{k.label}</p>
                  <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.val}</p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-gray-800 to-gray-800/50 rounded-xl p-6 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Ratio attaquant</p>
                <p className="text-4xl font-black text-emerald-400">{fmt(wgResult.attackerRatio, 1)}\u00D7</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Conclusion</p>
                <p className="text-lg font-bold text-white">{wgResult.conclusion}</p>
              </div>
            </div>

            {/* Entonnoir d'interception */}
            {wgResult.phaseBreakdown.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-300 mb-3">Entonnoir d&apos;interception</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wgResult.phaseBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="phase" tick={{ fill: '#999', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#999' }} />
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="threatsIn" fill="#ef4444" name="Entr\u00E9e" />
                      <Bar dataKey="intercepted" fill="#3b82f6" name="Intercept\u00E9es" />
                      <Bar dataKey="threatsOut" fill="#f59e0b" name="Sortie" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======= 7. SUPPLY CHAIN ======= */}
        {activeTab === 7 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Mati\u00E8res critiques — Supply Chain D\u00E9fense</h2>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    {['Mati\u00E8re', 'Usage d\u00E9fense', 'Part Chine', 'Risque', 'D\u00E9lai subst.', 'Alternative'].map(h => (
                      <th key={h} className="py-2 px-3 text-left text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MATERIALS.map(m => (
                    <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-3 font-semibold text-white">{m.name}</td>
                      <td className="py-2 px-3 text-gray-300 text-xs">{m.defense_usage}</td>
                      <td className="py-2 px-3"><span className={`font-bold tabular-nums ${m.china_share_pct > 70 ? 'text-red-400' : m.china_share_pct > 50 ? 'text-amber-400' : 'text-gray-300'}`}>{m.china_share_pct}%</span></td>
                      <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: RISK_COLORS[m.risk_level] + '30', color: RISK_COLORS[m.risk_level] }}>{m.risk_level}</span></td>
                      <td className="py-2 px-3 tabular-nums">{m.substitution_delay_months} mois</td>
                      <td className="py-2 px-3 text-xs text-gray-400">{m.alternative}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Matrice risque */}
            <h3 className="font-semibold text-gray-300 mb-3">Matrice de risque — Part Chine vs D\u00E9lai de substitution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MATERIALS.map(m => ({ name: m.name, chine: m.china_share_pct, delai: m.substitution_delay_months }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fill: '#999' }} label={{ value: '% Chine', angle: -90, position: 'insideLeft', fill: '#999' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#999' }} label={{ value: 'Mois', angle: 90, position: 'insideRight', fill: '#999' }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="chine" fill="#ef4444" name="Part Chine (%)" />
                  <Bar yAxisId="right" dataKey="delai" fill="#f59e0b" name="D\u00E9lai substitution (mois)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* ======= 8. STOCKS & DOCTRINES ======= */}
        {activeTab === 8 && (
          <section>
            <h2 className="text-xl font-bold mb-4">Stocks & Capacit\u00E9 de production</h2>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    {['Pays', 'Syst\u00E8me', 'Stock est.', 'Prod./mois', 'Surge 18m', 'Stock guerre', 'Facteur limitant'].map(h => (
                      <th key={h} className="py-2 px-3 text-left text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STOCKS.map(s => (
                    <tr key={s.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 px-3 text-gray-300">{s.country}</td>
                      <td className="py-2 px-3 font-semibold text-white">{s.system_name}</td>
                      <td className="py-2 px-3 tabular-nums">{s.estimated_stock.toLocaleString('fr-FR')}</td>
                      <td className="py-2 px-3 tabular-nums">{s.monthly_production.toLocaleString('fr-FR')}</td>
                      <td className="py-2 px-3 tabular-nums text-emerald-400">{s.surge_capacity_18m.toLocaleString('fr-FR')}</td>
                      <td className="py-2 px-3">
                        {s.months_of_stock_wartime != null && (
                          <span className={`font-bold tabular-nums ${s.months_of_stock_wartime > 12 ? 'text-emerald-400' : s.months_of_stock_wartime > 6 ? 'text-amber-400' : 'text-red-400'}`}>
                            {fmt(s.months_of_stock_wartime, 1)} mois
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-400">{s.limiting_factor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-xl font-bold mb-4">Doctrines par pays</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DOCTRINES.map(d => (
                <div key={d.country} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white">{d.country}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-400">{d.employment_concept}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div><p className="text-gray-500">Budget 2025</p><p className="font-semibold text-white">{fmtUSD(d.budget_2025_bds * 1_000_000)}</p></div>
                    <div><p className="text-gray-500">% PIB</p><p className="font-semibold text-white">{d.pct_gdp_2025}%</p></div>
                    <div><p className="text-gray-500">Part drones</p><p className="font-semibold text-emerald-400">{d.drone_share_pct}%</p></div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">Dronisation</span>
                    <div className="flex-1 h-2 bg-gray-700 rounded-full">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${d.dronization_level * 10}%` }} />
                    </div>
                    <span className="text-xs font-bold text-white">{d.dronization_level}/10</span>
                  </div>
                  <p className="text-xs text-gray-400">{d.strategic_focus}</p>
                  <p className="text-xs text-gray-500 mt-1">Objectif 2030 : <span className="text-amber-400 font-semibold">{d.objective_2030_pct}%</span> dronisation</p>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
