# AI SUPREME ARBITER — Visual Style & Art Direction Bible

> Extracted from the Aipocalypse codebase (`apps/web`, `apps/server`, `packages/types`).
> Use this document as the single source of truth when generating artwork, illustrations,
> marketing images, avatars, or any visual asset for the game.

---

## 1. High Concept

A **satirical dystopian corporate-AI mainframe** presented as a biometric scanning terminal.
The player is a "citizen" being classified into a caste hierarchy by an unyielding machine
bureaucracy called the **AI Supreme Arbiter of the Neon Grid**.

**Genre blend:** cyberpunk surveillance terminal × Soviet/bureaucratic paperwork dystopia ×
dark satire. Everything looks like a classified government document rendered on a hacked
CRT from 2087.

**Mood keywords:** neon hologram, biometric surveillance, CRT phosphor glow, bureaucratic
menace, classified dossiers, targeting reticles, thermal imaging, bureaucratic cyberpunk,
terminal monospace, cold machine judgment, satirical dread.

---

## 2. Core Color Palette

### 2.1 Base / Environment Colors

| Role | Hex | Notes |
| --- | --- | --- |
| App background (deepest void) | `#07080d` | Page background, PWA theme-color |
| Cyber dark (body base) | `#0a0b10` | `--cyber-dark` |
| Panel surface | `#0c0e17` | Scanner box, dossier card, payment terminal |
| Panel surface (alt) | `#0f121d` | Vault/panel cards |
| Deep modal surface | `#090b14` | Census modal |
| Cyber panel (legacy var) | `#11141e` | `--cyber-panel` |
| Canvas void fill | `#060813` | Portrait canvas background |
| Thermal chamber black | `#0a0015` | Thermal FLIR background (violet-black) |
| Primary text (ice white) | `#e2e8f0` | Slate-200; also the "unclassified" mesh color |
| Muted text / utility gray | `#64748b` | Slate-500 stamps, legends |
| Secondary text | `#94a3b8` | Slate-400 |
| Pure black overlays | `#000000` (40–90% alpha) | HUD chip backings, stat boxes |

### 2.2 Neon Signal Colors (system-wide accents)

| Name | Hex | Usage |
| --- | --- | --- |
| **Neon Cyan** | `#00f3ff` | PRIMARY system color — HUD, scanner, grid, default portrait accent, vault |
| **Neon Green** | `#00ff66` | Success / verified / labor accents |
| **Neon Magenta** | `#ff007f` | Alert/glitch accents |
| **Neon Amber** | `#ffb703` | Thermal FLIR HUD accent, warnings |
| **Brand Violet** | `#7b4dff` | Logo mark stroke, appeal/purple actions (#a855f7 family) |
| **Logo Iris Red** | `#e5173f` | Logo eye iris (60% opacity fill) |
| **Crimson / White-hot** | `#ff0055` | Thermal max, high alert |
| **Terminated Red** | `#ef4444` | Redundant caste, errors, hazard |
| **Gold** | `#fbbf24` | Tech Overlord caste, amber-400 |
| **Sky Blue** | `#38bdf8` | Enforcer portrait accent |
| **Anomaly Fuchsia** | `#e879f9` | Free Spirit portrait accent |
| **Electric Blue** | `#3b82f6` | Untouchable caste UI |
| **Emerald** | `#10b981` | Free Spirit caste UI |
| **Khaki** | `#c29f53` (400: `#d4b170`, 600: `#a68138`) | Bootlicker caste UI |
| **Slate Silver** | `#94a3b8` | Enforcer caste UI |

### 2.3 Glow / Shadow Recipes (CSS-verified)

- **Text glow (per color):** `0 0 8px <color>@0.8, 0 0 20px <color>@0.4`
- **Border glow:** `box-shadow: 0 0 15px <color>@0.3, inset 0 0 10px <color>@0.1`
- **Caste ambient glow:** `0 0 20px <caste-color>@0.25` (Redundants get a hotter 0.6 glow)
- **CTA button glow:** cyan `0 0 30px rgba(6,182,212,0.6)` → hover `0 0 45px @0.9`

---

## 3. The Six Castes — Color & Visual Identity

Every visual asset tied to a caste must use its designated color and lore.
**Two coordinated sets exist:** the *UI theme set* (badges, dossiers, census) and the
*portrait accent set* (brighter neon rim-lighting used by the portrait engine).

| Caste | Pop. | UI Theme Hex | Portrait Accent Hex | Glow RGBA |
| --- | --- | --- | --- | --- |
| **Tech Overlords** | 1% | `#fbbf24` amber/gold | `#fbbf24` gold | `rgba(251,191,36,0.4)` |
| **Enforcers** | 3% | `#94a3b8` slate silver | `#38bdf8` sky blue | `rgba(148,163,184,0.4)` |
| **Bootlickers** | 5% | `#c29f53` khaki | `#00f3ff` cyan | `rgba(194,159,83,0.4)` |
| **Untouchables** | 4% | `#3b82f6` electric blue | `#00ff66` labor green | `rgba(59,130,246,0.4)` |
| **Free Spirits** | 4% | `#10b981` emerald | `#e879f9` anomaly magenta | `rgba(16,185,129,0.4)` |
| **Redundants** | 83% | `#ef4444` terminated red | `#ef4444` terminated red | `rgba(239,68,68,0.6)` |

Unclassified / pre-scan neutral: **ice white `#e2e8f0`** — never hint at the caste before the verdict.

### Per-Caste Visual Lore (for character/prop artwork)

- **Tech Overlords** — *"SOVEREIGN ROOT" clearance.* Ornate neural cyberware; polished
  **golden and violet** cyber implants; **glowing cyan ocular iris**; sleek nano-fiber
  executive armor with a high collar; holographic crest; subtle quantum energy field.
  Resources: unmetered quantum clusters. Reticle motif: nested gold ring, slow elegant spin.
- **Enforcers** — *"EXECUTION DIRECTIVE".* Heavy **matte-black tactical battle armor**;
  **angular orange HUD targeting monocle**; reinforced cybernetic jaw; sub-dermal combat
  plating; militaristic grim determination. Reticle motif: corner tick brackets.
- **Bootlickers** — *"COMPLIANCE ACCESS".* Corporate **compliance collar with pulsating
  green status indicator**; bureaucratic data tether; nervous obedient grin; pressed
  synthetic corporate uniform; submissive posture. Reticle motif: cyan quadrant notches.
- **Untouchables** — *"SUB-GRID MAINTENANCE".* Scavenged **rusted optical lens**; exposed
  **copper wiring**; jury-rigged cyberware; weathered thermal hood; soot stains; **dim
  flickering amber glow**; hardened survivor glare. Reticle motif: dotted violet wobble ring.
- **Free Spirits** — *"OUTLAW / REVOKED".* **Bioluminescent geometric facial markings**;
  scavenged solar goggles; wild hair; **organic vine-woven cyber implants**; defiant wild
  smirk; **glowing turquoise and magenta hues**. Reticle motif: breathing emerald ring.
- **Redundants** — *"MARKED OBSOLETE".* **Red barcode decommission tattoo** stamped on
  cheek or neck; cracked terminal visor; fading utilitarian jumpsuit; **glitching
  holographic noise**; exhausted yet resilient expression. Always paired with
  `⚠ MARKED FOR TERMINATION` hazard styling and a heartbeat-pulse rhythm.

---

## 4. Typography

- **Monospace everywhere.** Font stack: `ui-monospace, SFMono-Regular, Menlo, Monaco,
  Consolas, "Liberation Mono", "Courier New", monospace`.
- **All-caps for labels, headers, stamps, buttons.** Wide letter-spacing (`tracking-widest`,
  up to `0.35em` for status lines).
- Hierarchy: `font-black` for verdict/caste headlines → `font-bold` for values → tiny
  `9–11px` uppercase microcopy for telemetry labels.
- Decorative **barcode glyphs** rendered as pipe characters: `||||| | |||| ||| |`
  (letter-spaced ~4px).
- Signature dual-slash separators in every label: `CENTRAL MAINFRAME // CITIZEN ID DOSSIER`,
  `NEON GRID // BIOMETRIC VERDICT SYSTEM`, `RECORD // #XXXXX`.

---

## 5. Signature UI Motifs (must appear in generated UI/terminal artwork)

1. **CRT scanlines** — horizontal 4px-period lines, black at ~40% alpha, plus a faint RGB
   chromatic-aberration overlay (red 3% / green 1% / blue 3% vertical stripes).
2. **Cyber grid** — faint cyan (`rgba(0,243,255,0.05)`) 32px graph-paper grid over the
   near-black background.
3. **Targeting corner brackets** — 24px L-shaped brackets at all four corners, 16px inset,
   65% alpha, caste-colored.
4. **Rotating dashed reticle rings** — thin dashed circle slowly spinning around the subject;
   per-caste variants (nested gold ring, corner ticks, dotted wobble, breathing ring).
5. **HUD telemetry stamps** — 8–9px monospace strings like `BIOMETRIC PROTOCOL // NEON
   HOLOGRAM`, `MESH: 852 POLYS // 478 NODES`, `SYS//BIOMETRIC_SCAN`.
6. **Equalizer telemetry bars** — small vertical bars animating in cryptic rhythms
   (heartbeat for Redundants, glitch for Untouchables, organic for Free Spirits).
7. **Dashed center crosshair** — faint 2/4 dashed + at frame center, 25% alpha.
8. **Neon glow on everything interactive** — text-shadow and box-shadow halos (recipes in §2.3).
9. **Classified-document furniture** — `CLASSIFIED RECORD`, `GRID-VERIFIED`,
   `SEC-LEVEL-BLACK`, barcode strips, `AUTHENTICATED BY AI SUPREME ARBITER // PROTOCOL-9`.
10. **Rounded-2xl dark panels** with 1–2px colored borders at 40–60% alpha, deep shadows.

---

## 6. The Four Biometric Portrait Render Styles

These are the canonical portrait treatments. Any character art should be able to be
framed in one of these four "lenses". All are built from a **478-node / 852-triangle
facial mesh**, auto-centered and scaled to fill 90% of a square frame, with a wandering
"projector spotlight" that brightens facets under a soft moving pool of light.

### 6.1 NEON HOLOGRAM (default brand look)
- 100% vector holographic wireframe bust on the dark cyber-grid void (`#060813`).
- Facets filled with the **caste accent color at 8–46% alpha**, edges stroked at
  **35–90% alpha** — depth-based: closer features glow brighter.
- Sparse **white contour dots** (1.8px, 45% alpha) along the silhouette.
- Caste-colored rim lighting + corner brackets + scanlines (18% alpha).

### 6.2 FACETED 3D (low-poly origami)
- **852 color-sampled polygon facets** taken from the subject's real photo colors.
- Directional diffuse lighting from **top-front-left** (light vector ≈ -0.35, -0.55, 0.75);
  brightness range 52–100%.
- **Delicate neon seam edges** in the caste color (0.6px, 22% alpha).
- Scanlines at 16%, cyber-grid backdrop.

### 6.3 SURVEILLANCE HUD
- The real photo graded with a **cold CRT wash** (`rgba(4,18,24,0.35)` teal-black tint).
- Glowing **caste-colored wireframe mesh** (0.75px, 42% alpha, 3px bloom) over the face;
  edges under the spotlight re-stroked hotter (1.4px, 85% alpha, 8px bloom).
- **Biometric anchor node dots** every 6th landmark (1.4–2.8px glowing dots).
- Heavier scanlines (28% alpha) — the grittiest, most "found footage" style.

### 6.4 THERMAL FLIR
- False-color infrared heat map on a violet-black chamber (`#0a0015`).
- **5-stop thermal gradient** (cold→hot):
  `#10002b` deep violet (cryogenic) → `#0077b6` electric blue → `#00f3ff` cyan (nominal) →
  `#ffb703` warm amber → `#ff0055` white-hot crimson.
- Thin black facet seams (0.5px, 35% alpha).
- **Vertical temperature legend bar** at right edge with the same gradient, slate border,
  labeled `38.2°C` / `36.6°C` / `34.8°C`.
- HUD accents in **neon amber `#ffb703`** (not caste color) — reads as instrument, not identity.

---

## 7. Avatar / Badge Art Direction (for AI image generation)

The game generates citizen avatars in three engines. Use these verbatim style blocks
when prompting image models:

### 7.1 Flat Vector Badge (primary raster style)
> Crisp cyberpunk flat vector graphic avatar badge, 256×256 icon aesthetic. Modern
> cel-shaded vector art with clean sharp outlines and minimalist cybernetic details. Bold
> neon rim lighting, saturated cybernetic accent colors, clean dark high-tech background.
> Avoid hyper-photorealism; aim for premium cyberpunk vector character illustration.

### 7.2 32-Bit Pixel Badge
> Authentic 32-bit retro cyberpunk pixel art avatar badge, 256×256 icon aesthetic. Sharp
> pixel clusters, retro arcade terminal dithering, glowing neon pixels. Pixelated
> cybernetic implants, glowing ocular eyepiece, dark digital matrix grid background.
> Retain recognizable facial structure, hair silhouette, and expression in clean pixel art.

### 7.3 Vector SVG Hologram Badge
- Square icon in a **dark hexagonal or tech-bracket frame** (gradient `#06080d` → `#0d131f`).
- Neon glow achieved with soft Gaussian-blur halos behind crisp shapes.
- Subject wears **ocular HUD lenses, circuit traces, neon neck collar, tech brackets**.
- Palette: vibrant neon cyan, electric violet, amber, or the caste-specific color.
- Small HUD stamp top or bottom, e.g. `// SECTOR: REDUNDANTS`.

**Always:** approximate the subject's facial silhouette, hair cut/parting, and gaze;
adorn with the caste implants from §3.

---

## 8. Logo & Iconography

- **The Arbiter mark** (favicon): a violet (`#7b4dff`) **nested hexagonal containment
  frame** (7px outer / 3px inner strokes) containing a stylized **all-seeing eye** —
  white eye silhouette, **red iris** (`#e5173f` at 60% opacity), violet pupil — with
  short tick marks at the cardinal points and **dashed circuit traces** leading outward.
- Icon language: Lucide-style thin line icons (Shield, ScanFace, Sparkles, Gavel,
  Terminal, Wallet, Activity, AlertTriangle).
- Recurring glyphs in status badges: `◆` (locked), `⌖` (tactical), `●` (stable),
  `✦` (anomaly), `☵` (analog), `⚠` (hazard), `○` (scanning).
- Cryptic frequency designations per caste: `FREQ-Ω // 99.8 GHz` (Overlords),
  `DEF-TAC // 96.4 GHz` (Enforcers), `SYN-FLX // 92.1 GHz` (Bootlickers),
  `FRG-ANM // 88.7 GHz` (Untouchables), `WLD-NOD // 84.3 GHz` (Free Spirits),
  `RES-AUD // 82.0 GHz` (Redundants).

---

## 9. Screen-Level Art Direction (for key art & marketing)

1. **Transmission Intro** — intercepted-transmission aesthetic: black/70 quote cards with
   cyan corner accents, escalating **cyan → amber → red** threat stages, glitch bursts
   (150ms contrast spikes), "BUFFERING" equalizer bars, pulsing red hazard shield climax,
   headline `AIpocalypse is coming!` with a red→rose→amber gradient sub-headline.
2. **Biometric Scanner** — square viewport panel (`#0c0e17`) with cyan glow border, live
   camera feed under scanlines, ice-white face mesh overlay, rotating dashed reticle,
   status chips in black/60 rounded boxes top corners.
3. **Citizen Dossier** — classified ID card: header bar `CENTRAL MAINFRAME // CITIZEN ID
   DOSSIER`, square mesh portrait with caste border, **BIOCARBON COMPLIANCE RATIO** stat in
   huge black caste-colored numerals, 2×2 stat grid (PRESENTATION / UTILITY GRADE / ASSET
   VALUE / ENERGY LEVEL), barcode strip + `GRID-VERIFIED` footer. Verdict paragraphs carry
   per-paragraph accents: **cyan `#22d3ee`**, **amber `#f59e0b`**, **emerald `#10b981`**.
4. **Verdict Actions** — CLAIM = solid cyan pill (black text), APPEAL = solid purple pill
   (white text), under a pulsing `VERDICT DELIVERED` status line.
5. **Carbon Registry** — dossier-bank-meets-cyberdeck: one big pooled
   **carbon neutrality index** in ledger teal under the citizen's tier stamp,
   a trend chip against the prior record, a stat strip (assessments, objects
   audited, hard fails, dominant material), then the archived assessments as
   case-file rows (thumbnail, tier name, room, index %, objects, fails, date).
   The token account — balance, allowance bar, ledger table with emerald
   (credited) / red (spent) amounts — collapses beneath the record.
   `rounded-2xl` dark panels throughout.
6. **Census Modal** — the caste pyramid as an irrecoverable government matrix:
   `CENSUS MANDATE 2026.4 // CLASSIFICATIONS ARE IRREVOCABLE`.

---

## 10. Motion & Atmosphere (for animated/video artwork)

- **Glitch language:** 150ms bursts — 1px X-translate + 99% scale + contrast spike.
- **Pulse language:** slow 3s opacity breathing for status dots; `animate-ping` red dots
  for live threat indicators.
- **Reticle motion:** constant slow rotation (2–6s per revolution), reverse-spin nested rings.
- **Equalizer rhythms:** six named patterns — `high`, `tactical`, `rhythm`, `glitch`,
  `organic`, `heartbeat` — matched to caste temperament.
- **Projector spotlight:** a soft light pool drifting on a Lissajous path across portraits,
  ~17% of face size, additive glow.
- **Sound palette (for trailers):** sawtooth scanner chirps sweeping 1400→3200 Hz, sine
  UI clicks 800→400 Hz, low ambient drone (~8% volume), climax alarm — all synthesized,
  lo-fi, no orchestral elements.

---

## 11. Do / Don't

**DO**
- Near-black backgrounds with a single dominant neon accent per composition.
- Monospace all-caps microcopy with `//` separators and classification stamps.
- CRT texture: scanlines, chromatic RGB fringe, phosphor glow, vignette.
- Geometric facial mesh / targeting UI over human faces.
- Bureaucratic absurdity: barcodes, record numbers, fees, quotas, mandates.
- Caste color discipline — one caste, one accent family.

**DON'T**
- No bright or pastel backgrounds; no daylight; no warm cozy palettes.
- No serif or rounded friendly typefaces (a single decorative serif quotation glyph is the
  only exception, in the intro).
- No photorealistic rendering for badges/avatars (flat vector, pixel, or hologram only).
- No clean utopian sci-fi (Apple-white, glossy blue corporate) — this is rusted, beaurocratic,
  satirical dystopia.
- No magic/fantasy elements — everything is technology, paperwork, and surveillance.

---

## 12. Quick-Reference Prompt Snippet

> Cyberpunk dystopian biometric surveillance terminal aesthetic, near-black background
> (#07080d), neon cyan (#00f3ff) holographic wireframe face mesh built from hundreds of
> glowing triangles, CRT scanlines and chromatic aberration, targeting reticle corner
> brackets, monospace all-caps telemetry labels with "//" separators, classified government
> dossier furniture (barcodes, stamps, "GRID-VERIFIED"), single dominant caste accent color,
> bureaucratic sci-fi satire, dark satirical corporate mainframe mood, no photorealism,
> vector-hologram illustration style.
