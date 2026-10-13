# ECOCIDE — Visual Style & Art Direction Bible

**Tagline:** TBD
**Secondary line (near the appeal button):** Guilty until pledged.

> Use this document as the single source of truth when generating artwork, illustrations,
> marketing images, stamps, or any visual asset for the application.

---

## 1. Brand

### 1.1 Name and meaning

**ECOCIDE** is a real term for large-scale destruction of the natural environment. In the
app it is used as the Arbiter's official charge: the household under review is accused of
excess, and the only defence is real pledged action.

**Bureaucratic backronym (footer, About page, deck):**

> **E**xcess **C**arbon **O**ffence **C**ase **I**nvestigation & **D**isposal **E**ngine

### 1.2 Tagline usage

| Placement | Text |
| --- | --- |
| Logo lockup / landing page | Carbon Excess Eliminator |
| Stamps and short formats | Excess Carbon. Eliminated. |
| Appeal button area | Guilty until pledged. |

### 1.3 Tone rules

- **Aim the joke at habits and objects, never at people, their bodies, income or circumstances.**
- **Never joke about real environmental disasters** (oil spills, deforestation, specific
  events). The charge is always "your household's excess."
- **"Eliminated" refers to carbon and waste, never people.** Use "Final Notice" or
  "Scheduled for composting" instead of termination language.
- The machine is always deadpan and certain. Never make the UI cute.

---

## 2. High Concept

A **satirical dystopian environmental bureaucracy** presented as a household audit terminal.
The user is a "household under review," and every object they own is inspected, rated and
sentenced by an unyielding machine authority called the **AI Supreme Arbiter of Consumption**.
The Arbiter never doubts its verdict, and the only way to appeal is to pledge real habit changes.

**Genre blend:** government audit office × landfill-data mainframe × compost-punk dystopia ×
dark satire. Everything looks like an official case file printed from a hacked CRT terminal
in a ministry that runs entirely on waste statistics.

**Visual rule:** the humor comes from a deadpan, serious presentation of absurd rulings
(a wardrobe sentenced to "final notice," a teddy bear granted an emotional-support exemption).
The joke only works if the machine is cold.

**Mood keywords:** toxic lime terminal glow, case-file paperwork, rubber stamps, carbon ledgers,
barcode strips, redacted lines, recycling-arrow glyphs, scan lines, landfill gauges,
inspection reticles, bureaucratic menace, deadpan machine judgment, satirical dread.

**Two visual layers:**

- **The System layer** (dark, glowing, monospace): scanner, HUD, Arbiter voice, verdicts.
- **The Paper layer** (off-white, ink-stamped, typewriter): the dossier, the plain-language
  "Explain this verdict" panel, and the shareable case card. The serious paper version
  sitting next to the dramatic System version is part of the joke.

---

## 3. Core Color Palette

### 3.1 Base / Environment Colors

| Role | Hex | Notes |
| --- | --- | --- |
| App background (deepest void) | `#080b08` | Page background, PWA theme-color |
| Moss dark (body base) | `#0c110d` | Main body color |
| Panel surface | `#121a14` | Scanner box, dossier card, pledge terminal |
| Panel surface (alt) | `#17221a` | Item cards, ledger panels |
| Deep modal surface | `#0e1510` | Modals, item detail drawer |
| Canvas void fill | `#070a08` | Scan view / image canvas background |
| Landfill black | `#0b0a06` | Warm brown-black for the "audit in progress" chamber |
| Primary text (pale leaf white) | `#e6efe3` | Main readable text |
| Secondary text | `#a9b8aa` | Sub-labels, descriptions |
| Muted text / utility gray | `#7c8b7e` | Stamps, legends, disabled states |
| Pure black overlays | `#000000` (40–90% alpha) | HUD chip backings, stat boxes |

### 3.2 Paper Layer Colors

| Role | Hex | Notes |
| --- | --- | --- |
| Form paper | `#f1ead6` | Dossier and Explain panel background |
| Form paper (shadow) | `#e0d6bb` | Folds, edges, ledger lines |
| Typewriter ink | `#1f2a1f` | Body text on paper |
| Stamp ink red | `#c2322b` | DENIED, FINAL NOTICE |
| Stamp ink green | `#2f7d3a` | APPROVED, EXEMPLARY |
| Stamp ink amber | `#b45309` | PENDING REVIEW |
| Compost brown | `#8b5a2b` | Folder tabs, ledger binding, case-file accents |

### 3.3 System Signal Colors

| Name | Hex | Usage |
| --- | --- | --- |
| **Toxic Lime** | `#b4ff39` | PRIMARY system color: HUD, scanner beam, grid, Arbiter text, buttons |
| **Verdict Amber** | `#ffb703` | Verdicts, infractions, warnings, "estimate" labels |
| **Hazard Yellow** | `#facc15` | Hazard stripes, special-handling flags |
| **Alert Red** | `#ef4444` | Errors, non-compliance, injection-attempt warnings |
| **Critical Crimson** | `#ff0055` | Highest-severity alerts, worst planet-meter state |
| **Pledge Green** | `#22c55e` | Accepted pledges, score improvements, success states |
| **Ledger Teal** | `#2dd4bf` | Secondary data accent: charts, carbon totals, links |
| **Rust Orange** | `#f97316` | Decay and corrosion accents, Heavy Waster tier |

### 3.4 Compliance Tier Colors

Used for the tier stamp, planet meter and glow. Always paired with the stamp text and
meter position so color is never the only signal.

| Tier | Score | Status | Stamp | UI Theme Hex | Glow RGBA |
| --- | --- | --- | --- | --- | --- |
| **Eco Elite** | 90–100 | Compliant | EXEMPLARY | `#84cc16` lime | `rgba(132,204,22,0.4)` |
| **Green Citizen** | 75–89 | Compliant | APPROVED | `#22c55e` green | `rgba(34,197,94,0.4)` |
| **Trying Their Best** | 60–74 | Compliant | APPROVED (GRUDGINGLY) | `#facc15` yellow | `rgba(250,204,21,0.4)` |
| **Careless Consumer** | 40–59 | Borderline | PENDING REVIEW | `#f59e0b` amber | `rgba(245,158,11,0.4)` |
| **Heavy Waster** | 20–39 | Non-Compliant | DENIED | `#f97316` orange | `rgba(249,115,22,0.4)` |
| **Planet Threat** | 0–19 | Non-Compliant | FINAL NOTICE | `#ef4444` red | `rgba(239,68,68,0.6)` |

The tier describes the household's habits, not the person. It appears alongside the
personalized title (for example "Petroleum Hoarder") chosen from the dominant scoring dimension.

### 3.5 Glow / Shadow Recipes

- **Text glow (per color):** `0 0 8px <color>@0.8, 0 0 20px <color>@0.4`
- **Border glow:** `box-shadow: 0 0 15px <color>@0.3, inset 0 0 10px <color>@0.1`
- **Tier ambient glow:** `0 0 20px <tier-color>@0.25` (Planet Threat gets a hotter 0.6 glow)
- **CTA button glow:** lime `0 0 30px rgba(180,255,57,0.5)`, hover `0 0 45px rgba(180,255,57,0.8)`
- **Paper layer:** no glow. Use a soft drop shadow (`0 4px 12px rgba(0,0,0,0.35)`) so it
  reads as a physical document.

### 3.6 Accessibility notes

- Keep lime, amber and pale-leaf text on the dark surfaces above. Check every pairing for
  at least 4.5:1 contrast for body text before finalizing. The hex values here are proposals
  and have not been contrast-tested.
- Provide a **reduced-motion** option that disables scan lines, flicker and typing effects.
- On the paper layer, use typewriter ink on form paper only. Do not place stamp-ink text on
  top of busy imagery.
- Never use color as the only signal. Pair it with stamp text, icons or meter position.

---

## 4. Typography

| Role | Style | Notes |
| --- | --- | --- |
| System text (HUD, Arbiter voice, data) | Monospace | Keep from the existing terminal look |
| Stamps and headings | Stencil or typewriter face | Gives the government-form feel |
| Paper layer body | Typewriter / slab serif | Dark ink on form paper |

Choose fonts with free licenses and provide fallback stacks.

---

## 5. Props and Motifs

- Rubber stamps (EXEMPLARY, APPROVED, PENDING REVIEW, DENIED, FINAL NOTICE)
- Recycling-arrow glyphs and hazard stripes
- Carbon ledgers and case-file folders with compost-brown tabs
- Barcode strips and redacted (blacked-out) lines
- Planet meter or landfill gauge instead of a plain percentage bar
- Inspection reticles on scanned objects, with a small label per detected item
- Scan lines and typing effects (disabled in reduced-motion mode)

**Do not use:** faces, body imagery or portraits as scoring subjects. The avatar from the
earlier concept is replaced by a stamp and the household's object inspection view.

---

## 6. Logo Lockup (guidance)

- Wordmark: **ECOCIDE** in the stencil face, Toxic Lime on the dark background.
- Tagline beneath in monospace: **Carbon Excess Eliminator**.
- Optional mark: a recycling-arrow loop forming a crosshair or inspection reticle.
- Provide a one-color paper version in typewriter ink for the dossier header and share card.

## 7. The Six Compliance Tiers — Color & Visual Identity

Every visual asset tied to a tier must use its designated color and lore.
**Two coordinated sets exist:** the *UI theme set* (badges, planet meter, tier banner, glow)
and the *stamp ink set* (the matte ink colors used on the paper-layer dossier and share card).

The tier comes from the **Household Sustainability Index** (the weighted roll-up of every
item's SI). Item-level status uses the same thresholds: 60+ Compliant, 40–59.9 Borderline,
below 40 Non-Compliant.

| Tier | Score | Status | UI Theme Hex | Stamp Ink Hex | Glow RGBA |
| --- | --- | --- | --- | --- | --- |
| **Carbon Neutral Legend** | 90–100 | Compliant | `#84cc16` lime | `#2f7d3a` stamp green | `rgba(132,204,22,0.4)` |
| **Marginally Acceptable Human** | 75–89 | Compliant | `#22c55e` green | `#2f7d3a` stamp green | `rgba(34,197,94,0.4)` |
| **Statistically Average Polluter** | 60–74 | Compliant | `#facc15` yellow | `#b45309` stamp amber | `rgba(250,204,21,0.4)` |
| **High-Impact Habitual Offender** | 40–59 | Borderline | `#f59e0b` amber | `#b45309` stamp amber | `rgba(245,158,11,0.4)` |
| **Power Grid Liability** | 20–39 | Non-Compliant | `#f97316` orange | `#c2322b` stamp red | `rgba(249,115,22,0.4)` |
| **Environmental Disaster Zone** | 0–19 | Non-Compliant | `#ef4444` red | `#c2322b` stamp red | `rgba(239,68,68,0.6)` |

**Verdict lines (Arbiter voice):**

| Tier | Verdict line |
| --- | --- |
| Carbon Neutral Legend | "Suspiciously perfect. The Bureau is double-checking." |
| Marginally Acceptable Human | "Good habits. Keep going." |
| Statistically Average Polluter | "Some good choices, some bad ones. Acceptable." |
| High-Impact Habitual Offender | "You know better, and the bin knows it." |
| Power Grid Liability | "A lot of waste. Review pending." |
| Environmental Disaster Zone | "Termination notice issued. Appeals accepted in pledges." |

**Share of households:** the old "population %" column is replaced by the live share of
audited households in each tier, read from Firestore. Show it only once enough audits exist
(for example 50+), and label it "audited so far." Never display invented percentages.

Unclassified / pre-scan neutral: **pale leaf white `#e6efe3`**. Never hint at the tier
before the verdict is revealed.

### Per-Tier Visual Lore (for illustration and prop artwork)

Tiers are shown as **case-file scenes made of household objects**. Never depict faces or
people as the scored subject.

- **Carbon Neutral Legend** — *"SOVEREIGN GREEN" clearance.* Immaculate case file edged in
  lime; a laurel wreath of recycling arrows; a single seedling growing in an inspection jar;
  a Bureau magnifier hovering suspiciously over everything. Planet meter nearly empty of
  waste. Stamp: **EXEMPLARY**. Reticle motif: nested lime ring, slow elegant spin.
- **Marginally Acceptable Human** — *"PROVISIONAL APPROVAL."* Neatly sorted bins; one
  reusable bottle on the counter; a tidy ledger with one small ink smudge. Green check mark
  with a tiny asterisk. Stamp: **APPROVED**. Reticle motif: steady corner brackets.
- **Statistically Average Polluter** — *"AVERAGE CLEARANCE."* Half-sorted bins; a reusable
  tote sitting next to a plastic bag; a recycling symbol hanging slightly crooked. Visuals
  split evenly between tidy and messy. Stamp: **APPROVED (GRUDGINGLY)**. Reticle motif:
  ring lit on exactly one half.
- **High-Impact Habitual Offender** — *"UNDER OBSERVATION."* Overflowing bin; stacked
  delivery boxes; loose bubble wrap; caution tape half applied. Amber warning lights.
  Stamp: **PENDING REVIEW**. Reticle motif: blinking amber quadrant notches.
- **Power Grid Liability** — *"GRID STRAIN NOTICE."* Tangled extension cords; rows of
  standby LEDs; overloaded power strips; a meter needle pushed into the red zone.
  Flickering orange glow. Stamp: **DENIED**. Reticle motif: flickering orange ring with a
  voltage-spike zigzag.
- **Environmental Disaster Zone** — *"FINAL NOTICE."* A mountain of mixed waste; hazard-striped
  quarantine tape; a red barcode "CONDEMNED" stamp across the case file; a cracked terminal
  screen with glitching noise. Always paired with `⚠ FINAL NOTICE ISSUED` hazard styling and
  a heartbeat-pulse rhythm. Stamp: **FINAL NOTICE**. Reticle motif: pulsing red ring.

---

## 8. Signature UI Motifs (must appear in generated UI/terminal artwork)

1. **CRT scanlines**: horizontal 4px-period lines, black at ~40% alpha, plus a faint RGB
   chromatic-aberration overlay (red 3% / green 1% / blue 3% vertical stripes). Disabled
   in reduced-motion mode.
2. **Audit grid**: faint lime (`rgba(180,255,57,0.05)`) 32px graph-paper grid over the
   moss-black background (`#080b08`).
3. **Inspection corner brackets**: 24px L-shaped brackets at all four corners, 16px inset,
   65% alpha, tier-colored. On a scanned item, the brackets take the **item's status color**
   (green Compliant, amber Borderline, red Non-Compliant).
4. **Rotating dashed reticle rings**: thin dashed circle slowly spinning around the item
   under inspection; per-tier variants (see §3 lore).
5. **HUD telemetry stamps**: 8-9px monospace strings like `AUDIT PROTOCOL // ECOCIDE`,
   `ITEMS: 14 DETECTED // 3 FLAGGED`, `SYS//DOMESTIC_AUDIT`, `ALL VALUES ARE ESTIMATES`.
6. **Planet meter / landfill gauge**: a vertical or arc gauge that fills with waste as the
   Compliance Ratio drops. Used on the dossier and the share card.
7. **Equalizer telemetry bars**: small vertical bars animating in rhythms matched to the tier
   (see §10).
8. **Dashed center crosshair**: faint 2/4 dashed + at frame center, 25% alpha, during scanning.
9. **Item label chips**: each detected item gets a small tag with its name, a status dot and
   its Sustainability Index (for example `PET BOTTLE x3 // SI 41 // NON-COMPLIANT`).
10. **Neon glow on everything interactive**: text-shadow and box-shadow halos (recipes in §3.5).
11. **Case-file furniture**: `CASE FILE`, `GRID-VERIFIED`, `ESTIMATE: SOURCE ON FILE`,
    barcode strips, redacted lines, `AUTHENTICATED BY AI SUPREME ARBITER OF CONSUMPTION //
    PROTOCOL-9`.
12. **Rounded-2xl dark panels** with 1-2px colored borders at 40-60% alpha, deep shadows.
13. **Paper layer**: form-paper panels with a soft drop shadow, typewriter text and
    rubber-stamp marks, used for the dossier, the "Explain this verdict" panel and the share card.

---

## 9. The Four Audit Lenses

Replaces the old face-mesh portrait styles. These are the canonical treatments for the
scanned photo. **Nothing here analyzes or renders a person.** The subject is always the
room and its objects, and every lens works from the user's own photo plus the detected
item boxes returned by the scanner.

### 9.1 NEON OUTLINE (default brand look)
- The photo is darkened and desaturated, with each detected item traced in a glowing
  lime outline on the audit-grid void (`#070a08`).
- Outlines stroked at **35-90% alpha**; closer or larger items glow brighter.
- Item fills at **8-30% alpha** in the item's status color.
- Corner brackets, item label chips and scanlines (18% alpha).

### 9.2 EVIDENCE PHOTO (case-file snapshot)
- The user's photo graded with a warm, slightly desaturated "evidence" tone.
- A numbered **evidence tag** (`EXHIBIT 01`, `EXHIBIT 02`) pinned to each detected item,
  with thin leader lines.
- Paper-layer frame with a tape strip and a stamped case number.
- Scanlines off; use a subtle paper-grain overlay.

### 9.3 INSPECTION HUD
- The photo under a **cold CRT wash** (`rgba(4,18,24,0.35)` teal-black tint).
- **Status-colored bounding boxes** (0.75px, 42% alpha, 3px bloom); the item under the
  inspection beam is re-stroked hotter (1.4px, 85% alpha, 8px bloom).
- Anchor dots at box corners; label chips with the four displayed properties (material,
  decomposition time, recyclability, toxicity).
- Heavier scanlines (28% alpha), the grittiest "found footage" style.

### 9.4 CARBON HEAT MAP (replaces Thermal FLIR)
- False-color impact map on a landfill-black chamber (`#0b0a06`).
- **5-stop gradient** (low impact to high impact):
  `#052e16` deep green-black (negligible) -> `#22c55e` green (low) -> `#facc15` yellow
  (moderate) -> `#f97316` orange (high) -> `#ff0055` crimson (severe).
- Each item region is tinted by its Harm Score (H), so the worst offenders glow hottest.
- Thin black region seams (0.5px, 35% alpha).
- **Vertical legend bar** at the right edge with the same gradient, labeled
  `LOW IMPACT` / `MODERATE` / `SEVERE`, plus the footnote `ESTIMATED // RELATIVE SCALE`.
- HUD accents in **Verdict Amber `#ffb703`** (not tier color): reads as instrument, not verdict.

---

## 10. Tier Stamp / Badge Art Direction (for AI image generation)

Replaces the citizen avatar engines. The badge for each tier is a **stamp or case-file
emblem**, never a portrait. Use these style blocks verbatim when prompting image models,
and add the tier's lore scene from §3 plus its accent color.

### 10.1 Flat Vector Stamp (primary raster style)
> Crisp flat vector rubber-stamp badge, 256x256 icon aesthetic. Clean sharp outlines,
> bold ink-stamp lettering, slightly worn edges, minimalist recycling-arrow and
> government-seal details. Dark moss-black background with a single dominant accent color
> and soft neon glow. Avoid photorealism; aim for a premium satirical environmental-bureaucracy
> illustration. No faces, no people.

### 10.2 32-Bit Pixel Stamp
> Authentic 32-bit retro terminal pixel art badge, 256x256 icon aesthetic. Sharp pixel
> clusters, arcade dithering, glowing lime and amber pixels. A pixelated case-file folder,
> recycling symbol and rubber stamp on a dark digital grid background. No faces, no people.

### 10.3 Vector SVG Hologram Stamp
- Square icon in a **dark hexagonal or tech-bracket frame** (gradient `#080b08` -> `#121a14`).
- Neon glow from soft Gaussian-blur halos behind crisp shapes.
- Contents: tier emblem, stamp text, planet meter fragment, barcode strip.
- Palette: Toxic Lime, Verdict Amber, or the tier-specific color.
- Small HUD stamp top or bottom, for example `// TIER: POWER GRID LIABILITY`.

**Always:** depict objects, stamps and case-file props from the tier's lore, never faces
or people.

---

## 11. Logo & Iconography

- **The Arbiter mark** (favicon): a lime (`#b4ff39`) **nested hexagonal containment frame**
  (7px outer / 3px inner strokes) around a stylized **all-seeing eye**: white eye silhouette,
  **amber iris** (`#ffb703` at 70% opacity), and a pupil shaped like a **recycling-arrow loop**,
  with short tick marks at the cardinal points and **dashed circuit traces** leading outward.
- **Wordmark:** `ECOCIDE` in the stencil face, Toxic Lime, with the tagline beneath in
  monospace. *Tagline: "Your stuff is on trial." (working choice, to be confirmed.)*
- Icon language: Lucide-style thin line icons (Gavel, Scale, Recycle, Leaf, Trash2,
  ScanSearch, FileText, Stamp, Zap, AlertTriangle).
- Recurring glyphs in status badges: `◆` (locked), `⌖` (inspecting), `●` (stable),
  `✦` (exemption), `♻` (recyclable), `⚠` (hazard), `○` (scanning).
- Cryptic classification codes per tier:
  `ECO-100 // 99.8 GHz` (Carbon Neutral Legend),
  `ACC-075 // 96.4 GHz` (Marginally Acceptable Human),
  `AVG-060 // 92.1 GHz` (Statistically Average Polluter),
  `HIO-040 // 88.7 GHz` (High-Impact Habitual Offender),
  `PGL-020 // 84.3 GHz` (Power Grid Liability),
  `EDZ-000 // 82.0 GHz` (Environmental Disaster Zone).

---

## 12. Screen-Level Art Direction (for key art & marketing)

1. **Transmission Intro**: intercepted-transmission aesthetic. Black/70 quote cards with lime
   corner accents, escalating **lime -> amber -> red** threat stages, glitch bursts (150ms
   contrast spikes), "BUFFERING" equalizer bars, a pulsing red hazard-shield climax, and the
   headline `YOUR HOUSEHOLD HAS BEEN CHARGED WITH ECOCIDE`. Any attributed quotes must be
   verified or paraphrased. Includes skip, sound toggle and reduced-motion controls.
2. **Domestic Audit (scanner)**: square viewport panel (`#121a14`) with a lime glow border,
   the uploaded or live photo under scanlines, rotating dashed reticle, item label chips as
   items are detected, and status chips in black/60 rounded boxes in the top corners. Includes
   a category hint strip (fridge, wardrobe, bin, desk) and a "scan objects, not people" note.
   Loading copy: "Scanning household assets...", "Estimating embodied carbon...".
3. **Household Dossier (verdict)**: case-file card. Header bar
   `CENTRAL MAINFRAME // HOUSEHOLD AUDIT DOSSIER`, the annotated photo in a tier-colored
   border, **COMPLIANCE RATIO** in huge black tier-colored numerals with the planet meter,
   the tier stamp and personalized title, a 2x2 stat grid (ITEMS SCANNED / HARD FAILS /
   TOP OFFENDER / PLEDGES AVAILABLE), per-item cards showing material, decomposition time,
   recyclability and toxicity, and a barcode strip with a `GRID-VERIFIED` footer. Every
   number is labeled as an estimate. Verdict paragraphs carry per-paragraph accents:
   **teal `#2dd4bf`**, **amber `#f59e0b`**, **green `#22c55e`**. An **Explain mode** toggle
   switches to the plain paper-layer panel with the serious reasoning.
4. **Verdict Actions**: ACCEPT VERDICT = solid lime pill (black text), FILE APPEAL = solid
   amber pill (black text), under a pulsing `VERDICT DELIVERED` status line and the secondary
   line `Guilty until pledged.`
5. **Appeal Tribunal**: replaces the payment terminal. Courtroom-terminal layout with a plea
   text box, a pledge picker tied to detected items, a live credibility meter (specific,
   feasible, impactful), and the Arbiter's in-character reply. Prompt-injection attempts
   trigger a red `HOSTILE OVERRIDE DETECTED` warning in character.
6. **Pledge Ledger**: banking-terminal-meets-audit-desk. Big lime numerals for total kg CO2e
   pledged (marked estimate), a ledger table with green (pledged) and amber (pending) entries,
   `rounded-2xl` dark panels.
7. **Tier Census modal**: the six tiers as a government matrix,
   `CENSUS MANDATE 2026.4 // SHARE OF HOUSEHOLDS AUDITED SO FAR`. Show real counts only after
   enough audits exist; never invented percentages.
8. **Impact / Sentence screen and share card**: before and after score, tier movement, kg CO2e
   pledged (estimate), downloadable paper-layer case card, and a "return in 7 days" option.

---

## 13. Motion & Atmosphere (for animated/video artwork)

- **Glitch language:** 150ms bursts: 1px X-translate + 99% scale + contrast spike.
- **Pulse language:** slow 3s opacity breathing for status dots; `animate-ping` red dots
  for live hazard indicators.
- **Reticle motion:** constant slow rotation (2-6s per revolution), reverse-spin nested rings.
- **Equalizer rhythms:** named patterns matched to tier temperament: `calm` (Carbon Neutral
  Legend), `steady` (Marginally Acceptable Human), `even` (Statistically Average Polluter),
  `restless` (High-Impact Habitual Offender), `surge` (Power Grid Liability), `heartbeat`
  (Environmental Disaster Zone).
- **Inspection beam:** a soft scanning light bar sweeping across the photo, brightening each
  item as it is evaluated, ~17% of frame height, additive glow.
- **Tier promotion:** after a credible appeal, the tier banner and planet meter animate to the
  new tier, with a stamp slam and a short glow burst. This is the signature reward moment.
- **Sound palette (for trailers):** sawtooth scanner chirps sweeping 1400-3200 Hz, sine UI
  clicks 800-400 Hz, low ambient drone (~8% volume), a rubber-stamp thud on verdicts, climax
  alarm. All synthesized, lo-fi, no orchestral elements. Provide a mute control.
- **Reduced motion:** disable scanlines, flicker, glitch bursts and reticle spin; keep static
  equivalents.

---

## 14. Do / Don't

**DO**
- Near-black moss backgrounds with a single dominant accent per composition on the System
  layer; off-white form paper on the Paper layer.
- Monospace all-caps microcopy with `//` separators and classification stamps.
- CRT texture: scanlines, chromatic RGB fringe, phosphor glow, vignette.
- Inspection overlays on household objects: boxes, reticles, evidence tags, label chips.
- Bureaucratic absurdity: barcodes, case numbers, fees paid in pledges, quotas, mandates,
  exemptions (the teddy bear).
- Tier color discipline: one tier, one accent family, always paired with stamp text.
- Label every figure as an estimate with a source on file.

**DON'T**
- No faces, bodies or portraits as scored subjects. Humor aims at objects and habits only.
- No jokes about income, living situation, bodies, or real environmental disasters.
- No termination language aimed at people. "Eliminated" and "scheduled for composting" refer
  to carbon and waste.
- No bright or pastel backgrounds on the System layer; no cozy or cute eco-greenery. The
  machine must stay cold for the joke to land.
- No rounded friendly typefaces. Stencil and monospace on the System layer; typewriter or
  slab serif on the Paper layer only.
- No photorealistic rendering for badges and stamps (flat vector, pixel or hologram only).
  The user's own photo appears only as the audited evidence.
- No clean utopian sci-fi (Apple-white, glossy blue corporate); this is a rusted,
  bureaucratic, satirical environmental dystopia.
- No magic or fantasy elements; everything is technology, paperwork and waste statistics.

---

## 15. Quick-Reference Prompt Snippet

> Satirical dystopian environmental-bureaucracy audit terminal aesthetic, moss-black
> background (#080b08), toxic lime (#b4ff39) glowing inspection outlines and bounding boxes
> over household objects, CRT scanlines and chromatic aberration, targeting reticle corner
> brackets, monospace all-caps telemetry labels with "//" separators, case-file furniture
> (barcodes, rubber stamps, "GRID-VERIFIED"), planet meter gauge, off-white form-paper
> dossier panels with typewriter text, single dominant tier accent color, deadpan machine
> bureaucracy, compost-punk mood, no faces, no photorealism, vector-hologram illustration
> style.

## 16. Minimalist UI Principles

### Core Principle

Keep the ECOCIDE webpage **minimal, deliberate, and easy to scan**. The visual identity should come from a small number of strong design elements—not from filling the screen with text, panels, illustrations, or effects.

The page should feel like a restrained government audit terminal: cold, authoritative, slightly dystopian, and satirical.

### Minimalism Rules

- Show **only information the user needs at the current stage**.
- Use short headings, concise labels, and brief descriptions. Avoid long paragraphs and repeated explanations.
- Keep the number of sections, cards, badges, and statistics low. Every element must have a clear purpose.
- Prefer whitespace and clear hierarchy over filling every available space.
- Use one strong focal point per section. Do not make every element compete for attention.
- Avoid decorative illustrations, large background scenes, excessive icons, unnecessary charts, and multiple simultaneous animations.
- Do not display the same information in both a heading and a paragraph, or repeat it across multiple panels.
- Use subtle texture and a few signature details to establish the style. Do not cover the interface in visual effects.
- Keep the page usable on mobile: content should remain readable, compact, and uncluttered.

### Visual Identity to Preserve

Use the existing ECOCIDE art direction as the source of truth for branding and tone:

- **System layer:** near-black moss backgrounds, toxic-lime accents, monospace labels, restrained CRT scanlines, and thin inspection brackets.
- **Paper layer:** warm off-white dossier panels, typewriter-style text, subtle paper texture, and one or two rubber-stamp marks.
- **Typography:** stencil-style wordmark, monospace interface text, and typewriter/slab-serif text only for paper documents.
- **Satirical tone:** serious, cold, bureaucratic presentation with dry humor. The interface itself should never feel cute or playful.

### Use Style Elements Selectively

Choose only a few signature motifs for each screen, such as:
- A compact case number or barcode.
- One verdict stamp.
- A small inspection reticle or corner brackets.
- A subtle scanline or grid texture.
- One clear status indicator.

Do not use all motifs at once. Treat them as accents, not as content.

### Content Priorities

For the main page, prioritize:

1. **ECOCIDE identity** — wordmark and short tagline.
2. **Primary action** — one clear button to start an audit.
3. **Audit status or result** — show only the most relevant score, tier, and a small amount of supporting evidence when applicable.
4. **Secondary actions** — keep them visually quieter and limited to what is necessary.

Avoid long introductory copy, multiple calls to action with equal prominence, oversized decorative graphics, and large feature grids unless they are genuinely needed for the user journey.

### Dossier and Audit Screens

- Present the result as a concise case file, not a dense dashboard.
- Highlight the compliance score and tier; keep supporting statistics limited.
- Show only a few important flagged objects initially. Let users choose to expand for more detail.
- Use stamps and status labels to communicate verdicts quickly.
- Make any paper-style explanation short, plain-language, and optional.
- Clearly label environmental figures as estimates.

### Interaction and Motion

- Keep interactions straightforward and predictable.
- Use animation only when it communicates a state change, such as scanning or delivering a verdict.
- Avoid constant movement, aggressive flicker, multiple glowing elements, and distracting transitions.
- Respect `prefers-reduced-motion`; provide static equivalents for scanning effects.
- Ensure text contrast and never rely on color alone to communicate status.

### Final Design Test

Before adding any element, ask:

- Does this help the user understand the audit or take the next action?
- Is this information necessary right now?
- Can the same point be communicated with fewer words or a simpler visual?
- Does this element strengthen the ECOCIDE identity without adding clutter?

**If an element is not useful, remove it.** The goal is not to make the page empty; it is to make every remaining element feel intentional.
