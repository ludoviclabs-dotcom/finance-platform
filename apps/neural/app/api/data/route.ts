// ============================================================
// GET /api/data — Parse all Excel files and return structured JSON
// Used by the client-side NeuralStore to hydrate with real data
// ============================================================

import { NextResponse } from 'next/server';
import { parseConsolidation } from '@/lib/neural-hub/parsers/parse-consolidation';
import { parseInventaire } from '@/lib/neural-hub/parsers/parse-inventaire';
import { parseMultiCurrency } from '@/lib/neural-hub/parsers/parse-multicurrency';
import { parseRoyalty } from '@/lib/neural-hub/parsers/parse-royalty';
import { parseArtisanTalent } from '@/lib/neural-hub/parsers/parse-artisan-talent';
import { parseCompBenchmark } from '@/lib/neural-hub/parsers/parse-comp-benchmark';
import { parseOnboarding } from '@/lib/neural-hub/parsers/parse-onboarding';

// Revalidate every hour — Excel files are static between deploys.
// Next.js also invalidates the cache automatically on each new deployment.
export const revalidate = 3600;

export async function GET() {
  try {
    const consolidation = parseConsolidation();
    const inventaire = parseInventaire();
    const multiCurrency = parseMultiCurrency();
    const royalty = parseRoyalty();
    const artisanTalent = parseArtisanTalent();
    const compBenchmark = parseCompBenchmark();
    const onboarding = parseOnboarding();

    return NextResponse.json({
      // Finance branch
      consolidation,
      inventaire,
      multiCurrency,
      royalty,
      // RH branch
      artisanTalent,
      compBenchmark,
      onboarding,
      parsedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error parsing Excel data:', error);
    return NextResponse.json(
      { error: 'Failed to parse Excel data', details: String(error) },
      { status: 500 }
    );
  }
}
