# POLYFAUNA — Checklist de lanzamiento

Fecha de revisión: 2026-07-08 (revisión previa: 2026-06-22)

## Listo técnicamente

- [x] Dominio HTTPS, favicon, iconos iOS/PWA y nombre `Polyfauna`.
- [x] Metadatos SEO, Open Graph, robots.txt, sitemap.xml y páginas públicas prerenderizadas.
- [x] Sitemap enviado a Google Search Console.
- [x] Registro, inicio de sesión, recuperación de contraseña y rutas protegidas.
- [x] Roles profesionales sujetos a aprobación; nunca se conceden desde el cliente.
- [x] Panel administrativo y funciones sensibles protegidos por JWT y rol admin.
- [x] Flujo Wompi protegido con firma de integridad y webhook idempotente.
- [x] Emisión atómica de tickets y validación QR de un solo uso.
- [x] Telemetría de errores del cliente sin datos personales ni parámetros de URL.
- [x] Integración de Web Analytics y Speed Insights con rutas privadas excluidas.
- [x] Ajustes de safe area, altura y capas modales para iOS.
- [x] Presupuesto automatizado de performance para JS/CSS inicial y chunks lazy.
- [x] Aviso PWA de nueva versión disponible sin actualización silenciosa forzada.
- [x] Lint, pruebas automatizadas y build de producción aprobados.

## Prueba controlada antes de abrir ventas

- [ ] Habilitar Web Analytics y Speed Insights en el proyecto de Vercel si sus paneles aún aparecen desactivados. El SDK ya está integrado en el código (`src/components/VercelTelemetry.jsx`, `@vercel/analytics` + `@vercel/speed-insights`) — falta confirmar en el dashboard de Vercel que el proyecto tiene ambos paneles activados; no se puede verificar desde el código ni desde las herramientas disponibles en esta sesión.
- [x] Crear o escoger un evento real de precio mínimo y cupo limitado. **"Tehnology Nigth Rom"** ya existe en producción con un tier "General" a $5.000 COP y cupo de 2 — cumple el criterio, listo para usar en la prueba controlada.
- [ ] Comprar un ticket con una cuenta no administrativa y un correo accesible.
- [ ] Confirmar estado `APPROVED` en Wompi y recepción única del webhook.
- [ ] Verificar que se emita exactamente un ticket y llegue el correo de confirmación.
- [ ] Abrir el ticket desde iPhone y Android y comprobar la legibilidad del QR.
- [ ] Validar el QR desde una cuenta autorizada; el segundo intento debe marcarlo como usado.
- [ ] Ejecutar una devolución o anulación controlada y documentar el procedimiento de soporte.

## Operación de beta

- [ ] Definir correo y responsable de soporte durante las primeras 48 horas. El **correo** ya está definido y visible en la plataforma (`info@polyfauna.com`, tile "Soporte" en Control Center, mailto en Términos). Falta definir quién es la **persona responsable** de monitorearlo durante las primeras 48 horas — es una decisión operativa, no de código.
- [x] Definir política pública de privacidad, términos, reembolsos y tratamiento de datos. Ya implementado en Control Center: cláusulas de "Compra de tickets" y "Devoluciones y cancelaciones" alineadas con la Ley 1480 de 2011 (Estatuto del Consumidor colombiano), más sección de derechos de datos personales. Pendiente de revisión por un abogado antes de depender de la redacción exacta en un caso real (nota ya existente en el commit original).
- [x] Configurar alertas internas para errores de cliente, pagos sin ticket, inconsistencias de tickets, devoluciones, retiros y conflictos offline.
- [x] Configurar alertas externas para incidentes críticos fuera del panel admin. Implementado: `pg_cron` dispara `trigger_operational_alerts_email()` cada 15 minutos, la Edge Function `send-operational-alert` envía correo a `info@polyfauna.com` vía Resend cuando hay alertas `critical` nuevas.
- [ ] Preparar respaldo diario y verificar una restauración de prueba.
- [x] Documentar playbooks internos para incidentes de pagos, tickets, reembolsos, errores y validación offline.
- [x] Publicar un canal de reporte de incidencias para usuarios beta. Implementado: tile "Reportar un problema" en Control Center, inserta directo en `support_cases` vía RLS propia del usuario.
- [ ] Revisar métricas a las 2, 8, 24 y 48 horas del lanzamiento.
- [ ] Ejecutar Lighthouse/Web Vitals móvil antes de ventas públicas.

## Estado de datos reales (nuevo desde 2026-07-07)

- 3 organizadores con ficha pública en Colonia (`organizers`), auto-provisionados desde cuentas `promoter`/`club` aprobadas.
- 2 eventos reales creados y vinculados a su organizador: **MOVAIVA FESTIVAL** (Sara Victoria Silva Montoya, locación secreta) y **Tehnology Nigth Rom** (Concepto Fractal, venue "SOSO").
- Ningún evento ni promotor es todavía dato de prueba/placeholder — ver `docs/IMPLEMENTATION_PHASES.md`, Fase 7.11 y 7.12, para el detalle de la migración de datos.

## Criterio de salida

Se puede abrir una beta cerrada después de completar la prueba controlada de compra y QR. Las ventas públicas deben esperar hasta que también estén definidos soporte, políticas, alertas y procedimiento de reembolso.

Con esta revisión, lo único que falta para cumplir el criterio de "beta cerrada" es la prueba controlada de compra/QR en sí (checklist de arriba) — ya hay un evento real apto (`Tehnology Nigth Rom`, $5.000 COP) y todo lo demás de "Operación de beta" ya está resuelto salvo backup/restauración y la asignación humana de responsable de soporte.
