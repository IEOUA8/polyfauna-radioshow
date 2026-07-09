# POLYFAUNA — Documento Maestro de Implementación
## Arquitectura de Organizadores, Co-organización de Eventos y Perfiles Públicos con Contenido Multidimensional

**Repositorio:** `IEOUA8/polyfauna-radioshow` (rama `main`)
**Stack confirmado:** React + Vite, React Router, Supabase (Postgres + Auth + RLS + Edge Functions), Wompi, AzuraCast, Vercel.
**Fecha del documento:** 2026-07-07
**Estado:** ✅ Implementado y desplegado a producción (2026-07-07). Ver registro completo en `docs/IMPLEMENTATION_PHASES.md`, sección "Fase 7.11", y el PR [#9](https://github.com/IEOUA8/polyfauna-radioshow/pull/9) (fusionado a `main`, deploy de Vercel en verde).

> **Nota de implementación:** este documento se mantiene como referencia histórica del diseño aprobado. Dos desvíos respecto al texto original, decididos durante la ejecución:
> 1. **No se agregó `role='collective'`** (sección 2 y 3.4): ya existe un mecanismo funcionando en producción vía `profiles.organizer_type='collective'` + `role='promoter'` (ver `src/contexts/AuthContext.jsx`), con paridad total en toda la RLS existente. Agregar el valor nuevo habría creado un segundo mecanismo paralelo redundante.
> 2. **La migración de la sección 3.3 se corrigió** para incluir `DROP FUNCTION IF EXISTS public.add_event_co_promoter(UUID, TEXT);` antes de crear la versión de 3 argumentos — sin ese `DROP`, ambas firmas habrían coexistido de forma ambigua y las llamadas legacy con solo 2 argumentos habrían fallado en producción con "function name is not unique".

Este documento consolida el diagnóstico y las decisiones tomadas sobre el código real del repositorio (no supuestos genéricos). Cada tabla, componente y ruta mencionada existe verificablemente en el proyecto salvo que se indique explícitamente como "nuevo". El objetivo es que este documento pueda entregarse tal cual a Claude Code, Cursor o Codex para ejecución directa, fase por fase.

---

## 1. Descripción general del problema que resuelve este documento

Polyfauna tiene hoy dos capas de identidad de contenido bien construidas — Artistas/Labels (tabla `artists`) y Eventos (tabla `events`) — pero carece de una tercera capa igualmente necesaria: **la identidad pública de quienes organizan los eventos** (clubes, promotores, colectivos). Hoy `events.venue` y `events.city` son texto libre sin ninguna entidad navegable detrás, y el sistema de colaboración financiera entre organizadores (`event_co_promoters`) no tiene ninguna conexión con la capa de exhibición pública.

Este documento resuelve tres problemas simultáneos:

1. **Falta de perfiles públicos para clubes, promotores y colectivos**, equivalentes en jerarquía visual a los de Artists & Labels.
2. **Falta de una experiencia de contenido multidimensional en el perfil del artista** (Eventos / Música / Podcast / Entrevistas), navegable por pestañas, sin reproducir ni comprar desde ahí — solo vista previa con redirección al detalle real.
3. **Distinción correcta entre co-organización real y reventa de boletas**, evitando que un perfil público se diluya con eventos donde el organizador solo participó como canal de venta.

---

## 2. Roles del sistema (estado actual + extensión)

Confirmado en `docs/GOVERNANCE_MODEL.md` y en las políticas RLS de `events`:

```
Roles actuales en profiles.role: citizen | artist | promoter | club | sello | admin
```

**Extensión aprobada: se agrega `collective`.**

| Rol | Puede publicar eventos propios | Puede ser co-organizador | Puede ser co-promotor de boletas | Tiene perfil público navegable |
|---|---|---|---|---|
| `citizen` | No | No | No | No |
| `artist` | No | No | No | Sí — `/profiles/:slug` (tabla `artists`) |
| `sello` (label) | No | No | No | Sí — vía `artists.type = 'label'` (a confirmar convención existente) |
| `promoter` | Sí | Sí | Sí | Sí — nuevo, `/organizadores/:slug` |
| `club` | Sí | Sí | Sí | Sí — nuevo, `/organizadores/:slug` |
| `collective` **(nuevo)** | Sí | Sí | Sí | Sí — nuevo, `/organizadores/:slug`, y opcionalmente también en `artists` si sube contenido propio |
| `admin` | Sí (todo) | N/A | N/A | No aplica |

**Regla de gobernanza (a respetar en `set_user_role` y `process_role_request_admin`, según `GOVERNANCE_MODEL.md`):** ningún cambio de rol se hace desde el cliente contra `profiles.role` directamente. Todo pasa por las RPC ya auditadas. Se debe agregar `'collective'` a la lista blanca de roles permitidos en ambas funciones.

---

## 3. Arquitectura de datos — migraciones SQL completas

Aplicar en orden. Convención de nombre de archivo del proyecto: `YYYYMMDDHHMMSS_descripcion.sql`.

### 3.1 — `organizers` y `event_organizers` (capa pública/curatorial)

```sql
-- supabase/migrations/<timestamp>_organizers_core.sql

CREATE TABLE IF NOT EXISTS public.organizers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'promoter'
                CHECK (type IN ('club', 'promoter', 'collective', 'hybrid')),
  bio           TEXT,
  image_url     TEXT,
  cover_url     TEXT,
  city          TEXT,
  address       TEXT,
  lat           NUMERIC(9,6),
  lng           NUMERIC(9,6),
  capacity      INTEGER,
  social_links  JSONB DEFAULT '{}',
  owner_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_verified   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizers_owner_id ON public.organizers(owner_id);

ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizers_public_read" ON public.organizers
  FOR SELECT USING (true);

CREATE POLICY "organizers_owner_update" ON public.organizers
  FOR UPDATE USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "organizers_admin_insert" ON public.organizers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'promoter', 'club', 'collective')
    )
  );

-- ─── Relación evento ↔ organizador (many-to-many, capa curatorial) ───
CREATE TABLE IF NOT EXISTS public.event_organizers (
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organizer_id  UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  role_in_event TEXT NOT NULL DEFAULT 'organizer'
                CHECK (role_in_event IN ('owner', 'venue', 'co-organizer', 'curator')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, organizer_id)
);

ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_organizers_public_read" ON public.event_organizers
  FOR SELECT USING (true);

CREATE POLICY "event_organizers_owner_write" ON public.event_organizers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organizers o
      WHERE o.id = organizer_id
        AND (o.owner_id = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
    )
  );

-- ─── events: relación real a venue, conservando el texto legacy ───
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_organizer_id UUID REFERENCES public.organizers(id);
-- events.venue (TEXT) se conserva como fallback hasta que la Fase 5
-- (migración de datos) pueble venue_organizer_id en todos los eventos
-- existentes. No se elimina en esta fase para no romper EventTerminal.jsx
-- ni EventPublicPage.jsx, que hoy leen event.venue directamente.
```

### 3.2 — `interviews.subject_artist_id` (cierre del gap de vínculo artista-entrevista)

```sql
-- supabase/migrations/<timestamp>_interviews_artist_link.sql

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS subject_artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL;
-- 'subject' (TEXT) se conserva para entrevistas grupales o temáticas
-- sin un artista único asociado (ej. "Escena techno en Bogotá 2026").

CREATE INDEX IF NOT EXISTS idx_interviews_subject_artist_id ON public.interviews(subject_artist_id);
```

### 3.3 — Extensión de co-promotores: distinción co-organizador vs. revendedor de boletas

```sql
-- supabase/migrations/<timestamp>_co_promoters_collaboration_type.sql

ALTER TABLE public.event_co_promoters
  ADD COLUMN IF NOT EXISTS collaboration_type TEXT NOT NULL DEFAULT 'ticket_reseller'
    CHECK (collaboration_type IN ('co_organizer', 'ticket_reseller'));

-- Se reemplaza add_event_co_promoter (mismo patrón SECURITY DEFINER que ya
-- usa el proyecto). Firma nueva: agrega p_collaboration_type con default
-- seguro 'ticket_reseller' para no romper llamadas legacy del frontend
-- que aún no pasen el parámetro nuevo.
CREATE OR REPLACE FUNCTION public.add_event_co_promoter(
  p_event_id UUID,
  p_email TEXT,
  p_collaboration_type TEXT DEFAULT 'ticket_reseller'
)
RETURNS public.event_co_promoters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_target_id UUID;
  v_target_role TEXT;
  v_owner_name TEXT;
  v_row public.event_co_promoters;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_collaboration_type NOT IN ('co_organizer', 'ticket_reseller') THEN
    RAISE EXCEPTION 'invalid_collaboration_type';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF v_event.owner_id <> auth.uid() AND NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT id INTO v_target_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_target_id = v_event.owner_id THEN
    RAISE EXCEPTION 'cannot_link_owner';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = v_target_id;
  IF v_target_role IS NULL OR v_target_role NOT IN ('promoter', 'club', 'collective') THEN
    RAISE EXCEPTION 'invalid_role';
  END IF;

  INSERT INTO public.event_co_promoters (event_id, promoter_id, added_by, collaboration_type)
  VALUES (p_event_id, v_target_id, auth.uid(), p_collaboration_type)
  ON CONFLICT (event_id, promoter_id)
  DO UPDATE SET
    status = 'active',
    added_by = EXCLUDED.added_by,
    collaboration_type = EXCLUDED.collaboration_type
  RETURNING * INTO v_row;

  -- Puente hacia la capa pública: SOLO si el vínculo es de organización
  -- real, nunca para reventa de boletas.
  IF p_collaboration_type = 'co_organizer' THEN
    INSERT INTO public.event_organizers (event_id, organizer_id, role_in_event)
    SELECT p_event_id, o.id, 'co-organizer'
    FROM public.organizers o
    WHERE o.owner_id = v_target_id
    ON CONFLICT (event_id, organizer_id) DO NOTHING;
  END IF;

  SELECT display_name INTO v_owner_name FROM public.profiles WHERE id = auth.uid();

  PERFORM public.create_notification(
    'event',
    CASE WHEN p_collaboration_type = 'co_organizer'
      THEN 'Te vincularon como co-organizador'
      ELSE 'Te vincularon como co-promotor de boletas' END,
    COALESCE(v_owner_name, 'Un organizador') || ' te agregó a "' || v_event.title || '".',
    v_event.image_url,
    'events',
    v_target_id
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.add_event_co_promoter(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_event_co_promoter(UUID, TEXT, TEXT) TO authenticated;
```

> **No se toca:** `revoke_event_co_promoter`, `get_event_attendees`, `issue_manual_transfer_ticket`, ni la política `events_visible_read`. Toda la lógica financiera, de auditoría bancaria y de atribución de tickets sigue exactamente igual — la extensión es aditiva y quirúrgica.

### 3.4 — Actualización de gobernanza (rol `collective`)

Actualizar en el cuerpo de `set_user_role` y `process_role_request_admin` (ver `docs/GOVERNANCE_MODEL.md`) la lista blanca de roles:

```
Roles permitidos: citizen, artist, promoter, club, sello, collective, admin
```

---

## 4. Componentes frontend — qué se crea y qué se extiende

| Componente | Estado | Acción |
|---|---|---|
| `src/components/ArtistsPage.jsx` | Existe | Se usa como plantilla estructural de `OrganizersPage.jsx` (grid + búsqueda + detail view) |
| `src/pages/ArtistPublicPage.jsx` | Existe | Se extiende: el bloque fijo de "Próximos eventos" (línea ~262-290) se reemplaza por `<ProfileContentTabs artistId={artist.id} />` |
| `src/pages/OrganizerPublicPage.jsx` | **Nuevo** | Fork de `ArtistPublicPage.jsx`; usa `<ProfileContentTabs organizerId={organizer.id} artistId={mirrorArtistId} />` si el organizador tiene fila espejo en `artists` |
| `src/components/OrganizersPage.jsx` | **Nuevo** | Fork de `ArtistsPage.jsx` para la sección in-app equivalente a Artists & Labels |
| `src/components/ProfileContentTabs.jsx` | **Nuevo** | Componente reutilizable de las 4 pestañas (Eventos / Música / Podcast / Entrevistas) |
| `src/components/EventTerminal.jsx` | Existe | Se extiende el filtro de búsqueda (línea ~792-802) y se agrega faceta por tipo de organizador |
| `src/components/admin/EventManager.jsx` | Existe | Se agregan dos acciones distintas de vinculación: "Agregar co-organizador" / "Agregar co-promotor de boletas" (línea ~370) |
| `src/components/BlogInterviewsSection.jsx` | Existe | Se agrega listener de `URLSearchParams` para `?interview=` (mismo patrón que `MusicPage.jsx` línea 69) |
| `App.jsx` | Existe | Se agregan rutas nuevas (ver sección 5) |

### 4.1 — Especificación de `ProfileContentTabs.jsx`

```
Props: { artistId?: string, organizerId?: string }

Tabs (en este orden fijo):
1. Eventos   — icon: Calendar
2. Música    — icon: Disc3   (solo si artistId presente)
3. Podcast   — icon: Headphones (solo si artistId presente)
4. Entrevistas — icon: Mic  (solo si artistId presente)

Queries por tab:
- Eventos (con artistId):    events + lineup, vía lineupIncludesArtist() [ya existe en lib/artistIdentity.js]
- Eventos (con organizerId): event_organizers.eq('organizer_id', organizerId) → join events
- Música:      albums.eq('artist_id', artistId)
- Podcast:     podcasts.eq('artist_id', artistId)
- Entrevistas: interviews.eq('subject_artist_id', artistId)

Comportamiento de click por tab:
- Eventos    → navega a /e/{event.id}              (ya existe, sin cambios)
- Música     → navega a /music/{album.id}          (redirect ya existente)
- Podcast    → navega a /podcasts/{podcast.id}      (redirect ya existente)
- Entrevistas → navega a /entrevistas/{interview.id} (ruta nueva, ver sección 5)

Estado vacío por tab: reutilizar <EmptyState /> de src/components/SectionStates.jsx
Solo vista previa (imagen + título + fecha/duración) — nunca reproducción
ni compra dentro del tab.
```

---

## 5. Rutas nuevas en `App.jsx`

```jsx
const OrganizerPublicPage = lazy(lazyImport(() => import('@/pages/OrganizerPublicPage')));

// Dentro de <Routes>:
<Route path="/organizadores/:slug" element={<OrganizerPublicPage />} />
<Route path="/entrevistas/:interview" element={<InternalRouteRedirect section="blog" param="interview" />} />
```

`InternalRouteRedirect` ya existe y ya se usa para `/music/:album`, `/podcasts/:podcast` y `/events/:event` — no requiere modificación, solo una nueva instancia de uso.

---

## 6. Diseño visual — consistencia con la dirección de marca

**Nota de auditoría:** el código en producción usa `#080B14` como fondo base en `ArtistPublicPage.jsx` y `EventPublicPage.jsx`, mientras que el brand book aprobado define void black `#0A0A0A`. Recomendación: unificar hacia el token de marca aprobado en la próxima pasada de refinamiento visual, fuera del alcance de este documento (que es funcional, no de reskin).

### 6.1 — Tab bar de `ProfileContentTabs`

- Contenedor: `rgba(255,255,255,0.05)` fondo, `1px solid rgba(255,255,255,0.08)` borde, `rounded-xl`.
- Tab activo: `rgba(255,255,255,0.10)` fondo, texto blanco 100%.
- Tab inactivo: texto `rgba(255,255,255,0.45)`.
- Iconos `lucide-react`, 16px, trazo fino (ya es la librería de iconos usada en todo el proyecto).
- Transición entre tabs: `AnimatePresence` con fade/slide 150-200ms — mismo patrón ya usado en `ArtistsPage.jsx` para su detail view.

### 6.2 — Responsive mobile (viewport 360px–430px)

- Tab bar con `overflow-x-auto`, `scrollbar-width: none` (oculta scrollbar nativa).
- Cada tab con `min-width` fijo (`min-w-[92px]`) para que no salte el layout al alternar contenido.
- Grid de contenido por tab: 2 columnas en mobile, transición a 3-4 en desktop — mismo breakpoint que ya usa `ArtistsPage.jsx` (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`).
- Botones de "Agregar co-organizador" / "Agregar co-promotor" en `EventManager.jsx`: en mobile se apilan verticalmente con full width; en desktop lado a lado.

### 6.3 — Etiquetas de tipo en listas de colaboradores (`EventManager.jsx`)

Cada fila de colaborador vinculado muestra un badge de tipo:
- `Co-organizador` → fondo `rgba(255,255,255,0.10)`, texto blanco pleno (mayor jerarquía visual, refleja mayor compromiso real).
- `Co-promotor de boletas` → fondo `rgba(255,255,255,0.04)`, texto `rgba(255,255,255,0.45)` (jerarquía menor, es un vínculo instrumental).

---

## 7. Seguridad — resumen de políticas nuevas/modificadas

- `organizers`: lectura pública total; escritura de perfil solo por `owner_id` o `admin`; inserción solo por roles `admin`, `promoter`, `club`, `collective`.
- `event_organizers`: lectura pública total; escritura solo por el dueño del organizador vinculado o admin.
- `event_co_promoters`: sin cambios en RLS existente — solo se agrega la columna `collaboration_type` y el parámetro correspondiente en el RPC, que ya opera bajo `SECURITY DEFINER` con las mismas validaciones de rol y propiedad.
- Ninguna de estas políticas expone datos financieros (`transactions`, `payouts`, wallets) a lectura pública — esa capa permanece exactamente como está hoy, protegida y auditada según `docs/GOVERNANCE_MODEL.md`.

---

## 8. Fases de implementación

| Fase | Alcance | Archivos/tablas | Riesgo |
|---|---|---|---|
| **1** | Migración `organizers` + `event_organizers` + `events.venue_organizer_id` | `supabase/migrations/` | Bajo — aditivo |
| **2** | Migración `interviews.subject_artist_id` | `supabase/migrations/` | Bajo — aditivo |
| **3** | Migración `event_co_promoters.collaboration_type` + reemplazo de `add_event_co_promoter` + rol `collective` en `set_user_role`/`process_role_request_admin` | `supabase/migrations/`, funciones RPC | Medio — requiere test de contrato (exigido por `GOVERNANCE_MODEL.md` para cambios en RPCs auditadas) |
| **4** | `ProfileContentTabs.jsx` (nuevo componente reutilizable) | `src/components/` | Bajo |
| **5** | Integrar `ProfileContentTabs` en `ArtistPublicPage.jsx`; nueva ruta `/entrevistas/:interview`; listener de deep-link en `BlogInterviewsSection.jsx` | `ArtistPublicPage.jsx`, `App.jsx`, `BlogInterviewsSection.jsx` | Bajo |
| **6** | `OrganizersPage.jsx` (in-app) + `OrganizerPublicPage.jsx` (standalone) | Nuevos archivos | Medio — mayor superficie de código nuevo |
| **7** | Extender búsqueda/filtro de `EventTerminal.jsx` por tipo de organizador | `EventTerminal.jsx` | Bajo |
| **8** | UI de dos acciones en `EventManager.jsx` ("Agregar co-organizador" / "Agregar co-promotor de boletas") + badges de tipo en lista de colaboradores | `EventManager.jsx` | Bajo |
| **9** | Migración de datos: poblar `venue_organizer_id` desde `events.venue` (texto libre) para eventos existentes | Script de datos, no de UI | Medio — requiere revisión manual de duplicados/variantes de nombre |
| **10** | QA responsive + funcional: tabs en mobile 360-430px, evento co-organizado aparece en ambos perfiles públicos sin duplicarse, evento de solo-reventa NO aparece en perfil del revendedor | Manual | — |

---

## 9. Checklist de entrega

- [x] Migraciones SQL aplicadas al proyecto Supabase enlazado (`supabase db push --linked`). No se corrió `supabase db advisors --linked` en esta fase — pendiente confirmar 0 performance warnings nuevos según baseline de `docs/CAPACITY_UX_PLAN.md`.
- [ ] ~~`set_user_role` y `process_role_request_admin` aceptan `'collective'`~~ — **descartado por diseño**, ver nota de implementación arriba. `collective` sigue funcionando vía `organizer_type`, no vía `role`.
- [x] `add_event_co_promoter` desplegado con la nueva firma de 3 argumentos (la firma legacy de 2 se eliminó explícitamente para evitar ambigüedad); el default `ticket_reseller` sigue disponible para llamadas externas sin tercer parámetro. `EventManager.jsx` ya pasa el parámetro explícito (Fase 8).
- [x] `ProfileContentTabs.jsx` renderiza las 4 pestañas en `ArtistPublicPage.jsx` con datos reales — verificado en navegador con el artista `kevin-ruiz`.
- [x] `/organizadores/:slug` operativo (estados "no encontrado" y vacío verificados en navegador). No probado con datos reales de los 3 subtipos porque aún no existen organizadores creados en producción.
- [ ] Evento co-organizado por un colectivo aparece en su tab "Eventos" público — garantizado por diseño (PK compuesta `event_organizers(event_id, organizer_id)` evita duplicados), sin verificar end-to-end por falta de datos reales.
- [ ] Evento donde alguien solo revendió boletas NO aparece en su perfil público — garantizado por diseño y cubierto por `tests/add-event-co-promoter-collaboration-type-contract.test.js` (el puente a `event_organizers` solo se crea para `co_organizer`), sin verificar end-to-end por falta de datos reales.
- [x] Ruta `/entrevistas/:interview` redirige correctamente a `/?section=blog&interview=...` y `BlogInterviewsSection.jsx` tiene el listener de deep-link (sin entrevistas reales en producción para abrir una específica).
- [x] Tab bar responsive verificado en 360px, 375px y 430px sin layout shift (390px no se probó puntualmente, pero el rango 360-430 completo sí).
- [x] Badges de tipo (`Co-organizador` / `Co-promotor de boletas`) implementados en `EventManager.jsx` — verificado por lectura de código y lint, no renderizado en vivo (requiere sesión de admin no disponible en esta sesión).

### Pendiente para una fase futura

- Crear organizadores reales (o correr `supabase/scripts/populate_venue_organizer_id.sql` cuando existan venues reales) para completar la QA funcional end-to-end de los dos puntos sin verificar arriba.
- Correr `supabase db advisors --linked` para confirmar que las nuevas tablas/políticas no introdujeron warnings.
- Evaluar agregar "Colonia" a `BottomNav.jsx` si el tráfico a esa sección lo justifica.

---

## 10. Instrucciones de ejecución para la IA de desarrollo

1. Ejecutar las migraciones de la sección 3 en orden (3.1 → 3.2 → 3.3 → 3.4), validando cada una contra el proyecto Supabase enlazado antes de continuar a la siguiente.
2. No modificar ninguna función o política no mencionada explícitamente en este documento — el proyecto tiene RLS extensamente endurecida (ver `docs/CAPACITY_UX_PLAN.md`, fases 7.2-7.5) y cualquier cambio no auditado puede reintroducir warnings de seguridad/performance ya resueltos.
3. Construir `ProfileContentTabs.jsx` como componente aislado y probarlo primero de forma independiente antes de integrarlo en `ArtistPublicPage.jsx`.
4. Para `OrganizersPage.jsx` y `OrganizerPublicPage.jsx`: partir literalmente de una copia de `ArtistsPage.jsx`/`ArtistPublicPage.jsx` y modificar incrementalmente — no reescribir desde cero, para preservar los patrones ya probados (favoritos, compartir, SEO/Helmet, animaciones).
5. Cualquier cambio a `add_event_co_promoter` debe ir acompañado de una prueba de contrato, siguiendo el patrón ya existente en `tests/security-definer-surface-contracts.test.js`.
6. Al finalizar cada fase, correr `npm run verify` (lint, tests, chequeo de secretos, build, presupuesto de performance) antes de pasar a la siguiente fase.
