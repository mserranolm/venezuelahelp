import { ArrowLeft } from "@phosphor-icons/react";
import shell from "./AboutPage.module.css";
import styles from "./ApiDocsPage.module.css";

const BASE = "https://api.venezuelahelp.click";

const CATEGORIES = [
  "reportes",
  "desaparecidos",
  "acopios",
  "edificios",
  "hospitales",
  "solicitudes",
];

const ITEMS_PARAMS: [string, string, string][] = [
  ["category", "string (opcional)", "Filtra por categoría (ver lista abajo)."],
  [
    "q",
    "string (opcional)",
    "Búsqueda por palabras clave sobre título, texto y ubicación. Todas las palabras deben aparecer (AND).",
  ],
  ["near", "lat,lng (opcional)", "Centro para filtrar por cercanía. Ej: 10.5,-66.9"],
  [
    "radiusKm",
    "número (opcional)",
    "Radio en km desde near. Requiere near. Solo ítems con ubicación.",
  ],
  ["limit", "número (opcional)", "Resultados por página. Default 50, máximo 200."],
  [
    "cursor",
    "string (opcional)",
    "Cursor opaco devuelto en nextCursor para pedir la siguiente página.",
  ],
];

const ITEM_FIELDS: [string, string][] = [
  ["category", "Categoría del ítem."],
  ["sourceId", "Id de la fuente de origen."],
  ["externalId", "Id del ítem en la fuente."],
  ["titulo", "Título o nombre."],
  ["texto", "Texto / descripción."],
  ["ubicacion", "{ lat, lng, nombre? } si la fuente la provee."],
  ["status", "Estado reportado por la fuente (opcional)."],
  ["imageUrl", "URL de la imagen en el origen (opcional)."],
  ["sourceUrl", "Permalink al ítem en su origen (opcional)."],
  ["trust", "Nivel de confianza: corroborado | no_verificado | verificado | sospechoso."],
  ["sourcesCount", "En cuántas fuentes aparece (corroboración cruzada)."],
  ["isCanonical", "true si es el ítem canónico de su grupo de duplicados."],
];

function Code({ children }: { children: string }) {
  return (
    <pre className={styles.code}>
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <article className={shell.page}>
      <a href="#/" className={shell.back}>
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        Volver al inicio
      </a>

      <h1 className={shell.title}>Documentación del API</h1>

      <p className={shell.lead}>
        API de <strong>solo lectura</strong> con la misma información pública del
        sitio. Pensada para que otras organizaciones muestren estos datos en sus
        propias plataformas. ¿No tienes clave?{" "}
        <a className={styles.inlineLink} href="#/api">
          Solicitar acceso
        </a>
        .
      </p>

      <section className={shell.section}>
        <h2 className={shell.h2}>Base URL y autenticación</h2>
        <p>
          Todas las llamadas van sobre <code className={styles.inline}>{BASE}</code> y
          requieren tu clave en la cabecera{" "}
          <code className={styles.inline}>x-api-key</code>.
        </p>
        <Code>{`curl -H "x-api-key: vh_live_TU_CLAVE" \\
  "${BASE}/v1/items?category=desaparecidos&limit=20"`}</Code>
        <p className={styles.note}>
          Sin cabecera <code className={styles.inline}>x-api-key</code> → 401. Clave
          inválida o revocada → 403. Límite de uso: ~60 peticiones por minuto por
          clave (excedido → 429).
        </p>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>
          <span className={styles.method}>GET</span>{" "}
          <span className={styles.path}>/v1/items</span>
        </h2>
        <p>Lista ítems con filtros y paginación.</p>
        <h3 className={styles.h3}>Parámetros (query string)</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Parámetro</th>
              <th>Tipo</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS_PARAMS.map(([name, type, desc]) => (
              <tr key={name}>
                <td>
                  <code className={styles.inline}>{name}</code>
                </td>
                <td className={styles.muted}>{type}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className={styles.h3}>Respuesta</h3>
        <Code>{`{
  "items": [ { /* ítem */ } ],
  "total": 49979,
  "nextCursor": "Mw"   // ausente en la última página
}`}</Code>
        <h3 className={styles.h3}>Paginación</h3>
        <p>
          Pide la primera página con <code className={styles.inline}>limit</code>; si
          la respuesta trae <code className={styles.inline}>nextCursor</code>, pásalo
          como <code className={styles.inline}>cursor</code> para la siguiente.
        </p>
        <Code>{`# página 1
curl -H "x-api-key: vh_live_TU_CLAVE" \\
  "${BASE}/v1/items?category=desaparecidos&limit=50"
# página 2 (usa el nextCursor de la respuesta anterior)
curl -H "x-api-key: vh_live_TU_CLAVE" \\
  "${BASE}/v1/items?category=desaparecidos&limit=50&cursor=Mw"
# por cercanía (5 km alrededor de un punto)
curl -H "x-api-key: vh_live_TU_CLAVE" \\
  "${BASE}/v1/items?near=10.5,-66.9&radiusKm=5&limit=20"`}</Code>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>
          <span className={styles.method}>GET</span>{" "}
          <span className={styles.path}>/v1/categories</span>
        </h2>
        <p>Conteo de ítems por categoría y fecha de generación de los datos.</p>
        <Code>{`{ "counts": { "desaparecidos": 49979, "reportes": 3441, ... },
  "generatedAt": "2026-06-29T22:28:43.319Z" }`}</Code>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>
          <span className={styles.method}>GET</span>{" "}
          <span className={styles.path}>/v1/sources</span>
        </h2>
        <p>Directorio de fuentes (id → nombre y URL).</p>
        <Code>{`{ "sismovenezuela": { "nombre": "Sismo Venezuela", "url": "https://..." }, ... }`}</Code>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>
          <span className={styles.method}>GET</span>{" "}
          <span className={styles.path}>/v1/meta</span>
        </h2>
        <p>Metadatos: fecha de generación del snapshot.</p>
        <Code>{`{ "generatedAt": "2026-06-29T22:28:43.319Z" }`}</Code>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>Categorías</h2>
        <ul className={shell.list}>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <code className={styles.inline}>{c}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className={shell.section}>
        <h2 className={shell.h2}>Campos de un ítem</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Campo</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {ITEM_FIELDS.map(([name, desc]) => (
              <tr key={name}>
                <td>
                  <code className={styles.inline}>{name}</code>
                </td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>
          Es información pública de emergencia agregada de fuentes de terceros.
          Úsala citando la fuente y respetando a las personas involucradas; no es
          una fuente oficial.
        </p>
      </section>
    </article>
  );
}
