CREATE POLICY developer_channel_image_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = 'developer-updates' AND public.can_manage_developer_channel(CASE WHEN (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (storage.foldername(name))[2]::uuid ELSE NULL END));
CREATE OR REPLACE FUNCTION public.admin_move_team_member(_member_id uuid, _direction text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_order integer; v_other uuid; v_other_order integer;
BEGIN
IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
IF _direction NOT IN ('up','down') OR _direction IS NULL THEN RAISE EXCEPTION 'Direção inválida'; END IF;
PERFORM id FROM public.team_members ORDER BY id FOR UPDATE;
IF NOT EXISTS(SELECT 1 FROM public.team_members WHERE id=_member_id) THEN RAISE EXCEPTION 'Membro não encontrado'; END IF;
WITH ranked AS (SELECT id, row_number() OVER (ORDER BY display_order NULLS LAST, id)::integer AS n FROM public.team_members) UPDATE public.team_members t SET display_order=r.n FROM ranked r WHERE t.id=r.id AND t.display_order IS DISTINCT FROM r.n;
SELECT display_order INTO v_order FROM public.team_members WHERE id=_member_id;
IF _direction='up' THEN SELECT id,display_order INTO v_other,v_other_order FROM public.team_members WHERE display_order<v_order ORDER BY display_order DESC LIMIT 1;
ELSE SELECT id,display_order INTO v_other,v_other_order FROM public.team_members WHERE display_order>v_order ORDER BY display_order LIMIT 1; END IF;
IF v_other IS NULL THEN RETURN; END IF;
UPDATE public.team_members SET display_order=CASE WHEN id=_member_id THEN v_other_order ELSE v_order END WHERE id IN (_member_id,v_other);
END; $$;
REVOKE ALL ON FUNCTION public.admin_move_team_member(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_move_team_member(uuid,text) TO authenticated,service_role;