import type { Category } from "@/types";
import { CATEGORY_META, CATEGORY_ORDER } from "@/data/categories";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  query: string;
  onQuery: (q: string) => void;
  active: Set<Category>;
  onToggle: (c: Category) => void;
  counts: Record<Category, number>;
  resultCount: number;
  total: number;
  onClear: () => void;
}

export default function FilterBar({
  query,
  onQuery,
  active,
  onToggle,
  counts,
  resultCount,
  total,
  onClear,
}: FilterBarProps) {
  const hasFilters = query.trim().length > 0 || active.size > 0;

  return (
    <div className={styles.root}>
      <input
        className={styles.search}
        type="search"
        aria-label="Buscar"
        placeholder="Buscar por palabra clave…"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />

      <p className={styles.cardsHeader}>
        Filtra las necesidades de ayuda por categoría
      </p>

      {/* Tarjetas de categoría: visibles por defecto (también en móvil) dentro
          de un contenedor con scroll vertical. */}
      <div
        className={styles.cards}
        role="group"
        aria-label="Filtrar por categoría"
      >
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const isActive = active.has(cat);
          const colorVar = `var(${meta.colorVar})`;
          return (
            <button
              key={cat}
              type="button"
              className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
              aria-pressed={isActive}
              onClick={() => onToggle(cat)}
              style={{ "--card-color": colorVar } as React.CSSProperties}
            >
              <span className={styles.cardIcon} aria-hidden="true">
                <Icon size={26} weight="duotone" />
              </span>
              <span className={styles.cardLabel}>{meta.label}</span>
              <span className={styles.cardCount}>{counts[cat]}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.results}>
        <p className={styles.resultsCount} aria-live="polite">
          {hasFilters ? (
            <>
              <strong>{resultCount}</strong> de {total} resultados
            </>
          ) : (
            <>
              <strong>{total}</strong> resultados
            </>
          )}
        </p>
        {hasFilters && (
          <button type="button" className={styles.clear} onClick={onClear}>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
