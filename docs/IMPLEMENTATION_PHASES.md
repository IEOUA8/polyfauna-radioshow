# PolyFauna - Registro de implementacion por fases

Este documento registra que se implemento en cada fase, como se verifico y que queda pendiente para la siguiente iteracion.

## Fase 1 - Fundaciones de ingenieria

Fecha: 2026-06-24

### Objetivo

Crear una base repetible para desarrollo y despliegue: CI, contrato de variables, comandos comunes y documentacion operativa minima.

### Implementacion

- Se agrego CI en `.github/workflows/ci.yml`.
- Se agregaron scripts `verify` y `audit:ci` en `package.json`.
- Se elimino el fallback hardcodeado de Supabase en `src/lib/customSupabaseClient.js`.
- Se amplio `.env.example` con variables usadas por frontend, Edge Functions, Wompi, email, push, R2 y firma de tickets.
- Se agrego `README.md` con instalacion local, comandos, variables, release y notas de seguridad.
- Se ejecuto `npm audit fix` para corregir dependencias vulnerables que no requerian upgrade mayor.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. Quedo pendiente el bloque Vite/esbuild porque requeria upgrade mayor y se movio a Fase 2.

### Pendientes trasladados

- Resolver Vite/esbuild con upgrade mayor.
- Subir `npm audit` de severidad critica a severidad alta.
- Agregar chequeos preventivos de secretos.

## Fase 2 - Seguridad y confianza

Fecha: 2026-06-24

### Objetivo

Reducir riesgo operativo y de seguridad antes de ampliar pruebas criticas: dependencias sin vulnerabilidades conocidas, controles anti-secretos, payloads mas acotados y menor superficie de abuso en funciones sensibles.

### Implementacion

- Se actualizo Vite y `@vitejs/plugin-react` a versiones actuales compatibles con Node definido en `.nvmrc`.
- Se cambio `audit:ci` a `npm audit --audit-level=high`.
- Se agrego `tools/security-check.js` para detectar:
  - JWTs hardcodeados.
  - URLs reales de Supabase hardcodeadas.
  - access keys AWS/R2.
  - llaves Wompi hardcodeadas.
  - JWK privadas hardcodeadas.
  - archivos `.env` versionados por error.
- Se integro `npm run security:check` en `npm run verify` y en CI.
- Se endurecio `supabase/functions/get-upload-url/index.ts`:
  - metodo `POST` obligatorio.
  - limite de payload.
  - carpetas permitidas.
  - `fileSizeBytes` obligatorio y positivo.
  - extension derivada desde `contentType`, no desde `filename`.
  - keys R2 con `crypto.randomUUID()`.
- Se endurecio `supabase/functions/send-push/index.ts`:
  - metodo `POST` obligatorio.
  - limite de payload.
  - titulo obligatorio y textos normalizados.
  - URLs de notificacion limitadas al origen de `APP_URL`.
- Se endurecio `supabase/functions/create-payment/index.ts`:
  - limite de payload.
  - errores internos de insercion registrados en logs, no expuestos al cliente.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. `npm audit --audit-level=high` queda en cero vulnerabilidades conocidas.

### Pendientes para Fase 3

- Tests automatizados para pagos, tickets, QR firmado, validacion online/offline y permisos.
- Tests de integracion para webhooks Wompi duplicados y emision atomica.
- Pruebas de sincronizacion offline con conflictos.

## Fase 3 - Testing de flujos criticos

Fecha: 2026-06-24

### Objetivo

Ampliar la cobertura automatizada sobre las rutas donde un fallo afecta dinero, acceso a eventos, seguridad o confianza operativa.

### Implementacion

- Se amplio `tests/tickets.test.js`:
  - QR canonico y compatibilidad legacy.
  - QR firmado valido con WebCrypto.
  - QR firmado expirado.
  - QR firmado manipulado.
- Se agrego `src/lib/offlineTicketRules.js` para extraer la decision pura del validador offline.
- Se actualizo `src/lib/offlineTickets.js` para usar `evaluateOfflineTicket` sin cambiar el flujo IndexedDB/Supabase.
- Se agrego `tests/offline-ticket-rules.test.js`:
  - evento no seleccionado.
  - QR sin firma valida.
  - evento equivocado.
  - paquete offline no descargado.
  - ticket ausente del paquete.
  - ticket usado, reembolsado o ya escaneado localmente.
  - ticket valido pendiente de sincronizacion.
- Se refactorizo `tools/security-check.js` para exportar `findSecurityIssues` y mantener su uso como CLI.
- Se agrego `tests/security-check.test.js`:
  - deteccion de JWTs, URLs reales de Supabase, llaves Wompi y JWK privadas.
  - deteccion de `.env` versionados.
  - excepciones permitidas para placeholders y documentacion.
- Se agrego `tests/payment-ticket-contracts.test.js` como pruebas de contrato para codigo SQL/Edge Functions:
  - `fulfill_paid_transaction` conserva locks, idempotencia, inventario atomico y ejecucion solo por `service_role`.
  - `validate_ticket` conserva autorizacion y uso unico.
  - webhook Wompi conserva firma, monto, moneda e idempotencia.
  - checkout conserva limite de tickets, checkout pendiente y firma de integridad.
  - sync offline conserva auditoria, idempotencia y locks.

### Verificacion

```bash
npm test
```

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. La suite automatizada queda en 18 pruebas.

### Pendientes para Fase 4 o una subfase de integracion

- Levantar Supabase local o ambiente staging y ejecutar pruebas de integracion reales contra RPCs.
- Simular webhook Wompi duplicado con payload firmado real.
- Probar compra exitosa con transaccion pendiente y evento con inventario limitado.
- Probar conflictos de sincronizacion offline entre dos dispositivos.
- Agregar E2E de navegador para compra, Ticket Vault, descarga PDF y validador QR.

## Fase 4 - Observabilidad y operacion

Fecha: 2026-06-24

### Objetivo

Convertir senales operativas en alertas accionables para administracion, y documentar respuestas repetibles ante incidentes de pagos, tickets, errores, soporte y validacion offline.

### Implementacion

- Se agrego `supabase/migrations/20260624000001_operational_alerts.sql`.
- Se creo la RPC admin-only `get_operational_alerts()` con alertas calculadas para:
  - pagos aprobados sin tickets.
  - mismatch entre `transactions.quantity` y tickets emitidos.
  - eventos sobrevendidos.
  - checkouts pendientes antiguos.
  - errores cliente recientes.
  - devoluciones abiertas por mas de 24 horas.
  - retiros pendientes por mas de 48 horas.
  - conflictos de validacion offline sincronizados recientemente.
- Se agrego la seccion `Operacion` al panel admin.
- Se conecto `AdminDashboard` a `supabase.rpc('get_operational_alerts')`.
- Se agregaron estados de carga, error, cero alertas, severidad critica/warning, conteos y accion sugerida.
- Se creo `docs/OPERATIONS_PLAYBOOKS.md` con playbooks para:
  - pago aprobado sin ticket.
  - webhook Wompi fallido o duplicado.
  - evento sobrevendido.
  - error cliente elevado.
  - devolucion sin respuesta.
  - retiro pendiente.
  - conflictos de validacion offline.
  - backup y restauracion.
- Se amplio `tests/payment-ticket-contracts.test.js` para cubrir la presencia de alertas operativas criticas.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. La suite automatizada queda en 19 pruebas y `npm audit --audit-level=high` queda en cero vulnerabilidades conocidas.

### Pendientes para Fase 5

- Dashboard de metricas historicas por ventana de tiempo.
- Alertas externas por email/push/Slack cuando haya criticas activas.
- Prueba de restauracion documentada contra ambiente staging real.
- E2E de navegador para admin > Operacion.

## Fase 5 - Performance y experiencia premium

Fecha: 2026-06-24

### Objetivo

Reducir peso percibido, prevenir regresiones de bundle y mejorar la experiencia PWA cuando hay nuevas versiones disponibles.

### Implementacion

- Se movio `html5-qrcode` a import dinamico en:
  - `src/pages/AdminDashboard.jsx`
  - `src/pages/ValidatePage.jsx`
- Se separaron dependencias PDF en `vite.config.js`:
  - `vendor-pdf`
  - `vendor-html2canvas`
  - `vendor-pdf-renderers`
- Se agrego `tools/performance-budget.js`.
- Se agrego el script `npm run perf:budget`.
- Se integro `perf:budget` dentro de `npm run verify`.
- Se creo `docs/PERFORMANCE_BUDGET.md` con limites y reglas de cuidado.
- Se agrego `src/components/AppUpdateBanner.jsx`.
- Se actualizo `src/main.jsx` para emitir `polyfauna-sw-update` cuando hay un service worker nuevo esperando.
- Se actualizo `public/sw.js` a `polyfauna-v4` y se removio `skipWaiting()` automatico durante install; ahora la actualizacion ocurre cuando el usuario acepta.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. El presupuesto de performance queda aprobado con baseline:

- JS inicial gzip: 158.6 KiB / 190 KiB.
- CSS inicial gzip: 18.5 KiB / 30 KiB.
- Chunk lazy mayor gzip: 125.7 KiB / 260 KiB.
- JS total gzip: 680.1 KiB / 720 KiB.

### Pendientes para Fase 6

- Lighthouse/Web Vitals en movil real o throttling equivalente.
- Auditoria de accesibilidad con lector de pantalla/teclado.
- E2E visual para compra, Ticket Vault, QR y panel Operacion.
- Optimizar `framer-motion` si el JS inicial vuelve a acercarse al limite.

## Fase 6 - Gobernanza, auditoria y soporte

Fecha: 2026-06-24

### Objetivo

Elevar la madurez operativa de la plataforma: acciones administrativas trazables, cambios de rol atomicos, soporte interno modelado en base de datos y una separacion mas clara entre automatismos reales y operaciones manuales.

### Implementacion

- Se agrego `supabase/migrations/20260624000002_governance_audit_support.sql`.
- Se creo `admin_audit_log` con RLS de lectura solo para admins.
- Se creo `support_cases` con RLS para usuario propietario y administradores.
- Se agregaron RPCs administrativas:
  - `log_admin_action`.
  - `set_user_role`.
  - `delete_profile_admin`.
  - `update_support_case`.
  - `process_role_request_admin`.
- Se bloquearon dos errores operativos peligrosos:
  - un admin no puede quitarse a si mismo el rol admin.
  - un admin no puede eliminar su propio perfil.
- Se cambio `UserManager` para usar RPCs auditadas al modificar roles o eliminar perfiles.
- Se cambio `RoleRequestsPanel` para aprobar/rechazar solicitudes mediante `process_role_request_admin`, manteniendo rol y solicitud en una sola transaccion.
- Se agrego la seccion `Soporte` al panel admin con conteos, filtros, estados, prioridades y notas internas auditadas.
- Se creo `docs/GOVERNANCE_MODEL.md`.
- Se ampliaron pruebas de contrato para fijar:
  - existencia de tablas/RLS/RPCs de gobernanza.
  - protecciones de self-demotion y self-delete.
  - uso de RPCs auditadas desde el panel admin.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. La suite automatizada queda en 21 pruebas y `npm audit --audit-level=high` queda en cero vulnerabilidades conocidas.

### Pendientes para Fase 7

- Crear formulario publico/autenticado para apertura de casos de soporte.
- Automatizar alertas externas por email/push/Slack para casos urgentes y alertas criticas.
- Agregar E2E de navegador para admin > Soporte y admin > Usuarios.
- Evaluar Edge Function con service role para baja completa en `auth.users` con doble confirmacion.

## Fase 7.1 - Capacidad y experiencia de escucha

Fecha: 2026-06-24

### Objetivo

Reducir carga repetida generada por la experiencia de radio y dejar una ruta documentada para escalar usuarios activos, escucha, musica, eventos y compra de tickets sin sobrecargar la plataforma.

### Implementacion

- Se creo `docs/CAPACITY_UX_PLAN.md` con:
  - baseline tecnico actual.
  - mediciones iniciales de base de datos, conexiones, bundle y advisors Supabase.
  - explicacion de centralizar `NowPlaying` en un provider unico.
  - fases siguientes para RLS, medicion real, contenido real, checkout y pruebas de carga.
  - reglas para evitar sobrecarga.
  - senales operativas a vigilar.
- Se refactorizo `src/hooks/useNowPlaying.js`:
  - ahora exporta `NowPlayingProvider`.
  - `useNowPlaying()` consume un contexto unico.
  - se prioriza `/nowplaying_static/{station}.json`.
  - se conserva fallback a `/nowplaying/{station}`.
  - se reemplazo `setInterval` por `setTimeout` encadenado para evitar peticiones solapadas.
  - el polling normal queda en 15 segundos y el reintento tras error en 30 segundos.
  - se exponen metricas ligeras en `window.__polyfaunaNowPlayingMetrics`.
- Se actualizo `src/App.jsx` para montar `NowPlayingProvider` alrededor de las rutas.
- Se agrego `tests/now-playing-provider-contract.test.js` para fijar:
  - provider centralizado.
  - endpoint estatico cacheable.
  - polling sin `setInterval`.
  - consumidores sin `fetch()` directo.
  - metricas de diagnostico.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado: ambas compuertas pasaron. La suite automatizada queda en 25 pruebas, `npm audit --audit-level=high` queda en cero vulnerabilidades conocidas y el presupuesto de performance queda aprobado:

- JS inicial gzip: 159.4 KiB / 190 KiB.
- CSS inicial gzip: 18.5 KiB / 30 KiB.
- Chunk lazy mayor gzip: 125.7 KiB / 260 KiB.
- JS total gzip: 681.9 KiB / 720 KiB.

### Pendientes para Fase 7.2

- Corregir advisors Supabase de mayor impacto antes de aumentar trafico.
- Agregar telemetria de usuarios activos y embudo de escucha/eventos/checkout.
- Preparar pruebas de carga controladas por flujo.
- Continuar carga de contenido real sin reintroducir datos genericos.

## Fase 7.2 - Endurecimiento Supabase previo a carga

Fecha: 2026-06-25

### Objetivo

Reducir riesgo de seguridad y costo por consulta antes de subir usuarios activos, sin alterar flujos criticos de compra, tickets, validacion, soporte y operacion.

### Implementacion

- Se agrego y aplico en Supabase la migracion `20260625015236_phase_7_2_supabase_hardening.sql`.
- Se fijo `search_path = public` para funciones marcadas por advisors:
  - `update_likes_count`.
  - `get_user_id_by_email`.
  - `count_user_event_tickets`.
  - `increment_podcast_plays`.
  - `create_notification`.
  - `set_updated_at`.
  - `touch_ticket_refund_request`.
  - `apply_ticket_refund_status`.
  - `touch_support_case_updated_at`.
- Se revoco ejecucion publica/anonima de funciones `SECURITY DEFINER` que no deben exponerse como RPC abierta.
- Se mantuvo `authenticated` en funciones que la app usa desde cliente y que ya tienen validacion interna:
  - compra y validacion de tickets.
  - offline pack y sincronizacion offline.
  - alertas operativas.
  - wallets/retiros.
  - asistentes de eventos.
  - soporte/gobernanza.
- Se reservo `create_notification` para `service_role`, porque no tenia chequeo interno de rol.
- Se eliminaron politicas broad `SELECT` sobre `storage.objects` para buckets publicos:
  - `album-covers`.
  - `avatars`.
  - `podcast-audio`.
  - `podcast-covers`.
  - `track-audio`.
- Se elimino la politica `solo_admin_puede_featured` con `USING (true)`.
- Se agrego `events_featured_admin_guard` como politica restrictiva para impedir que usuarios no admin dejen eventos como destacados.
- Se agrego `tests/supabase-hardening-contracts.test.js`.

### Verificacion

```bash
npm test
supabase db push --linked
supabase db advisors --linked --output json
```

Resultado:

- Migracion aplicada correctamente al Supabase enlazado.
- Suite automatizada: 29 pruebas OK.
- Advisors antes: 485 warnings totales, 45 de seguridad, 440 de performance.
- Advisors despues: 458 warnings totales, 19 de seguridad, 439 de performance.
- Eliminados completamente:
  - `function_search_path_mutable`: 9 -> 0.
  - `anon_security_definer_function_executable`: 7 -> 0.
  - `public_bucket_allows_listing`: 5 -> 0.
  - `rls_policy_always_true`: 1 -> 0.

### Pendientes para Fase 7.3

- Consolidar politicas RLS duplicadas por tabla para reducir `multiple_permissive_policies`.
- Reescribir politicas con `(SELECT auth.uid())` y `(SELECT auth.role())` donde aplique para reducir `auth_rls_initplan`.
- Revisar las 18 funciones `SECURITY DEFINER` disponibles para `authenticated` y decidir cuales deben moverse a Edge Functions o roles mas especificos.
- Activar leaked password protection desde el dashboard de Supabase Auth.

## Fase 7.3 - Optimizacion RLS para carga

Fecha: 2026-06-25

### Objetivo

Reducir el costo de evaluacion de RLS por fila y eliminar politicas redundantes antes de aumentar usuarios activos, escucha, catalogo real y checkout.

### Implementacion

- Se agregaron y aplicaron en Supabase tres migraciones:
  - `20260625015951_phase_7_3_rls_initplan_optimization.sql`.
  - `20260625020218_phase_7_3b_rls_auth_literal_rewrite.sql`.
  - `20260625020339_phase_7_3c_rls_policy_roles.sql`.
- Se reescribieron politicas existentes desde `pg_policy` para convertir:
  - `auth.uid()` en `(SELECT auth.uid())`.
  - `auth.role()` en `(SELECT auth.role())`.
- Se agrego una segunda reescritura literal para cubrir expresiones que no coincidieron con el primer regex.
- Se eliminaron politicas `service_role` redundantes en tablas publicas; `service_role` ya bypassa RLS en Supabase.
- Se elimino `events_public_read`, que habia sido reintroducida por una migracion posterior.
- Se recreo `events_visible_read` como la politica publica correcta por estado de evento.
- Se limitaron politicas privadas owner/admin/promoter/user a `TO authenticated`.
- Se mantuvieron publicas las politicas intencionales de lectura abierta, como eventos visibles y notificaciones globales.
- Se amplio `tests/rls-optimization-contracts.test.js` para fijar el comportamiento.

### Verificacion

```bash
npm test
supabase db push --linked
supabase db advisors --linked --output json
```

Resultado:

- Migraciones aplicadas correctamente al Supabase enlazado.
- Suite automatizada: 34 pruebas OK.
- Advisors al inicio de la fase RLS: 458 warnings totales, 439 de performance, 19 de seguridad.
- Advisors despues de 7.3c: 58 warnings totales, 39 de performance, 19 de seguridad.
- `auth_rls_initplan`: 79 -> 0.
- `multiple_permissive_policies`: 360 -> 39.

### Pendientes para Fase 7.4

- Consolidar manualmente las 39 politicas permisivas restantes por tabla, especialmente:
  - `profiles`.
  - `events`.
  - `promoter_accounts`.
  - `messages`.
  - `support_cases`.
  - `ticket_refund_requests`.
- Revisar las 18 funciones `SECURITY DEFINER` disponibles para `authenticated` y decidir cuales deben moverse a Edge Functions o RPCs mas especificas.
- Activar leaked password protection desde el dashboard de Supabase Auth.
- Empezar medicion de usuarios activos y embudo de escucha/eventos/checkout.

## Fase 7.4 - Consolidacion RLS final

Fecha: 2026-06-25

### Objetivo

Eliminar los warnings de performance restantes de Supabase Advisors, consolidando politicas permisivas duplicadas sin cerrar accesos publicos intencionales ni romper flujos owner/admin/promoter.

### Implementacion

- Se agrego y aplico en Supabase la migracion `20260625020755_phase_7_4_rls_policy_consolidation.sql`.
- Se reemplazaron politicas `*_admin_write FOR ALL` por politicas separadas:
  - `*_admin_insert`.
  - `*_admin_update`.
  - `*_admin_delete`.
- Se consolidaron politicas por accion en:
  - `events`.
  - `profiles`.
  - `promoter_accounts`.
  - `wallets`.
  - `transactions`.
  - `payouts`.
  - `messages`.
  - `user_tickets`.
  - `role_requests`.
  - `support_cases`.
  - `ticket_refund_requests`.
  - `show_questions`.
  - `podcast_comments`.
  - `playlists`, mediante bloque condicional porque parte de su SQL vive fuera de `supabase/migrations`.
- Se agrego `tests/rls-consolidation-contracts.test.js`.

### Verificacion

```bash
npm test
supabase db push --linked
supabase db advisors --linked --output json
```

Resultado:

- Migracion aplicada correctamente al Supabase enlazado.
- Suite automatizada: 38 pruebas OK.
- Advisors antes de la fase: 58 warnings totales, 39 de performance, 19 de seguridad.
- Advisors despues de la fase: 19 warnings totales, 0 de performance, 19 de seguridad.
- `multiple_permissive_policies`: 39 -> 0.

### Pendientes para Fase 7.5

- Revisar las funciones `SECURITY DEFINER` disponibles para `authenticated`:
  - decidir cuales se mantienen como RPC con validacion interna.
  - mover a Edge Function o servicio admin las que no deban ser invocables desde cliente.
- Activar leaked password protection en Supabase Auth.
- Empezar medicion de usuarios activos y embudo de escucha/eventos/checkout.

## Fase 7.5 - Reduccion de superficie SECURITY DEFINER

Fecha: 2026-06-25

### Objetivo

Reducir la superficie RPC expuesta a usuarios autenticados sin romper los flujos activos de admin, compra, tickets, soporte, wallets, validacion y operacion.

### Implementacion

- Se auditaron las funciones `SECURITY DEFINER` marcadas por Supabase Advisors.
- Se compararon las RPCs expuestas contra llamadas reales en frontend.
- Se identificaron dos helpers internos sin uso directo desde cliente:
  - `is_current_user_admin()`.
  - `log_admin_action(TEXT, TEXT, UUID, UUID, JSONB)`.
- Se agrego y aplico en Supabase la migracion `20260625022121_phase_7_5_security_definer_surface.sql`.
- Se revoco ejecucion de esos helpers para:
  - `PUBLIC`.
  - `anon`.
  - `authenticated`.
- Se mantuvo ejecucion solo para `service_role`.
- Las RPCs administrativas que dependen de esos helpers mantienen acceso interno porque ejecutan como `SECURITY DEFINER`.
- Se mantuvieron disponibles para `authenticated` las RPCs que la aplicacion si invoca desde cliente y que tienen validaciones internas:
  - `approve_payout`.
  - `delete_profile_admin`.
  - `get_event_attendees`.
  - `get_event_offline_pack`.
  - `get_operational_alerts`.
  - `get_or_create_wallet`.
  - `increment_podcast_plays`.
  - `process_role_request_admin`.
  - `purchase_ticket`.
  - `request_payout`.
  - `set_user_role`.
  - `sync_offline_ticket_scans`.
  - `update_attendee_profile`.
  - `update_support_case`.
  - `validate_ticket`.
  - `validate_ticket_for_event`.
- Se agrego `tests/security-definer-surface-contracts.test.js`.

### Verificacion

```bash
npm test
supabase db push --linked
supabase db advisors --linked --output json
```

Resultado:

- Migracion aplicada correctamente al Supabase enlazado.
- Suite automatizada: 40 pruebas OK.
- Advisors antes de la fase: 19 warnings totales, 0 de performance, 19 de seguridad.
- Advisors despues de la fase: 17 warnings totales, 0 de performance, 17 de seguridad.
- `authenticated_security_definer_function_executable`: 18 -> 16.

### Pendientes para Fase 7.6

- Activar leaked password protection desde el dashboard de Supabase Auth.
- Revisar las 16 RPCs `SECURITY DEFINER` restantes por criticidad:
  - mantener como RPC cliente si tienen validacion interna suficiente.
  - mover a Edge Function o flujo server-side si requieren secreto, rate limit adicional o contexto admin.
- Implementar telemetria anonima de usuarios activos y embudo de escucha/eventos/checkout.
- Ejecutar pruebas de carga controladas por flujo antes de abrir contenido real y ventas con alto trafico.

## Fase 7.6 - Telemetria anonima de capacidad y embudo

Fecha: 2026-06-25

### Objetivo

Medir usuarios activos, reproduccion, vista de eventos y conversion de checkout sin sobrecargar Supabase ni capturar datos personales innecesarios.

### Implementacion

- Se agrego y aplico en Supabase la migracion `20260625120400_usage_telemetry.sql`.
- Se creo la tabla `usage_events` con:
  - `session_id`.
  - `user_id` opcional.
  - `event_name`.
  - `route`.
  - `referrer`.
  - `release`.
  - `properties` JSONB limitado.
  - `created_at`.
- Se habilito RLS en `usage_events`.
- Se revoco acceso directo a `PUBLIC`, `anon` y `authenticated`.
- Se concedio solo `SELECT` a `authenticated`, condicionado por politica admin.
- Se concedio escritura completa solo a `service_role`.
- Se creo y desplego la Edge Function `collect-usage-event`.
- La funcion aplica:
  - allowlist de eventos.
  - allowlist de propiedades.
  - sanitizacion de rutas sin querystring.
  - limite de 24 eventos por minuto por sesion.
  - rechazo de payloads mayores a 8 KB.
- Se extendio `src/lib/telemetry.js` con `trackUsageEvent`.
- Se agrego `src/components/UsageTelemetry.jsx` para:
  - `route_view`.
  - `session_heartbeat` cada 60 segundos cuando la pestana esta visible.
- Se instrumento `GlobalPlayer` para:
  - `stream_start` en radio live.
  - `media_start` en contenido on-demand.
- Se instrumento `EventPublicPage` y `EventTerminal` para:
  - `event_view`.
  - `checkout_start`.
  - `checkout_ready`.
  - `ticket_claimed`.
  - `checkout_error`.
- Se agrego `tests/usage-telemetry-contracts.test.js`.

### Verificacion

```bash
npm run verify
npm run audit:ci
supabase db push --linked
supabase functions deploy collect-usage-event
supabase db advisors --linked --output json
```

Resultado:

- Migracion aplicada correctamente al Supabase enlazado.
- Edge Function desplegada en el proyecto Supabase enlazado.
- Suite automatizada: 43 pruebas OK.
- `npm run verify`: OK.
- `npm run audit:ci`: 0 vulnerabilidades altas.
- Performance budget:
  - JS inicial gzip: 160.1 KiB / 190 KiB.
  - CSS inicial gzip: 18.5 KiB / 30 KiB.
  - Chunk lazy mayor gzip: 125.7 KiB / 260 KiB.
  - JS total gzip: 682.9 KiB / 720 KiB.
- Advisors despues de la fase: 17 warnings totales, 0 de performance, 17 de seguridad.

### Pendientes para Fase 7.7

- Crear tablero admin sobre `usage_events` con:
  - usuarios activos por ventana.
  - reproducciones live/on-demand.
  - vistas de eventos.
  - conversion `event_view -> checkout_start -> checkout_ready -> ticket_claimed`.
  - errores de checkout por evento/release.
- Agregar medicion especifica de Ticket Vault y validador cuando se prepare operacion de puertas.
- Definir umbrales de alerta para detener campanas o ventas si suben errores de checkout o caen conversiones.
- Activar leaked password protection desde Supabase Auth.

## Fase 7.7 - Tablero administrativo de telemetria

Fecha: 2026-06-30

### Objetivo

Convertir la telemetria anonima existente en senales operativas visibles para administracion, sin descargar eventos crudos al navegador ni ampliar acceso a datos sensibles.

### Implementacion

- Se agregaron y aplicaron:
  - `supabase/migrations/20260630000001_usage_metrics_dashboard.sql`.
  - `supabase/migrations/20260630000002_usage_metrics_security_invoker.sql`.
- Se creo la RPC admin-only `get_usage_metrics(p_hours)` con ventanas permitidas de:
  - 1 hora.
  - 6 horas.
  - 24 horas.
  - 7 dias.
  - 30 dias.
- La RPC agrega en servidor:
  - sesiones unicas.
  - usuarios autenticados unicos.
  - inicios de radio live.
  - reproducciones on-demand.
  - vistas de eventos.
  - errores de checkout.
  - embudo `event_view -> checkout_start -> checkout_ready -> ticket_claimed`.
  - actividad por hora o dia.
  - errores agrupados por evento, codigo y release.
- Se agrego la seccion `Metricas` al panel administrativo.
- Se agregaron estados de carga, error, cero datos, selector de ventana, actividad visual, embudo y detalle de errores.
- Se ampliaron las pruebas de contrato de telemetria.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado:

- Suite automatizada: 45 pruebas OK.
- Migracion aplicada correctamente al proyecto Supabase enlazado.
- La RPC ejecuta como `SECURITY INVOKER`, valida rol admin y no expone eventos crudos.
- `npm run verify`: OK.
- `npm run audit:ci`: 0 vulnerabilidades.
- Supabase Advisors: 17 warnings de seguridad ya conocidos, 0 de performance y ninguno nuevo para `get_usage_metrics`.

### Pendientes para Fase 7.8

- Agregar medicion especifica de Ticket Vault y validacion online/offline.
- Definir umbrales y alertas externas para errores de checkout o caidas de conversion.
- Activar leaked password protection desde Supabase Auth.
- Ejecutar la prueba controlada completa de compra, correo, QR y devolucion.

## Fase 7.8 - Auditoria y mejoras de rendimiento

Fecha: 2026-07-02

### Objetivo

Revisar el proyecto completo en busca de cuellos de botella de carga y renderizado, y corregir los de mayor impacto con menor riesgo primero.

### Implementacion

- Animaciones CSS (`@keyframes`) en lugar de un `motion.div` de framer-motion por barra en `HoloSpectrum.jsx` (usado en Sidebar, GlobalPlayer y RadioConsolePage, montado casi toda la sesion) y en `MiniSignalBars` (GlobalPlayer). Elimina el costo de JS/rAF continuo mientras suena la radio.
- Correccion de bug real en `AdminDashboard.jsx` (`DashboardSection`): hacia 2 consultas extra de `user_tickets` fuera del `Promise.all` y sin filtrar por `ownerId`, por lo que el dashboard de un promotor mostraba ingresos y total de tickets de toda la plataforma, no solo los suyos. Se unifico en una sola consulta `events!inner(price, owner_id)` escopeada, dentro del mismo `Promise.all`.
- `.limit()` agregado a consultas sin limite: `SignalInbox.jsx` (mensajes enviados/recibidos), `BlogInterviewsSection.jsx` e `InterviewsSection.jsx` (articulos/entrevistas).
- `loading="lazy"` en imagenes fuera del viewport inicial (`ArtistsPage.jsx`, `RightPanel.jsx`, `EventTerminal.jsx`), dejando eager solo las que son LCP real (hero de detalle de artista/podcast).
- `EventCard` (grilla de `EventTerminal.jsx`) extraido como componente memoizado (`React.memo`) para que el auto-avance del banner destacado (cada 8s) no vuelva a renderizar toda la grilla de eventos. Para que la memoizacion funcione, `useFavorites.js` y `useLikes.js` ahora envuelven `isFav`/`isLiked`/`toggle` en `useCallback` (antes eran funciones nuevas en cada render, lo que invalidaba cualquier memoizacion rio abajo).
- Codigo muerto eliminado: `Hero.jsx`, `CarouselBanner.jsx`, `NextEvent.jsx`, `Events.jsx`, `Podcasts.jsx`, `src/components/HomePage.jsx` y `src/pages/HomePage.jsx` no estaban enrutados en `App.jsx` ni importados por nada alcanzable; no aparecian en el build de produccion.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado:

- Suite automatizada: 78 pruebas OK.
- Performance budget (medido con `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` reales; sin esas variables el bundler elimina `@supabase/supabase-js` del bundle por deteccion de codigo inalcanzable y el numero de JS inicial queda artificialmente bajo, ojo con esto en builds locales sin `.env`):
  - JS inicial gzip: 160.4 KiB / 190 KiB.
  - CSS inicial gzip: 17.8 KiB / 30 KiB.
  - Chunk lazy mayor gzip: 125.7 KiB / 260 KiB.
  - JS total gzip: 683.2 KiB / 720 KiB.
- `npm run audit:ci`: 0 vulnerabilidades altas.

### Pendientes para Fase 7.9

- `React.memo` para las listas de `PodcastsPage.jsx` (vista lista y cuadricula), siguiendo el mismo patron aplicado a `EventTerminal.jsx`.
- Reemplazar el patron "refetch de tabla completa tras cada mutacion" por actualizacion de estado local optimista en los managers admin (`ArtistManager.jsx`, `InterviewManager.jsx`, `EventManager.jsx`, etc.).
- Revisar si `framer-motion` es realmente necesario en componentes siempre montados (`TopBar`, `Sidebar`, `BottomNav`).

## Fase 7.9 - Cortesias a correos sin cuenta PolyFauna

Fecha: 2026-07-02

### Objetivo

Permitir que el panel operativo emita cortesias a un correo que todavia no tiene cuenta en PolyFauna, sin bloquear la emision ni perder el cupo, y activar el ticket automaticamente cuando esa persona se registre con el mismo correo.

### Implementacion

- Migracion `supabase/migrations/20260702231304_courtesy_ticket_unregistered_recipients.sql`:
  - `issue_courtesy_ticket`: si el correo no tiene cuenta, crea un `user_tickets` con `user_id NULL`, `assigned_email` y `status = 'pending_registration'` (antes lanzaba `user_not_found` y bloqueaba la emision). Sigue exigiendo identidad (nombre/documento) solo para correos ya registrados. Evita doble emision al mismo correo pendiente.
  - `validate_ticket`: rechaza el escaneo de tickets `pending_registration` con mensaje explicito indicando que el destinatario debe crear su cuenta con ese correo.
  - `handle_new_user`: al registrarse, reclama automaticamente cualquier ticket `pending_registration` cuyo `assigned_email` coincida con el correo nuevo (asigna `user_id`, pasa `status` a `valid`).
  - `get_event_attendees`: muestra `assigned_email` como correo del asistente cuando el ticket todavia no tiene usuario vinculado.
- Edge function `issue-courtesy-ticket`: rama nueva para tickets pendientes que evita `getUserById` y el push (no hay cuenta todavia) y envia la plantilla `courtesyPendingActivation` con boton de registro (`/signup?email=...`).
- Plantilla de correo nueva `courtesyPendingActivation` (mismo sistema visual que `ticketPurchased`, registrada en `tools/import-email-templates.js` y `email-templates.generated.ts`), con el mismo QR firmado que ya trae el ticket y explicacion de activacion pendiente.
- `SignupPage.jsx` prellena el correo desde el parametro `?email=` del enlace de invitacion.
- `offlineTicketRules.js`: nueva rama `PENDING_REGISTRATION` para el escaner sin conexion (antes caia en el mensaje generico `INVALID_STATUS`).
- `EventManager.jsx`: la lista de asistentes muestra una insignia morada "PENDIENTE" para estos tickets (antes se mostraban incorrectamente como "VALIDO", ya que el badge solo distinguia el estado `used` de cualquier otro).
- `AdminDashboard.jsx` (`CourtesyTicketModal`): copy actualizado indicando que los correos sin cuenta tambien reciben el QR, y toast distinto cuando la cortesia queda pendiente de activacion.

### Verificacion

```bash
npm run verify
npm run audit:ci
```

Resultado:

- Suite automatizada: 78 pruebas OK (11 nuevas en `tests/courtesy-unregistered-recipients.test.js`).
- Migracion aplicada al proyecto Supabase enlazado.
- Edge Function `issue-courtesy-ticket` desplegada al proyecto Supabase enlazado.
- `npm run audit:ci`: 0 vulnerabilidades altas.

### Pendientes para Fase 7.10

- Notificacion dentro de la plataforma (no solo por correo) cuando una cortesia pendiente se activa al registrarse.
- Prueba controlada end-to-end: emitir cortesia a un correo sin cuenta, confirmar recepcion del correo, registrarse con ese correo, confirmar que el ticket aparece activo en Ticket Vault y que el QR valida correctamente en puerta.

## Fase 7.10 - Modales de confirmacion propios en el panel operativo

Fecha: 2026-07-02 / 2026-07-03 (commits `a053ae1`, `3a9a239`)

### Objetivo

Eliminar los dialogos nativos del navegador (`window.confirm`/`window.prompt`/`window.alert`) del panel admin: no llevan marca, no se pueden estilizar y su posicion/tamano varia entre navegadores. Reemplazarlos por un modal propio con la identidad visual de Polyfauna en todos los flujos de confirmacion (eliminar, anular, transferir, rechazar).

### Implementacion

- `src/components/admin/AdminModal.jsx` (nuevo): `ModalShell` + `ModalHeader` compartidos — tarjeta oscura (`#0B1110`), borde con color de acento al 25% de opacidad, overlay con blur (`rgba(2,5,5,0.84)` + `blur(14px)`), entrada/salida animada (fade + scale via `framer-motion`), simbolo de Polyfauna en el header cuando no hay icono especifico.
- `src/components/admin/ConfirmDialog.jsx` (nuevo): hook `useConfirmDialog()` basado en promesas — `const { confirm, ConfirmDialogElement } = useConfirmDialog(); if (!(await confirm({ title, message, variant }))) return;`. Variante `destructive` usa acento rojo coral (`#FF6B6B`) con icono de papelera; el resto usa el acento cian de marca (`#20C7E8`) con icono de alerta.
- `src/components/admin/TicketActionModals.jsx`: `TransferTicketModal` y `VoidTicketModal` migrados al mismo `ModalShell`/`ModalHeader` (antes usaban `window.prompt`/`window.confirm`). El boton de confirmar en transferir dice "Enviar QR". Compartidos entre `EventManager.jsx` (Eventos -> Ver lista) y `AdminDashboard.jsx` (Tickets -> Compradores).
- `useConfirmDialog()` adoptado en los 9 gestores admin que aun usaban dialogos nativos: `ArtistManager.jsx`, `AlbumManager.jsx`, `PodcastManager.jsx`, `BlogManager.jsx`, `ShowManager.jsx`, `InterviewManager.jsx`, `UserManager.jsx`, `EventManager.jsx` (eliminar evento/tipo de entrada) y `AdminDashboard.jsx` (rechazo de retiros). De paso se unificaron mensajes que mezclaban espanol e ingles entre gestores.
- Responsividad y accesibilidad del panel operativo: fila de asistentes/compradores con `flex-wrap`/`min-w-0`/`truncate` para no romperse en pantallas angostas; formulario de editar asistente a 1 columna en movil; botones de transferir/anular/editar agrandados para uso tactil con `aria-label` (el atributo `title` solo no funciona en touch).
- Ya no queda ningun `window.confirm`/`window.prompt`/`window.alert` en `src/`.

### Verificacion

```bash
npm run verify
```

Resultado:

- Suite automatizada: 88 pruebas OK.
- Performance budget: JS inicial gzip 91.0 KiB / 190 KiB, CSS inicial gzip 17.8 KiB / 30 KiB, chunk lazy mayor 125.7 KiB / 260 KiB, JS total gzip 618.8 KiB / 720 KiB — dentro de presupuesto.
- Verificacion visual manual del modal de "Eliminar evento" en navegador (render aislado del componente): tarjeta oscura, icono de papelera en badge coral, CTA destructivo rojo, boton cancelar sutil, overlay con blur — reemplaza correctamente el `window.confirm` generico.

### Pendientes para Fase 7.11

- El commit `3a9a239` ya esta en `main` en GitHub; falta que el proveedor de hosting tome ese commit y redespliegue produccion (el sitio en vivo mostraba el dialogo nativo viejo al momento de escribir esta fase).
- Aplicar el mismo `ModalShell`/`ModalHeader` a los formularios grandes del panel (editar evento, editar articulo) que hoy usan paneles propios inconsistentes, para unificar el sistema de modales por completo.
