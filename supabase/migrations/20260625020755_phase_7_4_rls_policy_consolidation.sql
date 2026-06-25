-- POLYFAUNA - Fase 7.4: consolidacion manual de politicas RLS restantes
--
-- Objetivo:
-- - Reducir multiple_permissive_policies sin cambiar la intencion de acceso.
-- - Evitar que politicas FOR ALL participen en SELECT cuando existe lectura publica.
-- - Combinar pares owner/admin/promoter en una sola politica por accion.

-- ---------------------------------------------------------------------------
-- Tablas publicas de contenido: lectura publica + escritura admin separada.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "artists_admin_write" ON public.artists;
CREATE POLICY "artists_admin_insert" ON public.artists
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "artists_admin_update" ON public.artists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "artists_admin_delete" ON public.artists
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "albums_admin_write" ON public.albums;
CREATE POLICY "albums_admin_insert" ON public.albums
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "albums_admin_update" ON public.albums
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "albums_admin_delete" ON public.albums
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "blog_articles_admin_write" ON public.blog_articles;
CREATE POLICY "blog_articles_admin_insert" ON public.blog_articles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "blog_articles_admin_update" ON public.blog_articles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "blog_articles_admin_delete" ON public.blog_articles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "interviews_admin_write" ON public.interviews;
CREATE POLICY "interviews_admin_insert" ON public.interviews
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "interviews_admin_update" ON public.interviews
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "interviews_admin_delete" ON public.interviews
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "radio_shows_admin_write" ON public.radio_shows;
CREATE POLICY "radio_shows_admin_insert" ON public.radio_shows
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "radio_shows_admin_update" ON public.radio_shows
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "radio_shows_admin_delete" ON public.radio_shows
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "tracks_admin_write" ON public.tracks;
CREATE POLICY "tracks_admin_insert" ON public.tracks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "tracks_admin_update" ON public.tracks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "tracks_admin_delete" ON public.tracks
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ---------------------------------------------------------------------------
-- Events: una politica por accion que combina owner/promoter/admin.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "events_admin_write" ON public.events;
DROP POLICY IF EXISTS "events_promoter_insert" ON public.events;
DROP POLICY IF EXISTS "events_promoter_update" ON public.events;
DROP POLICY IF EXISTS "events_promoter_delete" ON public.events;

CREATE POLICY "events_insert_access" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR (
      (SELECT auth.uid()) = owner_id
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role IN ('promoter', 'club', 'admin')
      )
    )
  );

CREATE POLICY "events_update_access" ON public.events
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "events_delete_access" ON public.events
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Profiles: una lectura publica, y escritura owner/admin combinada.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_owner_write" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;

DROP POLICY IF EXISTS "profiles_public_read" ON public.profiles;
CREATE POLICY "profiles_public_read" ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_access" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_access" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

CREATE POLICY "profiles_delete_access" ON public.profiles
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Private/business tables: owner/admin combined policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "pa_own" ON public.promoter_accounts;
DROP POLICY IF EXISTS "pa_admin" ON public.promoter_accounts;
CREATE POLICY "promoter_accounts_access" ON public.promoter_accounts
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "wallet_own_read" ON public.wallets;
DROP POLICY IF EXISTS "wallet_admin" ON public.wallets;
CREATE POLICY "wallets_select_access" ON public.wallets
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "wallets_admin_insert" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "wallets_admin_update" ON public.wallets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "wallets_admin_delete" ON public.wallets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "tx_buyer" ON public.transactions;
DROP POLICY IF EXISTS "tx_promoter" ON public.transactions;
DROP POLICY IF EXISTS "tx_admin" ON public.transactions;
CREATE POLICY "transactions_select_access" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = buyer_id
    OR (SELECT auth.uid()) = promoter_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "transactions_admin_insert" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "transactions_admin_update" ON public.transactions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "transactions_admin_delete" ON public.transactions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "payout_own_read" ON public.payouts;
DROP POLICY IF EXISTS "payout_admin" ON public.payouts;
CREATE POLICY "payouts_select_access" ON public.payouts
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "payouts_admin_insert" ON public.payouts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "payouts_admin_update" ON public.payouts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "payouts_admin_delete" ON public.payouts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ---------------------------------------------------------------------------
-- Messages: lectura/escritura combinada.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "messages_admin_write" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_read" ON public.messages;
DROP POLICY IF EXISTS "messages_owner_update" ON public.messages;
DROP POLICY IF EXISTS "messages_read_received" ON public.messages;
DROP POLICY IF EXISTS "messages_read_sent" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_auth" ON public.messages;
DROP POLICY IF EXISTS "messages_update_read" ON public.messages;

CREATE POLICY "messages_select_access" ON public.messages
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = to_user_id
    OR (SELECT auth.uid()) = from_user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "messages_insert_access" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = from_user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "messages_update_access" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = to_user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  )
  WITH CHECK (
    (SELECT auth.uid()) = to_user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "messages_delete_admin" ON public.messages
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ---------------------------------------------------------------------------
-- User tickets: una lectura combinada + escritura admin.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "tickets_owner_read" ON public.user_tickets;
DROP POLICY IF EXISTS "tickets_promoter_read" ON public.user_tickets;
DROP POLICY IF EXISTS "tickets_admin_read" ON public.user_tickets;
DROP POLICY IF EXISTS "tickets_admin_write" ON public.user_tickets;

CREATE POLICY "tickets_select_access" ON public.user_tickets
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

CREATE POLICY "tickets_admin_insert" ON public.user_tickets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "tickets_admin_update" ON public.user_tickets
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "tickets_admin_delete" ON public.user_tickets
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

-- ---------------------------------------------------------------------------
-- Support, refunds, role requests, show questions, comments.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "role_requests_owner_read" ON public.role_requests;
DROP POLICY IF EXISTS "role_requests_admin_read" ON public.role_requests;
CREATE POLICY "role_requests_select_access" ON public.role_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

DROP POLICY IF EXISTS "support_cases_owner_read" ON public.support_cases;
DROP POLICY IF EXISTS "support_cases_owner_insert" ON public.support_cases;
DROP POLICY IF EXISTS "support_cases_admin_all" ON public.support_cases;
CREATE POLICY "support_cases_select_access" ON public.support_cases
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "support_cases_insert_access" ON public.support_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "support_cases_admin_update" ON public.support_cases
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "support_cases_admin_delete" ON public.support_cases
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "refund_requests_owner_read" ON public.ticket_refund_requests;
DROP POLICY IF EXISTS "refund_requests_owner_insert" ON public.ticket_refund_requests;
DROP POLICY IF EXISTS "refund_requests_admin_all" ON public.ticket_refund_requests;
CREATE POLICY "refund_requests_select_access" ON public.ticket_refund_requests
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.owner_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "refund_requests_insert_access" ON public.ticket_refund_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT auth.uid()) = user_id
      AND EXISTS (
        SELECT 1 FROM public.user_tickets t
        WHERE t.id = ticket_id
          AND t.user_id = (SELECT auth.uid())
          AND t.status NOT IN ('used', 'cancelled', 'refunded')
      )
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "refund_requests_admin_update" ON public.ticket_refund_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.owner_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "refund_requests_admin_delete" ON public.ticket_refund_requests
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "users_insert_own_questions" ON public.show_questions;
DROP POLICY IF EXISTS "users_read_own_questions" ON public.show_questions;
DROP POLICY IF EXISTS "admins_manage_questions" ON public.show_questions;
CREATE POLICY "show_questions_select_access" ON public.show_questions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "show_questions_insert_access" ON public.show_questions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );
CREATE POLICY "show_questions_admin_update" ON public.show_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));
CREATE POLICY "show_questions_admin_delete" ON public.show_questions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'));

DROP POLICY IF EXISTS "comments_own_delete" ON public.podcast_comments;
DROP POLICY IF EXISTS "comments_admin_delete" ON public.podcast_comments;
CREATE POLICY "comments_delete_access" ON public.podcast_comments
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Playlists puede existir por bootstrap/manual SQL fuera de migrations.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.playlists') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public playlists viewable" ON public.playlists;
    DROP POLICY IF EXISTS "Users manage own playlists" ON public.playlists;
    DROP POLICY IF EXISTS "playlists_public_read" ON public.playlists;
    DROP POLICY IF EXISTS "playlists_owner_write" ON public.playlists;

    CREATE POLICY "playlists_select_access" ON public.playlists
      FOR SELECT
      USING (is_public = true OR (SELECT auth.uid()) = user_id);

    CREATE POLICY "playlists_owner_insert" ON public.playlists
      FOR INSERT TO authenticated
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "playlists_owner_update" ON public.playlists
      FOR UPDATE TO authenticated
      USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);

    CREATE POLICY "playlists_owner_delete" ON public.playlists
      FOR DELETE TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;
