DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.profiles AS p
  SET display_name = CASE
    WHEN p.id = 'f7b5b60d-c305-4e9e-b691-07f8c205a18f'::uuid THEN 'Ana'
    WHEN p.id = '0f701a60-c554-49a7-87a2-8290c674fac3'::uuid THEN 'Bruno'
  END
  WHERE (p.id = 'f7b5b60d-c305-4e9e-b691-07f8c205a18f'::uuid AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND lower(u.email) = 'lier649@uorak.com'))
     OR (p.id = '0f701a60-c554-49a7-87a2-8290c674fac3'::uuid AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND lower(u.email) = 'hihapef605@37xiao.com'));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 2 THEN
    RAISE EXCEPTION 'Esperados dois perfis existentes; nenhum ajuste parcial será mantido.';
  END IF;
END
$$;