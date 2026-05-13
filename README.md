# no-cruelty

Mobile web app for checking the animal-welfare rating of a food product. Take a photo or pick the product manually, get the welfare tier of the visible label.

Live: https://no-cruelty.pages.dev

## Data

All current ratings come from [Essen mit Herz](https://essenmitherz.ch/label-und-marken/), the welfare-label database of Schweizer Tierschutz STS. 164 entries across beef, veal, pork, chicken, eggs, milk. The source is linked on every result; no rating is shown without attribution.

The data layer supports multiple sources. Drop a JSON file into `data/sources/` matching `data/sources/_template.example.json` and it is loaded automatically.

## How it works

- **Photo mode**: image is sent to Claude Sonnet 4.6 with a tool-constrained schema that emits the product type and visible labels (chosen from the embedded catalog). The server fuzzy-matches against the data sources.
- **Manual mode**: choose product type and label by hand. No LLM call.
- **No-match fallback**: an agentic research route (`/api/research`) calls the model with web search and persists the result. Currently hidden in the UI; the endpoint is mounted.

## Stack

Next.js 14 (App Router, edge runtime), TypeScript, Tailwind, Anthropic SDK. Deployed to Cloudflare Pages via `@cloudflare/next-on-pages`.

## Run locally

```bash
cp .env.example .env.local      # add ANTHROPIC_API_KEY
npm install
npm run dev
```

Open `http://localhost:3000` on the same network from a phone to test the camera flow.

## Layout

```
app/
  page.tsx              landing
  Scanner.tsx           camera + manual UI + result panels
  api/
    identify/route.ts   POST image -> vision LLM -> lookup
    lookup/route.ts     POST {productType,label} -> lookup
    research/route.ts   POST unknown combo -> LLM + web search
    catalog/route.ts    GET available product types + labels
lib/
  sources.ts            loads data/sources/*.json + fuzzy lookup
  vision.ts             Anthropic SDK + structured-output tool
  research.ts           agentic research loop
  llm-db.ts             in-memory cache of research results
  types.ts
data/sources/
  essenmitherz.ch.json
  _template.example.json
```

## Roadmap

- Persistence for the research cache via Cloudflare KV (currently in-memory per worker instance).
- Label logos in the manual-mode tiles.
- At least one fish-welfare source.
- PWA manifest, offline catalog for the manual path.

## License

Code: MIT. Welfare data: owned by the respective source organisation; this repo only re-displays it with attribution.
