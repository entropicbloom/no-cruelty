import { NextRequest, NextResponse } from "next/server";
import { thoroughResearch } from "@/lib/research";
import { findCached, lookupAi, persist } from "@/lib/llm-db";
import { allProductTypes, lookup, sortMatches } from "@/lib/sources";
import type { IdentifyResult } from "@/lib/types";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<NextResponse<IdentifyResult | { error: string }>> {
  try {
    const body = await req.json();
    const productType: string = body?.productType;
    const label: string = body?.label;
    if (!productType || !label) {
      return NextResponse.json({ error: "productType and label required" }, { status: 400 });
    }

    const types = allProductTypes();
    const productTypeDe = types[productType]?.de ?? productType;

    const cached = findCached(productType, label);
    if (!cached) {
      const out = await thoroughResearch({ productType, productTypeDisplay: productTypeDe, label });
      if (out.tier !== "UNKNOWN") {
        persist({
          productType,
          productTypeDisplay: productTypeDe,
          label,
          tier: out.tier,
          summary: out.summary,
          caveat: out.caveat,
          citations: out.citations,
          model: out.model,
        });
      } else {
        return NextResponse.json({
          productType,
          productTypeDe,
          detectedLabels: [label],
          confidence: "low",
          matches: [],
          notes: `${out.summary} ${out.caveat}`.trim(),
        });
      }
    }

    const curated = lookup({ productType, candidateLabels: [label] });
    const ai = lookupAi(productType, [label]);
    const matches = sortMatches([...curated, ...ai]);
    return NextResponse.json({
      productType,
      productTypeDe,
      detectedLabels: [label],
      confidence: "medium",
      matches,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
