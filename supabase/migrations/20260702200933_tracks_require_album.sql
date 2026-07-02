-- POLYFAUNA — todo track vive dentro de un álbum (un sencillo es un álbum
-- de un solo track). Se quitó el gestor independiente de Tracks del panel;
-- ahora se crean desde la ficha del álbum, así que album_id ya no puede
-- quedar vacío. Confirmado 0 filas en tracks al momento de esta migración,
-- por lo que no hay datos huérfanos que migrar.

ALTER TABLE public.tracks
  ALTER COLUMN album_id SET NOT NULL;
