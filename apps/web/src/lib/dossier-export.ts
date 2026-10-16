import type { OraclePayload } from '@ecocide/types';
import { getFaction, type Caste } from '@ecocide/types';
import { fullAuditReveal } from './useAuditReveal';
import type { LensId } from './audit-lenses';

/** Fixed sheet width in CSS pixels, whatever the visitor's viewport is. */
export const EXPORT_SHEET_WIDTH = 1280;
/** Rasterisation scale: the sheet is drawn at 2× for a crisp shareable file. */
export const EXPORT_SCALE = 2;
/** The stage the sheet sits on, so the dark card is not floating on transparency. */
export const EXPORT_BACKGROUND = '#080b08';
/** Wall-clock ceiling for a capture before we give up and tell the citizen. */
export const EXPORT_TIMEOUT_MS = 20_000;

/** Self-hosted typewriter face the paper layer is set in. */
const PAPER_FONT_URL = '/fonts/special-elite-latin.woff2';

let fontCssPromise: Promise<string> | null = null;

/**
 * The `@font-face` rule for the capture, with the font as a data URL.
 *
 * The capture is rendered from a serialised copy of the sheet inside an SVG, so
 * it cannot see the page's loaded fonts: it has to carry its own. Handing
 * `modern-screenshot` the rule directly (rather than letting it discover the
 * stylesheet) gives the rasteriser one face with no `unicode-range` to trip over,
 * and gives the sandbox no network round-trip to wait on — a font that arrives
 * late lays the text out at fallback widths, which wraps headings that fit on the
 * page and clips the long nowrap case IDs.
 */
function paperFontCss(): Promise<string> {
  fontCssPromise ??= (async () => {
    const res = await fetch(PAPER_FONT_URL);
    if (!res.ok) return '';
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `@font-face{font-family:'Special Elite';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2');}`;
  })().catch(() => '');
  return fontCssPromise;
}

export interface DossierExportSource {
  payload: OraclePayload;
  permalinkId?: string;
  evidenceUrl?: string;
  /** ISO timestamp of the audit session (the header's filing date). */
  sessionDate?: string;
  /** Registry identity shown as the citizen id. */
  citizenId?: string | null;
  /** Reproduce the lens the citizen is looking at. */
  lens?: LensId;
  /** Reproduce the mark space exactly as the page shows it. */
  injunctionStatus?: 'idle' | 'waiting' | 'issued';
}

/**
 * Everything the export derives from the dossier, in one pure place.
 *
 * The sheet itself is the page's own components (`DossierSheet`), so this is not
 * a description of a second design — it is the handful of values the capture
 * needs and the file's identity. Keeping it pure keeps it testable: a jsdom run
 * cannot rasterise, but it can prove the export reads the same pack sources the
 * page does (tier, stamp, disposition, filename).
 */
export interface DossierExportModel {
  filename: string;
  /** Display name of the tier, from the lore pack. */
  factionName: string;
  /** The tier's stamped phrase, from the lore pack. */
  stampText: string;
  /** The disposition mark the paper shows opposite the injunction's. */
  dispositionLabel: string;
  /** The page's fixed sheet metrics. */
  sheetWidth: number;
  scale: number;
  background: string;
}

/** The downloaded file's name — one case file per dossier. */
export function dossierExportFilename(permalinkId?: string): string {
  return `ecocide_case_file_${(permalinkId || 'x').toLowerCase()}.png`;
}

export function dossierExportModel(source: DossierExportSource): DossierExportModel {
  const caste = source.payload.user_profile.caste as Caste;
  const faction = getFaction(caste);
  return {
    filename: dossierExportFilename(source.permalinkId),
    factionName: faction.name,
    stampText: faction.stampText,
    dispositionLabel: faction.disposition.label,
    sheetWidth: EXPORT_SHEET_WIDTH,
    scale: EXPORT_SCALE,
    background: EXPORT_BACKGROUND,
  };
}

/**
 * Render the dossier to a PNG and hand it to the citizen.
 *
 * The image is the page, not a lookalike: the sheet is mounted off-screen from
 * the very components `/citizen` renders (`DossierSheet`, `HouseholdAuditCard`,
 * `PaperDossierPanel`) at a fixed desktop width, and then rasterised by the
 * browser. A hand-painted canvas used to do this job and had drifted a design
 * generation behind the page; anything that re-draws the dossier separately will
 * always end up describing a page that no longer exists.
 *
 * `modern-screenshot` captures through an SVG `foreignObject`, so the browser's
 * own renderer produces the pixels: Tailwind v4's `oklch()` colours, the stamps'
 * `color-mix()`, gradients and box-shadows all survive. `html2canvas`-style
 * captures re-implement colour parsing and would render those wrong.
 */
export async function downloadHouseholdDossier(source: DossierExportSource): Promise<void> {
  const model = dossierExportModel(source);
  const host = document.createElement('div');
  // Off-screen but *laid out*: `display: none` (or a detached node) has no box,
  // and a capture of a box-less subtree is blank.
  host.setAttribute('data-dossier-export', '');
  host.style.cssText = [
    'position: fixed',
    'left: -20000px',
    'top: 0',
    `width: ${model.sheetWidth}px`,
    'pointer-events: none',
    'z-index: -1',
    // Freeze the page's motion so the frame is deterministic: the stamp sits at
    // its resting tilt instead of mid-press, and the "drafting orders" line is a
    // plain line instead of a half-faded pulse.
    'animation: none !important',
    'transition: none !important',
  ].join('; ');

  let root: { unmount: () => void } | null = null;
  try {
    const [{ createRoot }, { flushSync }, { domToPng }, React, { DossierSheet }, { HouseholdAuditCard }, { PaperDossierPanel }] =
      await Promise.all([
        import('react-dom/client'),
        import('react-dom'),
        import('modern-screenshot'),
        import('react'),
        import('../components/DossierSheet'),
        import('../components/HouseholdAuditCard'),
        import('../components/PaperDossierPanel'),
      ]);
    if (source.evidenceUrl) await waitForEvidenceModel(source.evidenceUrl);

    document.body.appendChild(host);
    const created = createRoot(host);
    root = created;

    await new Promise<void>((resolve) => {
      flushSync(() => {
        created.render(
          React.createElement(
            'div',
            // The captured node must be **in flow** with a definite width.
            // `domToPng` clones the node into a sandbox; a `position: fixed`
            // element lays out against that sandbox's viewport instead of its own
            // width, so the clone rendered at the browser's window width and the
            // capture sliced the paper's right edge off.
            {
              'data-dossier-sheet': '',
              className: 'bg-[#080b08] p-3',
              style: { width: `${model.sheetWidth}px` },
            },
            React.createElement(DossierSheet, {
              card: React.createElement(HouseholdAuditCard, {
                payload: source.payload,
                evidenceUrl: source.evidenceUrl,
                reveal: fullAuditReveal(source.payload.user_profile, source.payload.audit),
                lens: source.lens,
                hideInventory: true,
                onLensRendered: () => resolve(),
              }),
              panel: React.createElement(PaperDossierPanel, {
                payload: source.payload,
                evidenceUrl: source.evidenceUrl,
                permalinkId: source.permalinkId,
                sessionDate: source.sessionDate,
                citizenId: source.citizenId,
                injunction: { status: source.injunctionStatus ?? 'idle' },
                onOpenDisposition: () => {},
                // A downloaded case file carries its inventory.
                inventoryOpen: true,
                onToggleInventory: () => {},
              }),
            })
          )
        );
      });
      // Without evidence there is no lens image to wait for.
      if (!source.evidenceUrl) resolve();
      // The card signals when its lens is drawn; do not hang if it never fires.
      setTimeout(resolve, 1500);
    });

    await fontsReady();
    const fontCss = await paperFontCss();
    // Let the sheet settle (fonts swap, inventory rows, flex wrapping).
    await nextFrames(2);
    replaceCanvases(host);

    // Capture the in-flow sheet, not the fixed host that merely parks it
    // off-screen.
    const sheet = host.querySelector<HTMLElement>('[data-dossier-sheet]');
    if (!sheet) throw new Error('dossier export surface failed to mount');

    const dataUrl = await domToPng(sheet, {
      width: model.sheetWidth,
      scale: model.scale,
      backgroundColor: model.background,
      timeout: EXPORT_TIMEOUT_MS,
      // Carry the paper's own face; without it the raster lays text out at
      // fallback widths and the sheet no longer matches the page.
      font: fontCss ? { cssText: fontCss } : undefined,
    });

    triggerDownload(dataUrl, model.filename);
  } finally {
    root?.unmount();
    host.remove();
  }
}

async function fontsReady(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    /* no fonts API (older browser) — carry on with whatever is loaded */
  }
}

/** Wait for the evidence photo to decode, so the card's lens has something to draw. */
function waitForEvidenceModel(url: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    img.src = url;
    // Never block the export on a slow photo.
    setTimeout(done, 3000);
  });
}

function nextFrames(count: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(count);
  });
}

/**
 * Swap every canvas for an image of itself.
 *
 * An SVG `foreignObject` serialises markup, and a canvas's bitmap is not markup —
 * it would come out blank. The audit card draws the evidence photo and its item
 * markings onto a canvas, so without this the exported sheet would carry an empty
 * frame where the lens belongs.
 */
function replaceCanvases(root: HTMLElement): void {
  for (const canvas of Array.from(root.querySelectorAll('canvas'))) {
    if (canvas.width === 0 || canvas.height === 0) continue;
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      // A tainted canvas (cross-origin photo) cannot be read; leave it in place
      // rather than failing the whole export.
      continue;
    }
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    // Keep the canvas's own layout identity.
    img.className = canvas.className;
    img.style.cssText = 'display:block';
    canvas.replaceWith(img);
  }
}

function triggerDownload(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
