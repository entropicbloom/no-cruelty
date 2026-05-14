# CLAUDE.md

Context for working on this project in future sessions. Keep this file updated when load-bearing things change.

## What this is

Mobile web app that maps a photo (or manual choice) of an animal-product package to a welfare tier from the Essen mit Herz (Schweizer Tierschutz STS) dataset. Built solo, no commercial intent.

## Live + infra

- **URL**: https://tierwohl.flaessig.com (alias of `no-cruelty.pages.dev`)
- **Repo**: https://github.com/entropicbloom/no-cruelty (auto-deploys on push to `main`)
- **Hosting**: Cloudflare Pages via `@cloudflare/next-on-pages` adapter
- **DNS for flaessig.com**: Netlify. CNAME `tierwohl` → `no-cruelty.pages.dev`
- **Required Cloudflare compatibility flag**: `nodejs_compat` on Production + Preview. Without it the Anthropic SDK crashes at runtime.

## Architecture

Static frontend + serverless edge backend:

- Static (CDN): `/`, all JS/CSS bundles
- Edge Workers (`runtime = "edge"`): `/api/catalog`, `/api/identify`, `/api/lookup`, `/api/research`

No Node.js filesystem at runtime. JSON data is imported via ESM (`import x from "../data/sources/foo.json"`) so it gets bundled into the worker at build time.

Cloudflare Workers free tier: 30 s wall time per request, 100 k req/day. Anthropic calls are I/O so CPU limit isn't the constraint, wall time is.

## Data layer

- Curated sources in `data/sources/*.json`. Files starting with `_` are ignored (e.g. `_template.example.json`).
- Each source is self-describing: tier system (rank 1 = best), optional secondary metric, product types, entries with `{productType, label, tier, metrics, ...}`.
- `lib/sources.ts` loads curated sources at module init via explicit ESM imports.
- The LLM-research source is registered dynamically by `lib/llm-db.ts` via `registerExtraSource()`.
- Lookup fuzzy-matches labels (`similarity()` in `lib/sources.ts`, threshold 0.55) and sorts results: non-AI first, then best tier, then highest match score.
- Current curated source: `essenmitherz.ch.json` (164 entries across beef, veal, pork, chicken, eggs, milk).

## LLM-DB persistence

**Currently in-memory only**, per worker instance, via a `Map` in `lib/llm-db.ts`. Wiped on every deploy and on worker eviction. Not shared across edge instances. The user has accepted this for now; KV swap is on the roadmap.

When you do swap to KV: keep the `findCached`/`persist` API signatures identical, just replace the Map ops with `await env.LLM_DB.get/put`. The lookup glue (`lookupAi`) and `registerExtraSource` plumbing should not need to change.

## Models

Defaults set in code:

- Vision: `claude-sonnet-4-6` (override with `VISION_MODEL`)
- Research: `claude-sonnet-4-6` (override with `RESEARCH_MODEL`)

Both use `tool_choice` to force structured output.

- Vision (`lib/vision.ts`) uses the `identify_product` tool with `productType` enum and free-form `labels` array; downstream fuzzy match catches variants. System prompt embeds the full catalog (~1.3 k tokens).
- Research (`lib/research.ts`) uses Anthropic `web_search_20250305` (beta tool) plus a `report_research` tool. Multi-turn loop, default 6 turns and 8 searches. Wall-time-sensitive on Cloudflare free tier.

Cost ballpark: vision ~$0.01 per scan, research ~$0.02–0.05 per unknown combo (cached afterwards within the worker instance).

## UI

- Single page `app/page.tsx` + interactive `app/Scanner.tsx` (client component)
- Tabs: Foto / Manuell
- Camera uses `<input type="file" accept="image/*" capture="environment">` (no `getUserMedia`, maximises mobile compatibility)
- Client-side resize to max 1280 px before upload
- Manual tab: product-type grid with emoji icons in `PRODUCT_ICONS`, then label tile list with tier dots
- Result card: color-coded tier header (TOP/OK/UNCOOL/NO_GO → green/yellow/orange/red), label, "Schritte zum Optimum", source attribution with link
- AI source matches get a "KI-Recherche" chip in the header and show `notes` + `citations`

The "KI-Tiefenrecherche starten" button in the empty-match panel is currently **commented out** in `app/Scanner.tsx` (search for "Tiefenrecherche temporär deaktiviert"). The `/api/research` endpoint is still mounted; flip the comment to re-enable.

## Env vars (Cloudflare Pages → Settings → Variables and Secrets)

| Name | Type | Notes |
|------|------|-------|
| `ANTHROPIC_API_KEY` | **Secret** (not Plaintext) | Required |
| `NODE_VERSION` | Plaintext | `20` |
| `VISION_MODEL` | Plaintext (optional) | Defaults to `claude-sonnet-4-6` |
| `RESEARCH_MODEL` | Plaintext (optional) | Defaults to `claude-sonnet-4-6` |
| `RESEARCH_MAX_TURNS` | Plaintext (optional) | Defaults to `6` |
| `RESEARCH_MAX_SEARCHES` | Plaintext (optional) | Defaults to `8` |

## Style preferences (user-stated)

- **No em-dashes** (`—`) in user-facing copy. Use commas, periods, colons, or middle dots.
- German UI copy, Swiss conventions (`Grüsse`, `ss` instead of `ß`).
- Sober tone, no emojis, minimalist design.
- Source attribution on every result, never hide where data came from.

## Commit style

- Short English imperative subject line (under ~70 chars)
- Body explains "why" if non-obvious
- Footer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

## Open questions / things to revisit

- Persistence for the research cache (KV)
- Whether to re-enable the KI-Tiefenrecherche button in the UI
- A second data source covering fish (none picked yet)
- Label logos in manual-mode tiles (would need to scrape per-label pages on EMH and store image URLs in entries)

## Things to NOT do without asking

- Don't push a commit that changes the user-facing data semantics (tier values, scoring) without confirming with the user. The data is sourced from a real organisation; misrepresentation matters.
- Don't enable the research feature in the UI without confirming, since it incurs per-use API cost and surfaces AI-generated tiers that look similar to curated ones.
- Don't add tracking/analytics scripts to the frontend. This is a privacy-friendly hobby project.
