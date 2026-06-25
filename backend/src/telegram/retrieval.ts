import type { PublicItem, Snapshot } from "@/telegram/types";

const STOP = new Set([
  "que",
  "donde",
  "como",
  "cual",
  "cuales",
  "hay",
  "los",
  "las",
  "del",
  "para",
  "con",
  "una",
  "uno",
  "por",
  "qué",
  "dónde",
  "cómo",
  "the",
  "and",
  "está",
  "estan",
  "este",
  "esta",
  "esto",
  "tengo",
  "necesito",
  "puedo",
]);

export function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywords(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function haystack(it: PublicItem): string {
  return normalize(
    [it.titulo, it.texto, it.ubicacion?.nombre, it.status, it.category]
      .filter(Boolean)
      .join(" "),
  );
}

export function retrieve(
  question: string,
  snap: Snapshot,
  k = 12,
): PublicItem[] {
  const kws = keywords(question);
  if (kws.length === 0) return [];
  const scored: Array<{ item: PublicItem; score: number }> = [];
  for (const items of Object.values(snap.categories)) {
    for (const item of items) {
      const hay = haystack(item);
      let score = 0;
      for (const kw of kws) if (hay.includes(kw)) score += 1;
      if (score > 0) scored.push({ item, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.item);
}
