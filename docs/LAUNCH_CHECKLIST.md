# POLYFAUNA — Checklist de lanzamiento

Fecha de revisión: 2026-06-22

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
- [x] Lint, pruebas automatizadas y build de producción aprobados.

## Prueba controlada antes de abrir ventas

- [ ] Habilitar Web Analytics y Speed Insights en el proyecto de Vercel si sus paneles aún aparecen desactivados.
- [ ] Crear o escoger un evento real de precio mínimo y cupo limitado.
- [ ] Comprar un ticket con una cuenta no administrativa y un correo accesible.
- [ ] Confirmar estado `APPROVED` en Wompi y recepción única del webhook.
- [ ] Verificar que se emita exactamente un ticket y llegue el correo de confirmación.
- [ ] Abrir el ticket desde iPhone y Android y comprobar la legibilidad del QR.
- [ ] Validar el QR desde una cuenta autorizada; el segundo intento debe marcarlo como usado.
- [ ] Ejecutar una devolución o anulación controlada y documentar el procedimiento de soporte.

## Operación de beta

- [ ] Definir correo y responsable de soporte durante las primeras 48 horas.
- [ ] Definir política pública de privacidad, términos, reembolsos y tratamiento de datos.
- [ ] Configurar alertas para errores de cliente, fallos de webhook y pagos sin ticket.
- [ ] Preparar respaldo diario y verificar una restauración de prueba.
- [ ] Publicar un canal de reporte de incidencias para usuarios beta.
- [ ] Revisar métricas a las 2, 8, 24 y 48 horas del lanzamiento.

## Criterio de salida

Se puede abrir una beta cerrada después de completar la prueba controlada de compra y QR. Las ventas públicas deben esperar hasta que también estén definidos soporte, políticas, alertas y procedimiento de reembolso.
