CREATE OR REPLACE FUNCTION public.prevent_message_tampering()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.uid() = OLD.receiver_id THEN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
  OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
  OR NEW.content IS DISTINCT FROM OLD.content
  OR NEW.anuncio_id IS DISTINCT FROM OLD.anuncio_id
  OR NEW.message_type IS DISTINCT FROM OLD.message_type
  OR NEW.image_url IS DISTINCT FROM OLD.image_url
  OR NEW.tournament_id IS DISTINCT FROM OLD.tournament_id
  OR NEW.match_id IS DISTINCT FROM OLD.match_id
  OR NEW.is_admin_chat IS DISTINCT FROM OLD.is_admin_chat
  OR NEW.flagged_auto IS DISTINCT FROM OLD.flagged_auto
  OR NEW.group_id IS DISTINCT FROM OLD.group_id
  OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
  THEN RAISE EXCEPTION 'Destinatário não pode alterar conteúdo da mensagem'; END IF;
  IF NEW.payload IS DISTINCT FROM OLD.payload THEN
   IF OLD.message_type <> 'counteroffer'
    OR OLD.payload->>'status' IS DISTINCT FROM 'pending'
    OR COALESCE(NEW.payload->>'status','') NOT IN ('accepted','rejected')
    OR (NEW.payload - 'status') IS DISTINCT FROM (OLD.payload - 'status')
   THEN RAISE EXCEPTION 'Destinatário só pode responder uma contraoferta pendente sem alterar seus termos'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_new_message ON public.mensagens;
CREATE OR REPLACE FUNCTION public.notify_forum_reply_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; author_name text;
BEGIN
 SELECT user_id INTO owner_id FROM public.forum_posts WHERE id = NEW.post_id;
 IF owner_id IS NULL OR owner_id = NEW.user_id THEN RETURN NEW; END IF;
 SELECT display_name INTO author_name FROM public.profiles WHERE id = NEW.user_id;
 INSERT INTO public.notifications(user_id,type,title,body,reference_type,reference_id,cta_url)
 VALUES(owner_id,'comentario_review',COALESCE(author_name,'Alguém') || ' comentou sua publicação',left(NEW.content,100),'forum_post',NEW.post_id,'/m/forum/post/' || NEW.post_id::text);
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_forum_reply_author() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notify_forum_reply_author ON public.forum_replies;
CREATE TRIGGER notify_forum_reply_author AFTER INSERT ON public.forum_replies FOR EACH ROW EXECUTE FUNCTION public.notify_forum_reply_author();
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.start_conversation(uuid,text,uuid)'::regprocedure) INTO definition;
 definition := replace(definition, chr(13), '');
 definition := regexp_replace(definition, 'IF[[:space:]]+_existing.status = ''pending'' THEN.*?_existing.status := ''accepted'';[[:space:]]+END IF;', '-- Pending conversations require recipient approval.', 's');
 definition := replace(definition, E'    -- Se a conversa anterior estava presa como pending, aprova para liberar o chat\n    IF _existing.status = ''pending'' THEN\n      UPDATE public.conversas\n         SET status = ''accepted''\n        WHERE id = _existing.id;\n      _existing.status := ''accepted'';\n    END IF;', '    -- Preserve pending approvals when reusing a conversation.');
 definition := replace(definition, E'    -- Se a conversa anterior estava presa como pending, aprova para liberar o chat\r\n    IF _existing.status = ''pending'' THEN\r\n      UPDATE public.conversas\r\n         SET status = ''accepted''\r\n        WHERE id = _existing.id;\r\n      _existing.status := ''accepted'';\r\n    END IF;', '    -- Preserve pending approvals when reusing a conversation.');
 IF definition LIKE '%_existing.status := ''accepted''%' THEN RAISE EXCEPTION 'Could not safely preserve pending conversation approval'; END IF;
 EXECUTE definition;
END $patch$;