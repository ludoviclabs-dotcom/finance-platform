import { NextResponse } from 'next/server';
import JSZip from 'jszip';
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

    const zip = new JSZip();
    const folder = zip.folder('NEURAL_Pack_Complet')!;

    // Générer un fichier placeholder pour les agents pas encore implémentés
    const placeholder = (name: string) => {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        [`NEURAL — ${name}`],
        ['Fichier généré par le Neural Data Hub'],
        [`Date : ${new Date().toLocaleDateString('fr-FR')}`],
        [''],
        ['Ce fichier est interconnecté avec les autres fichiers du pack.'],
        ['Les taux de change proviennent de NEURAL_MultiCurrency_IAS21.xlsx'],
        [''],
        ['TAUX DE CHANGE INJECTÉS'],
        ['Devise', 'Clôture', 'Moyen'],
        ...Object.keys(params.exchangeRates.closing)
          .filter(c => c !== 'EUR')
          .map(c => [c, params.exchangeRates.closing[c], params.exchangeRates.average[c]]),
      ]);
      ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, '01_PARAMETRES');
      return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    };

    folder.file('NEURAL_MultiCurrency_IAS21.xlsx', placeholder('MultiCurrency IAS21'));
    folder.file('NEURAL_Inventaire_Luxe.xlsx', placeholder('Inventaire Luxe'));
    folder.file('NEURAL_Royalties_TP.xlsx', placeholder('Royalties & Prix de Transfert'));

    // ── Consolidation complète ──
    const wb = XLSX.utils.book_new();

    // Synthèse
    const wsSynth = XLSX.utils.aoa_to_sheet([
      ['NEURAL — Consolidation Groupe — SYNTHÈSE'],
      [`Exercice clos le ${params.closingDate}`],
      [''],
      ['RÉSULTATS CONSOLIDÉS', ''],
      ['CA consolidé (K€)', results.consolidation.consolidatedRevenue],
      ['Résultat net consolidé (K€)', results.consolidation.consolidatedNetIncome],
      ['Part du Groupe (K€)', results.consolidation.groupShare],
      ['Part NCI (K€)', results.consolidation.nciShare],
      [''],
      ['BILAN', ''],
      ['Total actif (K€)', results.consolidation.totalAssets],
      ['Capitaux propres Groupe (K€)', results.consolidation.totalEquityGroup],
      ['Intérêts non contrôlants (K€)', results.consolidation.totalNCI],
      ['Goodwill net (K€)', results.consolidation.goodwillNet],
      ['Dépréciation goodwill (K€)', results.consolidation.totalGoodwillImpairment],
      [''],
      ['DONNÉES INTER-AGENTS', ''],
      ['Impact P&L change (K€)', flow.fxPnLImpact],
      ['OCI couverture (K€)', flow.hedgingOCI],
      ['Stocks mère (K€)', flow.parentInventoryValue],
      ['Éliminations redevances (K€)', flow.royaltyElimination],
      ['Écarts de conversion (K€)', results.consolidation.translationDifferences],
      ['Nb éliminations interco', results.consolidation.eliminationsCount],
    ]);
    wsSynth['!cols'] = [{ wch: 35 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsSynth, 'SYNTHESE');

    // Goodwill
    const wsGW = XLSX.utils.aoa_to_sheet([
      ['GOODWILL IFRS 3 / IAS 36'],
      [`WACC : ${(params.consolidation.wacc * 100).toFixed(1)}% | g : ${(params.consolidation.terminalGrowthRate * 100).toFixed(1)}%`],
      [''],
      ['Entité', 'Date acq.', '% acquis', 'GW initial K€', 'Devise', 'GW converti K€'],
      ...goodwills.map(g => [
        g.entityName, g.acquisitionDate, `${(g.pctAcquired * 100).toFixed(0)}%`,
        g.goodwillInitial, g.currency, g.goodwillConverted,
      ]),
      ['TOTAL', '', '', goodwills.reduce((s, g) => s + g.goodwillInitial, 0),
       '', goodwills.reduce((s, g) => s + g.goodwillConverted, 0)],
      [''],
      ['TEST IAS 36'],
      ['UGT', 'GW alloué', 'VAN', 'Excédent/(Déficit)', 'Dépréciation'],
      ...tests.map(t => [t.ugtName, t.goodwillAllocated, t.npv, t.surplus, t.impairment]),
      ['TOTAL', tests.reduce((s, t) => s + t.goodwillAllocated, 0), '', '',
       tests.reduce((s, t) => s + t.impairment, 0)],
    ]);
    wsGW['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsGW, 'GOODWILL');

    const consoBuf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    folder.file('NEURAL_Consolidation_Groupe.xlsx', consoBuf);

    // README
    folder.file('README.txt',
      `NEURAL — Pack Complet des Simulateurs
============================================

4 fichiers Excel interconnectés :

1. NEURAL_MultiCurrency_IAS21.xlsx
   → Source des taux de change EUR/USD/GBP/JPY/CHF/CNY/AED
   → Calcul P&L et OCI couverture

2. NEURAL_Inventaire_Luxe.xlsx
   → Valorisation des stocks au coût amorti
   → Marge interne alimentée par les taux MultiCurrency

3. NEURAL_Royalties_TP.xlsx
   → Redevances inter-compagnies par entité
   → Withholding tax par convention fiscale

4. NEURAL_Consolidation_Groupe.xlsx
   → Consomme les données des 3 autres agents
   → Goodwill IFRS 3 + IAS 36, bilans consolidés

Flux de données :
MultiCurrency → Inventaire → Royalties → Consolidation

Généré le : ${new Date().toLocaleDateString('fr-FR')}
Exercice   : ${params.fiscalYearStart} — ${params.fiscalYearEnd}
Groupe     : ${params.groupName}
`);

    const zipBuf = await zip.generateAsync({ type: 'arraybuffer' });

    return new NextResponse(zipBuf, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=NEURAL_Pack_Complet.zip',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur export ZIP' }, { status: 500 });
  }
}
