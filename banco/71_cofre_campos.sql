-- =====================================================================
-- Parte 71 · Cofre: a janela do item mostra só os campos que têm algo guardado (e os campos a mais, como Token ou nome
-- livre), sem precisar revelar nada. cofre_campos devolve só os NOMES dos campos preenchidos, nunca os valores:
--   {"campos": ["chave", "segredo"], "extras": ["Token", "Client ID"]}
-- Quem não pode ver o item recebe o mesmo erro de "não encontrado" do cofre_revelar. Não grava no histórico, porque
-- nenhum valor sai do Vault (o valor continua saindo só pelo cofre_revelar, que registra).
-- Plano de volta: 71_cofre_campos_VOLTA.sql.
-- =====================================================================
create or replace function logica.cofre_campos(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  if interno.pessoa_atual() is null or interno.cofre_nivel(p_id) is null then raise exception 'Item não encontrado' using errcode = '42501'; end if;
  select coalesce(nullif(d.decrypted_secret, ''), '{}')::jsonb into v from interno.cofre_vault c join vault.decrypted_secrets d on d.id = c.segredo_id where c.item_id = p_id;
  v := coalesce(v, '{}');
  return jsonb_build_object(
    'campos', coalesce((select jsonb_agg(k) from jsonb_each(v) e(k, x) where k <> 'extras' and jsonb_typeof(x) <> 'null' and btrim(x #>> '{}') <> ''), '[]'),
    'extras', coalesce((select jsonb_agg(coalesce(nullif(btrim(x ->> 'nome'), ''), 'Campo extra') order by n)
                          from jsonb_array_elements(case when jsonb_typeof(v -> 'extras') = 'array' then v -> 'extras' else '[]' end) with ordinality a(x, n)), '[]'));
end $$;
revoke all on function logica.cofre_campos(uuid) from public, anon, service_role;
grant execute on function logica.cofre_campos(uuid) to authenticated;
create or replace function public.cofre_campos(p_id uuid) returns jsonb language sql security invoker set search_path = '' as $$ select logica.cofre_campos($1) $$;
comment on function public.cofre_campos(uuid) is 'Porta da API do cofre (security invoker). O corpo e a regra de acesso estão em logica.cofre_campos.';
revoke all on function public.cofre_campos(uuid) from public, anon, service_role;
grant execute on function public.cofre_campos(uuid) to authenticated;
