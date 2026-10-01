-- =====================================================================
-- CicloDev · 44 · Análise automática ampliada
-- 1. Quando a análise deixa de achar um problema que tem item ligado, o item vai sozinho para "Pronto para testar"
--    (o critério "a análise não acha mais este ponto" fica marcado). Aceitar continua sendo só do P.O.
-- 2. O inventário do que já existe no sistema (telas, APIs, módulos e tabelas), lido do código e do banco pelo robô,
--    para a tela importar como épicos e itens (analise_inventario).
-- =====================================================================

create or replace function public.analise_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_referencia text, p_arquivos integer, p_achados jsonb, p_avisos text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a jsonb; org text; imp text; vistos text[] := '{}'; novos integer := 0; corr integer := 0; abertos integer; velho public.analise_achados;
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
    else
      update public.analise_achados set gravidade = a->>'gravidade', titulo = left(a->>'titulo', 300), onde = left(a->>'onde', 500), trecho = left(coalesce(a->>'trecho', ''), 400),
             rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200), ultimo_em = now(), vezes = vezes + 1,
             status = case when status = 'corrigido' then 'aberto' else status end, corrigido_em = case when status = 'corrigido' then null else corrigido_em end
       where id = velho.id;
      if velho.status = 'corrigido' then novos := novos + 1; end if;
    end if;
  end loop;
  with c as (
    update public.analise_achados set status = 'corrigido', corrigido_em = now()
     where no_id = p_no and origem = org and status = 'aberto' and not (impressao = any(vistos)) returning id, item_id)
  select array_agg(id), array_agg(item_id) filter (where item_id is not null) into ids_corr, itens_mov from c;
  corr := coalesce(cardinality(ids_corr), 0);
  -- o item ligado anda sozinho: o critério da análise fica cumprido e ele vai para Pronto para testar (se ainda não foi)
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
  insert into public.analise_rodadas (no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em)
  values (p_no, org, left(coalesce(p_rotulo, ''), 200), left(p_referencia, 200), p_arquivos, abertos, novos, corr, left(p_avisos, 1000), now())
  on conflict (no_id, origem) do update set rotulo = excluded.rotulo, referencia = excluded.referencia, arquivos = excluded.arquivos, abertos = excluded.abertos,
     novos = excluded.novos, corrigidos = excluded.corrigidos, avisos = excluded.avisos, rodou_em = now();
  return jsonb_build_object('abertos', abertos, 'novos', novos, 'corrigidos', corr, 'itens', coalesce(cardinality(itens_mov), 0));
end $$;
revoke all on function public.analise_gravar(uuid, uuid, uuid, text, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.analise_gravar(uuid, uuid, uuid, text, text, integer, jsonb, text) to service_role;

-- ---------- o inventário do que já existe ----------
create table if not exists public.analise_inventario (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  origem         text not null check (origem ~ '^(repo|banco):[0-9a-f-]{36}$'),
  rotulo         text not null default '' check (length(rotulo) <= 200),
  tipo           text not null check (tipo in ('tela','api','modulo','tabela','job','integracao')),
  chave          text not null check (length(chave) between 1 and 400),     -- identidade estável (ex.: api:GET /clientes)
  grupo          text not null check (length(grupo) between 1 and 200),     -- o épico sugerido (módulo, controlador, prefixo da tabela)
  nome           text not null check (length(nome) between 1 and 300),
  onde           text not null default '' check (length(onde) <= 500),
  sinais         jsonb not null default '{}'::jsonb check (jsonb_typeof(sinais) = 'object' and pg_column_size(sinais) <= 4000),
  item_id        uuid references public.itens(id) on delete set null,       -- o item criado ao importar
  atualizado_em  timestamptz not null default now(),
  unique (no_id, origem, chave)
);
create index if not exists analise_inventario_no_idx on public.analise_inventario (no_id, tipo);
comment on table public.analise_inventario is 'O que já existe no sistema (telas, APIs, módulos, tabelas), lido do código e do banco pelo robô, com os sinais de pronto ou inacabado (TODO, teste, uso). A tela importa como épicos e itens.';
revoke all on public.analise_inventario from public, anon, authenticated;
alter table public.analise_inventario enable row level security;
drop policy if exists ver on public.analise_inventario;
create policy ver on public.analise_inventario for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
grant select on public.analise_inventario to authenticated;
grant all on public.analise_inventario to service_role;

-- o robô grava o inventário de UM repositório ou UM banco (o que sumiu sai, menos o que já virou item)
create or replace function public.analise_inventario_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_itens jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare a jsonb; org text; chaves text[] := '{}'; n integer := 0;
begin
  if (p_repositorio is null) = (p_banco is null) then raise exception 'Diga o repositório ou o banco (um dos dois)' using errcode = '22023'; end if;
  if p_repositorio is not null and not exists (select 1 from public.repositorios where id = p_repositorio and no_id = p_no) then return null; end if;
  if p_banco is not null and not exists (select 1 from public.infra_bancos where id = p_banco and no_id = p_no) then return null; end if;
  if jsonb_typeof(coalesce(p_itens, '[]')) <> 'array' then raise exception 'Inventário inválido' using errcode = '22023'; end if;
  org := case when p_repositorio is not null then 'repo:' || p_repositorio else 'banco:' || p_banco end;
  for a in select * from jsonb_array_elements(coalesce(p_itens, '[]')) limit 3000 loop
    if coalesce(a->>'chave', '') = '' or (a->>'chave') = any(chaves) then continue; end if;
    chaves := array_append(chaves, left(a->>'chave', 400));
    insert into public.analise_inventario (no_id, origem, rotulo, tipo, chave, grupo, nome, onde, sinais)
    values (p_no, org, left(coalesce(p_rotulo, ''), 200), a->>'tipo', left(a->>'chave', 400), left(coalesce(nullif(a->>'grupo', ''), 'Geral'), 200), left(a->>'nome', 300), left(coalesce(a->>'onde', ''), 500), coalesce(a->'sinais', '{}'::jsonb))
    on conflict (no_id, origem, chave) do update set rotulo = excluded.rotulo, tipo = excluded.tipo, grupo = excluded.grupo, nome = excluded.nome, onde = excluded.onde, sinais = excluded.sinais, atualizado_em = now();
    n := n + 1;
  end loop;
  delete from public.analise_inventario where no_id = p_no and origem = org and item_id is null and not (chave = any(chaves));
  return n;
end $$;
revoke all on function public.analise_inventario_gravar(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.analise_inventario_gravar(uuid, uuid, uuid, text, jsonb) to service_role;

-- a tela liga as linhas do inventário aos itens criados na importação (quem edita o ponto): [{"id": ..., "item": ...}]
drop function if exists public.analise_inventario_ligar(uuid, uuid);
create or replace function public.analise_inventario_ligar(p_pares jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare a jsonb; n integer := 0;
begin
  if jsonb_typeof(coalesce(p_pares, '[]')) <> 'array' then raise exception 'Pares inválidos' using errcode = '22023'; end if;
  for a in select * from jsonb_array_elements(p_pares) limit 3000 loop
    update public.analise_inventario v set item_id = (a->>'item')::uuid
     where v.id = (a->>'id')::uuid and v.no_id in (select interno.nos_editaveis()) and exists (select 1 from public.itens where id = (a->>'item')::uuid);
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function public.analise_inventario_ligar(jsonb) from public, anon;
grant execute on function public.analise_inventario_ligar(jsonb) to authenticated;
