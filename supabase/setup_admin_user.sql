-- ============================================================
-- POLYFAUNA — Configurar usuario admin
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
--
-- INSTRUCCIONES:
-- 1. Primero crear el usuario en Authentication > Users
--    (o registrarlo desde la app en /signup)
-- 2. Reemplazar el email abajo con el del usuario admin
-- 3. Ejecutar este script
-- ============================================================

-- Promover usuario a admin por email
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'development.fractal@gmail.com' LIMIT 1
);

-- Verificar que funcionó
SELECT
  u.email,
  p.id,
  p.role,
  p.display_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'development.fractal@gmail.com';
