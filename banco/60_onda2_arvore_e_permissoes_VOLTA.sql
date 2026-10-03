-- VOLTA da parte 60.
-- O2: as funções da lixeira voltam como eram; os itens levados pela parte 60 voltam a ficar vivos (só os da lista).
update public.itens i set excluido_em = null, excluido_por = null
  from interno.o2_itens_levados l where l.item_id = i.id and i.excluido_em = l.excluido_em;
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
   order by 5 desc
$function$
;

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
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $function$
;

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
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $function$

;

-- O3
drop view if exists public.itens_com_caminho;
-- S10: (c) volta o padrão aberto de antes; (a) e (b) não voltam (eram permissões que nenhuma política deixava usar)
alter default privileges in schema public grant select, insert, update, delete, maintain on tables to authenticated;
