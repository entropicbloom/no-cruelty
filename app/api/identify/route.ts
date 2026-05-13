import { NextRequest, NextResponse } from "next/server";
import { identifyFromImage } from "@/lib/vision";
import { allProductTypes, lookup, sortMatches } from "@/lib/sources";
import { lookupAi } from "@/lib/llm-db";
import type { IdentifyResult } from "@/lib/types";

export const runtime = "edge";

export async function POST(req: NextRequest): Promise<NextResponse<IdentifyResult | { error: string }>> {
  try {
    const body = await req.json();
    const dataUrl: string | undefined = body?.image;
    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json({ error: "Missing 'image' (data URL)" }, { status: 400 });
    }
    const m = dataUrl.match(/^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/);
    if (!m) {
      return NextResponse.json({ error: "Image must be a base64 data URL" }, { status: 400 });
    }
    const mediaType = m[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    const base64 = m[3];

    const vision = await identifyFromImage({ base64, mediaType });
    const curated = lookup({
      productType: vision.productType,
      candidateLabels: vision.labels,
    });
    const ai = vision.productType
      ? lookupAi(vision.productType, vision.labels)
      : [];
    const matches = sortMatches([...curated, ...ai]);

    const types = allProductTypes();
    const result: IdentifyResult = {
      productType: vision.productType,
      productTypeDe: vision.productType ? types[vision.productType]?.de ?? null : vision.productTypeFreeText,
      detectedLabels: vision.labels,
      confidence: vision.confidence,
      matches,
      notes: vision.reasoning,
    };
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
