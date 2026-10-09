-- =====================================================================
-- Parte 72 · Sobras de fonte que saiu: quando um repositório ou um banco é desligado de vez (removido), os épicos e
-- histórias que o robô montou com ele ficavam no backlog sem nenhuma chave para tirá-los (a chave "Épicos e histórias"
-- some junto com a fonte). Agora:
--   fonte_sobras(p_no): lista as fontes que já saíram e ainda têm épicos e histórias vivos neste ponto ou abaixo dele,
--     com quantos são e quantos ninguém mexeu (sem comentário, anexo, subitem ou edição);
--   fonte_sobras_lixeira(p_no, p_origem, p_tudo): manda para a lixeira só os que ninguém mexeu (p_tudo = false) ou
--     todos (p_tudo = true). Tudo vai para a LIXEIRA (dá para voltar por lá), nada é apagado de vez. O épico montado
--     pelo robô só vai junto quando todas as histórias vivas dele vão.
-- Só quem pode editar o ponto onde a fonte estava ligada. Só vale para fonte que já saiu (fonte ligada usa a chave).
-- Plano de volta: 72_sobras_de_fonte_VOLTA.sql.
-- =====================================================================
create or replace function interno.fonte_saiu(p_origem text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_origem ~ '^repo:[0-9a-f-]{36}$' then not exists (select 1 from public.repositorios r where r.id = substr(p_origem, 6)::uuid)
    when p_origem ~ '^banco:[0-9a-f-]{36}$' then not exists (select 1 from public.infra_bancos b where b.id = substr(p_origem, 7)::uuid)
    else false end
$$;
revoke all on function interno.fonte_saiu(text) from public, anon, authenticated;

create or replace function logica.fonte_sobras(p_no uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual();
begin
  if eu is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if p_no is null or p_no not in (select interno.nos_editaveis()) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('origem', s.origem, 'tipo', split_part(s.origem, ':', 1), 'nome', s.rotulo, 'no_id', s.no_id,
             'itens', s.itens, 'intactos', (select count(*) from interno.itens_da_fonte_intactos(s.no_id, s.origem))) order by s.rotulo)
      -- conta as histórias e os épicos que o robô montou para elas (o mesmo que "todos" manda para a lixeira)
      from (select v.origem, v.no_id, max(v.rotulo) rotulo,
                   count(distinct i.id) + (select count(*) from public.itens e where e.excluido_em is null and e.tipo = 'epic' and e.descricao like 'Épico montado pelo CicloDev%'
                                             and e.id in (select i2.pai_id from public.itens i2 join public.analise_inventario v2 on v2.item_id = i2.id
                                                           where v2.origem = v.origem and v2.no_id = v.no_id and i2.excluido_em is null)) itens
              from public.analise_inventario v join public.itens i on i.id = v.item_id and i.excluido_em is null
             where v.no_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no)
               and v.no_id in (select interno.nos_editaveis()) and interno.fonte_saiu(v.origem)
             group by v.origem, v.no_id) s), '[]'::jsonb);
end $$;

create or replace function logica.fonte_sobras_lixeira(p_no uuid, p_origem text, p_tudo boolean default false) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); v_no uuid; n int := 0; agora timestamptz := now();
begin
  if eu is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  if p_origem is null or not interno.fonte_saiu(p_origem) then raise exception 'Esta fonte ainda está ligada: use a chave Épicos e histórias dela' using errcode = '22023'; end if;
  for v_no in select distinct v.no_id from public.analise_inventario v
               where v.origem = p_origem and v.no_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no)
                 and v.no_id in (select interno.nos_editaveis()) loop
    if coalesce(p_tudo, false) then
      with st as (select i.id, i.pai_id from public.itens i join public.analise_inventario v on v.item_id = i.id
                   where v.origem = p_origem and i.excluido_em is null
                     and i.frente_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = v_no)),
      -- o épico do robô só vai se todas as histórias vivas dele forem junto
      ep as (select e.id from public.itens e where e.id in (select pai_id from st) and e.tipo = 'epic' and e.excluido_em is null
               and e.descricao like 'Épico montado pelo CicloDev%'
               and not exists (select 1 from public.itens f where f.pai_id = e.id and f.excluido_em is null and f.id not in (select id from st))),
      x as (update public.itens set excluido_em = agora, excluido_por = eu where id in (select id from st union select id from ep) returning 1)
      select n + count(*) into n from x;
    else
      with x as (update public.itens set excluido_em = agora, excluido_por = eu where id in (select interno.itens_da_fonte_intactos(v_no, p_origem)) returning 1)
      select n + count(*) into n from x;
    end if;
  end loop;
  perform interno.fonte_inventario_limpar(p_origem);
  return n;
end $$;

revoke all on function logica.fonte_sobras(uuid) from public, anon;
grant execute on function logica.fonte_sobras(uuid) to authenticated;
revoke all on function logica.fonte_sobras_lixeira(uuid, text, boolean) from public, anon;
grant execute on function logica.fonte_sobras_lixeira(uuid, text, boolean) to authenticated;

create or replace function public.fonte_sobras(p_no uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select logica.fonte_sobras($1) $$;
comment on function public.fonte_sobras(uuid) is 'Porta da API (security invoker). O corpo e a regra de acesso estão em logica.fonte_sobras.';
create or replace function public.fonte_sobras_lixeira(p_no uuid, p_origem text, p_tudo boolean default false) returns integer
language sql security invoker set search_path = '' as $$ select logica.fonte_sobras_lixeira($1, $2, $3) $$;
comment on function public.fonte_sobras_lixeira(uuid, text, boolean) is 'Porta da API (security invoker). O corpo e a regra de acesso estão em logica.fonte_sobras_lixeira.';
revoke all on function public.fonte_sobras(uuid) from public, anon;
grant execute on function public.fonte_sobras(uuid) to authenticated;
revoke all on function public.fonte_sobras_lixeira(uuid, text, boolean) from public, anon;
grant execute on function public.fonte_sobras_lixeira(uuid, text, boolean) to authenticated;
