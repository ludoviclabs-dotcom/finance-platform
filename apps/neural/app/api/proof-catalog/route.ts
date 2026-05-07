import { NextResponse } from "next/server";

import { getProofCatalog } from "@/lib/proof-catalog";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(getProofCatalog());
}
