CREATE OR REPLACE FUNCTION public.create_tournament_forum_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _pid uuid;
BEGIN
  IF COALESCE(NEW.is_community, false) THEN RETURN NEW; END IF;
  SELECT id INTO _pid FROM public.forum_posts WHERE tournament_id = NEW.id LIMIT 1;
  IF _pid IS NULL THEN
    INSERT INTO public.forum_posts (user_id, tournament_id, product_id, title, content, visibility)
    VALUES (NEW.created_by, NEW.id, NEW.product_id, 'Torneio: ' || COALESCE(NEW.title, 'sem título'),
      COALESCE(NEW.description,'') || E'\n\n— Thread oficial do torneio. Combinem regras, dúvidas e resultados por aqui.', 'public')
    RETURNING id INTO _pid;
  END IF;
  UPDATE public.tournaments SET forum_thread_id = _pid WHERE id = NEW.id AND forum_thread_id IS DISTINCT FROM _pid;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_tournament_forum_thread failed: %', SQLERRM;
  RETURN NEW;
END $$;

UPDATE public.forum_posts fp SET product_id = t.product_id
FROM public.tournaments t WHERE fp.tournament_id = t.id AND fp.product_id IS NULL AND t.product_id IS NOT NULL;

UPDATE public.tournaments t SET forum_thread_id = fp.id
FROM public.forum_posts fp WHERE fp.tournament_id = t.id AND t.forum_thread_id IS NULL;