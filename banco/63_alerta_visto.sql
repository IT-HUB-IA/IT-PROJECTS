-- =====================================================================
-- Parte 63 · Biblioteca com falha conhecida: alerta, sem travar a entrega.
-- Cada achado da análise ganha "visto por, quando". O alerta fica aceso enquanto ninguém marcou como visto.
-- Acende (de novo) quando: o achado é novo, voltou depois de corrigido, ficou mais grave, ou a biblioteca ganhou falha nova.
-- Quando uma biblioteca com falha acende o alerta, quem participa do ponto recebe um aviso no sininho (um por rodada).
-- Marcar como visto: qualquer pessoa da equipe que vê o ponto (não o stakeholder); fica registrado quem e quando.
-- Visto não é corrigido nem ignorado: o achado continua aberto até sumir do código.
-- Plano de volta: 63_alerta_visto_VOLTA.sql.
-- =====================================================================
alter table public.analise_achados add column if not exists visto_em timestamptz, add column if not exists visto_por uuid references public.pessoas(id) on delete set null;
comment on column public.analise_achados.visto_em is 'Quando alguém marcou o alerta como visto (nulo = alerta aceso). Volta a nulo se o achado voltar, piorar ou a biblioteca ganhar falha nova.';
create index if not exists analise_achados_visto_por_fk_idx on public.analise_achados (visto_por);
-- o que já existe hoje não acende alerta de uma vez (só o que aparecer daqui em diante)
update public.analise_achados set visto_em = coalesce(ultimo_em, now()) where visto_em is null;

create or replace function interno.peso_gravidade(g text) returns integer language sql immutable set search_path = '' as
$$ select case g when 'critica' then 4 when 'alta' then 3 when 'media' then 2 when 'baixa' then 1 else 0 end $$;

-- quem participa do ponto: membros do espaço e quem participa (direto ou por equipe) do ponto ou de algo acima; nunca stakeholder
create or replace function interno.pessoas_do_no(p_no uuid) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.pessoas p
   where p.ativo and p.papel <> 'stakeholder' and p.auth_user_id is not null
     and (exists (select 1 from public.nos n join public.espaco_membros m on m.espaco_id = n.espaco_id and m.pessoa_id = p.id where n.id = p_no)
          or exists (select 1 from public.nos n join public.espacos e on e.id = n.espaco_id and e.dono_id = p.id where n.id = p_no)
          or exists (select 1 from public.nos_ancestrais a where a.no_id = p_no
                       and a.ancestral_id in (select pa.no_id from public.participacoes pa where pa.pessoa_id = p.id
                                              union select en.no_id from public.equipes_nos en join public.equipes e on e.id = en.equipe_id and e.ativa
                                                    join public.equipes_membros em on em.equipe_id = en.equipe_id where em.pessoa_id = p.id)))
$$;

create or replace function interno.analise_avisar(p_no uuid, p_rotulo text, p_alertas jsonb) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int := jsonb_array_length(p_alertas); pior text; titulo text; texto text; k int;
begin
  select g into pior from (select x->>'g' g from jsonb_array_elements(p_alertas) x) y order by interno.peso_gravidade(g) desc limit 1;
  titulo := left((case when n = 1 then 'Biblioteca com falha conhecida' else n || ' bibliotecas com falha conhecida' end) || ' em ' || coalesce(nullif(p_rotulo, ''), (select nome from public.nos where id = p_no)), 200);
  texto := left('Pior gravidade: ' || case pior when 'critica' then 'crítica' when 'media' then 'média' else pior end || '. '
             || (select string_agg(x->>'t', '; ') from (select x from jsonb_array_elements(p_alertas) x order by interno.peso_gravidade(x->>'g') desc limit 5) z)
             || case when n > 5 then '; e mais ' || (n - 5) else '' end
             || '. Veja em ' || (select nome from public.nos where id = p_no) || ', aba Análise, e marque como visto. Nada foi travado.', 1000);
  insert into public.notificacoes (pessoa_id, titulo, texto, tipo)
  select q, titulo, texto, 'aviso' from interno.pessoas_do_no(p_no) q;
  get diagnostics k = row_count;
  return k;
end $$;
revoke all on function interno.peso_gravidade(text), interno.pessoas_do_no(uuid), interno.analise_avisar(uuid, text, jsonb) from public, anon;
grant execute on function interno.peso_gravidade(text) to authenticated, service_role;
revoke all on function interno.pessoas_do_no(uuid), interno.analise_avisar(uuid, text, jsonb) from authenticated, service_role;

-- marcar como visto (um, vários ou todos os de um ponto); devolve quantos mudaram
create or replace function logica.analise_marcar_visto(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); k int;
begin
  if eu is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if (select interno.eh_stakeholder()) then raise exception 'Quem só acompanha não marca alertas' using errcode = '42501'; end if;
  update public.analise_achados set visto_em = now(), visto_por = eu
   where id = any(coalesce(p_ids, '{}')) and visto_em is null and no_id in (select interno.nos_visiveis());
  get diagnostics k = row_count;
  return k;
end $$;
revoke all on function logica.analise_marcar_visto(uuid[]) from public, anon;
grant execute on function logica.analise_marcar_visto(uuid[]) to authenticated;
create or replace function public.analise_marcar_visto(p_ids uuid[]) returns integer
language sql security invoker set search_path = '' as $$ select * from logica.analise_marcar_visto($1) $$;
comment on function public.analise_marcar_visto(uuid[]) is 'Porta da API (security invoker). O corpo e a regra de acesso estão em logica.analise_marcar_visto.';
revoke all on function public.analise_marcar_visto(uuid[]) from public, anon;
grant execute on function public.analise_marcar_visto(uuid[]) to authenticated;

-- a gravação da análise acende o alerta e avisa (mesma assinatura e mesma resposta, com "alertas" a mais)
CREATE OR REPLACE FUNCTION public.analise_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_referencia text, p_arquivos integer, p_achados jsonb, p_avisos text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a jsonb; org text; imp text; vistos text[] := '{}'; novos integer := 0; corr integer := 0; abertos integer; velho public.analise_achados;
  alertas jsonb := '[]';   -- bibliotecas com falha que acenderam o alerta nesta rodada
  ids_corr uuid[]; itens_mov uuid[]; revisao uuid;
begin
  if (p_repositorio is null) = (p_banco is null) then raise exception 'Diga o repositório ou o banco (um dos dois)' using errcode = '22023'; end if;
  if p_repositorio is not null and not exists (select 1 from public.repositorios where id = p_repositorio and no_id = p_no) then return null; end if;
  if p_banco is not null and not exists (select 1 from public.infra_bancos where id = p_banco and no_id = p_no) then return null; end if;
  if jsonb_typeof(coalesce(p_achados, '[]')) <> 'array' then raise exception 'Achados inválidos' using errcode = '22023'; end if;
  org := case when p_repositorio is not null then 'repo:' || p_repositorio else 'banco:' || p_banco end;
  for a in select * from jsonb_array_elements(coalesce(p_achados, '[]')) limit 1000 loop
    imp := a->>'impressao';
    if imp is null or imp !~ '^[0-9a-f]{8}$' or imp = any(vistos) then continue; end if;
    vistos := array_append(vistos, imp);
    velho := null;
    select * into velho from public.analise_achados where no_id = p_no and origem = org and impressao = imp;
    if velho.id is null then
      insert into public.analise_achados (no_id, origem, repositorio_id, banco_id, rotulo, regra, gravidade, titulo, onde, trecho, impressao, referencia)
      values (p_no, org, p_repositorio, p_banco, left(coalesce(p_rotulo, ''), 200), a->>'regra', a->>'gravidade', left(a->>'titulo', 300), left(a->>'onde', 500), left(coalesce(a->>'trecho', ''), 400), imp, left(p_referencia, 200));
      novos := novos + 1;
      if a->>'regra' = 'DEP-01' then alertas := alertas || jsonb_build_array(jsonb_build_object('g', a->>'gravidade', 't', left(a->>'titulo', 120))); end if;
    else
      update public.analise_achados set gravidade = a->>'gravidade', titulo = left(a->>'titulo', 300), onde = left(a->>'onde', 500), trecho = left(coalesce(a->>'trecho', ''), 400),
             rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200), ultimo_em = now(), vezes = vezes + 1,
             status = case when status = 'corrigido' then 'aberto' else status end, corrigido_em = case when status = 'corrigido' then null else corrigido_em end,
             -- o alerta acende de novo: voltou depois de corrigido, ficou mais grave, ou a biblioteca ganhou falha nova (o título conta as falhas)
             visto_em = case when status = 'corrigido' or interno.peso_gravidade(a->>'gravidade') > interno.peso_gravidade(gravidade)
                                  or (regra = 'DEP-01' and titulo is distinct from left(a->>'titulo', 300)) then null else visto_em end,
             visto_por = case when status = 'corrigido' or interno.peso_gravidade(a->>'gravidade') > interno.peso_gravidade(gravidade)
                                  or (regra = 'DEP-01' and titulo is distinct from left(a->>'titulo', 300)) then null else visto_por end
       where id = velho.id;
      if a->>'regra' = 'DEP-01' and velho.status <> 'ignorado' and (velho.status = 'corrigido' or interno.peso_gravidade(a->>'gravidade') > interno.peso_gravidade(velho.gravidade) or velho.titulo is distinct from left(a->>'titulo', 300)) then
        alertas := alertas || jsonb_build_array(jsonb_build_object('g', a->>'gravidade', 't', left(a->>'titulo', 120))); end if;
      if velho.status = 'corrigido' then novos := novos + 1; end if;
    end if;
  end loop;
  with c as (
    update public.analise_achados set status = 'corrigido', corrigido_em = now()
     where no_id = p_no and origem = org and status = 'aberto' and not (impressao = any(vistos)) returning id, item_id)
  select array_agg(id), array_agg(item_id) filter (where item_id is not null) into ids_corr, itens_mov from c;
  corr := coalesce(cardinality(ids_corr), 0);
  if itens_mov is not null then
    update public.itens_criterios set feito = true, marcado_em = now()
     where item_id = any(itens_mov) and not feito and texto like 'A análise de segurança não acha mais este ponto%';
    select id into revisao from public.status_fluxo where no_id is null and chave = 'review' limit 1;
    if revisao is not null then
      update public.itens i set status_id = revisao
       where i.id = any(itens_mov) and interno.po_grupo(i.status_id) in ('backlog','todo','doing','blocked')
         and not exists (select 1 from public.analise_achados x where x.item_id = i.id and x.status = 'aberto');
    end if;
  end if;
  select count(*) into abertos from public.analise_achados where no_id = p_no and origem = org and status = 'aberto';
  -- alerta (não trava nada): avisa no sininho quem participa do ponto; a pessoa marca como visto na aba Análise
  if jsonb_array_length(alertas) > 0 then perform interno.analise_avisar(p_no, coalesce(p_rotulo, ''), alertas); end if;
  insert into public.analise_rodadas (no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em)
  values (p_no, org, left(coalesce(p_rotulo, ''), 200), left(p_referencia, 200), p_arquivos, abertos, novos, corr, left(p_avisos, 1000), now())
  on conflict (no_id, origem) do update set rotulo = excluded.rotulo, referencia = excluded.referencia, arquivos = excluded.arquivos, abertos = excluded.abertos,
     novos = excluded.novos, corrigidos = excluded.corrigidos, avisos = excluded.avisos, rodou_em = now();
  return jsonb_build_object('abertos', abertos, 'novos', novos, 'corrigidos', corr, 'itens', coalesce(cardinality(itens_mov), 0), 'alertas', jsonb_array_length(alertas));
end $function$;
