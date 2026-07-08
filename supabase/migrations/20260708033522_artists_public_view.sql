-- POLYFAUNA — corrige que Artists & Labels muestre colectivos/clubes.
--
-- artists.type es un campo de doble uso: ArtistManager.jsx (admin) lo usa
-- como descriptor artistico libre (artist/dj/live act/producer/collective/
-- label — "collective" ahi significa "banda/grupo", nada que ver con
-- Colonia). provision_artist_profile_for() lo usa ademas para auto-crear
-- una fila "espejo" de contenido (musica/podcast/entrevistas) cuando una
-- cuenta promoter/club se aprueba, con ese MISMO valor 'collective' o
-- 'club'. Filtrar por `type <> 'collective'` excluiria por error un grupo
-- musical legitimo cargado a mano por un admin sin cuenta propia.
--
-- La señal real para distinguir un "espejo de organizador" es su
-- artists.user_id: solo esas filas apuntan a una cuenta con
-- profiles.role IN ('promoter','club'). Se crea una vista que excluye
-- exactamente esas, dejando pasar cualquier fila type='collective' que no
-- este vinculada a una cuenta promoter/club (grupo musical real).

CREATE OR REPLACE VIEW public.artists_public
WITH (security_invoker = true) AS
SELECT a.*
FROM public.artists a
LEFT JOIN public.profiles p ON p.id = a.user_id
WHERE p.role IS NULL OR p.role NOT IN ('promoter', 'club');

GRANT SELECT ON public.artists_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
