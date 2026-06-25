import { describe, it, expect } from "vitest";
import { retrieve, normalize } from "@/telegram/retrieval";
import type { Snapshot } from "@/telegram/types";

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    acopios: [
      {
        category: "acopios",
        sourceId: "s",
        externalId: "1",
        titulo: "Centro de acopio Chacao",
        texto: "Reciben agua y comida",
        ubicacion: { lat: 10, lng: -66, nombre: "Chacao" },
      },
      {
        category: "acopios",
        sourceId: "s",
        externalId: "2",
        titulo: "Acopio Petare",
        texto: "Medicinas",
        ubicacion: { lat: 10, lng: -66, nombre: "Petare" },
      },
    ],
    edificios: [
      {
        category: "edificios",
        sourceId: "s",
        externalId: "3",
        titulo: "Edificio colapsado",
        texto: "La Guaira",
      },
    ],
  },
};

describe("normalize", () => {
  it("strips accents and punctuation, lowercases", () => {
    expect(normalize("Médicínas, ¡Agua!")).toBe("medicinas agua");
  });
});

describe("retrieve", () => {
  it("ranks items by keyword overlap and drops zero-score items", () => {
    const res = retrieve("dónde hay agua en chacao", snap, 5);
    expect(res[0].externalId).toBe("1"); // matches agua + chacao
    expect(res.find((i) => i.externalId === "3")).toBeUndefined(); // no overlap
  });

  it("returns empty when nothing matches", () => {
    expect(retrieve("xyzzy plutonio", snap)).toEqual([]);
  });

  it("respects k", () => {
    expect(retrieve("acopio", snap, 1)).toHaveLength(1);
  });
});
