# PolyFauna - Plan de capacidad y experiencia

Fecha: 2026-06-24

Este plan define como mejorar la experiencia del usuario sin sobrecargar la plataforma. La regla de trabajo es crecer por medicion: primero reducir llamadas repetidas, luego observar consumo real, despues ampliar infraestructura o funcionalidades segun datos.

## Baseline tecnico actual

- Hosting: Vercel, frontend React/Vite estatico con rutas protegidas y chunks lazy.
- Backend: Supabase Postgres, Auth, Storage/RPCs y Edge Functions.
- Radio: AzuraCast para stream y Now Playing.
- Pagos: Wompi con webhook, validacion de monto/moneda/firma e idempotencia.
- Tickets: emision atomica desde Postgres, QR firmado y validador online/offline.
- Operacion: alertas admin, soporte interno, auditoria administrativa y presupuesto de performance.

## Medicion inicial

- Base de datos Supabase: 13 MB.
- `max_connections` observado: 60.
- Conexiones observadas durante auditoria: 13.
- Bundle validado por `npm run perf:budget`:
  - JS inicial gzip: 159.4 KiB / 190 KiB.
  - CSS inicial gzip: 18.5 KiB / 30 KiB.
  - chunk lazy mayor gzip: 125.7 KiB / 260 KiB.
  - JS total gzip: 681.9 KiB / 720 KiB.
- Advisors Supabase:
  - 485 advertencias totales.
  - principales focos: politicas RLS permisivas duplicadas, `auth.uid()` sin initplan, funciones SECURITY DEFINER ejecutables por roles amplios y `search_path` mutable.

## Punto 1 - Centralizar NowPlaying en un provider unico

Antes de esta fase, `GlobalPlayer`, `TopBar`, `Sidebar` y `RadioConsolePage` montaban `useNowPlaying()` por separado. Cada montaje creaba su propio polling cada 15 segundos. En una sola sesion de usuario eso podia convertir una consulta esperada en cuatro consultas periodicas al servidor de radio.

La nueva arquitectura usa un unico `NowPlayingProvider` en el arbol principal de la app. Ese proveedor consulta AzuraCast una vez por sesion de navegador y expone el estado a los componentes consumidores mediante `useNowPlaying()`.

Beneficios:

- Menos carga sobre AzuraCast por usuario activo.
- Estado sincronizado entre reproductor, barra superior, sidebar y consola.
- Sin intervalos duplicados cuando el usuario navega entre vistas.
- Fallback al endpoint dinamico si el endpoint estatico no responde.
- Reintento mas prudente tras error para no presionar el servidor durante caidas.
- Metricas ligeras disponibles en `window.__polyfaunaNowPlayingMetrics`.

La consulta prioriza:

```text
/api/nowplaying_static/polyfauna.json
```

Si falla, usa:

```text
/api/nowplaying/polyfauna
```

El endpoint estatico de AzuraCast es preferible para alto trafico porque esta pensado para consumo frecuente y cacheable. El polling normal queda en 15 segundos; ante error sube a 30 segundos.

## Plan por fases

### Fase 7.1 - Reducir llamadas repetidas de escucha

Estado: implementada.

- Centralizar `NowPlaying` en un provider unico.
- Evitar `setInterval`; usar `setTimeout` encadenado para no solapar peticiones lentas.
- Agregar metricas de diagnostico para saber cuantas consultas hace una sesion.
- Proteger con prueba de contrato.

### Fase 7.2 - Endurecer Supabase antes de subir carga

Estado: implementada parcialmente.

- Corregir warnings de RLS con mayor impacto:
  - consolidar politicas permisivas duplicadas.
  - cambiar `auth.uid()` por patrones initplan donde aplique.
  - restringir ejecucion de funciones SECURITY DEFINER a roles necesarios.
  - fijar `search_path` en funciones.
- Mantener pruebas de contrato para que las RPCs criticas no pierdan locks, idempotencia o permisos.
- Ejecutar `supabase db advisors --linked` despues de cada bloque.

Implementado en esta subfase:

- Migracion `20260625015236_phase_7_2_supabase_hardening.sql` aplicada al proyecto Supabase enlazado.
- Se fijo `search_path` de funciones marcadas por advisors.
- Se revoco ejecucion anonima/publica de RPCs `SECURITY DEFINER` sensibles.
- `create_notification` quedo reservado para `service_role`.
- Se eliminaron politicas de storage que permitian listar buckets publicos completos.
- Se reemplazo la politica `solo_admin_puede_featured` que tenia `USING (true)` por una politica restrictiva.

Resultado medido con advisors:

- Total warnings: 485 -> 458.
- Security warnings: 45 -> 19.
- Performance warnings: 440 -> 439.
- Eliminados completamente:
  - `function_search_path_mutable`: 9 -> 0.
  - `anon_security_definer_function_executable`: 7 -> 0.
  - `public_bucket_allows_listing`: 5 -> 0.
  - `rls_policy_always_true`: 1 -> 0.

### Fase 7.3 - Medicion real de usuarios activos

Estado: pendiente.

- Agregar eventos de telemetria controlada para:
  - inicio de reproduccion.
  - cambio de seccion musical.
  - apertura de evento.
  - inicio de checkout.
  - compra aprobada.
  - descarga o visualizacion de ticket.
  - uso del validador.
- Separar metricas anonimas de datos personales.
- Definir tablero operativo con usuarios activos, reproducciones, conversion de compra y errores.

### Fase 7.4 - Experiencia de musica y perfiles reales

Estado: pendiente.

- Mantener la plataforma sin contenido generico.
- Crear perfiles reales de artistas con imagenes, bios, enlaces y catalogo.
- Subir musica real, albums y podcasts con metadata completa.
- Diferir cargas pesadas de media hasta que el usuario interactue.
- Usar imagenes optimizadas y tamanos responsivos.

### Fase 7.5 - Compra de tickets bajo demanda

Estado: pendiente.

- Simular picos de checkout con eventos de capacidad limitada.
- Validar que Wompi, webhook, RPC `fulfill_paid_transaction` y emision de tickets sostienen duplicados/reintentos.
- Agregar limites de UI para evitar doble click, doble checkout o reintentos agresivos.
- Mantener alertas operativas para pagos aprobados sin ticket y mismatch de cantidades.

### Fase 7.6 - Pruebas de carga controladas

Estado: pendiente.

- Probar rutas publicas con carga progresiva:
  - home/radio.
  - perfiles.
  - musica.
  - eventos.
  - checkout.
  - panel de usuario.
- Separar pruebas de frontend estatico, Supabase y AzuraCast.
- No hacer pruebas agresivas contra produccion sin ventana controlada.
- Definir umbrales de exito:
  - tasa de error bajo 1%.
  - p95 de rutas criticas bajo objetivo acordado.
  - sin saturacion de conexiones Postgres.
  - sin crecimiento anormal de errores cliente.

## Reglas para no sobrecargar la plataforma

- No usar realtime para datos que pueden resolverse con polling bajo o cache.
- No consultar Supabase desde varios componentes para el mismo dato si puede existir un provider/cache local.
- No cargar librerias de PDF, QR scanner, dashboards o graficas en la primera pantalla publica.
- No activar autoplay pesado ni precarga de audio/video en listas largas.
- No agregar contenido real sin metadata e imagen optimizada.
- No abrir ventas masivas sin ejecutar prueba de checkout y webhook.

## Senales que deben vigilarse

- Requests y errores de Vercel.
- Invocaciones y errores de Edge Functions.
- Conexiones activas Postgres.
- Duracion de RPCs de pagos/tickets.
- Errores cliente capturados en `client_errors`.
- Alertas admin de Operacion.
- Listeners simultaneos de AzuraCast.
- Tasa de abandono entre evento, checkout y pago aprobado.

## Fuentes tecnicas consultadas

- Vercel Hobby limits: https://vercel.com/docs/plans/hobby
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase Realtime limits: https://supabase.com/docs/guides/realtime/limits
- AzuraCast scaling: https://www.azuracast.com/docs/getting-started/scaling/
- AzuraCast Now Playing data: https://www.azuracast.com/docs/developers/now-playing-data/
