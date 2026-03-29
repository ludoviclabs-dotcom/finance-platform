'use client';

import { useNeural } from '@/lib/neural-hub/context';

export default function InterAgentBanner() {
  const { flow, results } = useNeural();

  const items = [
    {
      agent: 'MultiCurrency',
      dotColor: 'bg-blue-400',
      label: 'P&L change',
      value: `${flow.fxPnLImpact >= 0 ? '+' : ''}${flow.fxPnLImpact.toLocaleString('fr-FR')} K€`,
    },
    {
      agent: 'Inventaire',
      dotColor: 'bg-emerald-400',
      label: 'Stocks mère',
      value: `${(flow.parentInventoryValue / 1000).toFixed(0)} K€`,
    },
    {
      agent: 'Royalties',
      dotColor: 'bg-purple-400',
      label: 'Éliminations',
      value: `${flow.royaltyElimination.toLocaleString('fr-FR')} K€`,
    },
    {
      agent: 'Couverture',
      dotColor: 'bg-cyan-400',
      label: 'OCI hedge',
      value: `${flow.hedgingOCI.toLocaleString('fr-FR')} K€`,
    },
  ];

  // results utilisé pour le badge CA consolidé dans le bandeau
  const caConsolide = results.consolidation.consolidatedRevenue;

  return (
    <div className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-amber-500/5 border border-gray-800 rounded-2xl p-4 mb-8">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <h3 className="text-sm font-bold text-gray-300">
            Données temps réel — Agents NEURAL interconnectés
          </h3>
        </div>
        <span className="text-[10px] text-gray-500 hidden sm:block">
          CA consolidé : {caConsolide.toLocaleString('fr-FR')} K€
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(item => (
          <div key={item.agent} className="flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
            <span className={`w-2 h-2 ${item.dotColor} rounded-full flex-shrink-0`} />
            <div className="min-w-0">
              <span className="text-gray-500 text-[10px] block truncate">{item.agent} →</span>
              <span className="text-white text-xs font-medium block truncate">
                {item.label} : {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-gray-600 text-[10px] mt-2 italic">
        Un changement de taux dans MultiCurrency recalcule automatiquement le bilan consolidé.
      </p>
    </div>
  );
}
