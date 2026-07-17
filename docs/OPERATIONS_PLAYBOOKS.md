# PolyFauna - Playbooks operativos

Fecha de revision: 2026-07-17.

Estos playbooks cubren incidentes de beta y ventas publicas. Siempre registra hora, usuario afectado, evento, transaccion o ticket, accion tomada y resultado.

## Pago aprobado sin ticket

Senal:

- Alerta `approved_payment_without_ticket`.
- Usuario reporta pago aprobado en Wompi sin entrada en Ticket Vault.

Pasos:

1. Buscar la transaccion por `wompi_reference` o correo del comprador.
2. Confirmar en Wompi que el estado sea `APPROVED` y que monto/moneda coincidan.
3. Revisar logs del webhook `webhook-wompi`.
4. Verificar si `transactions.status = approved` y si existen filas en `user_tickets` con `transaction_id`.
5. Si no hay tickets, no duplicar manualmente sin reconciliar inventario.
6. Emitir o corregir usando procedimiento administrativo controlado y dejar nota interna.
7. Confirmar con el usuario que el ticket aparece y que el QR abre correctamente.

Cierre:

- La transaccion tiene tickets esperados.
- `tickets_sold` coincide con tickets emitidos.
- El comprador recibio confirmacion.

## Webhook Wompi fallido o duplicado

Senal:

- Logs con firma invalida, monto invalido o transaccion no encontrada.
- Alerta `stale_pending_payment` si Wompi aprobo pero el webhook no cerro la compra.

Pasos:

1. Confirmar que `WOMPI_EVENTS_KEY` y `WOMPI_INTEGRITY_KEY` correspondan al ambiente correcto.
2. Validar en Wompi si el evento fue enviado y si hubo reintentos.
3. Buscar la transaccion por referencia.
4. Si el webhook fue duplicado y la transaccion ya esta aprobada, confirmar que no existan tickets extra.
5. Si Wompi aprobo pero la plataforma sigue `pending`, reconciliar antes de abrir mas ventas del evento.

Cierre:

- La transaccion queda en estado final.
- No hay tickets duplicados.
- El historial de Wompi y PolyFauna coincide.

## Evento sobrevendido

Senal:

- Alerta `oversold_event`.
- `tickets_sold > tickets_total`.

Pasos:

1. Pausar ventas del evento.
2. Comparar `events.tickets_sold` contra `COUNT(user_tickets)` por evento.
3. Revisar transacciones aprobadas recientes y webhook duplicado.
4. Confirmar si el exceso es contador incorrecto o tickets reales emitidos.
5. Ajustar inventario o contactar compradores afectados segun politica de soporte.

Cierre:

- Cupo y tickets emitidos estan reconciliados.
- El evento puede reabrirse o queda bloqueado formalmente.

## Error cliente elevado

Senal:

- Alerta `client_errors_recent`.
- Aumento de errores en rutas publicas o privadas.

Pasos:

1. Revisar `client_errors` por `route`, `source`, `context.release` y `message`.
2. Identificar si afecta compra, login, tickets o admin.
3. Reproducir en navegador real si es posible.
4. Si afecta compra/tickets, pausar campanas o ventas hasta confirmar.
5. Crear issue con stack, ruta, release y pasos de reproduccion.

Cierre:

- Error corregido o mitigado.
- Se verifica en produccion/staging.
- Baja la tasa de errores posteriores.

## Medicion de usuarios activos y embudo

Senal:

- Se va a publicar contenido real, abrir venta de tickets o subir trafico.
- Se necesita confirmar que escucha, navegacion y checkout se sostienen sin caidas.

Consultas utiles:

Usuarios activos ultimos 15 minutos:

```sql
SELECT COUNT(DISTINCT session_id) AS active_sessions
FROM public.usage_events
WHERE created_at >= NOW() - INTERVAL '15 minutes'
  AND event_name = 'session_heartbeat';
```

Embudo de eventos ultimas 24 horas:

```sql
SELECT
  event_name,
  COUNT(*) AS total,
  COUNT(DISTINCT session_id) AS unique_sessions
FROM public.usage_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_name IN ('event_view', 'checkout_start', 'checkout_ready', 'ticket_claimed', 'checkout_error')
GROUP BY event_name
ORDER BY CASE event_name
  WHEN 'event_view' THEN 1
  WHEN 'checkout_start' THEN 2
  WHEN 'checkout_ready' THEN 3
  WHEN 'ticket_claimed' THEN 4
  WHEN 'checkout_error' THEN 5
END;
```

Errores de checkout por evento:

```sql
SELECT
  properties->>'event_id' AS event_id,
  properties->>'error_code' AS error_code,
  COUNT(*) AS total
FROM public.usage_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_name = 'checkout_error'
GROUP BY 1, 2
ORDER BY total DESC;
```

Pasos:

1. Revisar activos, reproducciones y embudo antes de activar campanas.
2. Si `checkout_error` sube durante una venta, pausar pauta y revisar `client_errors`, `transactions` y logs de `create-payment`.
3. Comparar caidas entre `event_view`, `checkout_start` y `checkout_ready` para saber si el problema es UX, login, inventario o pasarela.
4. Si hay alto trafico de escucha, revisar que `stream_start` crezca sin aumento paralelo de `client_errors`.

Cierre:

- Hay datos suficientes para estimar carga real.
- No hay errores de checkout o reproduccion por encima del umbral acordado.
- Si se abre venta masiva, queda responsable monitoreando durante la ventana.

## Devolucion sin respuesta

Senal:

- Alerta `refund_requests_waiting`.

Pasos:

1. Abrir Admin > Devoluciones.
2. Revisar motivo, ticket, evento y estado del ticket.
3. Definir estado: reviewing, approved, rejected, processing, refunded o cancelled.
4. Si se reembolsa, ejecutar la accion con el proveedor de pago y marcar `refunded`.
5. Dejar nota interna y notificar al usuario.

Cierre:

- Solicitud queda en estado final o con proximo responsable claro.
- Ticket queda consistente con la decision.

## Retiro pendiente

Senal:

- Alerta `payouts_waiting`.

Pasos:

1. Confirmar saldo disponible y cuenta bancaria del promotor.
2. Revisar retiros pendientes/processing previos para evitar doble pago.
3. Ejecutar transferencia.
4. Registrar referencia bancaria en Admin > Retiros.
5. Confirmar al promotor.

Cierre:

- `payouts.status = completed` o `rejected`.
- Wallet refleja saldo disponible correcto.

## Cortesia pendiente de activacion en puerta

Senal:

- El escaner (online u offline) rechaza un QR de cortesia con codigo `PENDING_REGISTRATION`.
- El destinatario dice que recibio el correo de cortesia pero el QR "no funciona".

Contexto:

- Una cortesia emitida a un correo sin cuenta PolyFauna queda con `status = 'pending_registration'` (`user_id` en NULL, `assigned_email` con el correo invitado) hasta que esa persona se registra con el mismo correo. El registro la activa solo (`handle_new_user` la reclama automaticamente).

Pasos:

1. Confirmar con el asistente el correo exacto al que le llego la cortesia.
2. Pedirle que revise si ya tiene cuenta PolyFauna con ese correo exacto; si no, que se registre ahi mismo (el enlace del correo prellena el campo).
3. Una vez registrado, el ticket pasa a `valid` automaticamente: pedirle que reabra el Ticket Vault o vuelva a mostrar el mismo QR del correo (es el mismo token firmado, no cambia).
4. Si insiste en que ya tiene cuenta con ese correo y el ticket sigue pendiente, revisar en `user_tickets` que `assigned_email` coincida exactamente (mayusculas/espacios) con el email en `auth.users`.
5. No emitir una segunda cortesia manual sin antes confirmar que la primera sigue pendiente (ver `admin_audit_log`, accion `ticket.courtesy`).

Cierre:

- El ticket queda `valid` y el asistente puede validarlo en puerta.
- Si el problema fue un correo mal escrito al emitir la cortesia, se corrige manualmente y se le avisa al asistente.

## Conflictos de validacion offline

Senal:

- Alerta `offline_scan_conflicts`.
- Escaneos sincronizados como `ALREADY_USED`, `INVALID_STATUS` o `WRONG_EVENT`.

Pasos:

1. Revisar `ticket_scan_log` por evento, ticket y `device_id`.
2. Confirmar si el paquete offline estaba actualizado antes de abrir puertas.
3. Revisar si dos dispositivos validaron el mismo ticket sin sincronizar.
4. En puerta, priorizar seguridad del evento: no permitir segundo acceso sin autorizacion del responsable.
5. Sincronizar todos los dispositivos antes del cierre operativo.

Cierre:

- Cola offline sincronizada.
- Tickets usados/refund/cancelados reflejan el estado real.
- Se documenta si hubo excepcion manual en puerta.

## Radio sin audio o cola desactualizada

Senal:

- El reproductor entra repetidamente en `Reconectando` o termina en error.
- `check-radio-health` registra mounts no saludables.
- La seccion "Sigue en la transmision" no cambia o muestra una cola vacia durante mas de una ventana de cron.

Pasos:

1. Confirmar que el problema afecta el audio, Now Playing, la cola o los tres por separado.
2. Probar los mounts high/medium/low directamente desde un entorno autorizado.
3. Revisar los ultimos registros de `radio_health_checks` y logs de `check-radio-health`.
4. Revisar `radio_queue_cache.synced_at` y logs de `sync-radio-queue`.
5. Confirmar que `x-cron-secret`, `supabase_project_ref` y credenciales AzuraCast siguen presentes en Vault/Functions.
6. Si solo falla un mount, mantener disponible el fallback low y corregir el origen antes de cambiar URLs publicas.
7. Si la cola falla pero el audio funciona, no pausar la radio; informar la degradacion de metadata y restaurar el cron.

Cierre:

- El audio reproduce de forma estable en al menos el mount esperado.
- Los health checks vuelven a estado saludable.
- `radio_queue_cache` recibe una sincronizacion nueva y la UI muestra los siguientes items.

## Venta manual pendiente de registro

Senal:

- Un ticket de venta manual figura como `pending_registration`.
- El comprador recibio QR pero no lo ve en Ticket Vault.

Contexto:

- La venta manual a un correo sin cuenta conserva cupo, importe y QR, pero no se activa hasta que el destinatario se registra con el mismo correo.

Pasos:

1. Confirmar `assigned_email`, tipo de ticket, referencia manual e importe historico.
2. Pedir al destinatario registrarse con exactamente el correo de emision.
3. Tras el registro, confirmar que `handle_new_user` asigno `user_id` y cambio el estado a `valid`.
4. Verificar que el ticket aparece en Ticket Vault y que el QR valida.
5. No emitir un segundo ticket mientras el primero siga pendiente; usar la clave de idempotencia para rastrear el formulario original.

Cierre:

- Ticket activo y asociado al usuario correcto, o correccion documentada del correo antes de reemitir.
- Inventario, transaccion manual e ingresos por tier coinciden.

## Early vencido o recargo en puerta

Senal:

- El scanner responde que un ticket Early vencio o requiere recargo.
- El asistente presenta un QR valido despues de `early_entry_deadline`.

Pasos:

1. Confirmar tipo `early`, deadline, zona horaria del evento y monto de recargo configurado.
2. No marcar el ticket como usado mientras el recargo siga pendiente.
3. Cobrar o registrar el recargo mediante el procedimiento operativo aprobado para el evento.
4. Volver a validar el ticket con conectividad o registrar la excepcion de puerta segun politica.
5. Si la hora configurada es incorrecta, escalar al responsable; no alterar masivamente el evento durante ingreso sin evaluar tickets ya emitidos.

Cierre:

- Acceso y recargo quedan conciliados, o excepcion registrada con responsable.
- Se corrige la configuracion antes de la siguiente ventana de ingreso si hubo error.

## Activacion de trazabilidad de Resend

Objetivo:

- Evitar correos transaccionales duplicados durante reintentos.
- Conocer si un correo fue enviado, entregado, retrasado, rebotado o marcado como spam.
- Conservar solo metadata operativa; no se guardan destinatarios, asuntos ni cuerpos en las tablas de trazabilidad.

Preparacion:

1. Aplicar la migracion `20260715210000_resend_delivery_observability.sql`.
2. Crear el webhook en Resend con este endpoint:

   `https://<PROJECT_REF>.supabase.co/functions/v1/resend-webhook`

3. Suscribir al menos estos eventos:

   - `email.sent`
   - `email.delivered`
   - `email.delivery_delayed`
   - `email.bounced`
   - `email.failed`
   - `email.complained`
   - `email.suppressed`

4. Copiar el signing secret del webhook y guardarlo en Supabase como `RESEND_WEBHOOK_SECRET`. Nunca usarlo en variables `VITE_*` ni comitearlo.
5. Desplegar el receptor sin validacion JWT, porque la autenticidad se verifica con la firma Svix sobre el cuerpo crudo:

   ```bash
   supabase functions deploy resend-webhook --no-verify-jwt
   ```

6. Enviar un correo de prueba y confirmar la recepcion:

   ```sql
   SELECT event_type, category, entity_id, occurred_at
   FROM public.email_delivery_events
   ORDER BY occurred_at DESC
   LIMIT 20;
   ```

Verificacion de seguridad:

- Una solicitud sin `svix-id`, `svix-timestamp` y `svix-signature` debe responder `400`.
- Reenviar el mismo evento desde Resend no debe crear una segunda fila: `svix_id` es la llave de deduplicacion.
- `anon` y `authenticated` no deben poder consultar las tablas de entrega.
- Rotar `RESEND_WEBHOOK_SECRET` si se expone y actualizar inmediatamente el secreto de la Edge Function.

Mantenimiento:

- Revisar rebotes y quejas antes de campañas comunitarias.
- Definir una retencion operativa; como punto de partida, eliminar eventos detallados mayores a 180 dias y conservar solo los estados que sigan siendo necesarios.
- La politica publica de privacidad debe revisarse con asesoria juridica antes del lanzamiento comercial.

## Backup y restauracion

Frecuencia recomendada:

- Backup diario automatizado.
- Prueba de restauracion al menos antes de ventas publicas y luego mensualmente.

Prueba minima:

1. Restaurar en proyecto Supabase/staging aislado.
2. Verificar tablas: `profiles`, `events`, `transactions`, `user_tickets`, `ticket_scan_log`.
3. Ejecutar consultas de conteo por evento.
4. Abrir app contra staging y revisar login/admin si aplica.

Cierre:

- Se registra fecha, responsable, ambiente restaurado y resultado.
