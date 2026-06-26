# VenezuelaHelp — Fase 4: Frontend Público (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Visual tasks must follow `frontend-public/DESIGN.md` exactly and verify in a browser (screenshot).

**Goal:** Un sitio público estático (Vite + React + TS) que lee el `snapshot.json` y muestra la info del terremoto: hero con CTA al bot de Telegram, búsqueda + filtros por categoría, lista de ítems y mapa Leaflet; desplegado en S3 + CloudFront (OAC), con el snapshot servido por la misma distribución.

**Architecture:** SPA estática. Datos de un solo `snapshot.json` (servido por CloudFront desde el bucket privado de DataStack vía un comportamiento `/snapshot.json` con OAC). Estado de UI en React (query + categorías activas). Despliegue: build → S3 (BucketDeployment) → CloudFront.

**Tech Stack:** Vite, React 18, TypeScript, Vitest + @testing-library/react + jsdom, Leaflet + react-leaflet, @fontsource/inter (self-hosted), CSS Modules. Infra: CDK S3 + CloudFront (OAC) + BucketDeployment.

## Global Constraints

- TypeScript strict. Sigue `frontend-public/DESIGN.md` (tokens OKLCH, contraste AA, bans de AI-slop) y `frontend-public/PRODUCT.md`. Mobile-first.
- Texto de terceros se renderiza como texto (React escapa por defecto) — nunca `dangerouslySetInnerHTML`.
- CTA del bot: `https://t.me/VenezuelaHelpInfoBot`.
- Datos: `import.meta.env.VITE_SNAPSHOT_URL ?? "/snapshot.json"`. En dev hay un `public/snapshot.json` de muestra.
- Conventional Commits con emoji; rama `feat/fase4-frontend-publico` (ya creada).
- Accesibilidad: foco visible, navegable por teclado, `prefers-reduced-motion`.
- NO modificar backend/infra de fases previas salvo lo que este plan indique (añadir FrontendStack).

## File Structure

```
frontend-public/
├── index.html
├── package.json  vite.config.ts  tsconfig.json  vitest.config.ts
├── public/snapshot.json            # muestra para dev
├── src/
│   ├── main.tsx  App.tsx  App.module.css
│   ├── styles/tokens.css           # de DESIGN.md
│   ├── types.ts                    # Snapshot, Item, Category
│   ├── data/useSnapshot.ts         # hook fetch
│   ├── data/filter.ts              # flatten + filterItems + normalize
│   ├── data/categories.ts          # metadata (label, color, orden)
│   └── components/
│       ├── Header.tsx  Hero.tsx  Badge.tsx
│       ├── SummaryBar.tsx  FilterBar.tsx
│       ├── ItemList.tsx  States.tsx  MapView.tsx
│       └── *.module.css
│   └── __tests__/...
infra/lib/frontend-stack.ts          # S3 + CloudFront OAC + snapshot behavior + deploy
infra/bin/app.ts                     # (modificar)
```

---

### Task 1: Scaffold Vite + React + TS + tokens + fuente

**Files:** `frontend-public/{package.json,vite.config.ts,tsconfig.json,vitest.config.ts,index.html}`, `src/{main.tsx,App.tsx}`, `src/styles/tokens.css`, `src/__tests__/smoke.test.tsx`. Root `package.json` (añadir al workspaces).

**Produces:** app que arranca (`vite`) y `vitest` corre un smoke test (render de App con RTL).

- [ ] **Step 1: `frontend-public/package.json`**

```json
{
  "name": "@venezuelahelp/frontend-public",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1",
    "@fontsource/inter": "^5.0.0"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: configs** — `vite.config.ts` (plugin react + vitest config jsdom + setup file), `tsconfig.json` (strict, jsx react-jsx, paths `@/`→src), `vitest.config.ts` o test block en vite config. Setup file `src/test-setup.ts` con `import "@testing-library/jest-dom"`.

```ts
// vite.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

`tsconfig.json`: extends ../tsconfig.base.json; compilerOptions `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, `module: "ESNext"`, `noEmit: true`, `baseUrl: "src"`, `paths: {"@/*":["*"]}`, `lib: ["ES2022","DOM","DOM.Iterable"]`, `types: ["vitest/globals","@testing-library/jest-dom"]`.

- [ ] **Step 3: `index.html`** con `<div id="root">` y `<script type="module" src="/src/main.tsx">`. Lang `es`. Meta viewport. Título "VenezuelaHelp — Información del terremoto".

- [ ] **Step 4: `src/styles/tokens.css`** — copia los tokens `:root{...}` de `frontend-public/DESIGN.md` (variables OKLCH), más reset básico (box-sizing, body font `--font-sans`, color `--ink`, bg `--bg`, `text-rendering`, `-webkit-font-smoothing`) e import de `@fontsource/inter` (400/600/700/800) en `main.tsx`.

- [ ] **Step 5: `main.tsx` + `App.tsx`** — `main.tsx` importa `@fontsource/inter/400.css` (y 600/700/800), `./styles/tokens.css`, monta `<App/>`. `App.tsx` provisional: `<main>VenezuelaHelp</main>`.

- [ ] **Step 6: smoke test** `src/__tests__/smoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "@/App";
it("renders", () => {
  render(<App />);
  expect(screen.getByText(/VenezuelaHelp/i)).toBeInTheDocument();
});
```

- [ ] **Step 7:** `npm install` en raíz; `npm test --workspace @venezuelahelp/frontend-public` → PASS.

- [ ] **Step 8: Commit** `🏗️ chore(frontend-public): scaffold Vite + React + TS with design tokens`.

---

### Task 2: Tipos + hook `useSnapshot`

**Files:** `src/types.ts`, `src/data/useSnapshot.ts`, `src/data/__tests__/useSnapshot.test.tsx`, `public/snapshot.json` (muestra con 1-2 ítems por categoría).

**Produces:**

- `types.ts`: `Category` (union de las 5), `Item` (`category, sourceId, externalId, titulo, texto, ubicacion?:{lat,lng,nombre?}, status?`), `Snapshot` (`generatedAt, categories: Record<Category, Item[]>`).
- `useSnapshot(): { data: Snapshot | null; loading: boolean; error: string | null }` — fetch del URL configurable, parsea, maneja error.

- [ ] **Step 1: test que falla** (mock `global.fetch`): loading→data; y caso error (fetch rejects → error set, loading false). Usa `@testing-library/react` `renderHook` o un componente de prueba con `waitFor`.

- [ ] **Step 2:** correr → FAIL.

- [ ] **Step 3: implementar** `types.ts` y `useSnapshot.ts`:

```ts
import { useEffect, useState } from "react";
import type { Snapshot } from "@/types";
const URL = import.meta.env.VITE_SNAPSHOT_URL ?? "/snapshot.json";
export function useSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: Snapshot) => {
        if (alive) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "error");
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  return { data, loading, error };
}
```

- [ ] **Step 4:** correr → PASS. **Step 5: Commit** `✨ feat(frontend-public): add Snapshot types and useSnapshot hook`.

---

### Task 3: Lógica de filtrado + categorías

**Files:** `src/data/filter.ts`, `src/data/categories.ts`, `src/data/__tests__/filter.test.ts`.

**Produces:**

- `categories.ts`: `CATEGORY_META: Record<Category, { label: string; colorVar: string; order: number }>` (label es-VE: "Reportes", "Desaparecidos", "Acopios", "Edificios dañados", "Solicitudes"; colorVar = `--cat-*`). `CATEGORY_ORDER: Category[]`.
- `filter.ts`: `normalize(s)` (lowercase + sin acentos), `flatten(snap): Item[]`, `filterItems(items, query, active: Set<Category>): Item[]` (match substring normalizado en titulo+texto+ubicacion.nombre; si `active` no vacío, filtra por categoría), `countByCategory(items): Record<Category, number>`.

- [ ] **Step 1: test que falla** — flatten cuenta todos; filterItems por query y por categoría; countByCategory correcto; normalize quita acentos. (Funciones puras, fáciles de testear.)
- [ ] **Step 2:** FAIL. **Step 3:** implementar (reusa el patrón `normalize` de Fase 3: NFD + strip combining marks). **Step 4:** PASS. **Step 5: Commit** `✨ feat(frontend-public): add filtering logic and category metadata`.

---

### Task 4: Componentes de presentación (Badge, Header, Hero)

**Files:** `src/components/{Badge,Header,Hero}.tsx` + `.module.css`, `src/components/__tests__/presentational.test.tsx`.

**Sigue DESIGN.md.** Produces:

- `Badge({category})`: pill con el color de categoría (texto del color sobre tinte del mismo hue), label de `CATEGORY_META`.
- `Header()`: sticky; wordmark "VenezuelaHelp" + botón primario "Preguntar por Telegram" (`<a href="https://t.me/VenezuelaHelpInfoBot">`, `target="_blank" rel="noopener"`).
- `Hero({generatedAt})`: h1, 1-2 frases (qué es + cómo usar el bot), CTA grande a Telegram, línea "Datos actualizados: <fecha formateada es-VE>". Sin hero-metric template.

- [ ] **Step 1: test que falla** — Header tiene el link al bot (`getByRole("link", {name:/telegram/i})` con href correcto); Hero muestra la fecha formateada; Badge muestra el label de la categoría.
- [ ] **Step 2:** FAIL. **Step 3:** implementar componentes + CSS Modules siguiendo tokens de DESIGN.md (radios ≤12px, sin bans). **Step 4:** PASS. **Step 5: Commit** `✨ feat(frontend-public): add Badge, Header and Hero`.

---

### Task 5: Filtro + resumen (FilterBar, SummaryBar)

**Files:** `src/components/{FilterBar,SummaryBar}.tsx` + css, tests.

**Produces:**

- `SummaryBar({counts, active, onToggle})`: barra compacta con conteo por categoría (no tarjetas gigantes); cada entrada es un toggle de filtro; refleja `active`.
- `FilterBar({query, onQuery, active, onToggle})`: input búsqueda (placeholder con contraste, `aria-label`) + chips de categoría toggle. Chip activo = `--primary-tint`/borde `--primary`.

- [ ] **Step 1: test que falla** — escribir en el input llama `onQuery`; click en chip llama `onToggle(category)`; chip activo tiene estado visual/aria-pressed. Usa `user-event`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `✨ feat(frontend-public): add SummaryBar and FilterBar`.

---

### Task 6: Lista + estados (ItemList, States)

**Files:** `src/components/{ItemList,States}.tsx` + css, tests.

**Produces:**

- `ItemList({items})`: **filas** (no grilla de cards idénticas). Cada fila: Badge de categoría, título (`titulo`), texto breve (`texto`, recortado), ubicación (`ubicacion.nombre`), fuente (`sourceId`). Keyed por `category+sourceId+externalId`. Stagger de entrada sutil (respeta reduced-motion).
- `States`: `Loading()` (skeleton sobrio de filas), `Empty({query})` ("No hay resultados para «query»…"), `ErrorState({onRetry})` ("No pudimos cargar los datos." + botón "Reintentar").

- [ ] **Step 1: test que falla** — ItemList renderiza N filas con sus títulos; Empty muestra el query; ErrorState llama `onRetry` al click. **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `✨ feat(frontend-public): add ItemList and loading/empty/error states`.

---

### Task 7: Mapa (Leaflet)

**Files:** `src/components/MapView.tsx` + css, `src/components/__tests__/mapview.test.tsx`.

**Produces:** `MapView({items})` — `react-leaflet` `MapContainer` centrado en Venezuela (≈ lat 10.5, lng -66.9, zoom 7), `TileLayer` de OpenStreetMap (con `attribution`), un `CircleMarker` por ítem con `ubicacion`, color por categoría (token), `Popup` con título/ubicación/fuente. Import de `leaflet/dist/leaflet.css` en el módulo o main.

- [ ] **Step 1: test (render smoke)** — Leaflet usa APIs del DOM que jsdom no implementa del todo; el test debe mockear `react-leaflet` (`vi.mock`) y verificar que `MapView` mapea solo los ítems con `ubicacion` a marcadores (assert sobre el mock), evitando montar Leaflet real en jsdom. **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `✨ feat(frontend-public): add Leaflet map view`.

---

### Task 8: Composición `App` + verificación visual

**Files:** `src/App.tsx` (+ `App.module.css`), `src/__tests__/app.test.tsx` (reemplaza el smoke).

**Produces:** `App` que: usa `useSnapshot`; estado `query` + `active:Set<Category>`; `flatten`→`filterItems`; arma `Header`, `Hero`, `SummaryBar`, `FilterBar`, `MapView`, `ItemList`; muestra `Loading`/`ErrorState`/`Empty` según corresponda. Layout mobile-first (lista primero, mapa secundario en móvil) per DESIGN.md.

- [ ] **Step 1: test de integración** — con `useSnapshot` mockeado devolviendo un snapshot: aparecen ítems; escribir en la búsqueda filtra (desaparece un ítem no coincidente); toggle de categoría filtra. Con loading→muestra skeleton; con error→ErrorState.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (+ suite completa del workspace verde).
- [ ] **Step 5: Verificación visual** — `npm run build` y `npm run preview`; con el skill `agent-browser` (o screenshot), abrir el preview en móvil (375px) y desktop (1280px): verificar contra DESIGN.md — contraste legible, CTA visible, filtros funcionan, mapa carga, sin overflow de texto, estados ok. Ajustar CSS hasta que cumpla. Adjunta/nota los screenshots en el reporte.
- [ ] **Step 6: Commit** `✨ feat(frontend-public): compose App with data, filters, map and list`.

---

### Task 9: Infra `FrontendStack` (S3 + CloudFront OAC)

**Files:** `infra/lib/frontend-stack.ts`, `infra/lib/__tests__/frontend-stack.test.ts`, `infra/bin/app.ts` (modificar).

**Produces:** `FrontendStack` con:

- bucket de sitio privado (BLOCK_ALL, autoDeleteObjects falso, RETAIN).
- `cloudfront.Distribution`: default behavior → `S3BucketOrigin.withOriginAccessControl(siteBucket)` (SPA: `defaultRootObject: "index.html"`, errorResponses 403/404 → `/index.html` 200), comportamiento adicional `snapshot.json` → `S3BucketOrigin.withOriginAccessControl(props.snapshotBucket)` (cachePolicy corto).
- `BucketDeployment` que sube `../frontend-public/dist` al site bucket y invalida la distribución.
- `CfnOutput` con el dominio de CloudFront.
- `bin/app.ts`: instanciar `FrontendStack` con `snapshotBucket` de DataStack.

- [ ] **Step 1: test que falla** — assert: 1 `AWS::CloudFront::Distribution`; al menos 1 `AWS::S3::Bucket` nuevo; un `Custom::CDKBucketDeployment`; la distribución tiene un CacheBehavior con PathPattern `snapshot.json`. (Usa `Match`.)
- [ ] **Step 2:** correr `npm test --workspace @venezuelahelp/infra -- frontend` → FAIL. (Nota: `BucketDeployment` requiere que exista `../frontend-public/dist`; para que el test sintetice, crea un `dist` placeholder o usa `Source.data`/`Source.asset` apuntando a un dir que exista. Si el test falla por dist inexistente, haz `npm run build --workspace @venezuelahelp/frontend-public` antes, o en el test usa un asset a un dir temporal. Documenta la elección.)
- [ ] **Step 3:** implementar `frontend-stack.ts` + `bin/app.ts`. Usa `import * as cloudfront from "aws-cdk-lib/aws-cloudfront"` y `aws-cloudfront-origins`.
- [ ] **Step 4:** PASS. **Step 5:** `npm test` (ambos workspaces) verde. **Step 6: Commit** `🏗️ feat(infra): add FrontendStack (S3 + CloudFront OAC + snapshot behavior)`.

---

### Task 10: Build + deploy + smoke

- [ ] **Step 1:** `npm test` (todo) + `npm run build` (todos los workspaces) verde.
- [ ] **Step 2: build del front** `npm run build --workspace @venezuelahelp/frontend-public` (genera `frontend-public/dist`).
- [ ] **Step 3: synth** `cd infra && CDK_DEFAULT_ACCOUNT=720115910277 CDK_DEFAULT_REGION=us-east-1 npx cdk synth --profile VenezuelaHelp` (4 stacks).
- [ ] **Step 4: deploy** (creds exportadas por el problema SSO del SDK de CDK):

```bash
cd infra
eval "$(aws configure export-credentials --profile VenezuelaHelp --format env)"
CDK_DEFAULT_ACCOUNT=720115910277 CDK_DEFAULT_REGION=us-east-1 npx cdk deploy VenezuelaHelpFrontendStack --require-approval never
```

Anota el dominio de CloudFront del output.

- [ ] **Step 5: smoke** — `curl -sI https://<dominio>/` → 200 y `content-type: text/html`; `curl -s https://<dominio>/snapshot.json | head -c 200` → JSON del snapshot. Abrir en navegador y verificar que carga datos reales del scraper.
- [ ] **Step 6: Commit** `✅ test(fase4): green suite for public frontend`.

---

## Self-Review

- **Cobertura spec §9:** vista agregada + embudo al bot (Tasks 4,8) ✓; listado buscable/filtrable (Tasks 3,5,6,8) ✓; mapa (Task 7) ✓; snapshot servido por CloudFront, bucket no público (Task 9) ✓; mobile-first + diseño institucional (DESIGN.md, Task 8 verificación visual) ✓.
- **Placeholders:** lógica/datos/infra con código completo (TDD); componentes con contrato claro + DESIGN.md como fuente de estilos + verificación visual. La única "elección" abierta es el manejo de `dist` en el test de infra (Task 9 Step 2), documentada.
- **Consistencia:** `Item`/`Snapshot`/`Category` (Task 2) consumidos por 3–8; `CATEGORY_META` (Task 3) por 4–8; `filterItems`/`flatten` (Task 3) por 8.
- **Fuera de alcance:** admin (Fase 5); fast-follows de Fase 3; i18n (solo es-VE).
- **Dependencia operativa:** ninguna nueva del usuario (no requiere Bedrock ni token). El front muestra lo que el scraper ya genera.
