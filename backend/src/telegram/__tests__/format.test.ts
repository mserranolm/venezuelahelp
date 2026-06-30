import { describe, it, expect } from "vitest";
import { formatList } from "@/telegram/format";
import { listItems } from "@venezuelahelp/core";
import type { PublicItem, Snapshot } from "@/telegram/types";

function d(id: string, nombre: string, zona?: string): PublicItem {
  return {
    category: "desaparecidos",
    sourceId: "s",
    externalId: id,
    titulo: nombre,
    texto: "",
    ubicacion: zona ? { lat: 0, lng: 0, nombre: zona } : undefined,
  } as PublicItem;
}

const snap = {
  generatedAt: "t",
  categories: {
    desaparecidos: [
      d("1", "Ana", "La Guaira"),
      d("2", "Beto", "Caracas"),
      { ...d("3", "Dup"), isCanonical: false } as PublicItem,
      { ...d("4", "Sospechoso"), trust: "sospechoso" } as PublicItem,
      d("5", "Carla", "La Guaira"),
    ],
    acopios: [],
    reportes: [],
  },
} as unknown as Snapshot;

describe("formatList", () => {
  it("muestra total real y numera", () => {
    const { category, total, page } = listItems(snap, {
      category: "desaparecidos",
      limite: 2,
    });
    const txt = formatList(category, total, page);
    expect(txt).toContain("📋");
    expect(txt).toContain("mostrando 2 de 3");
    expect(txt).toContain("1. Ana");
    expect(txt).toContain("La Guaira");
  });

  it("muestra aviso de más registros si total > page", () => {
    const { category, total, page } = listItems(snap, {
      category: "desaparecidos",
      limite: 1,
    });
    const txt = formatList(category, total, page);
    expect(txt).toContain("Hay más registros");
  });

  it("sin registros devuelve mensaje vacío", () => {
    const txt = formatList("desaparecidos", 0, []);
    expect(txt).toContain("No tengo registros");
  });

  it("sin registros con zona menciona la zona", () => {
    const txt = formatList("desaparecidos", 0, [], "La Guaira");
    expect(txt).toContain("La Guaira");
  });
});
