import {
  ChartColumn,
  ClipboardList,
  Eye,
  FileClock,
  Gavel,
  Leaf,
  ListChecks,
  Recycle,
  ScanSearch,
  Scale,
  Skull,
  Sprout,
  Trash2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * The one place lore's icon keys become components.
 *
 * The pack stores keys — never components — so `@ecocide/lore` stays
 * dependency-free. Two packs of copy use them: the verdict paragraph topics
 * (`topics.p2/p3`) and the dossier's disposition mark (`disposition.icons`), and
 * both draw from this map so a key always means the same glyph wherever it lands.
 *
 * Every glyph here is a single-colour line icon: they inherit `currentColor`, so
 * they take the surrounding ink (the stamp's matte ink on the paper layer, the
 * chip's colour in a HUD). Colour emoji are deliberately not used — they carry
 * their own palette and break the flat stamped look (art §3.2).
 *
 * The key set is validated against the pack by `lore-icons.test.ts`, so a typo in
 * lore fails the suite instead of quietly falling back to a default glyph.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // Verdict paragraph topics
  scan: ScanSearch,
  recycle: Recycle,
  clipboard: ClipboardList,
  gavel: Gavel,
  scale: Scale,
  zap: Zap,
  trash: Trash2,
  leaf: Leaf,
  list: ListChecks,
  // Disposition marks
  sprout: Sprout,
  'file-clock': FileClock,
  'chart-column': ChartColumn,
  eye: Eye,
  skull: Skull,
};

/**
 * Resolve a lore icon key to its component, or `null` when the key is unknown
 * (callers decide their own fallback, so one bad key can never blank a page).
 */
export function loreIcon(key: string | undefined): LucideIcon | null {
  if (!key) return null;
  return ICON_MAP[key] ?? null;
}

/** Keys this build knows how to draw — used by the invariant test. */
export const LORE_ICON_KEYS: readonly string[] = Object.keys(ICON_MAP);
