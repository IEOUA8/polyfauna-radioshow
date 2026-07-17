# PolyFauna Platform

Aplicacion React/Vite con Supabase para radio, comunidad, eventos, tickets, pagos Wompi, PWA, notificaciones y paneles operativos.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.
- Proyecto Supabase con las migraciones de `supabase/migrations` aplicadas.
- Variables de entorno basadas en `.env.example`.

## Instalacion local

```bash
npm ci
cp .env.example .env
npm run dev
```

Completa `.env` con credenciales reales antes de probar flujos conectados a Supabase, Wompi, email, push o R2.

## Comandos

```bash
npm run dev       # servidor local Vite en puerto 5173
npm run lint      # reglas estaticas
npm test          # pruebas automatizadas
npm run security:check # busqueda local de secretos hardcodeados
npm run build     # build productivo + SEO/prerender
npm run perf:budget # presupuesto de bundle sobre dist/
npm run verify    # lint + tests + seguridad + build
npm run audit:ci  # auditoria alta para CI
```

## Variables

El frontend falla rapido si faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`. Esto evita despliegues accidentales contra un backend equivocado.

Las Edge Functions requieren variables adicionales para Supabase service role, Wompi, Resend, VAPID, R2 y firma de tickets. Usa `.env.example` como contrato minimo y configura los secretos reales en Supabase/Vercel, no en git.

## Base de datos y funciones

- Las migraciones viven en `supabase/migrations`.
- Las Edge Functions viven en `supabase/functions`.
- Las funciones sensibles usan `SUPABASE_SERVICE_ROLE_KEY`; nunca debe exponerse al cliente.
- Los cambios en RLS, pagos, tickets, wallets o validacion offline deben incluir pruebas antes de release.
- La aplicacion detallada de migraciones, reparacion de historial y despliegue de funciones esta en `docs/DEPLOYMENT_AND_MIGRATIONS.md`.

## Documentacion

- `docs/ARCHITECTURE_AND_MODULES.md`: arquitectura vigente, rutas, modulos publicos, panel operativo, modelo de roles y capacidades transversales.
- `docs/DEPLOYMENT_AND_MIGRATIONS.md`: inventario de Edge Functions, variables, migraciones Supabase, Vercel y verificacion de produccion.
- `docs/IMPLEMENTATION_PHASES.md`: historial de implementacion y decisiones por fase.
- `docs/OPERATIONS_PLAYBOOKS.md`: respuesta operativa ante incidentes de pagos, tickets, radio, correo y validacion.
- `docs/GOVERNANCE_MODEL.md`: roles, auditoria administrativa y soporte.
- `docs/CAPACITY_UX_PLAN.md`: capacidad, telemetria, RLS y criterios de carga.
- `docs/PERFORMANCE_BUDGET.md`: limites automatizados del bundle.
- `docs/LAUNCH_CHECKLIST.md`: pendientes verificables antes de beta y ventas publicas.

`docs/POLYFAUNA_EVENTOS_ORGANIZADORES_MASTER.md` se conserva como documento historico de diseno. Para el comportamiento actual prevalecen `ARCHITECTURE_AND_MODULES.md`, las migraciones y las pruebas de contrato.

## Calidad y release

Antes de abrir un PR o desplegar:

```bash
npm run verify
npm run audit:ci
```

El checklist de lanzamiento esta en `docs/LAUNCH_CHECKLIST.md`. Para ventas publicas, completa primero prueba controlada de compra, emision de ticket, correo, QR, validacion y procedimiento de soporte.

Los playbooks operativos estan en `docs/OPERATIONS_PLAYBOOKS.md`. El panel admin incluye alertas vivas en la seccion Operacion.

El presupuesto de performance esta en `docs/PERFORMANCE_BUDGET.md` y corre dentro de `npm run verify`.

Estado al 2026-07-17: lint de fuentes, pruebas y build pasan, pero JS total gzip supera el presupuesto por 9.4 KiB. Consulta `docs/PERFORMANCE_BUDGET.md`; no se debe considerar `verify` completamente en verde hasta resolverlo.

El modelo de gobernanza, auditoria administrativa y soporte esta en `docs/GOVERNANCE_MODEL.md`. Cambios de rol, eliminacion de perfiles y gestion de soporte deben pasar por RPCs auditadas.

El plan de capacidad y experiencia esta en `docs/CAPACITY_UX_PLAN.md`. Centraliza decisiones sobre escucha, usuarios activos, contenido real, checkout, medicion y pruebas de carga.

El despliegue del frontend ocurre automaticamente en Vercel al hacer push a `main`. Las migraciones y Edge Functions de Supabase son un plano separado y deben verificarse de forma explicita; un deploy correcto de Vercel no implica que el backend haya quedado actualizado.

## Seguridad operativa

- No comitear `.env`, service role keys, llaves Wompi, VAPID privadas ni JWK privada de tickets.
- Rotar secretos ante cualquier exposicion.
- Revisar `npm audit` en cada sprint. El CI bloquea vulnerabilidades de severidad alta o superior.
