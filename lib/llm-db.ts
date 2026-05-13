import type { Citation, Entry, LookupMatch, Source } from "./types";
import { matchesIn, registerExtraSource } from "./sources";

export interface PersistInput {
  productType: string;
  productTypeDisplay?: string;
  label: string;
  tier: "TOP" | "OK" | "UNCOOL" | "NO_GO";
  summary: string;
  caveat?: string;
  citations: Citation[];
  model: string;
}

const AI_SOURCE: Source = {
  id: "llm-research",
  name: "KI-Recherche-Datenbank",
  publisher: "Automatische Tiefenrecherche (Claude + Web)",
  url: "https://github.com/entropicbloom/no-cruelty",
  language: "de",
  region: "world",
  aiGenerated: true,
  scoreSystem: {
    type: "tiered",
    tiers: [
      { key: "TOP", rank: 1, label: "TOP", color: "green", description: "Sehr gute Vorgaben (KI-Einschätzung)" },
      { key: "OK", rank: 2, label: "OK", color: "yellow", description: "Gute Vorgaben (KI-Einschätzung)" },
      { key: "UNCOOL", rank: 3, label: "UNCOOL", color: "orange", description: "Ungenügende Vorgaben (KI-Einschätzung)" },
      { key: "NO_GO", rank: 4, label: "NO GO", color: "red", description: "Schlechte bis gar keine Vorgaben (KI-Einschätzung)" },
    ],
    secondaryMetric: null,
  },
  productTypes: {},
  entries: [],
};

registerExtraSource(AI_SOURCE);

export function normalizeKey(productType: string, label: string): string {
  return `${productType.toLowerCase().trim()}::${label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()}`;
}

export function findCached(productType: string, label: string): Entry | null {
  const want = normalizeKey(productType, label);
  return AI_SOURCE.entries.find((e) => normalizeKey(e.productType, e.label) === want) ?? null;
}

export function persist(input: PersistInput): Entry {
  const want = normalizeKey(input.productType, input.label);

  if (!AI_SOURCE.productTypes[input.productType]) {
    const display = input.productTypeDisplay ?? input.productType;
    AI_SOURCE.productTypes[input.productType] = { de: display, en: display };
  }

  const entry: Entry = {
    productType: input.productType,
    label: input.label,
    tier: input.tier,
    metrics: {},
    notes: input.summary,
    caveat: input.caveat,
    citations: input.citations,
    investigatedAt: new Date().toISOString(),
  };

  const idx = AI_SOURCE.entries.findIndex(
    (e) => normalizeKey(e.productType, e.label) === want,
  );
  if (idx >= 0) AI_SOURCE.entries[idx] = entry;
  else AI_SOURCE.entries.push(entry);

  registerExtraSource(AI_SOURCE);
  return entry;
}

export function lookupAi(productType: string, candidateLabels: string[]): LookupMatch[] {
  return matchesIn(AI_SOURCE, productType, candidateLabels);
}
