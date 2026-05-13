import Anthropic from "@anthropic-ai/sdk";
import type { Citation } from "./types";

const MODEL = process.env.RESEARCH_MODEL ?? "claude-sonnet-4-6";
const MAX_TURNS = Number(process.env.RESEARCH_MAX_TURNS ?? 6);
const MAX_WEB_SEARCHES = Number(process.env.RESEARCH_MAX_SEARCHES ?? 8);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ResearchOutput {
  tier: "TOP" | "OK" | "UNCOOL" | "NO_GO" | "UNKNOWN";
  summary: string;
  caveat: string;
  citations: Citation[];
  model: string;
}

const REPORT_TOOL = {
  name: "report_research",
  description:
    "Final answer. Call this exactly once after you have done sufficient research. Choose UNKNOWN only if research is genuinely inconclusive.",
  input_schema: {
    type: "object" as const,
    properties: {
      tier: { type: "string", enum: ["TOP", "OK", "UNCOOL", "NO_GO", "UNKNOWN"] },
      summary: {
        type: "string",
        description:
          "2–4 sentences in German explaining what the label requires and how strict it is on animal welfare.",
      },
      caveat: {
        type: "string",
        description: "1–2 sentences in German about uncertainty, scope limits, or what would change the rating.",
      },
      citations: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string", format: "uri" },
          },
          required: ["title", "url"],
          additionalProperties: false,
        },
      },
    },
    required: ["tier", "summary", "caveat", "citations"],
    additionalProperties: false,
  },
};

const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: MAX_WEB_SEARCHES,
} as unknown as Anthropic.Tool;

const SYSTEM = `Du bist ein Tierwohl-Recherche-Agent. Du untersuchst Lebensmittel-Labels gründlich:
- Suche nach den offiziellen Anforderungen des Labels (Standard-Dokumente, Webseite des Trägers).
- Vergleiche mit etablierten Schweizer/EU-Tierschutz-Benchmarks (Bio Knospe, Demeter, KAGfreiland, IP-SUISSE).
- Achte besonders auf: Auslauf/Weidegang, Platz im Stall, Schlachtprozess, Bestandsgrösse, Schmerzbehandlung, Lebenserwartung.

Bewertungsstufen (gleich wie Essen mit Herz / STS):
- TOP: deutliche Verbesserungen über dem Gesetz, vergleichbar mit Bio Knospe oder strenger.
- OK: erkennbare Verbesserungen über dem Gesetz, aber nicht Bio-Niveau (z.B. IP-SUISSE).
- UNCOOL: nahe am gesetzlichen Minimum, kaum echte Verbesserungen.
- NO_GO: gesetzliches Minimum oder konventioneller Import ohne Standards.
- UNKNOWN: nur wenn nach mehreren Suchen wirklich keine belastbaren Infos gefunden werden.

Arbeite in mehreren Schritten: suchen → lesen → ggf. nachsuchen → erst dann report_research aufrufen. Verwende web_search bis zu ${MAX_WEB_SEARCHES} Mal. Antworte ausschliesslich über Tools, nie als freier Text.`;

interface InflightKey {
  key: string;
}
const inflight = new Map<string, Promise<ResearchOutput>>();

export async function thoroughResearch(opts: {
  productType: string;
  productTypeDisplay?: string;
  label: string;
}): Promise<ResearchOutput> {
  const key = `${opts.productType.toLowerCase()}::${opts.label.toLowerCase()}`;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = doResearch(opts).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function doResearch(opts: {
  productType: string;
  productTypeDisplay?: string;
  label: string;
}): Promise<ResearchOutput> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Bewerte das Label "${opts.label}" für das tierische Produkt "${
        opts.productTypeDisplay ?? opts.productType
      }". Recherchiere die offiziellen Anforderungen des Labels gründlich (mehrere Suchen erlaubt) und gib am Ende eine Einschätzung via report_research zurück.`,
    },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response: Anthropic.Message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      tools: [REPORT_TOOL, WEB_SEARCH_TOOL],
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    const report = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name === "report_research",
    );
    if (report) {
      const out = report.input as Omit<ResearchOutput, "model">;
      return { ...out, model: MODEL };
    }

    if (response.stop_reason === "end_turn") break;
    if (response.stop_reason !== "tool_use") break;

    const clientToolUses = response.content.filter(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use" && c.name !== "report_research" && c.name !== "web_search",
    );
    if (clientToolUses.length === 0) {
      // Either web_search is server-handled (results inline) and we just loop again,
      // or the model is stuck. Nudge it.
      messages.push({
        role: "user",
        content:
          "Bitte schliesse jetzt ab und rufe report_research mit deiner besten Einschätzung auf.",
      });
    } else {
      // Should not happen — but if any unknown client-side tool is called, surface that.
      messages.push({
        role: "user",
        content: clientToolUses.map((t) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: "Tool not available. Use web_search or report_research.",
          is_error: true,
        })),
      });
    }
  }

  return {
    tier: "UNKNOWN",
    summary: "Recherche abgebrochen, bevor ein Ergebnis vorlag.",
    caveat: "Bitte später erneut versuchen.",
    citations: [],
    model: MODEL,
  };
}
