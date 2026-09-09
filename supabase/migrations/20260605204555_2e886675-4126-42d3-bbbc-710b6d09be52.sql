
-- Roles inside tournament group chat (separate from organizational moderators)
DO $$ BEGIN
  CREATE TYPE public.tournament_chat_role AS ENUM ('admin','member','observer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS chat_role public.tournament_chat_role NOT NULL DEFAULT 'observer';

-- Make sure moderators are admins in chat by default
UPDATE public.tournament_participants tp
SET chat_role = 'admin'
FROM public.tournament_moderators tm
WHERE tm.tournament_id = tp.tournament_id AND tm.user_id = tp.user_id AND tp.chat_role <> 'admin';

-- Block observers from sending messages in tournament group chat
CREATE OR REPLACE FUNCTION public.check_tournament_chat_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.tournament_chat_role;
BEGIN
  IF NEW.tournament_id IS NULL OR NEW.group_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT chat_role INTO r FROM public.tournament_participants
    WHERE tournament_id = NEW.tournament_id AND user_id = NEW.sender_id;
  IF r IS NULL THEN
    RAISE EXCEPTION 'Apenas participantes podem enviar mensagens no grupo do torneio';
  END IF;
  IF r = 'observer' THEN
    RAISE EXCEPTION 'Observadores não podem enviar mensagens';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_tournament_chat_role ON public.mensagens;
CREATE TRIGGER trg_check_tournament_chat_role
BEFORE INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.check_tournament_chat_role();
