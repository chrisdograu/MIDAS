CREATE TABLE public.bundle_images (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bundle_id uuid NOT NULL REFERENCES public.bundles(id) ON DELETE CASCADE,
 image_url text NOT NULL, is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bundle_id,image_url)
);
GRANT SELECT ON public.bundle_images TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bundle_images TO authenticated;
GRANT ALL ON public.bundle_images TO service_role;
ALTER TABLE public.bundle_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY bundle_images_public ON public.bundle_images FOR SELECT USING(EXISTS(SELECT 1 FROM public.bundles b WHERE b.id=bundle_id AND b.is_active));
CREATE POLICY bundle_images_admin ON public.bundle_images FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE UNIQUE INDEX bundle_single_primary ON public.bundle_images(bundle_id) WHERE is_primary;
CREATE TRIGGER bundle_images_updated BEFORE UPDATE ON public.bundle_images FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE FUNCTION public.sync_bundle_gallery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bid uuid; cover text;
BEGIN
 bid:=CASE WHEN TG_OP='DELETE' THEN OLD.bundle_id ELSE NEW.bundle_id END;
 SELECT image_url INTO cover FROM public.bundle_images WHERE bundle_id=bid ORDER BY is_primary DESC,created_at,id LIMIT 1;
 UPDATE public.bundles SET images=COALESCE((SELECT array_agg(image_url ORDER BY is_primary DESC,created_at,id) FROM public.bundle_images WHERE bundle_id=bid),'{}'::text[]),
 image_url=CASE WHEN cover IS NOT NULL THEN cover WHEN TG_OP='DELETE' AND image_url=OLD.image_url THEN NULL ELSE image_url END WHERE id=bid;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER bundle_gallery_sync AFTER INSERT OR UPDATE OR DELETE ON public.bundle_images FOR EACH ROW EXECUTE FUNCTION public.sync_bundle_gallery();
CREATE FUNCTION public.set_bundle_primary_image(_image_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bid uuid;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Somente administradores'; END IF;
 SELECT bundle_id INTO bid FROM public.bundle_images WHERE id=_image_id;
 IF bid IS NULL THEN RAISE EXCEPTION 'Imagem não encontrada'; END IF;
 PERFORM id FROM public.bundles WHERE id=bid FOR UPDATE;
 UPDATE public.bundle_images SET is_primary=false WHERE bundle_id=bid AND is_primary;
 UPDATE public.bundle_images SET is_primary=true WHERE id=_image_id;
END $$;
REVOKE ALL ON FUNCTION public.set_bundle_primary_image(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_bundle_primary_image(uuid) TO authenticated,service_role;

CREATE TABLE public.pedido_status_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
 previous_status public.order_status, status public.order_status NOT NULL, changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pedido_status_history TO authenticated;
GRANT ALL ON public.pedido_status_history TO service_role;
ALTER TABLE public.pedido_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_history_read ON public.pedido_status_history FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.pedidos p WHERE p.id=order_id AND p.user_id=auth.uid()));
CREATE INDEX pedido_history_order ON public.pedido_status_history(order_id,created_at);
CREATE TRIGGER pedido_history_updated BEFORE UPDATE ON public.pedido_status_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE FUNCTION public.record_order_status_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
 INSERT INTO public.pedido_status_history(order_id,status,changed_by) VALUES(NEW.id,NEW.status,auth.uid());
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
 INSERT INTO public.pedido_status_history(order_id,previous_status,status,changed_by) VALUES(NEW.id,OLD.status,NEW.status,auth.uid());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_pedido_status AFTER INSERT OR UPDATE OF status ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();

ALTER TABLE public.curated_lists ADD CONSTRAINT curated_lists_created_by_fkey FOREIGN KEY(created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE TABLE public.curated_list_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), list_id uuid NOT NULL REFERENCES public.curated_lists(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE, notes text, sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(list_id,product_id)
);
GRANT SELECT ON public.curated_list_items TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.curated_list_items TO authenticated;
GRANT ALL ON public.curated_list_items TO service_role;
ALTER TABLE public.curated_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY curated_items_read ON public.curated_list_items FOR SELECT USING(EXISTS(SELECT 1 FROM public.curated_lists l WHERE l.id=list_id));
CREATE POLICY curated_items_admin ON public.curated_list_items FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE TRIGGER curated_items_updated BEFORE UPDATE ON public.curated_list_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.saved_lists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), list_id uuid NOT NULL REFERENCES public.curated_lists(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,list_id)
);
GRANT SELECT,INSERT,DELETE ON public.saved_lists TO authenticated;
GRANT ALL ON public.saved_lists TO service_role;
ALTER TABLE public.saved_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_lists_read ON public.saved_lists FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY saved_lists_insert ON public.saved_lists FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.curated_lists l WHERE l.id=list_id));
CREATE POLICY saved_lists_delete ON public.saved_lists FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER saved_lists_updated BEFORE UPDATE ON public.saved_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.curated_list_follows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), list_id uuid NOT NULL REFERENCES public.curated_lists(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,list_id)
);
GRANT SELECT,INSERT,DELETE ON public.curated_list_follows TO authenticated;
GRANT ALL ON public.curated_list_follows TO service_role;
ALTER TABLE public.curated_list_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY curated_follows_read ON public.curated_list_follows FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY curated_follows_insert ON public.curated_list_follows FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND EXISTS(SELECT 1 FROM public.curated_lists l WHERE l.id=list_id));
CREATE POLICY curated_follows_delete ON public.curated_list_follows FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE INDEX curated_follows_list ON public.curated_list_follows(list_id);
CREATE TRIGGER curated_follows_updated BEFORE UPDATE ON public.curated_list_follows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE FUNCTION public.curated_list_follow_counts(_list_ids uuid[]) RETURNS TABLE(list_id uuid,follow_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT l.id,count(f.id) FROM public.curated_lists l LEFT JOIN public.curated_list_follows f ON f.list_id=l.id
 WHERE l.id=ANY(_list_ids) AND (l.is_public OR public.is_admin()) GROUP BY l.id;
$$;
REVOKE ALL ON FUNCTION public.curated_list_follow_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.curated_list_follow_counts(uuid[]) TO anon,authenticated,service_role;

CREATE TABLE public.audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON public.audit_log FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_admin_pleno());
CREATE INDEX audit_user_history ON public.audit_log(user_id,created_at DESC);
CREATE TRIGGER audit_updated BEFORE UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE FUNCTION public.audit_profile_privacy() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f text; before_value jsonb; after_value jsonb;
BEGIN
 FOREACH f IN ARRAY ARRAY['is_private','library_visibility','privacy_exceptions','always_hide_spoilers','stats_hidden_types','opinions_visibility','screenshots_visibility','timeline_visibility','friend_list_visibility','online_status_visibility','last_activity_visibility','reviews_visibility','require_follow_approval'] LOOP
 before_value:=to_jsonb(OLD)->f; after_value:=to_jsonb(NEW)->f;
 IF before_value IS DISTINCT FROM after_value THEN
 INSERT INTO public.audit_log(user_id,action,metadata) VALUES(NEW.id,'privacy_change',jsonb_build_object('field',f,'old_value',before_value,'new_value',after_value));
 END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER profile_privacy_audit AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_profile_privacy();
CREATE FUNCTION public.audit_privacy_grant() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.privacy_grants;
BEGIN
 r:=CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 INSERT INTO public.audit_log(user_id,action,metadata) VALUES(r.owner_id,'privacy_grant_change',jsonb_build_object('operation',TG_OP,'viewer_id',r.viewer_id,'scope',r.scope));
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER privacy_grant_audit AFTER INSERT OR UPDATE OR DELETE ON public.privacy_grants FOR EACH ROW EXECUTE FUNCTION public.audit_privacy_grant();

ALTER TABLE public.favoritos ADD COLUMN price_alert_sent boolean NOT NULL DEFAULT false;
CREATE POLICY favorites_owner_update ON public.favoritos FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE FUNCTION public.reset_favorite_price_alert() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.target_price IS NOT NULL AND NEW.target_price<=0 THEN RAISE EXCEPTION 'Preço-alvo deve ser maior que zero'; END IF;
 IF NEW.target_price IS DISTINCT FROM OLD.target_price THEN NEW.price_alert_sent:=false; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER favorite_target_reset BEFORE UPDATE ON public.favoritos FOR EACH ROW EXECUTE FUNCTION public.reset_favorite_price_alert();
CREATE FUNCTION public.claim_price_alerts() RETURNS TABLE(product_id uuid,current_price numeric,target_price numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 RETURN QUERY WITH claimed AS (
 UPDATE public.favoritos f SET price_alert_sent=true FROM public.produtos p
 WHERE f.user_id=auth.uid() AND f.product_id=p.id AND p.is_active AND f.target_price IS NOT NULL AND p.price<=f.target_price AND NOT f.price_alert_sent
 RETURNING f.product_id,p.price,f.target_price
 ) SELECT * FROM claimed;
END $$;
REVOKE ALL ON FUNCTION public.claim_price_alerts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_price_alerts() TO authenticated,service_role;

CREATE TABLE public.user_presence (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE, last_seen_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY presence_owner_read ON public.user_presence FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER presence_updated BEFORE UPDATE ON public.user_presence FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE FUNCTION public.touch_my_presence() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 INSERT INTO public.user_presence(user_id,last_seen_at) VALUES(auth.uid(),now()) ON CONFLICT(user_id) DO UPDATE SET last_seen_at=now() WHERE user_presence.last_seen_at<now()-interval '1 minute';
END $$;
CREATE FUNCTION public.get_user_presence(_user_id uuid) RETURNS TABLE(is_online boolean,last_seen_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN public.can_view_friend_content(p.id,auth.uid(),p.online_status_visibility) THEN COALESCE(u.last_seen_at>now()-interval '5 minutes',false) ELSE NULL END,
 CASE WHEN public.can_view_friend_content(p.id,auth.uid(),p.last_activity_visibility) THEN u.last_seen_at ELSE NULL END
 FROM public.profiles p LEFT JOIN public.user_presence u ON u.user_id=p.id WHERE p.id=_user_id;
$$;
REVOKE ALL ON FUNCTION public.touch_my_presence(),public.get_user_presence(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.touch_my_presence(),public.get_user_presence(uuid) TO authenticated,service_role;

ALTER TABLE public.categorias ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
CREATE FUNCTION public.admin_move_category(_id uuid,_direction text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_order integer; other_id uuid; other_order integer;
BEGIN
 IF NOT public.is_staff() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF _direction IS NULL OR _direction NOT IN ('up','down') THEN RAISE EXCEPTION 'Direção inválida'; END IF;
 PERFORM id FROM public.categorias ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.categorias WHERE id=_id) THEN RAISE EXCEPTION 'Categoria não encontrada'; END IF;
 WITH ranked AS(SELECT id,row_number() OVER(ORDER BY sort_order,name,id)::integer AS n FROM public.categorias) UPDATE public.categorias c SET sort_order=r.n FROM ranked r WHERE r.id=c.id AND c.sort_order IS DISTINCT FROM r.n;
 SELECT sort_order INTO current_order FROM public.categorias WHERE id=_id;
 IF _direction='up' THEN SELECT id,sort_order INTO other_id,other_order FROM public.categorias WHERE sort_order<current_order ORDER BY sort_order DESC LIMIT 1;
 ELSE SELECT id,sort_order INTO other_id,other_order FROM public.categorias WHERE sort_order>current_order ORDER BY sort_order LIMIT 1; END IF;
 IF other_id IS NULL THEN RETURN; END IF;
 UPDATE public.categorias SET sort_order=CASE WHEN id=_id THEN other_order ELSE current_order END WHERE id IN(_id,other_id);
 INSERT INTO public.admin_logs(admin_id,action,entity,entity_id,payload) VALUES(auth.uid(),'categoria_reordenar','categorias',_id,jsonb_build_object('direction',_direction));
END $$;
REVOKE ALL ON FUNCTION public.admin_move_category(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_move_category(uuid,text) TO authenticated,service_role;

ALTER TABLE public.review_comments ALTER COLUMN review_id DROP NOT NULL;
ALTER TABLE public.review_comments ADD COLUMN review_completa_id uuid REFERENCES public.reviews_completas(id) ON DELETE CASCADE;
ALTER TABLE public.review_comments ADD COLUMN parent_id uuid REFERENCES public.review_comments(id) ON DELETE CASCADE;
ALTER TABLE public.review_comments ADD CONSTRAINT review_comments_user_id_fkey FOREIGN KEY(user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX review_comments_parent ON public.review_comments(parent_id,created_at);
CREATE INDEX review_comments_full ON public.review_comments(review_completa_id,created_at);
CREATE FUNCTION public.validate_review_comment_target() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE parent public.review_comments;
BEGIN
 IF (NEW.review_id IS NULL)=(NEW.review_completa_id IS NULL) THEN RAISE EXCEPTION 'Informe apenas uma avaliação'; END IF;
 IF TG_OP='UPDATE' AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.review_completa_id IS DISTINCT FROM OLD.review_completa_id) THEN RAISE EXCEPTION 'O vínculo de um comentário não pode ser alterado'; END IF;
 IF NEW.parent_id IS NOT NULL THEN
 SELECT * INTO parent FROM public.review_comments WHERE id=NEW.parent_id;
 IF NOT FOUND OR parent.id=NEW.id OR parent.review_id IS DISTINCT FROM NEW.review_id OR parent.review_completa_id IS DISTINCT FROM NEW.review_completa_id THEN RAISE EXCEPTION 'A resposta deve pertencer à mesma avaliação'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER review_comment_target BEFORE INSERT OR UPDATE ON public.review_comments FOR EACH ROW EXECUTE FUNCTION public.validate_review_comment_target();
DROP POLICY "Anyone can view review comments" ON public.review_comments;
CREATE POLICY review_comments_read ON public.review_comments FOR SELECT USING(review_completa_id IS NULL OR EXISTS(SELECT 1 FROM public.reviews_completas r WHERE r.id=review_completa_id) AND (auth.uid()=user_id OR public.are_mutual_friends(user_id,auth.uid())));
DROP POLICY "Users can create comments" ON public.review_comments;
CREATE POLICY review_comments_insert ON public.review_comments FOR INSERT TO authenticated WITH CHECK(auth.uid()=user_id AND (review_completa_id IS NULL OR EXISTS(SELECT 1 FROM public.reviews_completas r WHERE r.id=review_completa_id AND (r.user_id=auth.uid() OR public.are_mutual_friends(r.user_id,auth.uid())))));
CREATE OR REPLACE FUNCTION public.notify_review_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE review_author uuid; review_product uuid;
BEGIN
 IF NEW.review_completa_id IS NOT NULL THEN SELECT user_id,product_id INTO review_author,review_product FROM public.reviews_completas WHERE id=NEW.review_completa_id;
 ELSE SELECT user_id,product_id INTO review_author,review_product FROM public.avaliacoes WHERE id=NEW.review_id; END IF;
 IF review_author IS NOT NULL AND review_author<>NEW.user_id AND NEW.content<>'__dislike__' AND public.should_notify(review_author,'social_replies') THEN
 INSERT INTO public.notifications(user_id,type,title,body,reference_type,reference_id) VALUES(review_author,'comentario_review','Alguém comentou na sua review',substring(NEW.content FROM 1 FOR 120),'produto',review_product);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER on_new_review_comment ON public.review_comments;

CREATE TABLE public.data_deletion_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'solicitado', requested_at timestamptz NOT NULL DEFAULT now(), scheduled_for timestamptz NOT NULL DEFAULT(now()+interval '30 days'),
 completed_at timestamptz, completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_deletion_requests TO authenticated;
GRANT ALL ON public.data_deletion_requests TO service_role;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY deletion_requests_read ON public.data_deletion_requests FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.is_admin_pleno());
CREATE UNIQUE INDEX deletion_one_active ON public.data_deletion_requests(user_id) WHERE status IN('solicitado','agendado');
CREATE TRIGGER deletion_updated BEFORE UPDATE ON public.data_deletion_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE FUNCTION public.validate_deletion_request() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status NOT IN('solicitado','agendado','concluido','cancelado') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 IF NEW.scheduled_for<NEW.requested_at THEN RAISE EXCEPTION 'Prazo inválido'; END IF;
 IF (NEW.status='concluido')<>(NEW.completed_at IS NOT NULL) THEN RAISE EXCEPTION 'Conclusão requer data'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER deletion_validate BEFORE INSERT OR UPDATE ON public.data_deletion_requests FOR EACH ROW EXECUTE FUNCTION public.validate_deletion_request();
CREATE FUNCTION public.request_my_data_deletion() RETURNS public.data_deletion_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result public.data_deletion_requests;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 PERFORM id FROM public.profiles WHERE id=auth.uid() FOR UPDATE;
 SELECT * INTO result FROM public.data_deletion_requests WHERE user_id=auth.uid() AND status IN('solicitado','agendado');
 IF FOUND THEN RETURN result; END IF;
 INSERT INTO public.data_deletion_requests(user_id) VALUES(auth.uid()) RETURNING * INTO result;
 INSERT INTO public.audit_log(user_id,action,metadata) VALUES(auth.uid(),'data_deletion_requested',jsonb_build_object('request_id',result.id,'scheduled_for',result.scheduled_for));
 RETURN result;
END $$;
CREATE FUNCTION public.admin_complete_data_deletion(_request_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.data_deletion_requests;
BEGIN
 IF NOT public.is_admin_pleno() THEN RAISE EXCEPTION 'Apenas administrador pleno'; END IF;
 SELECT * INTO r FROM public.data_deletion_requests WHERE id=_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
 IF r.status='concluido' THEN RETURN; END IF;
 IF r.status NOT IN('solicitado','agendado') THEN RAISE EXCEPTION 'Solicitação não está ativa'; END IF;
 PERFORM public.anonimizar_usuario(r.user_id);
 UPDATE public.data_deletion_requests SET status='concluido',completed_at=now(),completed_by=auth.uid() WHERE id=r.id;
 INSERT INTO public.audit_log(user_id,action,metadata) VALUES(r.user_id,'data_deletion_completed',jsonb_build_object('request_id',r.id,'completed_by',auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.request_my_data_deletion(),public.admin_complete_data_deletion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_my_data_deletion(),public.admin_complete_data_deletion(uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';