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
npm run dev       # servidor local Vite en puerto 3000
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

## Calidad y release

Antes de abrir un PR o desplegar:

```bash
npm run verify
npm run audit:ci
```

El checklist de lanzamiento esta en `docs/LAUNCH_CHECKLIST.md`. Para ventas publicas, completa primero prueba controlada de compra, emision de ticket, correo, QR, validacion y procedimiento de soporte.

Los playbooks operativos estan en `docs/OPERATIONS_PLAYBOOKS.md`. El panel admin incluye alertas vivas en la seccion Operacion.

El presupuesto de performance esta en `docs/PERFORMANCE_BUDGET.md` y corre dentro de `npm run verify`.

El modelo de gobernanza, auditoria administrativa y soporte esta en `docs/GOVERNANCE_MODEL.md`. Cambios de rol, eliminacion de perfiles y gestion de soporte deben pasar por RPCs auditadas.

## Seguridad operativa

- No comitear `.env`, service role keys, llaves Wompi, VAPID privadas ni JWK privada de tickets.
- Rotar secretos ante cualquier exposicion.
- Revisar `npm audit` en cada sprint. El CI bloquea vulnerabilidades de severidad alta o superior.
