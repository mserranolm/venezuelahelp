import { describe, it, expect } from "vitest";
import { geoCell } from "@/enrichment/geoCell";

describe("geoCell", () => {
  it("coloca dos puntos cercanos (< tamaño de celda) en la misma celda", () => {
    expect(geoCell(10.501, -66.901)).toBe(geoCell(10.503, -66.904));
  });

  it("separa puntos en celdas distintas cuando distan más que el tamaño", () => {
    expect(geoCell(10.5, -66.9)).not.toBe(geoCell(10.55, -66.9));
  });

  it("respeta un tamaño de celda configurable", () => {
    expect(geoCell(10.5, -66.9, 0.1)).toBe(geoCell(10.54, -66.93, 0.1));
  });
});
