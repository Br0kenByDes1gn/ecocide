# @ecocide/web

React 19 + Vite + Tailwind v4 PWA for Ecocide (placeholder working title).

- Framework notes: Vite 8 (rolldown), Tailwind v4 CSS-first config
  (`src/index.css` carries the `@theme` tokens and `@source` scans for
  `packages/types` and `packages/lore`).
- All story/art copy comes from `packages/lore` — see `STORY.md`.
- Zero-token development: `/debug` bench, `sample_face.png`, simulated
  verdicts (no API key), OTP printed to the server console.