# Rediseño «Fuentes monitoreadas» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la sección "Fuentes monitoreadas" del frontend público como un grid de tarjetas compactas que muestran favicon, nombre, URL completa, chips de categoría y conteo por fuente.

**Architecture:** 100% frontend. Se extiende `sourcesForDisplay()` (client-side) para incluir las categorías por fuente, se crea un componente `SourceGrid` que renderiza las tarjetas, y el `Footer` delega su lista en ese componente. No se toca snapshot/backend.

**Tech Stack:** React + TypeScript, CSS Modules, vitest + @testing-library/react, tokens `oklch` en `styles/tokens.css`, iconos `@phosphor-icons/react`.

## Global Constraints

- Solo se modifica `frontend-public/`. Sin cambios en snapshot, backend ni scraper.
- TypeScript strict; imports con alias `@/` → `frontend-public/src`.
- Favicon vía `https://www.google.com/s2/favicons?domain=<dominio>&sz=64` (decisión aprobada).
- Categorías válidas (`Category`): `reportes | desaparecidos | acopios | edificios | hospitales | solicitudes`.
- Formato de números con `Intl.NumberFormat("es")` (separador de miles = punto).
- Lista acotada (~11 tarjetas), sin scroll infinito.
- Deploy: solo `FrontendStack` (build de `frontend-public`, GHA al mergear a `main`).

---

### Task 1: Extender `sourcesForDisplay` con las categorías por fuente

**Files:**

- Modify: `frontend-public/src/data/filter.ts:68-79`
- Test: `frontend-public/src/data/__tests__/filter.test.ts:389-431`

**Interfaces:**

- Produces: `sourcesForDisplay(sourceIds: string[], items: Item[]): { sourceId: string; count: number; cats: Category[] }[]` — `cats` son las categorías con ≥1 ítem de esa fuente, ordenadas por cantidad descendente. Orden global de fuentes: por `count` desc (sin cambio).

- [ ] **Step 1: Actualizar los tests existentes y añadir el de `cats`**

En `frontend-public/src/data/__tests__/filter.test.ts`, reemplazar el bloque `describe("sourcesForDisplay", …)` (líneas 389-431) por:

```ts
describe("sourcesForDisplay", () => {
  const items: Item[] = [
    {
      category: "reportes",
      sourceId: "a",
      externalId: "1",
      titulo: "t",
      texto: "x",
    },
    {
      category: "reportes",
      sourceId: "a",
      externalId: "2",
      titulo: "t",
      texto: "x",
    },
    {
      category: "acopios",
      sourceId: "a",
      externalId: "3",
      titulo: "t",
      texto: "x",
    },
    {
      category: "reportes",
      sourceId: "b",
      externalId: "4",
      titulo: "t",
      texto: "x",
    },
  ];

  it("lists every configured source, sorted by item count descending", () => {
    const result = sourcesForDisplay(["b", "a"], items);
    expect(result).toEqual([
      { sourceId: "a", count: 3, cats: ["reportes", "acopios"] },
      { sourceId: "b", count: 1, cats: ["reportes"] },
    ]);
  });

  it("orders cats by frequency descending", () => {
    // 'a' tiene 2 reportes y 1 acopio → reportes primero.
    const [a] = sourcesForDisplay(["a"], items);
    expect(a.cats).toEqual(["reportes", "acopios"]);
  });

  it("includes configured sources with no items (count 0, empty cats)", () => {
    const result = sourcesForDisplay(["a", "vacia"], items);
    expect(result).toContainEqual({ sourceId: "vacia", count: 0, cats: [] });
  });

  it("ignores sourceIds present in items but absent from the directory", () => {
    const result = sourcesForDisplay(["a"], items);
    expect(result.map((s) => s.sourceId)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

Run: `npm test --workspace @venezuelahelp/frontend-public -- filter`
Expected: FAIL — el resultado actual no trae `cats` (`toEqual` no matchea).

- [ ] **Step 3: Implementar `cats` en `sourcesForDisplay`**

En `frontend-public/src/data/filter.ts`, reemplazar la función (líneas 68-79) por:

```ts
export function sourcesForDisplay(
  sourceIds: string[],
  items: Item[],
): { sourceId: string; count: number; cats: Category[] }[] {
  const stats = new Map<
    string,
    { count: number; catCounts: Map<Category, number> }
  >();
  for (const item of items) {
    let s = stats.get(item.sourceId);
    if (!s) {
      s = { count: 0, catCounts: new Map() };
      stats.set(item.sourceId, s);
    }
    s.count += 1;
    s.catCounts.set(item.category, (s.catCounts.get(item.category) ?? 0) + 1);
  }
  return sourceIds
    .map((sourceId) => {
      const s = stats.get(sourceId);
      const cats = s
        ? [...s.catCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
        : [];
      return { sourceId, count: s?.count ?? 0, cats };
    })
    .sort((a, b) => b.count - a.count);
}
```

Verificar que `Category` esté importado en `filter.ts` (ya se usa en `countByCategory`; si no, añadir `import type { Category, Item } from "@/types";`).

- [ ] **Step 4: Correr el test y verificar que PASA**

Run: `npm test --workspace @venezuelahelp/frontend-public -- filter`
Expected: PASS (todos los tests de `filter`).

- [ ] **Step 5: Commit**

```bash
git add frontend-public/src/data/filter.ts frontend-public/src/data/__tests__/filter.test.ts
git commit -m "✨ feat(frontend-public): sourcesForDisplay expone categorías por fuente"
```

---

### Task 2: Componente `SourceGrid` (tarjetas de fuentes)

**Files:**

- Create: `frontend-public/src/components/SourceGrid.tsx`
- Create: `frontend-public/src/components/SourceGrid.module.css`
- Test: `frontend-public/src/components/__tests__/sourceGrid.test.tsx`

**Interfaces:**

- Consumes: `sourcesForDisplay(...)` return (`{ sourceId, count, cats }[]`); `useResolveSource()` de `@/data/sources` (`(sourceId) => { nombre: string; url?: string }`).
- Produces: `export default function SourceGrid({ sources }: { sources: { sourceId: string; count: number; cats: Category[] }[] })`.

- [ ] **Step 1: Escribir el test del componente**

Crear `frontend-public/src/components/__tests__/sourceGrid.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SourceGrid from "@/components/SourceGrid";
import { SourcesContext } from "@/data/sources";
import type { SourceInfo } from "@/types";

const dir: Record<string, SourceInfo> = {
  a: { nombre: "Fuente A", url: "https://fuentea.com/" },
  b: { nombre: "Fuente B", url: "https://fuenteb.org/" },
};

function renderGrid(
  sources: {
    sourceId: string;
    count: number;
    cats: import("@/types").Category[];
  }[],
) {
  return render(
    <SourcesContext.Provider value={dir}>
      <SourceGrid sources={sources} />
    </SourcesContext.Provider>,
  );
}

describe("SourceGrid", () => {
  it("renders a linked card per source with the full URL and formatted count", () => {
    renderGrid([{ sourceId: "a", count: 1234, cats: ["reportes"] }]);
    const link = screen.getByRole("link", { name: /Fuente A/ });
    expect(link).toHaveAttribute("href", "https://fuentea.com/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("https://fuentea.com/")).toBeInTheDocument();
    expect(screen.getByText("1.234")).toBeInTheDocument();
  });

  it("uses the google favicon service with the source domain", () => {
    const { container } = renderGrid([{ sourceId: "a", count: 1, cats: [] }]);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain(
      "google.com/s2/favicons?domain=fuentea.com",
    );
    expect(img).toHaveAttribute("alt", "");
  });

  it("shows up to 3 category chips and +N for the rest", () => {
    renderGrid([
      {
        sourceId: "a",
        count: 5,
        cats: [
          "desaparecidos",
          "edificios",
          "acopios",
          "reportes",
          "solicitudes",
        ],
      },
    ]);
    expect(screen.getByText("Desaparecidos")).toBeInTheDocument();
    expect(screen.getByText("Edificios")).toBeInTheDocument();
    expect(screen.getByText("Acopios")).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText("Reportes")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

Run: `npm test --workspace @venezuelahelp/frontend-public -- sourceGrid`
Expected: FAIL — `SourceGrid` no existe.

- [ ] **Step 3: Implementar `SourceGrid.tsx`**

Crear `frontend-public/src/components/SourceGrid.tsx`:

```tsx
import { ArrowUpRight } from "@phosphor-icons/react";
import { useResolveSource } from "@/data/sources";
import type { Category } from "@/types";
import styles from "./SourceGrid.module.css";

const CAT_LABEL: Record<Category, string> = {
  reportes: "Reportes",
  desaparecidos: "Desaparecidos",
  acopios: "Acopios",
  edificios: "Edificios",
  hospitales: "Hospitales",
  solicitudes: "Solicitudes",
};

const nf = new Intl.NumberFormat("es");

function domainOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

interface SourceGridProps {
  sources: { sourceId: string; count: number; cats: Category[] }[];
}

function Chips({ cats }: { cats: Category[] }) {
  const shown = cats.slice(0, 3);
  const extra = cats.length - shown.length;
  return (
    <div className={styles.chips}>
      {shown.map((c) => (
        <span key={c} className={styles.chip} data-cat={c}>
          {CAT_LABEL[c]}
        </span>
      ))}
      {extra > 0 && (
        <span className={`${styles.chip} ${styles.more}`}>+{extra}</span>
      )}
    </div>
  );
}

export default function SourceGrid({ sources }: SourceGridProps) {
  const resolve = useResolveSource();
  return (
    <ul className={styles.grid} role="list">
      {sources.map(({ sourceId, count, cats }) => {
        const src = resolve(sourceId);
        const formatted = nf.format(count);
        return (
          <li key={sourceId}>
            {src.url ? (
              <a
                className={styles.card}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className={styles.head}>
                  <img
                    className={styles.favicon}
                    alt=""
                    loading="lazy"
                    src={`https://www.google.com/s2/favicons?domain=${domainOf(src.url)}&sz=64`}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className={styles.name}>{src.nombre}</span>
                  <span
                    className={styles.count}
                    aria-label={`${count} registros`}
                  >
                    {formatted}
                  </span>
                </div>
                <span className={styles.url}>
                  <ArrowUpRight aria-hidden="true" size={13} weight="bold" />
                  {src.url}
                </span>
                {cats.length > 0 && <Chips cats={cats} />}
              </a>
            ) : (
              <div className={styles.card}>
                <div className={styles.head}>
                  <span className={styles.name}>{src.nombre}</span>
                  <span
                    className={styles.count}
                    aria-label={`${count} registros`}
                  >
                    {formatted}
                  </span>
                </div>
                {cats.length > 0 && <Chips cats={cats} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Implementar `SourceGrid.module.css`**

Crear `frontend-public/src/components/SourceGrid.module.css`:

```css
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 10px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 13px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  text-decoration: none;
  color: inherit;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}
a.card:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow-md, 0 8px 24px oklch(0.2 0.02 255 / 0.12));
  transform: translateY(-2px);
}

.head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.favicon {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  flex: none;
  background: var(--surface-2);
  border: 1px solid var(--border);
  object-fit: cover;
}
.name {
  font-weight: 700;
  color: var(--ink-strong);
  font-size: 14.5px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  flex: none;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 8px;
}

.url {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--primary-strong);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
a.card:hover .url {
  text-decoration: underline;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  font-size: 10.5px;
  font-weight: 650;
  padding: 2px 7px;
  border-radius: 999px;
  line-height: 1.4;
  white-space: nowrap;
}
.chip[data-cat="reportes"] {
  color: var(--cat-reportes);
  background: color-mix(in oklab, var(--cat-reportes) 12%, white);
}
.chip[data-cat="desaparecidos"] {
  color: var(--cat-desaparecidos);
  background: color-mix(in oklab, var(--cat-desaparecidos) 12%, white);
}
.chip[data-cat="acopios"] {
  color: var(--cat-acopios);
  background: color-mix(in oklab, var(--cat-acopios) 12%, white);
}
.chip[data-cat="edificios"] {
  color: var(--cat-edificios);
  background: color-mix(in oklab, var(--cat-edificios) 12%, white);
}
.chip[data-cat="solicitudes"] {
  color: var(--cat-solicitudes);
  background: color-mix(in oklab, var(--cat-solicitudes) 12%, white);
}
.chip[data-cat="hospitales"] {
  color: var(--cat-hospitales);
  background: color-mix(in oklab, var(--cat-hospitales) 12%, white);
}
.more {
  color: var(--muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
}
```

- [ ] **Step 5: Correr el test y verificar que PASA**

Run: `npm test --workspace @venezuelahelp/frontend-public -- sourceGrid`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend-public/src/components/SourceGrid.tsx frontend-public/src/components/SourceGrid.module.css frontend-public/src/components/__tests__/sourceGrid.test.tsx
git commit -m "✨ feat(frontend-public): componente SourceGrid (tarjetas de fuentes)"
```

---

### Task 3: Integrar `SourceGrid` en el `Footer` + subtítulo del intervalo

**Files:**

- Modify: `frontend-public/src/components/Footer.tsx:14-57` (prop type + reemplazo del `<ul>` + subtítulo)
- Test: `frontend-public/src/components/__tests__/footer.test.tsx` (crear)

**Interfaces:**

- Consumes: `SourceGrid` (Task 2), `sourcesForDisplay(...)` return con `cats` (Task 1). `App.tsx` ya pasa `sources={displaySources}` (que ahora incluye `cats`), no requiere cambios.

- [ ] **Step 1: Escribir el test del Footer**

Crear `frontend-public/src/components/__tests__/footer.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "@/components/Footer";
import { SourcesContext } from "@/data/sources";
import type { SourceInfo } from "@/types";

const dir: Record<string, SourceInfo> = {
  a: { nombre: "Fuente A", url: "https://fuentea.com/" },
};

describe("Footer", () => {
  it("muestra el intervalo de centralización y delega la lista en SourceGrid", () => {
    render(
      <SourcesContext.Provider value={dir}>
        <Footer
          sources={[{ sourceId: "a", count: 10, cats: ["reportes"] }]}
          generatedAt="2026-07-01T01:17:46.000Z"
        />
      </SourcesContext.Provider>,
    );
    expect(screen.getByText(/cada ~30 min/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Fuente A/ });
    expect(link).toHaveAttribute("href", "https://fuentea.com/");
    expect(screen.getByText("https://fuentea.com/")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que FALLA**

Run: `npm test --workspace @venezuelahelp/frontend-public -- footer`
Expected: FAIL — el subtítulo actual no dice "cada ~30 min" y la URL completa no se renderiza (hoy el Footer muestra el nombre, no la URL).

- [ ] **Step 3: Actualizar `Footer.tsx`**

En `frontend-public/src/components/Footer.tsx`:

1. Añadir el import (junto a los demás de `@/components`):

```tsx
import SourceGrid from "@/components/SourceGrid";
import type { Category } from "@/types";
```

2. Actualizar el tipo de props (líneas 14-17):

```tsx
interface FooterProps {
  sources: { sourceId: string; count: number; cats: Category[] }[];
  generatedAt?: string;
}
```

3. Quitar `import { useResolveSource } from "@/data/sources";` y la línea `const resolve = useResolveSource();` (ya no se usan aquí; los usa `SourceGrid`). También quitar `ArrowUpRight` del import de `@phosphor-icons/react` (solo se usaba en la lista que se elimina), dejando: `import { WhatsappLogo, EnvelopeSimple } from "@phosphor-icons/react";`.
4. Reemplazar el bloque del subtítulo + `<ul className={styles.list}>…</ul>` (líneas 26-57) por:

```tsx
        <p className={styles.sub}>
          La información se centraliza <strong>cada ~30 min</strong> desde estas{" "}
          {sources.length} páginas públicas de terceros:
        </p>

        <SourceGrid sources={sources} />
```

- [ ] **Step 4: Correr el test y verificar que PASA**

Run: `npm test --workspace @venezuelahelp/frontend-public -- footer`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite del público + typecheck**

Run: `npm test --workspace @venezuelahelp/frontend-public && npm run build --workspace @venezuelahelp/frontend-public`
Expected: todos los tests verdes y el build (`tsc -b && vite build`) sin errores. Si el linter marca `styles.list`/`styles.name` sin usar en `Footer.module.css`, es inocuo (CSS muerto); opcionalmente borrar esas reglas de `Footer.module.css`.

- [ ] **Step 6: Commit**

```bash
git add frontend-public/src/components/Footer.tsx frontend-public/src/components/__tests__/footer.test.tsx
git commit -m "✨ feat(frontend-public): Fuentes monitoreadas usa SourceGrid + intervalo de centralización"
```

---

## Verificación final (manual, antes de PR)

- [ ] `npm run build --workspace @venezuelahelp/frontend-public` y abrir `frontend-public/dist` (o `vite preview` desde el workspace) → la sección "Fuentes monitoreadas" muestra el grid de tarjetas con favicon, URL completa, chips y conteo; hover levanta la tarjeta; click abre el sitio en nueva pestaña.
- [ ] Responsive: en móvil el grid colapsa a una columna (por `minmax(270px, 1fr)`).

## Notas de deploy

- Al mergear a `main`, GHA hace `npm run build` (incluye `frontend-public`) y `cdk deploy --all`; el `FrontendStack` publica `frontend-public/dist`. No requiere regenerar el snapshot.
