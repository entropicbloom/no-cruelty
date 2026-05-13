# no-cruelty

Phone-camera web app: snap a photo of a food product, see how the animal was treated. Score data is sourced from independent animal-welfare organisations; the source is shown on every result.

## How it works

1. **Camera mode** — the photo is sent to a vision LLM, which is constrained (via a tool/JSON schema) to emit `productType` (e.g. `beef`, `pork`, `eggs`) and a list of plausible `labels` from the catalog loaded out of `data/sources/*.json`.
2. **Manual mode** — pick a product type from an icon grid, then pick a label from a tier-coded list. No LLM call.
3. **Lookup** — the server fuzzy-matches detected labels against every loaded source's entries. Multiple matches across sources are surfaced; the tier-rank-1 match is highlighted.
4. **No match** — a `KI-Recherche` button calls the LLM with web search to produce a tentative tier + cited sources, clearly marked as AI-generated rather than curated.

## Data sources

Drop a JSON file into `data/sources/` and it's picked up automatically — no code changes. See `data/sources/_template.example.json` for the schema. Each source defines its own tier system (1 = best, n = worst), product types, and labelled entries. The current bundled source is [Essen mit Herz](https://essenmitherz.ch/label-und-marken/) (STS, Switzerland), which covers beef / veal / pork / chicken / eggs / milk. To cover fish, lamb, cheese etc., add another source file.

## Vision-model choice

`claude-haiku-4-5` is the default (`VISION_MODEL` env var to override). At ~$1/MTok input · ~$5/MTok output, a typical scan is ~3 k input + ~100 output tokens → **roughly $0.003–0.005 per scan**. Excellent vision quality and tool-use compliance keeps the structured-output stable.

If cost matters more than ecosystem fit, **Gemini 2.5 Flash** is roughly an order of magnitude cheaper for the same task and supports JSON-schema output too — swap the SDK in `lib/vision.ts`. GPT-4o-mini is in the same ballpark cost-wise; Haiku 4.5 tends to follow constrained enum output more reliably.

The system prompt embeds the full catalog of known product types + labels per type, so the model is constrained by the actual data — fuzzy matching downstream forgives near-misses.

## Run

```bash
cp .env.example .env.local       # add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open `http://localhost:3000` on your phone (same network) — the camera button uses the device's rear camera via `<input capture="environment">`, so no extra permissions plumbing.

## Structure

```
app/
  page.tsx              landing
  Scanner.tsx           camera + manual UI + result panels
  api/
    identify/route.ts   POST image → vision LLM → lookup
    lookup/route.ts     POST {productType,label} → lookup (no LLM)
    research/route.ts   POST unknown combo → LLM + web search
    catalog/route.ts    GET available product types + labels
lib/
  sources.ts            loads all data/sources/*.json + fuzzy lookup
  vision.ts             Anthropic SDK + structured-output tool
  types.ts
data/sources/
  essenmitherz.ch.json
  _template.example.json
```

## Roadmap

- [ ] Scrape actual label logos from each source and add `logoUrl` to entries for richer manual-mode tiles.
- [ ] Persist research results so each unknown combination only costs one LLM call across all users.
- [ ] Add at least one fish-welfare source (e.g. WWF Seafood Guide).
- [ ] PWA manifest + offline catalog for the manual path.
