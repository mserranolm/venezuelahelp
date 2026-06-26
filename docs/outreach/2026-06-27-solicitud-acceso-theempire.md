# Solicitud de acceso de lectura — desaparecidos

**Para:** developer@theempire.tech (CC: contacto@theempire.tech)
**Asunto:** Colaboración VenezuelaHelp — acceso de lectura a la API de desaparecidos (terremoto 25-jun)

---

Hola, equipo de The Empire Tech:

Les escribo de **VenezuelaHelp** (https://venezuelahelp.click), un agregador **sin fines de lucro** que reúne información del terremoto del 25 de junio desde fuentes públicas de terceros y la expone en una web pública y un bot de Telegram con búsqueda. El objetivo es que más gente encuentre rápido los reportes, incluidos los de personas desaparecidas.

Hoy ya integramos fuentes como sismovenezuela.com y terremotovenezuela.app. Nos gustaría **sumar los reportes de desaparecidosterremotovenezuela.com**, con **atribución visible y enlace de vuelta a su sitio** en cada ficha (no buscamos apropiarnos del dato, sino dar más difusión y derivar tráfico a ustedes).

Vimos que su API (`desaparecidos-terremoto-api.theempire.tech/api`) está protegida con reCAPTCHA v3, lo cual es totalmente razonable. Por eso preferimos **pedirles acceso de forma ordenada** en lugar de intentar saltar su protección. Nuestro consumo sería **mínimo y respetuoso**: una sola lectura del listado cada ~6 horas (no por usuario ni por consulta), desde un backend serverless.

¿Alguna de estas opciones les sería viable?

1. **API key / token de servidor** que nos permita leer el listado saltando el reCAPTCHA (lo enviaríamos en un header).
2. **Allowlist** de nuestra IP/origen de salida para los endpoints de lectura.
3. Un **endpoint de solo lectura** (o export periódico JSON/CSV) pensado para agregadores, con rate-limit si lo desean.

Quedamos atentos a lo que prefieran, y encantados de coordinar atribución, límites de consumo o cualquier requisito que tengan. Gracias por construir esta herramienta; sumar esfuerzos ayuda a quienes están buscando a los suyos.

Un abrazo,
**Equipo VenezuelaHelp**
[tu nombre / contacto]
