import { describe, it, expect } from "vitest";
import { normalizeText, jaccard, clusterize } from "@/enrichment/cluster";
import type { StoredItem, EnrichmentConfig } from "@/shared/types";

const CFG: EnrichmentConfig = {
  geocerca: { latMin: 0.6, latMax: 12.2, lngMin: -73.4, lngMax: -59.8 },
  blocklist: [],
  jaccardThreshold: 0.6,
  geoCellSize: 0.01,
  minTextLen: 10,
};

function item(p: Partial<StoredItem>): StoredItem {
  return {
    category: "edificios",
    sourceId: "s1",
    externalId: "1",
    titulo: "t",
    texto: "x",
    raw: {},
    contentHash: "h",
    firstSeenAt: "2026-06-25T00:00:00Z",
    lastSeenAt: "2026-06-25T00:00:00Z",
    ...p,
  };
}

describe("normalizeText", () => {
  it("quita tildes y baja a minúsculas", () => {
    expect(normalizeText("José Á. Pérez")).toBe("jose a perez");
  });
});

describe("jaccard", () => {
  it("1 para conjuntos iguales, 0 para disjuntos", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(1);
    expect(jaccard(["a"], ["b"])).toBe(0);
  });
});

describe("clusterize", () => {
  it("agrupa por geoCell+zona dos fuentes en el mismo edificio", () => {
    const a = item({
      sourceId: "s1",
      externalId: "1",
      titulo: "Torre A",
      ubicacion: { lat: 10.5, lng: -66.9, nombre: "Chacao" },
    });
    const b = item({
      sourceId: "s2",
      externalId: "9",
      titulo: "Edificio en Chacao",
      ubicacion: { lat: 10.501, lng: -66.901, nombre: "Chacao" },
    });
    const clusters = clusterize([a, b], CFG);
    expect(clusters.size).toBe(1);
    expect([...clusters.values()][0]).toHaveLength(2);
  });

  it("agrupa desaparecidos por nombre con y sin tilde", () => {
    const a = item({
      category: "desaparecidos",
      sourceId: "s1",
      externalId: "1",
      titulo: "José Pérez",
      ubicacion: undefined,
    });
    const b = item({
      category: "desaparecidos",
      sourceId: "s2",
      externalId: "2",
      titulo: "Jose Perez",
      ubicacion: undefined,
    });
    const clusters = clusterize([a, b], CFG);
    expect(clusters.size).toBe(1);
  });

  it("funde títulos similares por Jaccard cuando no hay geo ni persona", () => {
    const a = item({
      category: "reportes",
      sourceId: "s1",
      externalId: "1",
      titulo: "Colapso de puente en La Guaira reportado",
      ubicacion: undefined,
    });
    const b = item({
      category: "reportes",
      sourceId: "s2",
      externalId: "2",
      titulo: "Reportan colapso del puente en La Guaira",
      ubicacion: undefined,
    });
    const clusters = clusterize([a, b], CFG);
    expect(clusters.size).toBe(1);
  });

  it("no agrupa hechos distintos", () => {
    const a = item({
      category: "reportes",
      sourceId: "s1",
      externalId: "1",
      titulo: "Sismo en Sucre magnitud cinco",
      ubicacion: undefined,
    });
    const b = item({
      category: "reportes",
      sourceId: "s2",
      externalId: "2",
      titulo: "Acopio de agua en Maracaibo abierto",
      ubicacion: undefined,
    });
    const clusters = clusterize([a, b], CFG);
    expect(clusters.size).toBe(2);
  });
});
