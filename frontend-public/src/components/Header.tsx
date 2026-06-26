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
          <span className={styles.mark} aria-hidden="true">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12 h3 l2 -7 l4 14 l3 -10 l2 5 h6" />
            </svg>
          </span>
          <span className={styles.name}>
            Venezuela<b>Help</b>
          </span>
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
            <span className={styles.ctaFull}>Preguntar por Telegram</span>
            <span className={styles.ctaShort}>Telegram</span>
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
