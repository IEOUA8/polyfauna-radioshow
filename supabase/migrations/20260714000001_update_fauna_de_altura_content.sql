-- ─────────────────────────────────────────────────────────────
-- UPDATE · Reescritura editorial de «Fauna de altura»
-- ─────────────────────────────────────────────────────────────
-- Actualiza SOLO el texto (excerpt + bloques de content) del primer
-- artículo, conservando la misma estructura de bloques y las mismas
-- imágenes (cover_url y los src de las dos figuras webp no se tocan).
-- Cambios respecto al seed original:
--   · Párrafos de § Hábitat ampliados.
--   · Nueva sección § Raíz (radio, casete y camino de finca, ≈1999)
--     cerrada con una firma «Memoria oral».
--   · Bloque de clubes (Garden Underground, Tunnel, Kowel, Hangar
--     Nuclear, Marte Electronic Room, Transition…) y hábitats ampliados.
--   · § Porvenir reescrito.
-- Se localiza por slug (estable) para no depender del id.

UPDATE public.blog_articles
   SET excerpt = 'Cómo la música electrónica de vanguardia echó raíces en el Eje Cafetero —y por qué Colombia empezó a escucharla.',
       content = $json$[
    { "type": "section", "label": "Hábitat" },
    { "type": "p", "dropcap": true, "text": "Durante casi un siglo, estas montañas se midieron en cargas de café. El grano bajaba por las laderas, cruzaba el mundo y volvía convertido en prestigio. Hoy, en las mismas colinas, algo distinto sube: un pulso grave y constante que no aparece en ningún mapa turístico. El Eje Cafetero aprendió a sonar." },
    { "type": "p", "text": "Lo que hoy llamamos escena no nació de un plan. Nació de la necesidad de un puñado de personas que querían escuchar —y bailar— algo que las emisoras no ponían. Desde finales de los noventa y durante los primeros años del nuevo siglo, la música llegaba en discos, casetes, archivos compartidos y relatos de quienes viajaban a Bogotá, Medellín o Cali. Empezó como casi todo lo vivo: en los márgenes. Fiestas privadas, bodegas, fincas, sistemas de sonido prestados y carteles que circulaban de mano en mano antes que por una pantalla." },
    { "type": "p", "text": "La geografía ayudó. Pereira, Manizales y Armenia forman una región compacta, conectada por carreteras de montaña y por una misma cultura del trasnocho. Lo que ocurre un viernes en una ciudad se comenta el sábado en la siguiente. DJs, promotores y públicos aprendieron a desplazarse como una sola comunidad fragmentada en tres territorios." },
    { "type": "p", "text": "Una escena pequeña, pero densa. Y la densidad —en biología como en música— acelera la evolución. Los sonidos mutan rápido cuando el espacio es reducido y las mismas cien personas se cruzan cada fin de semana, empujándose unas a otras hacia lo nuevo." },
    { "type": "figure", "src": "/blog/fauna-de-altura/publico-en-penumbra.webp", "alt": "Público en penumbra en una fiesta del eje cafetero", "caption": "Fig. 01 — Un viernes cualquiera en el Eje." },
    { "type": "section", "label": "Raíz" },
    { "type": "p", "text": "Antes del primer club hubo una señal. A finales de 1999 —mucho antes de que alguien dijera «escena»— la música electrónica ya viajaba por el aire del Eje: algunas emisoras locales abrían un espacio los fines de semana para mezclas en vivo. Esa hora tardía de radio fue, para muchos, la primera pista de baile." },
    { "type": "p", "text": "El sonido se movía en objetos. CDs de trance que pasaban de mano en mano, casetes de house grabados y regrabados hasta gastar la cinta, y algo nuevo, casi extraño para el oído local: el techno. Cada copia era una invitación; cada intercambio, una forma de reconocerse." },
    { "type": "p", "text": "El Eje no fue espectador. Inspirado por lo que ocurría en Bogotá, Cali y Medellín, se volvió cuna de sus propios movimientos clandestinos —sin esperar permiso ni infraestructura, fabricando la suya: prestada, nocturna y terca." },
    { "type": "p", "text": "Y las fiestas subían a las fincas cafeteras. Llegar era parte del rito: una pequeña odisea por veredas y caminos rurales, faros contra la niebla, territorios que se descubrían al mismo tiempo que se bailaban." },
    { "type": "stratum", "marker": "≈1999", "label": "Primer estrato", "text": "En silencio, esas noches cautivaron a una generación abierta a explorar. La escena que vino después no se inventó de la nada: creció sobre esta raíz —radio, casete y camino de finca.", "note": "Memoria oral — testimonio de primera generación, eje cafetero." },
    { "type": "pullquote", "text": "No se trataba de imitar a Berlín ni a Medellín. Se trataba de descubrir cómo suena una montaña a las tres de la mañana." },
    { "type": "p", "text": "Por años, la conversación electrónica en Colombia tuvo dos centros de gravedad: Bogotá, con su apetito por el club, y Medellín, que aprendió a proyectar su sonido hacia el mundo. El Eje quedaba en medio, escuchando. Esa posición —periférica, atenta— resultó ser una ventaja." },
    { "type": "p", "text": "Sin la presión de una industria establecida, los colectivos de la región pudieron equivocarse en libertad, mezclar géneros sin pedir permiso y construir un gusto propio. Nadie esperaba nada de ellos; podían hacer cualquier cosa." },
    { "type": "p", "text": "Durante los años dos mil, la electrónica dejó de ser una aparición ocasional dentro de discotecas generalistas y empezó a construir espacios, públicos y códigos propios. En la década siguiente, clubes como Garden Underground y Tunnel en Pereira; Kowel, Hangar Nuclear y posteriormente Marte Electronic Room en Manizales; junto a espacios itinerantes y proyectos nuevos como Transition en Armenia, han hecho visible una infraestructura que antes apenas sobrevivía en la memoria oral." },
    { "type": "p", "text": "Ese gusto se inclinó hacia lo hipnótico y lo profundo antes que hacia lo eufórico: techno de texturas, ambient, acid, electro, dub, ritmos rotos y experimentación sin etiqueta. Música para escuchar con el cuerpo, sí, pero también con atención. Una vanguardia sin manifiesto, hecha de intuición, intercambio y terquedad." },
    { "type": "p", "text": "La llegada de artistas nacionales e internacionales no convirtió al Eje en una capital global, pero sí lo incorporó a una red más amplia. La región dejó de ser únicamente receptora: comenzó a desarrollar su propio lenguaje, sus sellos, sus espacios y una forma particular de relacionar paisaje, sonido y comunidad." },
    { "type": "heading", "text": "Tres hábitats" },
    { "type": "lead", "text": "Cada ciudad desarrolló su propio carácter. Misma región, distinta especie." },
    { "type": "habitats", "items": [
      { "code": "Esp. R", "species": "P. nocturna", "city": "Pereira", "text": "La más urbana de las tres. Pereira tiene la energía del cruce: comercio, movimiento, migración y vida de club. Allí la escena encontró sus estructuras más constantes. Espacios como Garden Underground, SG Club y, especialmente, Tunnel, ayudaron a convertir encuentros aislados en una programación reconocible. La noche pereirana es larga: clubes que abren tarde, pistas densas y amaneceres que llegan sobre los guaduales. Su sonido oscila entre el techno profundo, el house, el groove y las nuevas corrientes de mayor intensidad. Es el nodo de circulación más visible del bioma." },
      { "code": "Esp. M", "species": "P. mentis", "city": "Manizales", "text": "Ciudad universitaria, de niebla y pendiente. Manizales aporta la cabeza: público joven, curiosidad teórica y una inclinación natural por lo experimental. Clubes y proyectos como Kowel, Hangar Nuclear, Loop y Marte Electronic Room sostuvieron distintas etapas de una escena orientada al techno, la oscuridad y la escucha atenta. Aquí una pista de baile puede sentirse como un seminario sin palabras: cuerpos investigando una misma frecuencia." },
      { "code": "Esp. A", "species": "P. intima", "city": "Armenia", "text": "La más pequeña y la más cálida. En Armenia todo ocurre entre conocidos; la escena es familiar en el sentido literal. Su historia depende menos de una infraestructura fija y más de fincas, haciendas, clubes intermitentes y proyectos itinerantes. Espacios como Transition representan una continuidad reciente de esa búsqueda. Lo que le falta en tamaño lo compensa en cercanía: fiestas donde quien pincha te saluda por tu nombre y la comunidad completa puede reconocerse en una sola pista." }
    ] },
    { "type": "figure", "src": "/blog/fauna-de-altura/tres-ciudades-un-bioma.webp", "alt": "Tríptico de Pereira, Manizales y Armenia", "caption": "Fig. 02 — Tres ciudades, un mismo bioma." },
    { "type": "section", "label": "Porvenir" },
    { "type": "p", "text": "Nada de esto es todavía una industria consolidada, y quizá esa sea la buena noticia. La escena del Eje conserva la escala en la que las cosas importan: la del encuentro. Se sostiene con trabajo invisible, equipos prestados, residencias, puertas compartidas y la terquedad de quien organiza una fiesta sabiendo que apenas cubrirá los costos." },
    { "type": "p", "text": "Su posicionamiento global sigue siendo emergente. El Eje no compite en tamaño con Bogotá, Medellín ni con las capitales internacionales del club. Su valor está en otra parte: en la especificidad de su paisaje, en la proximidad entre sus ciudades y en una sensibilidad que favorece lo profundo, lo hipnótico y lo experimental." },
    { "type": "p", "text": "Pero crece. Cada año aparecen más nombres, más noches, sellos, archivos y nuevas generaciones que deciden que esta cultura también les pertenece. Colombia empezó a escuchar. Lo que salga de estas montañas en la próxima década —qué sonidos, qué espacios, qué ideas— está todavía por catalogarse." },
    { "type": "p", "text": "Polyfauna existe para eso: para registrar cada espécimen antes de que el ruido lo borre. Porque una escena, como un bioma, solo sobrevive si alguien se toma el trabajo de nombrarla." },
    { "type": "signoff", "text": "Archivo editorial Polyfauna · Espécimen textual N.º 01 · Escrito en el Eje Cafetero, Colombia · 2026" }
  ]$json$
 WHERE slug = 'fauna-de-altura';
