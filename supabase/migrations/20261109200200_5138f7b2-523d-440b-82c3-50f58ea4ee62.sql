CREATE OR REPLACE FUNCTION public.enforce_community_tournament_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _max int; _ativos int;
BEGIN
  _max := public.param_num('community_tournament_max_participants', 16)::int;
  IF NOT public.is_staff() THEN
    NEW.is_community := true;
    NEW.unlisted := true;
  END IF;
  IF NEW.is_community THEN
    NEW.unlisted := true;
    IF COALESCE(NEW.max_participants, 0) > _max THEN
      RAISE EXCEPTION 'Torneios comunitários aceitam no máximo % participantes.', _max;
    END IF;
  ELSE
    IF TG_OP = 'INSERT' AND NEW.created_by IS NOT NULL THEN
      SELECT count(*) INTO _ativos FROM public.tournaments
       WHERE created_by = NEW.created_by AND COALESCE(is_community,false) = false
         AND lower(COALESCE(status,'')) NOT IN ('encerrado','cancelado','finished','cancelled','concluido','closed','completed','archived')
         AND archived_at IS NULL;
      IF _ativos >= 1 THEN
        RAISE EXCEPTION 'Você já tem um torneio oficial ativo. Encerre ou cancele antes de criar outro.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;