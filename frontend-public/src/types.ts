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

export interface Snapshot {
  generatedAt: string;
  categories: Record<Category, Item[]>;
}
