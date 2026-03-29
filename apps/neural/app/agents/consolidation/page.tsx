'use client';

import { useState } from 'react';
import { useNeural } from '@/lib/neural-hub/context';
import InterAgentBanner from '@/components/ui/InterAgentBanner';

export default function ConsolidationPage() {
  const { params, results, store } = useNeural();
  const [exporting, setExporting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [goodwillMethod, setGoodwillMethod] = useState<'partial' | 'full'>(
    params.consolidation.goodwillMethod
  );
  const [wacc, setWacc] = useState(params.consolidation.wacc * 100);

  const goodwills = store.computeGoodwill();
  const tests = store.computeImpairmentTests();
  const entities = store.getEntities();
  const conso = results.consolidation;

  const handleDownload = async (url: string, filename: string, setLoading: (v: boolean) => void) => {
    setLoading(true);
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setLoading(false);
    }
  };

  const applyParams = () => {
    store.updateParams({
      consolidation: {
        ...params.consolidation,
        goodwillMethod,
        wacc: wacc / 100,
      },
    });
  };

  const fmt = (n: number, decimals = 0) =>
    n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-foreground)] px-6 py-10 md:px-12 max-w-[1440px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <span className="text-xs font-bold text-neural-violet uppercase tracking-widest">
            Agent IA — Finance
          </span>
          <h1 className="mt-2 font-display font-extrabold text-3xl md:text-4xl tracking-tight">
            NEURAL_Consolidation_Groupe
          </h1>
          <p className="mt-1 text-sm text-[var(--color-foreground-muted)]">
            Consolidation IFRS 10 · Goodwill IFRS 3 · IAS 36 · IAS 21 · 7 entités · {params.closingDate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => handleDownload('/api/export/consolidation', 'NEURAL_Consolidation_Groupe.xlsx', setExporting)}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neural-violet/40 bg-neural-violet/10 text-neural-violet text-sm font-medium hover:bg-neural-violet/20 transition-all disabled:opacity-50"
          >
            {exporting ? '...' : '⬇ Excel Consolidation'}
          </button>
          <button
            onClick={() => handleDownload('/api/export/full-pack', 'NEURAL_Pack_Complet.zip', setExportingZip)}
            disabled={exportingZip}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-all disabled:opacity-50"
          >
            {exportingZip ? '...' : '📦 Pack Complet (.zip)'}
          </button>
        </div>
      </div>

      {/* ── Bandeau inter-agents ── */}
      <InterAgentBanner />

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'CA consolidé', value: fmt(conso.consolidatedRevenue), unit: 'K€', color: 'text-neural-violet' },
          { label: 'Résultat Part Groupe', value: fmt(conso.groupShare), unit: 'K€', color: conso.groupShare >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Goodwill net', value: fmt(conso.goodwillNet), unit: 'K€', color: 'text-blue-400' },
          { label: 'Dépréciation GW', value: fmt(conso.totalGoodwillImpairment), unit: 'K€', color: conso.totalGoodwillImpairment > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <p className="text-xs text-[var(--color-foreground-muted)] mb-1">{kpi.label}</p>
            <p className={`font-display text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-[var(--color-foreground-subtle)] mt-0.5">{kpi.unit}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">

        {/* ── Paramètres ── */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="font-display font-bold text-lg mb-4">Paramètres</h2>
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-[var(--color-foreground-muted)] mb-1">Groupe</label>
              <p className="font-medium">{params.groupName}</p>
            </div>
            <div>
              <label className="block text-[var(--color-foreground-muted)] mb-1">Devise fonctionnelle</label>
              <p className="font-medium">{params.functionalCurrency}</p>
            </div>
            <div>
              <label className="block text-[var(--color-foreground-muted)] mb-1">Date de clôture</label>
              <p className="font-medium">{params.closingDate}</p>
            </div>
            <div>
              <label className="block text-[var(--color-foreground-muted)] mb-1">Méthode goodwill</label>
              <select
                value={goodwillMethod}
                onChange={e => setGoodwillMethod(e.target.value as 'partial' | 'full')}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-1.5 text-sm"
              >
                <option value="partial">Partial Goodwill</option>
                <option value="full">Full Goodwill</option>
              </select>
            </div>
            <div>
              <label className="block text-[var(--color-foreground-muted)] mb-1">
                WACC : <span className="text-neural-violet font-bold">{wacc.toFixed(1)}%</span>
              </label>
              <input
                type="range" min={4} max={15} step={0.1}
                value={wacc}
                onChange={e => setWacc(parseFloat(e.target.value))}
                className="w-full accent-[var(--neural-violet)]"
              />
            </div>
            <button
              onClick={applyParams}
              className="w-full rounded-xl bg-neural-violet px-4 py-2 text-sm font-semibold text-white hover:bg-neural-violet-dark transition-colors"
            >
              Recalculer
            </button>
          </div>
        </div>

        {/* ── Périmètre de consolidation ── */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="font-display font-bold text-lg mb-4">Périmètre de consolidation</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-foreground-muted)]">
                  <th className="text-left py-2 pr-3">Entité</th>
                  <th className="text-center">Pays</th>
                  <th className="text-center">Devise</th>
                  <th className="text-center">% Détention</th>
                  <th className="text-center">Méthode</th>
                  <th className="text-right">CA (K devises)</th>
                </tr>
              </thead>
              <tbody>
                {entities.map(e => (
                  <tr key={e.code} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-raised)]">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-[var(--color-foreground-subtle)]">{e.code}</div>
                    </td>
                    <td className="text-center">{e.country}</td>
                    <td className="text-center font-mono">{e.currency}</td>
                    <td className="text-center">
                      {e.method === 'Mère' ? '100%' : `${(e.ownershipPct * 100).toFixed(0)}%`}
                    </td>
                    <td className="text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        e.method === 'Mère' ? 'bg-neural-violet/20 text-neural-violet' :
                        e.method === 'IG' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {e.method}
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {fmt(e.incomeStatement.revenueExternal + e.incomeStatement.revenueInterco)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Goodwill ── */}
      <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="font-display font-bold text-lg mb-1">Goodwill — IFRS 3 §32</h2>
        <p className="text-xs text-[var(--color-foreground-muted)] mb-4">
          Méthode : <span className="text-neural-violet font-semibold">
            {goodwillMethod === 'partial' ? 'Partial Goodwill' : 'Full Goodwill'}
          </span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-foreground-muted)]">
                <th className="text-left py-2 pr-3">Entité</th>
                <th className="text-center">Date acq.</th>
                <th className="text-center">% acq.</th>
                <th className="text-right">Prix (a)</th>
                <th className="text-right">NCI (b)</th>
                <th className="text-right">JV AN (d)</th>
                <th className="text-right">GW initial</th>
                <th className="text-center">Devise</th>
                <th className="text-right">GW converti K€</th>
              </tr>
            </thead>
            <tbody>
              {goodwills.map(g => (
                <tr key={g.entityCode} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-raised)]">
                  <td className="py-2 pr-3 font-medium">{g.entityName}</td>
                  <td className="text-center text-[var(--color-foreground-muted)]">{g.acquisitionDate}</td>
                  <td className="text-center">{(g.pctAcquired * 100).toFixed(0)}%</td>
                  <td className="text-right font-mono">{fmt(g.purchasePrice)}</td>
                  <td className="text-right font-mono">{fmt(g.nciAtAcquisition)}</td>
                  <td className="text-right font-mono">{fmt(g.fairValueNetAssets)}</td>
                  <td className="text-right font-mono font-semibold">{fmt(g.goodwillInitial)}</td>
                  <td className="text-center font-mono">{g.currency}</td>
                  <td className="text-right font-mono font-bold text-neural-violet">{fmt(g.goodwillConverted)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--color-border)] font-bold">
                <td colSpan={6} className="py-2 text-[var(--color-foreground-muted)]">TOTAL</td>
                <td className="text-right font-mono">{fmt(goodwills.reduce((s, g) => s + g.goodwillInitial, 0))}</td>
                <td />
                <td className="text-right font-mono text-neural-violet">{fmt(goodwills.reduce((s, g) => s + g.goodwillConverted, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tests IAS 36 ── */}
      <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="font-display font-bold text-lg mb-1">Tests de dépréciation — IAS 36</h2>
        <p className="text-xs text-[var(--color-foreground-muted)] mb-4">
          WACC : <span className="text-neural-violet font-semibold">{wacc.toFixed(1)}%</span>
          &nbsp;·&nbsp; Croissance terminale : <span className="text-neural-violet font-semibold">
            {(params.consolidation.terminalGrowthRate * 100).toFixed(1)}%
          </span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-foreground-muted)]">
                <th className="text-left py-2 pr-3">UGT</th>
                <th className="text-right">GW alloué</th>
                <th className="text-right">AN UGT</th>
                <th className="text-right">Val. comptable</th>
                <th className="text-right">VAN (VR)</th>
                <th className="text-right">Excédent / (Déficit)</th>
                <th className="text-right">Dépréciation</th>
                <th className="text-center">Statut</th>
              </tr>
            </thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.ugtName} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-raised)]">
                  <td className="py-2 pr-3 font-medium">{t.ugtName}</td>
                  <td className="text-right font-mono">{fmt(t.goodwillAllocated)}</td>
                  <td className="text-right font-mono">{fmt(t.netAssetsUGT)}</td>
                  <td className="text-right font-mono">{fmt(t.carryingValue)}</td>
                  <td className="text-right font-mono">{fmt(t.npv)}</td>
                  <td className={`text-right font-mono font-semibold ${t.surplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.surplus >= 0 ? '+' : ''}{fmt(t.surplus)}
                  </td>
                  <td className={`text-right font-mono font-bold ${t.impairment > 0 ? 'text-red-400' : 'text-[var(--color-foreground-muted)]'}`}>
                    {t.impairment > 0 ? fmt(t.impairment) : '—'}
                  </td>
                  <td className="text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      t.impairment > 0
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {t.impairment > 0 ? 'Dépréciation' : 'Validé'}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--color-border)] font-bold">
                <td className="py-2 text-[var(--color-foreground-muted)]">TOTAL</td>
                <td className="text-right font-mono">{fmt(tests.reduce((s, t) => s + t.goodwillAllocated, 0))}</td>
                <td colSpan={4} />
                <td className={`text-right font-mono ${conso.totalGoodwillImpairment > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {conso.totalGoodwillImpairment > 0 ? fmt(conso.totalGoodwillImpairment) : '—'}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Résultats consolidés ── */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="font-display font-bold text-lg mb-4">Compte de résultat consolidé</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border)]/50">
              {[
                { label: 'CA consolidé', value: conso.consolidatedRevenue, bold: false },
                { label: 'Résultat net consolidé', value: conso.consolidatedNetIncome, bold: true },
                { label: '  dont Part du Groupe', value: conso.groupShare, bold: false },
                { label: '  dont Intérêts NCI', value: conso.nciShare, bold: false },
                { label: 'Écarts de conversion', value: conso.translationDifferences, bold: false },
              ].map(row => (
                <tr key={row.label}>
                  <td className={`py-2 ${row.bold ? 'font-semibold' : 'text-[var(--color-foreground-muted)]'}`}>
                    {row.label}
                  </td>
                  <td className={`text-right font-mono ${row.bold ? 'font-bold text-neural-violet' : ''} ${row.value < 0 ? 'text-red-400' : ''}`}>
                    {fmt(row.value)} K€
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="font-display font-bold text-lg mb-4">Bilan consolidé (résumé)</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border)]/50">
              {[
                { label: 'Total actif', value: conso.totalAssets },
                { label: 'Goodwill net', value: conso.goodwillNet },
                { label: 'Capitaux propres Groupe', value: conso.totalEquityGroup },
                { label: 'Intérêts non contrôlants', value: conso.totalNCI },
                { label: 'Éliminations interco', value: conso.eliminationsCount, suffix: '' },
              ].map(row => (
                <tr key={row.label}>
                  <td className="py-2 text-[var(--color-foreground-muted)]">{row.label}</td>
                  <td className="text-right font-mono font-semibold">
                    {fmt(row.value)} {row.suffix !== '' ? 'K€' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
