export type TierKey = string;

export interface Tier {
  key: TierKey;
  rank: number;
  label: string;
  color: "green" | "yellow" | "orange" | "red";
  description: string;
}

export interface SecondaryMetric {
  key: string;
  name: string;
  lowerIsBetter: boolean;
  description?: string;
}

export interface ScoreSystem {
  type: "tiered";
  tiers: Tier[];
  secondaryMetric: SecondaryMetric | null;
}

export interface ProductTypeNames {
  de: string;
  en: string;
}

export interface Citation {
  title: string;
  url: string;
}

export interface Entry {
  productType: string;
  label: string;
  tier: TierKey;
  metrics: Record<string, number>;
  notes?: string;
  caveat?: string;
  citations?: Citation[];
  investigatedAt?: string;
}

export interface Source {
  id: string;
  name: string;
  publisher?: string;
  url: string;
  language: string;
  region: string;
  aiGenerated?: boolean;
  scoreSystem: ScoreSystem;
  productTypes: Record<string, ProductTypeNames>;
  entries: Entry[];
}

export interface LookupMatch {
  source: Source;
  entry: Entry;
  tier: Tier;
  matchedLabel: string;
  matchScore: number;
}

export interface IdentifyResult {
  productType: string | null;
  productTypeDe: string | null;
  detectedLabels: string[];
  confidence: "low" | "medium" | "high";
  matches: LookupMatch[];
  notes?: string;
}
