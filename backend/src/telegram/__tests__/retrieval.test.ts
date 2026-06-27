import { describe, it, expect } from "vitest";
import {
  retrieve,
  normalize,
  countAnswer,
  isHelpRequest,
} from "@/telegram/retrieval";
import type { PublicItem, Snapshot } from "@/telegram/types";

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

describe("retrieve — category routing", () => {
  // Reproduce el bug real: una pregunta sobre "desaparecidos en La Guaira"
  // era copada por ítems de 'reportes' (la categoría más grande) cuyo TEXTO
  // mencionaba ambas palabras, dejando 0 desaparecidos reales en el resultado.
  const big: Snapshot = {
    generatedAt: "t",
    categories: {
      // 6 reportes/tweets que mencionan ambas palabras en el texto
      reportes: Array.from({ length: 6 }, (_, i) => ({
        category: "reportes",
        sourceId: "sismo",
        externalId: `r${i}`,
        titulo: `Noticia ${i}`,
        texto: "Hay muchos desaparecidos tras el sismo en La Guaira",
      })),
      // 2 fichas reales de personas desaparecidas en La Guaira
      desaparecidos: [
        {
          category: "desaparecidos",
          sourceId: "vtb",
          externalId: "d1",
          titulo: "Vitarca Thamara Rada",
          texto: "58 años, Sector Caribe, La Guaira, por localizar",
        },
        {
          category: "desaparecidos",
          sourceId: "vtb",
          externalId: "d2",
          titulo: "Jhongelys Carao",
          texto: "11 años, La Guaira, por localizar",
        },
      ],
    },
  };

  it("prioritiza la categoría inferida de la pregunta", () => {
    const res = retrieve("¿Hay desaparecidos en La Guaira?", big, 12);
    const desap = res.filter((i) => i.category === "desaparecidos");
    expect(desap.length).toBe(2); // ambas fichas reales llegan al LLM
    expect(res[0].category).toBe("desaparecidos"); // y van primero
  });
});

describe("retrieve — field weighting", () => {
  const snap: Snapshot = {
    generatedAt: "t",
    categories: {
      acopios: [
        {
          category: "acopios",
          sourceId: "s",
          externalId: "en-texto",
          titulo: "Centro de ayuda",
          texto: "Aquí en Petare recibimos donaciones para todos",
        },
        {
          category: "acopios",
          sourceId: "s",
          externalId: "en-titulo",
          titulo: "Acopio Petare",
          texto: "Reciben insumos",
        },
      ],
    },
  };

  it("pondera coincidencia en título por encima de coincidencia en texto", () => {
    const res = retrieve("petare", snap, 5);
    expect(res[0].externalId).toBe("en-titulo");
  });
});

describe("retrieve — diversidad por categoría", () => {
  const snap: Snapshot = {
    generatedAt: "t",
    categories: {
      acopios: Array.from({ length: 20 }, (_, i) => ({
        category: "acopios",
        sourceId: "s",
        externalId: `a${i}`,
        titulo: `Acopio Guaira ${i}`,
        texto: "",
      })),
      edificios: Array.from({ length: 3 }, (_, i) => ({
        category: "edificios",
        sourceId: "s",
        externalId: `e${i}`,
        titulo: `Edificio Guaira ${i}`,
        texto: "",
      })),
    },
  };

  it("no deja que una categoría cope todos los cupos en empates", () => {
    const res = retrieve("guaira", snap, 10);
    // sin cuota, los 10 cupos serían acopios (van primero en iteración)
    expect(res.filter((i) => i.category === "edificios").length).toBe(3);
    expect(
      res.filter((i) => i.category === "acopios").length,
    ).toBeLessThanOrEqual(7);
  });
});

describe("retrieve — variantes singular/plural y género", () => {
  const snap: Snapshot = {
    generatedAt: "t",
    categories: {
      desaparecidos: [
        {
          category: "desaparecidos",
          sourceId: "s",
          externalId: "d1",
          titulo: "María Pérez",
          texto: "32 años, reportada como desaparecida en Vargas",
        },
      ],
      edificios: [
        {
          category: "edificios",
          sourceId: "s",
          externalId: "e1",
          titulo: "Edificio El Porvenir",
          texto: "estructura colapsada en el primer piso",
        },
      ],
    },
  };

  it("encuentra 'desaparecida' al preguntar 'desaparecidos'", () => {
    const res = retrieve("¿desaparecidos en Vargas?", snap, 5);
    expect(res.find((i) => i.externalId === "d1")).toBeDefined();
  });

  it("encuentra 'colapsada' al preguntar 'colapsados'", () => {
    const res = retrieve("edificios colapsados", snap, 5);
    expect(res.find((i) => i.externalId === "e1")).toBeDefined();
  });
});

describe("retrieve — ranking por término discriminante dentro de la categoría", () => {
  const snap: Snapshot = {
    generatedAt: "t",
    categories: {
      desaparecidos: [
        {
          category: "desaparecidos",
          sourceId: "s",
          externalId: "header",
          titulo: "Desaparecidos", // matchea la palabra de categoría en el título
          texto: "listado general",
        },
        {
          category: "desaparecidos",
          sourceId: "s",
          externalId: "caracas",
          titulo: "Pedro Gómez",
          texto: "40 años, Caracas, por localizar",
        },
        {
          category: "desaparecidos",
          sourceId: "s",
          externalId: "guaira",
          titulo: "Ana Ruiz",
          texto: "25 años, La Guaira, por localizar",
        },
      ],
    },
  };

  it("una ficha de La Guaira gana al encabezado genérico 'Desaparecidos'", () => {
    const res = retrieve("¿Hay desaparecidos en La Guaira?", snap, 5);
    expect(res[0].externalId).toBe("guaira");
  });
});

describe("retrieve — enrichment", () => {
  it("excluye ítems sospechosos del retrieval", () => {
    const s = {
      generatedAt: "t",
      categories: {
        reportes: [
          {
            category: "reportes",
            sourceId: "s1",
            externalId: "1",
            titulo: "sismo guaira",
            texto: "x",
            trust: "sospechoso",
            isCanonical: true,
            sourcesCount: 1,
          },
          {
            category: "reportes",
            sourceId: "s2",
            externalId: "2",
            titulo: "sismo guaira",
            texto: "x",
            trust: "corroborado",
            isCanonical: true,
            sourcesCount: 2,
          },
        ],
      },
    } as unknown as Snapshot;
    const res = retrieve("sismo guaira", s, 15);
    expect(res.every((i) => i.trust !== "sospechoso")).toBe(true);
    expect(res).toHaveLength(1);
  });

  it("prioriza el canónico frente al duplicado a igual score", () => {
    const s = {
      generatedAt: "t",
      categories: {
        edificios: [
          {
            category: "edificios",
            sourceId: "s1",
            externalId: "1",
            titulo: "torre chacao",
            texto: "x",
            trust: "corroborado",
            isCanonical: false,
            dupOf: "s2#2",
            sourcesCount: 2,
          },
          {
            category: "edificios",
            sourceId: "s2",
            externalId: "2",
            titulo: "torre chacao",
            texto: "x",
            trust: "corroborado",
            isCanonical: true,
            sourcesCount: 2,
          },
        ],
      },
    } as unknown as Snapshot;
    const res = retrieve("torre chacao", s, 1);
    expect(res[0].isCanonical).toBe(true);
  });
});

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
  it("agrega desaparecidos de todas las fuentes (excluye sospechosos)", () => {
    const a = countAnswer("Personas desaparecidas número", countSnap);
    // 3 usables (1+2+3); el sospechoso de ninosvenezuela no cuenta.
    expect(a).toContain("3");
    expect(a).toContain("personas desaparecidas");
    expect(a).toContain("2 fuentes");
  });

  it("responde un resumen de todas las categorías sin categoría específica", () => {
    const a = countAnswer("cuántos registros hay en total", countSnap);
    expect(a).toContain("📊");
    expect(a).toContain("personas desaparecidas");
    expect(a).toContain("solicitudes de ayuda");
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
});
