# PolyFauna - Modelo de gobernanza y soporte

Fecha: 2026-06-24

## Objetivo

La plataforma debe poder responder preguntas operativas basicas sin depender de memoria del equipo:

- Quien cambio un rol.
- Quien elimino un perfil.
- Que solicitud de rol fue aprobada o rechazada.
- Que casos de soporte estan abiertos, urgentes o resueltos.
- Que acciones sensibles deben pasar por funciones auditadas.

## Auditoria administrativa

La tabla `admin_audit_log` registra acciones administrativas con:

- `actor_id`: admin que ejecuto la accion.
- `action`: nombre estable de la accion.
- `target_table` y `target_id`: recurso afectado.
- `target_user_id`: usuario impactado cuando aplica.
- `metadata`: contexto acotado, como rol anterior, rol nuevo o motivo.
- `created_at`: fecha de auditoria.

Lectura: solo admins autenticados mediante RLS.

Insercion: debe hacerse con `log_admin_action` o desde funciones administrativas auditadas.

## Cambios de rol

Los cambios de rol no deben hacerse desde el cliente con `profiles.update({ role })`.

Rutas permitidas:

- `set_user_role(p_user_id, p_role, p_reason)`: cambio manual desde admin.
- `process_role_request_admin(p_request_id, p_action, p_rejection_reason)`: aprobacion o rechazo atomico de solicitudes de rol.

Controles incluidos:

- Solo admins pueden ejecutar.
- Roles permitidos: `citizen`, `artist`, `promoter`, `club`, `sello`, `admin`.
- Un admin no puede quitarse a si mismo el rol admin.
- Las solicitudes de rol ya revisadas no se procesan de nuevo.
- Cada decision queda registrada en `admin_audit_log`.

## Eliminacion de perfiles

La eliminacion de perfiles desde admin debe usar:

```sql
delete_profile_admin(p_user_id, p_reason)
```

Controles incluidos:

- Solo admins pueden ejecutar.
- Un admin no puede eliminar su propio perfil.
- Se registra auditoria antes de eliminar.

Nota: esta operacion elimina el registro de `profiles`, no necesariamente el usuario de `auth.users`.

## Soporte interno

La tabla `support_cases` permite registrar casos de usuarios con:

- asunto, categoria, estado y prioridad.
- relacion opcional con transaccion, ticket o evento.
- descripcion visible del caso.
- notas internas.
- timestamps de creacion, actualizacion y resolucion.

Estados permitidos:

- `open`
- `triage`
- `waiting_user`
- `waiting_internal`
- `resolved`
- `closed`

Prioridades permitidas:

- `low`
- `normal`
- `high`
- `urgent`

Los usuarios pueden crear y leer sus propios casos. Los admins pueden gestionar todos los casos. Las actualizaciones administrativas deben pasar por:

```sql
update_support_case(p_case_id, p_status, p_priority, p_assigned_to, p_internal_notes)
```

Cada actualizacion queda auditada como `support.case_update`.

## Automatismos actuales

- CI: GitHub Actions corre automaticamente en `push` a `main` y en pull requests.
- Verificacion local: `npm run verify` corre lint, tests, chequeo de secretos, build y presupuesto de performance.
- Notificaciones push: existen service worker, suscripciones y Edge Function `send-push` para flujos que ya la invocan.
- Operacion: el panel admin consulta alertas calculadas mediante `get_operational_alerts`.

## No automatico todavia

- Este agente no ejecuta `git push` automaticamente. Se hace solo si el usuario lo pide.
- Las alertas operativas no envian todavia push/email/Slack por scheduler externo.
- La creacion de casos de soporte desde una pantalla publica dedicada queda para una fase posterior; la base y el panel admin ya estan listos.
- La eliminacion completa de usuarios en `auth.users` requiere una Edge Function con service role y proceso de doble confirmacion.

## Reglas para siguientes fases

- No modificar roles directo desde `profiles` en frontend.
- No agregar nuevas acciones admin sensibles sin auditoria.
- No exponer `admin_audit_log` a usuarios no admin.
- No usar notas internas para datos sensibles como tarjetas, llaves o documentos completos.
- Mantener pruebas de contrato cuando cambien RPCs, RLS o flujos de soporte.
