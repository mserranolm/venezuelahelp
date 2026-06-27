import { fetchJson } from "@/connectors/http";
import { geo, truncate, type SourceConnector } from "@/connectors/types";
import { logger } from "@/shared/logger";
import type { Category, NormalizedItem } from "@/shared/types";

const ID = "hospitalesvenezuela";
const BASE = "https://hospitalesenvenezuela.com";

// Backend Supabase del sitio. Datos de CENTROS de salud (no PII): nombre, estado
// operativo, capacidad, ubicación. Lectura anónima (publishable key del cliente).
const SUPABASE_URL = "https://ozuxfepfkvnxkywdsqxy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dXhmZXBma3ZueGt5d2RzcXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjI5NTEsImV4cCI6MjA5Nzk5ODk1MX0.YhW0GalGkQZdO2NJTg_01C5XhdMmJ6RbNSNXXC0xG4o";

const COLUMNS = [
  "id",
  "nombre",
  "tipo",
  "estado",
  "ciudad",
  "municipio",
  "direccion",
  "telefono",
  "lat",
  "lng",
  "estado_operativo",
  "capacidad",
  "nota",
  "verificado",
].join(",");

// Texto legible para el estado operativo del centro.
const OPERATIVO: Record<string, string> = {
  abierto: "Abierto",
  operativo: "Operativo",
  parcial: "Parcialmente operativo",
  saturado: "Saturado",
  cerrado: "Cerrado",
  desconocido: "Estado desconocido",
};

interface HospitalRow {
  id: string;
  nombre?: string | null;
  tipo?: string | null;
  estado?: string | null;
  ciudad?: string | null;
  municipio?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  lat?: number | null;
  lng?: number | null;
  estado_operativo?: string | null;
  capacidad?: string | null;
  nota?: string | null;
  verificado?: boolean | null;
}

function join(parts: Array<string | null | undefined>, sep: string): string {
  return parts
    .map((p) => (p == null ? "" : String(p).trim()))
    .filter(Boolean)
    .join(sep);
}

export const hospitalesvenezuela: SourceConnector = {
  id: ID,
  async fetchItems(): Promise<NormalizedItem[]> {
    // Solo centros activos; los más recientes primero.
    const url =
      `${SUPABASE_URL}/rest/v1/hospitales` +
      `?select=${encodeURIComponent(COLUMNS)}&activo=eq.true&order=created_at.desc`;
    let rows: HospitalRow[];
    try {
      rows = await fetchJson<HospitalRow[]>(url, 15000, {
        apikey: ANON_KEY,
        authorization: `Bearer ${ANON_KEY}`,
      });
    } catch (err) {
      logger.warn("hospitalesvenezuela fetch failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }

    return (rows ?? []).map((r) => {
      const nombre = (r.nombre ?? "").trim();
      const lugar = join([r.ciudad, r.municipio, r.estado], ", ");
      const estadoOp = r.estado_operativo
        ? (OPERATIVO[r.estado_operativo] ?? r.estado_operativo)
        : "";
      const texto = join(
        [
          r.tipo && r.tipo !== "otro" ? r.tipo : "",
          estadoOp,
          r.capacidad ? `Capacidad: ${r.capacidad}` : "",
          r.nota,
          r.direccion,
          r.telefono ? `Tel: ${r.telefono}` : "",
          lugar,
          r.verificado ? "Verificado" : "",
        ],
        " · ",
      );
      return {
        category: "hospitales" as Category,
        sourceId: ID,
        externalId: String(r.id),
        titulo: truncate(nombre && nombre !== "No registra" ? nombre : "Centro de salud", 120),
        texto: truncate(texto),
        ubicacion: geo(r.lat, r.lng, nombre || r.ciudad),
        status: estadoOp || undefined,
        raw: r,
      };
    });
  },
};
