-- =====================================================================
-- Parte 60 · Ordem de serviço do banco nº1, onda 2: O2, O3, S8 e S10.
-- O2: regra única: o que está dentro de um nó na lixeira está na lixeira. Ao mandar um nó para a lixeira, os itens de
--     dentro ganham a MESMA hora de exclusão; ao restaurar o nó, voltam os que têm essa hora (o que já estava na lixeira
--     antes continua lá). A lixeira mostra só o nó (não cada item de dentro). Os itens que já estavam vivos dentro de nós
--     excluídos recebem a hora do nó mais alto excluído (voltam se ele for restaurado).
--     O QUE MUDA NA TELA: esses itens deixam de contar em listas, painéis e progresso (estavam dentro de uma aplicação excluída).
-- O3: vista public.itens_com_caminho (security_invoker): o item com cliente_id, projeto_id, produto_id e aplicacao_id,
--     calculados na hora pela árvore (nos_ancestrais). Mover uma frente ou aplicação muda o resultado na mesma hora.
-- S8: bi.ritmo_semanal é vista MATERIALIZADA (o Postgres não tem security_invoker para elas); ninguém logado lê direto.
-- S10: (a) tira de quem está logado as permissões que nenhuma política deixa usar (não muda nada do que a pessoa consegue);
--      (b) a vista etiquetas_sistema não aceita gravação: fica só leitura; (c) tabela nova no public não ganha mais
--      permissão sozinha (precisa de GRANT explícito); (d) RLS ligada nas tabelas do interno e na auditoria (defesa a mais:
--      hoje ninguém comum tem permissão nelas). FORCE ROW LEVEL SECURITY não foi ligado: as funções security definer
--      são do dono das tabelas e deixariam de funcionar.
-- Plano de volta: 60_onda2_arvore_e_permissoes_VOLTA.sql.
-- =====================================================================

-- ---------- O2 ----------
CREATE OR REPLACE FUNCTION logica.lixeira_listar()
 RETURNS TABLE(tipo text, id uuid, nome text, onde text, excluido_em timestamp with time zone, excluido_por text, dentro integer, apaga_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select n.tipo, n.id, n.nome,
         (select string_agg(x.nome, ' › ' order by a.distancia desc) from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = n.id and a.distancia > 0),
         n.excluido_em, p.nome,
         ((select count(*) from public.nos_ancestrais a where a.ancestral_id = n.id and a.distancia > 0)
          + (select count(*) from public.itens i where i.frente_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = n.id)))::integer,
         n.excluido_em + interval '30 days'
    from public.nos n left join public.pessoas p on p.id = n.excluido_por
   where n.excluido_em is not null and n.id in (select interno.nos_visiveis()) and interno.pode_excluir_no(n.id)
  union all
  select 'item', i.id, i.titulo,
         (select string_agg(x.nome, ' › ' order by a.distancia desc) from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = i.frente_id),
         i.excluido_em, p.nome,
         (select count(*) from public.itens f where f.excluido_em = i.excluido_em and f.id <> i.id and f.frente_id = i.frente_id)::integer,
         i.excluido_em + interval '30 days'
    from public.itens i left join public.pessoas p on p.id = i.excluido_por
   where i.excluido_em is not null and i.frente_id in (select interno.nos_editaveis())
     and not exists (select 1 from public.itens pai where pai.id = i.pai_id and pai.excluido_em = i.excluido_em)
     and not exists (select 1 from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = i.frente_id and x.excluido_em = i.excluido_em)
   order by 5 desc
$function$;

CREATE OR REPLACE FUNCTION logica.lixeira_mover(p_tipo text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare eu uuid := interno.pessoa_atual(); agora timestamptz := now(); fr uuid;
begin
  if eu is null then raise exception 'Entre no sistema para excluir.'; end if;
  if p_tipo = 'item' then
    select frente_id into fr from public.itens where id = p_id and excluido_em is null;
    if fr is null then raise exception 'Item não encontrado ou já está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode excluir este item.'; end if;
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id where i.excluido_em is null)
    update public.itens set excluido_em = agora, excluido_por = eu where id in (select id from sub);
  elsif p_tipo = 'no' then
    if not exists (select 1 from public.nos where id = p_id and excluido_em is null) then raise exception 'Não encontrado ou já está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode excluir este ponto da estrutura.'; end if;
    update public.nos set excluido_em = agora, excluido_por = eu where id = p_id;
    -- O2: o que está dentro vai junto, com a mesma hora (assim volta junto ao restaurar)
    update public.itens i set excluido_em = agora, excluido_por = eu
     where i.excluido_em is null and i.frente_id in (select x.no_id from public.nos_ancestrais x where x.ancestral_id = p_id);
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $function$;

CREATE OR REPLACE FUNCTION logica.lixeira_restaurar(p_tipo text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare quando timestamptz; fr uuid; pai uuid; acima text;
begin
  if interno.pessoa_atual() is null then raise exception 'Entre no sistema para restaurar.'; end if;
  if p_tipo = 'item' then
    select excluido_em, frente_id, pai_id into quando, fr, pai from public.itens where id = p_id;
    if quando is null then raise exception 'Este item não está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode restaurar este item.'; end if;
    acima := interno.no_na_lixeira(fr);
    if acima is not null then raise exception 'Restaure antes "%", que também está na lixeira.', acima; end if;
    if pai is not null and exists (select 1 from public.itens where id = pai and excluido_em is not null) then
      raise exception 'Restaure antes o item de cima, que também está na lixeira.'; end if;
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id where i.excluido_em = quando)
    update public.itens set excluido_em = null, excluido_por = null where id in (select id from sub);
  elsif p_tipo = 'no' then
    select excluido_em into quando from public.nos where id = p_id;
    if quando is null then raise exception 'Este ponto não está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode restaurar este ponto da estrutura.'; end if;
    select n.nome into acima from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
     where a.no_id = p_id and a.distancia > 0 and n.excluido_em is not null order by a.distancia desc limit 1;
    if acima is not null then raise exception 'Restaure antes "%", que também está na lixeira.', acima; end if;
    update public.nos set excluido_em = null, excluido_por = null where id = p_id;
    -- O2: volta junto o que foi para a lixeira com ele (mesma hora); o que já estava na lixeira antes continua lá
    update public.itens i set excluido_em = null, excluido_por = null
     where i.excluido_em = quando and i.frente_id in (select x.no_id from public.nos_ancestrais x where x.ancestral_id = p_id);
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $function$;


-- itens vivos dentro de nós já excluídos: vão para a lixeira junto com o nó mais alto excluído
-- (a lista fica guardada em interno.o2_itens_levados, para o plano de volta desfazer exatamente estes)
create table if not exists interno.o2_itens_levados (item_id uuid primary key, excluido_em timestamptz not null, levado_em timestamptz not null default now());
alter table interno.o2_itens_levados enable row level security;
revoke all on interno.o2_itens_levados from public, anon, authenticated, service_role;
insert into interno.o2_itens_levados (item_id, excluido_em)
select distinct on (i.id) i.id, n.excluido_em
  from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id join public.nos n on n.id = a.ancestral_id
 where i.excluido_em is null and n.excluido_em is not null
 order by i.id, a.distancia desc
on conflict (item_id) do nothing;
with alvo as (
  select distinct on (a.no_id) a.no_id, n.excluido_em, n.excluido_por
    from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
   where n.excluido_em is not null
   order by a.no_id, a.distancia desc)
update public.itens i set excluido_em = alvo.excluido_em, excluido_por = alvo.excluido_por
  from alvo where i.frente_id = alvo.no_id and i.excluido_em is null;

-- ---------- O3 ----------
create or replace view public.itens_com_caminho with (security_invoker = true) as
select i.*,
       c.cliente_id, c.projeto_id, c.produto_id, c.aplicacao_id
  from public.itens i
  left join lateral (
    select max(a.ancestral_id::text) filter (where n.tipo = 'cliente')::uuid   as cliente_id,
           max(a.ancestral_id::text) filter (where n.tipo = 'projeto')::uuid   as projeto_id,
           max(a.ancestral_id::text) filter (where n.tipo = 'produto')::uuid   as produto_id,
           max(a.ancestral_id::text) filter (where n.tipo = 'aplicacao')::uuid as aplicacao_id
      from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
     where a.no_id = i.frente_id) c on true;
comment on view public.itens_com_caminho is 'Item com o caminho na árvore (cliente, projeto, produto, aplicação), calculado na hora por nos_ancestrais. Use esta vista em relatório que junta itens: filtre sempre por projeto_id. A leitura segue as mesmas regras de itens (security_invoker).';
revoke all on public.itens_com_caminho from public, anon;
grant select on public.itens_com_caminho to authenticated, service_role;

-- ---------- S8 ----------
comment on materialized view bi.ritmo_semanal is 'Vista materializada (o Postgres não tem security_invoker para vista materializada). Ninguém logado lê direto: só as funções do bi, que filtram pelo que a pessoa vê. Não dar GRANT para authenticated.';
revoke all on bi.ritmo_semanal from public, anon, authenticated;

-- ---------- S10 ----------
do $$
declare r record; n int := 0;
begin
  -- (a) permissão que nenhuma política permissiva deixa usar: sai (o resultado para quem usa é o mesmo: recusado)
  for r in
    select c.oid, c.relname, p.priv
      from pg_class c cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p(priv)
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and c.relrowsecurity
       and has_table_privilege('authenticated', c.oid, p.priv)
       and not exists (select 1 from pg_policy po where po.polrelid = c.oid and po.polpermissive
                         and (po.polroles = '{0}' or 'authenticated'::regrole = any(po.polroles))
                         and po.polcmd in ('*', case p.priv when 'SELECT' then 'r' when 'INSERT' then 'a' when 'UPDATE' then 'w' else 'd' end)) loop
    execute format('revoke %s on public.%I from authenticated', r.priv, r.relname);
    n := n + 1;
  end loop;
  raise notice 'S10: % permissões sem política retiradas de authenticated', n;
  -- (d) RLS nas tabelas do interno e da auditoria
  for r in select c.relnamespace::regnamespace::text s, c.relname from pg_class c
            where c.relnamespace in ('interno'::regnamespace, 'auditoria'::regnamespace) and c.relkind in ('r','p') and not c.relrowsecurity loop
    execute format('alter table %I.%I enable row level security', r.s, r.relname);
  end loop;
end $$;
-- (b) vista que não aceita gravação
revoke insert, update, delete, truncate, references, trigger on public.etiquetas_sistema from authenticated, anon;
-- (c) tabela nova não ganha permissão sozinha (cada parte dá o GRANT que a tabela precisa)
alter default privileges in schema public revoke all on tables from authenticated;
comment on policy ver on public.cambio is 'Exceção documentada (S10): câmbio é tabela de referência, igual para todos; leitura liberada para quem está logado (using true). Ninguém logado grava.';
