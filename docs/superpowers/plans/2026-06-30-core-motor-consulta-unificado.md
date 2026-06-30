# Motor de consulta unificado (`@venezuelahelp/core`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar la lógica de consulta del bot de Telegram, la API `/v1/*` y el frontend público en un único workspace isomorfo `@venezuelahelp/core`, de modo que las tres superficies respondan coherente (mismos ítems y conteos) sobre el mismo `snapshot.json`, y aprovisionar una API key interna para el bot.

**Architecture:** Un 5º workspace TypeScript sin dependencias, isomorfo (corre en Lambda y en navegador), expone `searchItems`/`retrieve`/`countItems`/`listItems` + primitivas. El bot, la `data-api` y `frontend-public` lo importan; cada uno carga el snapshot a su manera y aplica el mismo motor. El cómputo del enrichment se queda en `backend`. Además, se aprovisiona una API key interna del bot en SSM SecureString (uso futuro).

**Tech Stack:** TypeScript strict, npm workspaces, vitest, AWS CDK v2, DynamoDB, SSM, esbuild (CDK NodejsFunction), Vite (frontend).

## Global Constraints

- **TypeScript strict** siempre. El workspace `core` NO tiene dependencias (`dependencies: {}`), NO importa `node:*` ni `@aws-sdk/*` ni libs de DOM. Imports internos del core: **relativos** (el alias `@/` de backend no aplica al core).
- **El shape del `snapshot.json` NO cambia** (`{ generatedAt, categories, sources }`). El público vivo depende de él.
- **El cómputo del enrichment** (`backend/src/enrichment/`) se queda en backend. Al core migran solo tipos y funciones que **consumen** marcas ya calculadas.
- **TDD**: test que falla → implementación mínima → test verde → commit. Tests con `vitest`.
- Tests del backend se corren desde el workspace: `npm test --workspace @venezuelahelp/backend` (correr desde la raíz rompe el alias `@/`).
- **Conventional Commits con emoji**: `<emoji> <tipo>(<scope>): <descripción imperativa>`. Cada commit termina con `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Coherencia (criterio de éxito):** la misma consulta por `retrieve` (bot), `queryItems` (API) y `searchItems` (frontend) devuelve el mismo conjunto de ítems (por clave `category/sourceId#externalId`).
- Nombre del parámetro SSM de la key del bot: `/venezuelahelp/bot/data-api-key`. `consumerName` de la key: `telegram-bot`.

---

## Tipos compartidos (referencia para todas las tareas)

El core define estos tipos en `core/src/types.ts`. Son superconjunto estructural de los actuales (`backend/src/telegram/types.ts` y `data-api/snapshot.ts`), así que las superficies siguen compilando por structural typing.

```ts
export const CATEGORIES = [
  "reportes",
  "desaparecidos",
  "acopios",
  "edificios",
  "solicitudes",
  "hospitales",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Ubicacion {
  lat: number;
  lng: number;
  nombre?: string;
}

export interface PublicItem {
  category: string;
  sourceId: string;
  externalId: string;
  titulo: string;
  texto: string;
  ubicacion?: Ubicacion;
  status?: string;
  sourceUrl?: string;
  trust?: "verificado" | "corroborado" | "no_verificado" | "sospechoso";
  isCanonical?: boolean;
  dupOf?: string;
  sourcesCount?: number;
  trustReasons?: string[];
}

export interface Snapshot {
  generatedAt: string;
  categories: Record<string, PublicItem[]>;
  sources?: Record<string, { nombre: string; url?: string }>;
}
```

---

### Task 1: Crear el workspace `@venezuelahelp/core` (scaffolding + tipos)

**Files:**

- Create: `core/package.json`
- Create: `core/tsconfig.json`
- Create: `core/src/types.ts`
- Create: `core/src/index.ts`
- Create: `core/src/__tests__/types.test.ts`
- Modify: `package.json` (raíz: añadir `core` a `workspaces`)
- Modify: `tsconfig.base.json` o `tsconfig.json` raíz (añadir path si el repo usa paths centralizados — ver Step 2)

**Interfaces:**

- Produces: el módulo `@venezuelahelp/core` con `CATEGORIES`, `Category`, `Ubicacion`, `PublicItem`, `Snapshot` exportados desde `index.ts`.

- [ ] **Step 1: Crear `core/package.json`**

```json
{
  "name": "@venezuelahelp/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Crear `core/tsconfig.json`**

Verificar primero si existe `tsconfig.base.json` en la raíz (`ls tsconfig*.json`). Si existe, extenderlo; si no, usar config standalone:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src"]
}
```

Nota: `"lib": ["ES2022"]` sin `"DOM"` garantiza que el core no use APIs de navegador. `"types": []` evita arrastrar `@types/node`.

- [ ] **Step 3: Añadir `core` a los workspaces de la raíz**

En `package.json` raíz, añadir `"core"` al array `workspaces` (confirmar el formato exacto leyéndolo antes; debe quedar junto a `backend`, `infra`, `frontend-public`, `frontend-admin`).

- [ ] **Step 4: Crear `core/src/types.ts`**

Copiar el bloque de "Tipos compartidos" de arriba (CATEGORIES, Category, Ubicacion, PublicItem, Snapshot) tal cual.

- [ ] **Step 5: Crear `core/src/index.ts`**

```ts
export * from "./types";
```

- [ ] **Step 6: Escribir el test**

`core/src/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CATEGORIES } from "../index";

describe("core types", () => {
  it("exporta las 6 categorías en orden", () => {
    expect(CATEGORIES).toEqual([
      "reportes",
      "desaparecidos",
      "acopios",
      "edificios",
      "solicitudes",
      "hospitales",
    ]);
  });
});
```

- [ ] **Step 7: Instalar y correr**

Run: `npm install` (enlaza el nuevo workspace) seguido de `npm test --workspace @venezuelahelp/core`
Expected: 1 test PASS.

- [ ] **Step 8: Commit**

```bash
git add core package.json package-lock.json tsconfig*.json
git commit -m "✨ feat(core): scaffold workspace @venezuelahelp/core con tipos compartidos

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Primitivas de texto en el core (`normalize`/`stem`/`keywords`)

**Files:**

- Create: `core/src/text.ts`
- Create: `core/src/__tests__/text.test.ts`
- Modify: `core/src/index.ts`

**Interfaces:**

- Produces: `normalize(s: string): string`, `keywords(q: string): string[]`, `stem(w: string): string`, `STOP: Set<string>`.

- [ ] **Step 1: Escribir el test** (`core/src/__tests__/text.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { normalize, keywords } from "../index";

describe("normalize", () => {
  it("strips accents and punctuation, lowercases", () => {
    expect(normalize("Médicínas, ¡Agua!")).toBe("medicinas agua");
  });
});

describe("keywords", () => {
  it("filtra stopwords y aplica stemming de plural", () => {
    expect(keywords("¿desaparecidos en La Guaira?")).toContain("desaparecid");
  });
});
```

- [ ] **Step 2: Run test, verificar que falla**

Run: `npm test --workspace @venezuelahelp/core -- text`
Expected: FAIL (módulo `../index` no exporta `normalize`).

- [ ] **Step 3: Crear `core/src/text.ts`**

Copiar **textualmente** desde `backend/src/telegram/retrieval.ts` (líneas 3–61) el bloque `STOP`, `normalize`, `stem`, `keywords`. Exportar `STOP`, `normalize`, `stem`, `keywords`.

- [ ] **Step 4: Re-exportar desde `index.ts`**

Añadir `export * from "./text";` a `core/src/index.ts`.

- [ ] **Step 5: Run test, verificar verde**

Run: `npm test --workspace @venezuelahelp/core -- text`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/src/text.ts core/src/__tests__/text.test.ts core/src/index.ts
git commit -m "✨ feat(core): primitivas de texto (normalize/stem/keywords)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Inferencia de categoría en el core

**Files:**

- Create: `core/src/category.ts`
- Create: `core/src/__tests__/category.test.ts`
- Modify: `core/src/index.ts`

**Interfaces:**

- Consumes: `normalize` (de `./text`).
- Produces: `CATEGORY_SIGNALS: Record<string, string[]>`, `inferCategories(question: string): Set<string>`, `CAT_LABEL: Record<string, string>`.

- [ ] **Step 1: Escribir el test** (`core/src/__tests__/category.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { inferCategories, CAT_LABEL } from "../index";

describe("inferCategories", () => {
  it("infiere desaparecidos por la señal léxica", () => {
    expect(
      inferCategories("¿hay desaparecidos en Vargas?").has("desaparecidos"),
    ).toBe(true);
  });
  it("infiere solicitudes por 'necesit'", () => {
    expect(inferCategories("necesito agua").has("solicitudes")).toBe(true);
  });
});

describe("CAT_LABEL", () => {
  it("etiqueta legible de desaparecidos", () => {
    expect(CAT_LABEL.desaparecidos).toBe("personas desaparecidas");
  });
});
```

- [ ] **Step 2: Run test, verificar que falla**

Run: `npm test --workspace @venezuelahelp/core -- category`
Expected: FAIL.

- [ ] **Step 3: Crear `core/src/category.ts`**

Copiar **textualmente** desde `backend/src/telegram/retrieval.ts` el bloque `CATEGORY_SIGNALS` (líneas 66–125), `inferCategories` (127–134) y `CAT_LABEL` (137–144). Cambiar el import de `normalize` a `import { normalize } from "./text";`. Exportar los tres.

- [ ] **Step 4: Re-exportar desde `index.ts`**

Añadir `export * from "./category";`.

- [ ] **Step 5: Run test, verificar verde**

Run: `npm test --workspace @venezuelahelp/core -- category`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/src/category.ts core/src/__tests__/category.test.ts core/src/index.ts
git commit -m "✨ feat(core): inferencia de categoría (CATEGORY_SIGNALS/inferCategories/CAT_LABEL)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Ranking y filtros en el core

**Files:**

- Create: `core/src/rank.ts`
- Create: `core/src/filter.ts`
- Create: `core/src/__tests__/rank.test.ts`
- Create: `core/src/__tests__/filter.test.ts`
- Modify: `core/src/index.ts`

**Interfaces:**

- Consumes: `normalize` (text), `PublicItem` (types).
- Produces:
  - `rank.ts`: `FIELD_WEIGHT`, `scoreFields(it: PublicItem, kws: string[]): number`, `MAX_CATEGORY_FRACTION`, `selectWithQuota<T extends { item: PublicItem }>(sorted: T[], k: number): T[]`.
  - `filter.ts`: `filterUsable(items: PublicItem[], opts?: { collapseDuplicates?: boolean; includeSuspicious?: boolean }): PublicItem[]`, `matchesZona(it: PublicItem, zona: string): boolean`, `haversineKm(a: {lat:number;lng:number}, b: {lat:number;lng:number}): number`.

- [ ] **Step 1: Escribir tests** (`core/src/__tests__/rank.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { scoreFields } from "../index";
import type { PublicItem } from "../index";

const it1: PublicItem = {
  category: "acopios",
  sourceId: "s",
  externalId: "1",
  titulo: "Acopio Petare",
  texto: "agua",
};

describe("scoreFields", () => {
  it("pondera título por encima de texto", () => {
    expect(scoreFields(it1, ["petare"])).toBeGreaterThan(
      scoreFields(it1, ["agua"]),
    );
  });
});
```

`core/src/__tests__/filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filterUsable, haversineKm } from "../index";
import type { PublicItem } from "../index";

const items: PublicItem[] = [
  {
    category: "edificios",
    sourceId: "a",
    externalId: "1",
    titulo: "t",
    texto: "x",
    trust: "corroborado",
    isCanonical: true,
  },
  {
    category: "edificios",
    sourceId: "b",
    externalId: "2",
    titulo: "t",
    texto: "x",
    trust: "corroborado",
    isCanonical: false,
    dupOf: "a#1",
  },
  {
    category: "edificios",
    sourceId: "c",
    externalId: "3",
    titulo: "t",
    texto: "x",
    trust: "sospechoso",
    isCanonical: true,
  },
];

describe("filterUsable", () => {
  it("colapsa duplicados y excluye sospechosos por defecto", () => {
    const out = filterUsable(items);
    expect(out).toHaveLength(1);
    expect(out[0].externalId).toBe("1");
  });
  it("puede incluir duplicados y sospechosos", () => {
    expect(
      filterUsable(items, {
        collapseDuplicates: false,
        includeSuspicious: true,
      }),
    ).toHaveLength(3);
  });
});

describe("haversineKm", () => {
  it("distancia ~0 para el mismo punto", () => {
    expect(
      haversineKm({ lat: 10, lng: -66 }, { lat: 10, lng: -66 }),
    ).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Run tests, verificar que fallan**

Run: `npm test --workspace @venezuelahelp/core -- rank filter`
Expected: FAIL.

- [ ] **Step 3: Crear `core/src/rank.ts`**

Copiar `FIELD_WEIGHT` + `scoreFields` desde `backend/src/telegram/retrieval.ts` (líneas 219–234) y `MAX_CATEGORY_FRACTION` + `selectWithQuota` (líneas 290–315). Cambiar imports a `import { normalize } from "./text";` y `import type { PublicItem } from "./types";`. Exportar los cuatro símbolos.

- [ ] **Step 4: Crear `core/src/filter.ts`**

```ts
import { normalize } from "./text";
import type { PublicItem } from "./types";

export interface FilterOpts {
  collapseDuplicates?: boolean; // default true
  includeSuspicious?: boolean; // default false
}

// Deja solo ítems usables: excluye sospechosos y (por defecto) los duplicados no
// canónicos del cluster. Snapshots viejos sin marca (isCanonical undefined) se
// tratan como canónicos.
export function filterUsable(
  items: PublicItem[],
  opts: FilterOpts = {},
): PublicItem[] {
  const collapse = opts.collapseDuplicates !== false;
  const includeSus = opts.includeSuspicious === true;
  return items.filter((i) => {
    if (!includeSus && i.trust === "sospechoso") return false;
    if (collapse && i.isCanonical === false) return false;
    return true;
  });
}

export function matchesZona(it: PublicItem, zona: string): boolean {
  const z = normalize(zona);
  if (!z) return true;
  return normalize(
    `${it.titulo} ${it.texto} ${it.ubicacion?.nombre ?? ""}`,
  ).includes(z);
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 5: Re-exportar desde `index.ts`**

Añadir `export * from "./rank";` y `export * from "./filter";`.

- [ ] **Step 6: Run tests, verificar verdes**

Run: `npm test --workspace @venezuelahelp/core -- rank filter`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add core/src/rank.ts core/src/filter.ts core/src/__tests__/rank.test.ts core/src/__tests__/filter.test.ts core/src/index.ts
git commit -m "✨ feat(core): ranking (scoreFields/selectWithQuota) y filtros (filterUsable/haversine)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Núcleo de búsqueda `searchItems` + `retrieve`

**Files:**

- Create: `core/src/search.ts`
- Create: `core/src/__tests__/search.test.ts`
- Modify: `core/src/index.ts`

**Interfaces:**

- Consumes: `keywords`, `inferCategories`, `scoreFields`, `selectWithQuota`, `filterUsable`, `matchesZona`, `haversineKm`, `PublicItem`, `Snapshot`.
- Produces:
  - `searchItems(snap: Snapshot, params: SearchParams): PublicItem[]`
  - `retrieve(question: string, snap: Snapshot, k?: number): PublicItem[]`
  - `interface SearchParams { q?: string; category?: string; near?: { lat: number; lng: number }; radiusKm?: number; zona?: string; collapseDuplicates?: boolean; includeSuspicious?: boolean }`

- [ ] **Step 1: Escribir el test** (`core/src/__tests__/search.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { searchItems, retrieve } from "../index";
import type { Snapshot } from "../index";

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    reportes: Array.from({ length: 6 }, (_, i) => ({
      category: "reportes",
      sourceId: "sismo",
      externalId: `r${i}`,
      titulo: `Noticia ${i}`,
      texto: "muchos desaparecidos en La Guaira",
    })),
    desaparecidos: [
      {
        category: "desaparecidos",
        sourceId: "vtb",
        externalId: "d1",
        titulo: "Ana Ruiz",
        texto: "La Guaira, por localizar",
      },
      {
        category: "desaparecidos",
        sourceId: "vtb",
        externalId: "d2",
        titulo: "Pedro Gómez",
        texto: "Caracas, por localizar",
      },
    ],
  },
};

describe("retrieve (bot)", () => {
  it("prioriza la categoría inferida de la pregunta", () => {
    const res = retrieve("¿hay desaparecidos en La Guaira?", snap, 12);
    expect(res[0].category).toBe("desaparecidos");
    expect(res.filter((i) => i.category === "desaparecidos")).toHaveLength(2);
  });
});

describe("searchItems (API/frontend)", () => {
  it("filtra por categoría y rankea por keyword", () => {
    const res = searchItems(snap, { category: "desaparecidos", q: "guaira" });
    expect(res).toHaveLength(1);
    expect(res[0].externalId).toBe("d1");
  });
  it("excluye sospechosos por defecto", () => {
    const s: Snapshot = {
      generatedAt: "t",
      categories: {
        reportes: [
          {
            category: "reportes",
            sourceId: "s",
            externalId: "1",
            titulo: "sismo guaira",
            texto: "x",
            trust: "sospechoso",
          },
        ],
      },
    };
    expect(searchItems(s, { q: "guaira" })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test, verificar que falla**

Run: `npm test --workspace @venezuelahelp/core -- search`
Expected: FAIL.

- [ ] **Step 3: Crear `core/src/search.ts`**

```ts
import { keywords } from "./text";
import { inferCategories, CATEGORY_SIGNALS } from "./category";
import { scoreFields, selectWithQuota } from "./rank";
import { filterUsable, matchesZona, haversineKm } from "./filter";
import type { PublicItem, Snapshot } from "./types";

export interface SearchParams {
  q?: string;
  category?: string;
  near?: { lat: number; lng: number };
  radiusKm?: number;
  zona?: string;
  collapseDuplicates?: boolean;
  includeSuspicious?: boolean;
}

interface Scored {
  item: PublicItem;
  score: number;
  target: boolean;
}

// Devuelve los ítems del snapshot que cumplen el filtro, rankeados por keyword.
// Coherente con el bot: infiere categoría, pondera campos, respeta enrichment.
// No pagina ni recorta (eso lo hace cada superficie).
function rankPool(snap: Snapshot, params: SearchParams): Scored[] {
  const targetCats = params.q ? inferCategories(params.q) : new Set<string>();
  const kws = params.q ? keywords(params.q) : [];
  // Las palabras que dispararon la categoría no discriminan dentro de ella.
  const signals = [...targetCats].flatMap((c) => CATEGORY_SIGNALS[c] ?? []);
  const rankKws = signals.length
    ? kws.filter(
        (kw) => !signals.some((s) => kw.startsWith(s) || s.startsWith(kw)),
      )
    : kws;

  const out: Scored[] = [];
  for (const [cat, items] of Object.entries(snap.categories)) {
    if (params.category && cat !== params.category) continue;
    const usable = filterUsable(items, {
      collapseDuplicates: params.collapseDuplicates,
      includeSuspicious: params.includeSuspicious,
    });
    for (const item of usable) {
      if (params.zona && !matchesZona(item, params.zona)) continue;
      if (
        params.near &&
        params.radiusKm !== undefined &&
        (!item.ubicacion ||
          haversineKm(params.near, item.ubicacion) > params.radiusKm)
      ) {
        continue;
      }
      const score = rankKws.length ? scoreFields(item, rankKws) : 0;
      const target = targetCats.has(item.category);
      // Sin query (o sin keywords útiles), todo lo que pasó los filtros entra.
      if (rankKws.length > 0 && score === 0 && !target) continue;
      out.push({ item, score, target });
    }
  }

  out.sort((a, b) => {
    if (targetCats.size > 0 && a.target !== b.target) return a.target ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    const ca = a.item.isCanonical ? 1 : 0;
    const cb = b.item.isCanonical ? 1 : 0;
    if (ca !== cb) return cb - ca;
    return (b.item.sourcesCount ?? 0) - (a.item.sourcesCount ?? 0);
  });
  return out;
}

export function searchItems(
  snap: Snapshot,
  params: SearchParams,
): PublicItem[] {
  return rankPool(snap, params).map((s) => s.item);
}

// Capa bot: top-k con cuota por categoría para el RAG.
export function retrieve(
  question: string,
  snap: Snapshot,
  k = 15,
): PublicItem[] {
  const scored = rankPool(snap, { q: question });
  return selectWithQuota(scored, k).map((s) => s.item);
}
```

- [ ] **Step 4: Re-exportar desde `index.ts`**

Añadir `export * from "./search";`.

- [ ] **Step 5: Run test, verificar verde**

Run: `npm test --workspace @venezuelahelp/core -- search`
Expected: PASS.

- [ ] **Step 6: Migrar los tests de ranking del bot al core**

Copiar los casos de `backend/src/telegram/__tests__/retrieval.test.ts` que prueban `retrieve` (describe "category routing", "field weighting", "diversidad por categoría", "variantes singular/plural", "ranking por término discriminante", "enrichment") a `core/src/__tests__/search.test.ts`, ajustando el import a `../index`. Correr: `npm test --workspace @venezuelahelp/core` → todos verdes.

- [ ] **Step 7: Commit**

```bash
git add core/src/search.ts core/src/__tests__/search.test.ts core/src/index.ts
git commit -m "✨ feat(core): searchItems + retrieve (motor de consulta unificado)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Agregados en el core (`countItems`/`listItems`/`categoryStat`)

**Files:**

- Create: `core/src/aggregate.ts`
- Create: `core/src/__tests__/aggregate.test.ts`
- Modify: `core/src/index.ts`

**Interfaces:**

- Consumes: `CAT_LABEL` (category), `filterUsable`, `matchesZona` (filter), `PublicItem`, `Snapshot`.
- Produces:
  - `categoryStat(items: PublicItem[]): { count: number; sources: number }`
  - `plural(n: number, sing: string, plu: string): string`
  - `countItems(snap: Snapshot, args: { category?: string; zona?: string }): string`
  - `listItems(snap: Snapshot, args: { category?: string; zona?: string; limite?: number }): { category: string; total: number; page: PublicItem[] }`

- [ ] **Step 1: Escribir el test** (`core/src/__tests__/aggregate.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { countItems, listItems, categoryStat } from "../index";
import type { PublicItem, Snapshot } from "../index";

const di = (src: string, id: string): PublicItem => ({
  category: "desaparecidos",
  sourceId: src,
  externalId: id,
  titulo: `P${id}`,
  texto: "",
});

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    desaparecidos: [
      di("a", "1"),
      di("a", "2"),
      di("b", "3"),
      { ...di("c", "4"), trust: "sospechoso" },
    ],
    solicitudes: [
      {
        category: "solicitudes",
        sourceId: "s",
        externalId: "x",
        titulo: "Necesito insulina",
        texto: "Petare",
      },
    ],
  },
};

describe("categoryStat", () => {
  it("cuenta usables y fuentes (excluye sospechosos)", () => {
    expect(categoryStat(snap.categories.desaparecidos)).toEqual({
      count: 3,
      sources: 2,
    });
  });
});

describe("countItems", () => {
  it("agrega una categoría con su etiqueta", () => {
    const a = countItems(snap, { category: "desaparecidos" });
    expect(a).toContain("3");
    expect(a).toContain("personas desaparecidas");
  });
  it("resume todas las categorías sin categoría específica", () => {
    expect(countItems(snap, {})).toContain("📊");
  });
});

describe("listItems", () => {
  it("lista la página y reporta el total", () => {
    const r = listItems(snap, { category: "desaparecidos", limite: 2 });
    expect(r.total).toBe(3);
    expect(r.page).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, verificar que falla**

Run: `npm test --workspace @venezuelahelp/core -- aggregate`
Expected: FAIL.

- [ ] **Step 3: Crear `core/src/aggregate.ts`**

Portar la lógica desde `backend/src/telegram/query.ts` (`usable`→usar `filterUsable`, `matchesZona`→usar el de `./filter`, `listItems`, `countItems`, `LIST_DEFAULT`, `LIST_MAX`, `cap`) y `categoryStat`+`plural` desde `backend/src/telegram/retrieval.ts` (líneas 146–163). Imports: `import { CAT_LABEL } from "./category"; import { filterUsable, matchesZona } from "./filter"; import type { PublicItem, Snapshot } from "./types";`. `countItems` devuelve el string con formato `📊 Tengo N registros…` (multi-categoría) o `Hay N registros de <label>…` (categoría única), idéntico al actual de `query.ts`.

- [ ] **Step 4: Re-exportar desde `index.ts`**

Añadir `export * from "./aggregate";`.

- [ ] **Step 5: Run test, verificar verde**

Run: `npm test --workspace @venezuelahelp/core -- aggregate`
Expected: PASS.

- [ ] **Step 6: Correr toda la suite del core**

Run: `npm test --workspace @venezuelahelp/core`
Expected: todos verdes.

- [ ] **Step 7: Commit**

```bash
git add core/src/aggregate.ts core/src/__tests__/aggregate.test.ts core/src/index.ts
git commit -m "✨ feat(core): agregados countItems/listItems/categoryStat

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Migrar el bot al core

**Files:**

- Modify: `backend/src/telegram/retrieval.ts` (dejar solo lógica de bot; re-exportar/usar core)
- Delete: `backend/src/telegram/query.ts` (su contenido vive en `core/aggregate`)
- Modify: `backend/src/telegram/agent.ts` (imports → core)
- Modify: `backend/src/telegram/handler.ts` (imports → core)
- Modify: `backend/package.json` (añadir dependencia `@venezuelahelp/core`)
- Modify: `backend/src/telegram/__tests__/retrieval.test.ts` y `query.test.ts` (ajustar imports / borrar lo que migró)

**Interfaces:**

- Consumes: `@venezuelahelp/core` (`normalize`, `keywords`, `inferCategories`, `CAT_LABEL`, `scoreFields`, `retrieve`, `countItems`, `listItems`, `categoryStat`, `plural`, tipos).
- Produces: `retrieval.ts` mantiene `isHelpRequest`, `HELP_PHRASES`, `isBareHelpCry`, `countAnswer` (lógica específica del bot).

- [ ] **Step 1: Añadir la dependencia de workspace**

En `backend/package.json`, añadir `"@venezuelahelp/core": "*"` a `dependencies`. Correr `npm install`.

- [ ] **Step 2: Reducir `backend/src/telegram/retrieval.ts` a lo específico del bot**

Reemplazar el archivo por:

```ts
import {
  normalize,
  CAT_LABEL,
  categoryStat,
  plural,
} from "@venezuelahelp/core";
import type { PublicItem, Snapshot } from "@/telegram/types";

// Re-export para compatibilidad de imports internos del bot.
export {
  normalize,
  keywords,
  inferCategories,
  CATEGORY_SIGNALS,
  CAT_LABEL,
  scoreFields,
  retrieve,
  categoryStat,
  plural,
} from "@venezuelahelp/core";

// --- Conteo determinista (formato de respuesta del bot) ---
export function countAnswer(question: string, snap: Snapshot): string | null {
  const n = normalize(question);
  const isCount = ["cuant", "numero", "cantidad", "total"].some((s) =>
    n.includes(s),
  );
  if (!isCount) return null;
  // Reutiliza el agregado del core para no divergir del total real.
  // (countItems del core ya produce el texto con etiqueta y fuentes.)
  return null as never; // placeholder eliminado en Step 3
}

// --- Intención "cómo pido ayuda" + grito de auxilio escueto ---
const HELP_PHRASES = [
  "solicitar ayuda",
  "pedir ayuda",
  "pido ayuda",
  "como solicito",
  "como pido",
  "conseguir ayuda",
  "consigo ayuda",
  "quiero ayuda",
  "donde pido",
];
const HELP_CRIES = [
  "ayuda",
  "ayudame",
  "ayudenme",
  "ayudenos",
  "auxilio",
  "socorro",
];
const HELP_FILLER = new Set([
  ...HELP_CRIES,
  "necesito",
  "quiero",
  "por",
  "favor",
  "porfa",
  "porfavor",
  "hola",
  "una",
  "algo",
  "alguna",
]);
function isBareHelpCry(n: string): boolean {
  const words = n.split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const hasCry = words.some((w) => HELP_CRIES.includes(w));
  return hasCry && words.every((w) => HELP_FILLER.has(w));
}
export function isHelpRequest(question: string): boolean {
  const n = normalize(question);
  return HELP_PHRASES.some((p) => n.includes(p)) || isBareHelpCry(n);
}
```

> **Nota:** el `PublicItem`/`Snapshot` del bot (`@/telegram/types`) son estructuralmente compatibles con los del core. Si TS se queja por nominalidad, cambiar esos imports de tipo a `from "@venezuelahelp/core"`.

- [ ] **Step 3: Implementar `countAnswer` con el agregado del core**

Reemplazar el cuerpo de `countAnswer` (quitando el placeholder) para que, cuando sea pregunta de conteo, delegue en `countItems` del core respetando la categoría inferida:

```ts
import { countItems, inferCategories } from "@venezuelahelp/core";
// ...
export function countAnswer(question: string, snap: Snapshot): string | null {
  const n = normalize(question);
  const isCount = ["cuant", "numero", "cantidad", "total"].some((s) =>
    n.includes(s),
  );
  if (!isCount) return null;
  const targets = inferCategories(question);
  const category = targets.size === 1 ? [...targets][0] : undefined;
  return countItems(snap, { category });
}
```

- [ ] **Step 4: Borrar `backend/src/telegram/query.ts` y actualizar `agent.ts`**

`agent.ts` importa hoy `from "@/telegram/query"`. Cambiar a `import { listItems, formatList, countItems } from ...`. **`formatList` no está en el core** (es presentación del bot): moverlo a `agent.ts` o a un nuevo `backend/src/telegram/format.ts`. Copiar `formatList` desde el `query.ts` actual (líneas 58–81) a `backend/src/telegram/format.ts` y exportarlo. `agent.ts`: `import { listItems, countItems } from "@venezuelahelp/core"; import { formatList } from "@/telegram/format";`.

- [ ] **Step 5: Actualizar los tests del bot**

- En `backend/src/telegram/__tests__/retrieval.test.ts`: borrar los `describe` de `retrieve`/ranking/`countAnswer` que ya viven en el core; **conservar** los de `isHelpRequest` (incluido "detecta un grito de ayuda escueto") y un test de `countAnswer` que verifique la delegación. Imports siguen desde `@/telegram/retrieval`.
- Renombrar/mover `query.test.ts` → cubrir `formatList` en `format.test.ts`; los tests de `listItems`/`countItems` ya están en el core.

- [ ] **Step 6: Correr la suite del bot**

Run: `npm test --workspace @venezuelahelp/backend -- telegram`
Expected: PASS (toda la suite telegram verde).

- [ ] **Step 7: Compilar el backend**

Run: `npm run build --workspace @venezuelahelp/backend`
Expected: `tsc` sin errores.

- [ ] **Step 8: Commit**

```bash
git add backend/src/telegram backend/package.json package-lock.json
git commit -m "♻️ refactor(telegram): el bot usa @venezuelahelp/core; elimina motor duplicado

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Migrar la `data-api` al core

**Files:**

- Modify: `backend/src/data-api/query.ts` (delegar a `core.searchItems`)
- Modify: `backend/src/data-api/__tests__/query.test.ts`

**Interfaces:**

- Consumes: `@venezuelahelp/core` (`searchItems`), `DataSnapshot` (compatible con `Snapshot`).
- Produces: `queryItems(snapshot, params)` con la MISMA firma actual (`QueryParams`/`QueryResult`), ahora con ranking + enrichment-aware; mantiene paginación por cursor.

- [ ] **Step 1: Escribir/actualizar el test** (`backend/src/data-api/__tests__/query.test.ts`)

Añadir un caso que verifique el nuevo comportamiento (ranking en vez de substring-AND) y que la paginación sigue:

```ts
import { describe, it, expect } from "vitest";
import { queryItems } from "@/data-api/query";
import type { DataSnapshot } from "@/data-api/snapshot";

const snap: DataSnapshot = {
  generatedAt: "t",
  categories: {
    acopios: [
      {
        category: "acopios",
        sourceId: "s",
        externalId: "1",
        titulo: "Acopio Petare",
        texto: "agua",
      },
      {
        category: "acopios",
        sourceId: "s",
        externalId: "2",
        titulo: "Centro Chacao",
        texto: "comida",
      },
    ],
  },
};

describe("queryItems (core)", () => {
  it("rankea por relevancia y excluye no-coincidentes", () => {
    const r = queryItems(snap, { q: "petare" });
    expect(r.items[0].externalId).toBe("1");
  });
  it("pagina con cursor", () => {
    const r = queryItems(snap, { limit: 1 });
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(2);
    expect(r.nextCursor).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verificar el estado actual**

Run: `npm test --workspace @venezuelahelp/backend -- data-api`
Expected: el caso de ranking FALLA (hoy es substring-AND sin orden de relevancia).

- [ ] **Step 3: Reescribir `backend/src/data-api/query.ts`**

```ts
import { searchItems } from "@venezuelahelp/core";
import type { DataSnapshot } from "@/data-api/snapshot";
import type { PublicItem } from "@/telegram/types";

export const MAX_LIMIT = 200;
export const DEFAULT_LIMIT = 50;

export interface QueryParams {
  category?: string;
  q?: string;
  near?: { lat: number; lng: number };
  radiusKm?: number;
  limit?: number;
  cursor?: string;
}

export interface QueryResult {
  items: PublicItem[];
  total: number;
  nextCursor?: string;
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  const n = Number.parseInt(
    Buffer.from(cursor, "base64url").toString("utf-8"),
    10,
  );
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function encodeCursor(offset: number): string {
  return Buffer.from(String(offset)).toString("base64url");
}

export function queryItems(
  snapshot: DataSnapshot,
  params: QueryParams,
): QueryResult {
  const items = searchItems(snapshot, {
    category: params.category,
    q: params.q,
    near: params.near,
    radiusKm: params.radiusKm,
  });
  const total = items.length;
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = decodeCursor(params.cursor);
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < total ? encodeCursor(nextOffset) : undefined;
  return { items: page, total, nextCursor };
}
```

- [ ] **Step 4: Run tests, verificar verdes**

Run: `npm test --workspace @venezuelahelp/backend -- data-api`
Expected: PASS (ranking + paginación).

- [ ] **Step 5: Compilar**

Run: `npm run build --workspace @venezuelahelp/backend`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add backend/src/data-api
git commit -m "♻️ refactor(data-api): queryItems usa @venezuelahelp/core (ranking + enrichment-aware)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Migrar `frontend-public` al core

**Files:**

- Modify: `frontend-public/package.json` (dependencia `@venezuelahelp/core`)
- Modify: `frontend-public/src/data/filter.ts` (usar core para normalize + búsqueda con ranking; conservar el filtro multi-categoría y los helpers de conteo por fuente)
- Modify: `frontend-public/src/data/filter.test.ts` (si existe; ajustar expectativas de orden)
- Modify: `frontend-public/vite.config.ts` / `tsconfig.json` solo si el resolver necesita ayuda con el workspace (ver Step 4)

**Interfaces:**

- Consumes: `@venezuelahelp/core` (`normalize`, `searchItems`, `filterUsable`).
- Produces: `flatten`, `filterItems`, `countBySource`, `sourcesForDisplay`, `countByCategory` con la misma firma (el resto del front no cambia).

- [ ] **Step 1: Añadir la dependencia**

En `frontend-public/package.json`, añadir `"@venezuelahelp/core": "*"` a `dependencies`. Correr `npm install`.

- [ ] **Step 2: Reescribir `flatten` y `filterItems` con el core**

En `frontend-public/src/data/filter.ts`, reemplazar el `normalize` local por el del core y reescribir `flatten`/`filterItems` para coherencia (colapso de duplicados + búsqueda con ranking), conservando el filtro multi-categoría (`Set<Category>`):

```ts
import type { Category, Item, Snapshot } from "@/types";
import { CATEGORY_ORDER } from "./categories";
import { normalize, filterUsable, searchItems } from "@venezuelahelp/core";

export { normalize };

// Colapsa duplicados (solo canónicos) respetando el orden de categorías.
export function flatten(snap: Snapshot): Item[] {
  const result: Item[] = [];
  for (const category of CATEGORY_ORDER) {
    for (const item of filterUsable(
      snap.categories[category] ?? [],
    ) as Item[]) {
      result.push(item);
    }
  }
  return result;
}

// Filtra por categorías activas (multi-select) + query con el MISMO ranking que
// el bot/API. Sin query, mantiene el orden de `flatten`.
export function filterItems(
  items: Item[],
  query: string,
  active: Set<Category>,
): Item[] {
  const byCat =
    active.size > 0 ? items.filter((i) => active.has(i.category)) : items;
  if (!query.trim()) return byCat;
  // searchItems espera un Snapshot; envolvemos los ítems ya filtrados por cat.
  const snap: Snapshot = {
    generatedAt: "",
    categories: groupByCategory(byCat),
  };
  return searchItems(snap, { q: query }) as Item[];
}

function groupByCategory(items: Item[]): Record<string, Item[]> {
  const out: Record<string, Item[]> = {};
  for (const it of items) (out[it.category] ??= []).push(it);
  return out;
}
```

> Mantener sin cambios `countBySource`, `sourcesForDisplay`, `countByCategory` (operan sobre los ítems ya filtrados).

- [ ] **Step 3: Ajustar el test del front (si existe)**

Si hay `frontend-public/src/data/filter.test.ts`, actualizar las aserciones que dependían del orden de inserción para el caso con `query` (ahora viene rankeado). Si no existe, crear uno mínimo que verifique que `filterItems(items, "petare", new Set())` devuelve primero el match de título.

- [ ] **Step 4: Build del frontend**

Run: `npm run build --workspace @venezuelahelp/frontend-public`
Expected: `tsc -b && vite build` sin errores. Si Vite no resuelve `@venezuelahelp/core`, añadir en `vite.config.ts` un alias `"@venezuelahelp/core": path.resolve(__dirname, "../core/src/index.ts")` y en `tsconfig.json` el `paths` equivalente.

- [ ] **Step 5: Correr tests del front**

Run: `npm test --workspace @venezuelahelp/frontend-public`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend-public/package.json frontend-public/src frontend-public/vite.config.ts frontend-public/tsconfig.json package-lock.json
git commit -m "♻️ refactor(frontend-public): búsqueda/colapso con @venezuelahelp/core

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Aprovisionar la API key interna del bot (lógica)

**Files:**

- Create: `backend/src/data-api/botKey.ts`
- Create: `backend/src/data-api/__tests__/botKey.test.ts`
- Modify: `backend/src/telegram/secret.ts` (añadir `getDataApiKey`)
- Modify: `backend/src/telegram/__tests__/secret.test.ts` (si existe; si no, crear caso)

**Interfaces:**

- Consumes: `ApiKeyRepo` (`create`), `SSMClient` (`GetParameter`/`PutParameter`).
- Produces:
  - `ensureBotApiKey(deps): Promise<{ created: boolean }>` — idempotente.
  - `getDataApiKey(deps?): Promise<string>` — lee `/venezuelahelp/bot/data-api-key` cacheado.

- [ ] **Step 1: Escribir el test** (`backend/src/data-api/__tests__/botKey.test.ts`)

```ts
import { describe, it, expect, vi } from "vitest";
import { ensureBotApiKey } from "@/data-api/botKey";

const PARAM = "/venezuelahelp/bot/data-api-key";

describe("ensureBotApiKey", () => {
  it("no hace nada si el parámetro ya existe", async () => {
    const ssm = {
      send: vi.fn().mockResolvedValue({ Parameter: { Value: "vh_live_x" } }),
    };
    const repo = { create: vi.fn() };
    const r = await ensureBotApiKey({
      ssm: ssm as never,
      apiKeyRepo: repo as never,
      now: "2026-06-30T00:00:00Z",
    });
    expect(r.created).toBe(false);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("crea la key y la guarda en SSM si falta", async () => {
    const notFound = Object.assign(new Error("nf"), {
      name: "ParameterNotFound",
    });
    const ssm = {
      send: vi
        .fn()
        .mockRejectedValueOnce(notFound) // GetParameter
        .mockResolvedValueOnce({}), // PutParameter
    };
    const repo = {
      create: vi.fn().mockResolvedValue({ rawKey: "vh_live_new", apiKey: {} }),
    };
    const r = await ensureBotApiKey({
      ssm: ssm as never,
      apiKeyRepo: repo as never,
      now: "2026-06-30T00:00:00Z",
    });
    expect(r.created).toBe(true);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ consumerName: "telegram-bot" }),
    );
    // El segundo send es el PutParameter con SecureString
    const putArg = ssm.send.mock.calls[1][0];
    expect(putArg.input.Name).toBe(PARAM);
    expect(putArg.input.Type).toBe("SecureString");
    expect(putArg.input.Value).toBe("vh_live_new");
  });
});
```

- [ ] **Step 2: Run test, verificar que falla**

Run: `npm test --workspace @venezuelahelp/backend -- botKey`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Crear `backend/src/data-api/botKey.ts`**

```ts
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { ApiKeyRepo } from "@/shared/repos/apiKeyRepo";

export const BOT_API_KEY_PARAM = "/venezuelahelp/bot/data-api-key";

interface Deps {
  ssm: Pick<SSMClient, "send">;
  apiKeyRepo: Pick<ApiKeyRepo, "create">;
  now: string;
}

// Idempotente: si el parámetro existe, no regenera (la raw solo se conoce una
// vez). Si falta, crea una API key (vh_live_*) y guarda la raw en SSM Secure.
export async function ensureBotApiKey(
  deps: Partial<Deps> = {},
): Promise<{ created: boolean }> {
  const ssm = (deps.ssm as Deps["ssm"]) ?? new SSMClient({});
  const apiKeyRepo =
    (deps.apiKeyRepo as Deps["apiKeyRepo"]) ?? new ApiKeyRepo();
  const now = deps.now ?? new Date().toISOString();

  try {
    const res = await ssm.send(
      new GetParameterCommand({
        Name: BOT_API_KEY_PARAM,
        WithDecryption: true,
      }),
    );
    if (res.Parameter?.Value) return { created: false };
  } catch (err) {
    if ((err as { name?: string }).name !== "ParameterNotFound") throw err;
  }

  const { rawKey } = await apiKeyRepo.create({
    consumerName: "telegram-bot",
    email: "internal",
    requestId: "internal-bot",
    createdAt: now,
  });
  await ssm.send(
    new PutParameterCommand({
      Name: BOT_API_KEY_PARAM,
      Value: rawKey,
      Type: "SecureString",
      Overwrite: false,
    }),
  );
  return { created: true };
}
```

- [ ] **Step 4: Run test, verificar verde**

Run: `npm test --workspace @venezuelahelp/backend -- botKey`
Expected: PASS.

- [ ] **Step 5: Añadir `getDataApiKey` a `backend/src/telegram/secret.ts`**

Añadir (mismo patrón cacheado que `getTelegramToken`):

```ts
const DATA_API_KEY_NAME = "/venezuelahelp/bot/data-api-key";
let cachedDataApiKey: string | null = null;

export async function getDataApiKey(deps?: Partial<Deps>): Promise<string> {
  if (cachedDataApiKey) return cachedDataApiKey;
  const client = (deps?.ssm as Deps["ssm"]) ?? ssm;
  const res = await client.send(
    new GetParameterCommand({ Name: DATA_API_KEY_NAME, WithDecryption: true }),
  );
  cachedDataApiKey = res.Parameter?.Value ?? "";
  return cachedDataApiKey;
}
```

Actualizar `__resetTokenCache()` para resetear también `cachedDataApiKey = null`.

- [ ] **Step 6: Test de `getDataApiKey`**

Añadir a `backend/src/telegram/__tests__/secret.test.ts` (o crearlo) un caso que mockee `ssm.send` devolviendo `{ Parameter: { Value: "vh_live_x" } }` y verifique `getDataApiKey({ ssm })` === `"vh_live_x"`. Llamar `__resetTokenCache()` en `beforeEach`.

- [ ] **Step 7: Correr y compilar**

Run: `npm test --workspace @venezuelahelp/backend -- botKey secret` y `npm run build --workspace @venezuelahelp/backend`
Expected: PASS + build limpio.

- [ ] **Step 8: Commit**

```bash
git add backend/src/data-api/botKey.ts backend/src/data-api/__tests__/botKey.test.ts backend/src/telegram/secret.ts backend/src/telegram/__tests__/secret.test.ts
git commit -m "✨ feat(bot): aprovisiona y lee API key interna en SSM (uso futuro)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Wiring del aprovisionamiento + permisos IAM

**Files:**

- Modify: `backend/src/scraper/orchestrator.ts` o `backend/src/scraper/handler.ts` (llamar `ensureBotApiKey` en el bootstrap)
- Modify: `infra/lib/scraper-stack.ts` (permiso `ssm:GetParameter`+`ssm:PutParameter` sobre el path de la key)
- Modify: `infra/lib/bot-stack.ts` (permiso `ssm:GetParameter` sobre el path de la key)
- Modify: `infra/lib/__tests__/scraper-stack.test.ts` y `bot-stack.test.ts` (aserción de la policy)

**Interfaces:**

- Consumes: `ensureBotApiKey` (Task 10).

- [ ] **Step 1: Llamar `ensureBotApiKey` en el bootstrap del scraper**

En `backend/src/scraper/handler.ts`, tras `const now = new Date().toISOString();` y antes de `runScrape`, añadir un bloque aislado (un fallo aquí NO debe romper el scrape):

```ts
import { ensureBotApiKey } from "@/data-api/botKey";
import { logger } from "@/shared/logger";
// ...
try {
  const r = await ensureBotApiKey({ now });
  if (r.created) logger.info("API key interna del bot creada");
} catch (e) {
  logger.warn("no se pudo aprovisionar la API key del bot", {
    error: e instanceof Error ? e.message : String(e),
  });
}
```

- [ ] **Step 2: Test del bootstrap**

En `backend/src/scraper/__tests__/handler.test.ts` (o donde se testee el handler), añadir un caso con `ensureBotApiKey` mockeado que verifique que el handler sigue completando el scrape aunque el aprovisionamiento lance. (Si el handler no admite `deps` para esto, inyectar vía mock del módulo con `vi.mock("@/data-api/botKey", ...)`.)

Run: `npm test --workspace @venezuelahelp/backend -- scraper`
Expected: PASS.

- [ ] **Step 3: Permisos SSM en `infra/lib/scraper-stack.ts`**

Tras el `addToRolePolicy` de Bedrock (línea ~58), añadir:

```ts
fn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ssm:GetParameter", "ssm:PutParameter"],
    resources: [
      `arn:aws:ssm:${this.region}:${this.account}:parameter/venezuelahelp/bot/data-api-key`,
    ],
  }),
);
```

- [ ] **Step 4: Permiso SSM en `infra/lib/bot-stack.ts`**

Añadir el path de la key al `resources` del statement `ssm:GetParameter` existente (líneas 60–64):

```ts
resources: [
  `arn:aws:ssm:${this.region}:${this.account}:parameter/venezuelahelp/telegram-token`,
  `arn:aws:ssm:${this.region}:${this.account}:parameter/venezuelahelp/telegram-webhook-secret`,
  `arn:aws:ssm:${this.region}:${this.account}:parameter/venezuelahelp/bot/data-api-key`,
],
```

- [ ] **Step 5: Aserciones de infra**

En `infra/lib/__tests__/bot-stack.test.ts`, añadir/ajustar la aserción de la policy para incluir el ARN `…/venezuelahelp/bot/data-api-key`. En `scraper-stack.test.ts`, aserción de que existe una policy con `ssm:PutParameter` sobre ese ARN.

Run: `npm test --workspace @venezuelahelp/infra`
Expected: PASS.

- [ ] **Step 6: Synth de verificación (ambos frontends deben estar buildeados)**

Run: `npm run build --workspace @venezuelahelp/frontend-public --workspace @venezuelahelp/frontend-admin` y luego `cd infra && npx cdk synth --quiet`
Expected: synth sin errores (AdminStack exige `frontend-admin/dist`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/scraper infra/lib/scraper-stack.ts infra/lib/bot-stack.ts infra/lib/__tests__
git commit -m "✨ feat(infra): aprovisiona API key del bot en el scraper + permisos SSM

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Tests de paridad bot/API/frontend (red de seguridad de la coherencia)

**Files:**

- Create: `core/src/__tests__/parity.test.ts`

**Interfaces:**

- Consumes: `searchItems`, `retrieve` (core). (La API y el frontend delegan en estas; probar el núcleo cubre la coherencia.)

- [ ] **Step 1: Escribir el test de paridad**

```ts
import { describe, it, expect } from "vitest";
import { searchItems, retrieve } from "../index";
import type { Snapshot } from "../index";

const key = (i: { category: string; sourceId: string; externalId: string }) =>
  `${i.category}/${i.sourceId}#${i.externalId}`;

const snap: Snapshot = {
  generatedAt: "t",
  categories: {
    reportes: [
      {
        category: "reportes",
        sourceId: "x",
        externalId: "r1",
        titulo: "Agua en Petare",
        texto: "reparten agua",
      },
    ],
    acopios: [
      {
        category: "acopios",
        sourceId: "y",
        externalId: "a1",
        titulo: "Acopio Petare",
        texto: "agua",
      },
      {
        category: "acopios",
        sourceId: "y",
        externalId: "a2",
        titulo: "Acopio Chacao",
        texto: "comida",
      },
    ],
  },
};

describe("paridad bot ↔ API/frontend", () => {
  it("misma consulta → mismo conjunto de ítems (bot vs searchItems)", () => {
    const q = "agua petare";
    const bot = new Set(retrieve(q, snap, 200).map(key));
    const api = new Set(searchItems(snap, { q }).map(key));
    expect(api).toEqual(bot);
  });

  it("el conteo por categoría coincide entre superficies", () => {
    const cat = "acopios";
    const api = searchItems(snap, { category: cat }).length;
    const bot = retrieve(cat, snap, 200).filter(
      (i) => i.category === cat,
    ).length;
    expect(api).toBe(bot);
  });
});
```

> Nota: `retrieve` con `k=200` desactiva en la práctica el recorte top-k para comparar el conjunto completo; la cuota por categoría solo recorta cuando se supera `k`.

- [ ] **Step 2: Run test**

Run: `npm test --workspace @venezuelahelp/core -- parity`
Expected: PASS. Si falla, es una divergencia real del motor → corregir `search.ts` (no el test).

- [ ] **Step 3: Suite completa de los tres workspaces**

Run: `npm test --workspace @venezuelahelp/core && npm test --workspace @venezuelahelp/backend && npm test --workspace @venezuelahelp/frontend-public`
Expected: todo verde.

- [ ] **Step 4: Commit**

```bash
git add core/src/__tests__/parity.test.ts
git commit -m "✅ test(core): paridad bot ↔ API/frontend (coherencia del motor)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Deploy y smoke en prod

**Files:** ninguno (operación). El scraper genera el snapshot; el deploy publica bot/API/frontend.

- [ ] **Step 1: Build de ambos frontends (requisito de synth)**

Run: `npm run build --workspace @venezuelahelp/frontend-public --workspace @venezuelahelp/frontend-admin`
Expected: ambos `dist/` generados.

- [ ] **Step 2: Deploy de los stacks afectados**

Bot, Api y Frontend stacks cambian; Scraper cambia (bootstrap + IAM). Exportar credenciales SSO y desplegar (ver CLAUDE.md):

Run:

```bash
cd infra && eval "$(aws configure export-credentials --profile VenezuelaHelp --format env)" && \
CDK_DEFAULT_ACCOUNT=720115910277 CDK_DEFAULT_REGION=us-east-1 \
npx cdk deploy VenezuelaHelpScraperStack VenezuelaHelpBotStack VenezuelaHelpApiStack VenezuelaHelpFrontendStack --require-approval never
```

Expected: UPDATE_COMPLETE en los cuatro. (Confirmar los nombres exactos de stack con `npx cdk list`.)

- [ ] **Step 3: Forzar regeneración del snapshot y aprovisionar la key**

Run: `aws lambda invoke --function-name <ScraperFn> --invocation-type Event --profile VenezuelaHelp /dev/null`
Esperar ~1–2 min. Verificar en logs que aparece "API key interna del bot creada" (primera vez) y que el parámetro existe:
Run: `aws ssm get-parameter --name /venezuelahelp/bot/data-api-key --with-decryption --profile VenezuelaHelp --query 'Parameter.Name'`
Expected: devuelve el nombre (no `ParameterNotFound`).

- [ ] **Step 4: Smoke de coherencia API ↔ snapshot**

Obtener la key y consultar la API; comparar conteos con el snapshot:

```bash
KEY=$(aws ssm get-parameter --name /venezuelahelp/bot/data-api-key --with-decryption --profile VenezuelaHelp --query 'Parameter.Value' --output text)
curl -s -H "x-api-key: $KEY" "https://<apiDomain>/v1/categories"
curl -s "https://venezuelahelp.click/snapshot.json" -o /tmp/snap.gz && gunzip -c /tmp/snap.gz | python3 -c "import sys,json;d=json.load(sys.stdin);print({k:len(v) for k,v in d['categories'].items()})"
```

Expected: los conteos de `/v1/categories` coinciden con los del snapshot (mismo `generatedAt`, salvo desfase de caché ≤5 min).

- [ ] **Step 5: Smoke del bot**

En Telegram, preguntar "¿cuántos desaparecidos?" y verificar que el total coincide con `/v1/categories` y con el contador del frontend (venezuelahelp.click). Probar "agua en Petare" en bot y en el buscador del front → resultados coherentes.

- [ ] **Step 6: Verificación final**

Confirmar que el sitio público (venezuelahelp.click) carga, busca y pagina correctamente, y que las insignias "En N fuentes" siguen apareciendo.

---

## Self-Review (completado por el autor del plan)

- **Cobertura del spec:** §3 (workspace core) → Tasks 1–6; §4.1 bot → Task 7; §4.2 API → Task 8; §4.3 frontend → Task 9; §5 coherencia → Task 12; §6 testing → Tasks 2–6,8,9,12; §9 API key interna → Tasks 10–11; §10 fases → Tasks 1–13. Sin huecos.
- **Placeholders:** el único `null as never` en Task 7 Step 2 se elimina explícitamente en Step 3 (señalado).
- **Consistencia de tipos:** `searchItems(snap, SearchParams)`, `retrieve(question, snap, k)`, `filterUsable(items, opts)`, `ensureBotApiKey(deps)`, `getDataApiKey(deps?)`, `countItems(snap, {category,zona})`, `listItems(snap, {category,zona,limite})` usados con la misma firma en todas las tareas.
