-- POLYFAUNA — subir podcasts es exclusivo de clubes, artistas, sellos y
-- colectivos (promotores individuales quedan fuera), gestionado desde el
-- panel operativo. Además, el admin necesita poder editar/borrar podcasts
-- subidos por cualquier creador desde ese mismo panel (antes solo existía
-- podcasts_owner_update/delete, limitado a uploaded_by = auth.uid()).

DROP POLICY IF EXISTS "podcasts_creator_insert" ON public.podcasts;
CREATE POLICY "podcasts_creator_insert" ON public.podcasts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (
          role IN ('artist', 'club', 'sello', 'admin')
          OR (role = 'promoter' AND organizer_type = 'collective')
        )
    )
  );

DROP POLICY IF EXISTS "podcasts_admin_all" ON public.podcasts;
CREATE POLICY "podcasts_admin_all" ON public.podcasts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
