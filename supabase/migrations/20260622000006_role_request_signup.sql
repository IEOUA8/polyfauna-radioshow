-- Create professional role requests atomically with the auth user.
-- This also works when email confirmation is enabled and no client session exists yet.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role TEXT := COALESCE(NEW.raw_user_meta_data->>'requested_role', 'citizen');
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;

  IF requested_role IN ('artist', 'promoter', 'club', 'sello') THEN
    INSERT INTO public.role_requests (user_id, requested_role, status, form_data)
    VALUES (
      NEW.id,
      requested_role,
      'pending',
      jsonb_build_object(
        'name', COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'email', NEW.email
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
