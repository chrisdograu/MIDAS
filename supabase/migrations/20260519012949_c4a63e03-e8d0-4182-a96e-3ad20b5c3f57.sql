
-- Update game suggestion notification to link directly to the created product
CREATE OR REPLACE FUNCTION public.notify_game_suggestion_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.requested_by, 'nova_mensagem', '🎮 Sua sugestão foi aprovada!',
            COALESCE(NEW.admin_notes, format('"%s" foi adicionado ao catálogo.', NEW.title)),
            CASE WHEN NEW.created_product_id IS NOT NULL THEN 'produto' ELSE 'game_suggestion' END,
            COALESCE(NEW.created_product_id, NEW.id));
  ELSIF NEW.status = 'rejeitado' AND OLD.status = 'pendente' THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (NEW.requested_by, 'nova_mensagem', 'Sugestão de jogo não aprovada',
            COALESCE(NEW.admin_notes, format('"%s" não foi aprovada pela equipe.', NEW.title)),
            'game_suggestion', NEW.id);
  END IF;
  RETURN NEW;
END;$function$;

-- Update review comment notification to reference the product directly
CREATE OR REPLACE FUNCTION public.notify_review_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE review_author UUID; review_product UUID;
BEGIN
  SELECT user_id, product_id INTO review_author, review_product FROM public.avaliacoes WHERE id = NEW.review_id;
  IF review_author IS NOT NULL AND review_author != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, reference_type, reference_id)
    VALUES (review_author, 'comentario_review', 'Alguém comentou na sua review',
            substring(NEW.content from 1 for 120),
            'produto', review_product);
  END IF;
  RETURN NEW;
END;
$function$;
