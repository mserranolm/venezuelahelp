import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Patrón "headroom": los controles reales viven en el flujo y se van solos al
 * hacer scroll hacia abajo (no se ocultan activamente). Este hook devuelve
 * `true` cuando hay que MOSTRAR una barra fija de respaldo: el usuario sube y
 * los controles del flujo ya no se ven (su borde inferior pasó el header).
 *
 * @param ref          los controles en flujo (referencia para medir su posición)
 * @param headerOffset alto del header sticky (px)
 * @param delta        umbral anti-parpadeo ante micro-scroll
 */
export function useRevealOnScrollUp(
  ref: RefObject<HTMLElement>,
  headerOffset = 80,
  delta = 6,
): boolean {
  const [revealed, setRevealed] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    lastY.current = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      const diff = y - lastY.current;
      lastY.current = y;
      if (Math.abs(diff) < delta) return;

      // ¿Los controles del flujo ya salieron por arriba (debajo del header)?
      const bottom = ref.current?.getBoundingClientRect().bottom ?? Infinity;
      const past = bottom < headerOffset;

      if (diff < 0) {
        // Subiendo: revelar la barra solo si los controles ya no se ven.
        setRevealed(past);
      } else {
        // Bajando: nunca mostrar la barra revelada (se va con el contenido).
        setRevealed(false);
      }
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref, headerOffset, delta]);

  return revealed;
}
