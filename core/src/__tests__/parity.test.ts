import { describe, it, expect } from "vitest";
import { searchItems, retrieve } from "../index";
import type { Snapshot } from "../index";

const key = (i: { category: string; sourceId: string; externalId: string }) =>
  `${i.category}/${i.sourceId}#${i.externalId}`;

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    reportes: [
      {
        category: "reportes",
        sourceId: "x",
        externalId: "r1",
        titulo: "Agua en Petare",
        texto: "reparten agua",
      },
    ],
    acopios: [
      {
        category: "acopios",
        sourceId: "y",
        externalId: "a1",
        titulo: "Acopio Petare",
        texto: "agua",
      },
      {
        category: "acopios",
        sourceId: "y",
        externalId: "a2",
        titulo: "Acopio Chacao",
        texto: "comida",
      },
    ],
  },
};

describe("paridad bot ↔ API/frontend", () => {
  it("misma consulta → mismo conjunto de ítems (bot vs searchItems)", () => {
    const q = "agua petare";
    const bot = new Set(retrieve(q, snap, 200).map(key));
    const api = new Set(searchItems(snap, { q }).map(key));
    expect(api).toEqual(bot);
  });

  it("el conteo por categoría coincide entre superficies", () => {
    const cat = "acopios";
    const api = searchItems(snap, { category: cat }).length;
    const bot = retrieve(cat, snap, 200).filter(
      (i) => i.category === cat,
    ).length;
    expect(api).toBe(bot);
  });
});
