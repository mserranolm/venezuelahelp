import { describe, it, expect, vi } from "vitest";
import reportsFeed from "./fixtures/sismo_reports_feed.json";
import reliefCenters from "./fixtures/sismo_relief_centers.json";
import buildingDamage from "./fixtures/sismo_building_damage.json";
import needs from "./fixtures/sismo_needs.json";
import { PRESETS } from "@/connectors/presets";
import { runRestSource } from "@/connectors/restEngine";

// fetchJson mockeado: mapea por pathname del endpoint al fixture.
function fetchByPath(map: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const key = Object.keys(map).find((p) => path.startsWith(p));
    if (!key) throw new Error(`GET ${url} failed: 404`);
    return map[key];
  }) as never;
}

const FIXTURES = {
  "/api/reports/feed": reportsFeed,
  "/api/relief-centers": reliefCenters,
  "/api/building-damage": buildingDamage,
  "/api/needs": needs,
};

describe("preset sismovenezuela", () => {
  it("normaliza las 4 categorías con sourceId fijado", async () => {
    const { items } = await runRestSource(
      "sismovenezuela",
      PRESETS.sismovenezuela,
      { fetchJson: fetchByPath(FIXTURES) },
    );
    const cats = new Set(items.map((i) => i.category));
    expect(cats).toEqual(
      new Set(["reportes", "acopios", "edificios", "solicitudes"]),
    );
    expect(items.every((i) => i.sourceId === "sismovenezuela")).toBe(true);
    expect(items.every((i) => i.externalId.length > 0)).toBe(true);
  });

  it("reportes: source_url → sourceUrl, media_urls[0] → imageUrl", async () => {
    const { items } = await runRestSource(
      "sismovenezuela",
      PRESETS.sismovenezuela,
      { fetchJson: fetchByPath(FIXTURES) },
    );
    const r0 = items.find(
      (i) => i.category === "reportes" && i.externalId === reportsFeed[0].id,
    );
    expect(r0?.sourceUrl).toBe(reportsFeed[0].source_url);
    expect(r0?.imageUrl).toBe(reportsFeed[0].media_urls?.[0]);
    // segundo reporte: media_urls null → sin imageUrl
    const r1 = items.find(
      (i) => i.category === "reportes" && i.externalId === reportsFeed[1].id,
    );
    expect(r1?.imageUrl).toBeUndefined();
  });

  it("edificios (geojson): coords [lng,lat] → ubicacion, source → sourceUrl", async () => {
    const { items } = await runRestSource(
      "sismovenezuela",
      PRESETS.sismovenezuela,
      { fetchJson: fetchByPath(FIXTURES) },
    );
    const f = buildingDamage.features[0];
    const edi = items.find(
      (i) => i.category === "edificios" && i.externalId === f.properties.id,
    );
    expect(edi?.ubicacion?.lat).toBe(f.geometry.coordinates[1]);
    expect(edi?.ubicacion?.lng).toBe(f.geometry.coordinates[0]);
    expect(edi?.ubicacion?.lat).not.toBe(edi?.ubicacion?.lng);
    expect(edi?.sourceUrl).toBe(f.properties.source);
    // segundo edificio trae photo_url → imageUrl
    const f1 = buildingDamage.features[1];
    const edi1 = items.find(
      (i) => i.category === "edificios" && i.externalId === f1.properties.id,
    );
    expect(edi1?.imageUrl).toBe(f1.properties.photo_url);
  });

  it("acopios y solicitudes también capturan source_url", async () => {
    const { items } = await runRestSource(
      "sismovenezuela",
      PRESETS.sismovenezuela,
      { fetchJson: fetchByPath(FIXTURES) },
    );
    const acopio = items.find((i) => i.category === "acopios");
    expect(acopio?.sourceUrl).toBe(reliefCenters[0].source_url);
    const sol = items.find((i) => i.category === "solicitudes");
    expect(sol?.sourceUrl).toBe(needs.data[0].source_url);
  });

  it("usgs (geojson): mapea code→externalId, title→titulo, coords→ubicacion", async () => {
    const feature = {
      type: "Feature",
      properties: {
        code: "6000t7zp",
        title: "M 7.5 - 28 km SE of Yumare, Venezuela",
        place: "28 km SE of Yumare, Venezuela",
        url: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000t7zp",
      },
      geometry: { coordinates: [-68.4716, 10.4351, 10] },
    };
    const { items } = await runRestSource("usgs", PRESETS.usgs, {
      fetchJson: (async () => ({ features: [feature] })) as never,
    });
    expect(items[0]).toMatchObject({
      category: "reportes",
      externalId: "6000t7zp",
      titulo: "M 7.5 - 28 km SE of Yumare, Venezuela",
      sourceUrl: "https://earthquake.usgs.gov/earthquakes/eventpage/us6000t7zp",
    });
    expect(items[0].ubicacion).toEqual({
      lat: 10.4351,
      lng: -68.4716,
      nombre: "M 7.5 - 28 km SE of Yumare, Venezuela",
    });
  });

  it("red-esperanza desaparecidos: nombre→titulo, foto_url→imageUrl, lat/lng", async () => {
    const row = {
      id: "b6a262c7",
      nombre: "Saymar Reina",
      ultima_ubicacion: "Catia la mar",
      fecha_desaparicion: "2026-06-24",
      contacto_familiar: "Vanessa, 0424",
      lat: 10.59,
      lng: -67.01,
      foto_url: "https://cdn-imagenes.theempire.tech/images/x.jpg",
      estado: "no_encontrado",
    };
    const { items } = await runRestSource(
      "red-esperanza",
      { base: "https://x", endpoints: [PRESETS["red-esperanza"].endpoints[0]] },
      { fetchJson: (async () => [row]) as never },
    );
    expect(items[0]).toMatchObject({
      category: "desaparecidos",
      externalId: "b6a262c7",
      titulo: "Saymar Reina",
      imageUrl: "https://cdn-imagenes.theempire.tech/images/x.jpg",
      status: "no_encontrado",
    });
    expect(items[0].ubicacion).toEqual({
      lat: 10.59,
      lng: -67.01,
      nombre: "Saymar Reina",
    });
  });

  it("pacientesve (Google Sheet): filas-array, id compuesto, salta encabezado", async () => {
    const values = [
      ["Nombre", "Cédula", "Edad", "Hospital", "Estado", "Condición"],
      ["Aaron Villastro", "—", "8", "H. Pérez Carreño", "Caracas", "Ingresado"],
    ];
    const { items } = await runRestSource("pacientesve", PRESETS.pacientesve, {
      fetchJson: (async () => ({ values })) as never,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      category: "desaparecidos",
      externalId: "Aaron Villastro|—|H. Pérez Carreño",
      titulo: "Aaron Villastro",
      status: "Ingresado",
    });
  });

  it("sos-en-venezuela: reports→desaparecidos con status", async () => {
    const reports = [
      {
        id: 1782,
        name: "Wilmari Abello",
        lastSeen: "Hospital X",
        status: "deceased",
        notes: "C.I. 18",
      },
    ];
    const { items } = await runRestSource(
      "sos-en-venezuela",
      {
        base: "https://x",
        endpoints: [PRESETS["sos-en-venezuela"].endpoints[0]],
      },
      { fetchJson: (async () => ({ reports })) as never },
    );
    expect(items[0]).toMatchObject({
      category: "desaparecidos",
      externalId: "1782",
      titulo: "Wilmari Abello",
      status: "deceased",
    });
  });

  it("venezuela-reporta personas: nombre→titulo, ficha_url→sourceUrl, foto_url→imageUrl", async () => {
    const persona = {
      id: "c4788175",
      status: "buscando",
      nombre: "Yonathan Jimenez",
      edad: 38,
      ciudad: "Caraballeda",
      zona: "La Guaira",
      ultima_vez: "Edf. Coral Park",
      descripcion: "Alto, flaco",
      foto_url:
        "https://wlvcfbuxkdrxhxqlwwmo.supabase.co/storage/v1/object/public/fotos/x.jpg",
      ficha_url: "https://venezuelareporta.org/reporte/c4788175",
    };
    const { items } = await runRestSource(
      "venezuela-te-busca",
      {
        base: "https://venezuelareporta.org",
        endpoints: [PRESETS["venezuela-te-busca"].endpoints[0]],
      },
      { fetchJson: (async () => ({ ok: true, personas: [persona] })) as never },
    );
    expect(items[0]).toMatchObject({
      category: "desaparecidos",
      externalId: "c4788175",
      titulo: "Yonathan Jimenez",
      imageUrl:
        "https://wlvcfbuxkdrxhxqlwwmo.supabase.co/storage/v1/object/public/fotos/x.jpg",
      sourceUrl: "https://venezuelareporta.org/reporte/c4788175",
      status: "buscando",
    });
  });

  it("venezuela-reporta sitios: nombre→titulo, lat/lng→ubicacion (acopios)", async () => {
    const sitio = {
      id: "53f412fb",
      tipo: "acopio",
      nombre: "Acopio- Lumière",
      lat: 8.574,
      lng: -71.174,
      estado_operativo: "abierto",
      nota: null,
    };
    const { items } = await runRestSource(
      "venezuela-te-busca",
      {
        base: "https://venezuelareporta.org",
        endpoints: [PRESETS["venezuela-te-busca"].endpoints[1]],
      },
      { fetchJson: (async () => ({ ok: true, sitios: [sitio] })) as never },
    );
    expect(items[0]).toMatchObject({
      category: "acopios",
      externalId: "53f412fb",
      titulo: "Acopio- Lumière",
      status: "abierto",
    });
    expect(items[0].ubicacion).toEqual({
      lat: 8.574,
      lng: -71.174,
      nombre: "Acopio- Lumière",
    });
  });

  it("aísla un endpoint caído (los demás siguen + endpointStats)", async () => {
    const { items, endpointStats } = await runRestSource(
      "sismovenezuela",
      PRESETS.sismovenezuela,
      {
        fetchJson: fetchByPath({
          "/api/relief-centers": reliefCenters,
          "/api/building-damage": buildingDamage,
          "/api/needs": needs,
          // /api/reports/feed ausente → 404 → error en ese endpoint
        }),
      },
    );
    expect(items.some((i) => i.category === "acopios")).toBe(true);
    expect(items.some((i) => i.category === "reportes")).toBe(false);
    const reportesStat = endpointStats.find((s) => s.label === "reportes");
    expect(reportesStat?.error).toBeDefined();
    expect(reportesStat?.fetched).toBe(0);
  });
});
