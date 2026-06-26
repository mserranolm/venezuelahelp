# Deduplicación entre fuentes y señal de confianza

**Fecha:** 2026-06-26
**Estado:** Diseño aprobado — pendiente de plan de implementación
**Relacionado:** `2026-06-25-venezuelahelp-design.md`, `2026-06-26-fase6-ai-connector-design.md`

## Problema

La data agregada presenta dos defectos que degradan la utilidad para el usuario final:

1. **Duplicación entre fuentes.** El mismo hecho (un edificio dañado, una zona, un desaparecido) puede venir de 2+ fuentes distintas, o de la misma fuente con otro `externalId`. Hoy solo hay dedupe **dentro de una misma fuente** vía `contentHash`; entre fuentes distintas (`sourceId` distinto) son ítems separados. La lista pública y las respuestas del bot se ven infladas y repetidas.
2. **Datos no confiables.** Nombres de personas, zonas o reportes pueden ser falsos, troleo o errores graves. Hoy la fuente entra tal cual (solo truncado y saneado contra prompt-injection); no hay ninguna señal de cuán creíble es un ítem.

## Decisiones de producto (acordadas)

- **Duplicados: solo marcar.** No se fusionan ni se borran. Se conservan todos los ítems originales; los duplicados se marcan para que el front los atenúe/colapse y el bot los desprioritice. Enfoque no destructivo.
- **No confiable: marcar, no ocultar.** Los ítems se siguen mostrando con un **badge de confianza** honesto. No se censura (es información de emergencia), salvo lo que cae en `sospechoso` por reglas duras, que el bot puede excluir y el front degradar.

## Insight central

Si dos fuentes **independientes** reportan el mismo hecho, esa corroboración es **a la vez** la señal de "duplicado" y la mejor señal barata de "esto probablemente es verdad". Un único cálculo (agrupar ítems del mismo hecho) alimenta ambas marcas. La veracidad absoluta (¿este nombre existe de verdad?) es imposible de verificar sin fuente autoritativa, así que **no se promete**: se entrega un _score de confianza_ explicable.

## Mecanismo (Enfoque A + refuerzo + reglas)

Detección determinística del "mismo hecho", sin base vectorial y a costo ~$0 de CPU:

- **A — Clave de cluster determinística** (base). Cada ítem obtiene un `clusterKey`. Ítems con la misma clave = mismo hecho.
- **B — Refuerzo textual difuso.** Cuando no hay geo ni persona, se compara la firma de tokens del título con Jaccard; firmas con similitud ≥ umbral se funden al mismo `clusterKey`.
- **Reglas de plausibilidad** para la marca de confianza (geocerca de Venezuela, campos mínimos, longitudes, blocklist de troleo, fechas).

Se descarta para v1 un LLM de agrupación por lote en cada scrape (rompe la restricción "casi gratis"); queda documentado como evolución futura si hay presupuesto.

## Arquitectura — paso de enriquecimiento post-upsert

Clusterizar requiere ver **todos los ítems de una categoría a la vez**, por lo que corre **después** de que todas las fuentes escribieron, dentro del mismo Lambda del scraper.

```
runScrape():
  1. ensureSeedSources()
  2. para cada fuente: fetchItems → itemRepo.upsert()      // sin cambios
  3. ★ enrichCategories():                                  // NUEVO
        para cada categoría:
          items = itemRepo.listByCategory(cat)              // ya existe
          clusters = clusterize(items)                      // A + B
          para cada item:
            marcas = computeEnrichment(item, cluster, reglas, config)
            si cambiaron las marcas → itemRepo.updateDerived(item, marcas)  // PUT condicional
  4. buildSnapshot()                                        // sale con las marcas incluidas
```

**Las marcas se persisten en el `StoredItem`, no solo en el snapshot.** Razón: el **bot de Telegram lee directo de DynamoDB** (retrieval por palabra clave), no del snapshot. Persistir en el ítem garantiza **una sola fuente de verdad** para los tres consumidores: snapshot público, bot y admin.

**Módulo aislado `backend/src/enrichment/`** con responsabilidad única: recibe ítems → devuelve marcas. No toca DynamoDB ni red (eso lo hace el orchestrator). Testeable en aislamiento.

### Trade-offs asumidos

- **Reescrituras:** un scrape puede reescribir ítems cuyas marcas cambiaron (p. ej. llegó una 2ª fuente → sube `sourcesCount`). Se acota con PUT condicional: solo si las marcas realmente cambiaron. Despreciable en PAY_PER_REQUEST al volumen actual (cientos de ítems/categoría).
- **Sin GSI:** clusterización en memoria por categoría (n chico). No se agregan índices. Coherente con la arquitectura single-table actual.

## Modelo de datos

Bloque de campos **derivados** agregado a `StoredItem` (calculados por el enriquecimiento, nunca por la fuente). No cambia PK/SK ni la idempotencia actual. Todos opcionales hasta el primer enriquecimiento → aditivo y retrocompatible.

```typescript
interface ItemEnrichment {
  clusterKey: string; // clave canónica del "mismo hecho"
  isCanonical: boolean; // true = representante del cluster; false = duplicado
  dupOf?: string; // si !isCanonical → SK del ítem canónico del cluster
  sourcesCount: number; // nº de fuentes DISTINTAS en el cluster (corroboración)
  trust: "verificado" | "corroborado" | "no_verificado" | "sospechoso";
  trustReasons: string[]; // explica el badge y ayuda al admin
  enrichedAt: string; // ISO; frescura
}
```

### Cálculo de `clusterKey` (por categoría, determinístico)

- **Geo presente** → `geohash(lat, lng, precisión ~1.2 km)` + `slug(nombre_zona)`.
- **Persona (desaparecidos)** → `slug(nombre normalizado: NFD, sin tildes, sin dobles espacios)` + `geohash` de "visto por última vez" si existe.
- **Sin geo ni persona** → firma de tokens del título (top-N palabras significativas, sin stopwords, ordenadas). Refuerzo B: firmas con Jaccard ≥ umbral se funden al mismo `clusterKey`.
- **Canónico del cluster** = mayor `sourcesCount` → desempate por `lastSeenAt` más reciente. Los demás: `isCanonical=false`, `dupOf = SK(canónico)`.

### Cálculo de `trust` (reglas en orden)

1. **`sospechoso`** si falla plausibilidad dura (con razón en `trustReasons`): geo fuera de la geocerca de Venezuela; `titulo`/`texto` vacíos o < N chars; match de blocklist de troleo/spam; fechas absurdas.
2. **`corroborado`** si `sourcesCount ≥ 2`.
3. **`no_verificado`** si `sourcesCount == 1` y pasa plausibilidad. ← default honesto.
4. **`verificado`** reservado para fuentes oficiales (campo opcional `source.trustLevel: "official"` en la metadata de la fuente; hoy ninguna lo es; queda listo para Protección Civil/bomberos a futuro).

### Configuración en `CONFIG#GLOBAL` (editable sin deploy)

- `blocklist`: términos de troleo/spam.
- `geocerca`: bounding box de Venezuela (lat/lng min/max).
- `jaccardThreshold`: umbral del refuerzo B (default sensato, p. ej. 0.6).
- `geohashPrecision`: precisión de la celda (default ~1.2 km).
- `minTextLen`: longitud mínima de texto para no marcar sospechoso.

## Consumidores

- **Snapshot público:** incluye `trust`, `trustReasons`, `sourcesCount`, `isCanonical`, `dupOf`. El front muestra badge de confianza y atenúa/colapsa `isCanonical=false`.
- **Bot Telegram:** en el retrieval prioriza `isCanonical` y `corroborado`; excluye `sospechoso`; añade "fuentes: N" al prompt para responder con la cautela adecuada.
- **Admin:** ve todo; filtra por `trust=sospechoso` y por duplicados para auditar. El campo `raw` existente sigue disponible para inspección.

## Testing (TDD, vitest)

Módulo puro → tablas de entrada/salida sin mocks.

- **`clusterize()`**: mismo geohash+zona → mismo `clusterKey`; persona con/sin tilde → mismo cluster (NFD); Jaccard funde títulos similares; ítems distintos no colisionan; selección de canónico (más fuentes → más reciente).
- **`scoreTrust()`**: 1 fuente → `no_verificado`; 2+ fuentes distintas → `corroborado`; geo fuera de VE → `sospechoso` con razón; blocklist → `sospechoso`; fuente oficial → `verificado`. Tabla de casos borde.
- **`enrichCategories()`** (con `aws-sdk-client-mock`): solo `updateDerived` en ítems cuyas marcas cambiaron; idempotente (2ª corrida sin cambios → 0 escrituras).
- **Snapshot/bot**: tests existentes extendidos — el snapshot incluye los campos nuevos; el retrieval del bot prioriza canónicos/corroborados y excluye sospechosos.
- **Regresión**: suite actual de `itemRepo`/orchestrator/snapshot verde (campos aditivos y opcionales).

## Fuera de alcance (v1)

- Fusión/merge de ítems en uno canónico (se eligió "solo marcar").
- Ocultar bajo umbral o cola de moderación humana (se eligió "marcar").
- LLM de agrupación o verificación semántica en la ingesta.
- GSI o índices nuevos en DynamoDB.
- Verificación de veracidad contra una fuente autoritativa externa.

## Evolución futura (documentada, no implementada)

- LLM de agrupación por lote para clusters que A+B no capturan (si hay presupuesto).
- Fuentes oficiales con `trustLevel: "official"` → `verificado`.
- Fusión opcional configurable si el "solo marcar" no basta en producción.
