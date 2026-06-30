import { describe, it, expect } from "vitest";
import { countItems, listItems, categoryStat } from "../index";
import type { PublicItem, Snapshot } from "../index";

const di = (src: string, id: string): PublicItem => ({
  category: "desaparecidos",
  sourceId: src,
  externalId: id,
  titulo: `P${id}`,
  texto: "",
});

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    desaparecidos: [
      di("a", "1"),
      di("a", "2"),
      di("b", "3"),
      { ...di("c", "4"), trust: "sospechoso" },
    ],
    solicitudes: [
      {
        category: "solicitudes",
        sourceId: "s",
        externalId: "x",
        titulo: "Necesito insulina",
        texto: "Petare",
      },
    ],
  },
};

describe("categoryStat", () => {
  it("cuenta usables y fuentes (excluye sospechosos)", () => {
    expect(categoryStat(snap.categories.desaparecidos)).toEqual({
      count: 3,
      sources: 2,
    });
  });
});

describe("countItems", () => {
  it("agrega una categoría con su etiqueta", () => {
    const a = countItems(snap, { category: "desaparecidos" });
    expect(a).toContain("3");
    expect(a).toContain("personas desaparecidas");
  });
  it("resume todas las categorías sin categoría específica", () => {
    expect(countItems(snap, {})).toContain("📊");
  });
});

describe("listItems", () => {
  it("lista la página y reporta el total", () => {
    const r = listItems(snap, { category: "desaparecidos", limite: 2 });
    expect(r.total).toBe(3);
    expect(r.page).toHaveLength(2);
  });
});
