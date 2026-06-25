# PolyFauna - Playbooks operativos

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
