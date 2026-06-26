export type Category =
  | "reportes"
  | "desaparecidos"
  | "acopios"
  | "edificios"
  | "solicitudes";

export interface Ubicacion {
  lat: number;
  lng: number;
  nombre?: string;
}

export interface Item {
  category: Category;
  sourceId: string;
  externalId: string;
  titulo: string;
  texto: string;
  ubicacion?: Ubicacion;
  status?: string;
}

export interface Source {
  nombre: string;
  url: string;
}

export interface Snapshot {
  generatedAt: string;
  categories: Record<Category, Item[]>;
  // Mapa sourceId -> fuente, para enlazar cada ítem a su sitio de origen.
  // Opcional: snapshots viejos (pre-feature) no lo traen.
  sources?: Record<string, Source>;
}
