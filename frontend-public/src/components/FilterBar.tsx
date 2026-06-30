import type { Category } from "@/types";
import CategoryFilter from "@/components/CategoryFilter";
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
  matchActive: boolean;
  onToggleMatch: () => void;
  matchCount: number;
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
  matchActive,
  onToggleMatch,
  matchCount,
}: FilterBarProps) {
  const hasFilters = query.trim().length > 0 || active.size > 0 || matchActive;

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

      <CategoryFilter
        active={active}
        onToggle={onToggle}
        counts={counts}
        matchActive={matchActive}
        onToggleMatch={onToggleMatch}
        matchCount={matchCount}
      />

      <div className={styles.results}>
        <p className={styles.resultsCount} aria-live="polite">
          {matchActive ? (
            <>
              <strong>{matchCount}</strong> posibles localizaciones
            </>
          ) : hasFilters ? (
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
