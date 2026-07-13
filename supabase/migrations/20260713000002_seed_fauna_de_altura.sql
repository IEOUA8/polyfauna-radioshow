-- ─────────────────────────────────────────────────────────────
-- SEED · Primer artículo editorial: «Fauna de altura»
-- ─────────────────────────────────────────────────────────────
-- Espécimen textual N.º 01 del Archivo editorial Polyfauna.
-- content_format = 'blocks': el cuerpo es un arreglo JSON de bloques
-- que el lector rico (ArticleDetail) interpreta uno por uno.
--   · section   → marcador de sección  (§ Hábitat, § Porvenir)
--   · p         → párrafo (dropcap:true agrega la letra capitular)
--   · pullquote → cita destacada
--   · heading   → título grande dentro del cuerpo
--   · lead      → bajada/subtítulo del heading
--   · habitats  → lista de las tres ciudades (especie/ciudad/reseña)
--   · figure    → imagen + pie (src null = placeholder hasta subirla)
--   · signoff   → firma de cierre del archivo
-- cover_url y las figuras van en null: las imágenes se suben al bucket
-- blog-images en un paso posterior y se rellenan con un UPDATE.

INSERT INTO public.blog_articles (title, excerpt, category, author, cover_url, content_format, content)
SELECT
  'Fauna de altura',
  'Cómo la música electrónica de vanguardia echó raíces en el eje cafetero —y por qué Colombia empezó a escucharla.',
  'Crónica',
  'Polyfauna Editorial',
  NULL,
  'blocks',
  $json$[
    { "type": "section", "label": "Hábitat" },
    { "type": "p", "dropcap": true, "text": "Durante casi un siglo, estas montañas se midieron en cargas de café. El grano bajaba por las laderas, cruzaba el mundo y volvía convertido en prestigio. Hoy, en las mismas colinas, algo distinto sube: un pulso grave y constante que no aparece en ningún mapa turístico. El eje cafetero aprendió a sonar." },
    { "type": "p", "text": "Lo que hoy llamamos escena no nació de un plan. Nació de la necesidad de un puñado de personas que querían escuchar —y bailar— algo que las emisoras no ponían. Empezó como casi todo lo vivo: en los márgenes. Fiestas en bodegas, sistemas de sonido prestados, carteles que circulaban de mano en mano antes que por una pantalla." },
    { "type": "p", "text": "La geografía ayudó. El eje cafetero es una región compacta: Pereira, Manizales y Armenia están a menos de una hora entre sí, unidas por carretera de montaña y por una misma cultura del trasnocho. Lo que ocurre un viernes en una ciudad se comenta el sábado en la siguiente." },
    { "type": "p", "text": "Una escena pequeña, pero densa. Y la densidad —en biología como en música— acelera la evolución. Los sonidos mutan rápido cuando el espacio es reducido y las mismas cien personas se cruzan cada fin de semana, empujándose unas a otras hacia lo nuevo." },
    { "type": "figure", "src": null, "alt": "Público en penumbra en una fiesta del eje cafetero", "caption": "Fig. 01 — Un viernes cualquiera en el eje." },
    { "type": "pullquote", "text": "No se trataba de imitar a Berlín ni a Medellín. Se trataba de descubrir cómo suena una montaña a las tres de la mañana." },
    { "type": "p", "text": "Por años, la conversación electrónica en Colombia tuvo dos centros de gravedad: Bogotá, con su apetito por el club, y Medellín, que aprendió a exportar su sonido al mundo. El eje quedaba en medio, escuchando. Esa posición —periférica, atenta— resultó ser una ventaja." },
    { "type": "p", "text": "Sin la presión de una industria establecida, los colectivos de la región pudieron equivocarse en libertad, mezclar géneros sin pedir permiso y construir un gusto propio. Nadie esperaba nada de ellos; podían hacer cualquier cosa." },
    { "type": "p", "text": "Ese gusto se inclina hacia lo hipnótico y lo profundo antes que hacia lo eufórico. Techno de texturas, ambient, ritmos rotos, experimentación sin etiqueta. Música para escuchar con el cuerpo, sí, pero también con atención. Una vanguardia sin manifiesto, hecha de intuición y terquedad." },
    { "type": "heading", "text": "Tres hábitats" },
    { "type": "lead", "text": "Cada ciudad desarrolló su propio carácter. Misma región, distinta especie." },
    { "type": "habitats", "items": [
      { "code": "Esp. R", "species": "P. nocturna", "city": "Pereira", "text": "La más urbana de las tres. Pereira tiene la energía del cruce: comercio, movimiento, vida de club. Aquí la escena se volvió noche larga —espacios que abren tarde y cierran cuando ya salió el sol sobre los guaduales." },
      { "code": "Esp. M", "species": "P. mentis", "city": "Manizales", "text": "Ciudad universitaria, de niebla y pendiente. Manizales aporta la cabeza: público joven, curiosidad teórica, una inclinación natural por lo experimental. Es donde una pista de baile puede sentirse como un seminario a oscuras." },
      { "code": "Esp. A", "species": "P. intima", "city": "Armenia", "text": "La más pequeña y la más cálida. En Armenia todo pasa entre conocidos; la escena es familiar en el sentido literal. Lo que le falta en tamaño lo compensa en cercanía —fiestas donde el que pincha te saluda por tu nombre." }
    ] },
    { "type": "figure", "src": null, "alt": "Tríptico de Pereira, Manizales y Armenia", "caption": "Fig. 02 — Tres ciudades, un mismo bioma." },
    { "type": "section", "label": "Porvenir" },
    { "type": "p", "text": "Nada de esto es todavía una industria, y quizá esa sea la buena noticia. La escena del eje conserva la escala en la que las cosas importan: la del encuentro. Se sostiene con trabajo no pagado, con equipos prestados, con la terquedad de quien organiza una fiesta sabiendo que apenas cubrirá los costos." },
    { "type": "p", "text": "Pero crece. Cada año hay más nombres, más noches, más gente joven que decide que esto también es suyo. Colombia empezó a escuchar. Lo que salga de estas montañas en la próxima década —qué artistas, qué sonidos, qué ideas— está todavía por catalogarse." },
    { "type": "p", "text": "Polyfauna existe para eso: para registrar cada espécimen antes de que el ruido lo borre. Porque una escena, como un bioma, solo sobrevive si alguien se toma el trabajo de nombrarla." },
    { "type": "signoff", "text": "Archivo editorial Polyfauna · Espécimen textual N.º 01 · Escrito en el eje cafetero, Colombia · 2026" }
  ]$json$
WHERE NOT EXISTS (
  SELECT 1 FROM public.blog_articles WHERE title = 'Fauna de altura'
);
