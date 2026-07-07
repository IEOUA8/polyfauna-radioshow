-- Corrige organizers_admin_insert (Fase 1): se agregó 'collective' a la
-- lista de roles asumiendo que sería un valor nuevo de profiles.role. Se
-- descartó esa vía (ver nota en 20260707091200_co_promoters_collaboration_type_and_collective_role.sql):
-- los colectivos ya existen como profiles.role = 'promoter' con
-- organizer_type = 'collective', y por lo tanto ya están cubiertos por
-- 'promoter' en este chequeo sin necesitar el valor adicional.

DROP POLICY IF EXISTS "organizers_admin_insert" ON public.organizers;
CREATE POLICY "organizers_admin_insert" ON public.organizers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'promoter', 'club')
    )
  );
