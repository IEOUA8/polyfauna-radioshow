-- Make role requests visible through PostgREST and recover incomplete signups.

INSERT INTO public.profiles (id, display_name, avatar_url, role)
SELECT
  users.id,
  COALESCE(users.raw_user_meta_data->>'name', split_part(users.email, '@', 1)),
  users.raw_user_meta_data->>'avatar_url',
  'citizen'
FROM auth.users AS users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles AS profiles WHERE profiles.id = users.id
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_requests (user_id, requested_role, status, form_data)
SELECT
  users.id,
  users.raw_user_meta_data->>'requested_role',
  'pending',
  jsonb_build_object(
    'name', COALESCE(users.raw_user_meta_data->>'name', split_part(users.email, '@', 1)),
    'email', users.email,
    'source', 'delivery_recovery'
  )
FROM auth.users AS users
WHERE users.raw_user_meta_data->>'requested_role' IN ('artist', 'promoter', 'club', 'sello')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_requests AS requests
    WHERE requests.user_id = users.id
  );

ALTER TABLE public.role_requests
  DROP CONSTRAINT IF EXISTS role_requests_user_profile_fkey;

ALTER TABLE public.role_requests
  ADD CONSTRAINT role_requests_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.role_requests
  VALIDATE CONSTRAINT role_requests_user_profile_fkey;

NOTIFY pgrst, 'reload schema';
