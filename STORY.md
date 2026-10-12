# STORY.md — The Lore Pack Authoring Handbook

This fork ships with a **neutral placeholder pack**: the flow works end to end,
but the world is empty. This document is the map of every story/art surface and
the rules for replacing it. When the pack is rewritten, "ECOCIDE / Carbon
Minded AI / Class I–VI" become your world.

---

## 1. The one rule

**All story, copy and art live in `packages/lore`.** Components, prompts and
the server must keep reading from the pack. If a piece of world copy isn't in
`packages/lore`, it's either a deliberate placeholder in a screen (see §7) or a
bug.

Search (and replace) markers: `TODO-LORE` comments point at every provisional
string.

## 2. Identity — `packages/lore/src/identity.ts`

| Slot | Placeholder | Meaning |
| --- | --- | --- |
| `projectName` | `ecocide` | internal id / package scope |
| `appName` | `ECOCIDE` | header + PWA brand |
| `appVersion` | `0.1.0` | header version |
| `entityName` | `Carbon Minded AI` | **the in-world decider** (the old "AI Supreme Arbiter"). Used in prompts, scanner copy, emails, footer. |
| `tagline` | provisional sentence | intro/subtext |
| `worldPopulation` | 8 300 000 000 | census base number |

## 3. The taxonomy — `packages/lore/src/factions.ts` (the heart)

`FACTIONS` is an **ordered array** — this order is the percentile order (first =
top band, last = bottom/overflow). Each faction:

| Field | Meaning |
| --- | --- |
| `id` | stable internal id, **persisted in the DB** (e.g. `class-i`). Changing ids later requires DB care; keep them stable. |
| `name` | display name (`Class I`) — shown everywhere |
| `memberTitle` | singular member designation (badges, simulated titles) |
| `quotaPct` | share of the population in %. **All shares must sum to exactly 100.** |
| `isOverflow` | optional; the exact-remainder bucket (defaults to the last faction) |
| `colors` | 11 Tailwind/hex tokens for the faction (text/border/bg/badge/bar/dot/glow) — **complete literal class strings, never concatenated** (Tailwind v4 scans source for class names; `index.css` already includes `@source` for `packages/lore`) |
| `censusDescription` | shown in the census modal + fed into the Gemini prompts |
| `lifeStageTitles` | per formal stage (`youth`/`youngAdult`/`adult`/`senior`) titles |
| `topics.p2 / topics.p3` | paragraph topic chips: `icon` key (web maps keys → lucide icons in `apps/web/src/lib/prophecyTopics.ts`) + `label` |
| `promptBlocks.occupation / appraisal` | the per-faction instruction blocks injected as paragraph_2 / paragraph_3 into **every** prompt (initial + re-arbitration) |
| `simulated.title/occupation/notice/energy` | offline (no-API-key) verdict copy |
| `stylePrompt` | art-direction prompt used by the avatar/badge synthesis providers |

### Mechanic consequences (read before changing)

- **Quotas** drive percentile thresholds, census populations and the
  **distance-shell bands** in `apps/web/src/lib/face-geometry.ts` — all
  derived, no hardcoded duplication remains.
- **Any class count (2..N), any distribution** works. The invariant tests
  (`apps/web/src/components/DebugBench.test.ts`, `apps/web/src/lib/face-geometry.test.ts`)
  verify: quotas sum to 100, monotonic thresholds, boundary percentiles land in
  the owning band, shell ranks partition contiguously, every class reachable,
  target demographic mix ≈ quotas.
- **Stability / flip-rate**: re-scan jitter can flip the class across a band
  boundary. Near-equal bands are boundary-dense (~4% measured); one large
  overflow band drops this below 1%. The test bar (6%) is documented — tighten
  or loosen it together with your quota shape.
- `WEALTH_TIERS` (7 tiers, ordered) feeds the prompts and
  `toAssetValueTier()` normalization (`hints` map model output → tier).

## 4. Prompts — `packages/lore/src/prompts.ts`

Placeholder builders for the three Gemini calls. Rewrite the voice here — the
JSON contract is what the server parses:

- **initial verdict** (`buildOraclePrompt`) returns
  `{ user_profile: { caste, biocarbon_ratio, life_stage, equipped_wealth, energy_level, apparent_presentation, honorific_title }, prophecy: { headline, paragraph_1..3 } }` — **the `caste` and `biocarbon_ratio` keys are the internal storage fields; keep them** (the values are the faction `id` and the 0-100 ratio).
- **appeal ruling** (`buildAppealPrompt`) returns
  `{ accepted, reason, new_caste, new_honorific_title, headline, scripture }`.
- **re-arbitration** (`buildReArbitrationPrompt`) returns
  `{ headline, new_honorific_title, scripture }` — the accepted appeal may only
  be acknowledged inside `paragraph_1` (test-enforced in the simulated copy).

Per-faction voice lives in `factions.ts[].promptBlocks`; the registry block and
wealth tiers are injected automatically.

Server (`apps/server/src/gemini.ts`) is a thin wrapper: model calls, JSON
parsing, cost accounting, deterministic fallbacks (`packages/lore/src/simulate.ts`).

## 5. Art — palettes, portraits, badges, audio

| Surface | Where | Notes |
| --- | --- | --- |
| Shared palette (accent/secondary/tertiary/warning/dark/panel) | `packages/lore/src/art.ts` | consumed by JS (e.g. confetti in `App.tsx`); `apps/web/src/index.css` `:root` mirrors the tokens for CSS — keep both in sync |
| Per-faction colors | `factions.ts[].colors` | Tailwind literals + hex |
| Portrait render styles | `apps/web/src/lib/polygon-portrait.ts` | 4 canvas engines (neon-hologram, faceted-poly, surveillance-wireframe, thermal-scan) with their own placeholder palettes; the registry/switch is the extension point for new styles |
| Badge/avatar art prompts | `factions.ts[].stylePrompt` | fed to the Gemini avatar providers |
| Intro quote deck | `apps/web/src/data/quotes.ts` | `REGISTRY_QUOTES` — replace with your narrative beats (structure is load-bearing: id/author/title/quote/date) |
| App icon / favicon | `apps/web/public/favicon.svg` | neutral placeholder glyph |
| PWA manifest + `index.html` | `apps/web/vite.config.ts` + `index.html` | name/description/theme color literals (point to `lore/identity.ts` values) |
| Sound design | `apps/web/src/lib/audio.ts` | fully procedural synth; event names map to flow moments — timbres/moods are yours to retune |

## 6. Emails — `apps/server/src/email/templates/`

`verdict.ts`, `appeal.ts`, `otp.ts` + `layout.ts`. Copy is inline in the
templates (neutral placeholders); faction names resolve via
`getFaction(caste).name` — never raw ids. Recipients are never persisted.

## 7. Screen copy (web)

Currently neutral placeholders **inline in components** (an optional future
refactor hoists everything into `lore/ui.ts`). Screens and files:

intro (`components/AnimatedIntro.tsx` + `data/quotes.ts`) · app chrome and
notices (`App.tsx`) · scan HUD (`components/CameraScanner.tsx`) · verdict
(`components/ArbitrationDossier.tsx`, `DossierIdentityCard.tsx`,
`DossierProphecy.tsx`, `lib/useIdentityReveal.ts`, `lib/prophecyTopics.ts`) ·
claim/appeal (`ClaimScreen.tsx`, `AppealScreen.tsx`,
`AppealRecordsScreen.tsx`, `AssetVaultPayment.tsx`) · dossier + download badge
(`CitizenDossier.tsx`, `lib/dossierCardPng.ts`) · vault (`VaultScreen.tsx`) ·
census (`CensusModal.tsx`) · dev bench (`DebugBench.tsx`).

## 8. Zero-token workflow (no AI spend, no webcam)

1. `pnpm dev:all` → <http://localhost:5173/debug> — presets for every class,
   verdict preview, portrait labs.
2. Use the bundled `sample_face.png` or the camera; scan → arbitration runs the
   **simulated verdict** (no `GEMINI_API_KEY`).
3. Claim/appeal: the vault OTP prints to the **server console**; verdict/appeal
   emails are **logged** (jsonTransport, no SMTP).
4. With a key + SMTP set, the same flow uses Gemini + real mails.

## 9. Launch checklist (writing your world)

- [ ] Rewrite `identity.ts` (app name, entity, tagline).
- [ ] Rewrite `factions.ts`: names, quotas, colors, census, life-stage titles,
      topics, promptBlocks, simulated copy, stylePrompt. Keep ids stable.
- [ ] Rewrite `prompts.ts` voice + tone (keep the JSON contract).
- [ ] Replace `REGISTRY_QUOTES` with your intro beats; rework `AnimatedIntro`.
- [ ] Redesign palette (`art.ts` + `index.css`), portraits, favicon, PWA meta.
- [ ] Update the debug bench presets if the taxonomy changed shape.
- [ ] Run `pnpm build && pnpm test` + the grep gate (AGENTS.md §5).
- [ ] Optional deep renames (API paths, DB column names) — do them as one
      mechanical sweep; the display/storage doctrine means they're not
      required.

## 10. The grep gate (old canon must never leak)

```bash
rg -i -n "aipocalypse|supreme arbiter|neon grid|mainframe|biocarbon(?!_ratio)|redundan|overlord|enforcer|bootlick|untouchable|free spirit" apps packages --pcre2 | grep -vE "CASTE|caste"
```

Internal `caste` / `biocarbon_ratio` identifiers are exempt by design (AGENTS.md §2).