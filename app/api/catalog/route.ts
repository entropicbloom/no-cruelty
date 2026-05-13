import { NextResponse } from "next/server";
import { loadSources, allProductTypes } from "@/lib/sources";

export const runtime = "edge";

export async function GET(): Promise<NextResponse> {
  const sources = loadSources();
  const productTypes = allProductTypes();
  const labelsByType: Record<string, { label: string; tier: string; sourceId: string }[]> = {};
  for (const src of sources) {
    for (const e of src.entries) {
      if (!labelsByType[e.productType]) labelsByType[e.productType] = [];
      labelsByType[e.productType].push({ label: e.label, tier: e.tier, sourceId: src.id });
    }
  }
  for (const pt of Object.keys(labelsByType)) {
    const seen = new Set<string>();
    labelsByType[pt] = labelsByType[pt].filter((x) => {
      const k = `${x.sourceId}:${x.label}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  return NextResponse.json({
    productTypes,
    labelsByProductType: labelsByType,
    sources: sources.map((s) => ({ id: s.id, name: s.name, url: s.url, region: s.region })),
  });
}
