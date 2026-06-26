import type { Category } from "@/types";
import { CATEGORY_META, CATEGORY_ORDER } from "@/data/categories";
import styles from "./FilterBar.module.css";

interface FilterBarProps {
  query: string;
  onQuery: (q: string) => void;
  active: Set<Category>;
  onToggle: (c: Category) => void;
}

export default function FilterBar({
  query,
  onQuery,
  active,
  onToggle,
}: FilterBarProps) {
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
      <div
        className={styles.chips}
        role="group"
        aria-label="Filtrar por categoría"
      >
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isActive = active.has(cat);
          const colorVar = `var(${meta.colorVar})`;
          return (
            <button
              key={cat}
              type="button"
              className={styles.chip}
              aria-pressed={isActive}
              onClick={() => onToggle(cat)}
              style={
                isActive
                  ? {
                      background: "var(--primary-tint)",
                      borderColor: "var(--primary)",
                      color: "var(--primary-strong)",
                    }
                  : { borderColor: "var(--border-strong)", color: colorVar }
              }
            >
              <span
                className={styles.dot}
                aria-hidden="true"
                style={{ background: colorVar }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
