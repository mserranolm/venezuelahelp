import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import styles from "./Header.module.css";

const TELEGRAM_URL = "https://t.me/VenezuelaHelpInfoBot";

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a href="#/" className={styles.wordmark} aria-label="VenezuelaHelp">
          <span className={styles.brandVe}>Venezuela</span>
          <span className={styles.brandHelp}>Help</span>
        </a>

        {/* Desktop nav */}
        <nav className={styles.nav} aria-label="Principal">
          <a href="#/quienes-somos" className={styles.navLink}>
            ¿Quiénes somos?
          </a>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
          >
            Preguntar por Telegram
          </a>
        </nav>

        {/* Mobile menu trigger */}
        <button
          type="button"
          className={styles.menuBtn}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X aria-hidden="true" size={22} weight="bold" />
          ) : (
            <List aria-hidden="true" size={22} weight="bold" />
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className={styles.menuPanel}>
          <a
            href="#/quienes-somos"
            className={styles.menuLink}
            onClick={() => setOpen(false)}
          >
            ¿Quiénes somos?
          </a>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.menuCta}
            onClick={() => setOpen(false)}
          >
            Preguntar por Telegram
          </a>
        </div>
      )}
    </header>
  );
}
