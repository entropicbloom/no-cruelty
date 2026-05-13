import { NextRequest, NextResponse } from "next/server";
import { allProductTypes, lookup, sortMatches } from "@/lib/sources";
import { lookupAi } from "@/lib/llm-db";
import type { IdentifyResult } from "@/lib/types";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<NextResponse<IdentifyResult | { error: string }>> {
  try {
    const body = await req.json();
    const productType: string | null = body?.productType ?? null;
    const label: string | null = body?.label ?? null;
    if (!productType || !label) {
      return NextResponse.json({ error: "productType and label are required" }, { status: 400 });
    }
    const curated = lookup({ productType, candidateLabels: [label] });
    const ai = lookupAi(productType, [label]);
    const matches = sortMatches([...curated, ...ai]);
    const types = allProductTypes();
    return NextResponse.json({
      productType,
      productTypeDe: types[productType]?.de ?? productType,
      detectedLabels: [label],
      confidence: "high",
      matches,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
