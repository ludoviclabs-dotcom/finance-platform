import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getNeuralStore } from '@/lib/neural-hub/store';

export async function GET() {
  try {
    const store = getNeuralStore();
    const params = store.getParams();
    const results = store.computeResults();
    const goodwills = store.computeGoodwill();
    const tests = store.computeImpairmentTests();
    const flow = store.getInterAgentFlow();
    const wb = XLSX.utils.book_new();

    // ── 01_PARAMETRES ──
    const p = [
      ['NEURAL — Consolidation Multi-Maisons'],
      [`Groupe ${params.groupName} — Clôture ${params.closingDate}`],
      [''],
      ['PARAMÈTRES GÉNÉRAUX'],
      ['Société mère', params.parentEntity],
      ['Devise', params.functionalCurrency],
      ['Clôture', params.closingDate],
      ['Méthode goodwill', params.consolidation.goodwillMethod === 'partial' ? 'Partial Goodwill' : 'Full Goodwill'],
      ['WACC', params.consolidation.wacc],
      ['Croissance terminale', params.consolidation.terminalGrowthRate],
      [''],
      ['TAUX DE CHANGE (Source : Neural Data Hub)'],
      ['Devise', 'Clôture', 'Moyen', 'Ouverture', 'Historique'],
      ...Object.keys(params.exchangeRates.closing)
        .filter(c => c !== 'EUR')
        .map(c => [c, params.exchangeRates.closing[c], params.exchangeRates.average[c],
          params.exchangeRates.opening[c], params.exchangeRates.historical[c]]),
      [''],
      ['DONNÉES INTER-AGENTS'],
      ['Source', 'Donnée', 'Valeur', 'Destination'],
      ['MultiCurrency', 'Impact P&L change', flow.fxPnLImpact, 'P&L consolidé'],
      ['MultiCurrency', 'Dérivés actifs', flow.derivativeAssets, 'Bilan consolidé'],
      ['MultiCurrency', 'OCI couverture', flow.hedgingOCI, 'Variation CP'],
      ['Inventaire', 'Stocks mère', flow.parentInventoryValue, 'Bilan consolidé'],
      ['Inventaire', 'Marge interne', `${(flow.internalMarginRate * 100).toFixed(0)}%`, 'Élim. E6'],
      ['Royalties', 'Total redevances', flow.royaltyElimination, 'Élim. E5'],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(p);
    ws1['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws1, '01_PARAMETRES');

    // ── 06_GOODWILL ──
    const gw = [
      ['GOODWILL & TEST IAS 36'],
      [`WACC : ${(params.consolidation.wacc * 100).toFixed(1)}% | g : ${(params.consolidation.terminalGrowthRate * 100).toFixed(1)}%`],
      [''],
      ['CALCUL DU GOODWILL — IFRS 3 §32'],
      ['Goodwill = (a) Prix + (b) NCI + (c) Part. ant. − (d) JV Actifs Nets'],
      [''],
      ['Entité', 'Date acq.', '% acquis', '(a) Prix K€', '(b) NCI K€', '(c) Part ant.',
       '(d) JV AN K€', 'GW initial K€', 'Devise', 'GW devise', 'Taux clôture', 'GW converti K€'],
      ...goodwills.map(g => [
        g.entityName, g.acquisitionDate, `${(g.pctAcquired * 100).toFixed(0)}%`,
        g.purchasePrice, g.nciAtAcquisition, g.priorParticipation, g.fairValueNetAssets,
        g.goodwillInitial, g.currency, g.goodwillInCurrency, g.closingRate, g.goodwillConverted,
      ]),
      ['TOTAL', '', '', '', '', '', '',
       goodwills.reduce((s, g) => s + g.goodwillInitial, 0),
       '', '', '', goodwills.reduce((s, g) => s + g.goodwillConverted, 0)],
      [''],
      ['TEST DE DÉPRÉCIATION — IAS 36'],
      ['UGT', 'GW alloué K€', 'AN UGT K€', 'Val. comptable K€',
       'Flux N+1', 'N+2', 'N+3', 'N+4', 'N+5', 'VT K€', 'VAN K€',
       'Val. recouvrable', 'Excédent/(Déficit)', 'Dépréciation'],
      ...tests.map(t => [
        t.ugtName, t.goodwillAllocated, t.netAssetsUGT, t.carryingValue,
        ...t.cashFlows, t.terminalValue, t.npv, t.recoverableAmount,
        t.surplus, t.impairment,
      ]),
      ['TOTAL', tests.reduce((s, t) => s + t.goodwillAllocated, 0), '', '',
       '', '', '', '', '', '', '', '', '', tests.reduce((s, t) => s + t.impairment, 0)],
    ];
    const ws6 = XLSX.utils.aoa_to_sheet(gw);
    ws6['!cols'] = Array(14).fill({ wch: 16 });
    if (ws6['!cols']) ws6['!cols'][0] = { wch: 25 };
    XLSX.utils.book_append_sheet(wb, ws6, '06_GOODWILL');

    // ── 09_BILAN_CONSO ──
    const consoData = results.consolidation;
    const bc = [
      ['BILAN CONSOLIDÉ — GROUPE AURELIA'],
      [`Au ${params.closingDate}`],
      [''],
      ['Poste', 'Réf. IFRS', 'Montant consolidé (K€)'],
      ['ACTIF NON COURANT', '', ''],
      ['Goodwill', 'IFRS 3 / IAS 36', consoData.goodwillNet],
      ['Total actif', '', consoData.totalAssets],
      [''],
      ['CAPITAUX PROPRES', '', ''],
      ['Part du Groupe', 'IFRS 10', consoData.totalEquityGroup],
      ['Intérêts non contrôlants', 'IFRS 10', consoData.totalNCI],
      [''],
      ['RÉSULTAT', '', ''],
      ['CA consolidé', 'IFRS 15', consoData.consolidatedRevenue],
      ['Résultat net consolidé', '', consoData.consolidatedNetIncome],
      ['  dont Part du Groupe', '', consoData.groupShare],
      ['  dont Part NCI', '', consoData.nciShare],
      ['Écarts de conversion', 'IAS 21', consoData.translationDifferences],
      ['Dépréciation goodwill', 'IAS 36', consoData.totalGoodwillImpairment],
      ['Éliminations interco', '', consoData.eliminationsCount],
    ];
    const ws9 = XLSX.utils.aoa_to_sheet(bc);
    ws9['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws9, '09_BILAN_CONSO');

    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=NEURAL_Consolidation_Groupe.xlsx',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur export' }, { status: 500 });
  }
}
