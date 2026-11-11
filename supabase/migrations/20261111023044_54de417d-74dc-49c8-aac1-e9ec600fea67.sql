CREATE POLICY curated_lists_admin_manage ON public.curated_lists FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY curated_lists_owner_read ON public.curated_lists FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY curated_lists_community_create ON public.curated_lists FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND COALESCE(is_official, false) = false AND COALESCE(is_featured, false) = false AND approved_at IS NULL AND approved_by IS NULL AND category = 'comunidade');
CREATE POLICY curated_items_owner_create ON public.curated_list_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.curated_lists l WHERE l.id = list_id AND l.created_by = auth.uid() AND l.approved_at IS NULL AND COALESCE(l.is_official, false) = false));

CREATE OR REPLACE FUNCTION public.create_community_curated_list(_title text, _description text, _product_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE new_id uuid := gen_random_uuid(); list_slug text; clean_title text := btrim(_title); requested_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para criar uma lista.'; END IF;
  IF clean_title IS NULL OR clean_title = '' THEN RAISE EXCEPTION 'Informe o título da lista.'; END IF;
  SELECT array_agg(DISTINCT product_id) INTO requested_ids FROM unnest(_product_ids) AS product_id WHERE product_id IS NOT NULL;
  IF COALESCE(cardinality(requested_ids), 0) = 0 THEN RAISE EXCEPTION 'Selecione pelo menos um jogo.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(requested_ids) AS product_id WHERE NOT EXISTS (SELECT 1 FROM public.produtos p WHERE p.id = product_id AND p.is_active = true)) THEN RAISE EXCEPTION 'Um dos jogos selecionados não está disponível.'; END IF;
  list_slug := trim(both '-' from regexp_replace(lower(clean_title), '[^a-z0-9]+', '-', 'g'));
  IF list_slug = '' THEN list_slug := 'lista'; END IF;
  INSERT INTO public.curated_lists (id, title, slug, description, category, created_by, is_public, is_official, is_featured)
  VALUES (new_id, clean_title, list_slug || '-' || new_id::text, nullif(btrim(_description), ''), 'comunidade', auth.uid(), true, false, false);
  INSERT INTO public.curated_list_items (list_id, product_id, sort_order)
  SELECT new_id, product_id, (row_number() OVER (ORDER BY first_position) - 1)::integer
  FROM (SELECT product_id, min(position) AS first_position FROM unnest(_product_ids) WITH ORDINALITY AS selection(product_id, position) WHERE product_id IS NOT NULL GROUP BY product_id) unique_selection;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_community_curated_list(text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_community_curated_list(text, text, uuid[]) TO authenticated, service_role;