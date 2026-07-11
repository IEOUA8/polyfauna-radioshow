-- Elimina radio_shows: nunca tuvo datos reales. La operacion de radio vive
-- por completo en AzuraCast (playlist + rotacion cada 15-20 dias), no en
-- una programacion editorial con horarios fijos en Supabase. DROP TABLE
-- elimina en cascada sus policies (radio_shows_public_read,
-- radio_shows_admin_insert/update/delete).

DROP TABLE IF EXISTS public.radio_shows;
