# VenezuelaHelp — Fase 2: Scraper (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingerir periódicamente los datos de las dos fuentes (vía sus APIs JSON reales) hacia DynamoDB con dedup idempotente, y regenerar un `snapshot.json` público en S3; todo orquestado por un Lambda disparado por EventBridge cada 30 min.

**Architecture:** Conectores enchufables (uno por fuente) que implementan `SourceConnector.fetchItems()` y normalizan cada endpoint a `NormalizedItem`. Un orquestador corre los conectores de las fuentes habilitadas de forma aislada (un fallo por fuente no rompe las demás), hace upsert con `ItemRepo`, actualiza el estado de la fuente y regenera el snapshot. El Lambda se empaqueta con esbuild (CDK `NodejsFunction`, que resuelve el alias `@/` vía tsconfig paths).

**Tech Stack:** Node 20 `fetch` global + `AbortController`, AWS SDK v3 S3, `@aws-lambda-powertools/logger`, vitest, AWS CDK `NodejsFunction` + EventBridge.

## Global Constraints

- TypeScript strict; imports con alias `@/` → `backend/src`.
- Sin `console.log`: usar `@aws-lambda-powertools/logger`.
- Manejo de errores explícito; aislamiento por fuente (un conector que falla marca `lastStatus=error` y NO interrumpe a los demás).
- Conventional Commits con emoji; rama `feat/fase2-scraper` (ya creada).
- **Decisión de costo (desaparecidos):** ingerir solo el **subconjunto geolocalizado** (`terremotovenezuela /api/missing/map` y `sismovenezuela /api/missing-persons/external`); NO paginar los 31K de `/api/missing`.
- Cadencia de scraping: `rate(30 minutes)` (fija en infra; reconfigurable desde admin en Fase 5).
- Categorías válidas (de Fase 1): `reportes | desaparecidos | acopios | edificios | solicitudes`.
- Fuentes y sus `id`: `sismovenezuela`, `terremotovenezuela`.
- Reutilizar la capa de datos de Fase 1 (`@/shared/repos/*`, `@/shared/types`, `@/shared/keys`). NO modificar su comportamiento.
- Las fixtures de test viven en `backend/src/connectors/__tests__/fixtures/` (commiteadas). Las muestras crudas están en `.superpowers/sdd/discovery/` (gitignored) — **copiar/recortar** lo necesario a la carpeta de fixtures.

## Referencia de endpoints (de la fase de discovery)

`.superpowers/sdd/discovery/FINDINGS.md` y los `*_sample.json` son la fuente de verdad de las formas. Resumen de lo que ingerimos:

**sismovenezuela.com** (base `https://www.sismovenezuela.com`):

- `GET /api/reports/feed?limit=200` → `reportes`. Array. Campos: `id, source, source_url, author, text_content, lat, lng, location_name, damage_level, post_time`.
- `GET /api/relief-centers` → `acopios`. Array. Campos: `id, name, address, state, lat, lng, accepted_items, source_url`.
- `GET /api/building-damage` → `edificios`. GeoJSON FeatureCollection. `properties: {id, place, damage_type, affected, needs, photo_url, reported_at}`, `geometry.coordinates=[lng,lat]`.
- `GET /api/needs` → `solicitudes`. `{data:[...]}`. Campos: `id, title, description, category, priority, lat, lng, location_name, items_needed`.
- `GET /api/missing-persons/external` → `desaparecidos` (geo). GeoJSON. `properties: {id, nombre, edad, ubicacion, descripcion, contacto, foto, estado}`, `geometry.coordinates=[lng,lat]`.

**terremotovenezuela.app** (base `https://terremotovenezuela.app`):

- `GET /api/reports` → `{reports:[...]}`. Campo `type` discrimina: `critical|nopower` → `reportes`; `supplies|shelter` → `acopios`; `building` → `edificios`; `missing` → **se ignora** (pin liviano, cubierto por `/api/missing/map`). Campos: `id, type, lat, lng, place, affected, needs, photoUrl, createdAt(ms)`.
- `GET /api/missing/map` → `desaparecidos` (geo, ~3475). `{markers:[...]}`. Campos: `id, name, age, lastSeen, photoUrl, lat, lng, createdAt(ms)`.

---

## File Structure

```
backend/src/
├── connectors/
│   ├── http.ts                  # fetchJson<T>(url, timeoutMs)
│   ├── types.ts                 # SourceConnector, helpers de normalización
│   ├── sismovenezuela.ts        # conector fuente 1
│   ├── terremotovenezuela.ts    # conector fuente 2
│   ├── registry.ts              # getConnector(sourceId)
│   └── __tests__/
│       ├── fixtures/            # JSON commiteados (recortados de discovery)
│       ├── http.test.ts
│       ├── sismovenezuela.test.ts
│       └── terremotovenezuela.test.ts
├── scraper/
│   ├── seed.ts                  # ensureSeedSources(): put idempotente de las 2 fuentes
│   ├── orchestrator.ts          # runScrape(): aísla, upsert, estado por fuente
│   ├── handler.ts               # Lambda handler (EventBridge + manual)
│   └── __tests__/
│       ├── seed.test.ts
│       └── orchestrator.test.ts
├── public-snapshot/
│   ├── snapshot.ts              # buildSnapshot(): arma JSON + put a S3
│   └── __tests__/snapshot.test.ts
└── shared/ ...                  # (Fase 1, sin cambios)

infra/
├── lib/scraper-stack.ts         # NodejsFunction + EventBridge + grants + DLQ
├── lib/__tests__/scraper-stack.test.ts
└── bin/app.ts                   # (modificar: instanciar ScraperStack)
```

---

### Task 1: Helper HTTP `fetchJson`

**Files:**

- Create: `backend/src/connectors/http.ts`
- Test: `backend/src/connectors/__tests__/http.test.ts`

**Interfaces:**

- Produces: `fetchJson<T>(url: string, timeoutMs?: number): Promise<T>` — GET con `AbortController`; lanza `Error` si el status no es 2xx o si hay timeout.

- [ ] **Step 1: Escribir el test que falla**

Create `backend/src/connectors/__tests__/http.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson } from "@/connectors/http";

afterEach(() => vi.restoreAllMocks());

describe("fetchJson", () => {
  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
      ),
    );
    await expect(fetchJson<{ ok: number }>("https://x/y")).resolves.toEqual({
      ok: 1,
    });
  });

  it("throws on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    await expect(fetchJson("https://x/y")).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- http`
Expected: FAIL — `@/connectors/http` no existe.

- [ ] **Step 3: Implementar `http.ts`**

Create `backend/src/connectors/http.ts`:

```ts
export async function fetchJson<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "VenezuelaHelp/1.0",
      },
    });
    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- http`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/connectors/http.ts backend/src/connectors/__tests__/http.test.ts
git commit -m "✨ feat(backend): add fetchJson HTTP helper with timeout"
```

---

### Task 2: Tipos de conector + helpers de normalización

**Files:**

- Create: `backend/src/connectors/types.ts`

**Interfaces:**

- Consumes: `NormalizedItem`, `Category`, `GeoPoint` de `@/shared/types`.
- Produces:
  - `interface SourceConnector { id: string; fetchItems(): Promise<NormalizedItem[]> }`
  - `geo(lat?: number | null, lng?: number | null, nombre?: string | null): GeoPoint | undefined` — devuelve `undefined` si falta lat o lng.
  - `truncate(s: string | null | undefined, n?: number): string` — texto seguro (string vacío si null), recortado a `n` (default 500).

- [ ] **Step 1: Escribir `types.ts`**

Create `backend/src/connectors/types.ts`:

```ts
import type { NormalizedItem, GeoPoint } from "@/shared/types";

export interface SourceConnector {
  id: string;
  fetchItems(): Promise<NormalizedItem[]>;
}

export function geo(
  lat?: number | null,
  lng?: number | null,
  nombre?: string | null,
): GeoPoint | undefined {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  return { lat, lng, ...(nombre ? { nombre } : {}) };
}

export function truncate(s: string | null | undefined, n = 500): string {
  const v = (s ?? "").toString().trim();
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

export type { NormalizedItem };
```

- [ ] **Step 2: Compila**

Run: `npm run build --workspace @venezuelahelp/backend`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add backend/src/connectors/types.ts
git commit -m "✨ feat(backend): add SourceConnector interface and normalization helpers"
```

---

### Task 3: Fixtures commiteadas

**Files:**

- Create: `backend/src/connectors/__tests__/fixtures/*.json` (recortes de `.superpowers/sdd/discovery/`)

**Interfaces:**

- Produces: fixtures JSON pequeñas (2–3 ítems cada una) para tests de conectores.

- [ ] **Step 1: Copiar y recortar fixtures**

Para cada archivo abajo: lee la muestra cruda en `.superpowers/sdd/discovery/` y crea en `backend/src/connectors/__tests__/fixtures/` una versión con **solo 2 elementos** (el primero con lat/lng presentes y el segundo con lat/lng en null, para cubrir ambos casos de `geo()`), preservando los nombres de campo EXACTOS de la muestra.

Crear:

- `sismo_reports_feed.json` (de `sismo_reports_feed_sample.json`) — array de 2.
- `sismo_relief_centers.json` (de `sismo_relief_centers_sample.json`) — array de 2.
- `sismo_building_damage.json` (de `sismo_building_damage_sample.json`) — FeatureCollection con 2 features.
- `sismo_needs.json` (de `sismo_needs_sample.json`) — `{data:[ 2 ]}`.
- `sismo_missing_external.json` (de `sismo_missing_persons_sample.json` si es GeoJSON; si no, construir GeoJSON con `properties:{id,nombre,edad,ubicacion,descripcion,contacto,foto,estado}` y `geometry.coordinates=[lng,lat]`) — FeatureCollection con 2 features.
- `tv_reports.json` (de `tv_reports_sample.json`) — `{reports:[...]}` con al menos un `critical`, un `supplies`, un `building` y un `missing` (este último para verificar que se ignora).
- `tv_missing_map.json` (de `tv_missing_map_sample.json`) — `{markers:[ 2 ]}`.

- [ ] **Step 2: Commit**

```bash
git add backend/src/connectors/__tests__/fixtures/
git commit -m "🧪 test(backend): add trimmed connector fixtures from discovery samples"
```

---

### Task 4: Conector sismovenezuela

**Files:**

- Create: `backend/src/connectors/sismovenezuela.ts`
- Test: `backend/src/connectors/__tests__/sismovenezuela.test.ts`

**Interfaces:**

- Consumes: `fetchJson` (`@/connectors/http`), `SourceConnector`, `geo`, `truncate` (`@/connectors/types`).
- Produces: `export const sismovenezuela: SourceConnector` con `id = "sismovenezuela"`. `fetchItems()` consulta los 5 endpoints, mapea a `NormalizedItem[]` y concatena. Un endpoint que falle se registra y se omite (no tumba al resto del conector).

- [ ] **Step 1: Escribir el test que falla**

Create `backend/src/connectors/__tests__/sismovenezuela.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import reportsFeed from "./fixtures/sismo_reports_feed.json";
import reliefCenters from "./fixtures/sismo_relief_centers.json";
import buildingDamage from "./fixtures/sismo_building_damage.json";
import needs from "./fixtures/sismo_needs.json";
import missingExternal from "./fixtures/sismo_missing_external.json";
import { sismovenezuela } from "@/connectors/sismovenezuela";

function mockByPath(map: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const key = Object.keys(map).find((p) => path.startsWith(p));
      if (!key) return new Response("not found", { status: 404 });
      return new Response(JSON.stringify(map[key]), { status: 200 });
    }),
  );
}

beforeEach(() => {
  mockByPath({
    "/api/reports/feed": reportsFeed,
    "/api/relief-centers": reliefCenters,
    "/api/building-damage": buildingDamage,
    "/api/needs": needs,
    "/api/missing-persons/external": missingExternal,
  });
});

describe("sismovenezuela connector", () => {
  it("normalizes items across all categories with sourceId set", async () => {
    const items = await sismovenezuela.fetchItems();
    const cats = new Set(items.map((i) => i.category));
    expect(cats).toEqual(
      new Set([
        "reportes",
        "acopios",
        "edificios",
        "solicitudes",
        "desaparecidos",
      ]),
    );
    expect(items.every((i) => i.sourceId === "sismovenezuela")).toBe(true);
    expect(items.every((i) => i.externalId && i.externalId.length > 0)).toBe(
      true,
    );
  });

  it("maps GeoJSON building-damage coordinates to ubicacion (lng,lat order)", async () => {
    const items = await sismovenezuela.fetchItems();
    const edi = items.find((i) => i.category === "edificios" && i.ubicacion);
    expect(edi?.ubicacion?.lat).toBeTypeOf("number");
    expect(edi?.ubicacion?.lng).toBeTypeOf("number");
  });

  it("isolates a failing endpoint (still returns items from the others)", async () => {
    mockByPath({
      "/api/relief-centers": reliefCenters,
      "/api/building-damage": buildingDamage,
      "/api/needs": needs,
      "/api/missing-persons/external": missingExternal,
      // /api/reports/feed ausente => 404 => se omite
    });
    const items = await sismovenezuela.fetchItems();
    expect(items.some((i) => i.category === "acopios")).toBe(true);
    expect(items.some((i) => i.category === "reportes")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- sismovenezuela`
Expected: FAIL — módulo no existe. (Si falla por `resolveJsonModule`, ya está activo en `tsconfig.base.json`.)

- [ ] **Step 3: Implementar `sismovenezuela.ts`**

Create `backend/src/connectors/sismovenezuela.ts`:

```ts
import { fetchJson } from "@/connectors/http";
import { geo, truncate, type SourceConnector } from "@/connectors/types";
import type { NormalizedItem } from "@/shared/types";

const BASE = "https://www.sismovenezuela.com";
const ID = "sismovenezuela";

type GeoFeature = {
  properties: Record<string, unknown>;
  geometry?: { coordinates?: [number, number] };
};

async function safe(
  label: string,
  fn: () => Promise<NormalizedItem[]>,
): Promise<NormalizedItem[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function reportes(): Promise<NormalizedItem[]> {
  const rows = await fetchJson<Array<Record<string, any>>>(
    `${BASE}/api/reports/feed?limit=200`,
  );
  return rows.map((r) => ({
    category: "reportes",
    sourceId: ID,
    externalId: String(r.id),
    titulo: truncate(r.location_name || r.author || "Reporte", 120),
    texto: truncate(r.text_content),
    ubicacion: geo(r.lat, r.lng, r.location_name),
    status: r.damage_level ? String(r.damage_level) : undefined,
    raw: r,
  }));
}

async function acopios(): Promise<NormalizedItem[]> {
  const rows = await fetchJson<Array<Record<string, any>>>(
    `${BASE}/api/relief-centers`,
  );
  return rows.map((r) => ({
    category: "acopios",
    sourceId: ID,
    externalId: String(r.id),
    titulo: truncate(r.name, 120),
    texto: truncate(
      [r.address, r.state, r.accepted_items].filter(Boolean).join(" · "),
    ),
    ubicacion: geo(r.lat, r.lng, r.name),
    raw: r,
  }));
}

async function edificios(): Promise<NormalizedItem[]> {
  const fc = await fetchJson<{ features: GeoFeature[] }>(
    `${BASE}/api/building-damage`,
  );
  return (fc.features ?? []).map((f) => {
    const p = f.properties;
    const c = f.geometry?.coordinates;
    return {
      category: "edificios",
      sourceId: ID,
      externalId: String(p.id),
      titulo: truncate(String(p.place ?? "Edificio dañado"), 120),
      texto: truncate([p.damage_type, p.needs].filter(Boolean).join(" · ")),
      ubicacion: c ? geo(c[1], c[0], p.place as string) : undefined,
      status: p.affected ? String(p.affected) : undefined,
      raw: p,
    };
  });
}

async function solicitudes(): Promise<NormalizedItem[]> {
  const res = await fetchJson<{ data: Array<Record<string, any>> }>(
    `${BASE}/api/needs`,
  );
  return (res.data ?? []).map((r) => ({
    category: "solicitudes",
    sourceId: ID,
    externalId: String(r.id),
    titulo: truncate(r.title, 120),
    texto: truncate(
      [r.description, r.items_needed].filter(Boolean).join(" · "),
    ),
    ubicacion: geo(r.lat, r.lng, r.location_name),
    status: r.priority ? String(r.priority) : undefined,
    raw: r,
  }));
}

async function desaparecidos(): Promise<NormalizedItem[]> {
  const fc = await fetchJson<{ features: GeoFeature[] }>(
    `${BASE}/api/missing-persons/external`,
  );
  return (fc.features ?? []).map((f) => {
    const p = f.properties;
    const c = f.geometry?.coordinates;
    return {
      category: "desaparecidos",
      sourceId: ID,
      externalId: String(p.id),
      titulo: truncate(String(p.nombre ?? "Desaparecido"), 120),
      texto: truncate(
        [p.edad ? `Edad ${p.edad}` : "", p.descripcion, p.ubicacion]
          .filter(Boolean)
          .join(" · "),
      ),
      ubicacion: c ? geo(c[1], c[0], p.ubicacion as string) : undefined,
      status: p.estado ? String(p.estado) : undefined,
      raw: p,
    };
  });
}

export const sismovenezuela: SourceConnector = {
  id: ID,
  async fetchItems() {
    const groups = await Promise.all([
      safe("reportes", reportes),
      safe("acopios", acopios),
      safe("edificios", edificios),
      safe("solicitudes", solicitudes),
      safe("desaparecidos", desaparecidos),
    ]);
    return groups.flat();
  },
};
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- sismovenezuela`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/connectors/sismovenezuela.ts backend/src/connectors/__tests__/sismovenezuela.test.ts
git commit -m "✨ feat(backend): add sismovenezuela connector (5 endpoints, isolated)"
```

---

### Task 5: Conector terremotovenezuela

**Files:**

- Create: `backend/src/connectors/terremotovenezuela.ts`
- Test: `backend/src/connectors/__tests__/terremotovenezuela.test.ts`

**Interfaces:**

- Consumes: `fetchJson`, `SourceConnector`, `geo`, `truncate`.
- Produces: `export const terremotovenezuela: SourceConnector` con `id = "terremotovenezuela"`. `fetchItems()` consulta `/api/reports` (discrimina por `type`) y `/api/missing/map` (desaparecidos geo). El `type = "missing"` en `/api/reports` se **ignora**.

- [ ] **Step 1: Escribir el test que falla**

Create `backend/src/connectors/__tests__/terremotovenezuela.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import reports from "./fixtures/tv_reports.json";
import missingMap from "./fixtures/tv_missing_map.json";
import { terremotovenezuela } from "@/connectors/terremotovenezuela";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.startsWith("/api/reports"))
        return new Response(JSON.stringify(reports), { status: 200 });
      if (path.startsWith("/api/missing/map"))
        return new Response(JSON.stringify(missingMap), { status: 200 });
      return new Response("404", { status: 404 });
    }),
  );
});

describe("terremotovenezuela connector", () => {
  it("maps report 'type' to categories and ignores 'missing' pins", async () => {
    const items = await terremotovenezuela.fetchItems();
    // 'missing' type from /api/reports must NOT appear as a report-derived item
    const fromReports = items.filter(
      (i) =>
        i.sourceId === "terremotovenezuela" && i.raw && (i.raw as any).type,
    );
    expect(fromReports.some((i) => (i.raw as any).type === "missing")).toBe(
      false,
    );
    const cats = new Set(fromReports.map((i) => i.category));
    // critical/nopower→reportes, supplies/shelter→acopios, building→edificios
    expect(
      [...cats].every((c) => ["reportes", "acopios", "edificios"].includes(c)),
    ).toBe(true);
  });

  it("maps /api/missing/map markers to geolocated desaparecidos", async () => {
    const items = await terremotovenezuela.fetchItems();
    const desap = items.filter((i) => i.category === "desaparecidos");
    expect(desap.length).toBeGreaterThan(0);
    expect(desap.every((i) => i.ubicacion?.lat && i.ubicacion?.lng)).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- terremotovenezuela`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `terremotovenezuela.ts`**

Create `backend/src/connectors/terremotovenezuela.ts`:

```ts
import { fetchJson } from "@/connectors/http";
import { geo, truncate, type SourceConnector } from "@/connectors/types";
import type { Category, NormalizedItem } from "@/shared/types";

const BASE = "https://terremotovenezuela.app";
const ID = "terremotovenezuela";

const TYPE_TO_CATEGORY: Record<string, Category | undefined> = {
  critical: "reportes",
  nopower: "reportes",
  supplies: "acopios",
  shelter: "acopios",
  building: "edificios",
  missing: undefined, // pin liviano: se ignora (cubierto por /api/missing/map)
};

async function safe(
  fn: () => Promise<NormalizedItem[]>,
): Promise<NormalizedItem[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function reports(): Promise<NormalizedItem[]> {
  const res = await fetchJson<{ reports: Array<Record<string, any>> }>(
    `${BASE}/api/reports`,
  );
  const out: NormalizedItem[] = [];
  for (const r of res.reports ?? []) {
    const category = TYPE_TO_CATEGORY[String(r.type)];
    if (!category) continue;
    out.push({
      category,
      sourceId: ID,
      externalId: String(r.id),
      titulo: truncate(String(r.place ?? r.type ?? "Reporte"), 120),
      texto: truncate([r.affected, r.needs].filter(Boolean).join(" · ")),
      ubicacion: geo(r.lat, r.lng, r.place),
      status: String(r.type),
      raw: r,
    });
  }
  return out;
}

async function desaparecidos(): Promise<NormalizedItem[]> {
  const res = await fetchJson<{ markers: Array<Record<string, any>> }>(
    `${BASE}/api/missing/map`,
  );
  return (res.markers ?? []).map((m) => ({
    category: "desaparecidos" as Category,
    sourceId: ID,
    externalId: String(m.id),
    titulo: truncate(String(m.name ?? "Desaparecido"), 120),
    texto: truncate(
      [m.age ? `Edad ${m.age}` : "", m.lastSeen].filter(Boolean).join(" · "),
    ),
    ubicacion: geo(m.lat, m.lng, m.lastSeen),
    raw: m,
  }));
}

export const terremotovenezuela: SourceConnector = {
  id: ID,
  async fetchItems() {
    const groups = await Promise.all([safe(reports), safe(desaparecidos)]);
    return groups.flat();
  },
};
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- terremotovenezuela`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/connectors/terremotovenezuela.ts backend/src/connectors/__tests__/terremotovenezuela.test.ts
git commit -m "✨ feat(backend): add terremotovenezuela connector (type-discriminated + geo missing)"
```

---

### Task 6: Registro de conectores

**Files:**

- Create: `backend/src/connectors/registry.ts`
- Test: `backend/src/connectors/__tests__/registry.test.ts`

**Interfaces:**

- Consumes: `sismovenezuela`, `terremotovenezuela`, `SourceConnector`.
- Produces: `getConnector(sourceId: string): SourceConnector | undefined`.

- [ ] **Step 1: Escribir el test que falla**

Create `backend/src/connectors/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getConnector } from "@/connectors/registry";

describe("getConnector", () => {
  it("resolves known sources", () => {
    expect(getConnector("sismovenezuela")?.id).toBe("sismovenezuela");
    expect(getConnector("terremotovenezuela")?.id).toBe("terremotovenezuela");
  });
  it("returns undefined for unknown", () => {
    expect(getConnector("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- registry`
Expected: FAIL.

- [ ] **Step 3: Implementar `registry.ts`**

Create `backend/src/connectors/registry.ts`:

```ts
import type { SourceConnector } from "@/connectors/types";
import { sismovenezuela } from "@/connectors/sismovenezuela";
import { terremotovenezuela } from "@/connectors/terremotovenezuela";

const REGISTRY: Record<string, SourceConnector> = {
  [sismovenezuela.id]: sismovenezuela,
  [terremotovenezuela.id]: terremotovenezuela,
};

export function getConnector(sourceId: string): SourceConnector | undefined {
  return REGISTRY[sourceId];
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- registry`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/connectors/registry.ts backend/src/connectors/__tests__/registry.test.ts
git commit -m "✨ feat(backend): add connector registry"
```

---

### Task 7: Seed de fuentes

**Files:**

- Create: `backend/src/scraper/seed.ts`
- Test: `backend/src/scraper/__tests__/seed.test.ts`

**Interfaces:**

- Consumes: `SourceRepo` (`@/shared/repos/sourceRepo`), `Source` (`@/shared/types`).
- Produces: `ensureSeedSources(repo?: SourceRepo): Promise<void>` — hace `put` idempotente de las 2 fuentes **solo si no existen** (para no pisar el `enabled` que el admin pueda cambiar luego).

- [ ] **Step 1: Escribir el test que falla**

Create `backend/src/scraper/__tests__/seed.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { ensureSeedSources } from "@/scraper/seed";
import { SourceRepo } from "@/shared/repos/sourceRepo";

describe("ensureSeedSources", () => {
  it("puts a source that does not exist yet", async () => {
    const repo = new SourceRepo();
    vi.spyOn(repo, "get").mockResolvedValue(null);
    const put = vi.spyOn(repo, "put").mockResolvedValue();
    await ensureSeedSources(repo);
    const ids = put.mock.calls.map((c) => c[0].id).sort();
    expect(ids).toEqual(["sismovenezuela", "terremotovenezuela"]);
  });

  it("does not overwrite an existing source", async () => {
    const repo = new SourceRepo();
    vi.spyOn(repo, "get").mockResolvedValue({
      id: "sismovenezuela",
      nombre: "x",
      url: "u",
      connector: "jsonApi",
      enabled: false,
    });
    const put = vi.spyOn(repo, "put").mockResolvedValue();
    await ensureSeedSources(repo);
    expect(put.mock.calls.map((c) => c[0].id)).toEqual(["terremotovenezuela"]);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- seed`
Expected: FAIL.

- [ ] **Step 3: Implementar `seed.ts`**

Create `backend/src/scraper/seed.ts`:

```ts
import { SourceRepo } from "@/shared/repos/sourceRepo";
import type { Source } from "@/shared/types";

const SEED: Source[] = [
  {
    id: "sismovenezuela",
    nombre: "SismoVenezuela",
    url: "https://www.sismovenezuela.com/",
    connector: "jsonApi",
    enabled: true,
  },
  {
    id: "terremotovenezuela",
    nombre: "Terremoto Venezuela",
    url: "https://terremotovenezuela.app/",
    connector: "jsonApi",
    enabled: true,
  },
];

export async function ensureSeedSources(
  repo: SourceRepo = new SourceRepo(),
): Promise<void> {
  for (const s of SEED) {
    const existing = await repo.get(s.id);
    if (!existing) await repo.put(s);
  }
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- seed`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scraper/seed.ts backend/src/scraper/__tests__/seed.test.ts
git commit -m "✨ feat(backend): add idempotent source seeding"
```

---

### Task 8: Orquestador `runScrape`

**Files:**

- Create: `backend/src/scraper/orchestrator.ts`
- Test: `backend/src/scraper/__tests__/orchestrator.test.ts`

**Interfaces:**

- Consumes: `SourceRepo`, `ItemRepo`, `getConnector`, `ensureSeedSources`.
- Produces:
  - `interface SourceResult { sourceId: string; fetched: number; created: number; updated: number; unchanged: number; error?: string }`
  - `runScrape(now: string, deps?): Promise<SourceResult[]>` — seed → lista fuentes habilitadas → por cada una corre su conector aislado, hace upsert, actualiza estado de la fuente; un fallo no detiene a las demás.

- [ ] **Step 1: Escribir el test que falla**

Create `backend/src/scraper/__tests__/orchestrator.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runScrape } from "@/scraper/orchestrator";
import type { Source } from "@/shared/types";

function srcRepo(sources: Source[]) {
  return {
    listEnabled: vi.fn(async () => sources),
    put: vi.fn(async () => {}),
  };
}

const ok: Source = {
  id: "ok",
  nombre: "ok",
  url: "u",
  connector: "jsonApi",
  enabled: true,
};
const bad: Source = {
  id: "bad",
  nombre: "bad",
  url: "u",
  connector: "jsonApi",
  enabled: true,
};

describe("runScrape", () => {
  it("isolates a failing source and still processes the healthy one", async () => {
    const itemRepo = { upsert: vi.fn(async () => "created" as const) };
    const deps = {
      sourceRepo: srcRepo([ok, bad]),
      itemRepo,
      seed: vi.fn(async () => {}),
      getConnector: (id: string) =>
        id === "ok"
          ? {
              id,
              fetchItems: async () => [
                {
                  category: "reportes",
                  sourceId: id,
                  externalId: "1",
                  titulo: "t",
                  texto: "x",
                  raw: {},
                },
              ],
            }
          : {
              id,
              fetchItems: async () => {
                throw new Error("boom");
              },
            },
    };
    const results = await runScrape("2026-06-25T00:00:00Z", deps as any);
    const okRes = results.find((r) => r.sourceId === "ok")!;
    const badRes = results.find((r) => r.sourceId === "bad")!;
    expect(okRes.created).toBe(1);
    expect(badRes.error).toMatch(/boom/);
    expect(itemRepo.upsert).toHaveBeenCalledTimes(1);
    // estado persistido para ambas fuentes
    expect(deps.sourceRepo.put).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- orchestrator`
Expected: FAIL.

- [ ] **Step 3: Implementar `orchestrator.ts`**

Create `backend/src/scraper/orchestrator.ts`:

```ts
import { SourceRepo } from "@/shared/repos/sourceRepo";
import { ItemRepo } from "@/shared/repos/itemRepo";
import { getConnector as defaultGetConnector } from "@/connectors/registry";
import { ensureSeedSources } from "@/scraper/seed";
import type { Source } from "@/shared/types";

export interface SourceResult {
  sourceId: string;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  error?: string;
}

interface Deps {
  sourceRepo: Pick<SourceRepo, "listEnabled" | "put">;
  itemRepo: Pick<ItemRepo, "upsert">;
  seed: (repo: SourceRepo) => Promise<void>;
  getConnector: typeof defaultGetConnector;
}

export async function runScrape(
  now: string,
  deps?: Partial<Deps>,
): Promise<SourceResult[]> {
  const sourceRepo =
    (deps?.sourceRepo as Deps["sourceRepo"]) ?? new SourceRepo();
  const itemRepo = (deps?.itemRepo as Deps["itemRepo"]) ?? new ItemRepo();
  const seed = deps?.seed ?? ensureSeedSources;
  const getConnector = deps?.getConnector ?? defaultGetConnector;

  await seed(sourceRepo as SourceRepo);
  const sources = await sourceRepo.listEnabled();
  const results: SourceResult[] = [];

  for (const source of sources) {
    const result: SourceResult = {
      sourceId: source.id,
      fetched: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
    };
    const next: Source = { ...source, lastRun: now };
    try {
      const connector = getConnector(source.id);
      if (!connector) throw new Error(`no connector for ${source.id}`);
      const items = await connector.fetchItems();
      result.fetched = items.length;
      for (const item of items) {
        const r = await itemRepo.upsert(item, now);
        result[r] += 1;
      }
      next.lastStatus = "ok";
      next.errorMsg = undefined;
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      next.lastStatus = "error";
      next.errorMsg = result.error;
    }
    await sourceRepo.put(next);
    results.push(result);
  }
  return results;
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- orchestrator`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scraper/orchestrator.ts backend/src/scraper/__tests__/orchestrator.test.ts
git commit -m "✨ feat(backend): add scrape orchestrator with per-source isolation"
```

---

### Task 9: Snapshot público

**Files:**

- Create: `backend/src/public-snapshot/snapshot.ts`
- Test: `backend/src/public-snapshot/__tests__/snapshot.test.ts`
- Modify: `backend/package.json` (añadir `@aws-sdk/client-s3`)

**Interfaces:**

- Consumes: `ItemRepo.listByCategory`, `CATEGORIES` (`@/shared/types`), `@aws-sdk/client-s3`.
- Produces: `buildSnapshot(now: string, deps?): Promise<{ key: string; count: number }>` — arma `{ generatedAt, categories: {<cat>: PublicItem[]} }` (PublicItem = subset sin `raw`), y hace `PutObject` a `process.env.SNAPSHOT_BUCKET` key `snapshot.json` (`ContentType: application/json`, `CacheControl: public, max-age=300`).

- [ ] **Step 1: Añadir dependencia S3**

Add `"@aws-sdk/client-s3": "^3.600.0"` a `dependencies` de `backend/package.json`. Run `npm install` en la raíz.

- [ ] **Step 2: Escribir el test que falla**

Create `backend/src/public-snapshot/__tests__/snapshot.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { buildSnapshot } from "@/public-snapshot/snapshot";

const s3Mock = mockClient(S3Client);
beforeEach(() => {
  s3Mock.reset();
  process.env.SNAPSHOT_BUCKET = "bucket-x";
});

describe("buildSnapshot", () => {
  it("assembles categories and puts snapshot.json without raw field", async () => {
    s3Mock.on(PutObjectCommand).resolves({});
    const itemRepo = {
      listByCategory: vi.fn(async (cat: string) =>
        cat === "reportes"
          ? [
              {
                category: "reportes",
                sourceId: "s",
                externalId: "1",
                titulo: "t",
                texto: "x",
                raw: { secret: true },
                contentHash: "h",
                firstSeenAt: "a",
                lastSeenAt: "b",
              },
            ]
          : [],
      ),
    };
    const res = await buildSnapshot("2026-06-25T00:00:00Z", {
      itemRepo: itemRepo as any,
    });
    expect(res.key).toBe("snapshot.json");
    expect(res.count).toBe(1);
    const body = JSON.parse(
      s3Mock.commandCalls(PutObjectCommand)[0].args[0].input.Body as string,
    );
    expect(body.categories.reportes[0]).not.toHaveProperty("raw");
    expect(body.categories.reportes[0].titulo).toBe("t");
    expect(body.generatedAt).toBe("2026-06-25T00:00:00Z");
  });
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- snapshot`
Expected: FAIL — módulo no existe.

- [ ] **Step 4: Implementar `snapshot.ts`**

Create `backend/src/public-snapshot/snapshot.ts`:

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ItemRepo } from "@/shared/repos/itemRepo";
import { CATEGORIES, type Category, type StoredItem } from "@/shared/types";

const s3 = new S3Client({});
const KEY = "snapshot.json";

type PublicItem = Omit<StoredItem, "raw">;

function toPublic({ raw, ...rest }: StoredItem): PublicItem {
  return rest;
}

interface Deps {
  itemRepo: Pick<ItemRepo, "listByCategory">;
  s3: Pick<S3Client, "send">;
}

export async function buildSnapshot(
  now: string,
  deps?: Partial<Deps>,
): Promise<{ key: string; count: number }> {
  const itemRepo = (deps?.itemRepo as Deps["itemRepo"]) ?? new ItemRepo();
  const client = (deps?.s3 as Deps["s3"]) ?? s3;

  const categories: Record<Category, PublicItem[]> = {} as Record<
    Category,
    PublicItem[]
  >;
  let count = 0;
  for (const cat of CATEGORIES) {
    const items = await itemRepo.listByCategory(cat);
    categories[cat] = items.map(toPublic);
    count += items.length;
  }

  const body = JSON.stringify({ generatedAt: now, categories });
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.SNAPSHOT_BUCKET,
      Key: KEY,
      Body: body,
      ContentType: "application/json",
      CacheControl: "public, max-age=300",
    }),
  );
  return { key: KEY, count };
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- snapshot`
Expected: PASS (1 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json package-lock.json backend/src/public-snapshot/
git commit -m "✨ feat(backend): add public snapshot builder writing snapshot.json to S3"
```

---

### Task 10: Lambda handler del scraper

**Files:**

- Create: `backend/src/scraper/handler.ts`
- Test: `backend/src/scraper/__tests__/handler.test.ts`
- Modify: `backend/package.json` (añadir `@aws-lambda-powertools/logger`)

**Interfaces:**

- Consumes: `runScrape`, `buildSnapshot`.
- Produces: `handler(): Promise<{ sources: SourceResult[]; snapshot: { key: string; count: number } }>` — genera `now` (ISO), corre `runScrape(now)`, luego `buildSnapshot(now)`, loguea el resumen con Powertools y lo devuelve.

- [ ] **Step 1: Añadir dependencia logger**

Add `"@aws-lambda-powertools/logger": "^2.0.0"` a `dependencies` de `backend/package.json`. Run `npm install` en la raíz.

- [ ] **Step 2: Escribir el test que falla**

Create `backend/src/scraper/__tests__/handler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/scraper/orchestrator", () => ({
  runScrape: vi.fn(async () => [
    { sourceId: "s", fetched: 1, created: 1, updated: 0, unchanged: 0 },
  ]),
}));
vi.mock("@/public-snapshot/snapshot", () => ({
  buildSnapshot: vi.fn(async () => ({ key: "snapshot.json", count: 1 })),
}));

import { handler } from "@/scraper/handler";
import { runScrape } from "@/scraper/orchestrator";
import { buildSnapshot } from "@/public-snapshot/snapshot";

describe("scraper handler", () => {
  it("runs scrape then snapshot with the same timestamp and returns the summary", async () => {
    const res = await handler();
    expect(res.sources[0].created).toBe(1);
    expect(res.snapshot.count).toBe(1);
    const scrapeNow = (runScrape as any).mock.calls[0][0];
    const snapNow = (buildSnapshot as any).mock.calls[0][0];
    expect(scrapeNow).toBe(snapNow);
  });
});
```

- [ ] **Step 3: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/backend -- handler`
Expected: FAIL — módulo no existe.

- [ ] **Step 4: Implementar `handler.ts`**

Create `backend/src/scraper/handler.ts`:

```ts
import { Logger } from "@aws-lambda-powertools/logger";
import { runScrape, type SourceResult } from "@/scraper/orchestrator";
import { buildSnapshot } from "@/public-snapshot/snapshot";

const logger = new Logger({ serviceName: "venezuelahelp-scraper" });

export async function handler(): Promise<{
  sources: SourceResult[];
  snapshot: { key: string; count: number };
}> {
  const now = new Date().toISOString();
  const sources = await runScrape(now);
  const snapshot = await buildSnapshot(now);
  logger.info("scrape complete", { sources, snapshot });
  return { sources, snapshot };
}
```

- [ ] **Step 5: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/backend -- handler`
Expected: PASS (1 passed).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json package-lock.json backend/src/scraper/handler.ts backend/src/scraper/__tests__/handler.test.ts
git commit -m "✨ feat(backend): add scraper Lambda handler"
```

---

### Task 11: Infra `ScraperStack`

**Files:**

- Create: `infra/lib/scraper-stack.ts`
- Test: `infra/lib/__tests__/scraper-stack.test.ts`
- Modify: `infra/bin/app.ts`
- Modify: `infra/package.json` (añadir `aws-cdk-lib` ya está; añadir `esbuild` como devDependency para `NodejsFunction`)

**Interfaces:**

- Consumes: `DataStack` (table, snapshotBucket, scraperDlq).
- Produces: `class ScraperStack extends Stack` con un `NodejsFunction` (entry `backend/src/scraper/handler.ts`, handler `handler`), env `TABLE_NAME` y `SNAPSHOT_BUCKET`, permisos RW a tabla y bucket, `deadLetterQueue` = la DLQ de DataStack, y una regla EventBridge `rate(30 minutes)` que lo invoca.

- [ ] **Step 1: Añadir esbuild**

Add `"esbuild": "^0.21.0"` a `devDependencies` de `infra/package.json`. Run `npm install` en la raíz.

- [ ] **Step 2: Escribir el test que falla**

Create `infra/lib/__tests__/scraper-stack.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DataStack } from "../data-stack";
import { ScraperStack } from "../scraper-stack";

function template() {
  const app = new App();
  const data = new DataStack(app, "Data");
  const scraper = new ScraperStack(app, "Scraper", {
    table: data.table,
    snapshotBucket: data.snapshotBucket,
    dlq: data.scraperDlq,
  });
  return Template.fromStack(scraper);
}

describe("ScraperStack", () => {
  it("creates a Node 20 Lambda with TABLE_NAME and SNAPSHOT_BUCKET env", () => {
    template().hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs20.x",
      Environment: { Variables: { TABLE_NAME: "VenezuelaHelp" } },
    });
  });

  it("schedules the scraper every 30 minutes", () => {
    template().hasResourceProperties("AWS::Events::Rule", {
      ScheduleExpression: "rate(30 minutes)",
    });
  });
});
```

Nota: `TABLE_NAME` se setea literal a `"VenezuelaHelp"` (no `table.tableName`, que en un test cross-stack sería un token); pásalo como `table.tableName` en el código y, si el assertion falla por token, ajústalo a `Match.anyValue()` para `TABLE_NAME` y mantén el assert exacto solo en `SNAPSHOT_BUCKET` si aplica. El nombre de la tabla es fijo `VenezuelaHelp`, así que `table.tableName` resuelve a ese literal.

- [ ] **Step 3: Correr y ver fallar**

Run: `npm test --workspace @venezuelahelp/infra -- scraper`
Expected: FAIL — módulo no existe.

- [ ] **Step 4: Implementar `scraper-stack.ts`**

Create `infra/lib/scraper-stack.ts`:

```ts
import { Stack, StackProps, Duration } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as path from "node:path";

export interface ScraperStackProps extends StackProps {
  table: dynamodb.Table;
  snapshotBucket: s3.Bucket;
  dlq: sqs.Queue;
}

export class ScraperStack extends Stack {
  constructor(scope: Construct, id: string, props: ScraperStackProps) {
    super(scope, id, props);

    const fn = new NodejsFunction(this, "ScraperFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, "../../backend/src/scraper/handler.ts"),
      handler: "handler",
      timeout: Duration.minutes(5),
      memorySize: 512,
      deadLetterQueue: props.dlq,
      environment: {
        TABLE_NAME: props.table.tableName,
        SNAPSHOT_BUCKET: props.snapshotBucket.bucketName,
      },
      bundling: {
        format: lambda.OutputFormat.ESM,
        tsconfig: path.join(__dirname, "../../backend/tsconfig.json"),
      },
    });

    props.table.grantReadWriteData(fn);
    props.snapshotBucket.grantWrite(fn);

    new events.Rule(this, "ScraperSchedule", {
      schedule: events.Schedule.rate(Duration.minutes(30)),
      targets: [new targets.LambdaFunction(fn)],
    });
  }
}
```

- [ ] **Step 5: Modificar `bin/app.ts`**

Replace `infra/bin/app.ts` with:

```ts
import { App } from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { ScraperStack } from "../lib/scraper-stack";

const app = new App();
const env = { region: "us-east-1" };
const data = new DataStack(app, "VenezuelaHelpDataStack", { env });
new ScraperStack(app, "VenezuelaHelpScraperStack", {
  env,
  table: data.table,
  snapshotBucket: data.snapshotBucket,
  dlq: data.scraperDlq,
});
```

- [ ] **Step 6: Correr y ver pasar**

Run: `npm test --workspace @venezuelahelp/infra -- scraper`
Expected: PASS (2 passed). Si el assert de `TABLE_NAME` falla por token, aplica la nota del Step 2.

- [ ] **Step 7: Commit**

```bash
git add infra/lib/scraper-stack.ts infra/lib/__tests__/scraper-stack.test.ts infra/bin/app.ts infra/package.json package-lock.json
git commit -m "🏗️ feat(infra): add ScraperStack (NodejsFunction + EventBridge schedule + grants)"
```

---

### Task 12: Verificación final + deploy

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: todos los tests de `backend` e `infra` pasan.

- [ ] **Step 2: Build completo**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Synth del CDK**

Run: `cd infra && npx cdk synth --profile VenezuelaHelp`
Expected: genera ambas plantillas (DataStack + ScraperStack) sin errores.

- [ ] **Step 4 (requiere AWS): bootstrap + deploy**

Run:

```bash
cd infra
npx cdk bootstrap --profile VenezuelaHelp   # solo la primera vez en la cuenta/region
npx cdk deploy --all --profile VenezuelaHelp --require-approval never
```

Expected: despliega `VenezuelaHelpDataStack` y `VenezuelaHelpScraperStack`.

- [ ] **Step 5: Smoke test del scraper**

Run:

```bash
aws lambda invoke --function-name <ScraperFn name> --profile VenezuelaHelp /tmp/out.json && cat /tmp/out.json
aws s3 ls s3://<snapshot-bucket>/snapshot.json --profile VenezuelaHelp
```

Expected: el invoke devuelve el resumen con conteos > 0; existe `snapshot.json` en el bucket.

- [ ] **Step 6: Commit final**

```bash
git add -A && git commit -m "✅ test(fase2): green full suite for scraper" || echo "nada que commitear"
```

---

## Self-Review

**Cobertura del spec (Fase 2):**

- §6 scraper (EventBridge 30 min, conectores enchufables, normalización, dedup, aislamiento, snapshot) → Tasks 1–11. ✓
- §2 fuentes / conectores jsonApi reales → Tasks 4–5 (grounded en FINDINGS.md). ✓
- §9 snapshot público en S3 → Task 9. ✓
- Decisión desaparecidos = geolocalizados → Tasks 4 (missing-persons/external geo) y 5 (missing/map). ✓
- §12 pruebas (conectores con fixtures reales, aislamiento, snapshot) → cada task trae su test. ✓

**Placeholders:** sin TBD/TODO; el único trabajo "manual" es recortar fixtures (Task 3) con instrucciones precisas. ✓

**Consistencia de tipos:** `SourceConnector` (Task 2) consumido por Tasks 4–6; `SourceResult` (Task 8) consumido por Task 10; `geo`/`truncate` (Task 2) usados en Tasks 4–5. ✓

**Decisiones de diseño documentadas:**

- Dedup: por identidad estable `(category, sourceId, externalId)` de Fase 1 (`ItemRepo`). Un mismo ítem en ambas fuentes se guarda 2 veces (una por `sourceId`); aceptable en MVP (el LLM sintetiza). Dedup cross-source queda fuera de alcance.
- No se ingiere el dataset completo de 31K desaparecidos (decisión de costo del patrocinador); solo subconjuntos geolocalizados.
- `type=missing` de terremotovenezuela `/api/reports` se ignora (cubierto por `/api/missing/map`).
- `casualties`/`stats` no se ingieren en Fase 2 (YAGNI; el bot no los necesita aún).

**Fuera de alcance (fases posteriores):** bot de Telegram (Fase 3), frontends (Fases 4–5), reconfiguración de cadencia desde admin (Fase 5).
