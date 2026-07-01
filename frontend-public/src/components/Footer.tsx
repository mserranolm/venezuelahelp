import { WhatsappLogo, EnvelopeSimple } from "@phosphor-icons/react";
import { formatDateTime } from "@/data/datetime";
import SourceGrid from "@/components/SourceGrid";
import type { Category } from "@/types";
import styles from "./Footer.module.css";

const WHATSAPP_URL = "https://wa.me/34645050484";
const PHONE_DISPLAY = "+34 645 05 04 84";
const EMAIL = "mserranolm@gmail.com";

interface FooterProps {
  sources: { sourceId: string; count: number; cats: Category[] }[];
  generatedAt?: string;
}

export default function Footer({ sources, generatedAt }: FooterProps) {
  const updated = formatDateTime(generatedAt);
  return (
    <footer className={styles.footer} id="fuentes">
      <div className={styles.inner}>
        <h2 className={styles.title}>Fuentes monitoreadas</h2>
        <p className={styles.sub}>
          La información se centraliza <strong>cada ~30 min</strong> desde estas{" "}
          {sources.length} páginas públicas de terceros:
        </p>

        <SourceGrid sources={sources} />

        {updated && (
          <p className={styles.updated}>Datos actualizados: {updated}</p>
        )}

        <section className={styles.contact} aria-labelledby="footer-contacto">
          <div className={styles.contactText}>
            <h2 id="footer-contacto" className={styles.contactTitle}>
              ¿Tienes una fuente o quieres colaborar?
            </h2>
            <p className={styles.contactSub}>
              Si gestionas un sitio con información del terremoto o quieres
              integrar tus datos, escríbeme.
            </p>
          </div>
          <div className={styles.contactActions}>
            <a
              className={styles.contactPrimary}
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir por WhatsApp al ${PHONE_DISPLAY}`}
            >
              <WhatsappLogo aria-hidden="true" size={17} weight="fill" />
              {PHONE_DISPLAY}
            </a>
            <a
              className={styles.contactGhost}
              href={`mailto:${EMAIL}`}
              aria-label={`Enviar correo a ${EMAIL}`}
            >
              <EnvelopeSimple aria-hidden="true" size={17} weight="bold" />
              {EMAIL}
            </a>
          </div>
        </section>

        <p className={styles.apiLink}>
          ¿Eres una organización y quieres mostrar estos datos en tu sitio?{" "}
          <a href="#/api">Solicita acceso a nuestro API</a> ·{" "}
          <a href="#/api-docs">Documentación</a>.
        </p>

        <p className={styles.disclaimer}>
          VenezuelaHelp agrega información de emergencia desde fuentes abiertas.
          No es una fuente oficial; verifica siempre con las autoridades.
        </p>
      </div>
    </footer>
  );
}
