# STORY.md — The Lore Pack Authoring Handbook

ECOCIDE ships with the full ECOCIDE world: the **AI Supreme Arbiter of
Consumption** audits household objects, not people. The world is yours to
rewrite — this document is the map of every story/art surface and the rules
for replacing it. Style bible: **`art_directions.md`** (numbered §). Item
formula: **`compliance_formula.md`**.

---

## 1. The rules

1. **All story, copy and art live in `packages/lore`.** Components, prompts
   and the server must keep reading from the pack.
2. **All formula math lives in `packages/compliance`.** Never re-implement the
   formula in story code.
3. Search marker for provisional strings: `TODO-LORE`.

## 2. Identity — `packages/lore/src/identity.ts`

| Slot | Value | Meaning |
| --- | --- | --- |
| `projectName` | `ecocide` | internal id / package scope |
| `appName` | `ECOCIDE` | header + PWA brand |
| `appVersion` | `0.2.0` | header version |
| `entityName` | `AI Supreme Arbiter of Consumption` | the in-world decider (prompts, scanner copy, emails, footer) |
| `entityShortName` | `the Arbiter` | mid-sentence reference |
| `tagline` | `Carbon Excess Eliminator` | logo lockup / landing (art §1.2) |
| `secondaryLine` | `Guilty until pledged.` | near the appeal button (art §1.2) |
| `backronym` | `Excess Carbon Offence Case Investigation & Disposal Engine` | footer / deck (art §1.1) |
| `auditProtocol` | `PROTOCOL-9` | stamped on case files |

## 3. The taxonomy — `packages/lore/src/factions.ts` (the heart)

`FACTIONS` is an **ordered array, best → worst**, one entry per tier (art §7):

| Field | Meaning |
| --- | --- |
| `id` | stable internal id, **persisted in the DB** (`carbon-neutral-legend`, `marginally-acceptable-human`, `statistically-average-polluter`, `high-impact-offender`, `power-grid-liability`, `disaster-zone`) |
| `name` / `memberTitle` | display names |
| `minScore` | lower (inclusive) bound of the Household Sustainability Index (90/75/60/40/20/0) |
| `colors` | 11 Tailwind/hex tokens (text/border/bg/badge/bar/dot/glow) — **complete literal class strings** (Tailwind v4 scans sources; `index.css` includes `@source` for lore) |
| `stampText` / `stampInk` | EXEMPLARY…FINAL NOTICE + paper-layer ink hex (art §3.4/§7) |
| `verdictLine` | the Arbiter's one-liner (art §7 verdict table) |
| `tariff` | what the Bureau charges this tier per bureaucratic act (`claimUnits`, `appealUnits`, in credit units — 1 unit = 1/100 carbon credit = 10 kg CO₂e). The audit modulates the charge, so these are base rates: the disaster zone affords about twenty audits and one appeal out of a year's allowance, every better tier more |
| `disposition` | the household's **disposition mark**: `label` (short stamped phrase, authored in caps), `icons` (one or two **icon keys** — `sprout` / `file-clock` / `chart-column` / `eye` / `recycle` / `skull` — resolved in web by `apps/web/src/lib/lore-icons.ts`, like `topics.icon`), and `detail` — the file the mark opens, saying what the Bureau intends to do with the household |
| `reticleMotif` | per-tier reticle flavor key (art §7 lore) |
| `censusDescription` | tier lore — the case-file scene (art §3 "Per-Tier Visual Lore") |
| `topics.p2/p3` | paragraph topic chips: `icon` key (web maps keys → lucide icons in `apps/web/src/lib/prophecyTopics.ts`) + `label` |
| `promptBlocks.paragraph2/paragraph3` | per-tier instruction blocks injected into every verdict prompt |
| `stylePrompt` | §10 badge art prompt (image-model use) |
| `simulated` | offline verdict copy (title, paragraph2, paragraph3) |

The **disposition mark** (`disposition`) is the second stamp on a dossier,
opposite the injunction's. It carries no date, because it is not a filing — it is
a statement of what the Bureau intends to *do* with the household. Read best →
worst it is one escalating joke: the Bureau stops judging you and starts handling
you (MODEL CITIZEN → PROVISIONALLY KEPT → STATISTICALLY FILED → UNDER OBSERVATION
→ HELD FOR PARTS → MARKED FOR RECYCLING). The two handled tiers both carry the
recycling sign (the household has become material), and the worst adds a skull.
Conventions: the label is authored in caps (it is stamped, like `stampText`);
labels must be **unique per tier** and each tier needs one or two icon keys
(`factions.test.ts` enforces both, and `apps/web/src/lib/lore-icons.test.ts`
enforces that every key actually resolves). Glyphs are **line icons, never
colour emoji** — they inherit the stamp's matte ink (art §3.2). The `detail` is
written in the Bureau's flat second person and should be derivable from that
tier's own copy (`verdictLine` / `simulated.title` / `censusDescription`). The web
reads it as `getFaction(caste).disposition` and opens `detail` in a modal
(`apps/web/src/components/DispositionStamp.tsx` + `DispositionModal.tsx`); the
surrounding chrome is `DISPOSITION_COPY` in `surfaces.ts`.

Also here: `HOUSEHOLD_TITLES` + `householdTitle(...)` — the deterministic
**personalized titles** driven by the dominant scoring dimension / material
family (sustainability_scoring_framework.md §6): plastic → "Petroleum
Hoarder", textiles → "Fast-Fashion Collector", electronics → "Gadget
Graveyard Keeper", single-use lifespan → "Disposable Enthusiast", operating
energy → "Watt Wizard", compliant households → "Model Citizen (grudgingly)",
plus dimension fallbacks. The math picks the driver; the pack supplies the
vocabulary.

### Mechanic consequences (read before changing)

- **Score bands** drive everything: `getFactionFromScore(score)` maps a
  0–100 Index to a tier with inclusive lower bounds. Invariant tests
  (`packages/lore/src/factions.test.ts`) verify monotonicity and boundary
  mapping.
- **Any tier count works**, as long as bands stay descending and the
  overflow/default is the last entry (unknown ids resolve to the worst tier).
- **Exhibit rooms** (`SIMULATED_ROOMS` + `buildSimulatedRoom`) are hand-composed
  rooms per tier used by the dev bench and tests; tests assert each lands
  *exactly* in its own band. If you change bands, archetype ratings/sizes or
  the roll-up weighting, re-check the six rooms (`pnpm vitest run
  apps/web/src/components/DebugBench.test.ts`).
- The old percentile/quotas/life-stage/wealth machinery is **gone** — do not
  reintroduce "population %" or face-derived attributes. The census is live
  audited counts (`GET /api/census`, gated at 50+ audits).

## 4. Prompts — `packages/lore/src/prompts.ts`

Two prompt builders + their **plain JSON Schema** objects (wired into
`responseJsonSchema` server-side):

- **PASS 1 — `buildInventoryPrompt` + `INVENTORY_JSON_SCHEMA`**: audit
  objects only (never people), group+count identical items, ≤25 entries,
  normalized bounding boxes (optional), a material family and relative size
  per item, and one 1–5 rating per applicable dimension (`null` when it
  doesn't apply, e.g. operating energy for a banana peel). The prompt also
  states the Step-5 override rules so the model rates deliberately. An
  optional room hint (the scanner's audit-area chip) is passed through.
- **PASS 2 — `buildVerdictPrompt` + `VERDICT_JSON_SCHEMA`**: text-only; the
  tier and ratio are deterministic INPUTS, the model writes
  `headline`, `paragraph_1..3`, `suggestions[{text, target_label, pledge,
  impact_pct}]`. The JSON contract keeps the internal keys **`caste`** and
  **`biocarbon_ratio`** (echoed).
- **Appeal** (`buildAppealPrompt`): grounded in the stored item list; the
  model may propose `new_caste` only from the registered tier ids.
- **Re-arbitration** (`buildReArbitrationPrompt`): same, no vision; the
  granted appeal may only be acknowledged inside paragraph_1.

Server (`apps/server/src/gemini.ts`) is a thin wrapper: model calls, JSON
parsing, output sanitizing (clamp ratings, dedupe labels, sanitize counts),
cost accounting, deterministic fallbacks (`simulate.ts`).

## 5. Simulation — `packages/lore/src/simulate.ts`

- `ITEM_ARCHETYPES` — the catalog the simulated world draws from: label,
  category, `countMax`, fixed 1–5 ratings, material family, size and one dry
  bureaucratic justification. The extreme archetypes (rags/seedlings high,
  waste sacks low) are what make every tier band reachable deterministically.
- `generateSimulatedInventory(seed)` — a deterministic random-ish room.
- `SIMULATED_ROOMS` / `buildSimulatedRoom(id)` — the six curated **exhibit
  rooms** (dev bench, tests), each verified to land in its tier band under the
  size-weighted roll-up.
- `generateSimulatedVerdictContent(...)` / `generateSimulatedSuggestions(...)` —
  offline verdict copy (including the title via `householdTitle`) + pledge
  suggestions.
- `generateSimulatedAppealRuling(...)` / `generateSimulatedReArbitrationCopy(...)` —
  hashed accept/reject rulings.

The full offline pipeline (`simulateScanFromItems`, `simulateTierRoom`,
`simulateHouseholdScan`) lives in `packages/types` and is shared by the
server's offline mode and the web dev bench.

## 5b. The scoring framework (Step 5 + roll-up)

`sustainability_scoring_framework.md` (in `readme/`) extends the base formula
with three rules implemented in `packages/compliance`:

- **Step 5 override rules** — a single severe property cannot be hidden by a
  good average: *single-use plastic* (L=5 + plastic material) and *landfill
  traps* (R=5, D≥4, L≥4) force Non-Compliant; *hazardous* items (T=5) cannot
  be approved or held — they become **Special Handling Required** until a
  disposal pledge is made. Fired rules are stored per item and shown on the
  dossier item cards.
- **Size-weighted roll-up** — item weight = quantity × size factor
  (0.5 small / 1 medium / 2 large); the Household Sustainability Index is the
  weighted mean of item SIs, rounded to an integer percent.
- **Hard fails** count items hit by at least one override rule (not merely
  low-SI items).

## 5c. The registry roll-up (cross-assessment)

`packages/compliance/src/registry.ts` pools every assessment the citizen has
claimed. Because the household index is itself an item-weighted mean, the
**Carbon Neutrality Index** is the same quantity over every item ever audited:
an item-weighted mean of the assessment indices, not a flat average, so a
furnished room moves the record more than a single jar. `registryStanding` also
reports the record's texture (objects audited, hard fails, worst offender,
dominant material family) and `delta` — what the newest assessment did to the
record against the pooled baseline that preceded it. The tier that labels the
standing comes from `getFactionFromScore` (the bands in §3); the registry never
re-derives them. World copy lives in `surfaces.ts` (`REGISTRY_COPY`).

## 6. Art — palettes, stamps, lenses, audio

| Surface | Where | Notes |
| --- | --- | --- |
| Shared palette | `packages/lore/src/art.ts` (`PALETTE`) + `apps/web/src/index.css` `:root` | art §3 hexes; keep the two in sync |
| Carbon Registry copy | `packages/lore/src/surfaces.ts` (`REGISTRY_COPY`) | world strings for the registry page, its standing hero and the payment terminal |
| Per-tier colors | `factions.ts[].colors` | Tailwind literals + hex |
| Audit lenses (4 canvas styles) | `apps/web/src/lib/audit-lenses.ts` | art §9: neon-outline (default), evidence-photo, inspection-hud, carbon-heat |
| Tier stamp (SVG) | `apps/web/src/components/TierStamp.tsx` | art §10 flat-vector style; per-tier prompt in `stylePrompt` |
| Landing page | `apps/web/src/components/HomePage.tsx` | terminal landing + paper dossier panel; CTA begins the audit |
| App icon / favicon | `apps/web/public/favicon.svg` | art §11 mark (eye + recycling pupil) |
| PWA manifest + `index.html` | `apps/web/vite.config.ts` + `index.html` | name/theme color point at the art tokens |
| Sound design | `apps/web/src/lib/audio.ts` | fully procedural synth; event names map to flow moments |

## 7. Emails — `apps/server/src/email/templates/`

`verdict.ts`, `appeal.ts`, `otp.ts` + `layout.ts`. Copy is inline in the
templates; tier names resolve via `getFaction(caste)` — never raw ids.
Recipients are never persisted. Evidence photos are linked via the dossier
permalink, never embedded.

## 8. Screen copy (web)

World copy comes from the lore pack (tier names, stamps, verdict lines,
titles, quotes, prompt text). Generic chrome (buttons, labels) lives inline
in components — an optional future refactor hoists it into `lore/ui.ts`.

Screens and files: landing (`HomePage.tsx`) · app chrome (`App.tsx`) · scan
(`ObjectScanner.tsx` + `ScannerHeader.tsx` + `UploadPanel.tsx` +
`AnalysisPanel.tsx`) · dossier card (`HouseholdAuditCard.tsx` +
`lib/audit-lenses.ts` + `TierStamp.tsx`) · verdict (`ArbitrationDossier.tsx`,
`DossierProphecy.tsx`, `lib/useArbitrationFlow.ts`, `lib/useAuditReveal.ts`) ·
claim/appeal (`ClaimScreen.tsx`, `AppealScreen.tsx`,
`AppealRecordsScreen.tsx`, `RegistryPayment.tsx`) · dossier + download card
(`CitizenDossier.tsx`, `PaperDossierPanel.tsx`, `lib/dossier-export.ts`) · carbon registry
(`CarbonRegistryScreen.tsx` + `RegistryUnlock.tsx`; copy in
`packages/lore/src/surfaces.ts` — `REGISTRY_COPY`) · census
(`CensusModal.tsx`) · dev bench (`DebugBench.tsx`).

## 9. Zero-token workflow (no AI spend)

1. `pnpm dev:all` → <http://localhost:5173/debug> — six exhibit rooms (one
   per tier), verdict previews, lens switcher.
2. Upload a room photo; scan → the server runs the **simulated audit**
   (no `GEMINI_API_KEY`).
3. Claim/appeal: the registry OTP prints to the **server console**; verdict/appeal
   emails are **logged** (jsonTransport, no SMTP).
4. With a key + SMTP set, the same flow uses Gemini + real mails.

## 10. Launch checklist (rewriting the world)

- [ ] Rewrite `identity.ts` (names, taglines, protocol).
- [ ] Rewrite `factions.ts`: tier names, bands, colors, lore, stamps,
      verdict lines, prompt blocks, simulated copy, stylePrompts, titles.
      Keep ids stable.
- [ ] Rewrite `prompts.ts` voice + tone (keep the JSON schemas' contracts).
- [ ] Rewrite `surfaces.ts` (`REGISTRY_COPY`): the Carbon Registry page, its
      standing hero, the assessment archive and the payment terminal copy.
- [ ] Replace the landing copy (`HomePage.tsx`) and the scanner chrome
      (`ScannerHeader.tsx`, `UploadPanel.tsx`, `AnalysisPanel.tsx`).
- [ ] Redesign palette (`art.ts` + `index.css`), favicon, PWA meta, lenses.
- [ ] Re-tune the exhibit rooms to the new bands (DebugBench tests).
- [ ] Run `pnpm build && pnpm test` + the grep gate (AGENTS.md §5).

## 11. The grep gate (placeholder canon must never leak)

```bash
rg -i -n "carbon minded|aipocalypse|neon grid|mainframe|biocarbon(?!_ratio)|redundan|overlord|enforcer|bootlick|untouchable|free spirit|\bclass (i|ii|iii|iv|v|vi)\b|class-[ivx]+" apps packages scripts --pcre2 | grep -vE "caste|biocarbonRatio|classify|classification"
```

Internal `caste` / `biocarbon_ratio` identifiers are exempt by design
(AGENTS.md §2).