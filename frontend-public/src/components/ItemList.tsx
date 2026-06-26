import type { Item, Source } from "@/types";
import Badge from "@/components/Badge";
import styles from "./ItemList.module.css";

const MAX_STAGGER = 8; // cap animation delay at 8th item

interface ItemListProps {
  items: Item[];
  // Mapa sourceId -> fuente; si falta (snapshot viejo) los ítems no enlazan.
  sources?: Record<string, Source>;
}

export default function ItemList({ items, sources }: ItemListProps) {
  return (
    <ul className={styles.list} role="list">
      {items.map((item, index) => {
        const key = `${item.category}-${item.sourceId}-${item.externalId}`;
        const delayIndex = Math.min(index, MAX_STAGGER);
        const source = sources?.[item.sourceId];

        return (
          <li
            key={key}
            className={styles.row}
            style={{ "--stagger-i": delayIndex } as React.CSSProperties}
          >
            <div className={styles.rowMeta}>
              <Badge category={item.category} />
              {item.ubicacion?.nombre && (
                <span className={styles.ubicacion}>
                  {item.ubicacion.nombre}
                </span>
              )}
            </div>

            {/* El titular enlaza al sitio de la fuente cuando la conocemos;
                si no, queda como texto plano (snapshot viejo o fuente sin URL). */}
            {source?.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.titulo} ${styles.tituloLink}`}
              >
                {item.titulo}
              </a>
            ) : (
              <p className={styles.titulo}>{item.titulo}</p>
            )}
            <p className={styles.texto}>{item.texto}</p>

            <span className={styles.source}>
              {source?.nombre ?? item.sourceId}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
