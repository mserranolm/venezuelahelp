# Task 5 Report: searchItems + retrieve (motor de consulta unificado)

## TDD Evidence

### RED (Step 2)

Ran `npm test --workspace @venezuelahelp/core -- search` with only the test file created.
Result: **11 failed / 0 passed** — all tests failed with "SyntaxError: ... `searchItems` is not exported from `../index`" (module not found).

### GREEN (Step 5)

After creating `core/src/search.ts` and adding `export * from "./search"` to `core/src/index.ts`.
Result: **11 passed / 0 failed** in 2ms.

### Full suite (Step 6 + Step 7)

`npm test --workspace @venezuelahelp/core` → **21 tests / 6 test files — all passed**.

## Files Created/Modified

- `core/src/search.ts` — `SearchParams`, `rankPool`, `searchItems`, `retrieve`
- `core/src/__tests__/search.test.ts` — brief's test + 6 migrated describe blocks
- `core/src/index.ts` — added `export * from "./search"`

## Bot Tests Migrated (Step 6)

The following describe blocks were copied from `backend/src/telegram/__tests__/retrieval.test.ts` into `core/src/__tests__/search.test.ts`, with the import adjusted to `../index` and local snapshot variables renamed to avoid shadowing:

1. **"retrieve — category routing"** — desaparecidos priorized over high-volume reportes
2. **"retrieve — field weighting"** — título match outscores texto match
3. **"retrieve — diversidad por categoría"** — quota prevents one cat from hogging all k slots
4. **"retrieve — variantes singular/plural y género"** — stem matching (desaparecida/desaparecidos, colapsada/colapsados)
5. **"retrieve — ranking por término discriminante dentro de la categoría"** — location term beats generic category header
6. **"retrieve — enrichment"** — excludes sospechosos; prefers isCanonical at equal score

Not migrated (bot-specific functions not in core): `normalize`, `countAnswer`, `isHelpRequest`, and the simple `retrieve` describe block that tests zero-score exclusion (the core's behavior is equivalent but tested via the richer category routing test).

All 11 migrated+new tests pass. The backend test file was not modified.

## Commit

`8a1be6c` — ✨ feat(core): searchItems + retrieve (motor de consulta unificado)

---

## Fix wave (Task 5 — divergencias con el bot)

### Fix 1 — drop-rule usa la variable correcta

**Archivo:** `core/src/search.ts`, línea 57 (en `rankPool`).

**Cambio:** `rankKws.length > 0` → `kws.length > 0`.

**Por qué:** `rankKws` son los keywords pre-filtrados de señales de categoría; cuando la query es solo palabras de señal (p.ej. "desaparecidos"), `rankKws` queda vacío y el drop-rule nunca se activaba, dejando pasar todos los reportes con score=0. El bot original guarda el drop-rule por `kws.length` (pre-strip), que sí es > 0 cuando el usuario tecleó algo.

### Fix 2 — `retrieve` devuelve [] cuando no hay keywords

**Archivo:** `core/src/search.ts`, función `retrieve`.

**Cambio:** Se añadió el guard `if (keywords(question).length === 0) return [];` al inicio, igual que el bot original (`retrieval.ts`). Sin este guard, una query de puras stopwords ("que hay") ejecutaba todo el ranking y devolvía ítems arbitrarios.

### Tests añadidos

Nuevo `describe("divergencias corregidas (paridad con el bot)")` en `core/src/__tests__/search.test.ts`:

1. **Fix 1 — solo señales de categoría:** `retrieve("desaparecidos", snap, 15)` → solo devuelve desaparecidos (los 6 reportes, con score=0 y target=false, son descartados).
2. **Fix 2 — solo stopwords:** `retrieve("que hay", snap, 15)` → `[]`.
3. **Sanity no-query:** `searchItems(snap, {})` → 8 ítems (todos; kws=[] desactiva el drop-rule).

### Comando y resultado

```
npm test --workspace @venezuelahelp/core
```

```
 RUN  v1.6.1 /…/feat-core/core

 ✓ src/__tests__/types.test.ts  (1 test) 1ms
 ✓ src/__tests__/rank.test.ts  (1 test) 1ms
 ✓ src/__tests__/category.test.ts  (3 tests) 1ms
 ✓ src/__tests__/filter.test.ts  (3 tests) 1ms
 ✓ src/__tests__/text.test.ts  (2 tests) 2ms
 ✓ src/__tests__/search.test.ts  (14 tests) 3ms

 Test Files  6 passed (6)
      Tests  24 passed (24)
   Start at  17:30:28
   Duration  204ms
```

### Commit

`TBD` — 🐛 fix(core): paridad del drop-rule y retrieve vacío con el bot (Task 5)
