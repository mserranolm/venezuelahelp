import { describe, it, expect } from "vitest";
import { countAnswer, isHelpRequest } from "@/telegram/retrieval";
import type { PublicItem, Snapshot } from "@/telegram/types";

function di(src: string, id: string): PublicItem {
  return {
    category: "desaparecidos",
    sourceId: src,
    externalId: id,
    titulo: `Persona ${id}`,
    texto: "",
  } as PublicItem;
}

const countSnap = {
  generatedAt: "t",
  sources: {},
  categories: {
    reportes: [],
    desaparecidos: [
      di("venezuela-te-busca", "1"),
      di("venezuela-te-busca", "2"),
      di("terremotovenezuela", "3"),
      { ...di("ninosvenezuela", "4"), trust: "sospechoso" } as PublicItem,
    ],
    acopios: [],
    edificios: [],
    solicitudes: [
      {
        category: "solicitudes",
        sourceId: "vzlayuda",
        externalId: "s1",
        titulo: "Necesito insulina",
        texto: "Petare",
      } as PublicItem,
    ],
  },
} as unknown as Snapshot;

describe("countAnswer (issue #15: total agregado de todas las fuentes)", () => {
  it("delega en core countItems para la categoría inferida", () => {
    const a = countAnswer("Personas desaparecidas número", countSnap);
    // 3 usables (1+2+3); el sospechoso de ninosvenezuela no cuenta.
    expect(a).not.toBeNull();
    expect(a).toContain("3");
    expect(a).toContain("personas desaparecidas");
    expect(a).toContain("2 fuentes");
  });

  it("devuelve null cuando NO es pregunta de conteo", () => {
    expect(countAnswer("dónde hay agua en Petare", countSnap)).toBeNull();
  });
});

describe("isHelpRequest (issue #15: cómo solicitar ayuda)", () => {
  it("detecta la intención de pedir ayuda", () => {
    expect(isHelpRequest("Cómo puedo solicitar ayuda")).toBe(true);
    expect(isHelpRequest("quiero pedir ayuda")).toBe(true);
  });

  it("NO confunde una necesidad concreta con la guía genérica", () => {
    expect(isHelpRequest("necesito agua en Petare")).toBe(false);
    expect(isHelpRequest("dónde hay refugios")).toBe(false);
  });

  it("detecta un grito de ayuda escueto", () => {
    expect(isHelpRequest("Ayuda")).toBe(true);
    expect(isHelpRequest("ayúdame")).toBe(true);
    expect(isHelpRequest("auxilio")).toBe(true);
    expect(isHelpRequest("socorro")).toBe(true);
    expect(isHelpRequest("ayuda por favor")).toBe(true);
    expect(isHelpRequest("necesito ayuda")).toBe(true);
  });

  it("NO trata como guía una necesidad concreta que contiene 'ayuda'", () => {
    expect(isHelpRequest("necesito ayuda con agua en Petare")).toBe(false);
    expect(isHelpRequest("ayuda para conseguir medicinas en La Guaira")).toBe(
      false,
    );
  });
});
