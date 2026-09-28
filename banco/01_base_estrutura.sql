-- =====================================================================
-- Sistema IT.IA · 01 · Base: schemas, funções de apoio, estrutura (árvore), pessoas e etiquetas
-- Banco: Supabase tfcvoszeewmpghgxztuy
-- Convenções:
--   * nomes em português, snake_case; chaves uuid; datas timestamptz (UTC no banco)
--   * nada se apaga de verdade no dia a dia: arquivado_em marca o arquivamento
--   * public  = tabelas do produto (expostas pela API, sempre com RLS)
--   * interno = funções de apoio (não expostas)
--   * bi      = camada analítica (views, visões materializadas e funções de cálculo)
--   * auditoria = registro de quem fez o quê
-- =====================================================================

-- gen_random_uuid() já vem no Postgres. btree_gist (usado nas travas de sobreposição) fica no schema extensions, padrão do Supabase.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists interno;
create schema if not exists bi;
create schema if not exists auditoria;

revoke all on schema interno from public;
revoke all on schema auditoria from public;
grant usage on schema interno to authenticated, service_role;
grant usage on schema bi to authenticated, service_role;
grant usage on schema auditoria to service_role;

-- carimbo de atualização
create or replace function interno.carimbar_atualizacao() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

-- =====================================================================
-- ESTRUTURA: uma árvore só. Cliente › Projeto › Produto (opcional) › Aplicação › Frente
-- =====================================================================
create table public.nos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('cliente','projeto','produto','aplicacao','frente')),
  pai_id        uuid references public.nos(id) on delete restrict,
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  status        text not null default 'ativo' check (status in ('ativo','pausado','concluido','arquivado')),
  motivo_pausa  text,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  criado_por    uuid,
  atualizado_em timestamptz not null default now(),
  constraint nos_id_tipo_unq unique (id, tipo),
  constraint nos_raiz_so_cliente check ((tipo = 'cliente') = (pai_id is null)),
  constraint nos_pausa_com_motivo check (status <> 'pausado' or length(btrim(coalesce(motivo_pausa,''))) > 0)
);
comment on table public.nos is 'A árvore da operação: cada linha é um cliente, projeto, produto, aplicação ou frente de trabalho.';
create index nos_pai_idx on public.nos (pai_id, ordem);
create index nos_tipo_idx on public.nos (tipo) where status <> 'arquivado';

-- tabela de ancestrais (closure table): cada nó ligado a todos os seus ancestrais, com a distância
create table public.nos_ancestrais (
  ancestral_id uuid not null references public.nos(id) on delete cascade,
  no_id        uuid not null references public.nos(id) on delete cascade,
  distancia    smallint not null check (distancia >= 0),
  primary key (ancestral_id, no_id)
);
comment on table public.nos_ancestrais is 'Mantida pelo banco. Permite somar qualquer nível da árvore sem percorrer a hierarquia a cada consulta.';
create index nos_ancestrais_no_idx on public.nos_ancestrais (no_id, distancia);

-- regra de quem pode ser pai de quem
create or replace function interno.validar_pai() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare tipo_pai text;
begin
  if new.pai_id is null then
    return new;
  end if;
  select tipo into tipo_pai from public.nos where id = new.pai_id;
  if not (
       (new.tipo = 'projeto'   and tipo_pai = 'cliente')
    or (new.tipo = 'produto'   and tipo_pai = 'projeto')
    or (new.tipo = 'aplicacao' and tipo_pai in ('projeto','produto'))
    or (new.tipo = 'frente'    and tipo_pai = 'aplicacao')
  ) then
    raise exception 'Um % não pode ficar dentro de um %', new.tipo, tipo_pai using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.tipo <> old.tipo then
    raise exception 'O tipo de um registro da estrutura não muda' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger nos_validar_pai before insert or update of pai_id, tipo on public.nos
  for each row execute function interno.validar_pai();
create trigger nos_carimbo before update on public.nos
  for each row execute function interno.carimbar_atualizacao();

-- manutenção da tabela de ancestrais (inclusão e movimentação de galhos)
create or replace function interno.manter_ancestrais() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.nos_ancestrais (ancestral_id, no_id, distancia)
    select new.id, new.id, 0
    union all
    select a.ancestral_id, new.id, a.distancia + 1
      from public.nos_ancestrais a
     where a.no_id = new.pai_id;
    return new;
  end if;

  if new.pai_id is distinct from old.pai_id then
    -- não pode mover para dentro de si mesmo
    if exists (select 1 from public.nos_ancestrais where ancestral_id = new.id and no_id = new.pai_id) then
      raise exception 'Não dá para mover um registro para dentro dele mesmo' using errcode = '23514';
    end if;
    -- solta o galho dos ancestrais antigos
    delete from public.nos_ancestrais d
     using public.nos_ancestrais galho, public.nos_ancestrais acima
     where galho.ancestral_id = new.id
       and d.no_id = galho.no_id
       and acima.no_id = new.id and acima.distancia > 0
       and d.ancestral_id = acima.ancestral_id;
    -- prende o galho nos ancestrais novos
    insert into public.nos_ancestrais (ancestral_id, no_id, distancia)
    select acima.ancestral_id, galho.no_id, acima.distancia + galho.distancia + 1
      from public.nos_ancestrais acima
      join public.nos_ancestrais galho on galho.ancestral_id = new.id
     where acima.no_id = new.pai_id;
  end if;
  return new;
end $$;

create trigger nos_ancestrais_ins after insert on public.nos
  for each row execute function interno.manter_ancestrais();
create trigger nos_ancestrais_upd after update of pai_id on public.nos
  for each row execute function interno.manter_ancestrais();

-- extensões por tipo (cada uma só aceita o tipo certo, garantido por chave estrangeira composta)
create table public.clientes (
  no_id         uuid primary key,
  tipo          text not null default 'cliente' check (tipo = 'cliente'),
  tipo_cliente  text not null default 'empresa' check (tipo_cliente in ('holding','empresa','pessoa')),
  documento     text,
  holding_id    uuid,
  holding_tipo  text not null default 'cliente' check (holding_tipo = 'cliente'),
  foreign key (no_id, tipo) references public.nos (id, tipo) on delete cascade,
  foreign key (holding_id, holding_tipo) references public.nos (id, tipo),
  check (holding_id is null or holding_id <> no_id)
);
comment on column public.clientes.holding_id is 'Quando o cliente é uma empresa controlada por outra holding cliente. A BL é holding e não pertence a ninguém.';

create table public.projetos (
  no_id    uuid primary key,
  tipo     text not null default 'projeto' check (tipo = 'projeto'),
  origem   text not null default 'greenfield' check (origem in ('greenfield','brownfield')),
  inicio   date,
  alvo     date,
  foreign key (no_id, tipo) references public.nos (id, tipo) on delete cascade,
  check (alvo is null or inicio is null or alvo >= inicio)
);

create table public.aplicacoes (
  no_id          uuid primary key,
  tipo           text not null default 'aplicacao' check (tipo = 'aplicacao'),
  plataforma     text not null default 'web' check (plataforma in ('desktop','web','mobile','api','outro')),
  origem_codigo  text not null default 'proprio' check (origem_codigo in ('proprio','terceiros')),
  servico_id     uuid,  -- ligado ao catálogo em 03_comercial
  foreign key (no_id, tipo) references public.nos (id, tipo) on delete cascade
);
comment on column public.aplicacoes.origem_codigo is 'proprio: sistema feito pela IT.IA. terceiros: feito por outra empresa e trazido para manutenção.';

create table public.frentes (
  no_id       uuid primary key,
  tipo        text not null default 'frente' check (tipo = 'frente'),
  wip_limite  smallint check (wip_limite is null or wip_limite > 0),
  foreign key (no_id, tipo) references public.nos (id, tipo) on delete cascade
);

-- =====================================================================
-- PESSOAS E ACESSO
-- =====================================================================
create table public.pessoas (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique,               -- ligado ao login quando ele existir
  nome           text not null check (length(btrim(nome)) > 0),
  email          text unique,
  funcao         text,
  habilidades    text[] not null default '{}',
  capacidade_h   numeric(5,2) not null default 40 check (capacidade_h between 0 and 80),
  papel          text not null default 'dev' check (papel in ('master','dev','stakeholder')),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on column public.pessoas.capacidade_h is 'Capacity: horas por semana disponíveis para tarefas.';
create trigger pessoas_carimbo before update on public.pessoas for each row execute function interno.carimbar_atualizacao();

-- quem participa de onde (vale para o nó e tudo o que está abaixo dele)
create table public.participacoes (
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  no_id      uuid not null references public.nos(id) on delete cascade,
  papel      text not null check (papel in ('owner','dev','stakeholder')),
  criado_em  timestamptz not null default now(),
  primary key (pessoa_id, no_id)
);
create index participacoes_no_idx on public.participacoes (no_id);

-- =====================================================================
-- FUNÇÕES DE ACESSO (usadas pelas regras de RLS)
-- =====================================================================
create or replace function interno.pessoa_atual() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.pessoas where auth_user_id = auth.uid() and ativo
$$;

create or replace function interno.eh_master() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select papel = 'master' from public.pessoas where auth_user_id = auth.uid() and ativo), false)
$$;

-- nós que a pessoa atual enxerga: tudo abaixo de onde participa, mais o caminho até a raiz
create or replace function interno.nos_visiveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where interno.eh_master()
  union
  select a.no_id
    from public.participacoes p
    join public.nos_ancestrais a on a.ancestral_id = p.no_id
   where p.pessoa_id = interno.pessoa_atual()
  union
  select a.ancestral_id
    from public.participacoes p
    join public.nos_ancestrais a on a.no_id = p.no_id
   where p.pessoa_id = interno.pessoa_atual()
$$;

-- nós em que a pessoa atual pode trabalhar (owner ou dev no nó ou acima)
create or replace function interno.nos_editaveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where interno.eh_master()
  union
  select a.no_id
    from public.participacoes p
    join public.nos_ancestrais a on a.ancestral_id = p.no_id
   where p.pessoa_id = interno.pessoa_atual() and p.papel in ('owner','dev')
$$;

-- a pessoa atual é só stakeholder (vê apenas o que está marcado como visível ao cliente)
create or replace function interno.eh_stakeholder() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select papel = 'stakeholder' from public.pessoas where auth_user_id = auth.uid() and ativo), false)
$$;

-- =====================================================================
-- ETIQUETAS (as automáticas não são guardadas: vêm da estrutura, pela view etiquetas_sistema)
-- =====================================================================
create table public.etiquetas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) between 1 and 60),
  cor        text not null default '#2E2E31' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  categoria  text,
  descricao  text,
  criado_em  timestamptz not null default now(),
  constraint etiquetas_nome_unq unique (nome)
);

create table public.etiquetas_nos (
  etiqueta_id uuid not null references public.etiquetas(id) on delete cascade,
  no_id       uuid not null references public.nos(id) on delete cascade,
  primary key (no_id, etiqueta_id)
);
create index etiquetas_nos_etiqueta_idx on public.etiquetas_nos (etiqueta_id);

-- etiquetas automáticas (com cadeado): holding do cliente e projeto de cada item, calculadas na hora
create or replace view public.etiquetas_sistema with (security_invoker = true) as
  select a.no_id, 'Holding: ' || h.nome as rotulo, 'holding' as origem, h.id as ref_id
    from public.nos_ancestrais a
    join public.nos c on c.id = a.ancestral_id and c.tipo = 'cliente'
    join public.clientes cl on cl.no_id = c.id
    join public.nos h on h.id = coalesce(cl.holding_id, case when cl.tipo_cliente = 'holding' then c.id end)
   where a.distancia > 0
  union all
  select a.no_id, 'Projeto: ' || p.nome, 'projeto', p.id
    from public.nos_ancestrais a
    join public.nos p on p.id = a.ancestral_id and p.tipo = 'projeto'
   where a.distancia > 0;
comment on view public.etiquetas_sistema is 'Etiquetas automáticas geradas pelas ligações da estrutura. Ninguém apaga, porque não são guardadas.';
