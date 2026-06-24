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
