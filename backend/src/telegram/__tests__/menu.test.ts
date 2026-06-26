// backend/src/telegram/__tests__/menu.test.ts
import { describe, it, expect } from "vitest";
import {
  categoryScreen,
  homeScreen,
  locationPrompt,
  navScreen,
  selectItems,
  LOCATION_ACTIONS,
} from "@/telegram/menu";
import type { PublicItem, Snapshot } from "@/telegram/types";

function item(p: Partial<PublicItem>): PublicItem {
  return {
    category: "acopios",
    sourceId: "s",
    externalId: Math.random().toString(36).slice(2),
    titulo: "x",
    texto: "y",
    ...p,
  };
}

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    acopios: [
      item({ titulo: "Albergue Central", texto: "camas disponibles" }),
      item({
        titulo: "Punto de agua potable",
        texto: "reparten agua y comida",
      }),
      item({ titulo: "Recolecta de ropa", texto: "donaciones de insumos" }),
    ],
    solicitudes: [
      item({ category: "solicitudes", titulo: "Hospital pide voluntarios" }),
    ],
  },
};

describe("homeScreen", () => {
  it("ofrece insumos, voluntariado y NECESITO AYUDA", () => {
    const flat = (homeScreen().replyMarkup as any).inline_keyboard.flat();
    const datas = flat.map((b: any) => b.callback_data);
    expect(datas).toEqual(
      expect.arrayContaining(["insumos", "voluntariado", "ayuda"]),
    );
  });
});

describe("navScreen", () => {
  it("'animales' devuelve mensaje de próximamente", () => {
    const r = navScreen("animales")!;
    expect(r.text.toLowerCase()).toContain("próximamente");
  });
  it("'ayuda' ofrece los 4 sub-botones", () => {
    const flat = (
      navScreen("ayuda")!.replyMarkup as any
    ).inline_keyboard.flat();
    const datas = flat.map((b: any) => b.callback_data);
    expect(datas).toEqual(
      expect.arrayContaining([
        "emergencias",
        "refugios",
        "viveres",
        "animales",
      ]),
    );
  });
  it("devuelve null para acciones de categoría", () => {
    expect(navScreen("refugios")).toBeNull();
  });
});

describe("selectItems (sub-filtro de acopios)", () => {
  it("refugios captura albergue y NO el resto", () => {
    const titulos = selectItems("refugios", snap).map((i) => i.titulo);
    expect(titulos).toContain("Albergue Central");
    expect(titulos).not.toContain("Recolecta de ropa");
  });
  it("viveres captura agua/comida", () => {
    const titulos = selectItems("viveres", snap).map((i) => i.titulo);
    expect(titulos).toContain("Punto de agua potable");
  });
  it("insumos excluye albergues", () => {
    const titulos = selectItems("insumos", snap).map((i) => i.titulo);
    expect(titulos).toContain("Recolecta de ropa");
    expect(titulos).not.toContain("Albergue Central");
  });
  it("voluntariado lee de solicitudes", () => {
    const titulos = selectItems("voluntariado", snap).map((i) => i.titulo);
    expect(titulos).toContain("Hospital pide voluntarios");
  });
});

describe("categoryScreen", () => {
  it("muestra mensaje vacío cuando no hay ítems", () => {
    const empty: Snapshot = { generatedAt: "t", categories: {} };
    const r = categoryScreen("refugios", empty);
    expect(r.text.toLowerCase()).toContain("no hay registros");
  });
  it("incluye un botón Volver", () => {
    const flat = (
      categoryScreen("refugios", snap).replyMarkup as any
    ).inline_keyboard.flat();
    expect(flat.some((b: any) => b.text.includes("Volver"))).toBe(true);
  });
});

describe("locationPrompt / LOCATION_ACTIONS", () => {
  it("las acciones de categoría requieren ubicación", () => {
    expect([...LOCATION_ACTIONS].sort()).toEqual([
      "insumos",
      "refugios",
      "viveres",
      "voluntariado",
    ]);
  });
  it("ofrece teclado con request_location y opción de saltar", () => {
    const mk = locationPrompt("refugios").replyMarkup as any;
    const flat = mk.keyboard.flat();
    expect(flat.some((b: any) => b.request_location === true)).toBe(true);
    expect(flat.some((b: any) => b.text === "Ver sin ubicación")).toBe(true);
  });
});
