# Rediseño de la sección «Fuentes monitoreadas» (frontend público)

**Fecha:** 2026-07-01
**Estado:** aprobado (diseño), pendiente de plan de implementación
**Alcance:** solo `frontend-public`. Sin cambios en backend, snapshot, scraper ni infra (más allá del deploy del `FrontendStack`).

## Motivación

Un visitante que quiere ver **de dónde sale la información** (transparencia de las
fuentes que se centralizan cada ~30 min) hoy encuentra, en el pie de página, una
lista compacta bajo "Fuentes monitoreadas" donde cada fuente aparece como el
**nombre** enlazado a su sitio. No se ve la **URL/dominio** real y el tratamiento
visual es el de una lista de footer, poco vistoso.

Objetivo: rediseñar esa misma sección para que muestre, de forma clara y "bonita",
las ~11 fuentes con su **URL completa visible**, un **favicon**, las **categorías**
que aporta cada una y su **conteo de registros**, dejando explícito que la data se
**centraliza cada ~30 min**.

## Estado actual

- `frontend-public/src/components/Footer.tsx` — sección `<footer id="fuentes">` con
  título "Fuentes monitoreadas". Recibe `sources: { sourceId: string; count: number }[]`
  y `generatedAt`. Por cada fuente resuelve `{nombre, url}` vía `useResolveSource()`
  y renderiza el **nombre** como enlace (`<a href={src.url} target="_blank">`) + un
  conteo. También contiene: bloque de contacto, enlace al API y disclaimer.
- `frontend-public/src/data/filter.ts` — `sourcesForDisplay(sourceIds, items)`
  devuelve `{ sourceId, count }[]` ordenado por `count` desc, contando los ítems ya
  cargados en el cliente. `App.tsx` lo llama con `Object.keys(data.sources)` y los
  ítems aplanados (`flatten(data)`), y pasa el resultado al `Footer`.
- `snapshot.sources` es un mapa `id → { nombre, url }` (solo esos 2 campos). Los
  conteos y categorías **se derivan en el cliente** de los ítems, no vienen en el
  snapshot.
- Tokens de diseño en `frontend-public/src/styles/tokens.css` (paleta `oklch`,
  incluye `--cat-<categoría>` por cada categoría).

## Diseño

### Capa de datos (client-side, sin tocar el snapshot)

Extender `sourcesForDisplay()` en `data/filter.ts` para incluir las categorías que
aporta cada fuente:

```ts
export function sourcesForDisplay(
  sourceIds: string[],
  items: Item[],
): { sourceId: string; count: number; cats: Category[] }[];
```

- `cats`: lista de categorías en las que la fuente tiene al menos un ítem, **ordenadas
  por cantidad descendente** (se muestran las más representativas primero).
- Se calcula en la misma pasada que `count` (un `Map<sourceId, {count, catCounts}>`),
  sin recorrer los ítems más de una vez.
- El orden global de fuentes sigue siendo por `count` desc (sin cambio).

### Componente `SourceGrid` (nuevo)

El `Footer` hoy hace demasiado. Se extrae la lista de fuentes a un componente
propio, testeable en aislamiento:

`frontend-public/src/components/SourceGrid.tsx` (+ `SourceGrid.module.css`)

- **Props:** `sources: { sourceId: string; count: number; cats: Category[] }[]`.
  Resuelve `{nombre, url}` con `useResolveSource()` (igual que hoy el Footer).
- **Render:** un grid responsivo de tarjetas (`repeat(auto-fill, minmax(~270px, 1fr))`),
  una por fuente. Cada tarjeta es un `<a>` al sitio de origen
  (`target="_blank" rel="noopener noreferrer"`), y contiene:
  - **Favicon** `https://www.google.com/s2/favicons?domain=<dominio>&sz=64`
    (`<img alt="" loading="lazy">`); si falla la carga (`onError`) se oculta el ícono
    (no rompe el layout).
  - **Nombre** (negrita, truncado con ellipsis si desborda).
  - **Conteo** de registros en un pill (`Intl.NumberFormat("es")`).
  - **URL completa** (`src.url`) en tipografía monoespaciada azul, con un ícono de
    flecha "abrir externo"; truncada con ellipsis, subrayada al hover.
  - **Chips de categoría**: hasta 3 (las de `cats`, ya ordenadas), cada una con el
    color de su token `--cat-<categoría>` (texto en el color, fondo en un tinte via
    `color-mix`). Si hay más de 3, un chip `+N`.
  - Hover: la tarjeta se eleva (`translateY(-2px)` + sombra + borde primario).
- Sin scroll infinito; son ~11 tarjetas (lista acotada por diseño).

El dominio para el favicon y para mostrar se deriva de `src.url`
(`new URL(src.url).host` o equivalente); la URL visible es `src.url` completa, como
pidió el usuario.

### Cambios en `Footer.tsx`

- Reemplazar el `<ul>` actual de fuentes por `<SourceGrid sources={sources} />`.
- Actualizar el subtítulo de la sección para dejar explícito el intervalo:
  > "La información se centraliza **cada ~30 min** desde estas N páginas públicas de
  > terceros."
  > (N = `sources.length`.)
- Conservar `id="fuentes"`, "Datos actualizados: …", el bloque de contacto, el enlace
  al API y el disclaimer. El `Footer` pasa a delegar la lista en `SourceGrid` y queda
  más enfocado.

### Favicon — decisión

Se usa el servicio de Google (`google.com/s2/favicons`). Trade-off aceptado por el
dueño: el navegador del público consulta a Google (tercero + le pasa los dominios de
las fuentes) a cambio de cero mantenimiento y de que siempre haya ícono. Se mitiga con
`loading="lazy"` y `onError` que oculta el ícono roto. (Alternativas descartadas por
ahora: auto-hospedar los favicons en el build; inicial+color sin ícono.)

### Accesibilidad

- Cada tarjeta es un enlace con texto accesible (el nombre + la URL visible); el
  favicon va con `alt=""` (decorativo). Los chips de categoría llevan su etiqueta
  textual (no solo color). El foco usa el `--focus-ring` existente.

## Tests

- `data/filter.ts`: `sourcesForDisplay` ahora devuelve `cats` correctas y ordenadas
  por frecuencia; fuentes sin ítems → `cats: []`, `count: 0`.
- `SourceGrid`: renderiza una tarjeta por fuente, con enlace a la URL correcta
  (`target="_blank"`), la URL visible, el conteo formateado, y los chips (incluido el
  caso `+N` cuando `cats.length > 3`). Favicon con `src` derivado del dominio.
- `Footer`: sigue renderizando `id="fuentes"`, el subtítulo con el intervalo, y ahora
  delega en `SourceGrid` (ajustar el test existente que buscaba el `<ul>`/enlaces).

## Deploy

Solo `FrontendStack`: buildear `frontend-public` y publicar (GHA al mergear a `main`).
**No** requiere regenerar el snapshot (la data no cambia; solo su presentación).

## Fuera de alcance (YAGNI)

- No se toca el snapshot ni el backend (las categorías se derivan en el cliente).
- No se agrega click-a-reportes (navegar a los ítems de una fuente); el usuario pidió
  solo la lista con URLs. Queda como posible mejora futura.
- No se mueve la sección fuera del footer ni se crea una página `#/fuentes` dedicada.
- No se auto-hospedan favicons (se usa el servicio de Google).
