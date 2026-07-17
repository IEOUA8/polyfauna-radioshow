# PolyFauna - Arquitectura y catalogo de modulos

Estado de referencia: 2026-07-17, commit base `d54fcfa`.

Este documento describe el comportamiento vigente. Para detalles historicos consulta `IMPLEMENTATION_PHASES.md`; para despliegues, migraciones, variables e inventario de Edge Functions consulta `DEPLOYMENT_AND_MIGRATIONS.md`.

## Arquitectura general

- Frontend estatico React 18 + Vite, servido por Vercel.
- Enrutamiento con React Router y un shell persistente (`PolyfaunaOS`).
- Backend Supabase: Postgres, Auth, RLS, Storage, RPCs y Edge Functions.
- Radio en vivo y metadatos Now Playing desde AzuraCast/Icecast.
- Pagos Wompi con checkout firmado, webhook autenticado e idempotencia.
- Correo transaccional Resend con categorias, idempotencia y webhook Svix.
- Archivos publicos y multimedia mediante Supabase Storage y Cloudflare R2.
- PWA con service worker, instalacion y aviso controlado de nueva version.

Proveedores globales montados en `App.jsx`:

- `AuthProvider`: sesion, perfil, recuperacion de contrasena y solicitudes de rol.
- `PlaybackProvider`: pista actual, intencion de reproduccion y navegacion interna.
- `NowPlayingProvider`: una sola consulta periodica de AzuraCast por sesion.
- `TooltipProvider` y sistema de toasts.
- `GlobalPlayer`: fuera de `Routes` para no cortar el audio al navegar.

## Rutas y shell

Rutas independientes:

- `/login`, `/signup`, `/validate`: autenticacion y validacion.
- `/admin`: panel administrativo/operativo protegido.
- `/dashboard`: panel del usuario protegido.

Rutas de contenido:

- `/podcasts/:podcast` conserva la URL canonica y monta el shell.
- `/profiles/:slug`, `/organizadores/:slug`, `/music/:album`, `/events/:event`, `/e/:event`, `/entrevistas/:interview` y `/blog/:slug` redirigen a la seccion interna correspondiente sin crear una segunda pagina de detalle.
- `/artist/:slug` es un alias compatible hacia el perfil interno.
- `/*` monta `PolyfaunaOS`.

El estado de seccion vive en `?section=` y los parametros de detalle (`artist`, `organizer`, `album`, `event`, `interview`, `article`) permiten enlaces profundos sin desmontar la aplicacion.

## Modulos publicos y de usuario

| Modulo | Implementacion principal | Responsabilidad |
|---|---|---|
| Radio Console | `RadioConsolePage.jsx` | Now Playing, set activo, preguntas al host, compartir, cola y eventos destacados. |
| Reproductor global | `GlobalPlayer.jsx`, `PlaybackContext.jsx` | Audio persistente, radio/on-demand, reconexion, cola local, controles, Media Session y modo disco movil. |
| Programacion de radio | `RadioManager.jsx`, `useActiveRadioSet.js` | CRUD admin de sets, ventana activa, corazones y preguntas de oyentes. |
| Cola de radio | `RadioQueueTimeline.jsx`, `useRadioQueue.js`, `radioQueueTiming.js` | Hasta tres proximos items cacheados desde AzuraCast y hora proyectada en Bogota. |
| Podcasts | `PodcastsPage.jsx`, `PodcastManager.jsx` | Catalogo, detalle editorial, audio, likes/favoritos, creditos, slug canonico, SEO y metadata social. |
| Musica | `MusicPage.jsx`, `AlbumManager.jsx` | Albumes y tracks, reproduccion en cola, generos, creditos de artistas y administracion por propietario. |
| Organismo | `Organism.jsx` | Biblioteca personal por favoritos: musica, podcasts, agenda, artistas y organizadores seguidos. La radio en vivo no se guarda como pista. |
| Eventos | `EventTerminal.jsx`, `EventManager.jsx` | Descubrimiento, detalle, imagenes responsive, tiers, horarios de venta, compra, cortesia y colaboradores. |
| Ticket Vault | `TicketVault.jsx` | Entradas del usuario, QR/PDF y ocultamiento solo despues de uso y fin del evento. |
| Artists & Labels | `ArtistsPage.jsx`, `ProfileContentTabs.jsx` | Perfiles publicos, busqueda, contenido propio o acreditado y enlaces profundos. |
| Colonia | `OrganizersPage.jsx`, `ProfileContentTabs.jsx` | Clubes, promotores y colectivos, eventos organizados y contenido asociado. |
| Blog & Entrevistas | `BlogInterviewsSection.jsx` | Articulos ricos por bloques, entrevistas, likes, compartir, portadas WebP y lectura editorial. |
| Signal Inbox | `SignalInbox.jsx` | Mensajeria y notificaciones internas con limites de consulta. |
| Control Center | `ControlCenter.jsx` | Perfil, privacidad, terminos, reporte de problemas, calidad de radio y desactivacion. |
| Perfil | `EditProfile.jsx`, `useProfile.js` | Datos publicos, identidad opcional separada, avatar y capacidades segun rol. |
| Onboarding y auth | `OnboardingModal.jsx`, `EmailVerifiedModal.jsx`, paginas de auth | Registro, login, verificacion, recuperacion y continuidad de sesion. |

Secciones de invitado: Radio, Podcasts, Event Terminal, Artists & Labels, Colonia y Blog & Entrevistas. Musica personal, Organismo, Inbox, Ticket Vault y Control Center requieren sesion cuando manejan datos privados.

## Panel administrativo y operativo

`AdminDashboard.jsx` adapta las capacidades al rol y propietario. Sus modulos son:

| Grupo | Modulos |
|---|---|
| Gestion | Dashboard, Metricas, Operacion, Radio, Soporte, Eventos, Tickets, Devoluciones, Lector QR, Wallet y Retiros. |
| Contenido | Podcasts, Blog, Entrevistas, Artistas y Albumes/tracks. |
| Usuarios | Cuentas, roles, solicitudes, perfiles espejo y auditoria de cambios sensibles. |

Managers especializados:

- `EventManager`: evento, tiers, Early/Anytime, imagenes principal/movil/ticket, asistentes, co-organizacion y reventa.
- `RadioManager`: sets de radio, horarios, metadata y preguntas del programa.
- `PodcastManager`: metadata editorial, audio, slug, descripcion final y creditos multiples.
- `AlbumManager`: album, tracks obligatoriamente asociados y creditos multiples.
- `BlogManager` e `InterviewManager`: contenido editorial y relaciones con artistas.
- `ArtistManager` y `UserManager`: perfiles, roles, aprobaciones y datos publicos.
- `TicketActionModals`: anulacion y transferencia controlada de tickets manuales/cortesia.
- `UploadField`, `R2UploadField`, `imageOptimization.js` y `ArtistCreditSelector`: utilidades compartidas de contenido; toda imagen cargada desde los gestores se normaliza a WebP antes de viajar al almacenamiento.

Las confirmaciones sensibles usan modales propios montados con portal; no se usan `window.confirm`, `window.prompt` ni `window.alert`.

## Roles y capacidades

Valores almacenados en `profiles.role`:

- `citizen`
- `artist`
- `promoter`
- `club`
- `sello`
- `admin`

`collective` es una opcion administrativa y de solicitud, no un valor persistido en `profiles.role`. Las RPCs la convierten en:

```text
role = promoter
organizer_type = collective
```

Segun el rol se auto-provisionan fichas en `artists` y/o `organizers`. El frontend no debe actualizar `profiles.role` directamente; usa `set_user_role` o `process_role_request_admin`.

## Radio y reproduccion

- `NowPlayingProvider` evita polling duplicado entre Sidebar, TopBar, consola y reproductor.
- `GlobalPlayer` conserva el audio al entrar a `/admin` y `/dashboard`.
- En movil operativo puede reducirse a un disco flotante.
- La radio usa reconexion con backoff, deteccion de stall y fallback de calidad en modo automatico.
- El shell precarga chunks de navegacion durante tiempo ocioso y cambia de seccion con una transicion concurrente de 140 ms, sin blur ni scroll animado.
- La identidad del reproductor muestra unicamente `Loquens` en modo podcast y `Transmittens` en radio en vivo, sin descriptores funcionales junto al concepto; la etiqueta generica `A demanda` se conserva para musica grabada.
- Las pistas y podcasts on-demand mantienen cola, tiempo, seek, shuffle/repeat y Media Session.
- `radio_sets` representa programacion editorial en vivo; `radio_set_likes` guarda corazones por usuario.
- `radio_queue_cache` se sincroniza server-side porque la API de cola de AzuraCast requiere secreto.
- El naranja identifica el estado en vivo. El dorado editorial identifica acciones/seleccion, incluido el play flotante.

## Contenido y SEO

- Artistas y organizadores se resuelven dentro del shell; los alias publicos preservan enlaces existentes.
- Albumes y podcasts pueden acreditar multiples artistas mediante `album_artist_credits` y `podcast_artist_credits`.
- Podcasts usan `slug` unico generado por trigger y `footer_description` para notas finales.
- Articulos usan slug, bloques ricos, like count y portadas optimizadas.
- `tools/generate-seo.js`, `tools/prerender-seo.js` y `tools/generate-llms.js` generan sitemap, HTML social y `llms.txt`.
- IndexNow solo se ejecuta en builds Vercel de produccion o con `INDEXNOW_FORCE=1`.
- Rutas privadas reciben `X-Robots-Tag: noindex, nofollow`.

## Eventos, pagos y tickets

Tipos de emision:

- Compra Wompi.
- Ticket gratis reclamado por el usuario.
- Cortesia emitida por un operador autorizado.
- Venta manual emitida por un operador autorizado.

Los destinatarios sin cuenta quedan en `pending_registration` con `assigned_email`; el registro con el mismo correo reclama el ticket automaticamente.

Reglas principales:

- Cada tier tiene precio, capacidad, disponibilidad y cierre de venta propios.
- Early puede vencer antes del evento y exigir recargo; Anytime conserva su ventana configurada.
- Retirar un tier de venta no invalida tickets historicos ya emitidos.
- Cambiar fechas del evento reconcilia ventanas dependientes antes de guardar.
- Wompi verifica firma, monto y moneda; el webhook y la emision son idempotentes.
- El QR firmado tiene validacion online/offline y uso unico.
- Tickets de pasarela no se anulan/transfieren con los flujos reservados a manuales y cortesias.
- Ticket Vault solo permite ocultar una entrada usada cuando el evento ya termino.

## Imagenes y archivos

- Eventos admiten `image_url` principal, `mobile_image_url` y `ticket_image_url`, con fallback a la principal.
- R2 se usa mediante URLs prefirmadas generadas por `get-upload-url`; las credenciales nunca llegan al cliente.
- Portadas de podcast/album se limitan a 1200x1200, avatares a 640x640 y variantes de evento a dimensiones acordes con banner, movil o ticket. Nunca se amplian imagenes pequeñas.
- `imageOptimization.js` decodifica la imagen localmente, conserva su proporcion, elimina metadata y genera WebP con calidad 80-82 antes de subir. Audio y otros archivos no pasan por esta transformacion.
- `UploadField`, `R2UploadField` y `EditProfile` aplican el mismo contrato; los objetos de Supabase usan nombres unicos y cache anual inmutable.
- La portada historica de `Plano de Fase - Serie 001 | Nous` tiene un backfill WebP de 99.972 bytes frente al PNG original de 2.210.848 bytes.
- Las portadas de blog usan relacion de aspecto estable, lazy loading y formatos WebP cuando corresponde.
- Iconos, manifest, service worker y fallback offline viven en `public/`.

## Mensajeria, correo y push

- Plantillas compartidas viven en `supabase/functions/_shared` y las de Auth en `supabase/auth-email-templates`.
- Resend usa claves de idempotencia y categorias; el webhook Svix registra sent/delivered/delayed/bounced/failed/complained/suppressed sin guardar cuerpo ni destinatario.
- Las plantillas incluyen el ajuste de Gmail iOS para evitar inversion/fondo blanco.
- Web Push usa suscripciones por usuario, VAPID y limpieza de endpoints expirados.
- Notificaciones internas cubren mensajes, roles, co-promotores y contenido comunitario.

## Telemetria, seguridad y performance

- `UsageTelemetry` registra eventos anonimos y heartbeat con propiedades acotadas.
- `collect-client-error` conserva contexto tecnico sin query strings ni datos personales.
- Vercel Analytics y Speed Insights excluyen rutas privadas.
- RLS usa roles explicitos, initplans y politicas consolidadas.
- Helpers internos `SECURITY DEFINER` no se exponen como RPC cliente.
- `npm run verify` ejecuta lint, tests, seguridad, build y presupuesto de performance.
- PDF, QR scanner, admin, graficas y secciones pesadas permanecen lazy. Las dependencias opcionales HTML/SVG de jsPDF estan deshabilitadas porque Ticket Vault solo usa texto, formas e imagenes raster.
- `sectionPreload.js` adelanta chunks al hover o primer toque sin repetir imports.

## Pruebas como contrato

`tests/*.test.js` protege reglas de SQL, RLS, Edge Functions y contratos de UI. Cuando cambie un flujo sensible debe actualizarse o agregarse una prueba que cubra:

- permisos y firmas de RPC;
- idempotencia y locks;
- estados de tickets y pagos;
- rutas internas/canonicas;
- restricciones de roles;
- comportamiento offline;
- contratos de performance, precarga y reproduccion.

Las pruebas documentan invariantes, pero no sustituyen esta referencia ni los playbooks operativos.

## Fuentes de verdad

En caso de discrepancia, el orden es:

1. Migraciones y codigo desplegado.
2. Pruebas de contrato.
3. Este documento y `DEPLOYMENT_AND_MIGRATIONS.md`.
4. Registro historico por fases.
5. Documentos maestros de diseno archivados.
