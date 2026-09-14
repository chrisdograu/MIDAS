create or replace function public.admin_list_game_media(_kind text, _reason text)
returns table(id uuid, user_id uuid, product_id uuid, texto text, images text[], is_spoiler boolean, visibility text, likes_count integer, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem consultar este conteúdo';
  end if;
  if coalesce(length(btrim(_reason)), 0) < 6 then
    raise exception 'Justificativa obrigatória (mínimo 6 caracteres)';
  end if;

  insert into public.admin_logs (admin_id, action, entity, reason)
  values (
    auth.uid(),
    'listar_conteudo_' || _kind,
    case when _kind = 'screenshots' then 'game_screenshots' else 'game_opinions' end,
    btrim(_reason)
  );

  if _kind = 'screenshots' then
    return query
      select s.id, s.user_id, s.product_id, s.caption, s.images, s.is_spoiler, s.visibility, s.likes_count, s.created_at
      from public.game_screenshots s
      order by s.created_at desc
      limit 500;
  elsif _kind = 'opinions' then
    return query
      select o.id, o.user_id, o.product_id, o.text, o.images, o.is_spoiler, o.visibility, o.likes_count, o.created_at
      from public.game_opinions o
      order by o.created_at desc
      limit 500;
  else
    raise exception 'Tipo de conteúdo inválido';
  end if;
end;
$$;

grant execute on function public.admin_list_game_media(text, text) to authenticated;

create or replace function public.admin_set_content_visibility(_kind text, _id uuid, _visibility text, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _antes text;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem moderar este conteúdo';
  end if;
  if _visibility not in ('private', 'friends', 'public', 'close_friends') then
    raise exception 'Visibilidade inválida';
  end if;

  if _kind = 'screenshots' then
    select visibility into _antes from public.game_screenshots where id = _id;
    update public.game_screenshots set visibility = _visibility where id = _id;
  elsif _kind = 'opinions' then
    select visibility into _antes from public.game_opinions where id = _id;
    update public.game_opinions set visibility = _visibility where id = _id;
  else
    raise exception 'Tipo de conteúdo inválido';
  end if;

  insert into public.admin_logs (admin_id, action, entity, entity_id, reason, payload)
  values (
    auth.uid(),
    'moderar_visibilidade_' || _kind,
    case when _kind = 'screenshots' then 'game_screenshots' else 'game_opinions' end,
    _id,
    nullif(btrim(coalesce(_reason, '')), ''),
    jsonb_build_object('antes', jsonb_build_object('visibility', _antes), 'depois', jsonb_build_object('visibility', _visibility))
  );
end;
$$;

grant execute on function public.admin_set_content_visibility(text, uuid, text, text) to authenticated;

create or replace function public.admin_delete_game_media(_kind text, _id uuid, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem remover este conteúdo';
  end if;
  if coalesce(length(btrim(_reason)), 0) < 6 then
    raise exception 'Justificativa obrigatória (mínimo 6 caracteres)';
  end if;

  if _kind = 'screenshots' then
    delete from public.game_screenshots where id = _id;
  elsif _kind = 'opinions' then
    delete from public.game_opinions where id = _id;
  else
    raise exception 'Tipo de conteúdo inválido';
  end if;

  insert into public.admin_logs (admin_id, action, entity, entity_id, reason)
  values (
    auth.uid(),
    'excluir_conteudo_' || _kind,
    case when _kind = 'screenshots' then 'game_screenshots' else 'game_opinions' end,
    _id,
    btrim(_reason)
  );
end;
$$;

grant execute on function public.admin_delete_game_media(text, uuid, text) to authenticated;