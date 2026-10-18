/**
 * Google Analytics 4 for the web app.
 *
 * The standard gtag snippet fires one pageview per *document* load, which in a
 * single-page app means the whole journey — intro → scan → verdict → claim /
 * appeal → registry → injunction → grid — arrives as a single hit. So the tag is
 * injected with `send_page_view: false` and `App.tsx` sends one `page_view` per
 * screen instead (see the route tracker there).
 *
 * Two more deliberate choices:
 *
 *   • **Production builds only.** `initAnalytics` is a no-op under `vite dev`, so
 *     local clicking never pollutes the property.
 *   • **No household ids leave the app.** Permalinks carry the subject's dossier
 *     id (`/citizen/-okeQbQ6Z4`); `analyticsPath` collapses them to `/citizen/:id`
 *     before anything is sent. That is both cleaner reporting and the same
 *     principle as "SCAN OBJECTS, NOT PEOPLE".
 *
 * The measurement id is public by design (it ships in the page source of every
 * site that uses it), so it lives here rather than in an env var.
 */

export const GA_MEASUREMENT_ID = 'G-CES4JGST5C';

/** GA's gtag queue: it must exist *before* the remote script loads. */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Idempotent: React StrictMode can run the entry twice in development. */
let started = false;

/**
 * Injects the two tags from the gtag snippet (the loader + the queue shim) and
 * configures the property without an automatic pageview. Safe to call anywhere;
 * does nothing outside a production build or without a DOM.
 */
export function initAnalytics(): void {
  if (started || typeof document === 'undefined' || !import.meta.env.PROD) return;
  started = true;

  const loader = document.createElement('script');
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(loader);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // The queue takes the `arguments` object itself, exactly as the snippet does.
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
}

/**
 * Sends one pageview for a screen. The path is expected to be normalized
 * (`analyticsPath`), never a raw permalink.
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    ...(title ? { page_title: title } : {}),
  });
}

/** Routes whose last segment is a dossier id, e.g. `/citizen/<id>`. */
const ID_ROUTES = new Set(['citizen', 'arbitration', 'claim', 'appeal', 'appeals', 'inform']);

/** Pre-rename URLs the app normalizes on load, reported under their real name. */
const ALIASES: Record<string, string> = {
  '/about': '/adjudicators',
  '/vault': '/registry',
};

/**
 * The path GA should see for a location: id-free, alias-free, query-free.
 *
 *   /citizen/-okeQbQ6Z4   → /citizen/:id
 *   /injunction?dossier=x → /injunction      (the filter is an id too)
 *   /about                → /adjudicators
 *   /scan                 → /scan
 *
 * Anything unrecognised is reported as it is: an unexpected path in the reports
 * is a signal, not noise to be smoothed away.
 */
export function analyticsPath(pathname: string): string {
  if (!pathname.startsWith('/')) return '/';
  // Drop a trailing slash (and keep the root as '/').
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '/';

  const [head, ...rest] = segments;
  if (ID_ROUTES.has(head) && rest.length > 0) return `/${head}/:id`;
  if (rest.length > 0) return path;

  return ALIASES[`/${head}`] ?? `/${head}`;
}
