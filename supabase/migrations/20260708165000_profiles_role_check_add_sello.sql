-- profiles_role_check nunca incluyo 'sello', aunque set_user_role,
-- process_role_request_admin, role_requests.requested_role y
-- provision_artist_profile_for ya lo tratan como rol valido desde hace
-- tiempo. Aprobar una solicitud de "Sello Discografico" llamaba a
-- set_user_role(..., 'sello', ...), que pasaba su propia validacion y
-- luego reventaba en el UPDATE profiles con "violates check constraint
-- profiles_role_check".
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['citizen'::text, 'artist'::text, 'promoter'::text, 'club'::text, 'admin'::text, 'sello'::text]));
