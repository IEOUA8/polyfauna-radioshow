-- Add uploaded_by to podcasts for ownership tracking
ALTER TABLE public.podcasts
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop the old service-role-only write policy
DROP POLICY IF EXISTS "podcasts_service_write" ON public.podcasts;

-- Artists, clubs, promoters and admins can insert their own podcasts
CREATE POLICY "podcasts_creator_insert" ON public.podcasts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('artist', 'club', 'promoter', 'admin')
    )
  );

-- Creators can update their own uploads
CREATE POLICY "podcasts_owner_update" ON public.podcasts
  FOR UPDATE
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

-- Creators can delete their own uploads
CREATE POLICY "podcasts_owner_delete" ON public.podcasts
  FOR DELETE
  USING (uploaded_by = auth.uid());

-- Service role retains full unrestricted access
CREATE POLICY "podcasts_service_all" ON public.podcasts
  FOR ALL
  USING (auth.role() = 'service_role');
