-- CicloDev · 55 · O cadastro do app do Supabase confere os dois códigos (02/10/2026).
-- Motivo: o Client Secret (começa com sba_) foi colado também no campo Client ID. O Client ID é público
-- (a tela e a janelinha mostram), então o segredo ficaria visível. Agora o banco recusa:
--   * Client ID que não é no formato do Supabase (um UUID, tipo a1b2c3d4-...);
--   * Client ID que começa com sba_ (é o segredo);
--   * segredo igual ao Client ID.
-- Mesma assinatura da parte 54 (não cria outra versão). Pode rodar de novo sem estragar nada.
create or replace function public.supa_app_gravar(p_client_id text, p_client_secret text, p_retorno text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare seg text := nullif(btrim(coalesce(p_client_secret, '')), ''); cid text := lower(btrim(coalesce(p_client_id, '')));
begin
  perform interno.exigir_dono();
  if cid = '' then raise exception 'Informe o Client ID do app do Supabase' using errcode = '22023'; end if;
  if cid like 'sba\_%' then raise exception 'Isso é o Client Secret (começa com sba_), não o Client ID. O Client ID é o código no formato a1b2c3d4-e5f6-... que o Supabase mostra junto.' using errcode = '22023'; end if;
  if cid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'O Client ID do Supabase tem o formato a1b2c3d4-e5f6-7890-abcd-ef1234567890. Confira se copiou o código certo.' using errcode = '22023'; end if;
  if coalesce(p_retorno, '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
  if seg is null then select client_secret into seg from interno.supa_app; end if;
  if seg is null then raise exception 'Informe o Client Secret do app do Supabase' using errcode = '22023'; end if;
  if lower(seg) = cid then raise exception 'O Client Secret não pode ser igual ao Client ID' using errcode = '22023'; end if;
  insert into interno.supa_app (id, client_id, client_secret, retorno, atualizado_por) values (true, cid, seg, p_retorno, interno.pessoa_atual())
  on conflict (id) do update set client_id = excluded.client_id, client_secret = excluded.client_secret, retorno = excluded.retorno, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return public.supa_app_status();
end $$;
