import { CAT_LABEL } from "@venezuelahelp/core";
import type { PublicItem } from "@/telegram/types";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatList(
  category: string,
  total: number,
  page: PublicItem[],
  zona?: string,
): string {
  if (page.length === 0) {
    return zona
      ? `No encontré registros en "${zona}" todavía. Prueba con otra zona o sin filtro.`
      : "No tengo registros para esa lista todavía.";
  }
  const label = cap(CAT_LABEL[category] ?? category);
  const zonaTxt = zona ? ` en ${zona}` : "";
  const lines = page.map((it, i) => {
    const loc = it.ubicacion?.nombre ? ` — ${it.ubicacion.nombre}` : "";
    return `${i + 1}. ${it.titulo}${loc}`;
  });
  const header = `📋 ${label}${zonaTxt} (mostrando ${page.length} de ${total.toLocaleString("es")}):`;
  const footer =
    total > page.length
      ? `\n\nHay más registros. Acota por zona para afinar (p. ej. "${label.toLowerCase()} en La Guaira").`
      : "";
  return `${header}\n\n${lines.join("\n")}${footer}`;
}
