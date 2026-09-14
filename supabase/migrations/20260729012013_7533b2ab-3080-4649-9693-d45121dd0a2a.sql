-- 1) Visibilidade uniforme por tipo de conteúdo + ambiente pessoal
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS opinions_visibility text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS screenshots_visibility text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS timeline_visibility text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS personal_theme jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_opinions_visibility_chk CHECK (opinions_visibility IN ('public','friends','private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_screenshots_visibility_chk CHECK (screenshots_visibility IN ('public','friends','private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_timeline_visibility_chk CHECK (timeline_visibility IN ('public','friends','private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Denúncias agrupadas por conteúdo (nunca decide sozinho)
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reporters uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE OR REPLACE FUNCTION public.group_denuncia_by_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.denuncias%ROWTYPE;
BEGIN
  SELECT * INTO _existing
  FROM public.denuncias
  WHERE target_type = NEW.target_type
    AND target_id = NEW.target_id
    AND COALESCE(status, 'pendente') NOT IN ('resolvida','rejeitada','arquivada','fechada','resolvido')
  ORDER BY created_at ASC
  LIMIT 1;

  IF _existing.id IS NULL THEN
    NEW.reporters := ARRAY[NEW.reporter_id]::uuid[];
    NEW.report_count := 1;
    RETURN NEW;
  END IF;

  -- mesmo denunciante não infla o contador
  IF NEW.reporter_id = ANY(_existing.reporters) OR NEW.reporter_id = _existing.reporter_id THEN
    RETURN NULL;
  END IF;

  UPDATE public.denuncias
  SET reporters = array_append(
        CASE WHEN cardinality(reporters) = 0 THEN ARRAY[reporter_id]::uuid[] ELSE reporters END,
        NEW.reporter_id),
      report_count = GREATEST(report_count, 1) + 1,
      -- contador só acelera a fila de revisão humana; nunca remove nada
      priority = CASE
        WHEN GREATEST(report_count, 1) + 1 >= 5 THEN 'alta'
        WHEN GREATEST(report_count, 1) + 1 >= 3 AND COALESCE(priority,'normal') = 'normal' THEN 'media'
        ELSE priority END,
      description = COALESCE(description, '') ||
        CASE WHEN NEW.description IS NULL OR NEW.description = '' THEN ''
             ELSE E'\n---\n' || NEW.description END
  WHERE id = _existing.id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_group_denuncia_by_target ON public.denuncias;
CREATE TRIGGER trg_group_denuncia_by_target
BEFORE INSERT ON public.denuncias
FOR EACH ROW EXECUTE FUNCTION public.group_denuncia_by_target();

-- 3) Torneio comunitário x oficial
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS is_community boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlisted boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.enforce_community_tournament_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    NEW.is_community := true;
    NEW.unlisted := true;
    IF COALESCE(NEW.max_participants, 0) > 16 THEN
      RAISE EXCEPTION 'Torneios comunitários aceitam no máximo 16 participantes.';
    END IF;
  END IF;

  IF NEW.is_community THEN
    NEW.unlisted := true;
    IF COALESCE(NEW.max_participants, 0) > 16 THEN
      RAISE EXCEPTION 'Torneios comunitários aceitam no máximo 16 participantes.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_community_tournament_rules ON public.tournaments;
CREATE TRIGGER trg_enforce_community_tournament_rules
BEFORE INSERT OR UPDATE OF max_participants, is_community, unlisted ON public.tournaments
FOR EACH ROW EXECUTE FUNCTION public.enforce_community_tournament_rules();