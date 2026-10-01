-- =====================================================================
-- CicloDev · 43 · Análise de segurança automática do código e do banco
-- A função diagramas-auto, ao ler o código de um repositório ou a estrutura de um banco (as mesmas leituras dos desenhos e
-- da ficha), passa as regras de segurança (seguranca.ts, nascidas dos guias da OWASP) e grava aqui o que achou.
-- Cada achado tem uma identidade estável (impressao): a próxima análise reconhece o mesmo, conta as vezes que viu e, quando
-- ele some do código ou do banco, marca como corrigido sozinho. As pessoas só marcam "ignorar com motivo" e ligam a um item.
-- O texto de cada regra (por que importa, como corrigir, fonte) fica no código da tela, pelo código da regra.
-- =====================================================================

create table if not exists public.analise_achados (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  origem         text not null check (origem ~ '^(repo|banco):[0-9a-f-]{36}$'),
  repositorio_id uuid references public.repositorios(id) on delete cascade,
  banco_id       uuid references public.infra_bancos(id) on delete cascade,
  rotulo         text not null default '' check (length(rotulo) <= 200),          -- o nome do repositório ou do banco
  regra          text not null check (regra ~ '^[A-Z]{2,4}-[0-9]{2}$'),
  gravidade      text not null check (gravidade in ('critica','alta','media','baixa')),
  titulo         text not null check (length(titulo) between 1 and 300),
  onde           text not null check (length(onde) between 1 and 500),
  trecho         text not null default '' check (length(trecho) <= 400),          -- segredos chegam mascarados
  impressao      text not null check (impressao ~ '^[0-9a-f]{8}$'),
  status         text not null default 'aberto' check (status in ('aberto','corrigido','ignorado')),
  motivo         text check (motivo is null or length(motivo) <= 1000),            -- por que foi ignorado
  item_id        uuid references public.itens(id) on delete set null,              -- o item (Bug) criado para corrigir
  referencia     text check (referencia is null or length(referencia) <= 200),    -- o commit, ou o resumo da estrutura do banco
  vezes          integer not null default 1,
  primeiro_em    timestamptz not null default now(),
  ultimo_em      timestamptz not null default now(),
  corrigido_em   timestamptz,
  marcado_por    uuid references public.pessoas(id) on delete set null,
  unique (no_id, origem, impressao),
  check ((repositorio_id is not null and banco_id is null) or (banco_id is not null and repositorio_id is null))
);
create index if not exists analise_achados_no_idx on public.analise_achados (no_id, status, gravidade);
comment on table public.analise_achados is 'Achados da análise de segurança automática (código e banco), gravados pela função diagramas-auto. As pessoas só ignoram com motivo e ligam a um item.';
alter table public.analise_achados enable row level security;
drop policy if exists ver on public.analise_achados;
create policy ver on public.analise_achados for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
revoke all on public.analise_achados from public, anon, authenticated;
grant select on public.analise_achados to authenticated;
grant all on public.analise_achados to service_role;

-- o resumo de cada análise (uma linha por repositório ou banco): quando rodou, quantos achados e se deu erro em alguma parte
create table if not exists public.analise_rodadas (
  no_id        uuid not null references public.nos(id) on delete cascade,
  origem       text not null check (origem ~ '^(repo|banco):[0-9a-f-]{36}$'),
  rotulo       text not null default '' check (length(rotulo) <= 200),
  referencia   text check (referencia is null or length(referencia) <= 200),
  arquivos     integer,                       -- quantos arquivos ou tabelas foram lidos
  abertos      integer not null default 0,
  novos        integer not null default 0,
  corrigidos   integer not null default 0,
  avisos       text check (avisos is null or length(avisos) <= 1000),   -- ex.: a base de falhas conhecidas não respondeu
  rodou_em     timestamptz not null default now(),
  primary key (no_id, origem)
);
alter table public.analise_rodadas enable row level security;
drop policy if exists ver on public.analise_rodadas;
create policy ver on public.analise_rodadas for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
revoke all on public.analise_rodadas from public, anon, authenticated;
grant select on public.analise_rodadas to authenticated;
grant all on public.analise_rodadas to service_role;

-- a função diagramas-auto grava o que achou em UM repositório ou UM banco. O que não apareceu mais e estava aberto: corrigido.
-- O que estava corrigido e voltou: aberto de novo. O ignorado continua ignorado. Devolve {abertos, novos, corrigidos}.
create or replace function public.analise_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_referencia text, p_arquivos integer, p_achados jsonb, p_avisos text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a jsonb; org text; imp text; vistos text[] := '{}'; novos integer := 0; corr integer := 0; abertos integer; velho public.analise_achados;
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
  update public.analise_achados set status = 'corrigido', corrigido_em = now()
   where no_id = p_no and origem = org and status = 'aberto' and not (impressao = any(vistos));
  get diagnostics corr = row_count;
  select count(*) into abertos from public.analise_achados where no_id = p_no and origem = org and status = 'aberto';
  insert into public.analise_rodadas (no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em)
  values (p_no, org, left(coalesce(p_rotulo, ''), 200), left(p_referencia, 200), p_arquivos, abertos, novos, corr, left(p_avisos, 1000), now())
  on conflict (no_id, origem) do update set rotulo = excluded.rotulo, referencia = excluded.referencia, arquivos = excluded.arquivos, abertos = excluded.abertos,
     novos = excluded.novos, corrigidos = excluded.corrigidos, avisos = excluded.avisos, rodou_em = now();
  return jsonb_build_object('abertos', abertos, 'novos', novos, 'corrigidos', corr);
end $$;
revoke all on function public.analise_gravar(uuid, uuid, uuid, text, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.analise_gravar(uuid, uuid, uuid, text, text, integer, jsonb, text) to service_role;

-- a pessoa (quem pode editar o ponto) ignora com motivo, volta a abrir, ou liga o achado ao item criado para corrigir
create or replace function public.analise_marcar(p_id uuid, p_status text default null, p_motivo text default null, p_item uuid default null)
returns public.analise_achados
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.analise_achados;
begin
  select * into r from public.analise_achados where id = p_id;
  if r.id is null or r.no_id not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este achado' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('aberto','ignorado') then raise exception 'Use aberto ou ignorado (corrigido o sistema marca sozinho)' using errcode = '22023'; end if;
  if p_status = 'ignorado' and length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Diga o motivo para ignorar' using errcode = '22023'; end if;
  if p_item is not null and not exists (select 1 from public.itens where id = p_item) then raise exception 'Item não encontrado' using errcode = '22023'; end if;
  update public.analise_achados set
    status = case when p_status = 'ignorado' then 'ignorado' when p_status = 'aberto' and status = 'ignorado' then 'aberto' else status end,
    motivo = case when p_status = 'ignorado' then left(btrim(p_motivo), 1000) when p_status = 'aberto' then null else motivo end,
    item_id = coalesce(p_item, item_id), marcado_por = interno.pessoa_atual()
   where id = p_id returning * into r;
  return r;
end $$;
revoke all on function public.analise_marcar(uuid, text, text, uuid) from public, anon;
grant execute on function public.analise_marcar(uuid, text, text, uuid) to authenticated;
