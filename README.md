# AI Supreme Arbiter // Neon Grid

A satirical dystopian web application and Progressive Web App (PWA) built with **Vite**, **React**, **TypeScript**, **MediaPipe**, **Hono**, and **Google Gemini 2.5 Flash**.

The AI Supreme Arbiter subjects users to biometric facial analysis, categorizes them into deterministic dystopian castes, and renders an exaggerated, hilarious verdict predicting their future in the Neon Grid.

---

## ⚡ Architecture & Pipeline

```
[User Camera / Selfie]
        │
        ├──> [MediaPipe Face Mesh (WASM)] ──> Caste Geometry Percentile (0.0 - 100.0%)
        │                                 └── Biocarbon Compliance Ratio (0 - 100%)
        │
        └──> [Gemini 2.5 Flash Multimodal] ──> Apparent Presentation (Masculine / Feminine / Androgynous)
                                           └── Life Stage, Wealth Tier, Gaze Energy & Dystopian Honorific Title
                                           └── 3-Paragraph Sarcastic Dystopian Prophecy
                                                    │
                                                    ▼
                                        [Citizen ID Dossier Badge]
                                        (Downloadable PNG / Share Sheet / SQLite Permalinks)
```

### 🏛️ Caste & Tribe Target Distribution (100% Deterministic)
- **Tech Overlords (1%)**: Rule society completely, treat humanity like an operating system.
- **Enforcers (3%)**: Heavy weapons units controlling lower classes on behalf of Overlords.
- **Bootlickers (5%)**: The obedient working minority; desperate to please their superiors.
- **Untouchables (4%)**: Living precariously on the fringes of civilization with zero rights.
- **Free Spirits (4%)**: Off-grid wilderness renegades avoiding civilization entirely.
- **Redundants (83%)**: Deemed non-essential by the Central Mainframe, **marked for termination & biomass recycling**.

> **How the caste is calculated (100% deterministic & re-scan stable):** three scale-invariant ratios from the 478-landmark face mesh (`facialAspectRatio`, `jawTaperRatio`, `eyeToNoseRatio`) are normalized into 630 equal-probability face-type bins, ranked by distance from the population center, and split into quota shells (1/3/5/4/4/83 %) — the statistically average face is apex, statistical outliers are Redundant. See [`face-geometry.ts`](file:///home/zaro/dev/ecocide/apps/web/src/lib/face-geometry.ts) for the engine.

> **Game flow — Claim & Appeal (mock tokens, no real payments):** once the verdict is delivered you can **CLAIM** your designation (mock payment → citizen dossier) or **APPEAL** it (mock filing fee → state your case). Every appeal + its Arbiter ruling is archived in an `appeals` table and shown on the **Appeal Records** screen (`/appeals/:id`, latest prominent + browsable history). An **accepted** appeal does not change your record until you **RE-ARBITRATE AS NEW CASTE** — the original vision oracle prompt is re-run against the archived ~360px photo snapshot with your new caste (the appeal is acknowledged only in paragraph 1), then the `Arbitration` animation replays. A **rejected** appeal offers **NEW APPEAL** or **ACCEPT VERDICT** (replays arbitration as-is).

---

## 🛠️ Project Structure

This project is organized as a high-performance **pnpm workspace monorepo**:

- **`packages/types`**: Shared TypeScript interfaces, castes, telemetry, and payload schemas matching [IDEA.md](file:///home/zaro/dev/ecocide/IDEA.md).
- **`apps/web`**: Cyberpunk frontend with real-time green wireframe mesh HUD, Web Audio SFX synthesizer, and PWA installation.
- **`apps/server`**: Hono API proxy for Gemini with embedded SQLite database (`node:sqlite`) for citizen record permalinks.

> **🎨 Generating artwork?** The full visual style bible — exact hex palettes, caste color systems & lore, the four biometric portrait render styles, avatar badge prompts, typography, and UI motifs — lives in [ART_DIRECTION.md](file:///home/zaro/dev/ecocide/ART_DIRECTION.md).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment (Optional for Gemini)
Create a `.env` file in the root or in `apps/server/.env`:
```env
PORT=3001
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: outgoing email (leave SMTP_HOST empty to log instead of send)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="AI Supreme Arbiter <arbiter@ecocide.local>"
APP_BASE_URL=http://localhost:5173

# Asset Vault identity (email OTP + sessions). A dev fallback secret is used
# when unset, but production requires a real BETTER_AUTH_SECRET.
BETTER_AUTH_SECRET=change-me-to-a-long-random-string
BETTER_AUTH_URL=http://localhost:3001

# Optional: async job queue (leave REDIS_URL empty to run jobs inline)
REDIS_URL=redis://localhost:6379
BULL_BOARD_USER=admin
BULL_BOARD_PASS=change-me
```
> *Note: If no API key is provided, the Oracle automatically operates in simulated offline mode for seamless development and testing.*
>
> *The asynchronous job queue (BullMQ) sends verdict/appeal emails and avatar synthesis. Start a local Redis with `docker compose -f docker-compose.dev.yml up -d` — without `REDIS_URL` jobs run inline and no Redis is needed. With no `SMTP_HOST`, outgoing emails are logged (nodemailer `jsonTransport`) instead of sent. The Bull Board queue dashboard is available at `/admin/queues` when Redis and `BULL_BOARD_*` credentials are set.*
>
> *Asset Vault unlocking is email-OTP based. With no `SMTP_HOST`, the one-time code is also printed to the server console (`[Auth] Vault unlock OTP for …`) so you can log in locally. From a native/Capacitor shell the session can be carried as an `Authorization: Bearer` token (web uses the HttpOnly session cookie).*

### 3. Launch Development Servers
```bash
# Run both Frontend (Vite) and Backend (Hono) concurrently:
pnpm dev:all

# Or run separately:
pnpm dev:web     # http://localhost:5173
pnpm dev:server  # http://localhost:3001
```

### 4. Run Test Suite
```bash
pnpm test
```
All unit tests verify deterministic distance-shell caste distribution, symmetry scores, and SQLite persistence.

---

## 📱 Mobile App Delivery (PWA & Capacitor)

1. **Progressive Web App (PWA)**:
   - Already configured with `vite-plugin-pwa` and Service Worker precaching.
   - On iOS Safari: Tap **Share** $\rightarrow$ **Add to Home Screen**.
   - On Android Chrome: Tap **Install App**.

2. **Native iOS & Android Deployment (Capacitor)**:
   - When ready to publish to the Apple App Store or Google Play Store:
   ```bash
   cd apps/web
   pnpm add @capacitor/core @capacitor/cli @capacitor/camera @capacitor/share
   npx cap init "AI Supreme Arbiter" "com.neon.arbiter" --web-dir dist
   pnpm build
   npx cap add ios
   npx cap add android
   npx cap open ios      # Opens Xcode
   npx cap open android  # Opens Android Studio
   ```
