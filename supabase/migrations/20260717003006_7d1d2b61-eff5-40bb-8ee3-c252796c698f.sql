-- P1: listas customizadas na biblioteca do usuário
-- Nova coluna opcional `lista_custom` (texto curto) em biblioteca_usuario.
-- Serve como etiqueta de intenção paralela ao status (ex.: "presente", "quando trocar de PC").
ALTER TABLE public.biblioteca_usuario
  ADD COLUMN IF NOT EXISTS lista_custom text;

ALTER TABLE public.biblioteca_usuario
  DROP CONSTRAINT IF EXISTS biblioteca_usuario_lista_custom_len;

ALTER TABLE public.biblioteca_usuario
  ADD CONSTRAINT biblioteca_usuario_lista_custom_len
  CHECK (lista_custom IS NULL OR char_length(lista_custom) <= 40);

CREATE INDEX IF NOT EXISTS biblioteca_usuario_user_lista_idx
  ON public.biblioteca_usuario (user_id, lista_custom)
  WHERE lista_custom IS NOT NULL;