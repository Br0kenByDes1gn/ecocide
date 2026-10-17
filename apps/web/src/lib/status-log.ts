import { GRID_COPY, ITEM_ARCHETYPES } from '@ecocide/lore';

/**
 * The Planetary Grid's activity log.
 *
 * A pure formatter: it takes the world's message templates (`GRID_COPY.log`) and
 * fills their `{tokens}` from the pack's vocabularies plus the clock. Nothing
 * here is stateful or React-aware, so the screen owns the cadence and the tests
 * can pin every template.
 */

/** The three severities a log line can carry (each maps to a colour + marker). */
export type GridLogLevel = keyof typeof GRID_COPY.log.levels;

export interface GridLogLine {
  /** Stable key: the minute:second plus the sweep number. */
  id: string;
  /** `14:07:33Z`. */
  time: string;
  level: GridLogLevel;
  text: string;
}

/** Every `{token}` the templates may use — the contract the tests enforce. */
export const GRID_LOG_TOKENS: readonly string[] = [
  'lat',
  'lon',
  'time',
  'sector',
  'region',
  'code',
  'object',
  'household',
  'count',
  'fail',
  'pct',
];

/** The household object labels the log can name (the same catalog the audit uses). */
const OBJECT_LABELS: readonly string[] = ITEM_ARCHETYPES.map((a) => a.label);

/** `51.507° N` / `33.868° S`. */
export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'}`;
}

/** `0.128° W` / `151.209° E`. */
export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;
}

/** `51.507° N, 0.128° W`. */
export function formatCoords(lat: number, lon: number): string {
  return `${formatLat(lat)}, ${formatLon(lon)}`;
}

/** `14:07:33Z` — a UTC clock stamp for one line. */
export function formatClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
}

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
}

export interface MakeGridLogLineOptions {
  now: Date;
  /** Random source in [0, 1); the caller owns it (tests pass a constant). */
  rand: () => number;
  /**
   * The sweep number. Selects the template by modulo, so a long-running page
   * shows every predefined message in order rather than resampling at random.
   */
  index: number;
}

/** Fill the next predefined message with fresh parameters. */
export function makeGridLogLine({ now, rand, index }: MakeGridLogLineOptions): GridLogLine {
  const templates = GRID_COPY.log.templates;
  const template = templates[((index % templates.length) + templates.length) % templates.length];

  const lat = rand() * 170 - 85;
  const lon = rand() * 360 - 180;
  const values: Record<string, string> = {
    lat: formatLat(lat),
    lon: formatLon(lon),
    time: formatClock(now),
    sector: pick(GRID_COPY.log.sectors, rand),
    region: pick(GRID_COPY.log.regions, rand),
    code: pick(GRID_COPY.log.codes, rand),
    object: pick(OBJECT_LABELS, rand),
    household: `#${Math.floor(rand() * 900000) + 100000}`,
    count: String(Math.floor(rand() * 480) + 1),
    fail: String(Math.floor(rand() * 12)),
    pct: String(Math.floor(rand() * 100) + 1),
  };

  const text = template.text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

  return {
    id: `${now.getTime()}-${index}`,
    time: values.time,
    level: template.level,
    text,
  };
}
