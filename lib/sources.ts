import type { Entry, LookupMatch, Source, Tier } from "./types";
import essenmitherz from "../data/sources/essenmitherz.ch.json";

const CURATED: Source[] = [essenmitherz as unknown as Source].filter((s) => !s.aiGenerated);

let extraSources: Source[] = [];

export function registerExtraSource(s: Source): void {
  extraSources = extraSources.filter((x) => x.id !== s.id);
  extraSources.push(s);
}

export function unregisterExtraSource(id: string): void {
  extraSources = extraSources.filter((x) => x.id !== id);
}

export function loadSources(): Source[] {
  return [...CURATED, ...extraSources];
}

export function invalidateSourcesCache(): void {
  // No-op: filesystem cache was removed for edge runtime compatibility.
  // Extra-source registration is the explicit refresh mechanism.
}

export function allProductTypes(): Record<string, { de: string; en: string; sources: string[] }> {
  const out: Record<string, { de: string; en: string; sources: string[] }> = {};
  for (const src of loadSources()) {
    for (const [key, names] of Object.entries(src.productTypes)) {
      if (!out[key]) out[key] = { de: names.de, en: names.en, sources: [] };
      out[key].sources.push(src.id);
    }
  }
  return out;
}

export function allLabelsByProductType(): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const src of loadSources()) {
    for (const entry of src.entries) {
      if (!out[entry.productType]) out[entry.productType] = new Set();
      out[entry.productType].add(entry.label);
    }
  }
  return out;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()\-_,./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  if (na.includes(nb) || nb.includes(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const uni = new Set([...ta, ...tb]).size;
  return inter / uni;
}

export function tierOf(source: Source, key: string): Tier {
  const t = source.scoreSystem.tiers.find((x) => x.key === key);
  if (!t) throw new Error(`Unknown tier ${key} in source ${source.id}`);
  return t;
}

export function sortMatches(matches: LookupMatch[]): LookupMatch[] {
  return [...matches].sort((a, b) => {
    const aiA = a.source.aiGenerated ? 1 : 0;
    const aiB = b.source.aiGenerated ? 1 : 0;
    if (aiA !== aiB) return aiA - aiB;
    if (a.tier.rank !== b.tier.rank) return a.tier.rank - b.tier.rank;
    return b.matchScore - a.matchScore;
  });
}

export function matchesIn(
  source: Source,
  productType: string,
  candidateLabels: string[],
): LookupMatch[] {
  const inScope = source.entries.filter((e: Entry) => e.productType === productType);
  if (inScope.length === 0) return [];
  const out: LookupMatch[] = [];
  for (const cand of candidateLabels) {
    let best: { entry: Entry; score: number } | null = null;
    for (const entry of inScope) {
      const s = similarity(cand, entry.label);
      if (!best || s > best.score) best = { entry, score: s };
    }
    if (best && best.score >= 0.55) {
      out.push({
        source,
        entry: best.entry,
        tier: tierOf(source, best.entry.tier),
        matchedLabel: cand,
        matchScore: best.score,
      });
    }
  }
  return out;
}

export interface LookupInput {
  productType: string | null;
  candidateLabels: string[];
}

export function lookup({ productType, candidateLabels }: LookupInput): LookupMatch[] {
  if (!productType || candidateLabels.length === 0) return [];
  const all: LookupMatch[] = [];
  for (const src of loadSources()) {
    all.push(...matchesIn(src, productType, candidateLabels));
  }
  const seen = new Set<string>();
  const deduped = all.filter((m) => {
    const k = `${m.source.id}:${m.entry.productType}:${m.entry.label}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return sortMatches(deduped);
}
