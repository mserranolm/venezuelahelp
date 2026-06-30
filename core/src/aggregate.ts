import { CAT_LABEL } from "./category";
import { filterUsable, matchesZona } from "./filter";
import type { PublicItem, Snapshot } from "./types";

// Ported from backend/src/telegram/retrieval.ts (lines 146–163)
export function plural(n: number, sing: string, plu: string): string {
  return `${n.toLocaleString("es")} ${n === 1 ? sing : plu}`;
}

export function categoryStat(items: PublicItem[]): {
  count: number;
  sources: number;
} {
  const valid = filterUsable(items);
  return {
    count: valid.length,
    sources: new Set(valid.map((i) => i.sourceId)).size,
  };
}

// Ported from backend/src/telegram/query.ts
const LIST_DEFAULT = 20;
const LIST_MAX = 40;

export interface ListArgs {
  category?: string;
  zona?: string;
  limite?: number;
}

export function listItems(
  snap: Snapshot,
  args: ListArgs,
): { category: string; total: number; page: PublicItem[] } {
  const cat =
    args.category && snap.categories[args.category] ? args.category : undefined;
  let pool = filterUsable(
    cat ? (snap.categories[cat] ?? []) : Object.values(snap.categories).flat(),
  );
  if (args.zona) pool = pool.filter((it) => matchesZona(it, args.zona!));
  const total = pool.length;
  const limite = Math.min(Math.max(1, args.limite ?? LIST_DEFAULT), LIST_MAX);
  return { category: cat ?? "todas", total, page: pool.slice(0, limite) };
}

export interface CountArgs {
  category?: string;
  zona?: string;
}

export function countItems(snap: Snapshot, args: CountArgs): string {
  const entries = Object.entries(snap.categories) as [string, PublicItem[]][];
  const filt = (items: PublicItem[]) =>
    args.zona ? items.filter((it) => matchesZona(it, args.zona!)) : items;

  if (args.category && snap.categories[args.category]) {
    const { count, sources } = categoryStat(
      filt(snap.categories[args.category]),
    );
    const label = CAT_LABEL[args.category] ?? args.category;
    const zonaTxt = args.zona ? ` en ${args.zona}` : "";
    return `Hay ${plural(count, "registro", "registros")} de ${label}${zonaTxt} en total (de ${plural(sources, "fuente", "fuentes")}).`;
  }

  const lines = entries
    .map(([cat, items]) => [cat, categoryStat(filt(items))] as const)
    .filter(([, s]) => s.count > 0)
    .map(
      ([cat, s]) =>
        `• ${CAT_LABEL[cat] ?? cat}: ${s.count.toLocaleString("es")}`,
    );
  if (lines.length === 0) return "No tengo registros para ese conteo todavía.";
  const total = entries.reduce(
    (a, [, items]) => a + categoryStat(filt(items)).count,
    0,
  );
  const zonaTxt = args.zona ? ` en ${args.zona}` : "";
  return `📊 Tengo ${total.toLocaleString("es")} registros${zonaTxt}:\n${lines.join("\n")}`;
}
