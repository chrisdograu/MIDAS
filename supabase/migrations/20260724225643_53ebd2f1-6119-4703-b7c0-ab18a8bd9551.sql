
-- Item 106 — thread de fórum automática por torneio.
CREATE OR REPLACE FUNCTION public.create_tournament_forum_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só cria uma vez por torneio; se já existe, ignora.
  IF EXISTS (SELECT 1 FROM public.forum_posts WHERE tournament_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.forum_posts (user_id, tournament_id, title, content, visibility)
  VALUES (
    NEW.created_by,
    NEW.id,
    'Torneio: ' || COALESCE(NEW.title, 'sem título'),
    COALESCE(NEW.description, '')
      || E'\n\n— Thread oficial do torneio. Combinem regras, dúvidas e resultados por aqui.',
    'public'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca derruba a criação do torneio se o fórum falhar.
  RAISE WARNING 'create_tournament_forum_thread failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_tournament_forum_thread ON public.tournaments;
CREATE TRIGGER trg_create_tournament_forum_thread
AFTER INSERT ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.create_tournament_forum_thread();
