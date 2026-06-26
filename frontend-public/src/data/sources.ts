import { createContext, useContext } from "react";
import type { SourceInfo } from "@/types";

// Metadata de fuentes para mostrar un nombre legible y enlazar al sitio
// original. El backend ahora emite `snapshot.sources` (id → nombre + url); este
// mapa local queda como fallback para sourceIds que el snapshot no traiga.

export const SOURCE_META: Record<string, SourceInfo> = {
  sismovenezuela: {
    nombre: "SismoVenezuela",
    url: "https://www.sismovenezuela.com",
  },
  terremotovenezuela: {
    nombre: "Terremoto Venezuela",
    url: "https://terremotovenezuela.app",
  },
  usgs: {
    nombre: "USGS",
    url: "https://earthquake.usgs.gov",
  },
  "venezuela-te-busca": { nombre: "Venezuela Te Busca" },
  "wiki-terremoto": { nombre: "Wikipedia" },
};

/**
 * Resuelve una fuente: prioriza el directorio del snapshot (autoritativo),
 * luego el mapa local, y como último recurso el id tal cual (sin enlace).
 */
export function resolveSource(
  sourceId: string,
  override?: Record<string, SourceInfo>,
): SourceInfo {
  return override?.[sourceId] ?? SOURCE_META[sourceId] ?? { nombre: sourceId };
}

/** Directorio de fuentes del snapshot, inyectado por App. */
export const SourcesContext = createContext<
  Record<string, SourceInfo> | undefined
>(undefined);

/** Hook que resuelve una fuente usando el directorio del snapshot si existe. */
export function useResolveSource(): (sourceId: string) => SourceInfo {
  const override = useContext(SourcesContext);
  return (sourceId: string) => resolveSource(sourceId, override);
}
