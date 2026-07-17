# PolyFauna - Despliegue, migraciones y funciones backend

Estado de referencia: 2026-07-17.

El frontend y Supabase son planos de despliegue independientes. Un commit desplegado correctamente en Vercel no demuestra que las migraciones o Edge Functions esten actualizadas, y aplicar SQL en Supabase no publica los cambios React.

## Ambientes y responsables

| Plano | Proveedor | Fuente | Despliegue |
|---|---|---|---|
| Frontend | Vercel | rama `main` | automatico al hacer push |
| Base de datos | Supabase Postgres | `supabase/migrations/*.sql` | `supabase db push --linked` o procedimiento controlado en dashboard |
| Edge Functions | Supabase Functions | `supabase/functions/<name>` | `supabase functions deploy <name>` |
| Auth email | Supabase Auth | `supabase/auth-email-templates` | importacion/configuracion explicita |
| Archivos | R2 / Supabase Storage | variables y politicas | configuracion separada |
| Radio | AzuraCast/Icecast | mounts y API | operacion externa |

## Variables

Frontend Vite:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RADIO_STREAM_URL`
- `VITE_RADIO_STREAM_HIGH`
- `VITE_RADIO_STREAM_MEDIUM` cuando se configure un nivel intermedio separado
- `VITE_RADIO_STREAM_LOW`
- `VITE_AZURACAST_API`
- `VITE_AZURACAST_STATION`
- `VITE_AZURACAST_API_KEY` solo si un flujo local autorizado la requiere; nunca debe terminar en un bundle publico de produccion
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_R2_PUBLIC_URL`

Edge Functions y servicios:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`
- `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_KEY`, `WOMPI_EVENTS_KEY`
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPPORT_EMAIL`, `EMAIL_UNSUBSCRIBE_URL`
- `TICKET_QR_PRIVATE_JWK`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`

Las variables `VITE_*` son publicas en el bundle. Nunca usar ese prefijo para service role, secretos Wompi, Resend, VAPID privada, R2 privada o JWK privada.

## Flujo de frontend

Antes de subir:

```bash
npm ci
npm run verify
npm run audit:ci
git diff --check
```

Estado al 2026-07-17: lint, pruebas y build estan correctos, pero el presupuesto de JavaScript total excede el limite por 9.4 KiB. La validacion de release no esta completamente verde hasta corregir esa deuda; ver `docs/PERFORMANCE_BUDGET.md`.

Publicacion:

```bash
git push origin main
```

Vercel detecta el push, ejecuta `npm run build` y publica `dist/`. El build tambien genera SEO, prerender y `llms.txt`; IndexNow solo envia URLs cuando `VERCEL_ENV=production` o `INDEXNOW_FORCE=1`.

Verificacion minima:

```bash
vercel ls --prod
vercel inspect https://www.polyfauna.com --format=json
curl -I https://www.polyfauna.com/
curl -sS https://www.polyfauna.com/sitemap.xml
```

Confirmar que:

- estado `READY`;
- `githubCommitSha` coincide con `git rev-parse HEAD`;
- `www.polyfauna.com` y `polyfauna.com` apuntan al deployment nuevo;
- la pagina y rutas prerenderizadas responden 200;
- el sitemap contiene slugs actuales.

No desplegar con archivos funcionales sin commit. El metadata `gitDirty=1` impide demostrar que el artefacto corresponde exactamente a un commit.

## Flujo de migraciones Supabase

### Preparacion

1. Crear un archivo con timestamp monotono:

   ```text
   supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql
   ```

2. Hacer el SQL idempotente cuando sea razonable (`IF EXISTS`, `IF NOT EXISTS`) sin ocultar errores de integridad.
3. Definir RLS, grants/revokes y `search_path` en la misma migracion cuando corresponda.
4. Agregar prueba de contrato para pagos, tickets, roles, RLS o funciones sensibles.
5. Revisar el diff SQL completo antes de aplicar.

### Comparacion y aplicacion

```bash
supabase migration list --linked
supabase db push --linked
supabase migration list --linked
```

Si la sesion local devuelve `401 Unauthorized`, renovar la autenticacion antes de continuar. No asumir que una migracion esta aplicada solo porque el archivo esta en `main`.

### Aplicacion manual excepcional

El SQL Editor del dashboard puede utilizarse cuando la CLI no esta autenticada y existe autorizacion explicita. En ese caso:

1. Ejecutar exactamente el contenido del archivo de migracion.
2. Verificar el mensaje de exito y el cambio funcional.
3. Confirmar si `supabase_migrations.schema_migrations` registro la version.
4. Si se ejecuto fuera de la CLI, reparar el historial con la herramienta oficial o registrar la version solo despues de comprobar que todo el SQL termino correctamente.
5. Volver a ejecutar `migration list` cuando la CLI este disponible.

No marcar una version como aplicada antes de ejecutar su SQL. Tampoco volver a ejecutar a ciegas una migracion no idempotente.

### Verificacion

- Consultar una columna, tabla o RPC introducida por la migracion.
- Probar RLS con los roles relevantes, no solo como `postgres`.
- Ejecutar las pruebas de contrato asociadas.
- Revisar logs y Advisors si se modificaron politicas o funciones.
- Confirmar que el frontend desplegado no consulta un esquema aun ausente.

`supabase/.temp/` contiene metadata local de la CLI. Cambios como `cli-latest` no son funcionales y no deben mezclarse con commits de producto.

## Despliegue de Edge Functions

Flujo general:

```bash
supabase functions deploy <function-name>
supabase functions list
```

Funciones HTTP normales verifican JWT por defecto. Excepciones que autentican con firma o secreto propio deben desplegarse segun su contrato, por ejemplo:

```bash
supabase functions deploy resend-webhook --no-verify-jwt
```

Despues de desplegar:

- comprobar metodo permitido y respuesta a `OPTIONS` cuando aplique;
- verificar un caso autorizado y uno rechazado;
- confirmar secretos en Supabase;
- revisar logs sin imprimir tokens ni payloads personales;
- validar efectos idempotentes cuando exista reintento.

## Inventario de Edge Functions

| Funcion | Proposito | Autenticacion/llamador esperado |
|---|---|---|
| `check-radio-health` | Comprueba API y mounts de radio y guarda health checks. | Cron con `x-cron-secret` validado contra Vault. |
| `claim-free-ticket` | Reclama un ticket gratuito con identidad e inventario. | JWT del usuario. |
| `collect-client-error` | Persiste errores tecnicos acotados y rate-limited. | Cliente; payload limitado, escritura con service role. |
| `collect-usage-event` | Registra telemetria anonima y embudo. | Cliente; allowlist y rate limit server-side. |
| `create-payment` | Valida usuario/evento/tier y crea checkout Wompi. | JWT del comprador. |
| `get-upload-url` | Genera PUT prefirmado de R2 por carpeta y MIME permitido. | JWT y rol/capacidad del usuario. |
| `issue-courtesy-ticket` | Emite cortesia registrada o pendiente y envia correo. | JWT de operador autorizado; RPC valida permisos. |
| `issue-manual-ticket` | Emite venta manual registrada o pendiente. | JWT de operador autorizado; RPC valida permisos. |
| `notify-co-promoter-linked` | Notifica una vinculacion de colaborador de evento. | JWT; valida propietario/admin. |
| `resend-webhook` | Registra estados de entrega de correo. | Firma Svix; sin JWT de Supabase. |
| `send-community-broadcast` | Envia comunicacion comunitaria a audiencia permitida. | JWT y rol profesional autorizado. |
| `send-message-notification` | Envia aviso asociado a un mensaje interno. | Invocacion server-side con identificador validado. |
| `send-operational-alert` | Envia alertas criticas por Resend. | Cron con `x-cron-secret`. |
| `send-push` | Envia Web Push y limpia suscripciones expiradas. | Usuario autorizado o service role segun alcance. |
| `send-role-decision` | Notifica aprobacion/rechazo de rol. | Flujo administrativo/server-side. |
| `send-role-request` | Notifica una nueva solicitud de rol. | Flujo de registro/solicitud validado. |
| `send-ticket-confirmation` | Envia correo transaccional de ticket. | Bearer igual a service role. |
| `send-welcome` | Envia correo de bienvenida. | Flujo server-side/Auth configurado. |
| `sync-radio-queue` | Lee cola privada de AzuraCast y reemplaza cache publica. | Cron con `x-cron-secret`. |
| `ticket-qr` | Obtiene/genera QR para un ticket autorizado. | JWT y validacion de propietario/operador. |
| `transfer-ticket` | Transfiere ticket manual/cortesia a cuenta o correo pendiente. | JWT; RPC valida evento y estado. |
| `void-ticket` | Anula ticket manual/cortesia y reconcilia cupo. | JWT; RPC valida evento y estado. |
| `webhook-wompi` | Verifica evento Wompi y cumple transaccion idempotente. | Firma/checksum Wompi; sin JWT de usuario. |

## Migraciones funcionales recientes

| Migracion | Funcionalidad |
|---|---|
| `20260710000001_stream_resilience_and_monitoring.sql` | salud del stream, cron y alertas de radio |
| `20260711000001_drop_radio_shows.sql` | elimina programacion antigua basada en `radio_shows` |
| `20260711000002_rotating_artists.sql` | artistas rotativos por ventana estable |
| `20260711000003_radio_queue_cache.sql` | cache publica y cron de cola AzuraCast |
| `20260713000001_blog_articles_rich_content.sql` | articulos por bloques y esquema editorial |
| `20260713000002_seed_fauna_de_altura.sql` | contenido inicial del articulo |
| `20260713000003_blog_slug_likes_webp.sql` | slug, likes y assets optimizados de blog |
| `20260714000001_update_fauna_de_altura_content.sql` | revision editorial del articulo |
| `20260715113000_event_ticket_time_controls.sql` | ventanas de venta y reglas Early |
| `20260715180000_manual_ticket_unregistered_recipients.sql` | venta manual a correos sin cuenta |
| `20260715210000_resend_delivery_observability.sql` | idempotencia y estados Resend |
| `20260716133000_event_image_variants.sql` | imagen principal, movil y ticket |
| `20260716190000_radio_organism_ticket_lifecycle.sql` | sets, likes, Organismo y ocultamiento de Ticket Vault |
| `20260716223000_collective_admin_role_and_content_credits.sql` | alias colectivo y creditos multiples |
| `20260716234500_podcast_footer_description.sql` | notas editoriales al pie del podcast |
| `20260717003000_podcast_public_slugs.sql` | slugs unicos y URLs canonicas de podcast |

## Checklist de cierre de release

- [ ] Diff funcional revisado y sin secretos.
- [ ] `npm run verify` y `npm run audit:ci` aprobados.
- [ ] Migraciones aplicadas y registradas.
- [ ] Edge Functions modificadas desplegadas.
- [ ] Secretos/configuracion requeridos presentes.
- [ ] Commit en `main` y Vercel `READY` sobre el SHA correcto.
- [ ] Dominio publico, rutas canonicas y sitemap verificados.
- [ ] Prueba funcional del flujo afectado en produccion o staging.
- [ ] Documentacion y playbook actualizados en el mismo release.
