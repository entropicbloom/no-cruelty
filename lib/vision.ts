import Anthropic from "@anthropic-ai/sdk";
import { allLabelsByProductType, allProductTypes } from "./sources";

const MODEL = process.env.VISION_MODEL ?? "claude-sonnet-4-6";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface VisionIdentification {
  productType: string | null;
  productTypeFreeText: string | null;
  labels: string[];
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

function buildSystemPrompt(): string {
  const types = allProductTypes();
  const labelsByType = allLabelsByProductType();
  const typeLines = Object.entries(types)
    .map(([k, v]) => `  - ${k} (de: ${v.de}, en: ${v.en})`)
    .join("\n");
  const labelLines = Object.entries(labelsByType)
    .map(([k, labels]) => `  ${k}: ${[...labels].sort().join(" | ")}`)
    .join("\n");
  return `You analyze photos of food products to identify (a) the animal product type and (b) any welfare-relevant labels, certifications, or store-brand names visible on packaging.

PRODUCT TYPES (use the lowercase key):
${typeLines}

If the product is clearly an animal product but doesn't match any of the keys above (e.g. fish, lamb, cheese, butter, yogurt), set productType to null and put your best free-text guess in productTypeFreeText. If the product is not an animal product at all, set both to null.

KNOWN LABELS per product type (you may emit close variants — fuzzy matching is done downstream):
${labelLines}

For labels, list ALL plausible candidates you see — official welfare/bio labels (e.g. "Bio Knospe", "Demeter", "IP-SUISSE"), retailer welfare brands (e.g. "Coop Naturafarm", "Migros Bio"), and the bare store/price-line (e.g. "M-Budget", "Prix Garantie", "M-Classic"). Include foreign-language equivalents when visible. If you see no labels and the product looks like a generic supermarket item, emit the relevant baseline ("CH-Gesetz" for Swiss origin without label, "EU-Gesetz" for EU origin without label, "weltweit" for non-EU import without label).

Confidence:
- high: product type is unambiguous AND at least one label is clearly readable
- medium: product type clear but label uncertain, or vice versa
- low: significant uncertainty in either

Always call the identify_product tool. Never reply in plain text.`;
}

const IDENTIFY_TOOL = {
  name: "identify_product",
  description: "Return the identified animal product type and visible welfare/brand labels.",
  input_schema: {
    type: "object" as const,
    properties: {
      productType: {
        type: ["string", "null"],
        description: "Lowercase key from the known product types, or null.",
      },
      productTypeFreeText: {
        type: ["string", "null"],
        description: "Free-text product type when productType is null (e.g. 'salmon', 'cheese').",
      },
      labels: {
        type: "array",
        items: { type: "string" },
        description: "All plausible labels/brands visible. Up to 5.",
      },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      reasoning: {
        type: "string",
        description: "One short sentence on what you saw.",
      },
    },
    required: ["productType", "productTypeFreeText", "labels", "confidence", "reasoning"],
    additionalProperties: false,
  },
};

export async function identifyFromImage(opts: {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}): Promise<VisionIdentification> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(),
    tools: [IDENTIFY_TOOL],
    tool_choice: { type: "tool", name: "identify_product" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: opts.mediaType, data: opts.base64 },
          },
          {
            type: "text",
            text: "Identify the animal product type and any welfare-relevant labels you can see.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Vision model did not call the tool.");
  }
  const input = toolUse.input as VisionIdentification;
  return {
    productType: input.productType ?? null,
    productTypeFreeText: input.productTypeFreeText ?? null,
    labels: Array.isArray(input.labels) ? input.labels.slice(0, 8) : [],
    confidence: input.confidence ?? "low",
    reasoning: input.reasoning ?? "",
  };
}
