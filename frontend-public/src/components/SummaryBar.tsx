import type { Category } from "@/types";
import { CATEGORY_META, CATEGORY_ORDER } from "@/data/categories";
import styles from "./SummaryBar.module.css";

interface SummaryBarProps {
  counts: Record<Category, number>;
  active: Set<Category>;
  onToggle: (c: Category) => void;
}

export default function SummaryBar({
  counts,
  active,
  onToggle,
}: SummaryBarProps) {
  return (
    <nav className={styles.bar} aria-label="Resumen por categoría">
      {CATEGORY_ORDER.map((cat) => {
        const meta = CATEGORY_META[cat];
        const isActive = active.has(cat);
        const colorVar = `var(${meta.colorVar})`;
        return (
          <button
            key={cat}
            type="button"
            className={`${styles.entry} ${isActive ? styles.entryActive : ""}`}
            aria-pressed={isActive}
            onClick={() => onToggle(cat)}
            style={
              isActive
                ? {
                    background: "var(--primary-tint)",
                    borderColor: "var(--primary)",
                    color: "var(--primary-strong)",
                  }
                : { color: "var(--ink)" }
            }
          >
            <span
              className={styles.dot}
              aria-hidden="true"
              style={{ background: colorVar }}
            />
            <span className={styles.label}>{meta.label}</span>
            <span className={styles.count}>{counts[cat]}</span>
          </button>
        );
      })}
    </nav>
  );
}
