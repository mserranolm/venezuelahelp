import { describe, it, expect, vi, beforeEach } from "vitest";
import hospitales from "./fixtures/hospitales.json";
import { hospitalesvenezuela } from "@/connectors/hospitalesvenezuela";

let lastInit: RequestInit | undefined;

beforeEach(() => {
  lastInit = undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      lastInit = init;
      return new Response(JSON.stringify(hospitales), { status: 200 });
    }),
  );
});

describe("hospitalesvenezuela connector", () => {
  it("maps every row to a hospitales item with stable id and sourceId", async () => {
    const items = await hospitalesvenezuela.fetchItems();
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.category === "hospitales")).toBe(true);
    expect(items.every((i) => i.sourceId === "hospitalesvenezuela")).toBe(true);
    expect(items[0].externalId).toBe(hospitales[0].id);
  });

  it("surfaces operational status, capacity and location in texto", async () => {
    const [h] = await hospitalesvenezuela.fetchItems();
    expect(h.titulo).toBe("Hospital Vargas de La Guaira");
    expect(h.texto).toContain("Saturado");
    expect(h.texto).toContain("120 camas, 0 disponibles");
    expect(h.texto).toContain("La Guaira");
    expect(h.status).toBe("Saturado");
  });

  it("maps lat/lng to ubicacion so hospitals show on the map", async () => {
    const [h] = await hospitalesvenezuela.fetchItems();
    expect(h.ubicacion?.lat).toBe(10.6);
    expect(h.ubicacion?.lng).toBe(-66.93);
  });

  it("falls back the title and omits ubicacion when data is missing", async () => {
    const [, blank] = await hospitalesvenezuela.fetchItems();
    expect(blank.titulo).toBe("Centro de salud");
    expect(blank.ubicacion).toBeUndefined();
  });

  it("requests only active hospitals and sends the apikey header", async () => {
    await hospitalesvenezuela.fetchItems();
    const headers = lastInit?.headers as Record<string, string> | undefined;
    expect(headers?.apikey).toBeTruthy();
    const url = (vi.mocked(fetch).mock.calls[0][0] as string) ?? "";
    expect(url).toContain("activo=eq.true");
  });

  it("returns [] on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("err", { status: 500 })),
    );
    expect(await hospitalesvenezuela.fetchItems()).toEqual([]);
  });
});
