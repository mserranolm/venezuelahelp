import { ArrowUpRight, Clock } from "@phosphor-icons/react";
import { useResolveSource } from "@/data/sources";
import { formatUpdated } from "@/data/datetime";
import styles from "./SourceBanner.module.css";

interface SourceBannerProps {
  sources: { sourceId: string; count: number }[];
  generatedAt?: string;
}

function Item({ sourceId, tabbable }: { sourceId: string; tabbable: boolean }) {
  const src = useResolveSource()(sourceId);
  if (src.url) {
    return (
      <a
        className={styles.link}
        href={src.url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={tabbable ? undefined : -1}
      >
        {src.nombre}
        <ArrowUpRight aria-hidden="true" size={13} weight="bold" />
      </a>
    );
  }
  return <span className={styles.name}>{src.nombre}</span>;
}

export default function SourceBanner({
  sources,
  generatedAt,
}: SourceBannerProps) {
  if (sources.length === 0) return null;
  const updated = formatUpdated(generatedAt);

  return (
    <div className={styles.banner} role="region" aria-label="Fuentes activas">
      <span className={styles.label}>Fuentes Activas</span>
      <div className={styles.viewport}>
        <div className={styles.track}>
          {/* Real, focusable copy */}
          <ul className={styles.group}>
            {sources.map(({ sourceId }) => (
              <li key={sourceId} className={styles.item}>
                <Item sourceId={sourceId} tabbable />
              </li>
            ))}
          </ul>
          {/* Duplicate copy for the seamless loop (hidden from AT) */}
          <ul className={styles.group} aria-hidden="true">
            {sources.map(({ sourceId }) => (
              <li key={`dup-${sourceId}`} className={styles.item}>
                <Item sourceId={sourceId} tabbable={false} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {updated && (
        <span className={styles.updated}>
          <Clock aria-hidden="true" size={13} />
          Actualizado: {updated}
        </span>
      )}
    </div>
  );
}
