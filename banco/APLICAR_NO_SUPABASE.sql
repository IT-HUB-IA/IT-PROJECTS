-- =====================================================================
-- CicloDev · banco completo para o Supabase tfcvoszeewmpghgxztuy
-- Rodar UMA VEZ, inteiro, num banco sem estas tabelas (SQL Editor ou migration). Ordem: 01 a 20.
-- Depois disso, 05, 06, 07, 08, 09 e 10 podem ser rodados de novo sozinhos (recriam funções e regras; a semente não duplica).
-- Gerado em 2026-09-30. Os arquivos 00, 90 a 98 são só de teste local e NÃO entram aqui. A parte 21 (e-mail) entra separada, depois da função enviar-avisos; a 24 (webhook do portal), a 27 (arquivos do chat) e a 31 (chamada automática dos desenhos) também.
-- =====================================================================

-- >>>>>>>>>> 01_base_estrutura.sql
-- =====================================================================
-- CicloDev · 01 · Base: schemas, funções de apoio, estrutura (árvore), pessoas e etiquetas
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

-- >>>>>>>>>> 02_trabalho.sql
-- =====================================================================
-- CicloDev · 02 · Trabalho: status, itens (issues), ciclos, marcos, tempo, visões, automações
-- =====================================================================

-- STATUS: fluxo padrão (no_id nulo) ou personalizado para um nó e tudo abaixo dele
create table public.status_fluxo (
  id         uuid primary key default gen_random_uuid(),
  no_id      uuid references public.nos(id) on delete cascade,
  chave      text not null check (chave ~ '^[a-z0-9_]{2,30}$'),
  nome       text not null,
  explicacao text,
  cor        text not null check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  grupo      text not null check (grupo in ('backlog','todo','doing','review','blocked','done')),
  ordem      smallint not null default 0
);
comment on column public.status_fluxo.grupo is 'A que etapa do fluxo o status pertence. Os painéis somam pelo grupo, então status personalizados entram nas contas sem mudar nada.';
create unique index status_fluxo_chave_unq on public.status_fluxo (coalesce(no_id, '00000000-0000-0000-0000-000000000000'::uuid), chave);
create index status_fluxo_no_idx on public.status_fluxo (no_id) where no_id is not null;

-- CICLOS (sprints), opcionais, sempre de um projeto
create table public.sprints (
  id          uuid primary key default gen_random_uuid(),
  projeto_id  uuid not null,
  projeto_tipo text not null default 'projeto' check (projeto_tipo = 'projeto'),
  nome        text not null,
  meta        text,
  inicio      date not null,
  fim         date not null,
  status      text not null default 'planejado' check (status in ('planejado','ativo','encerrado')),
  criado_em   timestamptz not null default now(),
  foreign key (projeto_id, projeto_tipo) references public.nos (id, tipo) on delete cascade,
  check (fim >= inicio),
  exclude using gist (projeto_id with =, daterange(inicio, fim, '[]') with &&)
);
comment on table public.sprints is 'Sprints (ciclos curtos). Dois ciclos do mesmo projeto não podem se sobrepor.';
create unique index sprints_um_ativo on public.sprints (projeto_id) where status = 'ativo';

-- MARCOS e ENTREGAS DE VERSÃO
create table public.marcos (
  id              uuid primary key default gen_random_uuid(),
  no_id           uuid not null references public.nos(id) on delete cascade,
  tipo            text not null default 'marco' check (tipo in ('marco','release')),
  nome            text not null,
  descricao       text,
  data            date not null,
  visivel_cliente boolean not null default true,
  entregue_em     date,
  criado_em       timestamptz not null default now()
);
create index marcos_no_idx on public.marcos (no_id, data);

-- ITENS (Epic, Story, Task, Sub-task, Bug). Ficam sempre numa frente.
create table public.itens (
  id              uuid primary key default gen_random_uuid(),
  frente_id       uuid not null,
  frente_tipo     text not null default 'frente' check (frente_tipo = 'frente'),
  pai_id          uuid references public.itens(id) on delete restrict,
  tipo            text not null check (tipo in ('epic','story','task','subtask','bug')),
  titulo          text not null check (length(btrim(titulo)) between 1 and 300),
  descricao       text,
  status_id       uuid not null references public.status_fluxo(id),
  prioridade      text not null default 'medium' check (prioridade in ('highest','high','medium','low')),
  responsavel_id  uuid references public.pessoas(id) on delete set null,
  relator_id      uuid references public.pessoas(id) on delete set null,
  estimativa_h    numeric(7,2) check (estimativa_h is null or estimativa_h >= 0),
  pontos          smallint check (pontos is null or pontos in (1,2,3,5,8,13,21)),
  inicio          date,
  prazo           date,
  data_prevista   date,
  visivel_cliente boolean not null default false,
  sprint_id       uuid references public.sprints(id) on delete set null,
  marco_id        uuid references public.marcos(id) on delete set null,
  ordem           double precision not null default 0,
  criado_em       timestamptz not null default now(),
  iniciado_em     timestamptz,     -- primeira vez que entrou em andamento (Cycle time)
  concluido_em    timestamptz,     -- quando entrou num status do grupo concluído (Lead time)
  atualizado_em   timestamptz not null default now(),
  arquivado_em    timestamptz,
  foreign key (frente_id, frente_tipo) references public.nos (id, tipo),
  check (prazo is null or inicio is null or prazo >= inicio),
  check (pai_id is null or pai_id <> id)
);
comment on table public.itens is 'Issues: todas as tarefas, stories, epics, subtarefas e bugs. Um registro só, lido por todas as views.';
comment on column public.itens.pontos is 'Story points (nota de esforço: 1, 2, 3, 5, 8, 13 ou 21). Opcional; a estimativa em horas continua valendo.';
create index itens_frente_status_idx on public.itens (frente_id, status_id, ordem) where arquivado_em is null;
create index itens_responsavel_idx on public.itens (responsavel_id, prazo) where arquivado_em is null;
create index itens_pai_idx on public.itens (pai_id) where pai_id is not null;
create index itens_sprint_idx on public.itens (sprint_id) where sprint_id is not null;
create index itens_marco_idx on public.itens (marco_id) where marco_id is not null;
create index itens_prazo_idx on public.itens (prazo) where arquivado_em is null and concluido_em is null;
create index itens_concluido_idx on public.itens (concluido_em) where concluido_em is not null;
create index itens_status_idx on public.itens (status_id);

-- regras do item: hierarquia de tipos, status válido para a frente, ciclo do mesmo projeto, datas de fluxo
create or replace function interno.validar_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  tipo_pai text; frente_pai uuid; grupo_novo text; grupo_velho text; st_no uuid; sp_proj uuid;
begin
  -- hierarquia: epic > story > task > subtask; bug fica em epic ou story
  if new.pai_id is not null then
    select tipo, frente_id into tipo_pai, frente_pai from public.itens where id = new.pai_id;
    if not (
         (new.tipo = 'story'   and tipo_pai = 'epic')
      or (new.tipo = 'task'    and tipo_pai in ('epic','story'))
      or (new.tipo = 'bug'     and tipo_pai in ('epic','story'))
      or (new.tipo = 'subtask' and tipo_pai in ('task','bug'))
    ) then
      raise exception 'Um % não pode ficar dentro de um %', new.tipo, tipo_pai using errcode = '23514';
    end if;
    -- o pai precisa estar na mesma aplicação
    if not exists (
      select 1 from public.nos f1 join public.nos f2 on f2.pai_id = f1.pai_id
       where f1.id = new.frente_id and f2.id = frente_pai
    ) then
      raise exception 'O item pai precisa estar na mesma aplicação' using errcode = '23514';
    end if;
  elsif new.tipo = 'subtask' then
    raise exception 'Uma subtarefa precisa de uma tarefa ou bug acima dela' using errcode = '23514';
  elsif new.tipo = 'epic' and new.pai_id is not null then
    raise exception 'Um epic não fica dentro de outro item' using errcode = '23514';
  end if;

  -- o status tem que valer para esta frente (padrão ou personalizado num nó acima)
  select no_id, grupo into st_no, grupo_novo from public.status_fluxo where id = new.status_id;
  if st_no is not null and not exists (
    select 1 from public.nos_ancestrais where ancestral_id = st_no and no_id = new.frente_id
  ) then
    raise exception 'Este status não vale para esta frente' using errcode = '23514';
  end if;

  -- o ciclo tem que ser do mesmo projeto
  if new.sprint_id is not null then
    select projeto_id into sp_proj from public.sprints where id = new.sprint_id;
    if not exists (select 1 from public.nos_ancestrais where ancestral_id = sp_proj and no_id = new.frente_id) then
      raise exception 'O ciclo escolhido é de outro projeto' using errcode = '23514';
    end if;
  end if;

  -- datas do fluxo (base do Lead time e do Cycle time)
  if tg_op = 'UPDATE' then
    select grupo into grupo_velho from public.status_fluxo where id = old.status_id;
  end if;
  if grupo_novo in ('doing','review') and new.iniciado_em is null then
    new.iniciado_em := now();
  end if;
  if grupo_novo = 'done' and (tg_op = 'INSERT' or grupo_velho is distinct from 'done') then
    new.concluido_em := coalesce(new.concluido_em, now());
    new.iniciado_em := coalesce(new.iniciado_em, new.concluido_em);
  elsif grupo_novo <> 'done' then
    new.concluido_em := null;
  end if;
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  return new;
end $$;

create trigger itens_validar before insert or update on public.itens
  for each row execute function interno.validar_item();

-- LIGAÇÕES ENTRE ITENS (guardadas num sentido só; "é bloqueado por" é a leitura ao contrário)
create table public.itens_ligacoes (
  origem_id  uuid not null references public.itens(id) on delete cascade,
  destino_id uuid not null references public.itens(id) on delete cascade,
  tipo       text not null check (tipo in ('bloqueia','relacionado','duplica')),
  criado_em  timestamptz not null default now(),
  primary key (origem_id, destino_id, tipo),
  check (origem_id <> destino_id)
);
create index itens_ligacoes_destino_idx on public.itens_ligacoes (destino_id);

-- CHECKLIST
create table public.itens_checklist (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.itens(id) on delete cascade,
  texto     text not null,
  feito     boolean not null default false,
  ordem     smallint not null default 0
);
create index itens_checklist_item_idx on public.itens_checklist (item_id, ordem);

-- CAMPOS PERSONALIZADOS (definidos num nó, valem para os itens abaixo dele)
create table public.campos_personalizados (
  id        uuid primary key default gen_random_uuid(),
  no_id     uuid not null references public.nos(id) on delete cascade,
  nome      text not null,
  tipo      text not null check (tipo in ('texto','numero','data','lista','sim_nao','dinheiro')),
  opcoes    text[] not null default '{}',
  ordem     smallint not null default 0,
  unique (no_id, nome),
  check (tipo <> 'lista' or cardinality(opcoes) > 0)
);

create table public.itens_campos (
  item_id  uuid not null references public.itens(id) on delete cascade,
  campo_id uuid not null references public.campos_personalizados(id) on delete cascade,
  valor    text not null,
  primary key (item_id, campo_id)
);
create index itens_campos_campo_idx on public.itens_campos (campo_id);

create or replace function interno.validar_valor_campo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare c record; f uuid;
begin
  select * into c from public.campos_personalizados where id = new.campo_id;
  select frente_id into f from public.itens where id = new.item_id;
  if not exists (select 1 from public.nos_ancestrais where ancestral_id = c.no_id and no_id = f) then
    raise exception 'O campo "%" não vale para este item', c.nome using errcode = '23514';
  end if;
  if c.tipo in ('numero','dinheiro') and new.valor !~ '^-?[0-9]+([.,][0-9]+)?$' then
    raise exception 'O campo "%" aceita só número', c.nome using errcode = '22P02';
  elsif c.tipo = 'data' and new.valor !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'O campo "%" aceita só data (aaaa-mm-dd)', c.nome using errcode = '22P02';
  elsif c.tipo = 'sim_nao' and new.valor not in ('sim','nao') then
    raise exception 'O campo "%" aceita só sim ou nao', c.nome using errcode = '22P02';
  elsif c.tipo = 'lista' and not (new.valor = any (c.opcoes)) then
    raise exception 'Valor fora das opções do campo "%"', c.nome using errcode = '22P02';
  end if;
  return new;
end $$;
create trigger itens_campos_validar before insert or update on public.itens_campos
  for each row execute function interno.validar_valor_campo();

-- COMENTÁRIOS (num item ou direto num nó, para o comentário "no macro" do stakeholder)
create table public.comentarios (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid references public.itens(id) on delete cascade,
  no_id           uuid references public.nos(id) on delete cascade,
  autor_id        uuid references public.pessoas(id) on delete set null,
  texto           text not null check (length(btrim(texto)) > 0),
  visivel_cliente boolean not null default false,
  criado_em       timestamptz not null default now(),
  editado_em      timestamptz,
  check (num_nonnulls(item_id, no_id) = 1)
);
create index comentarios_item_idx on public.comentarios (item_id, criado_em) where item_id is not null;
create index comentarios_no_idx on public.comentarios (no_id, criado_em) where no_id is not null;

-- TEMPO: cronômetro por item e tempo em foco numa frente ficam na mesma tabela (sem duplicar)
create table public.tempo_registros (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  origem     text not null check (origem in ('cronometro','foco','manual')),
  item_id    uuid references public.itens(id) on delete cascade,
  frente_id  uuid,
  frente_tipo text not null default 'frente' check (frente_tipo = 'frente'),
  inicio     timestamptz not null,
  fim        timestamptz,
  nota       text,
  foreign key (frente_id, frente_tipo) references public.nos (id, tipo) on delete cascade,
  check (fim is null or fim > inicio),
  check ((origem = 'foco') = (frente_id is not null and item_id is null)),
  check (origem = 'foco' or item_id is not null),
  check (origem <> 'manual' or fim is not null)
);
comment on table public.tempo_registros is 'Time tracking. Registro aberto (fim vazio) de origem foco é o foco atual da pessoa.';
create unique index tempo_um_cronometro_aberto on public.tempo_registros (pessoa_id) where fim is null and origem = 'cronometro';
create unique index tempo_um_foco_aberto on public.tempo_registros (pessoa_id) where fim is null and origem = 'foco';
create index tempo_item_idx on public.tempo_registros (item_id) where item_id is not null;
create index tempo_frente_idx on public.tempo_registros (frente_id, inicio) where frente_id is not null;
create index tempo_pessoa_inicio_idx on public.tempo_registros (pessoa_id, inicio);

-- RESERVA DE HORÁRIO (Time blocking): planejado, não é tempo gasto
create table public.blocos_agenda (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.itens(id) on delete cascade,
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  inicio    timestamptz not null,
  fim       timestamptz not null,
  check (fim > inicio),
  exclude using gist (pessoa_id with =, tstzrange(inicio, fim) with &&)
);
create index blocos_item_idx on public.blocos_agenda (item_id);

-- VISÕES SALVAS (Saved views)
create table public.visoes_salvas (
  id            uuid primary key default gen_random_uuid(),
  pessoa_id     uuid not null references public.pessoas(id) on delete cascade,
  no_id         uuid references public.nos(id) on delete cascade,   -- nulo = vale em qualquer lugar (Everything)
  nome          text not null,
  visao         text not null check (visao in ('board','table','list','calendar','timeline','workload')),
  filtros       jsonb not null default '{}'::jsonb,
  agrupamento   text,
  ordenacao     text,
  compartilhada boolean not null default false,
  criado_em     timestamptz not null default now(),
  unique (pessoa_id, nome)
);

-- AUTOMAÇÕES ("quando acontecer X, faça Y")
create table public.automacoes (
  id          uuid primary key default gen_random_uuid(),
  no_id       uuid not null references public.nos(id) on delete cascade,
  nome        text not null,
  gatilho     text not null check (gatilho in ('item_criado','status_mudou','prioridade_mudou','responsavel_mudou','prazo_vencido')),
  condicao    jsonb not null default '{}'::jsonb,  -- ex.: {"tipo":"bug","grupo":"done"}
  acao        text not null check (acao in ('notificar','comentar','mudar_prioridade','atribuir','mudar_status','marcar_visivel')),
  parametros  jsonb not null default '{}'::jsonb,  -- ex.: {"pessoa_id":"...","texto":"..."}
  ativa       boolean not null default true,
  criado_por  uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now()
);
create index automacoes_no_idx on public.automacoes (no_id) where ativa;

create table public.automacoes_execucoes (
  id           bigint generated always as identity primary key,
  automacao_id uuid not null references public.automacoes(id) on delete cascade,
  item_id      uuid references public.itens(id) on delete cascade,
  resultado    text not null check (resultado in ('ok','ignorada','erro')),
  detalhe      text,
  em           timestamptz not null default now()
);
create index automacoes_execucoes_idx on public.automacoes_execucoes (automacao_id, em desc);
create index automacoes_execucoes_item_idx on public.automacoes_execucoes (item_id) where item_id is not null;

-- NOTIFICAÇÕES
create table public.notificacoes (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  titulo     text not null,
  texto      text,
  item_id    uuid references public.itens(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  lida_em    timestamptz
);
create index notificacoes_pessoa_idx on public.notificacoes (pessoa_id, criado_em desc) where lida_em is null;
create index notificacoes_item_idx on public.notificacoes (item_id) where item_id is not null;

-- QUADRO VISUAL (Whiteboard): cada elemento pode apontar para um registro de verdade
create table public.quadros (
  no_id          uuid primary key references public.nos(id) on delete cascade,
  atualizado_em  timestamptz not null default now()
);

create table public.quadro_elementos (
  id          uuid primary key default gen_random_uuid(),
  quadro_id   uuid not null references public.quadros(no_id) on delete cascade,
  tipo        text not null check (tipo in ('cartao','texto','forma','seta')),
  x           real not null default 0,
  y           real not null default 0,
  largura     real,
  altura      real,
  texto       text,
  cor         text check (cor is null or cor ~ '^#[0-9A-Fa-f]{6}$'),
  ref_no_id   uuid references public.nos(id) on delete set null,
  ref_item_id uuid references public.itens(id) on delete set null,
  de_id       uuid references public.quadro_elementos(id) on delete cascade,
  para_id     uuid references public.quadro_elementos(id) on delete cascade,
  check (num_nonnulls(ref_no_id, ref_item_id) <= 1),
  check ((tipo = 'seta') = (de_id is not null and para_id is not null))
);
create index quadro_elementos_quadro_idx on public.quadro_elementos (quadro_id);
create index quadro_elementos_de_idx on public.quadro_elementos (de_id) where de_id is not null;
create index quadro_elementos_para_idx on public.quadro_elementos (para_id) where para_id is not null;
create index quadro_elementos_ref_no_idx on public.quadro_elementos (ref_no_id) where ref_no_id is not null;
create index quadro_elementos_ref_item_idx on public.quadro_elementos (ref_item_id) where ref_item_id is not null;

-- >>>>>>>>>> 03_ficha_etapas_comercial.sql
-- =====================================================================
-- CicloDev · 03 · Ficha técnica, requisitos, etapas obrigatórias, catálogo, custos e receitas
-- =====================================================================

-- FICHA TÉCNICA: um campo por linha. A aplicação herda do projeto o que não preencher (ver bi.ficha_do_no)
create table public.ficha_campos (
  no_id          uuid not null references public.nos(id) on delete cascade,
  secao          text not null,
  campo          text not null,
  valor          text not null,
  personalizado  boolean not null default false,
  atualizado_por uuid references public.pessoas(id) on delete set null,
  atualizado_em  timestamptz not null default now(),
  primary key (no_id, secao, campo)
);
create trigger ficha_carimbo before update on public.ficha_campos for each row execute function interno.carimbar_atualizacao();

create table public.decisoes (
  id            uuid primary key default gen_random_uuid(),
  no_id         uuid not null references public.nos(id) on delete cascade,
  titulo        text not null,
  motivo        text not null,
  alternativas  text,
  decidido_por  uuid references public.pessoas(id) on delete set null,
  decidido_em   date not null default current_date
);
create index decisoes_no_idx on public.decisoes (no_id, decidido_em desc);

-- lista de segredos: só nome e onde fica. Nunca o valor.
create table public.segredos_catalogo (
  id            uuid primary key default gen_random_uuid(),
  no_id         uuid not null references public.nos(id) on delete cascade,
  nome          text not null check (nome ~ '^[A-Z][A-Z0-9_]{1,80}$'),
  onde_fica     text not null,
  para_que      text,
  quem_acessa   text,
  ultima_troca  date,
  unique (no_id, nome)
);
comment on table public.segredos_catalogo is 'Secrets catalog. O nome segue o padrão de variável (MAIÚSCULAS_COM_SUBLINHADO) justamente para não caber um valor aqui.';

-- REQUISITOS MÍNIMOS (Baseline requirements)
create table public.requisitos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  descricao   text,
  padrao      boolean not null default true,   -- entra em todo projeto novo
  ordem       smallint not null default 0
);

-- ETAPAS OBRIGATÓRIAS (Stage gates): modelo padrão
create table public.etapas_modelo (
  id          uuid primary key default gen_random_uuid(),
  chave       text not null unique,
  nome        text not null,
  explicacao  text,
  lente       text,
  entrega     text,
  ordem       smallint not null unique
);

create table public.etapas_modelo_itens (
  id           uuid primary key default gen_random_uuid(),
  etapa_id     uuid not null references public.etapas_modelo(id) on delete cascade,
  texto        text not null,
  modo         text not null default 'aviso' check (modo in ('aviso','trava','desligado')),
  obrigatorio  boolean not null default true,
  prova_tipo   text not null default 'nenhuma' check (prova_tipo in ('nenhuma','captura','arquivo','link','texto','aprovacao')),
  quem_cumpre  text not null default 'responsavel_etapa' check (quem_cumpre in ('responsavel_etapa','qualquer_um','pessoa_definida')),
  pessoa_id    uuid references public.pessoas(id) on delete set null,
  so_terceiros boolean not null default false,   -- só vale quando o código é de outra empresa
  ordem        smallint not null default 0,
  check ((quem_cumpre = 'pessoa_definida') = (pessoa_id is not null))
);
create index etapas_modelo_itens_etapa_idx on public.etapas_modelo_itens (etapa_id, ordem);

-- a situação de cada item de etapa em cada projeto ou aplicação (com os ajustes feitos pelo Master ali)
create table public.etapas_nos (
  no_id           uuid not null references public.nos(id) on delete cascade,
  item_modelo_id  uuid not null references public.etapas_modelo_itens(id) on delete cascade,
  modo            text check (modo in ('aviso','trava','desligado')),               -- nulo = segue o modelo
  prova_tipo      text check (prova_tipo in ('nenhuma','captura','arquivo','link','texto','aprovacao')),
  situacao        text not null default 'pendente' check (situacao in ('pendente','cumprido','dispensado')),
  cumprido_por    uuid references public.pessoas(id) on delete set null,
  cumprido_em     timestamptz,
  motivo_dispensa text,
  primary key (no_id, item_modelo_id),
  check (situacao <> 'dispensado' or length(btrim(coalesce(motivo_dispensa,''))) > 0),
  check ((situacao = 'pendente') = (cumprido_em is null))
);
comment on table public.etapas_nos is 'Só existe linha quando algo mudou no item daquele projeto. Sem linha, o item está pendente e segue o modelo.';
create index etapas_nos_item_modelo_idx on public.etapas_nos (item_modelo_id);

create table public.provas (
  id              uuid primary key default gen_random_uuid(),
  no_id           uuid not null,
  item_modelo_id  uuid not null,
  tipo            text not null check (tipo in ('captura','arquivo','link','texto','aprovacao')),
  valor           text,
  enviado_por     uuid references public.pessoas(id) on delete set null,
  enviado_em      timestamptz not null default now(),
  foreign key (no_id, item_modelo_id) references public.etapas_nos (no_id, item_modelo_id) on delete cascade
);
create index provas_item_idx on public.provas (no_id, item_modelo_id);

-- =====================================================================
-- CATÁLOGO DE SERVIÇOS
-- =====================================================================
create table public.servicos (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique check (codigo ~ '^[a-z0-9_]{2,40}$'),
  categoria        text not null,
  nome             text not null,
  descricao        text,
  entregaveis      text[] not null default '{}',
  frentes_padrao   text[] not null default '{}',
  horas_min        numeric(7,1) not null default 0,
  horas_max        numeric(7,1) not null default 0,
  sla              text,
  checklist_inicio text[] not null default '{}',
  ativo            boolean not null default true,
  check (horas_max >= horas_min and horas_min >= 0)
);

alter table public.aplicacoes
  add constraint aplicacoes_servico_fk foreign key (servico_id) references public.servicos(id) on delete set null;
create index aplicacoes_servico_idx on public.aplicacoes (servico_id) where servico_id is not null;

create table public.servicos_cobranca (
  id          uuid primary key default gen_random_uuid(),
  servico_id  uuid not null references public.servicos(id) on delete cascade,
  modelo      text not null check (modelo in ('fixo','hora','marco','implantacao','mensalidade','banco_horas','usuario','faixas','uso','valor','sucesso','manutencao','repasse')),
  parametros  jsonb not null default '{}'::jsonb,
  ordem       smallint not null default 0,
  unique (servico_id, modelo)
);

create table public.servicos_requisitos (
  servico_id   uuid not null references public.servicos(id) on delete cascade,
  requisito_id uuid not null references public.requisitos(id) on delete cascade,
  primary key (servico_id, requisito_id)
);
create index servicos_requisitos_requisito_idx on public.servicos_requisitos (requisito_id);

-- REGRAS DE CÁLCULO, com histórico: vale a linha mais recente com vigência até hoje
create table public.regras_calculo (
  vigente_desde    date primary key,
  regime           text not null check (regime in ('simples','presumido','real')),
  aliq_simples     numeric(5,2) not null,
  aliq_presumido   numeric(5,2) not null,
  aliq_real        numeric(5,2) not null,
  inss_patronal    numeric(5,2) not null,
  rat              numeric(5,2) not null,
  terceiros        numeric(5,2) not null,
  fgts             numeric(5,2) not null,
  ferias           numeric(5,2) not null,
  terco_ferias     numeric(5,2) not null,
  decimo_terceiro  numeric(5,2) not null,
  multa_fgts       numeric(5,2) not null,
  horas_mes        numeric(5,1) not null check (horas_mes > 0),
  faturavel_pct    numeric(5,2) not null check (faturavel_pct > 0 and faturavel_pct <= 100),
  margem_pct       numeric(5,2) not null,
  contingencia_pct numeric(5,2) not null,
  folga_rateio_pct numeric(5,2) not null default 0,
  manutencao_pct   numeric(5,2) not null,
  cambio_usd       numeric(10,4) not null check (cambio_usd > 0),
  complexidade     jsonb not null,  -- {"Baixa":0.85,"Média":1,"Alta":1.3,"Muito alta":1.6}
  urgencia         jsonb not null,  -- {"Normal":1,"Prioritária":1.2,"Urgente":1.5}
  criado_em        timestamptz not null default now(),
  criado_por       uuid references public.pessoas(id) on delete set null
);

-- CUSTO DE PESSOAS (salários: só o Master vê)
create table public.pessoas_custos (
  id             uuid primary key default gen_random_uuid(),
  pessoa_id      uuid not null references public.pessoas(id) on delete cascade,
  vinculo        text not null check (vinculo in ('clt','pj','estagio','socio')),
  salario        numeric(12,2) not null default 0 check (salario >= 0),
  prolabore      numeric(12,2) not null default 0 check (prolabore >= 0),
  valor_pj       numeric(12,2) not null default 0 check (valor_pj >= 0),
  beneficios     numeric(12,2) not null default 0 check (beneficios >= 0),
  vigente_desde  date not null,
  unique (pessoa_id, vigente_desde)
);

-- DINHEIRO: sempre com moeda e data
create table public.cambio (
  moeda  char(3) not null check (moeda in ('USD','EUR')),
  dia    date not null,
  valor  numeric(10,4) not null check (valor > 0),
  primary key (moeda, dia)
);

create table public.custos_operacao (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  categoria          text not null,
  valor              numeric(14,2) not null check (valor >= 0),
  moeda              char(3) not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  recorrencia        text not null check (recorrencia in ('mensal','anual','unico','depreciacao')),
  meses_depreciacao  smallint check (meses_depreciacao is null or meses_depreciacao > 0),
  inicio             date not null default current_date,
  fim                date,
  check ((recorrencia = 'depreciacao') = (meses_depreciacao is not null)),
  check (fim is null or fim >= inicio)
);

-- CUSTOS TÉCNICOS: ligados a qualquer nível da estrutura (normalmente a aplicação). O cliente vem da árvore.
create table public.custos_tecnicos (
  id                  uuid primary key default gen_random_uuid(),
  no_id               uuid not null references public.nos(id) on delete restrict,
  fornecedor          text not null,
  categoria           text not null,
  descricao           text,
  recorrencia         text not null check (recorrencia in ('mensal','anual','unico','uso')),
  moeda               char(3) not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  valor               numeric(14,2) not null check (valor >= 0),
  unidade             text,
  limite              numeric(14,2) check (limite is null or limite > 0),
  plano               text,
  proximo_plano       text,
  proximo_valor       numeric(14,2),
  extra_por_unidade   numeric(14,4),
  repasse             boolean not null default false,
  taxa_repasse_pct    numeric(5,2) not null default 0 check (taxa_repasse_pct >= 0),
  inicio              date not null,
  fim                 date,
  check (fim is null or fim >= inicio),
  check (recorrencia <> 'uso' or unidade is not null)
);
create index custos_tecnicos_no_idx on public.custos_tecnicos (no_id);

create table public.custos_uso (
  custo_id    uuid not null references public.custos_tecnicos(id) on delete cascade,
  mes         date not null check (extract(day from mes) = 1),
  quantidade  numeric(14,2) not null check (quantidade >= 0),
  valor_pago  numeric(14,2) check (valor_pago is null or valor_pago >= 0),
  primary key (custo_id, mes)
);

-- RECEITAS: o que cada cliente paga, ligado ao projeto ou à aplicação
create table public.receitas (
  id          uuid primary key default gen_random_uuid(),
  no_id       uuid not null references public.nos(id) on delete restrict,
  servico_id  uuid references public.servicos(id) on delete set null,
  descricao   text not null,
  modelo      text not null check (modelo in ('fixo','hora','marco','implantacao','mensalidade','banco_horas','usuario','faixas','uso','valor','sucesso','manutencao','repasse')),
  valor       numeric(14,2) not null check (valor >= 0),
  moeda       char(3) not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  forma       text not null check (forma in ('unica','parcelada','mensal')),
  parcelas    smallint check (parcelas is null or parcelas > 0),
  inicio      date not null,
  fim         date,
  check ((forma = 'parcelada') = (parcelas is not null)),
  check (fim is null or fim >= inicio)
);
create index receitas_no_idx on public.receitas (no_id);

-- >>>>>>>>>> 04_atendimento_agentes_anexos_auditoria.sql
-- =====================================================================
-- CicloDev · 04 · Service Desk, agentes, anexos e auditoria
-- =====================================================================

-- SLA: prazo combinado por nível da estrutura (vale o mais próximo acima do pedido)
create table public.slas (
  no_id            uuid not null references public.nos(id) on delete cascade,
  gravidade        text not null check (gravidade in ('parado','quebrada','incomodo','cosmetico')),
  horas_resposta   numeric(6,1) not null check (horas_resposta > 0),
  horas_solucao    numeric(7,1) not null check (horas_solucao >= horas_resposta),
  primary key (no_id, gravidade)
);

create table public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete restrict,   -- aplicação (ou projeto) de onde veio
  autor_id       uuid references public.pessoas(id) on delete set null,
  tipo           text not null check (tipo in ('bug','correcao','mudanca','funcionalidade','duvida')),
  gravidade      text not null default 'incomodo' check (gravidade in ('parado','quebrada','incomodo','cosmetico')),
  status         text not null default 'novo' check (status in ('novo','ia_conversando','aguardando_voce','virou_item','resolvido','recusado')),
  titulo         text not null,
  contexto       jsonb not null default '{}'::jsonb,   -- Context capture: tela, versão, navegador, erros
  item_id        uuid unique references public.itens(id) on delete set null,
  duplicado_de   uuid references public.pedidos(id) on delete set null,
  criado_em      timestamptz not null default now(),
  respondido_em  timestamptz,   -- primeira resposta de uma pessoa da equipe (mede o SLA de resposta)
  resolvido_em   timestamptz,
  check (duplicado_de is null or duplicado_de <> id),
  check ((status in ('resolvido','recusado')) = (resolvido_em is not null))
);
create index pedidos_no_idx on public.pedidos (no_id, criado_em desc);
create index pedidos_status_idx on public.pedidos (status) where status not in ('resolvido','recusado');
create index pedidos_autor_idx on public.pedidos (autor_id);
create index pedidos_duplicado_idx on public.pedidos (duplicado_de) where duplicado_de is not null;

create table public.pedidos_mensagens (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null references public.pedidos(id) on delete cascade,
  autor_tipo   text not null check (autor_tipo in ('cliente','ia','equipe')),
  pessoa_id    uuid references public.pessoas(id) on delete set null,
  texto        text,
  transcricao  text,   -- quando a mensagem é um áudio
  criado_em    timestamptz not null default now(),
  check (num_nonnulls(texto, transcricao) >= 1 or autor_tipo = 'cliente')
);
create index pedidos_mensagens_idx on public.pedidos_mensagens (pedido_id, criado_em);

-- primeira resposta da equipe carimba o pedido (base do SLA de resposta)
create or replace function interno.carimbar_resposta() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.autor_tipo = 'equipe' then
    update public.pedidos set respondido_em = new.criado_em
     where id = new.pedido_id and respondido_em is null;
  end if;
  return new;
end $$;
create trigger pedidos_mensagens_resposta after insert on public.pedidos_mensagens
  for each row execute function interno.carimbar_resposta();

-- Os agentes antigos (agentes, agentes_fontes, agentes_ferramentas, agentes_execucoes, agentes_avaliacoes)
-- saíram em 28/09/2026. O Agent Studio novo, só do dono do sistema, está na parte 17.

-- ANEXOS E REFERÊNCIAS: cada um pertence a exatamente um lugar; é arquivo no storage ou link
create table public.anexos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo          text not null check (tipo in ('imagem','audio','video','documento','link')),
  mime          text,
  tamanho_bytes bigint check (tamanho_bytes is null or tamanho_bytes >= 0),
  storage_path  text,   -- bucket "anexos"
  url           text,
  no_id         uuid references public.nos(id) on delete cascade,
  item_id       uuid references public.itens(id) on delete cascade,
  comentario_id uuid references public.comentarios(id) on delete cascade,
  pedido_id     uuid references public.pedidos(id) on delete cascade,
  mensagem_id   uuid references public.pedidos_mensagens(id) on delete cascade,
  prova_id      uuid references public.provas(id) on delete cascade,
  decisao_id    uuid references public.decisoes(id) on delete cascade,
  enviado_por   uuid references public.pessoas(id) on delete set null,
  criado_em     timestamptz not null default now(),
  check (num_nonnulls(no_id, item_id, comentario_id, pedido_id, mensagem_id, prova_id, decisao_id) = 1),
  check (num_nonnulls(storage_path, url) = 1),
  check ((tipo = 'link') = (url is not null))
);
create index anexos_no_idx on public.anexos (no_id) where no_id is not null;
create index anexos_item_idx on public.anexos (item_id) where item_id is not null;
create index anexos_pedido_idx on public.anexos (pedido_id) where pedido_id is not null;
create index anexos_mensagem_idx on public.anexos (mensagem_id) where mensagem_id is not null;
create index anexos_comentario_idx on public.anexos (comentario_id) where comentario_id is not null;
create index anexos_prova_idx on public.anexos (prova_id) where prova_id is not null;

-- =====================================================================
-- AUDITORIA (Audit log): quem fez o quê, com o antes e o depois só do que mudou
-- =====================================================================
create table auditoria.registros (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id uuid,
  acao        text not null check (acao in ('I','U','D')),
  mudancas    jsonb,          -- INSERT: tudo; UPDATE: {"campo":[antes, depois]}; DELETE: tudo
  pessoa_id   uuid,
  em          timestamptz not null default now()
);
create index auditoria_registro_idx on auditoria.registros (registro_id, em desc);
create index auditoria_em_idx on auditoria.registros using brin (em);
create index auditoria_tabela_em_idx on auditoria.registros (tabela, em desc);

create or replace function auditoria.registrar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare j_novo jsonb; j_velho jsonb; dif jsonb; k text;
begin
  if tg_op = 'INSERT' then
    j_novo := to_jsonb(new);
    insert into auditoria.registros (tabela, registro_id, acao, mudancas, pessoa_id)
    values (tg_table_name, (j_novo->>'id')::uuid, 'I', j_novo, interno.pessoa_atual());
    return new;
  elsif tg_op = 'UPDATE' then
    j_novo := to_jsonb(new); j_velho := to_jsonb(old); dif := '{}'::jsonb;
    for k in select jsonb_object_keys(j_novo) loop
      if k not in ('atualizado_em') and j_novo->k is distinct from j_velho->k then
        dif := dif || jsonb_build_object(k, jsonb_build_array(j_velho->k, j_novo->k));
      end if;
    end loop;
    if dif <> '{}'::jsonb then
      insert into auditoria.registros (tabela, registro_id, acao, mudancas, pessoa_id)
      values (tg_table_name, (j_novo->>'id')::uuid, 'U', dif, interno.pessoa_atual());
    end if;
    return new;
  else
    j_velho := to_jsonb(old);
    insert into auditoria.registros (tabela, registro_id, acao, mudancas, pessoa_id)
    values (tg_table_name, (j_velho->>'id')::uuid, 'D', j_velho, interno.pessoa_atual());
    return old;
  end if;
end $$;

-- tabelas com histórico
do $$
declare t text;
begin
  foreach t in array array['nos','itens','comentarios','pedidos','custos_tecnicos','receitas','regras_calculo',
                           'pessoas_custos','servicos','automacoes','marcos','sprints','decisoes'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function auditoria.registrar()',
                   t || '_auditoria', t);
  end loop;
end $$;

-- >>>>>>>>>> 05_bi.sql
-- =====================================================================
-- CicloDev · 05 · BI: toda conta do sistema mora aqui, num lugar só
-- Critério de desempenho:
--   * o que é pequeno e muda toda hora (custos, receitas, painel) é calculado na hora, com índice;
--   * o que é histórico e cresce sem parar (ritmo semanal dos itens) fica numa visão materializada
--     com índice único, atualizada sem travar leitura (refresh concurrently) pela rotina bi.atualizar().
-- =====================================================================

-- dia de hoje no fuso de Brasília (o banco guarda em UTC)
create or replace function bi.hoje() returns date
language sql stable set search_path = public, pg_temp as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function bi.mes_atual() returns date
language sql stable set search_path = public, pg_temp as $$ select date_trunc('month', bi.hoje())::date $$;

-- regra de cálculo vigente
create or replace function bi.regras() returns public.regras_calculo
language sql stable security definer set search_path = public, pg_temp as $$
  select * from public.regras_calculo where vigente_desde <= bi.hoje() order by vigente_desde desc limit 1
$$;

create or replace function bi.aliquota() returns numeric
language sql stable set search_path = public, pg_temp as $$
  select case r.regime when 'simples' then r.aliq_simples when 'presumido' then r.aliq_presumido else r.aliq_real end
    from bi.regras() r
$$;

-- câmbio: o do dia (ou o último antes dele); sem registro, o dólar da regra vigente
create or replace function bi.cambio(p_moeda char(3), p_dia date) returns numeric
language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_moeda = 'BRL' then 1::numeric else coalesce(
    (select c.valor from public.cambio c where c.moeda = p_moeda and c.dia <= p_dia order by c.dia desc limit 1),
    case when p_moeda = 'USD' then (bi.regras()).cambio_usd end) end
$$;

-- =====================================================================
-- EQUIPE: custo mensal de cada pessoa pela regra vigente (CLT, PJ, estágio, sócio)
-- =====================================================================
create or replace view bi.custo_pessoas as
with vig as (
  select distinct on (pc.pessoa_id) pc.*
    from public.pessoas_custos pc
   where pc.vigente_desde <= bi.hoje()
   order by pc.pessoa_id, pc.vigente_desde desc
), r as (select * from bi.regras())
select p.id as pessoa_id, p.nome, v.vinculo, p.capacidade_h,
       c.salario_base, c.provisoes, c.fgts, c.inss, c.multa_fgts, v.beneficios,
       round(c.salario_base + c.provisoes + c.fgts + c.inss + c.multa_fgts + v.beneficios, 2) as total_mes,
       round(p.capacidade_h * 4.33 * r.faturavel_pct / 100, 2) as horas_faturaveis_mes,
       round((c.salario_base + c.provisoes + c.fgts + c.inss + c.multa_fgts + v.beneficios)
             / nullif(p.capacidade_h * 4.33 * r.faturavel_pct / 100, 0), 2) as custo_hora
  from vig v
  join public.pessoas p on p.id = v.pessoa_id and p.ativo
  cross join r
  cross join lateral (
    select
      case v.vinculo when 'clt' then v.salario when 'pj' then v.valor_pj when 'estagio' then v.salario else v.prolabore end as salario_base,
      case when v.vinculo = 'clt' then v.salario * (r.ferias + r.terco_ferias + r.decimo_terceiro) / 100 else 0 end as provisoes,
      case when v.vinculo = 'clt' then v.salario * (1 + (r.ferias + r.terco_ferias + r.decimo_terceiro) / 100) * r.fgts / 100 else 0 end as fgts,
      case when r.regime = 'simples' then 0
           when v.vinculo = 'clt' then v.salario * (1 + (r.ferias + r.terco_ferias + r.decimo_terceiro) / 100) * (r.inss_patronal + r.rat + r.terceiros) / 100
           when v.vinculo = 'socio' then v.prolabore * 0.20
           else 0 end as inss,
      case when v.vinculo = 'clt' then v.salario * r.multa_fgts / 100 else 0 end as multa_fgts
  ) c;
comment on view bi.custo_pessoas is 'Custo mensal e custo hora de cada pessoa. No Simples, o INSS patronal vai no DAS e não entra aqui.';

-- operação interna em valor mensal equivalente (anual/12, depreciação/meses, único fora da conta mensal)
create or replace view bi.operacao_mensal as
select o.*,
       round(case o.recorrencia when 'mensal' then o.valor when 'anual' then o.valor / 12
                                when 'depreciacao' then o.valor / o.meses_depreciacao else 0 end
             * bi.cambio(o.moeda, bi.hoje()), 2) as mensal_brl
  from public.custos_operacao o
 where o.inicio <= bi.hoje() and (o.fim is null or o.fim >= bi.hoje());

-- os números que formam o preço da hora
create or replace view bi.parametros_preco as
with eq as (select coalesce(sum(total_mes), 0) as custo_equipe, coalesce(sum(horas_faturaveis_mes), 0) as horas from bi.custo_pessoas),
     op as (select coalesce(sum(mensal_brl), 0) as overhead from bi.operacao_mensal),
     r as (select * from bi.regras())
select eq.custo_equipe, eq.horas as horas_faturaveis, op.overhead,
       round(eq.custo_equipe / nullif(eq.horas, 0), 2) as custo_hora_medio,
       round(op.overhead * (1 + r.folga_rateio_pct / 100) / nullif(eq.horas, 0), 2) as rateio_hora,
       bi.aliquota() as aliquota, r.margem_pct, r.contingencia_pct,
       round((eq.custo_equipe + op.overhead * (1 + r.folga_rateio_pct / 100)) / nullif(eq.horas, 0)
             * (1 + r.contingencia_pct / 100) / greatest(1 - (bi.aliquota() + r.margem_pct) / 100, 0.05), 2) as preco_hora
  from eq, op, r;

-- a calculadora do Catalog: (equipe + rateio) × (1 + contingência) ÷ (1 − impostos − margem) × urgência
create or replace function bi.calcular_preco(p_horas numeric, p_complexidade text default 'Média', p_urgencia text default 'Normal')
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  with ok as (select interno.eh_master() as m),
       p as (select * from bi.parametros_preco where (select m from ok)),
       r as (select * from bi.regras()),
       k as (select coalesce((r.complexidade->>p_complexidade)::numeric, 1) as kc,
                    coalesce((r.urgencia->>p_urgencia)::numeric, 1) as ku from r),
       c as (select p_horas * k.kc as horas, p_horas * k.kc * p.custo_hora_medio as equipe,
                    p_horas * k.kc * p.rateio_hora as rateio, k.ku, p.aliquota, p.margem_pct, p.contingencia_pct from p, k),
       f as (select c.*, (c.equipe + c.rateio) * c.contingencia_pct / 100 as contingencia,
                    (c.equipe + c.rateio) * (1 + c.contingencia_pct / 100)
                      / greatest(1 - (c.aliquota + c.margem_pct) / 100, 0.05) * c.ku as preco from c)
  select jsonb_build_object(
    'horas', round(horas, 1), 'equipe', round(equipe, 2), 'rateio', round(rateio, 2), 'contingencia', round(contingencia, 2),
    'impostos', round(preco * aliquota / 100, 2), 'margem', round(preco * margem_pct / 100, 2),
    'acrescimo_urgencia', round(preco - preco / ku, 2), 'preco', round(preco, 2))
  from f
$$;

-- =====================================================================
-- CUSTOS E RECEITAS MÊS A MÊS (36 meses para trás e 12 para frente)
-- =====================================================================
create or replace view bi.meses as
select m::date as mes, (m::date > bi.mes_atual()) as previsto
  from generate_series(bi.mes_atual() - interval '36 months', bi.mes_atual() + interval '12 months', interval '1 month') m;

-- tendência de uso de cada custo (Forecast): inclinação dos últimos 6 meses registrados
create or replace view bi.custos_tendencia as
select u.custo_id,
       (array_agg(u.quantidade order by u.mes desc))[1] as ultima_quantidade,
       max(u.mes) as ultimo_mes,
       min(u.mes) as primeiro_mes,
       (array_agg(u.quantidade order by u.mes asc))[1] as primeira_quantidade,
       coalesce(regr_slope(u.quantidade, extract(epoch from u.mes) / 2629800.0), 0)::numeric as inclinacao_mes
  from (select *, row_number() over (partition by custo_id order by mes desc) as rn from public.custos_uso) u
 where u.rn <= 6
 group by u.custo_id;

create or replace view bi.custos_mensais as
with base as (
  select c.*, date_trunc('month', c.inicio)::date as mes_ini,
         date_trunc('month', coalesce(c.fim, 'infinity'::date))::date as mes_fim
    from public.custos_tecnicos c
), grade as (
  select b.*, m.mes, m.previsto,
         ((extract(year from m.mes) - extract(year from b.mes_ini)) * 12 + extract(month from m.mes) - extract(month from b.mes_ini))::int as idade
    from base b
    join bi.meses m on m.mes >= b.mes_ini and (b.fim is null or m.mes <= b.mes_fim)
), qtd as (
  select g.*, u.valor_pago,
         case when g.unidade is null then null
              when u.quantidade is not null then u.quantidade
              when t.custo_id is null then null
              when g.mes < t.primeiro_mes then t.primeira_quantidade
              else greatest(0, t.ultima_quantidade + t.inclinacao_mes *
                   ((extract(year from g.mes) - extract(year from t.ultimo_mes)) * 12 + extract(month from g.mes) - extract(month from t.ultimo_mes)))
         end as quantidade,
         (u.quantidade is null and g.unidade is not null) as quantidade_estimada
    from grade g
    left join public.custos_uso u on u.custo_id = g.id and u.mes = g.mes
    left join bi.custos_tendencia t on t.custo_id = g.id
), valor as (
  select q.*,
         case
           when q.valor_pago is not null then q.valor_pago
           when q.recorrencia = 'uso' then coalesce(q.quantidade, 0) * q.valor
           when q.limite is not null and q.quantidade > q.limite and q.proximo_valor is not null
             then q.proximo_valor + coalesce((q.quantidade - q.limite) * q.extra_por_unidade, 0)
           else q.valor
         end as valor_moeda
    from qtd q
)
select v.id as custo_id, v.no_id, v.mes, v.previsto, v.quantidade, v.quantidade_estimada,
       v.limite, (v.limite is not null and v.quantidade > v.limite) as acima_do_limite,
       -- caixa: o que sai do bolso naquele mês
       round(case v.recorrencia
               when 'anual' then case when v.idade % 12 = 0 then v.valor_moeda else 0 end
               when 'unico' then case when v.idade = 0 then v.valor_moeda else 0 end
               else v.valor_moeda end * bi.cambio(v.moeda, least(v.mes, bi.hoje())), 2) as caixa_brl,
       -- competência: o peso do custo em cada mês (anual dividido por 12)
       round(case v.recorrencia
               when 'anual' then v.valor_moeda / 12
               when 'unico' then case when v.idade = 0 then v.valor_moeda else 0 end
               else v.valor_moeda end * bi.cambio(v.moeda, least(v.mes, bi.hoje())), 2) as competencia_brl,
       round(case when v.repasse then v.valor_moeda * (1 + v.taxa_repasse_pct / 100) * bi.cambio(v.moeda, least(v.mes, bi.hoje())) else 0 end, 2) as repasse_brl
  from valor v;
comment on view bi.custos_mensais is 'Custo técnico de cada item em cada mês, desde o início (pode ser retroativo), com previsão pela tendência de uso.';

create or replace view bi.receitas_mensais as
with grade as (
  select r.*, m.mes, m.previsto,
         ((extract(year from m.mes) - extract(year from date_trunc('month', r.inicio))) * 12
           + extract(month from m.mes) - extract(month from date_trunc('month', r.inicio)))::int as idade
    from public.receitas r
    join bi.meses m on m.mes >= date_trunc('month', r.inicio)::date
                   and (r.fim is null or m.mes <= date_trunc('month', r.fim)::date)
)
select g.id as receita_id, g.no_id, g.mes, g.previsto,
       round(case g.forma
               when 'mensal' then g.valor
               when 'unica' then case when g.idade = 0 then g.valor else 0 end
               when 'parcelada' then case when g.idade < g.parcelas then g.valor / g.parcelas else 0 end
             end * bi.cambio(g.moeda, least(g.mes, bi.hoje())), 2) as valor_brl
  from grade g;

-- previsão de quando cada custo com limite chega no teto do plano
create or replace view bi.previsao_limites as
select c.id as custo_id, c.no_id, c.fornecedor, c.descricao, c.unidade, c.limite, c.plano, c.proximo_plano,
       t.ultima_quantidade, round(t.inclinacao_mes, 3) as crescimento_mes,
       round(100 * t.ultima_quantidade / c.limite, 1) as uso_pct,
       case when t.ultima_quantidade >= c.limite then 0
            when t.inclinacao_mes > 0 then ceil((c.limite - t.ultima_quantidade) / t.inclinacao_mes)::int end as meses_ate_limite
  from public.custos_tecnicos c
  join bi.custos_tendencia t on t.custo_id = c.id
 where c.limite is not null and (c.fim is null or c.fim >= bi.hoje());

-- =====================================================================
-- ITENS: situação calculada de cada item (grupo do status, atraso, tempos)
-- =====================================================================
create or replace view bi.itens_situacao as
select i.id, i.frente_id, i.tipo, i.titulo, i.prioridade, i.responsavel_id, i.estimativa_h, i.pontos,
       i.inicio, i.prazo, i.data_prevista, i.visivel_cliente, i.sprint_id, i.marco_id, i.pai_id,
       i.criado_em, i.iniciado_em, i.concluido_em, s.grupo, s.nome as status_nome, s.cor as status_cor,
       (s.grupo <> 'done' and i.prazo < bi.hoje()) as atrasado,
       (i.data_prevista is not null and i.prazo is not null and i.data_prevista > i.prazo) as previsto_depois_do_prazo,
       extract(epoch from (i.concluido_em - i.criado_em)) / 3600 as lead_time_h,
       extract(epoch from (i.concluido_em - i.iniciado_em)) / 3600 as cycle_time_h
  from public.itens i
  join public.status_fluxo s on s.id = i.status_id
 where i.arquivado_em is null;

-- RITMO SEMANAL por nível da estrutura (Throughput, Lead time, Cycle time). Materializada.
create materialized view if not exists bi.ritmo_semanal as
with semanas as (
  select generate_series(date_trunc('week', now() - interval '25 weeks'), date_trunc('week', now()), interval '1 week')::date as semana
), criados as (
  select a.ancestral_id as no_id, date_trunc('week', i.criado_em)::date as semana, count(*) as n
    from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id
   where i.arquivado_em is null and i.criado_em >= now() - interval '26 weeks'
   group by 1, 2
), feitos as (
  select a.ancestral_id as no_id, date_trunc('week', i.concluido_em)::date as semana, count(*) as n,
         avg(extract(epoch from (i.concluido_em - i.criado_em)) / 3600) as lead_h,
         avg(extract(epoch from (i.concluido_em - i.iniciado_em)) / 3600) as cycle_h,
         sum(coalesce(i.estimativa_h, 0)) as horas, sum(coalesce(i.pontos, 0)) as pontos
    from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id
   where i.arquivado_em is null and i.concluido_em >= now() - interval '26 weeks'
   group by 1, 2
)
select n.id as no_id, s.semana,
       coalesce(c.n, 0)::int as criados, coalesce(f.n, 0)::int as concluidos,
       round(f.lead_h::numeric, 1) as lead_time_h, round(f.cycle_h::numeric, 1) as cycle_time_h,
       coalesce(f.horas, 0) as horas_concluidas, coalesce(f.pontos, 0)::int as pontos_concluidos
  from public.nos n
  cross join semanas s
  left join criados c on c.no_id = n.id and c.semana = s.semana
  left join feitos f on f.no_id = n.id and f.semana = s.semana
 where n.status <> 'arquivado';
create unique index if not exists ritmo_semanal_pk on bi.ritmo_semanal (no_id, semana);

-- VELOCIDADE por ciclo (Velocity) e QUEIMA do ciclo (Burndown)
create or replace view bi.velocidade_sprints as
select sp.id as sprint_id, sp.projeto_id, sp.nome, sp.inicio, sp.fim, sp.status,
       count(i.id) as itens, count(i.id) filter (where i.concluido_em is not null) as itens_concluidos,
       coalesce(sum(i.pontos), 0) as pontos_planejados,
       coalesce(sum(i.pontos) filter (where i.concluido_em is not null), 0) as pontos_concluidos,
       coalesce(sum(i.estimativa_h), 0) as horas_planejadas,
       coalesce(sum(i.estimativa_h) filter (where i.concluido_em is not null), 0) as horas_concluidas
  from public.sprints sp
  left join public.itens i on i.sprint_id = sp.id and i.arquivado_em is null
 group by sp.id;

create or replace function bi.queima_sprint(p_sprint uuid)
returns table (dia date, restante_h numeric, restante_pontos numeric, ideal_h numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  with sp as (select * from public.sprints where id = p_sprint),
       tot as (select coalesce(sum(estimativa_h), 0) as h, count(*) as n from public.itens where sprint_id = p_sprint and arquivado_em is null),
       dias as (select d::date as dia from sp, generate_series(sp.inicio, sp.fim, interval '1 day') d)
  select d.dia,
         coalesce(sum(i.estimativa_h) filter (where i.concluido_em is null or (i.concluido_em at time zone 'America/Sao_Paulo')::date > d.dia), 0),
         coalesce(sum(i.pontos) filter (where i.concluido_em is null or (i.concluido_em at time zone 'America/Sao_Paulo')::date > d.dia), 0),
         round(tot.h * (1 - (d.dia - sp.inicio)::numeric / greatest(sp.fim - sp.inicio, 1)), 1)
    from dias d cross join sp cross join tot
    left join public.itens i on i.sprint_id = p_sprint and i.arquivado_em is null
   group by d.dia, tot.h, sp.inicio, sp.fim
   order by d.dia
$$;

-- próximo dia útil (sábado e domingo passam para segunda). Usado fora das contas pesadas.
create or replace function bi.dia_util(p_dia date) returns date
language sql immutable set search_path = public, pg_temp as $$
  select case extract(isodow from p_dia) when 6 then p_dia + 2 when 7 then p_dia + 1 else p_dia end
$$;

-- CARGA (Workload): a estimativa que falta de cada item aberto, espalhada pelos dias úteis entre o início e o prazo.
-- Item atrasado: o que falta fica no próximo dia útil a partir de hoje.
-- Desempenho: as contas de data ficam escritas direto na consulta (sem chamar função linha a linha)
-- e os dias úteis saem de uma fórmula, sem gerar a lista de dias de cada item.
create or replace function bi.carga(p_de date, p_ate date)
returns table (pessoa_id uuid, dia date, horas numeric, capacidade_dia numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare hoje date := bi.hoje(); todos boolean := interno.eh_master();
begin
  return query
  with base as (
    select i.id, i.responsavel_id, i.estimativa_h,
           greatest(coalesce(i.inicio, i.prazo), hoje) as b_de, greatest(i.prazo, hoje) as b_ate
      from public.itens i
      join public.status_fluxo s on s.id = i.status_id and s.grupo <> 'done'
     where i.arquivado_em is null and i.responsavel_id is not null and i.prazo is not null
       and (todos or i.frente_id in (select interno.nos_visiveis()))
  ), abertos as (
    select b.id, b.responsavel_id, b.estimativa_h, x.de, greatest(x.ate0, x.de) as ate
      from base b
      cross join lateral (select
        b.b_de + case extract(isodow from b.b_de) when 6 then 2 when 7 then 1 else 0 end as de,
        b.b_ate + case extract(isodow from b.b_ate) when 6 then 2 when 7 then 1 else 0 end as ate0) x
  ), no_periodo as (
    select a.*, ((a.ate - a.de) / 7) * 5 + ((a.ate - a.de) % 7) + 1
               - case when extract(isodow from a.de) + ((a.ate - a.de) % 7) > 5 then 2 else 0 end as n_uteis
      from abertos a where a.de <= p_ate and a.ate >= p_de
  ), gasto as (
    select t.item_id, sum(extract(epoch from (coalesce(t.fim, now()) - t.inicio)) / 3600) as h
      from public.tempo_registros t where t.item_id in (select id from no_periodo) group by t.item_id
  ), dias as (
    select a.responsavel_id, d::date as dia,
           greatest(coalesce(a.estimativa_h, 0) - coalesce(g.h, 0), 0) / greatest(a.n_uteis, 1) as horas_dia
      from no_periodo a
      left join gasto g on g.item_id = a.id
      cross join lateral generate_series(greatest(a.de, p_de), least(a.ate, p_ate), interval '1 day') d
     where extract(isodow from d) < 6
  )
  select d.responsavel_id, d.dia, round(sum(d.horas_dia), 2), round(p.capacidade_h / 5, 2)
    from dias d join public.pessoas p on p.id = d.responsavel_id
   group by d.responsavel_id, d.dia, p.capacidade_h;
end $$;

-- SLA de cada pedido: vale o SLA do nível mais próximo acima do pedido
create or replace view bi.pedidos_sla as
select p.id as pedido_id, p.no_id, p.status, p.gravidade, p.criado_em, p.respondido_em, p.resolvido_em,
       s.horas_resposta, s.horas_solucao,
       p.criado_em + make_interval(secs => s.horas_resposta * 3600) as prazo_resposta,
       p.criado_em + make_interval(secs => s.horas_solucao * 3600) as prazo_solucao,
       case
         when s.no_id is null then 'sem_sla'
         when p.resolvido_em is not null then case when p.resolvido_em <= p.criado_em + make_interval(secs => s.horas_solucao * 3600) then 'cumprido' else 'estourado' end
         when now() > p.criado_em + make_interval(secs => s.horas_solucao * 3600) then 'estourado'
         when p.respondido_em is null and now() > p.criado_em + make_interval(secs => s.horas_resposta * 3600) then 'resposta_atrasada'
         when now() > p.criado_em + make_interval(secs => s.horas_solucao * 3600 * 0.8) then 'perto_do_limite'
         else 'no_prazo' end as situacao
  from public.pedidos p
  left join lateral (
    select sl.* from public.nos_ancestrais a
      join public.slas sl on sl.no_id = a.ancestral_id and sl.gravidade = p.gravidade
     where a.no_id = p.no_id order by a.distancia limit 1
  ) s on true;

-- ETAPAS: situação efetiva de cada item de etapa em cada projeto e aplicação (modelo + ajustes)
create or replace view bi.etapas_situacao as
select n.id as no_id, n.tipo as no_tipo, em.id as etapa_id, em.nome as etapa, em.ordem as etapa_ordem,
       mi.id as item_modelo_id, mi.texto, mi.obrigatorio,
       coalesce(en.modo, mi.modo) as modo, coalesce(en.prova_tipo, mi.prova_tipo) as prova_tipo,
       coalesce(en.situacao, 'pendente') as situacao, en.cumprido_por, en.cumprido_em, en.motivo_dispensa
  from public.nos n
  cross join public.etapas_modelo_itens mi
  join public.etapas_modelo em on em.id = mi.etapa_id
  left join public.etapas_nos en on en.no_id = n.id and en.item_modelo_id = mi.id
 where n.tipo in ('projeto','aplicacao') and n.status <> 'arquivado'
   and (not mi.so_terceiros or exists (
         select 1 from public.nos_ancestrais a join public.aplicacoes ap on ap.no_id = a.no_id
          where a.ancestral_id = n.id and ap.origem_codigo = 'terceiros'));

-- FICHA TÉCNICA com herança: vale o valor do nível mais próximo
create or replace function bi.ficha_do_no(p_no uuid)
returns table (secao text, campo text, valor text, personalizado boolean, herdado boolean, origem_id uuid, origem_nome text)
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct on (f.secao, f.campo) f.secao, f.campo, f.valor, f.personalizado, a.distancia > 0, f.no_id, n.nome
    from public.nos_ancestrais a
    join public.ficha_campos f on f.no_id = a.ancestral_id
    join public.nos n on n.id = f.no_id
   where a.no_id = p_no and p_no in (select interno.nos_visiveis())
   order by f.secao, f.campo, a.distancia
$$;

-- MUDANÇAS RECENTES de um nível (lidas do registro de auditoria)
-- Desempenho: escopo pequeno (até 3 mil itens) busca pelos ids do escopo no índice (registro_id, em);
-- escopo grande percorre a auditoria do mais novo para o mais velho e para quando junta o suficiente.
create or replace function bi.mudancas_recentes(p_no uuid, p_limite int default 12)
returns table (quando timestamptz, pessoa text, acao text, item_id uuid, titulo text, detalhe jsonb)
language plpgsql stable security definer set search_path = public, auditoria, pg_temp as $$
declare
  so_cliente boolean := interno.eh_stakeholder();
  n_escopo int;
begin
  if p_no not in (select interno.nos_visiveis()) then return; end if;
  select count(*) into n_escopo from (
    select 1 from public.itens i join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = p_no limit 3001) x;

  if n_escopo <= 3000 then
    return query
    with alvo as (
      select i.id, i.titulo, i.visivel_cliente from public.itens i
        join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = p_no
       where not so_cliente or i.visivel_cliente
    ), com as (
      select c.id, c.item_id from public.comentarios c join alvo on alvo.id = c.item_id
       where not so_cliente or c.visivel_cliente
    ), ev as (
      (select r.em, r.pessoa_id, r.acao, r.mudancas, alvo.id as item_id, alvo.titulo, false as comentario
         from alvo cross join lateral (
           select * from auditoria.registros r where r.registro_id = alvo.id and r.tabela = 'itens' order by r.em desc limit p_limite) r)
      union all
      (select r.em, r.pessoa_id, r.acao, null, alvo.id, alvo.titulo, true
         from com join alvo on alvo.id = com.item_id
         cross join lateral (select * from auditoria.registros r where r.registro_id = com.id and r.tabela = 'comentarios' and r.acao = 'I' limit 1) r)
    )
    select ev.em, pe.nome, interno.rotulo_mudanca(ev.acao, ev.mudancas, ev.comentario), ev.item_id, ev.titulo, ev.mudancas
      from ev left join public.pessoas pe on pe.id = ev.pessoa_id
     order by ev.em desc limit p_limite;
  else
    return query
    select r.em, pe.nome, interno.rotulo_mudanca(r.acao, r.mudancas, r.tabela = 'comentarios'), i.id, i.titulo, r.mudancas
      from auditoria.registros r
      left join public.comentarios c on r.tabela = 'comentarios' and c.id = r.registro_id
      join public.itens i on i.id = case when r.tabela = 'itens' then r.registro_id else c.item_id end
      join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = p_no
      left join public.pessoas pe on pe.id = r.pessoa_id
     where r.tabela in ('itens','comentarios') and (r.tabela = 'itens' or r.acao = 'I')
       and (not so_cliente or (i.visivel_cliente and (c.id is null or c.visivel_cliente)))
     order by r.em desc limit p_limite;
  end if;
end $$;

create or replace function interno.rotulo_mudanca(p_acao text, p_mudancas jsonb, p_comentario boolean) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case when p_comentario then 'comentou em'
              when p_acao = 'I' then 'criou'
              when p_mudancas ? 'status_id' then 'mudou o status de'
              when p_mudancas ? 'prazo' then 'mudou o prazo de'
              when p_mudancas ? 'responsavel_id' then 'mudou o responsável de'
              when p_mudancas ? 'arquivado_em' then 'arquivou'
              else 'editou' end
$$;

-- =====================================================================
-- PAINEL de qualquer nível (o Dashboard): tudo numa chamada só
-- =====================================================================
create or replace function bi.painel(p_no uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  so_cliente boolean := interno.eh_stakeholder();
  hoje date := bi.hoje();
  r jsonb;
begin
  if p_no not in (select interno.nos_visiveis()) then
    raise exception 'Sem acesso a este nível' using errcode = '42501';
  end if;

  with it as (
    select s.* from bi.itens_situacao s
      join public.nos_ancestrais a on a.no_id = s.frente_id and a.ancestral_id = p_no
     where not so_cliente or s.visivel_cliente
  ), filhos as (
    select n.id, n.nome, n.tipo, n.status,
           count(s.id) as total,
           count(s.id) filter (where s.grupo = 'done') as feitos,
           count(s.id) filter (where s.grupo in ('doing','review')) as andamento,
           count(s.id) filter (where s.grupo = 'blocked') as bloqueados,
           count(s.id) filter (where s.atrasado) as atrasados
      from public.nos n
      left join public.nos_ancestrais a on a.ancestral_id = n.id
      left join it s on s.frente_id = a.no_id
     where n.pai_id = p_no and n.status <> 'arquivado' and n.id in (select interno.nos_visiveis())
     group by n.id
  ), dias as (
    select d::date as dia,
           (select count(*) from it where (it.concluido_em at time zone 'America/Sao_Paulo')::date = d::date) as concluidos
      from generate_series(hoje - 13, hoje, interval '1 day') d
  )
  select jsonb_build_object(
    'kpis', (select jsonb_build_object(
        'total', count(*),
        'backlog', count(*) filter (where grupo = 'backlog'),
        'a_fazer', count(*) filter (where grupo = 'todo'),
        'em_andamento', count(*) filter (where grupo in ('doing','review')),
        'bloqueados', count(*) filter (where grupo = 'blocked'),
        'concluidos', count(*) filter (where grupo = 'done'),
        'atrasados', count(*) filter (where atrasado),
        'sem_responsavel', count(*) filter (where responsavel_id is null and grupo <> 'done'),
        'criados_14d', count(*) filter (where criado_em >= now() - interval '14 days'),
        'concluidos_semana', count(*) filter (where concluido_em >= date_trunc('week', now())),
        'concluidos_semana_anterior', count(*) filter (where concluido_em >= date_trunc('week', now()) - interval '1 week' and concluido_em < date_trunc('week', now())),
        'horas_restantes', coalesce(sum(estimativa_h) filter (where grupo <> 'done'), 0)) from it),
    'por_status', (select coalesce(jsonb_object_agg(g, n), '{}'::jsonb) from (select grupo g, count(*) n from it group by grupo) x),
    'filhos', (select coalesce(jsonb_agg(to_jsonb(f) order by f.nome), '[]'::jsonb) from filhos f),
    'dias', (select jsonb_agg(jsonb_build_object('dia', dia, 'concluidos', concluidos) order by dia) from dias),
    'ultimos_concluidos', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select id, titulo, concluido_em from it where grupo = 'done' order by concluido_em desc nulls last limit 8) x),
    'mudancas', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from bi.mudancas_recentes(p_no, 10) m),
    'avisos', jsonb_build_object(
        'atrasados', (select count(*) from it where atrasado),
        'bloqueados', (select count(*) from it where grupo = 'blocked'),
        'sem_responsavel', (select count(*) from it where responsavel_id is null and grupo <> 'done'),
        'etapas_pendentes', case when so_cliente then 0 else (select count(*)
              from public.nos_ancestrais a
              join public.nos n on n.id = a.no_id and n.tipo in ('projeto','aplicacao') and n.status <> 'arquivado'
              cross join public.etapas_modelo_itens mi
              left join public.etapas_nos en on en.no_id = n.id and en.item_modelo_id = mi.id
             where a.ancestral_id = p_no and mi.obrigatorio and coalesce(en.situacao, 'pendente') = 'pendente'
               and coalesce(en.modo, mi.modo) <> 'desligado'
               and (not mi.so_terceiros or exists (select 1 from public.nos_ancestrais a2 join public.aplicacoes ap on ap.no_id = a2.no_id
                                                    where a2.ancestral_id = n.id and ap.origem_codigo = 'terceiros'))) end,
        'custos_perto_do_limite', case when interno.eh_master() then (select count(*) from bi.previsao_limites l
              join public.nos_ancestrais a on a.no_id = l.no_id and a.ancestral_id = p_no
             where l.meses_ate_limite is not null and l.meses_ate_limite <= 3) else 0 end,
        'pedidos_aguardando', case when so_cliente then 0 else (select count(*) from public.pedidos p
              join public.nos_ancestrais a on a.no_id = p.no_id and a.ancestral_id = p_no
             where p.status = 'aguardando_voce') end),
    'ritmo', (select coalesce(jsonb_agg(jsonb_build_object('semana', semana, 'criados', criados, 'concluidos', concluidos,
                     'lead_time_h', lead_time_h, 'cycle_time_h', cycle_time_h) order by semana), '[]'::jsonb)
                from bi.ritmo_semanal where no_id = p_no)
  ) into r;
  return r;
end $$;

-- FINANCEIRO de qualquer nível (só o Master): o que já foi gasto e cobrado, desde o início
create or replace function bi.financeiro(p_no uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb; v_mes date := bi.mes_atual(); par record;
begin
  if not interno.eh_master() then
    raise exception 'Só o Master vê valores' using errcode = '42501';
  end if;
  select * into par from bi.parametros_preco;
  with esc as (select no_id from public.nos_ancestrais where ancestral_id = p_no),
       cm as (select * from bi.custos_mensais where no_id in (select no_id from esc)),
       rm as (select * from bi.receitas_mensais where no_id in (select no_id from esc)),
       serie as (
         select m.mes, m.previsto,
                coalesce((select sum(caixa_brl) from cm where cm.mes = m.mes), 0) as custo,
                coalesce((select sum(valor_brl) from rm where rm.mes = m.mes), 0) + coalesce((select sum(repasse_brl) from cm where cm.mes = m.mes), 0) as receita
           from bi.meses m where m.mes >= v_mes - interval '24 months' and m.mes <= v_mes + interval '6 months')
  select jsonb_build_object(
    'custo_mes', (select coalesce(sum(competencia_brl), 0) from cm where cm.mes = v_mes),
    'gasto_ate_hoje', (select coalesce(sum(caixa_brl), 0) from cm where not cm.previsto),
    'cobrado_ate_hoje', (select coalesce(sum(valor_brl), 0) from rm where not rm.previsto),
    'repasse_ate_hoje', (select coalesce(sum(repasse_brl), 0) from cm where not cm.previsto),
    -- a receber: o que falta dos contratos com valor fechado (única e parcelada); mensalidade sem fim não entra
    'a_receber', (select coalesce(sum(greatest(r.valor * bi.cambio(r.moeda, bi.hoje())
                     - coalesce((select sum(x.valor_brl) from rm x where x.receita_id = r.id and not x.previsto), 0), 0)), 0)
                    from public.receitas r where r.no_id in (select no_id from esc) and r.forma <> 'mensal'),
    'equipe_para_terminar', round(coalesce((select sum(estimativa_h) from bi.itens_situacao s
                              join esc on esc.no_id = s.frente_id where s.grupo <> 'done'), 0)
                              * coalesce(par.custo_hora_medio, 0) * (1 + coalesce(par.contingencia_pct, 0) / 100), 2),
    'serie', (select jsonb_agg(to_jsonb(s) order by s.mes) from serie s)
  ) into r;
  return r || jsonb_build_object('resultado', (r->>'cobrado_ate_hoje')::numeric - (r->>'gasto_ate_hoje')::numeric);
end $$;

-- atualiza as visões materializadas sem travar a leitura
create or replace function bi.atualizar() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  refresh materialized view concurrently bi.ritmo_semanal;
end $$;

-- >>>>>>>>>> 06_rotinas.sql
-- =====================================================================
-- CicloDev · 06 · Rotinas chamadas pela tela (RPC) e motor das automações
-- Toda rotina confere a permissão da pessoa atual antes de agir.
-- O miolo com poder de dono (security definer) fica no schema interno, fora da API.
-- Na API (schema public) fica só a casca, sem poder especial, que chama o miolo.
-- =====================================================================

-- ---------- estrutura ----------
create or replace function interno.mover_no(p_no uuid, p_novo_pai uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not interno.eh_master() then raise exception 'Só o Master move a estrutura' using errcode = '42501'; end if;
  update public.nos set pai_id = p_novo_pai where id = p_no;
  if not found then raise exception 'Registro não encontrado' using errcode = 'P0002'; end if;
end $$;

-- ---------- tempo ----------
create or replace function interno.trocar_foco(p_frente uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); novo uuid;
begin
  if eu is null then raise exception 'Pessoa não identificada' using errcode = '42501'; end if;
  if p_frente not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a esta frente' using errcode = '42501'; end if;
  update public.tempo_registros set fim = now() where pessoa_id = eu and origem = 'foco' and fim is null;
  insert into public.tempo_registros (pessoa_id, origem, frente_id, inicio) values (eu, 'foco', p_frente, now()) returning id into novo;
  return novo;
end $$;

create or replace function interno.parar_foco()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.tempo_registros set fim = now() where pessoa_id = interno.pessoa_atual() and origem = 'foco' and fim is null
$$;

create or replace function interno.iniciar_cronometro(p_item uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); novo uuid; f uuid;
begin
  select frente_id into f from public.itens where id = p_item;
  if eu is null or f is null or f not in (select interno.nos_editaveis()) then
    raise exception 'Sem acesso a este item' using errcode = '42501';
  end if;
  update public.tempo_registros set fim = now() where pessoa_id = eu and origem = 'cronometro' and fim is null;
  insert into public.tempo_registros (pessoa_id, origem, item_id, inicio) values (eu, 'cronometro', p_item, now()) returning id into novo;
  return novo;
end $$;

create or replace function interno.parar_cronometro()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.tempo_registros set fim = now() where pessoa_id = interno.pessoa_atual() and origem = 'cronometro' and fim is null
$$;

-- ---------- service desk ----------
create or replace function interno.converter_pedido(p_pedido uuid, p_frente uuid, p_tipo text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p record; novo uuid; st uuid;
begin
  if p_frente not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a esta frente' using errcode = '42501'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado' using errcode = 'P0002'; end if;
  if p.item_id is not null then return p.item_id; end if;
  select id into st from public.status_fluxo where no_id is null and grupo = 'backlog' order by ordem limit 1;
  insert into public.itens (frente_id, tipo, titulo, descricao, status_id, prioridade, relator_id, visivel_cliente)
  values (p_frente, coalesce(p_tipo, case when p.tipo in ('bug','correcao') then 'bug' else 'story' end), p.titulo,
          'Veio do Service Desk.', st,
          case p.gravidade when 'parado' then 'highest' when 'quebrada' then 'high' when 'incomodo' then 'medium' else 'low' end,
          p.autor_id, true)
  returning id into novo;
  update public.pedidos set item_id = novo, status = 'virou_item' where id = p_pedido;
  return novo;
end $$;

-- ---------- etapas ----------
create or replace function interno.cumprir_etapa(p_no uuid, p_item_modelo uuid, p_prova_tipo text default null, p_valor text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare pedida text;
begin
  if p_no not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a este projeto' using errcode = '42501'; end if;
  select prova_tipo into pedida from bi.etapas_situacao where no_id = p_no and item_modelo_id = p_item_modelo;
  if pedida is null then raise exception 'Item de etapa não encontrado' using errcode = 'P0002'; end if;
  if pedida <> 'nenhuma' and (p_prova_tipo is null or p_valor is null or length(btrim(p_valor)) = 0) then
    raise exception 'Este item pede prova do tipo %', pedida using errcode = '23514';
  end if;
  insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em)
  values (p_no, p_item_modelo, 'cumprido', interno.pessoa_atual(), now())
  on conflict (no_id, item_modelo_id) do update
     set situacao = 'cumprido', cumprido_por = excluded.cumprido_por, cumprido_em = excluded.cumprido_em, motivo_dispensa = null;
  if p_prova_tipo is not null and p_prova_tipo <> 'nenhuma' then
    insert into public.provas (no_id, item_modelo_id, tipo, valor, enviado_por)
    values (p_no, p_item_modelo, p_prova_tipo, p_valor, interno.pessoa_atual());
  end if;
end $$;

create or replace function interno.dispensar_etapa(p_no uuid, p_item_modelo uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not interno.eh_master() then raise exception 'Só o Master dispensa um item de etapa' using errcode = '42501'; end if;
  insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em, motivo_dispensa)
  values (p_no, p_item_modelo, 'dispensado', interno.pessoa_atual(), now(), p_motivo)
  on conflict (no_id, item_modelo_id) do update
     set situacao = 'dispensado', cumprido_por = excluded.cumprido_por, cumprido_em = excluded.cumprido_em, motivo_dispensa = excluded.motivo_dispensa;
end $$;

-- ---------- login: liga a pessoa do time ao login pelo e-mail confirmado ----------
-- Só liga quando a pessoa ainda não tem login e o e-mail do login é o mesmo cadastrado nela.
create or replace function interno.vincular_meu_login()
returns table (pessoa_id uuid, nome text, papel text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := auth.uid(); meu_email text := lower(nullif(auth.jwt()->>'email', ''));
begin
  if eu is null then raise exception 'Faça login primeiro' using errcode = '42501'; end if;
  if meu_email is not null and not exists (select 1 from public.pessoas where auth_user_id = eu) then
    update public.pessoas set auth_user_id = eu
     where auth_user_id is null and ativo and lower(email) = meu_email;
  end if;
  return query select p.id, p.nome, p.papel from public.pessoas p where p.auth_user_id = eu and p.ativo;
end $$;

-- ---------- cascas na API (security invoker): a tela chama estas ----------
create or replace function public.mover_no(p_no uuid, p_novo_pai uuid) returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.mover_no(p_no, p_novo_pai) $$;
create or replace function public.trocar_foco(p_frente uuid) returns uuid
language sql security invoker set search_path = public, pg_temp as $$ select interno.trocar_foco(p_frente) $$;
create or replace function public.parar_foco() returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.parar_foco() $$;
create or replace function public.iniciar_cronometro(p_item uuid) returns uuid
language sql security invoker set search_path = public, pg_temp as $$ select interno.iniciar_cronometro(p_item) $$;
create or replace function public.parar_cronometro() returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.parar_cronometro() $$;
create or replace function public.converter_pedido(p_pedido uuid, p_frente uuid, p_tipo text default null) returns uuid
language sql security invoker set search_path = public, pg_temp as $$ select interno.converter_pedido(p_pedido, p_frente, p_tipo) $$;
create or replace function public.cumprir_etapa(p_no uuid, p_item_modelo uuid, p_prova_tipo text default null, p_valor text default null) returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.cumprir_etapa(p_no, p_item_modelo, p_prova_tipo, p_valor) $$;
create or replace function public.dispensar_etapa(p_no uuid, p_item_modelo uuid, p_motivo text) returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.dispensar_etapa(p_no, p_item_modelo, p_motivo) $$;

create or replace function public.vincular_meu_login() returns table (pessoa_id uuid, nome text, papel text)
language sql security invoker set search_path = public, pg_temp as $$ select * from interno.vincular_meu_login() $$;

-- ---------- leitura do BI pela tela (a API só enxerga o schema public) ----------
create or replace function public.painel(p_no uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$ select bi.painel(p_no) $$;
create or replace function public.financeiro(p_no uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$ select bi.financeiro(p_no) $$;
create or replace function public.calcular_preco(p_horas numeric, p_complexidade text default 'Média', p_urgencia text default 'Normal') returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$ select bi.calcular_preco(p_horas, p_complexidade, p_urgencia) $$;
create or replace function public.ficha(p_no uuid)
returns table (secao text, campo text, valor text, personalizado boolean, herdado boolean, origem_id uuid, origem_nome text)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from bi.ficha_do_no(p_no) $$;
create or replace function public.carga(p_de date, p_ate date)
returns table (pessoa_id uuid, dia date, horas numeric, capacidade_dia numeric)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from bi.carga(p_de, p_ate) $$;
create or replace function public.queima_sprint(p_sprint uuid)
returns table (dia date, restante_h numeric, restante_pontos numeric, ideal_h numeric)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from bi.queima_sprint(p_sprint) $$;

-- =====================================================================
-- MOTOR DAS AUTOMAÇÕES
-- A condição é um objeto em que cada chave precisa bater com o item: tipo, prioridade, grupo, status (chave).
-- =====================================================================
create or replace function interno.rodar_automacoes(p_item uuid, p_gatilho text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; i record; ok boolean; st uuid; dest uuid;
begin
  select it.*, s.grupo, s.chave as status_chave into i
    from public.itens it join public.status_fluxo s on s.id = it.status_id where it.id = p_item;
  if not found then return; end if;

  for a in
    select au.* from public.automacoes au
      join public.nos_ancestrais an on an.ancestral_id = au.no_id and an.no_id = i.frente_id
     where au.ativa and au.gatilho = p_gatilho
     order by an.distancia desc, au.criado_em
  loop
    ok := coalesce((a.condicao->>'tipo') is null or a.condicao->>'tipo' = i.tipo, true)
      and coalesce((a.condicao->>'prioridade') is null or a.condicao->>'prioridade' = i.prioridade, true)
      and coalesce((a.condicao->>'grupo') is null or a.condicao->>'grupo' = i.grupo, true)
      and coalesce((a.condicao->>'status') is null or a.condicao->>'status' = i.status_chave, true);
    if not ok then continue; end if;
    begin
      if a.acao = 'notificar' then
        dest := coalesce(nullif(a.parametros->>'pessoa_id', '')::uuid,
                         case when a.parametros->>'para' = 'relator' then i.relator_id else i.responsavel_id end);
        if dest is not null then
          insert into public.notificacoes (pessoa_id, titulo, texto, item_id)
          values (dest, coalesce(a.parametros->>'titulo', a.nome), i.titulo, i.id);
        end if;
      elsif a.acao = 'comentar' then
        insert into public.comentarios (item_id, texto, visivel_cliente)
        values (i.id, coalesce(a.parametros->>'texto', a.nome), coalesce((a.parametros->>'visivel_cliente')::boolean, false));
      elsif a.acao = 'mudar_prioridade' then
        update public.itens set prioridade = a.parametros->>'prioridade' where id = i.id;
      elsif a.acao = 'atribuir' then
        update public.itens set responsavel_id = (a.parametros->>'pessoa_id')::uuid where id = i.id;
      elsif a.acao = 'marcar_visivel' then
        update public.itens set visivel_cliente = true where id = i.id;
      elsif a.acao = 'mudar_status' then
        select sf.id into st from public.status_fluxo sf
          left join public.nos_ancestrais an on an.ancestral_id = sf.no_id and an.no_id = i.frente_id
         where sf.chave = a.parametros->>'status' and (sf.no_id is null or an.no_id is not null)
         order by an.distancia nulls last limit 1;
        if st is not null then update public.itens set status_id = st where id = i.id; end if;
      end if;
      insert into public.automacoes_execucoes (automacao_id, item_id, resultado) values (a.id, i.id, 'ok');
    exception when others then
      insert into public.automacoes_execucoes (automacao_id, item_id, resultado, detalhe) values (a.id, i.id, 'erro', sqlerrm);
    end;
  end loop;
end $$;

create or replace function interno.gatilho_automacoes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- automações não disparam outras automações (evita ciclo infinito)
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'INSERT' then
    perform interno.rodar_automacoes(new.id, 'item_criado');
  else
    if new.status_id is distinct from old.status_id then perform interno.rodar_automacoes(new.id, 'status_mudou'); end if;
    if new.prioridade is distinct from old.prioridade then perform interno.rodar_automacoes(new.id, 'prioridade_mudou'); end if;
    if new.responsavel_id is distinct from old.responsavel_id then perform interno.rodar_automacoes(new.id, 'responsavel_mudou'); end if;
  end if;
  return null;
end $$;

drop trigger if exists itens_automacoes on public.itens;
create trigger itens_automacoes after insert or update of status_id, prioridade, responsavel_id on public.itens
  for each row execute function interno.gatilho_automacoes();

-- rotina diária: itens que venceram ontem disparam "prazo_vencido"
create or replace function interno.automacoes_prazo_vencido() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; r record;
begin
  for r in select s.id from bi.itens_situacao s where s.grupo <> 'done' and s.prazo = bi.hoje() - 1 loop
    perform interno.rodar_automacoes(r.id, 'prazo_vencido'); n := n + 1;
  end loop;
  return n;
end $$;

-- >>>>>>>>>> 07_seguranca.sql
-- =====================================================================
-- CicloDev · 07 · Segurança: RLS (quem vê cada linha) + GRANT (quem pode cada operação)
-- Papéis:  master = vê e muda tudo · dev = trabalha onde participa · stakeholder = só o visível ao cliente, sem valores
-- Padrão de desempenho: toda função dentro de uma regra vai entre parênteses com select, "(select interno.eh_master())",
-- para o banco calcular uma vez por consulta, e não uma vez por linha.
-- =====================================================================

-- recomeça do zero (este arquivo pode ser rodado de novo: recria todas as regras)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- liga a RLS em todas as tabelas do produto
-- (sem FORCE: as rotinas security definer, donas das tabelas, continuam lendo tudo para fazer as contas)
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- estrutura ----------
create policy ver on public.nos for select to authenticated using (id in (select interno.nos_visiveis()));
create policy master_muda on public.nos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.nos_ancestrais for select to authenticated using (no_id in (select interno.nos_visiveis()));

create policy ver on public.clientes   for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.projetos   for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.aplicacoes for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.frentes    for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.clientes   for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master_muda on public.projetos   for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master_muda on public.aplicacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master_muda on public.frentes    for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- pessoas ----------
create policy ver on public.pessoas for select to authenticated using (ativo or (select interno.eh_master()));
create policy master_muda on public.pessoas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.participacoes for select to authenticated using ((select interno.eh_master()) or pessoa_id = (select interno.pessoa_atual()));
create policy master_muda on public.participacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- etiquetas ----------
create policy ver on public.etiquetas for select to authenticated using (true);
create policy master_muda on public.etiquetas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.etiquetas_nos for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.etiquetas_nos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- trabalho ----------
create policy ver on public.status_fluxo for select to authenticated using (no_id is null or no_id in (select interno.nos_visiveis()));
create policy master_muda on public.status_fluxo for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.sprints for select to authenticated using (projeto_id in (select interno.nos_visiveis()));
create policy time_muda on public.sprints for all to authenticated
  using (projeto_id in (select interno.nos_editaveis())) with check (projeto_id in (select interno.nos_editaveis()));

create policy ver on public.marcos for select to authenticated
  using (no_id in (select interno.nos_visiveis()) and (visivel_cliente or not (select interno.eh_stakeholder())));
create policy time_muda on public.marcos for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

create policy ver on public.itens for select to authenticated
  using (frente_id in (select interno.nos_visiveis()) and (visivel_cliente or not (select interno.eh_stakeholder())));
create policy time_cria on public.itens for insert to authenticated with check (frente_id in (select interno.nos_editaveis()));
create policy time_edita on public.itens for update to authenticated
  using (frente_id in (select interno.nos_editaveis())) with check (frente_id in (select interno.nos_editaveis()));
create policy master_apaga on public.itens for delete to authenticated using ((select interno.eh_master()));

-- tabelas penduradas no item: vale a visibilidade do item (a RLS de itens roda dentro do exists)
create policy ver on public.itens_ligacoes for select to authenticated using (exists (select 1 from public.itens i where i.id = origem_id));
create policy time_muda on public.itens_ligacoes for all to authenticated
  using (exists (select 1 from public.itens i where i.id = origem_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = origem_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.itens_checklist for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
create policy time_muda on public.itens_checklist for all to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.campos_personalizados for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.campos_personalizados for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.itens_campos for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
create policy time_muda on public.itens_campos for all to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.comentarios for select to authenticated using (
  (visivel_cliente or not (select interno.eh_stakeholder()))
  and ((item_id is not null and exists (select 1 from public.itens i where i.id = item_id))
       or (no_id is not null and no_id in (select interno.nos_visiveis()))));
create policy cria on public.comentarios for insert to authenticated with check (
  autor_id = (select interno.pessoa_atual())
  and (not (select interno.eh_stakeholder()) or visivel_cliente)
  and ((item_id is not null and exists (select 1 from public.itens i where i.id = item_id))
       or (no_id is not null and no_id in (select interno.nos_visiveis()))));
create policy autor_muda on public.comentarios for update to authenticated
  using (autor_id = (select interno.pessoa_atual()) or (select interno.eh_master())) with check (autor_id = (select interno.pessoa_atual()) or (select interno.eh_master()));
create policy autor_apaga on public.comentarios for delete to authenticated using (autor_id = (select interno.pessoa_atual()) or (select interno.eh_master()));

create policy ver on public.tempo_registros for select to authenticated using (
  pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master())
  or (not (select interno.eh_stakeholder()) and (frente_id in (select interno.nos_editaveis())
      or exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))));
create policy dono_muda on public.tempo_registros for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()))
  with check (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()));

create policy ver on public.blocos_agenda for select to authenticated using (
  not (select interno.eh_stakeholder()) and exists (select 1 from public.itens i where i.id = item_id));
create policy dono_muda on public.blocos_agenda for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()))
  with check ((pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()))
              and exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.visoes_salvas for select to authenticated using (pessoa_id = (select interno.pessoa_atual()) or compartilhada);
create policy dono_muda on public.visoes_salvas for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));

create policy master on public.automacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.automacoes_execucoes for select to authenticated using ((select interno.eh_master()));

create policy dono on public.notificacoes for select to authenticated using (pessoa_id = (select interno.pessoa_atual()));
create policy dono_marca_lida on public.notificacoes for update to authenticated
  using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));

create policy ver on public.quadros for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.quadros for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy ver on public.quadro_elementos for select to authenticated using (exists (select 1 from public.quadros q where q.no_id = quadro_id));
create policy time_muda on public.quadro_elementos for all to authenticated
  using (quadro_id in (select interno.nos_editaveis())) with check (quadro_id in (select interno.nos_editaveis()));

-- ---------- ficha técnica e etapas ----------
create policy ver on public.ficha_campos for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.ficha_campos for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy ver on public.decisoes for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.decisoes for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy master on public.segredos_catalogo for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.requisitos for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.requisitos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.etapas_modelo for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.etapas_modelo for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.etapas_modelo_itens for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.etapas_modelo_itens for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
-- cumprir e dispensar passam pelas rotinas cumprir_etapa e dispensar_etapa; o Master ajusta modo e prova direto
create policy ver on public.etapas_nos for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy master_muda on public.etapas_nos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.provas for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy master_muda on public.provas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- comercial e custos: só o Master (o time vê o catálogo, sem preços) ----------
create policy ver on public.servicos for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.servicos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.servicos_requisitos for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.servicos_requisitos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
do $$
declare t text;
begin
  foreach t in array array['servicos_cobranca','regras_calculo','pessoas_custos','cambio','custos_operacao',
                           'custos_tecnicos','custos_uso','receitas'] loop
    execute format('create policy master on public.%I for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()))', t);
  end loop;
end $$;

-- ---------- service desk ----------
create policy ver on public.slas for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.slas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.pedidos for select to authenticated using (
  autor_id = (select interno.pessoa_atual()) or (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis())));
create policy cria on public.pedidos for insert to authenticated with check (
  autor_id = (select interno.pessoa_atual()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.pedidos for update to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

create policy ver on public.pedidos_mensagens for select to authenticated using (exists (select 1 from public.pedidos p where p.id = pedido_id));
create policy cria on public.pedidos_mensagens for insert to authenticated with check (
  pessoa_id = (select interno.pessoa_atual())
  and autor_tipo = case when (select interno.eh_stakeholder()) then 'cliente' else 'equipe' end
  and exists (select 1 from public.pedidos p where p.id = pedido_id));


-- ---------- anexos: vale a visibilidade de onde o anexo está ----------
create or replace function interno.anexo_visivel(a public.anexos) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when a.no_id is not null then not interno.eh_stakeholder() and a.no_id in (select interno.nos_visiveis())
    when a.item_id is not null then exists (select 1 from public.itens i where i.id = a.item_id)
    when a.comentario_id is not null then exists (select 1 from public.comentarios c where c.id = a.comentario_id)
    when a.pedido_id is not null then exists (select 1 from public.pedidos p where p.id = a.pedido_id)
    when a.mensagem_id is not null then exists (select 1 from public.pedidos_mensagens m where m.id = a.mensagem_id)
    when a.prova_id is not null then exists (select 1 from public.provas pr where pr.id = a.prova_id)
    when a.decisao_id is not null then exists (select 1 from public.decisoes d where d.id = a.decisao_id)
    else false end
$$;
create policy ver on public.anexos for select to authenticated using (interno.anexo_visivel(anexos));
create policy cria on public.anexos for insert to authenticated with check (enviado_por = (select interno.pessoa_atual()) and interno.anexo_visivel(anexos));
create policy dono_apaga on public.anexos for delete to authenticated using (enviado_por = (select interno.pessoa_atual()) or (select interno.eh_master()));

-- ---------- desempenho: uma regra só por operação ----------
-- Onde a tabela tem uma regra "ver" (leitura) e outra regra de mudança escrita "para tudo", a leitura avaliaria as duas.
-- Aqui a regra de mudança vira três (incluir, alterar, apagar), com as mesmas condições, e a leitura fica só com a "ver".
do $$
declare p record; cond text; conf text;
begin
  for p in
    select a.tablename, a.policyname, a.qual, a.with_check
      from pg_policies a
     where a.schemaname = 'public' and a.cmd = 'ALL'
       and exists (select 1 from pg_policies b where b.schemaname = 'public' and b.tablename = a.tablename and b.cmd = 'SELECT')
  loop
    cond := p.qual; conf := coalesce(p.with_check, p.qual);
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p.policyname || '_inclui', p.tablename, conf);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p.policyname || '_altera', p.tablename, cond, conf);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', p.policyname || '_apaga', p.tablename, cond);
  end loop;
end $$;

-- =====================================================================
-- GRANT explícito (RLS filtra linhas; GRANT libera a operação. Sem os dois, a tela quebra)
-- =====================================================================
revoke all on all tables in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated, service_role;

-- as views do BI respeitam a RLS de quem consulta
do $$
declare v text;
begin
  for v in select viewname from pg_views where schemaname = 'bi' loop
    execute format('alter view bi.%I set (security_invoker = true)', v);
  end loop;
end $$;
revoke all on all tables in schema bi from public, anon, authenticated;
grant select on all tables in schema bi to service_role;
revoke all on all tables in schema auditoria from public, anon, authenticated;

-- funções: ninguém executa por padrão; libera só o que a tela e as regras usam
revoke execute on all functions in schema public, interno, bi, auditoria from public, anon;
grant execute on function interno.pessoa_atual(), interno.eh_master(), interno.eh_stakeholder(),
                          interno.nos_visiveis(), interno.nos_editaveis(), interno.anexo_visivel(public.anexos) to authenticated;
grant execute on function bi.painel(uuid), bi.financeiro(uuid), bi.calcular_preco(numeric, text, text), bi.ficha_do_no(uuid),
                          bi.carga(date, date), bi.queima_sprint(uuid), bi.mudancas_recentes(uuid, int),
                          bi.hoje(), bi.mes_atual() to authenticated;
grant execute on function public.mover_no(uuid, uuid), public.trocar_foco(uuid), public.parar_foco(),
                          public.iniciar_cronometro(uuid), public.parar_cronometro(), public.converter_pedido(uuid, uuid, text),
                          public.cumprir_etapa(uuid, uuid, text, text), public.dispensar_etapa(uuid, uuid, text),
                          public.painel(uuid), public.financeiro(uuid), public.calcular_preco(numeric, text, text),
                          public.ficha(uuid), public.carga(date, date), public.queima_sprint(uuid), public.vincular_meu_login() to authenticated;
-- o miolo das rotinas da tela (as cascas da API chamam estas)
grant execute on function interno.mover_no(uuid, uuid), interno.trocar_foco(uuid), interno.parar_foco(),
                          interno.iniciar_cronometro(uuid), interno.parar_cronometro(), interno.converter_pedido(uuid, uuid, text),
                          interno.cumprir_etapa(uuid, uuid, text, text), interno.dispensar_etapa(uuid, uuid, text),
                          interno.vincular_meu_login() to authenticated;
grant execute on all functions in schema public, interno, bi, auditoria to service_role;

-- o Supabase dá permissão automática para anon em tudo que nasce no schema public. Aqui isso é desligado para o futuro:
-- tabela ou função nova só fica acessível quando alguém der o GRANT de propósito.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- >>>>>>>>>> 08_semente.sql
-- =====================================================================
-- CicloDev · 08 · Semente: os dados de exemplo que o sistema já mostra (gerado por gerar_semente.py)
-- Pode rodar de novo: nada duplica. As datas relativas foram calculadas em 2026-09-28.
-- =====================================================================
begin;
-- a semente não entra no registro de auditoria (o histórico de exemplo é carregado no fim)
alter table public.nos disable trigger nos_auditoria;
alter table public.itens disable trigger itens_auditoria;
alter table public.itens disable trigger itens_automacoes;
alter table public.comentarios disable trigger comentarios_auditoria;
alter table public.pedidos disable trigger pedidos_auditoria;
alter table public.custos_tecnicos disable trigger custos_tecnicos_auditoria;
alter table public.receitas disable trigger receitas_auditoria;
alter table public.regras_calculo disable trigger regras_calculo_auditoria;
alter table public.pessoas_custos disable trigger pessoas_custos_auditoria;
alter table public.servicos disable trigger servicos_auditoria;
alter table public.marcos disable trigger marcos_auditoria;
alter table public.sprints disable trigger sprints_auditoria;
alter table public.automacoes disable trigger automacoes_auditoria;

insert into public.pessoas (id, nome, funcao, habilidades, capacidade_h, papel) values
  ('d148fdc5-eef3-5398-bf89-f49b55b5cd28', 'William', 'Master · Owner', array['Produto','Arquitetura','Java']::text[], 40, 'master'),
  ('b5510531-2c75-59fb-b2c1-006a90d0775f', 'Ana (exemplo)', 'Dev', array['Java','JavaFX','Supabase']::text[], 40, 'dev'),
  ('29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'Bruno (exemplo)', 'Dev', array['Flutter','APIs','QA']::text[], 30, 'dev'),
  ('2246aac4-fcc9-5564-af95-054b9cc42889', 'CEO da B&L (exemplo)', 'Stakeholder', '{}'::text[], 0, 'stakeholder')
on conflict (id) do nothing;

insert into public.nos (id, tipo, pai_id, nome, status, motivo_pausa, ordem) values
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'cliente', null, 'Blanco & Lisboa', 'ativo', null, 0),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'projeto', 'a615f8ab-48db-550e-bbe7-f11524ae2669', 'BL', 'ativo', null, 0),
  ('c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Blanco & Lisboa', 'ativo', null, 0),
  ('70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'YOU Contabilidade', 'ativo', null, 1),
  ('d7a972f1-13d0-562c-a612-018dd01688de', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Realizze', 'ativo', null, 2),
  ('4a599062-267a-58ea-999c-8ae3c67c2519', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'BEEC', 'pausado', 'Aguardando definição do escopo de tráfego pago', 3),
  ('554bf641-779b-5731-8e63-08e275e9b8ef', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Gestão de Lojas', 'ativo', null, 4),
  ('4f3b7efc-e53e-5260-b5ee-fdf6e3a92da3', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Cobrança 40%', 'ativo', null, 5),
  ('3991414f-b7a6-5abf-a62e-064efa9a9adf', 'aplicacao', 'c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'Java BL', 'ativo', null, 0),
  ('38ff5917-3d08-5887-ba5f-57a82861493f', 'aplicacao', 'c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'App celular do CEO', 'ativo', null, 1),
  ('d23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Fiscal', 'ativo', null, 2),
  ('3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Financeiro', 'ativo', null, 3),
  ('3435d48c-e3bc-5887-a742-b1500492faf0', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Pessoal', 'ativo', null, 4),
  ('b3e427e0-9332-567b-8915-a2363b97dc03', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Societário', 'ativo', null, 5),
  ('c37cc0c0-2eec-59e2-bebf-989417c684ee', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'App Área do Cliente', 'ativo', null, 6),
  ('28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'aplicacao', 'd7a972f1-13d0-562c-a612-018dd01688de', 'Java Realizze', 'ativo', null, 7),
  ('e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'aplicacao', '4a599062-267a-58ea-999c-8ae3c67c2519', 'Java BEEC', 'pausado', 'Pausado junto com o produto BEEC', 8),
  ('755ed714-e550-5cb4-a418-a437bda3ba4d', 'aplicacao', '554bf641-779b-5731-8e63-08e275e9b8ef', 'Java Gestão de Lojas', 'ativo', null, 9),
  ('3894255a-60fd-5aef-aea7-10dc60f62d87', 'aplicacao', '4f3b7efc-e53e-5260-b5ee-fdf6e3a92da3', 'Java Cobrança 40%', 'ativo', null, 10),
  ('27ed01ff-b4ea-5354-aaa2-c34d711304d0', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Frontend', 'ativo', null, 0),
  ('a1683a67-a153-5423-94a5-791ae7b85df9', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Backend', 'ativo', null, 1),
  ('00d6a88c-4baf-50e4-a0b7-72c2e36a21af', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Database', 'ativo', null, 2),
  ('127109a4-0854-5e51-af3d-3864af4a1b0d', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'AI', 'ativo', null, 3),
  ('71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', 'frente', '38ff5917-3d08-5887-ba5f-57a82861493f', 'Frontend', 'ativo', null, 4),
  ('f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', 'frente', '38ff5917-3d08-5887-ba5f-57a82861493f', 'Backend', 'ativo', null, 5),
  ('6c7a5b20-1287-516f-977b-6b3bb8710fc6', 'frente', '38ff5917-3d08-5887-ba5f-57a82861493f', 'Database', 'ativo', null, 6),
  ('68118257-a8c5-5852-a1b0-c0192c4e705f', 'frente', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Frontend', 'ativo', null, 7),
  ('0b5048b2-af47-59de-8fd1-8bc8bf2c8470', 'frente', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Backend', 'ativo', null, 8),
  ('5ab3fbab-102b-57f7-a47c-8f5ac0beb539', 'frente', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Database', 'ativo', null, 9),
  ('3cb585a7-ec87-5719-aabf-7022b23dc2c2', 'frente', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Frontend', 'ativo', null, 10),
  ('c63be23e-3cfb-552e-86ae-dadb7d703e31', 'frente', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Backend', 'ativo', null, 11),
  ('f8334e5a-01f7-5bf9-8791-ba6af14d553f', 'frente', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Database', 'ativo', null, 12),
  ('31b004d0-22b5-5593-be68-960f2e3d4560', 'frente', '3435d48c-e3bc-5887-a742-b1500492faf0', 'Frontend', 'ativo', null, 13),
  ('9de59366-98dd-54bc-b1fc-7f54725a318b', 'frente', '3435d48c-e3bc-5887-a742-b1500492faf0', 'Backend', 'ativo', null, 14),
  ('4ca8f123-6951-554a-a513-5eb7f1c680c2', 'frente', '3435d48c-e3bc-5887-a742-b1500492faf0', 'Database', 'ativo', null, 15),
  ('b5d98785-0784-5d52-8e41-a4a8ee065f98', 'frente', 'b3e427e0-9332-567b-8915-a2363b97dc03', 'Frontend', 'ativo', null, 16),
  ('ce5e204e-18a7-54ba-bf94-6dd9581e94e6', 'frente', 'b3e427e0-9332-567b-8915-a2363b97dc03', 'Backend', 'ativo', null, 17),
  ('69aa1e69-cff6-507a-b2fb-99de444826e6', 'frente', 'b3e427e0-9332-567b-8915-a2363b97dc03', 'Database', 'ativo', null, 18),
  ('22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', 'frente', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Frontend', 'ativo', null, 19),
  ('7b6911f0-12de-5ea1-9304-f811fb404c42', 'frente', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Backend', 'ativo', null, 20),
  ('8af0d9e4-9993-5bb4-83cc-2c1429054f96', 'frente', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Database', 'ativo', null, 21),
  ('072b1896-e400-5d6d-9d2f-6bd0bc25a70e', 'frente', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Frontend', 'ativo', null, 22),
  ('ef73d1da-63a0-5595-ae39-e5c65377918f', 'frente', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Backend', 'ativo', null, 23),
  ('a39cba16-716f-556d-838a-aef2dc1b314e', 'frente', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Database', 'ativo', null, 24),
  ('23362b3e-9566-5331-9496-6d7f6dea9339', 'frente', 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'Frontend', 'ativo', null, 25),
  ('7dad40b2-07a5-57df-b9c8-23a422d3ea36', 'frente', 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'Backend', 'ativo', null, 26),
  ('b1af5ab4-31f0-5c29-86dc-0b466c90282b', 'frente', 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'Database', 'ativo', null, 27),
  ('151159e9-006b-54c2-92c6-71ac19303628', 'frente', '755ed714-e550-5cb4-a418-a437bda3ba4d', 'Frontend', 'ativo', null, 28),
  ('3b0fdf80-1f60-5ada-a666-1c9bf9bff667', 'frente', '755ed714-e550-5cb4-a418-a437bda3ba4d', 'Backend', 'ativo', null, 29),
  ('0d5599d5-0ffc-5ea6-a763-bd51d6309ffa', 'frente', '755ed714-e550-5cb4-a418-a437bda3ba4d', 'Database', 'ativo', null, 30),
  ('5aa97a0f-6ca7-5ad4-9fa9-783fdd9ff6d6', 'frente', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Frontend', 'ativo', null, 31),
  ('a747a148-99f3-5f75-90d0-9d82e260970d', 'frente', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Backend', 'ativo', null, 32),
  ('98059cc2-df97-5ea7-a2df-1bfdcebbc4c8', 'frente', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Database', 'ativo', null, 33)
on conflict (id) do nothing;

insert into public.clientes (no_id, tipo_cliente, documento, holding_id) values
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'holding', null, null)
on conflict (no_id) do nothing;

insert into public.projetos (no_id, origem, inicio, alvo) values
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'brownfield', '2026-07-13', '2027-02-23')
on conflict (no_id) do nothing;

insert into public.aplicacoes (no_id, plataforma, origem_codigo, servico_id) values
  ('3991414f-b7a6-5abf-a62e-064efa9a9adf', 'desktop', 'proprio', null),
  ('38ff5917-3d08-5887-ba5f-57a82861493f', 'mobile', 'proprio', null),
  ('d23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'desktop', 'proprio', null),
  ('3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'desktop', 'proprio', null),
  ('3435d48c-e3bc-5887-a742-b1500492faf0', 'desktop', 'proprio', null),
  ('b3e427e0-9332-567b-8915-a2363b97dc03', 'desktop', 'proprio', null),
  ('c37cc0c0-2eec-59e2-bebf-989417c684ee', 'mobile', 'proprio', null),
  ('28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'desktop', 'proprio', null),
  ('e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'desktop', 'proprio', null),
  ('755ed714-e550-5cb4-a418-a437bda3ba4d', 'desktop', 'proprio', null),
  ('3894255a-60fd-5aef-aea7-10dc60f62d87', 'desktop', 'proprio', null)
on conflict (no_id) do nothing;

insert into public.frentes (no_id, wip_limite) values
  ('27ed01ff-b4ea-5354-aaa2-c34d711304d0', 3),
  ('a1683a67-a153-5423-94a5-791ae7b85df9', 3),
  ('00d6a88c-4baf-50e4-a0b7-72c2e36a21af', 3),
  ('127109a4-0854-5e51-af3d-3864af4a1b0d', 3),
  ('71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', 3),
  ('f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', 3),
  ('6c7a5b20-1287-516f-977b-6b3bb8710fc6', 3),
  ('68118257-a8c5-5852-a1b0-c0192c4e705f', 3),
  ('0b5048b2-af47-59de-8fd1-8bc8bf2c8470', 3),
  ('5ab3fbab-102b-57f7-a47c-8f5ac0beb539', 3),
  ('3cb585a7-ec87-5719-aabf-7022b23dc2c2', 3),
  ('c63be23e-3cfb-552e-86ae-dadb7d703e31', 3),
  ('f8334e5a-01f7-5bf9-8791-ba6af14d553f', 3),
  ('31b004d0-22b5-5593-be68-960f2e3d4560', 3),
  ('9de59366-98dd-54bc-b1fc-7f54725a318b', 3),
  ('4ca8f123-6951-554a-a513-5eb7f1c680c2', 3),
  ('b5d98785-0784-5d52-8e41-a4a8ee065f98', 3),
  ('ce5e204e-18a7-54ba-bf94-6dd9581e94e6', 3),
  ('69aa1e69-cff6-507a-b2fb-99de444826e6', 3),
  ('22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', 3),
  ('7b6911f0-12de-5ea1-9304-f811fb404c42', 3),
  ('8af0d9e4-9993-5bb4-83cc-2c1429054f96', 3),
  ('072b1896-e400-5d6d-9d2f-6bd0bc25a70e', 3),
  ('ef73d1da-63a0-5595-ae39-e5c65377918f', 3),
  ('a39cba16-716f-556d-838a-aef2dc1b314e', 3),
  ('23362b3e-9566-5331-9496-6d7f6dea9339', 3),
  ('7dad40b2-07a5-57df-b9c8-23a422d3ea36', 3),
  ('b1af5ab4-31f0-5c29-86dc-0b466c90282b', 3),
  ('151159e9-006b-54c2-92c6-71ac19303628', 3),
  ('3b0fdf80-1f60-5ada-a666-1c9bf9bff667', 3),
  ('0d5599d5-0ffc-5ea6-a763-bd51d6309ffa', 3),
  ('5aa97a0f-6ca7-5ad4-9fa9-783fdd9ff6d6', 3),
  ('a747a148-99f3-5f75-90d0-9d82e260970d', 3),
  ('98059cc2-df97-5ea7-a2df-1bfdcebbc4c8', 3)
on conflict (no_id) do nothing;

insert into public.participacoes (pessoa_id, no_id, papel) values
  ('d148fdc5-eef3-5398-bf89-f49b55b5cd28', 'a615f8ab-48db-550e-bbe7-f11524ae2669', 'owner'),
  ('b5510531-2c75-59fb-b2c1-006a90d0775f', 'cea3db88-841f-5511-98d1-3bedcc411131', 'dev'),
  ('29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'cea3db88-841f-5511-98d1-3bedcc411131', 'dev'),
  ('2246aac4-fcc9-5564-af95-054b9cc42889', 'cea3db88-841f-5511-98d1-3bedcc411131', 'stakeholder')
on conflict (pessoa_id, no_id) do nothing;

insert into public.etiquetas (id, nome, cor, categoria, descricao) values
  ('706ed303-fc13-57b8-86f4-61ac87d97551', 'Holding', '#050506', 'Tipo', 'Empresa que controla outras empresas'),
  ('4131797f-20c3-5856-9f6f-cb45b8c09d21', 'Contabilidade', '#2E2E31', 'Segmento', null),
  ('2b7d0445-2208-54f6-bace-e12056f0fea4', 'Certificados digitais', '#2E2E31', 'Segmento', null),
  ('74de9ec6-cb08-5678-ba6b-3fd99b29a21e', 'Tráfego pago', '#2E2E31', 'Segmento', null),
  ('d9050943-a887-5b58-8334-acf5e2964741', 'Cobrança', '#2E2E31', 'Segmento', null),
  ('6ea9b15f-9ad0-5f92-a854-a5dfbc098e73', 'Varejo', '#2E2E31', 'Segmento', null),
  ('8cb84d64-4a29-5e40-ba82-3827d36e8155', 'Prioritário', '#FF0000', 'Relacionamento', 'Cliente com atenção redobrada')
on conflict (id) do nothing;

insert into public.etiquetas_nos (etiqueta_id, no_id) values
  ('706ed303-fc13-57b8-86f4-61ac87d97551', 'a615f8ab-48db-550e-bbe7-f11524ae2669'),
  ('8cb84d64-4a29-5e40-ba82-3827d36e8155', 'a615f8ab-48db-550e-bbe7-f11524ae2669'),
  ('4131797f-20c3-5856-9f6f-cb45b8c09d21', '70b80c6e-aa4f-5cd7-8663-4439f0084edf'),
  ('2b7d0445-2208-54f6-bace-e12056f0fea4', 'd7a972f1-13d0-562c-a612-018dd01688de'),
  ('74de9ec6-cb08-5678-ba6b-3fd99b29a21e', '4a599062-267a-58ea-999c-8ae3c67c2519'),
  ('6ea9b15f-9ad0-5f92-a854-a5dfbc098e73', '554bf641-779b-5731-8e63-08e275e9b8ef'),
  ('d9050943-a887-5b58-8334-acf5e2964741', '4f3b7efc-e53e-5260-b5ee-fdf6e3a92da3')
on conflict (no_id, etiqueta_id) do nothing;

insert into public.status_fluxo (id, no_id, chave, nome, explicacao, cor, grupo, ordem) values
  ('04c022f2-6169-5a25-adfe-1a43f66c093a', null, 'backlog', 'Backlog', 'na fila, ainda não planejado', '#A6A6AD', 'backlog', 0),
  ('4549c18d-0fb2-5425-9d63-62360e2c4a88', null, 'todo', 'To Do', 'a fazer', '#3355E0', 'todo', 1),
  ('c492b85a-8079-5176-a476-fac31bcc1aaa', null, 'doing', 'In Progress', 'em andamento', '#E08600', 'doing', 2),
  ('e4da0819-465a-5cd8-b70e-2c837053429e', null, 'review', 'In Review', 'em revisão', '#6D4AFF', 'review', 3),
  ('852fa09a-b876-585e-a93a-c51409240120', null, 'blocked', 'Blocked', 'bloqueado, esperando algo', '#FF0000', 'blocked', 4),
  ('c81b6d0b-de4d-53ce-85e9-d24600183909', null, 'done', 'Done', 'concluído', '#0E8A55', 'done', 5)
on conflict (id) do nothing;

insert into public.status_fluxo (id, no_id, chave, nome, explicacao, cor, grupo, ordem) values
  ('9a6959a6-14a5-5705-afeb-74f1eef5fc09', 'cea3db88-841f-5511-98d1-3bedcc411131', 'cs_cli', 'Aguardando cliente', null, '#B04A00', 'blocked', 10)
on conflict (id) do nothing;

insert into public.requisitos (id, nome, padrao, ordem) values
  ('7a57186b-a49b-5644-86e0-da0bdededc6c', 'Painel do cliente', true, 0),
  ('a6d3d6f4-c8e1-5022-a63d-348ed92caaa6', 'Botão de feedback', true, 1),
  ('17c66ec9-6227-5597-9cc3-7123b11c708f', 'Login e níveis de acesso', true, 2),
  ('e80d6409-3277-5870-82d4-99573c74aab2', 'Registro de quem fez o quê', true, 3),
  ('d2f7d9d9-6d59-592e-83c2-a113da178ebd', 'Changelog', true, 4),
  ('dc454f6c-ee34-504f-a186-7cadbbd55c1f', 'Backup e LGPD', true, 5),
  ('3e522ccb-a100-5446-a83c-8140434edad9', 'Sinal de funcionamento', true, 6)
on conflict (id) do nothing;

insert into public.servicos (id, codigo, categoria, nome, descricao, entregaveis, frentes_padrao, horas_min, horas_max, sla, checklist_inicio, ativo) values
  ('eecf79c8-6a01-5673-99c7-4d51966097a5', 'sv_site', 'Web', 'Site institucional', 'Site de apresentação da empresa, com páginas institucionais e formulário de contato.', array['Layout aprovado','Site publicado','Painel para editar textos','Configuração de domínio e SEO básico']::text[], array['Design','Frontend','SEO']::text[], 40, 120, null, array['Manual de identidade do cliente','Textos e imagens','Acesso ao domínio']::text[], true),
  ('9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', 'sv_landing', 'Web', 'Landing page', 'Página única de venda ou captação, focada em conversão.', array['Página publicada','Formulário ligado ao CRM ou planilha','Pixel e analytics']::text[], array['Design','Frontend']::text[], 16, 40, null, array['Oferta e público definidos','Identidade visual']::text[], true),
  ('4fd4e566-689b-551a-8198-81451df52331', 'sv_ecommerce', 'Web', 'E-commerce', 'Loja virtual com catálogo, carrinho e pagamento.', array['Loja publicada','Meios de pagamento','Integração com estoque']::text[], array['Design','Frontend','Backend','Integrations']::text[], 160, 480, '8 horas úteis', array['Contrato do gateway de pagamento','Catálogo de produtos']::text[], true),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'sv_sistema', 'Sistemas', 'Sistema web sob medida (ERP, CRM e outros)', 'Sistema de gestão feito para o processo do cliente.', array['Módulos combinados no escopo','Painel do cliente','Treinamento','Documentação']::text[], array['Frontend','Backend','Database','Integrations']::text[], 400, 2400, '4 horas úteis', array['Processos mapeados','Responsável do cliente definido','Acessos aos sistemas atuais']::text[], true),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'sv_desktop', 'Sistemas', 'Sistema desktop', 'Aplicativo instalado no computador, como os Javas do BL.', array['Instalador','Atualização automática','Painel do cliente']::text[], array['Frontend','Backend','Database']::text[], 200, 1200, '4 horas úteis', array['Sistema operacional dos usuários','Rede e permissões']::text[], true),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'sv_mobile', 'Sistemas', 'App mobile', 'Aplicativo de celular Android e iOS.', array['App nas lojas','Painel do cliente','Notificações']::text[], array['Design','Frontend','Backend']::text[], 240, 1400, '8 horas úteis', array['Contas de desenvolvedor Apple e Google']::text[], true),
  ('0807b44d-6f69-5089-b9f3-9b278f0e3975', 'sv_ajuste_nosso', 'Evolução', 'Manutenção e ajustes em sistema nosso', 'Correções e melhorias em sistemas feitos pela IT.IA.', array['Mudança publicada','Changelog atualizado']::text[], array['Frontend','Backend']::text[], 4, 80, '8 horas úteis', array['Pedido registrado no Service Desk']::text[], true),
  ('40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'sv_ajuste_terceiro', 'Evolução', 'Manutenção e ajustes em sistema de terceiros', 'Correções e melhorias em sistemas feitos por outra empresa.', array['Diagnóstico do código recebido','Mudança publicada','Relatório de riscos']::text[], array['Discovery','Frontend','Backend']::text[], 8, 160, '1 dia útil', array['Acesso ao código','Acesso ao banco','Documentação existente','Contrato ou termo de responsabilidade']::text[], true),
  ('d853e838-05c7-5e5e-a228-a443d7fe1883', 'sv_integracao', 'Integração e IA', 'Integrações entre sistemas', 'Ligação entre sistemas por API, webhook ou arquivo.', array['Integração no ar','Monitoramento de falhas','Documentação do contrato']::text[], array['Backend','Integrations']::text[], 24, 240, '4 horas úteis', array['Documentação da API do outro sistema','Credenciais de teste']::text[], true),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', 'sv_ia', 'Integração e IA', 'Automação e agentes de IA', 'Robôs e agentes que executam tarefas, com níveis de permissão.', array['Agente configurado','Níveis de permissão','Painel de uso e custo']::text[], array['AI','Backend','Integrations']::text[], 40, 400, '4 horas úteis', array['Processo a automatizar descrito','Dados de exemplo','Aprovação de uso de IA com dados do cliente']::text[], true),
  ('7c80a2f6-e352-5997-95a2-3f595f002ac1', 'sv_discovery', 'Consultoria', 'Discovery e diagnóstico', 'Levantamento do que existe e do que precisa, antes de construir.', array['Dossiê atual','Matriz de evidências','Proposta de solução','Estimativa']::text[], array['Discovery']::text[], 16, 80, null, array['Acesso ao código e ao banco, se houver','Pessoas para entrevistar']::text[], true),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', 'sv_suporte', 'Recorrente', 'Suporte e sustentação mensal', 'Plano mensal com horas para correções, melhorias e acompanhamento.', array['Horas do mês','Relatório mensal','Atendimento pelo Service Desk']::text[], array['Frontend','Backend']::text[], 10, 80, '4 horas úteis', array['Acesso ao Service Desk']::text[], true)
on conflict (id) do nothing;

insert into public.servicos_cobranca (id, servico_id, modelo, parametros, ordem) values
  ('b694d2ae-cae1-511c-b65b-eeed0736962a', 'eecf79c8-6a01-5673-99c7-4d51966097a5', 'fixo', '{}'::jsonb, 0),
  ('cf2526f0-54bc-5998-8924-71555e1ce7ab', 'eecf79c8-6a01-5673-99c7-4d51966097a5', 'manutencao', '{"pct": 18}'::jsonb, 1),
  ('54db7e9a-0773-5e2e-a809-ef9ee962e8ea', '9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', 'fixo', '{}'::jsonb, 0),
  ('d7c98383-51e8-5ef6-9d7d-a67282f37a0e', '9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', 'mensalidade', '{"valor": 250, "horas": 2, "excedente": 0}'::jsonb, 1),
  ('68622f71-0182-5b2d-aeee-6482de480139', '4fd4e566-689b-551a-8198-81451df52331', 'implantacao', '{}'::jsonb, 0),
  ('ea4228ea-7f0f-59e1-8d0a-1bfdab2f26c0', '4fd4e566-689b-551a-8198-81451df52331', 'mensalidade', '{"valor": 900, "horas": 6}'::jsonb, 1),
  ('8e685e9d-9c01-5d71-b710-f6f01f9c2702', '4fd4e566-689b-551a-8198-81451df52331', 'sucesso', '{"pct": 1.5, "base": "Faturamento da loja"}'::jsonb, 2),
  ('1f7b9676-e8bc-5033-9d95-4dc809c88a92', '30152efb-067c-5bff-b291-b5c079e6f771', 'marco', '{"parcelas": [30, 40, 30]}'::jsonb, 0),
  ('a0b206e0-c411-5895-9572-d635c371353f', '30152efb-067c-5bff-b291-b5c079e6f771', 'usuario', '{"valor": 39, "minimo": 10}'::jsonb, 1),
  ('744b91c4-565a-5121-a3d6-94319f7f4bf8', '30152efb-067c-5bff-b291-b5c079e6f771', 'mensalidade', '{"valor": 3500, "horas": 20, "excedente": 0}'::jsonb, 2),
  ('8728388c-2f86-54d6-9063-0e0f37b352a7', '635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'implantacao', '{}'::jsonb, 0),
  ('84d13cb2-8c49-5204-9adc-8324c63eba40', '635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'usuario', '{"valor": 59, "minimo": 5}'::jsonb, 1),
  ('2812a9a1-4f2d-5a52-8671-ed7b7b4d0cf0', '0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'marco', '{"parcelas": [40, 30, 30]}'::jsonb, 0),
  ('c29d74c5-f97b-5b89-a676-b032592d8614', '0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'mensalidade', '{"valor": 1200, "horas": 8, "excedente": 0}'::jsonb, 1),
  ('30ad3e8e-d4d9-5ba5-9085-ec9123b70920', '0807b44d-6f69-5089-b9f3-9b278f0e3975', 'hora', '{}'::jsonb, 0),
  ('9bc4613b-dfe4-596c-a258-72636f02159c', '0807b44d-6f69-5089-b9f3-9b278f0e3975', 'banco_horas', '{"horas": 20, "validade": 3}'::jsonb, 1),
  ('5b65f796-c223-5707-92eb-a1f9b585a522', '40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'fixo', '{"nome": "Diagnóstico inicial"}'::jsonb, 0),
  ('66240030-a282-525d-9766-41f9110e9a1c', '40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'hora', '{"mult": 1.2}'::jsonb, 1),
  ('aa72d0c6-a19a-537d-8a25-24f6a2d89ab5', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'fixo', '{}'::jsonb, 0),
  ('44f9db43-b366-516a-aceb-b4815caae697', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'repasse', '{"markup": 15}'::jsonb, 1),
  ('8d3365ea-5b2a-5fe6-afdd-2f11aa7a9948', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'mensalidade', '{"valor": 400, "horas": 2, "excedente": 0}'::jsonb, 2),
  ('9f65d95d-fba1-5de3-b0e2-1a69149cedcd', 'fd39b09d-10a7-5b78-ad5f-4421c498e154', 'implantacao', '{}'::jsonb, 0),
  ('9dad4366-f018-5be1-840e-f028cd78779c', 'fd39b09d-10a7-5b78-ad5f-4421c498e154', 'uso', '{"unidade": "mil chamadas", "valor": 18, "franquia": 5}'::jsonb, 1),
  ('0eaa4f37-baec-5ea2-823d-aecefda30a74', 'fd39b09d-10a7-5b78-ad5f-4421c498e154', 'valor', '{"ganho": 120000, "pct": 15}'::jsonb, 2),
  ('17a8449d-de66-5a49-9b56-cbe8e56da2db', '7c80a2f6-e352-5997-95a2-3f595f002ac1', 'fixo', '{}'::jsonb, 0),
  ('3e5768eb-c2a0-5a54-ac05-1680151c469c', '5c8891c1-11b2-5497-aae3-052fe40ccbec', 'mensalidade', '{"valor": 0, "horas": 20, "excedente": 0}'::jsonb, 0),
  ('54e4ced5-c371-5d2d-ada6-d55b1c236866', '5c8891c1-11b2-5497-aae3-052fe40ccbec', 'faixas', '{"faixas": [{"nome": "Essencial", "horas": 10, "valor": 0}, {"nome": "Profissional", "horas": 20, "valor": 0}, {"nome": "Dedicado", "horas": 80, "valor": 0}]}'::jsonb, 1)
on conflict (id) do nothing;

update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3991414f-b7a6-5abf-a62e-064efa9a9adf' and servico_id is null;
update public.aplicacoes set servico_id = '0e3962f2-5424-54b3-8a1e-550f0adfe7b5' where no_id = '38ff5917-3d08-5887-ba5f-57a82861493f' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3435d48c-e3bc-5887-a742-b1500492faf0' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = 'b3e427e0-9332-567b-8915-a2363b97dc03' and servico_id is null;
update public.aplicacoes set servico_id = '0e3962f2-5424-54b3-8a1e-550f0adfe7b5' where no_id = 'c37cc0c0-2eec-59e2-bebf-989417c684ee' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '28e89fc6-dff1-5d34-afee-da7cd76b42f4' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '755ed714-e550-5cb4-a418-a437bda3ba4d' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3894255a-60fd-5aef-aea7-10dc60f62d87' and servico_id is null;

insert into public.servicos_requisitos (servico_id, requisito_id) values
  ('eecf79c8-6a01-5673-99c7-4d51966097a5', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('eecf79c8-6a01-5673-99c7-4d51966097a5', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('4fd4e566-689b-551a-8198-81451df52331', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('4fd4e566-689b-551a-8198-81451df52331', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('4fd4e566-689b-551a-8198-81451df52331', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('4fd4e566-689b-551a-8198-81451df52331', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'a6d3d6f4-c8e1-5022-a63d-348ed92caaa6'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'a6d3d6f4-c8e1-5022-a63d-348ed92caaa6'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('0807b44d-6f69-5089-b9f3-9b278f0e3975', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('d853e838-05c7-5e5e-a228-a443d7fe1883', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('d853e838-05c7-5e5e-a228-a443d7fe1883', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', 'a6d3d6f4-c8e1-5022-a63d-348ed92caaa6'),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd')
on conflict (servico_id, requisito_id) do nothing;

insert into public.regras_calculo (vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias, decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia) values
  ('2025-01-01', 'simples', 6, 16.33, 17.5, 20, 2, 5.8, 8, 8.33, 2.78, 8.33, 3.2, 168, 65, 20, 15, 10, 18, 5.4, '{"Baixa": 0.85, "Média": 1, "Alta": 1.3, "Muito alta": 1.6}'::jsonb, '{"Normal": 1, "Prioritária": 1.15, "Urgente": 1.3}'::jsonb)
on conflict (vigente_desde) do nothing;

insert into public.pessoas_custos (id, pessoa_id, vinculo, salario, prolabore, valor_pj, beneficios, vigente_desde) values
  ('4e8b6d71-0f8c-5258-ba31-f6b560ee4067', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'socio', 0, 15000, 0, 0, '2025-01-01'),
  ('42e1f576-4a11-5f48-a6bc-6cc26186d99f', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'clt', 8500, 0, 0, 1100, '2025-01-01'),
  ('90dcc04f-474e-57d0-8af8-8617faf7d0b9', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'pj', 0, 0, 9000, 0, '2025-01-01')
on conflict (id) do nothing;

insert into public.custos_operacao (id, nome, categoria, valor, moeda, recorrencia, meses_depreciacao, inicio) values
  ('02af4638-7d5b-5075-a660-a583955a1647', 'Assinaturas de IA do time (Claude, outros)', 'Ferramentas', 600, 'BRL', 'mensal', null, '2025-01-01'),
  ('a5534c50-1bea-50fe-aa1f-68e79f95bc25', 'GitHub Team', 'Ferramentas', 12, 'USD', 'mensal', null, '2025-01-01'),
  ('93a09241-e17a-5043-922e-1beef885c1ce', 'Figma', 'Ferramentas', 45, 'USD', 'mensal', null, '2025-01-01'),
  ('99f2aa08-1039-58bc-b772-a9fd1fa93083', 'Contabilidade', 'Administrativo', 900, 'BRL', 'mensal', null, '2025-01-01'),
  ('9cfce1a1-f728-5944-8955-25474b25ec79', 'Coworking', 'Estrutura', 1800, 'BRL', 'mensal', null, '2025-01-01'),
  ('bbc69320-efc4-5d17-b673-86f9a164f652', 'Internet e telefone', 'Estrutura', 250, 'BRL', 'mensal', null, '2025-01-01'),
  ('68d6daf1-f26d-5b94-a9ac-73a4887ff0cd', 'Notebooks (depreciação em 36 meses)', 'Equipamentos', 21600, 'BRL', 'depreciacao', 36, '2025-01-01'),
  ('c0c41794-bc81-5ca8-bcfb-f9c19a60072b', 'Domínio itia.com.br', 'Estrutura', 40, 'BRL', 'anual', null, '2025-01-01')
on conflict (id) do nothing;

insert into public.custos_tecnicos (id, no_id, fornecedor, categoria, descricao, recorrencia, moeda, valor, unidade, limite, plano, proximo_plano, proximo_valor, extra_por_unidade, repasse, taxa_repasse_pct, inicio) values
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Supabase', 'Banco de dados', 'Plano Pro do banco BL', 'mensal', 'USD', 25, 'GB de banco', 8, 'Pro (8 GB inclusos)', 'Pro + disco extra', 25, 0.125, true, 15, '2025-07-05'),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Supabase', 'Armazenamento', 'Storage de arquivos (documentos dos clientes)', 'mensal', 'USD', 0, 'GB de arquivos', 100, 'Incluso no Pro (100 GB)', 'Storage adicional', null, 0.021, true, 15, '2025-07-05'),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Anthropic', 'API de IA', 'Billy: consumo da API', 'uso', 'USD', 1, 'US$ de consumo', 150, 'Limite de gasto mensal definido', 'Aumentar o limite de gasto', null, null, true, 25, '2026-01-05'),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'WhatsGW', 'Mensageria', 'WhatsApp dos departamentos', 'mensal', 'BRL', 349, 'números conectados', 10, 'Plano 10 números', 'Plano 20 números', 599, null, true, 10, '2025-01-05'),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Vercel', 'Hospedagem', 'Área do Cliente (web)', 'mensal', 'USD', 20, 'GB de tráfego', 1000, 'Pro (1 TB)', 'Pro + tráfego extra', 20, 0.15, true, 15, '2025-11-05'),
  ('7b9ddb00-f0c1-52b1-ae8c-3c0834797adf', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Conexa', 'Integração', 'Taxa da integração de cobrança', 'mensal', 'BRL', 120, null, null, null, null, null, null, false, 0, '2025-09-05'),
  ('a871b08c-3f87-558d-80e0-b5df05caca45', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Registro.br', 'Domínio', 'Domínio da Realizze', 'anual', 'BRL', 40, null, null, null, null, null, null, true, 0, '2024-03-05'),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Marketplaces', 'Integração', 'Taxa por pedido integrado', 'uso', 'BRL', 1, 'R$ de taxa', 500, 'Sem plano fixo', 'Negociar plano por volume', null, null, true, 0, '2026-05-05')
on conflict (id) do nothing;

insert into public.custos_uso (custo_id, mes, quantidade) values
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-04-01', 4.1),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-05-01', 4.43),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-06-01', 4.78),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-07-01', 5.16),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-08-01', 5.58),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-09-01', 6.02),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-04-01', 52),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-05-01', 55.64),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-06-01', 59.53),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-07-01', 63.7),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-08-01', 68.16),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-09-01', 72.93),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-04-01', 38),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-05-01', 44.84),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-06-01', 52.91),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-07-01', 62.44),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-08-01', 73.67),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-09-01', 86.93),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-04-01', 6),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-05-01', 6),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-06-01', 7),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-07-01', 7),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-08-01', 8),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-09-01', 9),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-04-01', 180),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-05-01', 201.6),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-06-01', 225.79),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-07-01', 252.89),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-08-01', 283.23),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-09-01', 317.22),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-04-01', 0),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-05-01', 0),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-06-01', 40),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-07-01', 95),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-08-01', 160),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-09-01', 240)
on conflict (custo_id, mes) do nothing;

insert into public.receitas (id, no_id, servico_id, descricao, modelo, valor, moeda, forma, parcelas, inicio, fim) values
  ('8040caee-9b00-51ea-a60e-94393dc33c22', 'cea3db88-841f-5511-98d1-3bedcc411131', '30152efb-067c-5bff-b291-b5c079e6f771', 'Projeto BL: implantação em 6 parcelas', 'marco', 180000, 'BRL', 'parcelada', 6, '2026-06-10', null),
  ('d4da586a-d3bf-51f1-b1e7-d4bcf38757fa', '3991414f-b7a6-5abf-a62e-064efa9a9adf', '5c8891c1-11b2-5497-aae3-052fe40ccbec', 'Sustentação mensal do Java BL', 'mensalidade', 6500, 'BRL', 'mensal', null, '2026-08-10', null),
  ('c29f5a21-8a91-5ea7-b2e8-f5d07fb6be46', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', '30152efb-067c-5bff-b291-b5c079e6f771', 'Javas da YOU e Área do Cliente', 'mensalidade', 4800, 'BRL', 'mensal', null, '2025-12-10', null),
  ('45d99b93-0ef4-5d8d-9d04-d17a736836a9', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'Integração com marketplaces', 'fixo', 28000, 'BRL', 'unica', null, '2026-09-16', null)
on conflict (id) do nothing;

insert into public.slas (no_id, gravidade, horas_resposta, horas_solucao) values
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'parado', 1, 8),
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'quebrada', 4, 24),
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'incomodo', 8, 72),
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'cosmetico', 24, 168)
on conflict (no_id, gravidade) do nothing;

insert into public.sprints (id, projeto_id, nome, meta, inicio, fim, status) values
  ('e6d05bf8-1f53-5dcf-8ec6-1fcc0887432c', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Ciclo 1 · Painel do CEO e Fiscal', 'Painel central do CEO no ar e filtro de competência corrigido', '2026-09-14', '2026-09-27', 'ativo')
on conflict (id) do nothing;

insert into public.marcos (id, no_id, tipo, nome, descricao, data, visivel_cliente, entregue_em) values
  ('795bbb2e-f16f-5bcd-adc6-891d2ebdee0e', 'cea3db88-841f-5511-98d1-3bedcc411131', 'marco', 'Painel do CEO no ar', 'O CEO acompanha o grupo pelo app e pelo Java BL', '2026-10-08', true, null),
  ('32ab3563-4f92-5013-882e-4f2180502b52', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'release', 'YOU v0.5', 'Fiscal com competência corrigida e Área do Cliente com login por CPF', '2026-10-26', true, null),
  ('02209c37-29cd-58fb-94d4-acfedde299ef', 'cea3db88-841f-5511-98d1-3bedcc411131', 'marco', 'Financeiro no ar', 'Conexa integrada nos Javas', '2026-11-25', true, null)
on conflict (id) do nothing;

insert into public.automacoes (id, no_id, nome, gatilho, condicao, acao, parametros, ativa, criado_por) values
  ('074ffdd1-7c41-53c8-a2d8-9854a8226144', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Bug concluído avisa quem abriu', 'status_mudou', '{"tipo": "bug", "grupo": "done"}'::jsonb, 'notificar', '{"para": "relator", "titulo": "O bug que você abriu foi resolvido"}'::jsonb, true, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('4a757b83-3a06-590c-b199-1626920faefc', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Item bloqueado sobe a prioridade', 'status_mudou', '{"grupo": "blocked"}'::jsonb, 'mudar_prioridade', '{"prioridade": "high"}'::jsonb, true, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28')
on conflict (id) do nothing;

insert into public.campos_personalizados (id, no_id, nome, tipo, opcoes, ordem) values
  ('2a870456-898f-5fce-afb8-e3ce554161e5', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Ambiente', 'lista', array['Teste','Produção']::text[], 0)
on conflict (id) do nothing;

insert into public.itens (id, frente_id, pai_id, tipo, titulo, descricao, status_id, prioridade, responsavel_id, relator_id, estimativa_h, pontos, inicio, prazo, data_prevista, visivel_cliente, sprint_id, marco_id, criado_em, iniciado_em, concluido_em) values
  ('8a3977f7-b358-541c-970b-79ea511033f7', '00d6a88c-4baf-50e4-a0b7-72c2e36a21af', null, 'epic', 'Ficha única do cliente no banco BL', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'highest', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 40, null, '2026-07-28', '2026-10-16', '2026-10-16', true, null, null, '2026-07-23T12:00:00-03:00', '2026-07-28T09:00:00-03:00', null),
  ('d8015c00-3a4a-51e0-90f7-b56e7edd6a2d', '71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', null, 'story', 'Resumo diário do grupo no celular', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'high', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-09-29', '2026-10-21', '2026-10-24', true, null, null, '2026-09-24T12:00:00-03:00', null, null),
  ('7a67550a-f4f0-5e6a-a7cd-a9dba3387090', '71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', null, 'task', 'Aprovações pendentes em um toque', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-11', '2026-11-05', '2026-11-08', false, null, null, '2026-10-06T12:00:00-03:00', null, null),
  ('2600ca8e-80f4-5573-bc0c-25d10602850e', 'f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', null, 'task', 'Notificações do CEO', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 6, null, '2026-10-01', '2026-10-14', '2026-10-17', false, null, null, '2026-09-26T12:00:00-03:00', null, null),
  ('4df9e111-74c1-52ae-b763-6f3ef1e59fad', '5ab3fbab-102b-57f7-a47c-8f5ac0beb539', null, 'task', 'Carteira de clientes do Fiscal', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-08-12', '2026-09-06', '2026-09-09', false, null, null, '2026-08-07T12:00:00-03:00', '2026-08-12T09:00:00-03:00', '2026-09-04T17:00:00-03:00'),
  ('34e36605-30c9-5eb8-a1fa-0043eb1b6c2e', '0b5048b2-af47-59de-8fd1-8bc8bf2c8470', null, 'story', 'Importar obrigações do mês', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 14, null, '2026-09-18', '2026-10-01', '2026-10-04', true, null, null, '2026-09-13T12:00:00-03:00', '2026-09-18T09:00:00-03:00', null),
  ('a1453820-697f-5834-947c-544319d7048d', '68118257-a8c5-5852-a1b0-c0192c4e705f', null, 'bug', 'Filtro por competência não respeita o mês', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'highest', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 3, null, '2026-09-23', '2026-09-25', '2026-09-25', false, null, null, '2026-09-18T12:00:00-03:00', null, null),
  ('edd71102-1084-5f62-893b-7e960fa8a290', '68118257-a8c5-5852-a1b0-c0192c4e705f', null, 'task', 'Tela de guias e vencimentos', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-09-28', '2026-10-12', '2026-10-15', false, null, null, '2026-09-23T12:00:00-03:00', null, null),
  ('0f07e627-5656-5248-a912-45778d4334ac', 'c63be23e-3cfb-552e-86ae-dadb7d703e31', null, 'story', 'Reflexo financeiro decidido pelo CEO', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'highest', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 20, null, '2026-09-14', '2026-10-06', '2026-10-06', true, null, null, '2026-09-09T12:00:00-03:00', '2026-09-14T09:00:00-03:00', null),
  ('bdb0cca2-c9ee-5385-bf36-765defb34811', 'c63be23e-3cfb-552e-86ae-dadb7d703e31', null, 'task', 'Integração com a Conexa', null, 'e4da0819-465a-5cd8-b70e-2c837053429e', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-09-08', '2026-09-26', '2026-09-29', false, null, null, '2026-09-03T12:00:00-03:00', '2026-09-08T09:00:00-03:00', null),
  ('58f2ad43-4326-5199-908c-edaf162cf37e', '3cb585a7-ec87-5719-aabf-7022b23dc2c2', null, 'task', 'Contas a receber por empresa', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-02', '2026-10-18', '2026-10-21', false, null, null, '2026-09-27T12:00:00-03:00', null, null),
  ('b6cf630e-0701-568e-9dd6-5c4ea9dff73a', '9de59366-98dd-54bc-b1fc-7f54725a318b', null, 'task', 'Folha e eventos do mês', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-10-16', '2026-11-15', '2026-11-18', false, null, null, '2026-10-11T12:00:00-03:00', null, null),
  ('ede1c23b-8e93-54f1-a51a-c2376ea8c027', 'ce5e204e-18a7-54ba-bf94-6dd9581e94e6', null, 'task', 'Processos societários e prazos', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'low', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-10-26', '2026-12-05', '2026-12-08', false, null, null, '2026-10-21T12:00:00-03:00', null, null),
  ('87d225b6-f37f-5f1f-a6b1-375ee9a5b22a', '22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', null, 'story', 'Login do cliente por CPF', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'high', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 8, null, '2026-09-20', '2026-10-04', '2026-10-07', true, null, null, '2026-09-15T12:00:00-03:00', '2026-09-20T09:00:00-03:00', null),
  ('fe4b9844-6a48-5076-8f8b-e0238f0c27d2', '22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', null, 'story', 'Envio de documentos pelo celular', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'high', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 14, null, '2026-10-05', '2026-10-24', '2026-10-27', true, null, null, '2026-09-30T12:00:00-03:00', null, null),
  ('b7258ab3-15e9-5df4-bc90-9177b229f690', '7b6911f0-12de-5ea1-9304-f811fb404c42', null, 'task', 'Botão de feedback do Kit CicloDev', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 6, null, '2026-09-30', '2026-10-10', '2026-10-13', false, null, null, '2026-09-25T12:00:00-03:00', null, null),
  ('f773d5fc-e3f6-51f7-9a3e-b89184348318', 'ef73d1da-63a0-5595-ae39-e5c65377918f', null, 'story', 'Agenda de emissão de certificados', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'medium', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-09-21', '2026-10-08', '2026-10-11', false, null, null, '2026-09-16T12:00:00-03:00', '2026-09-21T09:00:00-03:00', null),
  ('edfcb991-3fc4-53f2-906b-6368f2179447', '072b1896-e400-5d6d-9d2f-6bd0bc25a70e', null, 'task', 'Tela de validade dos certificados', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 8, null, '2026-09-01', '2026-09-14', '2026-09-17', false, null, null, '2026-08-27T12:00:00-03:00', '2026-09-01T09:00:00-03:00', '2026-09-13T17:00:00-03:00'),
  ('8e22501f-6f05-5438-a680-4ac68cd051ba', '0d5599d5-0ffc-5ea6-a763-bd51d6309ffa', null, 'task', 'Módulo de chips por loja', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-08', '2026-10-31', '2026-11-03', false, null, null, '2026-10-03T12:00:00-03:00', null, null),
  ('0abf5256-5faa-5b27-859d-b7e5c6b31ada', 'a747a148-99f3-5f75-90d0-9d82e260970d', null, 'epic', 'Integração com marketplaces', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'high', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 40, null, '2026-09-22', '2026-11-10', '2026-11-13', true, null, null, '2026-09-17T12:00:00-03:00', '2026-09-22T09:00:00-03:00', null),
  ('2eaa0315-945c-52b8-a1c8-08faffe7631b', 'a747a148-99f3-5f75-90d0-9d82e260970d', null, 'task', 'Robô de cobrança automática', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-10-03', '2026-10-26', '2026-10-29', false, null, null, '2026-09-28T12:00:00-03:00', null, null),
  ('5d590ea1-84f1-5356-a38e-e41d05ff2cd1', '5aa97a0f-6ca7-5ad4-9fa9-783fdd9ff6d6', null, 'task', 'Cobrança pelo faturamento via Pix', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-10-16', '2026-11-15', '2026-11-18', false, null, null, '2026-10-11T12:00:00-03:00', null, null),
  ('9e11825c-aed2-5d36-968d-03a62362c33c', '23362b3e-9566-5331-9496-6d7f6dea9339', null, 'task', 'Painel de campanhas', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'low', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-26', '2026-11-25', '2026-11-28', false, null, null, '2026-10-21T12:00:00-03:00', null, null),
  ('43b9faed-ad85-5c4c-b372-3cda3cb3eefa', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Tela de login do Java BL', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-04', '2026-08-08', '2026-08-11', false, null, null, '2026-07-30T12:00:00-03:00', '2026-08-04T09:00:00-03:00', '2026-08-08T17:00:00-03:00'),
  ('6a9c1fff-4415-594b-94fe-a386a7963874', 'f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', null, 'task', 'Ícones do app do CEO', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-09', '2026-08-13', '2026-08-16', false, null, null, '2026-08-04T12:00:00-03:00', '2026-08-09T09:00:00-03:00', '2026-08-13T17:00:00-03:00'),
  ('be459ca1-b812-5ab2-8b54-c01b898a5de3', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Índices da tabela de clientes', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-16', '2026-08-20', '2026-08-23', false, null, null, '2026-08-11T12:00:00-03:00', '2026-08-16T09:00:00-03:00', '2026-08-20T17:00:00-03:00'),
  ('8ab86c6f-af9c-5d51-8375-edaeedf456a0', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Contrato de eventos do cadastro', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-18', '2026-08-22', '2026-08-25', false, null, null, '2026-08-13T12:00:00-03:00', '2026-08-18T09:00:00-03:00', '2026-08-22T17:00:00-03:00'),
  ('e8e9d95c-b45a-51fd-9226-7b5a852cd1b6', '0b5048b2-af47-59de-8fd1-8bc8bf2c8470', null, 'task', 'Exportação de obrigações em PDF', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-24', '2026-08-28', '2026-08-31', false, null, null, '2026-08-19T12:00:00-03:00', '2026-08-24T09:00:00-03:00', '2026-08-28T17:00:00-03:00'),
  ('1b209a5d-135e-5d98-89b7-6efa1d43416e', '7b6911f0-12de-5ea1-9304-f811fb404c42', null, 'task', 'Tela de documentos do cliente', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-30', '2026-09-03', '2026-09-06', false, null, null, '2026-08-25T12:00:00-03:00', '2026-08-30T09:00:00-03:00', '2026-09-03T17:00:00-03:00'),
  ('cc8ffb85-2e8a-5064-bf91-40b4c1f5c960', '0b5048b2-af47-59de-8fd1-8bc8bf2c8470', null, 'task', 'Correção do fuso nos vencimentos', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-06', '2026-09-10', '2026-09-13', false, null, null, '2026-09-01T12:00:00-03:00', '2026-09-06T09:00:00-03:00', '2026-09-10T17:00:00-03:00'),
  ('4eb80240-8177-5e3a-b1d3-976cd5b90824', 'ef73d1da-63a0-5595-ae39-e5c65377918f', null, 'task', 'Aviso de certificado vencendo', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-07', '2026-09-11', '2026-09-14', false, null, null, '2026-09-02T12:00:00-03:00', '2026-09-07T09:00:00-03:00', '2026-09-11T17:00:00-03:00'),
  ('013b420d-67ff-5487-830a-47096059f9a5', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Registro de quem fez o quê', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-13', '2026-09-17', '2026-09-20', false, null, null, '2026-09-08T12:00:00-03:00', '2026-09-13T09:00:00-03:00', '2026-09-17T17:00:00-03:00'),
  ('7e034b06-b598-5e1b-a240-72a72a5a44cc', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Revisão das regras de acesso', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-14', '2026-09-18', '2026-09-21', false, null, null, '2026-09-09T12:00:00-03:00', '2026-09-14T09:00:00-03:00', '2026-09-18T17:00:00-03:00'),
  ('9b1a19c7-b6ec-5214-ab3e-ffda925fff6b', '7b6911f0-12de-5ea1-9304-f811fb404c42', null, 'task', 'Ajuste de layout da Área do Cliente', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-19', '2026-09-23', '2026-09-26', false, null, null, '2026-09-14T12:00:00-03:00', '2026-09-19T09:00:00-03:00', '2026-09-23T17:00:00-03:00'),
  ('d0c12602-067b-5fbb-93d9-1d3e9869ab5c', '27ed01ff-b4ea-5354-aaa2-c34d711304d0', null, 'story', 'Painel central do CEO', null, 'e4da0819-465a-5cd8-b70e-2c837053429e', 'high', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 14, null, '2026-09-11', '2026-09-28', '2026-10-01', true, 'e6d05bf8-1f53-5dcf-8ec6-1fcc0887432c', '795bbb2e-f16f-5bcd-adc6-891d2ebdee0e', '2026-09-06T12:00:00-03:00', '2026-09-11T09:00:00-03:00', null),
  ('a7d3df61-f110-5f3d-8863-d2075ecc8ec8', '27ed01ff-b4ea-5354-aaa2-c34d711304d0', null, 'task', 'Login e níveis de acesso', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'medium', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-08-07', '2026-08-27', '2026-08-30', false, 'e6d05bf8-1f53-5dcf-8ec6-1fcc0887432c', null, '2026-08-02T12:00:00-03:00', '2026-08-07T09:00:00-03:00', '2026-08-26T17:00:00-03:00'),
  ('7061c178-900a-5e80-a36e-080147aca0ad', '127109a4-0854-5e51-af3d-3864af4a1b0d', null, 'epic', 'Billy: ouvinte, operacional e voz', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 60, null, '2026-10-06', '2026-12-25', '2026-12-28', false, null, null, '2026-10-01T12:00:00-03:00', null, null),
  ('97feb758-c850-5aac-a658-59ca42ad853c', '127109a4-0854-5e51-af3d-3864af4a1b0d', null, 'task', 'Níveis de permissão das function calls', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-10-16', '2026-11-10', '2026-11-13', false, null, null, '2026-10-11T12:00:00-03:00', null, null),
  ('03712cfe-cd5e-54d3-821f-12efe367bf38', '00d6a88c-4baf-50e4-a0b7-72c2e36a21af', '8a3977f7-b358-541c-970b-79ea511033f7', 'task', 'Tabela de clientes com vínculo ativo e inativo', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-07-30', '2026-08-17', '2026-08-20', false, null, null, '2026-07-25T12:00:00-03:00', '2026-07-30T09:00:00-03:00', '2026-08-16T17:00:00-03:00'),
  ('177a89a3-e23d-5a1d-8c9b-8b024385d639', '00d6a88c-4baf-50e4-a0b7-72c2e36a21af', '8a3977f7-b358-541c-970b-79ea511033f7', 'task', 'Regras de acesso por empresa (RLS)', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-08-17', '2026-09-01', '2026-09-04', false, null, null, '2026-08-12T12:00:00-03:00', '2026-08-17T09:00:00-03:00', '2026-08-31T17:00:00-03:00'),
  ('0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'a1683a67-a153-5423-94a5-791ae7b85df9', '8a3977f7-b358-541c-970b-79ea511033f7', 'story', 'API de transferência de clientes para os Javas', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'highest', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-09-06', '2026-10-02', '2026-10-02', true, null, null, '2026-09-01T12:00:00-03:00', '2026-09-06T09:00:00-03:00', null),
  ('9e805ad3-d394-52a8-addf-149375c03c4c', 'a1683a67-a153-5423-94a5-791ae7b85df9', '8a3977f7-b358-541c-970b-79ea511033f7', 'task', 'Webhook de atualização de cadastro', null, '852fa09a-b876-585e-a93a-c51409240120', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 8, null, '2026-09-16', '2026-09-30', '2026-10-03', false, null, null, '2026-09-11T12:00:00-03:00', '2026-09-16T09:00:00-03:00', null)
on conflict (id) do nothing;

insert into public.itens_checklist (id, item_id, texto, feito, ordem) values
  ('0d680c50-88e4-58bd-a63c-319fc66fd579', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'Contrato da API aprovado', true, 0),
  ('e819e11d-11b8-516c-bb7c-6982b0a3f6a3', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'Autenticação por token', true, 1),
  ('61d86d7e-ec10-55ae-a153-f10d3f0ff7f7', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'Teste com duas empresas', false, 2)
on conflict (id) do nothing;

insert into public.itens_ligacoes (origem_id, destino_id, tipo) values
  ('0cd891b9-53a2-5077-b74f-f99cb4f60a77', '9e805ad3-d394-52a8-addf-149375c03c4c', 'bloqueia')
on conflict (origem_id, destino_id, tipo) do nothing;

insert into public.comentarios (id, item_id, autor_id, texto, visivel_cliente, criado_em) values
  ('6f520df9-4242-5034-ad1e-65e1c2f65782', '87d225b6-f37f-5f1f-a6b1-375ee9a5b22a', '2246aac4-fcc9-5564-af95-054b9cc42889', 'Consigo entrar só com o CPF, sem e-mail?', true, '2026-09-24T10:00:00-03:00')
on conflict (id) do nothing;

insert into public.blocos_agenda (id, item_id, pessoa_id, inicio, fim) values
  ('0aa767cb-f3e1-5499-bd9f-427b96bee199', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-26T09:00:00-03:00', '2026-09-26T11:30:00-03:00'),
  ('97d8c6dd-91cc-5653-8427-fbd1a4e0ad3c', 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-28T10:00:00-03:00', '2026-09-28T12:00:00-03:00'),
  ('e3264f25-f67e-56c7-8a12-566f7985589b', '0f07e627-5656-5248-a912-45778d4334ac', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-27T14:00:00-03:00', '2026-09-27T17:00:00-03:00')
on conflict (id) do nothing;

insert into public.ficha_campos (no_id, secao, campo, valor, personalizado) values
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Visual identity', 'Manual de identidade', 'Manual Blanco & Lisboa 2026 (versão azul) e manual YOU "New DS 01"', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Stack', 'Linguagens e versões', 'Java 21', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Stack', 'Frameworks', 'Spring Boot, JavaFX', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Stack', 'Plataformas', 'Desktop (Java), celular', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Database', 'Banco e schema', 'Supabase tfcvoszeewmpghgxztuy', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Integrations', 'Sistemas ligados', 'WhatsGW, Conexa, Gmail', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Business rules', 'Regras de negócio do cliente', 'Carteira de clientes só existe no Fiscal. CNPJ e CPF são assuntos separados.', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Custom fields', 'Holding', 'Blanco & Lisboa', true),
  ('d23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Stack', 'Plataformas', 'Desktop (Java)', false)
on conflict (no_id, secao, campo) do nothing;

insert into public.etapas_modelo (id, chave, nome, explicacao, lente, entrega, ordem) values
  ('662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'et_0', 'Intake', 'entrada e triagem do pedido', 'Triagem', null, 0),
  ('af44fe96-f85f-5815-b727-4b172fcfb729', 'et_1', 'Scoping', 'recorte do escopo', 'Supervisor · Arquitetura e mapeamento', null, 1),
  ('aba3573c-fb85-589c-b1de-180f61803c76', 'et_2', 'Discovery', 'levantamento do que existe', 'Investigação do legado · Produto', null, 2),
  ('960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'et_3', 'Design', 'desenho da solução', 'Arquiteto · Banco de dados · Segurança · Impacto', null, 3),
  ('6fb03194-df1f-5789-be31-4aa7ac30f56f', 'et_4', 'Planning', 'planejamento', 'Supervisor · Dev líder · AI PO', null, 4),
  ('ff200273-4e16-5a73-9d89-43c75d1689ae', 'et_5', 'Build', 'construção', 'Dev especialista', null, 5),
  ('3369c902-ec7f-5904-92e0-cda9650f81d8', 'et_6', 'QA & Security', 'testes e segurança', 'QA · Segurança · Auditoria técnica', null, 6),
  ('c0d39cf8-5786-50c2-aa93-2f3451130d99', 'et_7', 'Verification', 'verificação final', 'Verificador final', null, 7),
  ('69bff48e-3ff0-5197-bcfe-cd4fa56c662a', 'et_8', 'Approval', 'aprovação', 'William', null, 8),
  ('8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'et_9', 'Release', 'entrega no ar', 'Dev líder · Impacto e regressão', null, 9),
  ('2a068aec-dfe8-57e3-a4c6-92c3b51ed763', 'et_10', 'Retrospective', 'aprender com a entrega', 'Aprendizado e prevenção', null, 10)
on conflict (id) do nothing;

insert into public.etapas_modelo_itens (id, etapa_id, texto, modo, obrigatorio, prova_tipo, quem_cumpre, so_terceiros, ordem) values
  ('983be369-bc26-56fe-8afd-52ff277c0c07', '662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'Quem pediu, qual sistema e qual empresa', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('86f897a0-db25-589a-a361-90715176886c', '662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'Tipo: projeto novo, em andamento, melhoria ou incidente', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('87e188a3-bc4a-5412-9db2-2d83debf9e68', '662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'Urgência e autorização mínima para começar', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('acaff49b-da46-5980-b5cc-0c401cb03d0c', 'af44fe96-f85f-5815-b727-4b172fcfb729', 'Objetivo, perfis de usuário e critérios de aceite', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('98ac4985-3fc0-5808-a675-4169afb46d21', 'af44fe96-f85f-5815-b727-4b172fcfb729', 'Repositório, banco e ambiente confirmados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('7fcadd16-e9a7-5ce9-83ff-29f51093face', 'af44fe96-f85f-5815-b727-4b172fcfb729', 'O que fica de fora, por escrito', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('290ff705-7732-553f-b470-ef7e16be4877', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Código e banco confrontados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('ba675695-df22-5edb-8c46-cdc3bacb5dfb', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Quem usa, como usa e as jornadas de cada perfil', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('25e28a59-a8c6-55ff-bf51-449cc71f39a5', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Achados marcados como fato, inferência, hipótese ou proposta', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('6ff15df9-06ba-5297-8002-dc1fb0e33f47', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Acesso ao código, ao banco e à documentação do sistema de terceiros', 'aviso', true, 'texto', 'responsavel_etapa', true, 3),
  ('d86717d7-c7b2-55cb-a8eb-180846791ea5', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Mapa dos riscos do código feito por outra empresa', 'aviso', true, 'arquivo', 'responsavel_etapa', true, 4),
  ('50bed218-7f2e-52c3-9934-b3f3688de7c9', 'aba3573c-fb85-589c-b1de-180f61803c76', 'O que dá para aproveitar e o que precisa ser refeito', 'aviso', true, 'texto', 'responsavel_etapa', true, 5),
  ('35a8cf39-daf2-5c4d-98ed-6d6ba5b9fb21', '960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'Arquitetura, contratos de API e eventos, modelo de dados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('a8c38e31-e4eb-526e-943a-4eed4ffb5815', '960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'Regras de acesso desenhadas antes de criar', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('b5eb5781-24dd-5d34-ae40-5f932a83dceb', '960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'Quem mais é afetado e como voltar atrás', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('cf2dbff3-0b5f-5a9e-a545-f50df2ee56a5', '6fb03194-df1f-5789-be31-4aa7ac30f56f', 'Epics, stories e tasks com critério de aceite', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('20b1b428-ba1e-563c-8f17-79572786eecc', '6fb03194-df1f-5789-be31-4aa7ac30f56f', 'Estimativa e datas previstas', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('5d0ffbbf-8503-5893-b6bc-d30eae972996', '6fb03194-df1f-5789-be31-4aa7ac30f56f', 'Marcos e dependências ligados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('79932756-4a3c-57a5-9290-b1564f98c2ed', 'ff200273-4e16-5a73-9d89-43c75d1689ae', 'Mudança mínima e reversível', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('a0d0da90-9034-5756-8bd3-47ba6c04666c', 'ff200273-4e16-5a73-9d89-43c75d1689ae', 'Teste escrito antes do código, quando se aplica', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('d791b2fe-253d-553a-9a90-7dd2f8c6c981', 'ff200273-4e16-5a73-9d89-43c75d1689ae', 'Só no repositório e ambiente autorizados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('7034c9e0-967c-5f95-a23d-11e7bcadaf86', '3369c902-ec7f-5904-92e0-cda9650f81d8', 'Testes funcionais, de integração e de regressão', 'aviso', true, 'captura', 'responsavel_etapa', false, 0),
  ('962bc464-0e87-51ec-bdc9-9741f2e1b95d', '3369c902-ec7f-5904-92e0-cda9650f81d8', 'Autorização no servidor, segredos e dependências', 'aviso', true, 'captura', 'responsavel_etapa', false, 1),
  ('ac9ba9f5-eee4-5f5f-b300-be5efab6add4', '3369c902-ec7f-5904-92e0-cda9650f81d8', 'Isolamento provado com dois clientes', 'aviso', true, 'captura', 'responsavel_etapa', false, 2),
  ('cd0e946c-f4da-5685-8b12-f938dc90e7f8', 'c0d39cf8-5786-50c2-aa93-2f3451130d99', 'Build, lint e testes rodados, com a saída real', 'aviso', true, 'captura', 'responsavel_etapa', false, 0),
  ('88b7bfe0-d173-5b54-8009-6d40346193e6', 'c0d39cf8-5786-50c2-aa93-2f3451130d99', 'Checklist completo e riscos que sobram declarados', 'aviso', true, 'captura', 'responsavel_etapa', false, 1),
  ('b54003ba-0495-5c27-b323-e91f5b77d38e', 'c0d39cf8-5786-50c2-aa93-2f3451130d99', 'Requisitos obrigatórios da aplicação cumpridos', 'aviso', true, 'captura', 'responsavel_etapa', false, 2),
  ('4b9601cd-99a5-528d-8c6b-10fc6bb9f47b', '69bff48e-3ff0-5197-bcfe-cd4fa56c662a', 'Push, merge, deploy e migração só com o "sim" dele', 'aviso', true, 'aprovacao', 'responsavel_etapa', false, 0),
  ('d41a83ad-77cb-501d-9761-663abd9d323b', '69bff48e-3ff0-5197-bcfe-cd4fa56c662a', 'Decisões pendentes respondidas', 'aviso', true, 'aprovacao', 'responsavel_etapa', false, 1),
  ('d5503ce4-1472-527f-a3da-21dca21a34a4', '8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'Plano de migração com paridade e rollback', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('52a78022-9b8b-5707-8629-9d3277eaa1a4', '8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'Convivência com o sistema antigo', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('d912442e-35d5-5c6a-a607-b040fdba852b', '8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'Changelog publicado para o cliente', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('ccfda1b9-57a7-5b62-b0ff-ced860bca655', '2a068aec-dfe8-57e3-a4c6-92c3b51ed763', 'Causa do que deu errado e o controle que evita repetir', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('1d008284-dcac-5159-be49-26d003d89047', '2a068aec-dfe8-57e3-a4c6-92c3b51ed763', 'Lições gravadas na memória', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1)
on conflict (id) do nothing;

insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em, motivo_dispensa) values
  ('cea3db88-841f-5511-98d1-3bedcc411131', '983be369-bc26-56fe-8afd-52ff277c0c07', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '86f897a0-db25-589a-a361-90715176886c', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '87e188a3-bc4a-5412-9db2-2d83debf9e68', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'acaff49b-da46-5980-b5cc-0c401cb03d0c', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '98ac4985-3fc0-5808-a675-4169afb46d21', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '290ff705-7732-553f-b470-ef7e16be4877', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '7fcadd16-e9a7-5ce9-83ff-29f51093face', 'dispensado', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-12T12:00:00-03:00', 'Escopo aberto por decisão do William: o projeto cresce por produto'),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '35a8cf39-daf2-5c4d-98ed-6d6ba5b9fb21', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-06T12:00:00-03:00', null)
on conflict (no_id, item_modelo_id) do nothing;

insert into public.provas (id, no_id, item_modelo_id, tipo, valor, enviado_por) values
  ('67c6e848-f89a-5708-a213-42e693cd7e2b', 'cea3db88-841f-5511-98d1-3bedcc411131', '983be369-bc26-56fe-8afd-52ff277c0c07', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('ae810f7d-0d9e-53cf-9d18-ef0df5173f76', 'cea3db88-841f-5511-98d1-3bedcc411131', '86f897a0-db25-589a-a361-90715176886c', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('f8a62d26-cd14-53e1-bb6d-beb04607e56a', 'cea3db88-841f-5511-98d1-3bedcc411131', '87e188a3-bc4a-5412-9db2-2d83debf9e68', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('f6389416-5196-5cee-b485-5a17a2bef898', 'cea3db88-841f-5511-98d1-3bedcc411131', 'acaff49b-da46-5980-b5cc-0c401cb03d0c', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('ee4dbd32-79be-50f9-8e38-c8238a2224d6', 'cea3db88-841f-5511-98d1-3bedcc411131', '98ac4985-3fc0-5808-a675-4169afb46d21', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('453ac331-2eab-59de-a107-de8aaf28928c', 'cea3db88-841f-5511-98d1-3bedcc411131', '290ff705-7732-553f-b470-ef7e16be4877', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('fbdcd999-b027-5cf9-80b7-db220922a969', 'cea3db88-841f-5511-98d1-3bedcc411131', '35a8cf39-daf2-5c4d-98ed-6d6ba5b9fb21', 'link', 'Canvas de estruturação do BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28')
on conflict (id) do nothing;

insert into public.pedidos (id, no_id, autor_id, tipo, gravidade, status, titulo, contexto, item_id, criado_em, resolvido_em) values
  ('a7b735ee-a6a3-543c-8b82-31c4b8687986', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', '2246aac4-fcc9-5564-af95-054b9cc42889', 'bug', 'quebrada', 'aguardando_voce', 'Guias do mês anterior aparecendo no filtro de setembro', '{"resumo": "Tela: Guias e vencimentos · Versão 0.4.2 · Chrome 128 · Erro: nenhum"}'::jsonb, null, '2026-09-25T09:00:00-03:00', null),
  ('92e61f72-37c7-5606-9391-2850c2c953ef', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', '2246aac4-fcc9-5564-af95-054b9cc42889', 'duvida', 'incomodo', 'resolvido', 'Como reenviar um documento rejeitado', '{"resumo": "Tela: Documentos · Versão 0.2.0 · App Android"}'::jsonb, null, '2026-09-23T09:00:00-03:00', '2026-09-23T09:00:00-03:00'),
  ('4b6ff104-2e8d-5ae1-961d-aeccc76f2977', '38ff5917-3d08-5887-ba5f-57a82861493f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'funcionalidade', 'cosmetico', 'novo', 'Ver o faturamento consolidado das empresas no celular', '{"resumo": "Tela: Resumo diário · App iOS"}'::jsonb, null, '2026-09-26T09:00:00-03:00', null)
on conflict (id) do nothing;

insert into public.pedidos_mensagens (id, pedido_id, autor_tipo, pessoa_id, texto, criado_em) values
  ('cbbbb4fe-b0ee-5b65-850d-0348829ee774', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', 'Quando filtro setembro aparecem guias de agosto também.', '2026-09-25T09:01:00-03:00'),
  ('bc532fc8-57cc-5770-9487-7fc446d6ecda', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'ia', null, 'Entendi. Consegue me dizer se isso acontece com todos os clientes ou só com algum específico?', '2026-09-25T09:04:00-03:00'),
  ('0a90a70f-5822-5f35-a056-332b51b4bc49', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', 'Com todos. Mandei o print.', '2026-09-25T09:07:00-03:00'),
  ('3995aaa1-42c5-5ca4-9e31-71d3236350bf', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'ia', null, 'Obrigado. Reproduzi o comportamento com os dados do print: o filtro está usando a data de vencimento em vez da competência. Classifiquei como falha real e passei para a equipe.', '2026-09-25T09:10:00-03:00'),
  ('d784db51-d765-5626-b4b7-d25435f6b1cd', '92e61f72-37c7-5606-9391-2850c2c953ef', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', '(áudio transcrito) Mandei o documento errado, como faço para mandar de novo?', '2026-09-23T09:01:00-03:00'),
  ('47bbe6b2-64c1-59ef-ae85-21e4ff247125', '92e61f72-37c7-5606-9391-2850c2c953ef', 'ia', null, 'É só abrir o documento com a etiqueta Rejeitado e tocar em Reenviar. O arquivo antigo fica guardado no histórico.', '2026-09-23T09:04:00-03:00'),
  ('af77e683-b8ca-5d4e-a70a-fdca09cc704e', '92e61f72-37c7-5606-9391-2850c2c953ef', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', 'Deu certo, obrigado.', '2026-09-23T09:07:00-03:00'),
  ('dfd08714-19c8-5d47-8d68-57dbaa6d776e', '4b6ff104-2e8d-5ae1-961d-aeccc76f2977', 'cliente', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'Queria ver o faturamento de todas as empresas juntas, na primeira tela.', '2026-09-26T09:01:00-03:00'),
  ('bd38e37d-964d-5eb7-89aa-1215942eb4ac', '4b6ff104-2e8d-5ae1-961d-aeccc76f2977', 'ia', null, 'Anotado como pedido de funcionalidade nova. Quer ver o total do mês ou comparar com o mês anterior também?', '2026-09-26T09:04:00-03:00')
on conflict (id) do nothing;

insert into public.anexos (id, nome, tipo, tamanho_bytes, storage_path, url, item_id, enviado_por, pedido_id) values
  ('3c4b66dd-9607-5e5b-afec-af0224ea20c9', 'Canvas de estruturação do BL', 'link', null, null, 'https://claude.ai/artifact/GYBDTp5XrcAVbA5Z8Aqa88', 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', null),
  ('61914708-368b-5a03-b25c-7af8ff098e26', 'rascunho-painel-ceo.png', 'imagem', 184000, 'exemplo/rascunho-painel-ceo.png', null, 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', null),
  ('a92baad0-09a3-581c-a7bb-f3ae8fb0c0c8', 'print-filtro-competencia.png', 'imagem', null, 'exemplo/print-filtro-competencia.png', null, null, '2246aac4-fcc9-5564-af95-054b9cc42889', 'a7b735ee-a6a3-543c-8b82-31c4b8687986'),
  ('99a0b436-b169-506c-a7ae-112a95dcedb6', 'audio-duvida.m4a', 'audio', null, 'exemplo/audio-duvida.m4a', null, null, '2246aac4-fcc9-5564-af95-054b9cc42889', '92e61f72-37c7-5606-9391-2850c2c953ef')
on conflict (id) do nothing;

delete from auditoria.registros where tabela = 'itens' and mudancas ? 'semente';
insert into auditoria.registros (tabela, registro_id, acao, mudancas, pessoa_id, em) values
  ('itens', '9e11825c-aed2-5d36-968d-03a62362c33c', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-26T15:22:00+00:00'),
  ('itens', 'bdb0cca2-c9ee-5385-bf36-765defb34811', 'I', '{"titulo": "Integração com a Conexa", "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-26T12:41:00+00:00'),
  ('itens', '8a3977f7-b358-541c-970b-79ea511033f7', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-26T09:00:00+00:00'),
  ('itens', '58f2ad43-4326-5199-908c-edaf162cf37e', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-25T15:58:00+00:00'),
  ('itens', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'I', '{"titulo": "API de transferência de clientes para os Javas", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-25T12:17:00+00:00'),
  ('itens', '9e805ad3-d394-52a8-addf-149375c03c4c', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-24T15:34:00+00:00'),
  ('itens', 'b6cf630e-0701-568e-9dd6-5c4ea9dff73a', 'U', '{"prazo": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-24T09:15:00+00:00'),
  ('itens', '9b1a19c7-b6ec-5214-ab3e-ffda925fff6b', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-23T15:13:00+00:00'),
  ('itens', 'ede1c23b-8e93-54f1-a51a-c2376ea8c027', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-23T12:32:00+00:00'),
  ('itens', 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'U', '{"prazo": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-23T09:51:00+00:00'),
  ('itens', '87d225b6-f37f-5f1f-a6b1-375ee9a5b22a', 'I', '{"titulo": "Login do cliente por CPF", "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-22T15:49:00+00:00'),
  ('itens', '7061c178-900a-5e80-a36e-080147aca0ad', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-22T12:08:00+00:00'),
  ('itens', '97feb758-c850-5aac-a658-59ca42ad853c', 'I', '{"titulo": "Níveis de permissão das function calls", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-21T15:25:00+00:00'),
  ('itens', 'fe4b9844-6a48-5076-8f8b-e0238f0c27d2', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-21T09:06:00+00:00'),
  ('itens', 'b7258ab3-15e9-5df4-bc90-9177b229f690', 'I', '{"titulo": "Botão de feedback do Kit CicloDev", "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-20T12:23:00+00:00'),
  ('itens', 'd8015c00-3a4a-51e0-90f7-b56e7edd6a2d', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-20T09:42:00+00:00'),
  ('itens', 'f773d5fc-e3f6-51f7-9a3e-b89184348318', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-19T15:40:00+00:00'),
  ('itens', '7a67550a-f4f0-5e6a-a7cd-a9dba3387090', 'I', '{"titulo": "Aprovações pendentes em um toque", "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-19T12:59:00+00:00'),
  ('itens', '2600ca8e-80f4-5573-bc0c-25d10602850e', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-18T15:16:00+00:00'),
  ('itens', '7e034b06-b598-5e1b-a240-72a72a5a44cc', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-18T12:56:00+00:00'),
  ('itens', '8e22501f-6f05-5438-a680-4ac68cd051ba', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-17T12:14:00+00:00'),
  ('itens', '013b420d-67ff-5487-830a-47096059f9a5', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-17T09:39:00+00:00'),
  ('itens', '34e36605-30c9-5eb8-a1fa-0043eb1b6c2e', 'U', '{"prazo": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-17T09:33:00+00:00'),
  ('itens', '0abf5256-5faa-5b27-859d-b7e5c6b31ada', 'I', '{"titulo": "Integração com marketplaces", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-16T15:31:00+00:00'),
  ('itens', 'a1453820-697f-5834-947c-544319d7048d', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-16T12:50:00+00:00'),
  ('itens', 'edd71102-1084-5f62-893b-7e960fa8a290', 'I', '{"titulo": "Tela de guias e vencimentos", "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-15T15:07:00+00:00'),
  ('itens', '2eaa0315-945c-52b8-a1c8-08faffe7631b', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-15T09:48:00+00:00'),
  ('itens', '5d590ea1-84f1-5356-a38e-e41d05ff2cd1', 'I', '{"titulo": "Cobrança pelo faturamento via Pix", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-14T12:05:00+00:00'),
  ('itens', '0f07e627-5656-5248-a912-45778d4334ac', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-14T09:24:00+00:00'),
  ('itens', 'edfcb991-3fc4-53f2-906b-6368f2179447', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-13T09:57:00+00:00');

alter table public.nos enable trigger nos_auditoria;
alter table public.itens enable trigger itens_auditoria;
alter table public.itens enable trigger itens_automacoes;
alter table public.comentarios enable trigger comentarios_auditoria;
alter table public.pedidos enable trigger pedidos_auditoria;
alter table public.custos_tecnicos enable trigger custos_tecnicos_auditoria;
alter table public.receitas enable trigger receitas_auditoria;
alter table public.regras_calculo enable trigger regras_calculo_auditoria;
alter table public.pessoas_custos enable trigger pessoas_custos_auditoria;
alter table public.servicos enable trigger servicos_auditoria;
alter table public.marcos enable trigger marcos_auditoria;
alter table public.sprints enable trigger sprints_auditoria;
alter table public.automacoes enable trigger automacoes_auditoria;
commit;

select bi.atualizar();

-- >>>>>>>>>> 09_arquivos_SUPABASE.sql
-- =====================================================================
-- CicloDev · 09 · Depósito de arquivos (Supabase Storage). SÓ NO SUPABASE (o schema storage não existe no Postgres puro).
-- Bucket privado "anexos". O arquivo só abre para quem enxerga o registro de anexos que aponta para ele.
-- Caminho do arquivo: <id da pessoa no login>/<uuid>-<nome do arquivo>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)   -- até 50 MB por arquivo
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists anexos_ver on storage.objects;
drop policy if exists anexos_enviar on storage.objects;
drop policy if exists anexos_apagar on storage.objects;

-- ver: precisa existir um anexo visível (a RLS de public.anexos roda dentro do exists)
create policy anexos_ver on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and exists (select 1 from public.anexos a where a.storage_path = storage.objects.name));

-- enviar: só dentro da própria pasta
create policy anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- apagar: o dono do arquivo ou o Master
create policy anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (owner = (select auth.uid()) or (select interno.eh_master())));

-- >>>>>>>>>> 10_rotinas_agendadas_SUPABASE.sql
-- =====================================================================
-- CicloDev · 10 · Rotinas agendadas (pg_cron). SÓ NO SUPABASE.
-- Horários em UTC (Brasília = UTC − 3).
-- =====================================================================
create extension if not exists pg_cron;

-- tira os agendamentos antigos com o mesmo nome antes de criar (pode rodar de novo)
select cron.unschedule(jobid) from cron.job where jobname in ('ciclodev_bi_atualizar', 'ciclodev_prazo_vencido');

-- atualiza o ritmo semanal (visão materializada) a cada 10 minutos, sem travar a leitura
select cron.schedule('ciclodev_bi_atualizar', '*/10 * * * *', $$select bi.atualizar()$$);

-- todo dia às 08:07 de Brasília: dispara as automações de "prazo vencido"
select cron.schedule('ciclodev_prazo_vencido', '7 11 * * *', $$select interno.automacoes_prazo_vencido()$$);

-- >>>>>>>>>> 11_dominios.sql
-- =====================================================================
-- CicloDev · 11 · Cadastro de domínios (pedido do William em 28/09/2026)
-- Cada domínio, onde foi comprado, onde o DNS é administrado, vencimento, custo e os registros (subdomínios, e-mail, verificações).
-- Sem repetir informação: o custo aponta para custos_operacao (domínio da própria IT.IA) ou custos_tecnicos (domínio de cliente);
-- a empresa dona vem da árvore (no_id). Só o Master vê e muda.
-- =====================================================================

create table if not exists public.dominios (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null unique check (nome ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  no_id                 uuid references public.nos(id) on delete set null,
  registrador           text not null,
  dns_em                text,
  servidores_dns        text[] not null default '{}',
  comprado_em           date,
  vence_em              date,
  renovacao_automatica  boolean,
  custo_operacao_id     uuid references public.custos_operacao(id) on delete set null,
  custo_tecnico_id      uuid references public.custos_tecnicos(id) on delete set null,
  email_provedor        text,
  acesso_onde           text,
  observacoes           text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check (vence_em is null or comprado_em is null or vence_em >= comprado_em),
  check (num_nonnulls(custo_operacao_id, custo_tecnico_id) <= 1)
);
comment on table public.dominios is 'Domínios do grupo. no_id vazio = domínio da própria IT.IA. acesso_onde diz onde fica o acesso ao painel, nunca a senha.';
comment on column public.dominios.renovacao_automatica is 'Vazio = ainda não informado.';
create index if not exists dominios_no_idx on public.dominios (no_id) where no_id is not null;
create index if not exists dominios_vence_idx on public.dominios (vence_em) where vence_em is not null;
create index if not exists dominios_custo_op_idx on public.dominios (custo_operacao_id) where custo_operacao_id is not null;
create index if not exists dominios_custo_tec_idx on public.dominios (custo_tecnico_id) where custo_tecnico_id is not null;

create table if not exists public.dominios_registros (
  id              uuid primary key default gen_random_uuid(),
  dominio_id      uuid not null references public.dominios(id) on delete cascade,
  nome            text not null check (nome = '@' or nome ~ '^[a-z0-9_]([a-z0-9_.-]*[a-z0-9])?$'),
  tipo            text not null check (tipo in ('A','AAAA','CNAME','MX','TXT','NS','CAA','Túnel','Outro')),
  aponta_para     text not null,
  servico         text,
  para_que        text,
  aplicacao_id    uuid,
  aplicacao_tipo  text not null default 'aplicacao' check (aplicacao_tipo = 'aplicacao'),
  proxy           boolean not null default false,
  criado_em       timestamptz not null default now(),
  foreign key (aplicacao_id, aplicacao_tipo) references public.nos (id, tipo) on delete set null (aplicacao_id)
);
comment on table public.dominios_registros is 'Os registros de DNS de cada domínio: subdomínios, e-mail e verificações. nome "@" = o próprio domínio.';
create index if not exists dominios_registros_dominio_idx on public.dominios_registros (dominio_id, nome);
create index if not exists dominios_registros_app_idx on public.dominios_registros (aplicacao_id) where aplicacao_id is not null;

drop trigger if exists dominios_carimbo on public.dominios;
create trigger dominios_carimbo before update on public.dominios for each row execute function interno.carimbar_atualizacao();
drop trigger if exists dominios_auditoria on public.dominios;
create trigger dominios_auditoria after insert or update or delete on public.dominios for each row execute function auditoria.registrar();

-- situação de cada domínio (calculada na hora)
create or replace view bi.dominios_situacao with (security_invoker = true) as
select d.id, d.nome, d.vence_em, d.renovacao_automatica,
       d.vence_em - bi.hoje() as dias_para_vencer,
       case when d.vence_em is null then 'sem_data'
            when d.vence_em < bi.hoje() then 'vencido'
            when d.vence_em - bi.hoje() <= 30 then 'vence_em_30_dias'
            when d.vence_em - bi.hoje() <= 60 then 'vence_em_60_dias'
            else 'em_dia' end as situacao,
       (select count(*) from public.dominios_registros r where r.dominio_id = d.id) as registros
  from public.dominios d;

-- aviso de vencimento: todo dia, avisa os Masters 60, 30, 7, 1 e 0 dias antes
create or replace function interno.avisar_vencimento_dominios() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  insert into public.notificacoes (pessoa_id, titulo, texto)
  select p.id,
         case when d.vence_em - bi.hoje() = 0 then 'O domínio ' || d.nome || ' vence hoje'
              else 'O domínio ' || d.nome || ' vence em ' || (d.vence_em - bi.hoje()) || ' dia' || case when d.vence_em - bi.hoje() = 1 then '' else 's' end end,
         'Vencimento em ' || to_char(d.vence_em, 'DD/MM/YYYY') || ' · comprado em ' || d.registrador ||
           case when d.renovacao_automatica then ' · renovação automática ligada' else ' · confira a renovação' end
    from public.dominios d
    join public.pessoas p on p.id = coalesce((select e.dono_id from public.espacos e where e.id = d.espaco_id), p.id)
   where p.ativo and p.auth_user_id is not null
     and (d.espaco_id is not null or p.papel = 'master')   -- cada aviso vai só para o dono do espaço do domínio
     and d.vence_em - bi.hoje() in (60, 30, 7, 1, 0);
  get diagnostics n = row_count;
  return n;
end $$;

-- segurança: só o Master; ninguém sem login
alter table public.dominios enable row level security;
alter table public.dominios_registros enable row level security;
drop policy if exists master on public.dominios;
drop policy if exists master on public.dominios_registros;
create policy master on public.dominios for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.dominios_registros for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
revoke all on public.dominios, public.dominios_registros from anon, public;
grant select, insert, update, delete on public.dominios, public.dominios_registros to authenticated;
grant all on public.dominios, public.dominios_registros to service_role;
revoke all on bi.dominios_situacao from public, anon, authenticated;
grant select on bi.dominios_situacao to service_role;
revoke execute on function interno.avisar_vencimento_dominios() from public, anon, authenticated;
grant execute on function interno.avisar_vencimento_dominios() to service_role;

-- rotina diária do aviso (SÓ NO SUPABASE: precisa do pg_cron, criado na parte 10). 08:17 de Brasília.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_dominios_vencimento';
    perform cron.schedule('ciclodev_dominios_vencimento', '17 11 * * *', 'select interno.avisar_vencimento_dominios()');
  end if;
end $$;

-- >>>>>>>>>> 12_dominios_dados.sql
-- =====================================================================
-- CicloDev · 12 · Domínios já conhecidos (dados reais, conferidos no Registro.br e no Cloudflare em 28/09/2026)
-- Pode rodar de novo: nada duplica.
-- =====================================================================
insert into public.dominios (nome, no_id, registrador, dns_em, servidores_dns, comprado_em, vence_em, renovacao_automatica, email_provedor, observacoes)
values ('it-ia.tec.br', null, 'Registro.br', 'Cloudflare', array['karsyn.ns.cloudflare.com','kellen.ns.cloudflare.com'],
        '2026-09-09', '2036-09-09', null, 'Google (Gmail)', 'Domínio da própria IT.IA. Envio de e-mails do sistema pelo Resend (domínio verificado).')
on conflict (nome) do nothing;

insert into public.dominios_registros (dominio_id, nome, tipo, aponta_para, servico, para_que, proxy)
select d.id, r.nome, r.tipo, r.aponta_para, r.servico, r.para_que, r.proxy
  from public.dominios d
  cross join (values
    ('ciclodev',          'CNAME', 'cname.vercel-dns.com',            'Vercel',            'CicloDev (ciclodev.it-ia.tec.br)',          false),
    ('system',            'CNAME', 'cname.vercel-dns.com',            'Vercel',            'Endereço antigo do CicloDev: leva para ciclodev.it-ia.tec.br', false),
    ('conversor',         'Túnel', 'conversor-billy',                 'Cloudflare Tunnel', 'Conversor do Billy',                             true),
    ('@',                 'MX',    'smtp.google.com',                 'Google',            'Receber e-mails do domínio',                     false),
    ('@',                 'TXT',   'v=spf1 include:_spf.google.com ~all', 'Google',        'SPF: quem pode enviar e-mail pelo domínio',      false),
    ('_dmarc',            'TXT',   'v=DMARC1; p=reject;',             'E-mail',            'DMARC: recusar e-mail falso com o domínio',      false),
    ('@',                 'TXT',   'google-site-verification (valor no Cloudflare)', 'Google', 'Prova de que o domínio é nosso para o Google', false),
    ('resend._domainkey', 'TXT',   'chave DKIM do Resend (valor no Cloudflare)', 'Resend',  'Assinatura dos e-mails enviados pelo Resend',     false),
    ('send',              'CNAME', 'send.forge.rmta.net',             'Resend',            'Envio de e-mails pelo Resend',                   false),
    ('rsend',             'CNAME', 'rsend.forge.rmta.net',            'Resend',            'Envio de e-mails pelo Resend',                   false)
  ) as r(nome, tipo, aponta_para, servico, para_que, proxy)
 where d.nome = 'it-ia.tec.br'
   and not exists (select 1 from public.dominios_registros x where x.dominio_id = d.id and x.nome = r.nome and x.tipo = r.tipo and x.aponta_para = r.aponta_para);

-- >>>>>>>>>> 13_ficha_cliente.sql
-- =====================================================================
-- CicloDev · 13 · Ficha cadastral completa do cliente (pedido do William em 28/09/2026)
-- O CNPJ ou CPF continua em clientes.documento. Os campos novos são todos opcionais.
-- As regras de acesso de clientes já valem para eles (só o Master muda; quem vê o cliente vê a ficha).
-- =====================================================================
alter table public.clientes
  add column if not exists razao_social        text,
  add column if not exists nome_fantasia       text,
  add column if not exists inscricao_estadual  text,
  add column if not exists inscricao_municipal text,
  add column if not exists data_abertura       date,
  add column if not exists natureza_juridica   text,
  add column if not exists porte               text,
  add column if not exists regime_tributario   text check (regime_tributario is null or regime_tributario in ('simples','mei','presumido','real','isento','outro')),
  add column if not exists cnae_principal      text,
  add column if not exists situacao_cadastral  text,
  add column if not exists cep                 text,
  add column if not exists logradouro          text,
  add column if not exists numero              text,
  add column if not exists complemento         text,
  add column if not exists bairro              text,
  add column if not exists cidade              text,
  add column if not exists uf                  text check (uf is null or uf ~ '^[A-Z]{2}$'),
  add column if not exists email               text,
  add column if not exists telefone            text,
  add column if not exists site                text,
  add column if not exists contato_nome        text,
  add column if not exists contato_cargo       text,
  add column if not exists contato_email       text,
  add column if not exists contato_telefone    text,
  add column if not exists observacoes         text;
comment on column public.clientes.documento is 'CNPJ (empresa ou holding) ou CPF (pessoa), só os números ou com pontuação.';

-- >>>>>>>>>> 14_board_equipes_integracoes.sql
-- =====================================================================
-- CicloDev · 14 · Board no formato Jira e Trello, equipes e integrações (pedido do William em 28/09/2026)
-- Regra: nada repetido. Um item é um item, venha do Jira (issue), do Trello (card) ou daqui.
-- Ver docs/INTEGRACOES-MODELO.md.
-- =====================================================================

-- ---------- chave legível dos itens (BL-123), por projeto ----------
alter table public.projetos
  add column if not exists chave_prefixo text check (chave_prefixo is null or chave_prefixo ~ '^[A-Z][A-Z0-9]{0,9}$'),
  add column if not exists chave_seq     integer not null default 0 check (chave_seq >= 0);
create unique index if not exists projetos_chave_prefixo_uq on public.projetos (chave_prefixo) where chave_prefixo is not null;

-- ---------- itens: o que o Jira e o Trello têm e ainda faltava ----------
alter table public.itens
  add column if not exists chave          text,
  add column if not exists sinalizado_em  timestamptz,
  add column if not exists motivo_sinal   text,
  add column if not exists resolucao      text check (resolucao is null or resolucao in ('feito','nao_sera_feito','duplicado','nao_reproduz')),
  add column if not exists restante_h     numeric check (restante_h is null or restante_h >= 0);
create unique index if not exists itens_chave_uq on public.itens (chave) where chave is not null;
comment on column public.itens.chave is 'Chave legível como BL-123 (Jira: key; Trello: número do card). Gerada sozinha pelo projeto.';
comment on column public.itens.sinalizado_em is 'Item sinalizado com impedimento (Jira: flagged). Vazio = não sinalizado.';
comment on column public.itens.restante_h is 'Horas que faltam (Jira: remainingEstimate). As horas lançadas vêm da soma de tempo_registros.';
comment on column public.itens.ordem is 'Ordem do item no Board e no Backlog (Jira: rank; Trello: pos).';

do $$ declare c text; begin
  -- prioridade "lowest" (Jira tem 5 níveis)
  select conname into c from pg_constraint where conrelid = 'public.itens'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%prioridade%highest%';
  if c is not null then execute format('alter table public.itens drop constraint %I', c); end if;
  alter table public.itens add constraint itens_prioridade_check check (prioridade in ('highest','high','medium','low','lowest'));
  -- ligação "clona" (Jira: clones)
  select conname into c from pg_constraint where conrelid = 'public.itens_ligacoes'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%bloqueia%';
  if c is not null then execute format('alter table public.itens_ligacoes drop constraint %I', c); end if;
  alter table public.itens_ligacoes add constraint itens_ligacoes_tipo_check check (tipo in ('bloqueia','relacionado','duplica','clona'));
end $$;

-- checklist: vários checklists por card (Trello), com prazo e responsável em cada item
alter table public.itens_checklist
  add column if not exists grupo     text,
  add column if not exists prazo     date,
  add column if not exists pessoa_id uuid references public.pessoas(id) on delete set null;
create index if not exists itens_checklist_pessoa_idx on public.itens_checklist (pessoa_id) where pessoa_id is not null;

-- capa do card (Trello: idAttachmentCover)
alter table public.anexos add column if not exists capa boolean not null default false;

-- gera a chave BL-123 ao criar o item (o prefixo nasce das letras do nome do projeto, se ainda não tiver)
create or replace function interno.gerar_chave_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare proj uuid; pref text; seq int; base text; n int := 0;
begin
  if new.chave is not null then return new; end if;
  select a.ancestral_id into proj from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id
   where a.no_id = new.frente_id and x.tipo = 'projeto' limit 1;
  if proj is null then return new; end if;
  select chave_prefixo into pref from public.projetos where no_id = proj for update;
  if pref is null then
    select upper(regexp_replace(unaccent_nome, '[^A-Za-z0-9]', '', 'g')) into base
      from (select translate(nome, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc') as unaccent_nome from public.nos where id = proj) t;
    base := left(regexp_replace(coalesce(base, ''), '^[0-9]+', ''), 4);
    if base = '' then base := 'IT'; end if;
    pref := base;
    while exists (select 1 from public.projetos where chave_prefixo = pref) loop n := n + 1; pref := left(base, 3) || n; end loop;
    update public.projetos set chave_prefixo = pref where no_id = proj;
  end if;
  update public.projetos set chave_seq = chave_seq + 1 where no_id = proj returning chave_seq into seq;
  new.chave := pref || '-' || seq;
  return new;
end $$;
drop trigger if exists itens_chave on public.itens;
create trigger itens_chave before insert on public.itens for each row execute function interno.gerar_chave_item();
-- itens que já existem ganham a chave
do $$ declare r record; proj uuid; pref text; seq int; begin
  for r in select i.id, i.frente_id from public.itens i where i.chave is null order by i.criado_em loop
    update public.itens set chave = null where id = r.id; -- (a chave é dada abaixo, sem disparar o gatilho de insert)
    select a.ancestral_id into proj from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = r.frente_id and x.tipo = 'projeto' limit 1;
    continue when proj is null;
    select chave_prefixo into pref from public.projetos where no_id = proj;
    if pref is null then
      update public.projetos set chave_prefixo = coalesce(nullif(left(upper(regexp_replace((select nome from public.nos where id = proj), '[^A-Za-z0-9]', '', 'g')), 4), ''), 'IT') where no_id = proj returning chave_prefixo into pref;
    end if;
    update public.projetos set chave_seq = chave_seq + 1 where no_id = proj returning chave_seq into seq;
    update public.itens set chave = pref || '-' || seq where id = r.id;
  end loop;
end $$;

-- ---------- Board de cada nó (Jira: board; Trello: board) ----------
create table if not exists public.boards_config (
  no_id              uuid primary key references public.nos(id) on delete cascade,
  tipo               text not null default 'kanban' check (tipo in ('scrum','kanban','simples')),
  estimativa         text not null default 'pontos' check (estimativa in ('nenhuma','contagem','pontos','horas')),
  backlog            boolean not null default true,
  subtarefas_contam  boolean not null default true,
  atualizado_em      timestamptz not null default now()
);
comment on table public.boards_config is 'Como o Board de um nó funciona. Sem linha = Kanban padrão, com as colunas dos status.';

create table if not exists public.boards_colunas (
  id        uuid primary key default gen_random_uuid(),
  no_id     uuid not null references public.nos(id) on delete cascade,
  nome      text not null check (length(btrim(nome)) between 1 and 60),
  ordem     integer not null default 0,
  minimo    integer check (minimo is null or minimo >= 0),
  maximo    integer check (maximo is null or maximo > 0),
  check (minimo is null or maximo is null or maximo >= minimo)
);
create index if not exists boards_colunas_no_idx on public.boards_colunas (no_id, ordem);
comment on table public.boards_colunas is 'Colunas do Board (Jira: coluna que junta status; Trello: list). A última coluna com status é a de concluído.';

create table if not exists public.boards_colunas_status (
  coluna_id  uuid not null references public.boards_colunas(id) on delete cascade,
  status_id  uuid not null references public.status_fluxo(id) on delete cascade,
  primary key (coluna_id, status_id)
);
create index if not exists boards_colunas_status_st_idx on public.boards_colunas_status (status_id);

-- ---------- pessoas, etiquetas e reações nos itens ----------
create table if not exists public.itens_pessoas (
  item_id    uuid not null references public.itens(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  papel      text not null check (papel in ('membro','observador','voto')),
  criado_em  timestamptz not null default now(),
  primary key (item_id, pessoa_id, papel)
);
create index if not exists itens_pessoas_pessoa_idx on public.itens_pessoas (pessoa_id);
comment on table public.itens_pessoas is 'Outras pessoas do item além do responsável (Trello: membros e votos; Jira: observadores e votos).';

create table if not exists public.etiquetas_itens (
  etiqueta_id  uuid not null references public.etiquetas(id) on delete cascade,
  item_id      uuid not null references public.itens(id) on delete cascade,
  primary key (item_id, etiqueta_id)
);
create index if not exists etiquetas_itens_et_idx on public.etiquetas_itens (etiqueta_id);

create table if not exists public.comentarios_reacoes (
  comentario_id  uuid not null references public.comentarios(id) on delete cascade,
  pessoa_id      uuid not null references public.pessoas(id) on delete cascade,
  emoji          text not null check (length(emoji) between 1 and 32),
  criado_em      timestamptz not null default now(),
  primary key (comentario_id, pessoa_id, emoji)
);
create index if not exists comentarios_reacoes_pessoa_idx on public.comentarios_reacoes (pessoa_id);

-- ---------- EQUIPES: um grupo de pessoas ligado a projetos e boards ----------
create table if not exists public.equipes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(btrim(nome)) between 1 and 80),
  descricao   text,
  cor         text not null default '#2E2E31' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now(),
  constraint equipes_nome_unq unique (nome)
);
comment on table public.equipes is 'Grupo de pessoas (Trello: membros de um board ou workspace; Jira: equipe, grupo ou papel no projeto).';

create table if not exists public.equipes_membros (
  equipe_id  uuid not null references public.equipes(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  papel      text not null default 'membro' check (papel in ('lider','membro')),
  desde      timestamptz not null default now(),
  primary key (equipe_id, pessoa_id)
);
create index if not exists equipes_membros_pessoa_idx on public.equipes_membros (pessoa_id);

create table if not exists public.equipes_nos (
  equipe_id  uuid not null references public.equipes(id) on delete cascade,
  no_id      uuid not null references public.nos(id) on delete cascade,
  papel      text not null default 'dev' check (papel in ('owner','dev','stakeholder')),
  criado_em  timestamptz not null default now(),
  primary key (equipe_id, no_id)
);
create index if not exists equipes_nos_no_idx on public.equipes_nos (no_id);
comment on table public.equipes_nos is 'Equipe ligada a um ponto da estrutura: todo membro ganha o papel ali, sem cadastrar pessoa por pessoa.';

-- quem participa de onde, contando as equipes (uma fonte só para as regras de acesso)
create or replace function interno.minhas_participacoes() returns table (no_id uuid, papel text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.no_id, p.papel from public.participacoes p where p.pessoa_id = interno.pessoa_atual()
  union
  select en.no_id, en.papel from public.equipes_nos en
    join public.equipes e on e.id = en.equipe_id and e.ativa
    join public.equipes_membros m on m.equipe_id = en.equipe_id
   where m.pessoa_id = interno.pessoa_atual()
$$;
create or replace function interno.nos_visiveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where interno.eh_master()
  union
  select a.no_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
  union
  select a.ancestral_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.no_id = p.no_id
$$;
create or replace function interno.nos_editaveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where interno.eh_master()
  union
  select a.no_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
   where p.papel in ('owner','dev')
$$;

-- ---------- INTEGRAÇÕES: uma estrutura só para Jira, Trello e o que vier ----------
create table if not exists public.integracoes (
  id                 uuid primary key default gen_random_uuid(),
  provedor           text not null check (provedor in ('jira','trello','bitbucket','github')),
  nome               text not null,
  conta_externa      text,
  url_base           text,
  no_id              uuid references public.nos(id) on delete set null,
  segredo_nome       text,
  ativa              boolean not null default true,
  ultima_sincronia   timestamptz,
  criado_por         uuid references public.pessoas(id) on delete set null,
  criado_em          timestamptz not null default now(),
  check (segredo_nome is null or segredo_nome ~ '^[A-Z][A-Z0-9_]{1,80}$')
);
comment on table public.integracoes is 'Contas conectadas. O token NUNCA fica aqui: segredo_nome é só o nome do segredo guardado no cofre do Supabase (Vault).';

create table if not exists public.vinculos_externos (
  id              uuid primary key default gen_random_uuid(),
  integracao_id   uuid not null references public.integracoes(id) on delete cascade,
  tabela          text not null check (tabela in ('nos','itens','sprints','status_fluxo','boards_colunas','pessoas','equipes','comentarios','anexos','etiquetas','marcos','itens_checklist','campos_personalizados')),
  registro_id     uuid,
  id_externo      text not null,
  chave_externa   text,
  url             text,
  dados           jsonb not null default '{}'::jsonb,
  atualizado_fora timestamptz,
  criado_em       timestamptz not null default now(),
  unique (integracao_id, tabela, id_externo),
  check (registro_id is not null or tabela = 'pessoas')
);
create unique index if not exists vinculos_externos_registro_uq on public.vinculos_externos (integracao_id, tabela, registro_id) where registro_id is not null;
create index if not exists vinculos_externos_reg_idx on public.vinculos_externos (tabela, registro_id);
comment on table public.vinculos_externos is 'Liga um registro nosso ao de fora (issue, card, board, membro...). Pessoa de fora ainda sem cadastro aqui: registro_id vazio e nome em dados, aguardando o Master ligar ou criar.';

create table if not exists public.integracoes_log (
  id             bigint generated always as identity primary key,
  integracao_id  uuid references public.integracoes(id) on delete cascade,
  direcao        text not null check (direcao in ('entrada','saida')),
  evento         text not null,
  ok             boolean not null default true,
  detalhe        jsonb not null default '{}'::jsonb,
  em             timestamptz not null default now()
);
create index if not exists integracoes_log_int_idx on public.integracoes_log (integracao_id, em desc);

-- ---------- segurança ----------
alter table public.boards_config enable row level security;
alter table public.boards_colunas enable row level security;
alter table public.boards_colunas_status enable row level security;
alter table public.itens_pessoas enable row level security;
alter table public.etiquetas_itens enable row level security;
alter table public.comentarios_reacoes enable row level security;
alter table public.equipes enable row level security;
alter table public.equipes_membros enable row level security;
alter table public.equipes_nos enable row level security;
alter table public.integracoes enable row level security;
alter table public.vinculos_externos enable row level security;
alter table public.integracoes_log enable row level security;

do $$ declare t text; begin
  foreach t in array array['boards_config','boards_colunas','boards_colunas_status','itens_pessoas','etiquetas_itens','comentarios_reacoes','equipes','equipes_membros','equipes_nos','integracoes','vinculos_externos','integracoes_log'] loop
    execute format('drop policy if exists ver on public.%I', t);
    execute format('drop policy if exists muda_inclui on public.%I', t);
    execute format('drop policy if exists muda_altera on public.%I', t);
    execute format('drop policy if exists muda_apaga on public.%I', t);
    execute format('drop policy if exists master on public.%I', t);
  end loop;
end $$;
-- Board: vê quem vê o nó; muda só o Master
create policy ver on public.boards_config for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy muda_inclui on public.boards_config for insert to authenticated with check ((select interno.eh_master()));
create policy muda_altera on public.boards_config for update to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy muda_apaga on public.boards_config for delete to authenticated using ((select interno.eh_master()));
create policy ver on public.boards_colunas for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy muda_inclui on public.boards_colunas for insert to authenticated with check ((select interno.eh_master()));
create policy muda_altera on public.boards_colunas for update to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy muda_apaga on public.boards_colunas for delete to authenticated using ((select interno.eh_master()));
create policy ver on public.boards_colunas_status for select to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id));
create policy muda_inclui on public.boards_colunas_status for insert to authenticated with check ((select interno.eh_master()));
create policy muda_apaga on public.boards_colunas_status for delete to authenticated using ((select interno.eh_master()));
-- pessoas e etiquetas do item: igual ao checklist (quem trabalha no item muda)
create policy ver on public.itens_pessoas for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
create policy muda_inclui on public.itens_pessoas for insert to authenticated with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())) or (papel in ('observador','voto') and pessoa_id = (select interno.pessoa_atual()) and exists (select 1 from public.itens i where i.id = item_id)));
create policy muda_apaga on public.itens_pessoas for delete to authenticated using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())) or pessoa_id = (select interno.pessoa_atual()));
create policy ver on public.etiquetas_itens for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
create policy muda_inclui on public.etiquetas_itens for insert to authenticated with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));
create policy muda_apaga on public.etiquetas_itens for delete to authenticated using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));
-- reações: cada um mexe nas suas
create policy ver on public.comentarios_reacoes for select to authenticated using (exists (select 1 from public.comentarios c where c.id = comentario_id));
create policy muda_inclui on public.comentarios_reacoes for insert to authenticated with check (pessoa_id = (select interno.pessoa_atual()) and exists (select 1 from public.comentarios c where c.id = comentario_id));
create policy muda_apaga on public.comentarios_reacoes for delete to authenticated using (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()));
-- equipes: todos do time veem; o Master monta
create policy ver on public.equipes for select to authenticated using (not (select interno.eh_stakeholder()) or (select interno.eh_master()));
create policy muda_inclui on public.equipes for insert to authenticated with check ((select interno.eh_master()));
create policy muda_altera on public.equipes for update to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy muda_apaga on public.equipes for delete to authenticated using ((select interno.eh_master()));
create policy ver on public.equipes_membros for select to authenticated using (not (select interno.eh_stakeholder()) or pessoa_id = (select interno.pessoa_atual()));
create policy muda_inclui on public.equipes_membros for insert to authenticated with check ((select interno.eh_master()));
create policy muda_altera on public.equipes_membros for update to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy muda_apaga on public.equipes_membros for delete to authenticated using ((select interno.eh_master()));
create policy ver on public.equipes_nos for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy muda_inclui on public.equipes_nos for insert to authenticated with check ((select interno.eh_master()));
create policy muda_altera on public.equipes_nos for update to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy muda_apaga on public.equipes_nos for delete to authenticated using ((select interno.eh_master()));
-- integrações: só o Master
create policy master on public.integracoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.vinculos_externos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.integracoes_log for select to authenticated using ((select interno.eh_master()));

revoke all on public.boards_config, public.boards_colunas, public.boards_colunas_status, public.itens_pessoas, public.etiquetas_itens, public.comentarios_reacoes,
  public.equipes, public.equipes_membros, public.equipes_nos, public.integracoes, public.vinculos_externos, public.integracoes_log from anon, public;
grant select, insert, update, delete on public.boards_config, public.boards_colunas, public.equipes, public.equipes_membros, public.equipes_nos, public.integracoes, public.vinculos_externos to authenticated;
grant select, insert, delete on public.boards_colunas_status, public.itens_pessoas, public.etiquetas_itens, public.comentarios_reacoes to authenticated;
grant select on public.integracoes_log to authenticated;
grant all on public.boards_config, public.boards_colunas, public.boards_colunas_status, public.itens_pessoas, public.etiquetas_itens, public.comentarios_reacoes,
  public.equipes, public.equipes_membros, public.equipes_nos, public.integracoes, public.vinculos_externos, public.integracoes_log to service_role;
revoke execute on function interno.gerar_chave_item(), interno.minhas_participacoes() from public, anon;
grant execute on function interno.minhas_participacoes() to authenticated;

-- histórico (auditoria) das tabelas que mudam o dia a dia
do $$ declare t text; begin
  foreach t in array array['boards_config','boards_colunas','equipes','equipes_membros','equipes_nos','integracoes'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function auditoria.registrar()', t || '_auditoria', t);
  end loop;
end $$;
drop trigger if exists boards_config_carimbo on public.boards_config;
create trigger boards_config_carimbo before update on public.boards_config for each row execute function interno.carimbar_atualizacao();

-- >>>>>>>>>> 15_espacos_multiusuario.sql
-- =====================================================================
-- CicloDev · 15 · Muitos usuários: cadastro aberto, espaço próprio para cada um e compartilhamento por ponto
-- Pedido do William em 28/09/2026. Análise e decisões: docs/ARQUITETURA-MULTIUSUARIO.md
--   · um nível só de usuário (não existe mais Master, Dev ou Stakeholder como nível de conta);
--   · o cadastro cria a pessoa, o número de ID público e o espaço próprio;
--   · tudo o que a pessoa cria nasce no espaço dela (Estrutura, Catalog, Costs, Settings, Agent Studio...);
--   · compartilhar um cliente, projeto, produto, aplicação ou frente dá acesso completo a ele e a tudo o que está dentro.
-- Modelo "pool": as mesmas tabelas para todos, com espaco_id e regras por linha (RLS). Nada de tabela por usuário.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- ---------- 1. identidade: número de ID público e nome de usuário ----------
create sequence if not exists public.pessoas_numero_seq start with 100001;
alter table public.pessoas
  add column if not exists numero  bigint,
  add column if not exists usuario text;
update public.pessoas set numero = nextval('public.pessoas_numero_seq') where numero is null;
alter table public.pessoas alter column numero set default nextval('public.pessoas_numero_seq');
alter table public.pessoas alter column numero set not null;
create unique index if not exists pessoas_numero_uq on public.pessoas (numero);
create unique index if not exists pessoas_usuario_uq on public.pessoas (lower(usuario)) where usuario is not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'pessoas_usuario_formato') then
    alter table public.pessoas add constraint pessoas_usuario_formato check (usuario is null or usuario ~ '^[a-z0-9_.]{3,30}$');
  end if;
end $$;
comment on column public.pessoas.numero is 'Número de ID público da pessoa (como o @ do Trello). É o que se passa para outra pessoa compartilhar.';

-- ---------- 2. espaços de trabalho ----------
create table if not exists public.espacos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) between 1 and 120),
  dono_id    uuid references public.pessoas(id) on delete set null,
  pessoal    boolean not null default true,
  modelo     boolean not null default false,
  criado_em  timestamptz not null default now()
);
comment on table public.espacos is 'Espaço de trabalho (Trello: Workspace; Jira: site). Todo usuário ganha o seu no cadastro. modelo = espaço usado só como molde dos espaços novos.';
create unique index if not exists espacos_um_modelo on public.espacos (modelo) where modelo;

create table if not exists public.espaco_membros (
  espaco_id  uuid not null references public.espacos(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  papel      text not null default 'membro' check (papel in ('dono','membro')),
  desde      timestamptz not null default now(),
  primary key (espaco_id, pessoa_id)
);
create index if not exists espaco_membros_pessoa_idx on public.espaco_membros (pessoa_id);

-- pessoas cadastradas só para planejamento (sem login) pertencem a um espaço
alter table public.pessoas add column if not exists espaco_id uuid references public.espacos(id) on delete cascade;
create index if not exists pessoas_espaco_idx on public.pessoas (espaco_id) where espaco_id is not null;

-- espaços da pessoa atual e o espaço padrão dela (o pessoal)
create or replace function interno.meus_espacos() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.espaco_id from public.espaco_membros m where m.pessoa_id = interno.pessoa_atual()
$$;
create or replace function interno.meu_espaco() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.espaco_id from public.espaco_membros m join public.espacos e on e.id = m.espaco_id
   where m.pessoa_id = interno.pessoa_atual() order by (m.papel = 'dono') desc, e.pessoal desc, e.criado_em limit 1
$$;

-- espaço do William (dono atual de tudo o que existe) e o espaço Modelo
do $$ declare w uuid; e uuid; m uuid; begin
  select id into w from public.pessoas where auth_user_id is not null order by criado_em limit 1;
  if w is not null and not exists (select 1 from public.espaco_membros where pessoa_id = w) then
    insert into public.espacos (nome, dono_id, pessoal) values ('Espaço de ' || (select split_part(nome, ' ', 1) from public.pessoas where id = w), w, true) returning id into e;
    insert into public.espaco_membros (espaco_id, pessoa_id, papel) values (e, w, 'dono');
  end if;
  if not exists (select 1 from public.espacos where modelo) then
    insert into public.espacos (nome, pessoal, modelo) values ('Modelo dos espaços novos', false, true);
  end if;
end $$;

-- ---------- 3. espaco_id em tudo o que é do sistema da pessoa ----------
create or replace function interno.espaco_do_william() returns uuid language sql stable set search_path = public, pg_temp as $$
  select e.id from public.espacos e where e.pessoal and not e.modelo order by e.criado_em limit 1
$$;
do $$ declare t text; esp uuid := interno.espaco_do_william(); begin
  foreach t in array array['nos','servicos','requisitos','regras_calculo','etapas_modelo','custos_operacao','dominios','etiquetas','equipes','integracoes','pessoas_custos'] loop
    execute format('alter table public.%I add column if not exists espaco_id uuid references public.espacos(id) on delete cascade', t);
    if esp is not null then execute format('update public.%I set espaco_id = %L where espaco_id is null', t, esp); end if;
    execute format('alter table public.%I alter column espaco_id set default interno.meu_espaco()', t);
    execute format('create index if not exists %I on public.%I (espaco_id)', t || '_espaco_idx', t);
  end loop;
end $$;
-- anexo novo: quem enviou é quem está logado (a regra de inclusão exige isso; a tela não manda o campo)
alter table public.anexos alter column enviado_por set default interno.pessoa_atual();
-- pessoa nova sem login (planejamento) nasce no espaço de quem cria
alter table public.pessoas alter column espaco_id set default interno.meu_espaco();
-- pessoas sem login que já existem (planejamento) ficam no espaço do William
update public.pessoas set espaco_id = interno.espaco_do_william() where auth_user_id is null and espaco_id is null and interno.espaco_do_william() is not null;

-- nomes e códigos passam a ser únicos por espaço (dois usuários podem ter uma etiqueta "Urgente")
do $$ declare c record; begin
  for c in select conrelid::regclass as t, conname from pg_constraint
            where contype = 'u' and conrelid in ('public.etiquetas'::regclass,'public.requisitos'::regclass,'public.servicos'::regclass,'public.etapas_modelo'::regclass,'public.equipes'::regclass,'public.dominios'::regclass)
              and not (conkey @> array[(select attnum from pg_attribute where attrelid = conrelid and attname = 'espaco_id')])
  loop execute format('alter table %s drop constraint %I', c.t, c.conname); end loop;
end $$;
create unique index if not exists etiquetas_espaco_nome_uq on public.etiquetas (espaco_id, nome);
create unique index if not exists requisitos_espaco_nome_uq on public.requisitos (espaco_id, nome);
create unique index if not exists servicos_espaco_codigo_uq on public.servicos (espaco_id, codigo);
create unique index if not exists etapas_modelo_espaco_chave_uq on public.etapas_modelo (espaco_id, chave);
create unique index if not exists etapas_modelo_espaco_ordem_uq on public.etapas_modelo (espaco_id, ordem);
create unique index if not exists equipes_espaco_nome_uq on public.equipes (espaco_id, nome);
create unique index if not exists dominios_espaco_nome_uq on public.dominios (espaco_id, nome);
-- regras de cálculo: uma vigência por espaço
do $$ declare pk text; begin
  select conname into pk from pg_constraint where conrelid = 'public.regras_calculo'::regclass and contype = 'p';
  if pk is not null and (select array_length(conkey, 1) from pg_constraint where conname = pk and conrelid = 'public.regras_calculo'::regclass) = 1 then
    execute format('alter table public.regras_calculo drop constraint %I', pk);
    alter table public.regras_calculo add primary key (espaco_id, vigente_desde);
  end if;
end $$;
do $$ begin
  alter table public.regras_calculo alter column espaco_id set not null;
exception when others then null; end $$;

-- a Estrutura herda o espaço do pai; a raiz (cliente) nasce no espaço de quem cria
create or replace function interno.espaco_do_no() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.pai_id is not null then
    select espaco_id into new.espaco_id from public.nos where id = new.pai_id;
  elsif tg_op = 'INSERT' then
    new.espaco_id := coalesce(new.espaco_id, interno.meu_espaco());
  else
    new.espaco_id := old.espaco_id;
  end if;
  if new.espaco_id is null then raise exception 'Não foi possível saber o espaço deste ponto da estrutura' using errcode = '23502'; end if;
  if tg_op = 'INSERT' and new.criado_por is null then new.criado_por := interno.pessoa_atual(); end if;
  return new;
end $$;
drop trigger if exists nos_espaco on public.nos;
create trigger nos_espaco before insert or update of pai_id, espaco_id on public.nos for each row execute function interno.espaco_do_no();
do $$ begin alter table public.nos alter column espaco_id set not null; exception when others then null; end $$;
-- mudou o espaço de um ponto (moveu para outro cliente): tudo o que está dentro vai junto
create or replace function interno.espaco_desce() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.espaco_id is distinct from old.espaco_id then
    update public.nos n set espaco_id = new.espaco_id
      from public.nos_ancestrais a where a.ancestral_id = new.id and a.no_id = n.id and a.distancia > 0 and n.espaco_id is distinct from new.espaco_id;
  end if;
  return null;
end $$;
drop trigger if exists nos_espaco_desce on public.nos;
create trigger nos_espaco_desce after update of espaco_id, pai_id on public.nos for each row execute function interno.espaco_desce();
revoke execute on function interno.espaco_desce() from public, anon;

-- ---------- 4. compartilhar: participacoes é o compartilhamento; convites para quem ainda não tem conta ----------
alter table public.participacoes add column if not exists criado_por uuid references public.pessoas(id) on delete set null;
alter table public.participacoes alter column papel set default 'owner';
comment on table public.participacoes is 'Compartilhamento: a pessoa recebe acesso completo ao ponto e a tudo o que está dentro dele.';

create table if not exists public.convites (
  id          uuid primary key default gen_random_uuid(),
  no_id       uuid not null references public.nos(id) on delete cascade,
  email       text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  criado_por  uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  aceito_em   timestamptz,
  unique (no_id, email)
);
create index if not exists convites_email_idx on public.convites (lower(email)) where aceito_em is null;
comment on table public.convites is 'Compartilhamento com um e-mail que ainda não tem conta. Vira acesso quando a pessoa se cadastra com esse e-mail.';

-- ---------- 5. o que cada pessoa enxerga e em que pode trabalhar ----------
create or replace function interno.eh_master() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select false $$;
comment on function interno.eh_master() is 'Não existe mais nível Master (um nível só de usuário). Fica sempre falso por compatibilidade.';

-- nós com acesso de verdade: os do meu espaço e tudo o que está dentro de algo compartilhado comigo
create or replace function interno.nos_visiveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where n.espaco_id in (select interno.meus_espacos())
  union
  select a.no_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
$$;
-- nós acima de um compartilhamento: aparecem SÓ com o nome, para situar ("Cliente X › Projeto Y"). Nada do que é deles (ficha, custos, itens) fica visível.
create or replace function interno.nos_caminho() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select a.ancestral_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.no_id = p.no_id where a.distancia > 0
$$;
create or replace function interno.nos_editaveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select n.id from public.nos n where n.espaco_id in (select interno.meus_espacos())
  union
  select a.no_id from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
   where p.papel in ('owner','dev')
$$;
-- pessoas que a pessoa atual pode ver: ela, quem divide espaço, quem divide um ponto compartilhado e quem divide equipe
create or replace function interno.pessoas_visiveis() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select interno.pessoa_atual()
  union select m.pessoa_id from public.espaco_membros m where m.espaco_id in (select interno.meus_espacos())
  union select p.id from public.pessoas p where p.espaco_id in (select interno.meus_espacos())
  union select pa.pessoa_id from public.participacoes pa where pa.no_id in (select interno.nos_visiveis())
  union select m.pessoa_id from public.equipes_membros m join public.equipes e on e.id = m.equipe_id where e.espaco_id in (select interno.meus_espacos())
  union select m2.pessoa_id from public.equipes_membros m1 join public.equipes_membros m2 on m2.equipe_id = m1.equipe_id where m1.pessoa_id = interno.pessoa_atual()
  union select e.dono_id from public.espacos e join public.nos n on n.espaco_id = e.id where (n.id in (select interno.nos_visiveis()) or n.id in (select interno.nos_caminho())) and e.dono_id is not null
$$;

-- ---------- 6. cadastro: pessoa, número de ID, espaço próprio com o modelo padrão e os convites recebidos ----------
create or replace function interno.semear_espaco(p_espaco uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_modelo uuid; r record; novo uuid;
begin
  select e.id into v_modelo from public.espacos e where e.modelo limit 1;
  if v_modelo is null or v_modelo = p_espaco then return; end if;
  insert into public.requisitos (espaco_id, nome, descricao, padrao, ordem)
    select p_espaco, nome, descricao, padrao, ordem from public.requisitos where espaco_id = v_modelo on conflict do nothing;
  insert into public.regras_calculo (espaco_id, vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
      decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia)
    select p_espaco, current_date, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
      decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia
      from public.regras_calculo where espaco_id = v_modelo order by vigente_desde desc limit 1 on conflict do nothing;
  for r in select * from public.etapas_modelo where espaco_id = v_modelo order by ordem loop
    insert into public.etapas_modelo (espaco_id, chave, nome, explicacao, lente, entrega, ordem) values (p_espaco, r.chave, r.nome, r.explicacao, r.lente, r.entrega, r.ordem)
      on conflict do nothing returning id into novo;
    if novo is not null then
      insert into public.etapas_modelo_itens (etapa_id, texto, modo, obrigatorio, prova_tipo, quem_cumpre, so_terceiros, ordem)
        select novo, texto, modo, obrigatorio, prova_tipo, case when quem_cumpre = 'pessoa_definida' then 'qualquer_um' else quem_cumpre end, so_terceiros, ordem
          from public.etapas_modelo_itens where etapa_id = r.id;
    end if;
  end loop;
end $$;

create or replace function interno.receber_convites(p_pessoa uuid, p_email text) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into public.participacoes (pessoa_id, no_id, papel, criado_por)
    select p_pessoa, c.no_id, 'owner', c.criado_por from public.convites c where lower(c.email) = lower(p_email) and c.aceito_em is null
    on conflict (pessoa_id, no_id) do nothing;
  update public.convites set aceito_em = now() where lower(email) = lower(p_email) and aceito_em is null;
$$;

-- dados pessoais do cadastro (LGPD): numa tabela só do dono. Quem recebe um compartilhamento vê só nome, ID e @usuário.
create or replace function interno.cpf_valido(p text) returns boolean
language plpgsql immutable set search_path = pg_temp as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; k int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for k in 1..9 loop s := s + substr(d, k, 1)::int * (11 - k); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if; if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for k in 1..10 loop s := s + substr(d, k, 1)::int * (12 - k); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if; return r = substr(d, 11, 1)::int;
end $$;
create table if not exists public.pessoas_privado (
  pessoa_id          uuid primary key references public.pessoas(id) on delete cascade,
  nome_completo      text check (nome_completo is null or length(btrim(nome_completo)) between 3 and 160),
  data_nascimento    date check (data_nascimento is null or (data_nascimento > date '1900-01-01' and data_nascimento <= current_date)),
  cpf                text check (cpf is null or (cpf ~ '^\d{11}$' and interno.cpf_valido(cpf))),
  cep                text check (cep is null or cep ~ '^\d{8}$'),
  logradouro         text, numero text, complemento text, bairro text, cidade text,
  uf                 text check (uf is null or uf ~ '^[A-Z]{2}$'),
  uso                text check (uso is null or uso in ('trabalho','estudo','pessoal','outro')),
  cargo              text, empresa text,
  termos_aceitos_em  timestamptz,
  atualizado_em      timestamptz not null default now()
);
create unique index if not exists pessoas_privado_cpf_uq on public.pessoas_privado (cpf) where cpf is not null;
comment on table public.pessoas_privado is 'Dados pessoais do cadastro (LGPD). Só a própria pessoa vê e muda. Nunca aparecem para quem compartilha com ela.';
alter table public.pessoas_privado enable row level security;
drop policy if exists ver on public.pessoas_privado; drop policy if exists muda on public.pessoas_privado; drop policy if exists cria on public.pessoas_privado;
create policy ver on public.pessoas_privado for select to authenticated using (pessoa_id = (select interno.pessoa_atual()));
create policy cria on public.pessoas_privado for insert to authenticated with check (pessoa_id = (select interno.pessoa_atual()));
create policy muda on public.pessoas_privado for update to authenticated using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));
revoke all on public.pessoas_privado from anon, public;
grant select, insert, update on public.pessoas_privado to authenticated;
grant all on public.pessoas_privado to service_role;
-- idade mínima de 18 anos (Termos de Uso e Política de Privacidade)
create or replace function interno.conferir_idade() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.data_nascimento is not null and new.data_nascimento > current_date - interval '18 years' then
    raise exception 'É preciso ter 18 anos ou mais para usar o CicloDev' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists pessoas_privado_idade on public.pessoas_privado;
create trigger pessoas_privado_idade before insert or update of data_nascimento on public.pessoas_privado for each row execute function interno.conferir_idade();
drop trigger if exists pessoas_privado_carimbo on public.pessoas_privado;
create trigger pessoas_privado_carimbo before update on public.pessoas_privado for each row execute function interno.carimbar_atualizacao();

-- prepara a pessoa de um login (usada pelo gatilho do cadastro e pelo vincular_meu_login)
create or replace function interno.preparar_pessoa(p_auth uuid, p_email text, p_nome text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; esp uuid; nome_ok text;
begin
  select id into pid from public.pessoas where auth_user_id = p_auth;
  if pid is null and p_email is not null then
    update public.pessoas set auth_user_id = p_auth where lower(email) = lower(p_email) and auth_user_id is null returning id into pid;
  end if;
  nome_ok := coalesce(nullif(btrim(p_nome), ''), initcap(split_part(coalesce(p_email, 'usuario'), '@', 1)));
  if pid is null then
    insert into public.pessoas (auth_user_id, nome, email, papel, ativo, espaco_id) values (p_auth, left(nome_ok, 120), lower(p_email), 'dev', true, null) returning id into pid;
  end if;
  if not exists (select 1 from public.espaco_membros where pessoa_id = pid) then
    insert into public.espacos (nome, dono_id, pessoal) values ('Espaço de ' || split_part((select nome from public.pessoas where id = pid), ' ', 1), pid, true) returning id into esp;
    insert into public.espaco_membros (espaco_id, pessoa_id, papel) values (esp, pid, 'dono');
    perform interno.semear_espaco(esp);
  end if;
  if p_email is not null then perform interno.receber_convites(pid, p_email); end if;
  return pid;
end $$;

create or replace function interno.ao_criar_usuario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb); v_cpf text; nasc date;
begin
  pid := interno.preparar_pessoa(new.id, new.email, coalesce(m ->> 'nome', m ->> 'full_name', m ->> 'name'));
  v_cpf := nullif(regexp_replace(coalesce(m ->> 'cpf', ''), '\D', '', 'g'), '');
  begin nasc := nullif(m ->> 'nascimento', '')::date; exception when others then nasc := null; end;
  if v_cpf is not null and not interno.cpf_valido(v_cpf) then raise exception 'CPF inválido' using errcode = '23514'; end if;
  if v_cpf is not null and exists (select 1 from public.pessoas_privado p where p.cpf = v_cpf and p.pessoa_id <> pid) then
    raise exception 'Já existe uma conta com este CPF' using errcode = '23505';
  end if;
  if m ? 'cpf' or m ? 'nascimento' or m ? 'uso' then
    insert into public.pessoas_privado (pessoa_id, nome_completo, data_nascimento, cpf, cep, logradouro, numero, complemento, bairro, cidade, uf, uso, cargo, empresa, termos_aceitos_em)
    values (pid, nullif(btrim(m ->> 'nome'), ''), nasc, v_cpf, nullif(regexp_replace(coalesce(m ->> 'cep', ''), '\D', '', 'g'), ''), nullif(btrim(m ->> 'logradouro'), ''),
            nullif(btrim(m ->> 'numero'), ''), nullif(btrim(m ->> 'complemento'), ''), nullif(btrim(m ->> 'bairro'), ''), nullif(btrim(m ->> 'cidade'), ''),
            nullif(upper(btrim(m ->> 'uf')), ''), nullif(m ->> 'uso', ''), nullif(btrim(m ->> 'cargo'), ''), nullif(btrim(m ->> 'empresa'), ''),
            case when (m ->> 'termos') = 'sim' then now() end)
    on conflict (pessoa_id) do nothing;
    -- os dados pessoais saem dos dados do login (senão iriam dentro de todo token de acesso)
    begin
      update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - array['cpf','nascimento','cep','logradouro','numero','complemento','bairro','cidade','uf','cargo','empresa','uso','termos']
       where id = new.id;
    exception when others then null; end;
  end if;
  return new;
end $$;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_user_meta_data') then
    -- cria só se ainda não houver um gatilho chamando interno.ao_criar_usuario (em bancos antigos ele existe com outro nome,
    -- que o Supabase não deixa trocar porque auth.users é dele); assim nunca roda duas vezes por cadastro
    if not exists (select 1 from pg_trigger t join pg_proc f on f.oid = t.tgfoid join pg_namespace n on n.oid = f.pronamespace
                    where t.tgrelid = 'auth.users'::regclass and n.nspname = 'interno' and f.proname = 'ao_criar_usuario') then
      execute 'create trigger ciclodev_ao_criar_usuario after insert on auth.users for each row execute function interno.ao_criar_usuario()';
    end if;
  end if;
end $$;

-- o login da tela: garante a pessoa e devolve quem ela é (com o número de ID e o espaço)
drop function if exists public.vincular_meu_login();
drop function if exists interno.vincular_meu_login();
create or replace function interno.vincular_meu_login() returns table (pessoa_id uuid, nome text, papel text, numero bigint, espaco_id uuid, espaco_nome text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid;
begin
  if auth.uid() is null then return; end if;
  pid := interno.preparar_pessoa(auth.uid(), lower(auth.jwt() ->> 'email'), auth.jwt() -> 'user_metadata' ->> 'nome');
  return query select p.id, p.nome, 'master'::text, p.numero, e.id, e.nome
    from public.pessoas p left join public.espacos e on e.id = interno.meu_espaco() where p.id = pid;
end $$;
create or replace function public.vincular_meu_login() returns table (pessoa_id uuid, nome text, papel text, numero bigint, espaco_id uuid, espaco_nome text)
language sql security invoker set search_path = public, pg_temp as $$ select * from interno.vincular_meu_login() $$;

-- achar uma pessoa pelo número de ID (ou pelo @usuario) para compartilhar; devolve só o necessário
create or replace function interno.buscar_pessoa(p_busca text) returns table (id uuid, nome text, numero bigint, usuario text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.nome, p.numero, p.usuario from public.pessoas p
   where p.ativo and p.auth_user_id is not null and interno.pessoa_atual() is not null
     and (p.numero::text = regexp_replace(btrim(p_busca), '^#', '') or lower(p.usuario) = lower(regexp_replace(btrim(p_busca), '^@', '')))
   limit 1
$$;
create or replace function public.buscar_pessoa(p_busca text) returns table (id uuid, nome text, numero bigint, usuario text)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from interno.buscar_pessoa(p_busca) $$;

-- mover na estrutura: quem pode trabalhar nos dois pontos
create or replace function interno.mover_no(p_no uuid, p_novo_pai uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no not in (select interno.nos_editaveis()) or (p_novo_pai is not null and p_novo_pai not in (select interno.nos_editaveis())) then
    raise exception 'Sem acesso para mover este ponto' using errcode = '42501';
  end if;
  update public.nos set pai_id = p_novo_pai where id = p_no;
end $$;
create or replace function interno.dispensar_etapa(p_no uuid, p_item_modelo uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a este ponto' using errcode = '42501'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escreva o motivo da dispensa' using errcode = '23514'; end if;
  insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em, motivo_dispensa)
  values (p_no, p_item_modelo, 'dispensado', interno.pessoa_atual(), now(), p_motivo)
  on conflict (no_id, item_modelo_id) do update set situacao = 'dispensado', cumprido_por = excluded.cumprido_por, cumprido_em = now(), motivo_dispensa = excluded.motivo_dispensa;
end $$;

-- ninguém muda pela tela o próprio número de ID, o login, o e-mail ou o espaço de origem
create or replace function interno.proteger_pessoa() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated','anon') then
    new.numero := old.numero; new.auth_user_id := old.auth_user_id; new.espaco_id := old.espaco_id;
    if old.auth_user_id is not null then new.email := old.email; new.papel := old.papel; end if;
  end if;
  return new;
end $$;
drop trigger if exists pessoas_proteger on public.pessoas;
create trigger pessoas_proteger before update on public.pessoas for each row execute function interno.proteger_pessoa();

-- ---------- 7. regras de acesso (RLS) ----------
-- apaga as regras antigas das tabelas que dependiam do nível Master e das que mudam aqui
do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and tablename in (
    'nos','clientes','projetos','aplicacoes','frentes','participacoes','pessoas','pessoas_custos','espacos','espaco_membros','convites',
    'etiquetas','etiquetas_nos','status_fluxo','requisitos','servicos','servicos_cobranca','servicos_requisitos','regras_calculo',
    'custos_operacao','custos_tecnicos','custos_uso','receitas','slas','automacoes','automacoes_execucoes','campos_personalizados',
    'etapas_modelo','etapas_modelo_itens','etapas_nos','provas',
    'dominios','dominios_registros','segredos_catalogo','cambio','equipes','equipes_membros','equipes_nos','integracoes','vinculos_externos','integracoes_log',
    'boards_config','boards_colunas','boards_colunas_status','comentarios_reacoes')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
  -- regras soltas que usavam o Master
  execute 'drop policy if exists master_apaga on public.itens';
  execute 'drop policy if exists time_apaga on public.itens';
  execute 'drop policy if exists dono_apaga on public.anexos';
  execute 'drop policy if exists autor_apaga on public.comentarios';
  execute 'drop policy if exists autor_muda on public.comentarios';
end $$;

alter table public.espacos enable row level security;
alter table public.espaco_membros enable row level security;
alter table public.convites enable row level security;

-- Estrutura
create policy ver on public.nos for select to authenticated using (id in (select interno.nos_visiveis()) or id in (select interno.nos_caminho()));
create policy cria on public.nos for insert to authenticated with check (
  (pai_id is null and espaco_id in (select interno.meus_espacos())) or (pai_id in (select interno.nos_editaveis())));
create policy muda on public.nos for update to authenticated using (id in (select interno.nos_editaveis())) with check (id in (select interno.nos_editaveis()) or pai_id in (select interno.nos_editaveis()));
-- apaga: o que é do meu espaço, ou o que está DENTRO de algo compartilhado comigo (o ponto compartilhado em si, só o dono apaga)
create policy apaga on public.nos for delete to authenticated using (
  espaco_id in (select interno.meus_espacos())
  or exists (select 1 from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id where a.no_id = nos.id and a.distancia > 0));
do $$ declare t text; begin
  foreach t in array array['clientes','projetos','aplicacoes','frentes'] loop
    execute format('create policy ver on public.%I for select to authenticated using (no_id in (select interno.nos_visiveis()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (no_id in (select interno.nos_editaveis()))', t);
  end loop;
end $$;

-- tudo o que é de um ponto da estrutura: vê quem vê o ponto; muda quem trabalha nele
do $$ declare t text; begin
  foreach t in array array['etiquetas_nos','slas','automacoes','campos_personalizados','custos_tecnicos','receitas','etapas_nos','provas','segredos_catalogo','boards_config','boards_colunas'] loop
    execute format('create policy ver on public.%I for select to authenticated using (no_id in (select interno.nos_visiveis()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (no_id in (select interno.nos_editaveis()))', t);
  end loop;
end $$;
create policy ver on public.status_fluxo for select to authenticated using (no_id is null or no_id in (select interno.nos_visiveis()));
create policy cria on public.status_fluxo for insert to authenticated with check (no_id is not null and no_id in (select interno.nos_editaveis()));
create policy muda on public.status_fluxo for update to authenticated using (no_id is not null and no_id in (select interno.nos_editaveis())) with check (no_id is not null and no_id in (select interno.nos_editaveis()));
create policy apaga on public.status_fluxo for delete to authenticated using (no_id is not null and no_id in (select interno.nos_editaveis()));
create policy ver on public.custos_uso for select to authenticated using (exists (select 1 from public.custos_tecnicos c where c.id = custo_id));
create policy muda on public.custos_uso for all to authenticated using (exists (select 1 from public.custos_tecnicos c where c.id = custo_id and c.no_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.custos_tecnicos c where c.id = custo_id and c.no_id in (select interno.nos_editaveis())));
create policy ver on public.boards_colunas_status for select to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id));
create policy cria on public.boards_colunas_status for insert to authenticated with check (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())));
create policy muda on public.boards_colunas_status for update to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())));
grant update on public.boards_colunas_status to authenticated;
-- itens_pessoas e etiquetas_itens também são gravadas com upsert: precisam de UPDATE (regra e permissão)
drop policy if exists muda_altera on public.itens_pessoas; drop policy if exists muda_altera on public.etiquetas_itens;
create policy muda_altera on public.itens_pessoas for update to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())) or pessoa_id = (select interno.pessoa_atual()))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())) or (papel in ('observador','voto') and pessoa_id = (select interno.pessoa_atual())));
create policy muda_altera on public.etiquetas_itens for update to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));
grant update on public.itens_pessoas, public.etiquetas_itens to authenticated;   -- a tela grava as colunas com upsert, que precisa de UPDATE
create policy apaga on public.boards_colunas_status for delete to authenticated using (exists (select 1 from public.boards_colunas c where c.id = coluna_id and c.no_id in (select interno.nos_editaveis())));
create policy ver on public.automacoes_execucoes for select to authenticated using (exists (select 1 from public.automacoes a where a.id = automacao_id));

-- itens, comentários e anexos: quem trabalha no ponto também apaga
create policy time_apaga on public.itens for delete to authenticated using (frente_id in (select interno.nos_editaveis()));
create policy autor_muda on public.comentarios for update to authenticated using (autor_id = (select interno.pessoa_atual())) with check (autor_id = (select interno.pessoa_atual()));
create policy autor_apaga on public.comentarios for delete to authenticated using (autor_id = (select interno.pessoa_atual())
  or (item_id is not null and exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  or (no_id is not null and no_id in (select interno.nos_editaveis())));
create policy dono_apaga on public.anexos for delete to authenticated using (enviado_por = (select interno.pessoa_atual())
  or (item_id is not null and exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  or (no_id is not null and no_id in (select interno.nos_editaveis())));
create policy ver on public.comentarios_reacoes for select to authenticated using (exists (select 1 from public.comentarios c where c.id = comentario_id));
create policy cria on public.comentarios_reacoes for insert to authenticated with check (pessoa_id = (select interno.pessoa_atual()) and exists (select 1 from public.comentarios c where c.id = comentario_id));
create policy apaga on public.comentarios_reacoes for delete to authenticated using (pessoa_id = (select interno.pessoa_atual()));

-- o que é do sistema da pessoa (Catalog, Costs, Settings, Agent Studio, domínios, etiquetas, equipes, integrações)
do $$ declare t text; begin
  foreach t in array array['servicos','requisitos','regras_calculo','etapas_modelo','custos_operacao','dominios','etiquetas','equipes','integracoes','pessoas_custos'] loop
    execute format('create policy ver on public.%I for select to authenticated using (espaco_id in (select interno.meus_espacos()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (espaco_id in (select interno.meus_espacos()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (espaco_id in (select interno.meus_espacos())) with check (espaco_id in (select interno.meus_espacos()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (espaco_id in (select interno.meus_espacos()))', t);
  end loop;
end $$;
-- quem recebeu um ponto compartilhado vê o nome das etiquetas e dos serviços usados nele
create policy ver_compartilhado on public.etiquetas for select to authenticated using (
  exists (select 1 from public.etiquetas_nos l where l.etiqueta_id = etiquetas.id and l.no_id in (select interno.nos_visiveis()))
  or exists (select 1 from public.etiquetas_itens l join public.itens i on i.id = l.item_id where l.etiqueta_id = etiquetas.id));
create policy ver_compartilhado on public.servicos for select to authenticated using (
  exists (select 1 from public.aplicacoes a where a.servico_id = servicos.id and a.no_id in (select interno.nos_visiveis())));
-- filhos das tabelas do espaço: seguem o pai
create policy ver on public.servicos_cobranca for select to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id));
create policy muda on public.servicos_cobranca for all to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())));
create policy ver on public.servicos_requisitos for select to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id));
create policy muda on public.servicos_requisitos for all to authenticated using (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.servicos s where s.id = servico_id and s.espaco_id in (select interno.meus_espacos())));
create policy ver on public.etapas_modelo_itens for select to authenticated using (exists (select 1 from public.etapas_modelo e where e.id = etapa_id));
create policy muda on public.etapas_modelo_itens for all to authenticated using (exists (select 1 from public.etapas_modelo e where e.id = etapa_id and e.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.etapas_modelo e where e.id = etapa_id and e.espaco_id in (select interno.meus_espacos())));
create policy ver on public.dominios_registros for select to authenticated using (exists (select 1 from public.dominios d where d.id = dominio_id));
create policy muda on public.dominios_registros for all to authenticated using (exists (select 1 from public.dominios d where d.id = dominio_id and d.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.dominios d where d.id = dominio_id and d.espaco_id in (select interno.meus_espacos())));
create policy ver on public.vinculos_externos for select to authenticated using (exists (select 1 from public.integracoes i where i.id = integracao_id));
create policy muda on public.vinculos_externos for all to authenticated using (exists (select 1 from public.integracoes i where i.id = integracao_id and i.espaco_id in (select interno.meus_espacos())))
  with check (exists (select 1 from public.integracoes i where i.id = integracao_id and i.espaco_id in (select interno.meus_espacos())));
create policy ver on public.integracoes_log for select to authenticated using (exists (select 1 from public.integracoes i where i.id = integracao_id));
create policy ver on public.cambio for select to authenticated using (true);

-- equipes: membros veem a equipe; quem é do espaço da equipe monta
-- (as funções abaixo leem as equipes sem passar pelas regras, para as regras de equipes e membros não chamarem uma à outra sem fim)
create or replace function interno.equipes_do_meu_espaco() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id from public.equipes e where e.espaco_id in (select interno.meus_espacos())
$$;
create or replace function interno.minhas_equipes() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select interno.equipes_do_meu_espaco()
  union select m.equipe_id from public.equipes_membros m where m.pessoa_id = interno.pessoa_atual()
$$;
revoke execute on function interno.equipes_do_meu_espaco(), interno.minhas_equipes() from public, anon;
grant execute on function interno.equipes_do_meu_espaco(), interno.minhas_equipes() to authenticated, service_role;
create policy ver_membro on public.equipes for select to authenticated using (id in (select interno.minhas_equipes()));
create policy ver on public.equipes_membros for select to authenticated using (equipe_id in (select interno.minhas_equipes()));
create policy muda on public.equipes_membros for all to authenticated using (equipe_id in (select interno.equipes_do_meu_espaco()))
  with check (equipe_id in (select interno.equipes_do_meu_espaco()));
create policy ver on public.equipes_nos for select to authenticated using (no_id in (select interno.nos_visiveis()) or equipe_id in (select interno.equipes_do_meu_espaco()));
create policy cria on public.equipes_nos for insert to authenticated with check (no_id in (select interno.nos_editaveis()) and equipe_id in (select interno.equipes_do_meu_espaco()));
create policy muda on public.equipes_nos for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.equipes_nos for delete to authenticated using (no_id in (select interno.nos_editaveis()) or equipe_id in (select interno.equipes_do_meu_espaco()));

-- compartilhar: quem trabalha no ponto compartilha e tira; quem recebeu pode sair
create policy ver on public.participacoes for select to authenticated using (pessoa_id = (select interno.pessoa_atual()) or no_id in (select interno.nos_visiveis()));
create policy cria on public.participacoes for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
create policy muda on public.participacoes for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.participacoes for delete to authenticated using (no_id in (select interno.nos_editaveis()) or pessoa_id = (select interno.pessoa_atual()));
create policy ver on public.convites for select to authenticated using (no_id in (select interno.nos_editaveis()));
create policy cria on public.convites for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.convites for delete to authenticated using (no_id in (select interno.nos_editaveis()));

-- pessoas: cada um mexe no próprio perfil; pessoas sem login (planejamento) são do espaço
create policy ver on public.pessoas for select to authenticated using (id in (select interno.pessoas_visiveis()));
create policy cria on public.pessoas for insert to authenticated with check (auth_user_id is null and espaco_id in (select interno.meus_espacos()));
create policy muda on public.pessoas for update to authenticated using (id = (select interno.pessoa_atual()) or (auth_user_id is null and espaco_id in (select interno.meus_espacos())))
  with check (id = (select interno.pessoa_atual()) or (auth_user_id is null and espaco_id in (select interno.meus_espacos())));
create policy apaga on public.pessoas for delete to authenticated using (auth_user_id is null and espaco_id in (select interno.meus_espacos()));
alter table public.pessoas alter column espaco_id set default interno.meu_espaco();

-- espaços
create policy ver on public.espacos for select to authenticated using (id in (select interno.meus_espacos()) or dono_id in (select interno.pessoas_visiveis()));
create policy muda on public.espacos for update to authenticated using (dono_id = (select interno.pessoa_atual())) with check (dono_id = (select interno.pessoa_atual()));
create policy ver on public.espaco_membros for select to authenticated using (espaco_id in (select interno.meus_espacos()));
create policy muda on public.espaco_membros for all to authenticated
  using (exists (select 1 from public.espacos e where e.id = espaco_id and e.dono_id = (select interno.pessoa_atual())))
  with check (exists (select 1 from public.espacos e where e.id = espaco_id and e.dono_id = (select interno.pessoa_atual())));

-- ---------- 8. permissões (GRANT) e funções ----------
revoke all on public.espacos, public.espaco_membros, public.convites from anon, public;
grant select, update on public.espacos to authenticated;
grant select, insert, update, delete on public.espaco_membros, public.convites to authenticated;
grant all on public.espacos, public.espaco_membros, public.convites to service_role;
grant usage, select on sequence public.pessoas_numero_seq to authenticated, service_role;
grant select, insert, update, delete on public.cambio to authenticated;
revoke execute on function interno.nos_caminho(), interno.meus_espacos(), interno.meu_espaco(), interno.pessoas_visiveis(), interno.semear_espaco(uuid), interno.receber_convites(uuid, text),
  interno.preparar_pessoa(uuid, text, text), interno.ao_criar_usuario(), interno.cpf_valido(text), interno.vincular_meu_login(), interno.buscar_pessoa(text), interno.espaco_do_no(), interno.espaco_do_william() from public, anon;
grant execute on function interno.nos_caminho(), interno.meus_espacos(), interno.meu_espaco(), interno.pessoas_visiveis(), interno.vincular_meu_login(), interno.buscar_pessoa(text), interno.cpf_valido(text) to authenticated, service_role;
grant execute on function public.vincular_meu_login(), public.buscar_pessoa(text) to authenticated;
revoke execute on function public.vincular_meu_login(), public.buscar_pessoa(text) from anon, public;
-- relatórios do banco (bi) leem sem as regras por linha: com muitos usuários, ficam fechados para a tela (ela não usa)
do $$ declare f record; begin
  for f in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'bi' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from authenticated, anon, public', f.fn);
  end loop;
  for f in select p.oid::regprocedure as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('painel','financeiro','calcular_preco','ficha','carga','queima_sprint') loop
    execute format('revoke execute on function %s from authenticated, anon, public', f.fn);
  end loop;
end $$;
do $$ begin execute 'revoke all on all tables in schema bi from authenticated, anon'; exception when others then null; end $$;

-- histórico
do $$ declare t text; begin
  foreach t in array array['espacos','espaco_membros','participacoes','convites'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function auditoria.registrar()', t || '_auditoria', t);
  end loop;
end $$;

-- ---------- 9. o espaço Modelo nasce com a cópia do padrão atual (etapas, requisitos e regras de cálculo) ----------
do $$ declare v_modelo uuid; w uuid := interno.espaco_do_william(); r record; novo uuid; begin
  select e.id into v_modelo from public.espacos e where e.modelo;
  if v_modelo is null or w is null then return; end if;
  if not exists (select 1 from public.etapas_modelo where espaco_id = v_modelo) then
    insert into public.requisitos (espaco_id, nome, descricao, padrao, ordem) select v_modelo, nome, descricao, padrao, ordem from public.requisitos where espaco_id = w on conflict do nothing;
    insert into public.regras_calculo (espaco_id, vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
        decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia)
      select v_modelo, vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias,
        decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia
        from public.regras_calculo where espaco_id = w order by vigente_desde desc limit 1 on conflict do nothing;
    for r in select * from public.etapas_modelo where espaco_id = w order by ordem loop
      insert into public.etapas_modelo (espaco_id, chave, nome, explicacao, lente, entrega, ordem) values (v_modelo, r.chave, r.nome, r.explicacao, r.lente, r.entrega, r.ordem) returning id into novo;
      insert into public.etapas_modelo_itens (etapa_id, texto, modo, obrigatorio, prova_tipo, quem_cumpre, so_terceiros, ordem)
        select novo, texto, modo, obrigatorio, prova_tipo, case when quem_cumpre = 'pessoa_definida' then 'qualquer_um' else quem_cumpre end, so_terceiros, ordem from public.etapas_modelo_itens where etapa_id = r.id;
    end loop;
  end if;
end $$;

-- >>>>>>>>>> 16_admin_sistema.sql
-- =====================================================================
-- Parte 16: dono do sistema (único Master) e módulo Admin
-- Depende da parte 15 (espaços).
-- Todo usuário continua com um nível só. O dono do sistema tem, além do espaço dele,
-- o módulo Admin: lista de usuários, dados do cadastro, uso, histórico e desempenho.
-- Ele NÃO ganha acesso aos projetos dos outros: vê números (quantos projetos, itens,
-- acessos), nunca o conteúdo.
-- =====================================================================

-- quem é dono do sistema (só pelo banco; a tela não grava aqui)
create table if not exists interno.donos_sistema (
  pessoa_id  uuid primary key references public.pessoas(id) on delete cascade,
  desde      timestamptz not null default now()
);
comment on table interno.donos_sistema is 'Dono(s) do CicloDev. Só muda pelo banco. Hoje: William (login admin@it-ia.tec.br).';
revoke all on interno.donos_sistema from public, anon, authenticated;
insert into interno.donos_sistema (pessoa_id)
  select id from public.pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' on conflict do nothing;

create or replace function interno.eh_dono_sistema() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from interno.donos_sistema d where d.pessoa_id = interno.pessoa_atual())
$$;
create or replace function public.sou_dono_sistema() returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$ select interno.eh_dono_sistema() $$;

-- o dono do sistema também pode ver os dados do cadastro (o texto do aceite avisa isso)
comment on table public.pessoas_privado is 'Dados pessoais do cadastro (LGPD). Só a própria pessoa e a administração do sistema (módulo Admin) veem. Nunca aparecem para quem compartilha com ela.';

-- ---------------------------------------------------------------------
-- registro de uso: a tela anota entradas, telas abertas, tempo ativo e desempenho
-- ---------------------------------------------------------------------
create table if not exists public.uso_eventos (
  id         bigint generated always as identity primary key,
  pessoa_id  uuid not null default interno.pessoa_atual() references public.pessoas(id) on delete cascade,
  espaco_id  uuid default interno.meu_espaco() references public.espacos(id) on delete set null,
  tipo       text not null check (tipo in ('entrou','tela','ativo','carregou','salvou','erro','saiu')),
  tela       text check (tela is null or length(tela) <= 60),
  ms         integer check (ms is null or ms between 0 and 600000),
  detalhe    jsonb check (detalhe is null or pg_column_size(detalhe) <= 2000),
  em         timestamptz not null default now()
);
comment on table public.uso_eventos is 'Uso do sistema (para o módulo Admin): entradas, telas, minutos ativos, tempo de carregar e salvar, erros. Cada um só grava o próprio; ninguém lê pela tela, só pelas funções do Admin.';
create index if not exists uso_eventos_pessoa_em on public.uso_eventos (pessoa_id, em desc);
create index if not exists uso_eventos_em on public.uso_eventos (em desc);
create index if not exists uso_eventos_tipo_em on public.uso_eventos (tipo, em desc);
alter table public.uso_eventos enable row level security;
drop policy if exists grava on public.uso_eventos;
create policy grava on public.uso_eventos for insert to authenticated
  with check (pessoa_id = (select interno.pessoa_atual()) and em > now() - interval '5 minutes' and em < now() + interval '5 minutes');
revoke all on public.uso_eventos from public, anon, authenticated;
grant insert (tipo, tela, ms, detalhe) on public.uso_eventos to authenticated;
grant all on public.uso_eventos to service_role;

-- ---------------------------------------------------------------------
-- funções do Admin (todas conferem se quem chama é o dono do sistema)
-- ---------------------------------------------------------------------
create or replace function interno.exigir_dono() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not interno.eh_dono_sistema() then raise exception 'Só o dono do sistema pode ver isso' using errcode = '42501'; end if;
end $$;

-- números gerais
create or replace function public.admin_resumo() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform interno.exigir_dono();
  with contas as (select p.id, p.criado_em from public.pessoas p where p.auth_user_id is not null),
       ev as (select pessoa_id, tipo, ms, em from public.uso_eventos where em > now() - interval '30 days')
  select jsonb_build_object(
    'usuarios',            (select count(*) from contas),
    'novos_7d',            (select count(*) from contas where criado_em > now() - interval '7 days'),
    'novos_30d',           (select count(*) from contas where criado_em > now() - interval '30 days'),
    'ativos_1d',           (select count(distinct pessoa_id) from ev where em > now() - interval '1 day'),
    'ativos_7d',           (select count(distinct pessoa_id) from ev where em > now() - interval '7 days'),
    'ativos_30d',          (select count(distinct pessoa_id) from ev),
    'confirmados',         (select count(*) from auth.users where email_confirmed_at is not null),
    'espacos',             (select count(*) from public.espacos where not modelo),
    'clientes',            (select count(*) from public.nos where tipo = 'cliente'),
    'projetos',            (select count(*) from public.nos where tipo = 'projeto'),
    'aplicacoes',          (select count(*) from public.nos where tipo = 'aplicacao'),
    'itens',               (select count(*) from public.itens),
    'compartilhamentos',   (select count(*) from public.participacoes p join public.nos n on n.id = p.no_id where not exists (select 1 from public.espacos e where e.id = n.espaco_id and e.dono_id = p.pessoa_id)),
    'convites_pendentes',  (select count(*) from public.convites where aceito_em is null),
    'minutos_ativos_7d',   (select count(*) * 5 from ev where tipo = 'ativo' and em > now() - interval '7 days'),
    'carregar_ms_mediana', (select percentile_cont(0.5) within group (order by ms)::int from ev where tipo = 'carregou' and em > now() - interval '7 days'),
    'carregar_ms_p95',     (select percentile_cont(0.95) within group (order by ms)::int from ev where tipo = 'carregou' and em > now() - interval '7 days'),
    'salvar_ms_mediana',   (select percentile_cont(0.5) within group (order by ms)::int from ev where tipo = 'salvou' and em > now() - interval '7 days'),
    'erros_7d',            (select count(*) from ev where tipo = 'erro' and em > now() - interval '7 days'),
    'salvamentos_7d',      (select count(*) from ev where tipo = 'salvou' and em > now() - interval '7 days'),
    'banco_mb',            round(pg_database_size(current_database()) / 1048576.0, 1),
    'gerado_em',           now()
  ) into r;
  return r;
end $$;

-- lista de usuários com o cadastro e os índices de uso
create or replace function public.admin_usuarios() returns table (
  pessoa_id uuid, numero bigint, nome text, email text, usuario text, dono_sistema boolean,
  criado_em timestamptz, email_confirmado boolean, ultimo_acesso timestamptz,
  nome_completo text, data_nascimento date, cpf text, cep text, logradouro text, numero_end text, complemento text,
  bairro text, cidade text, uf text, uso text, cargo text, empresa text, termos_aceitos_em timestamptz,
  clientes bigint, projetos bigint, aplicacoes bigint, itens bigint, itens_concluidos bigint,
  compartilhou bigint, recebeu bigint, entradas_30d bigint, dias_ativos_30d bigint, minutos_ativos_30d bigint,
  eventos_30d bigint, erros_30d bigint, indice_uso integer
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query
  with ev as (
    select e.pessoa_id,
           count(*) filter (where e.tipo = 'entrou') as entradas,
           count(distinct date_trunc('day', e.em)) as dias,
           count(*) filter (where e.tipo = 'ativo') * 5 as minutos,
           count(*) as eventos,
           count(*) filter (where e.tipo = 'erro') as erros,
           max(e.em) as ultimo
      from public.uso_eventos e where e.em > now() - interval '30 days' group by e.pessoa_id
  ), nos_c as (
    select n.espaco_id,
           count(*) filter (where n.tipo = 'cliente') as clientes,
           count(*) filter (where n.tipo = 'projeto') as projetos,
           count(*) filter (where n.tipo = 'aplicacao') as aplicacoes
      from public.nos n group by n.espaco_id
  ), it as (
    select n.espaco_id, count(*) as itens,
           count(*) filter (where i.concluido_em is not null) as concluidos
      from public.itens i join public.nos n on n.id = i.frente_id group by n.espaco_id
  ), comp as (
    select n.espaco_id, count(*) as qtd from public.participacoes pa join public.nos n on n.id = pa.no_id
      where not exists (select 1 from public.espacos e where e.id = n.espaco_id and e.dono_id = pa.pessoa_id) group by n.espaco_id
  ), rec as (
    select pa.pessoa_id, count(*) as qtd from public.participacoes pa join public.nos n on n.id = pa.no_id
      where not exists (select 1 from public.espacos e where e.id = n.espaco_id and e.dono_id = pa.pessoa_id) group by pa.pessoa_id
  )
  select p.id, p.numero, p.nome, coalesce(u.email, p.email)::text, p.usuario, exists (select 1 from interno.donos_sistema d where d.pessoa_id = p.id),
         coalesce(u.created_at, p.criado_em), u.email_confirmed_at is not null, greatest(u.last_sign_in_at, ev.ultimo),
         pp.nome_completo, pp.data_nascimento, pp.cpf, pp.cep, pp.logradouro, pp.numero, pp.complemento,
         pp.bairro, pp.cidade, pp.uf, pp.uso, pp.cargo, pp.empresa, pp.termos_aceitos_em,
         coalesce(nc.clientes, 0), coalesce(nc.projetos, 0), coalesce(nc.aplicacoes, 0), coalesce(it.itens, 0), coalesce(it.concluidos, 0),
         coalesce(comp.qtd, 0), coalesce(rec.qtd, 0), coalesce(ev.entradas, 0), coalesce(ev.dias, 0), coalesce(ev.minutos, 0),
         coalesce(ev.eventos, 0), coalesce(ev.erros, 0),
         -- índice de uso (0 a 100): frequência (dias ativos) 50%, tempo ativo 30%, volume de trabalho 20%
         least(100, round(
           least(coalesce(ev.dias, 0), 20) / 20.0 * 50 +
           least(coalesce(ev.minutos, 0), 1200) / 1200.0 * 30 +
           least(coalesce(it.itens, 0) + coalesce(nc.projetos, 0) * 5, 100) / 100.0 * 20))::int
    from public.pessoas p
    left join auth.users u on u.id = p.auth_user_id
    left join public.pessoas_privado pp on pp.pessoa_id = p.id
    left join public.espacos es on es.dono_id = p.id and es.pessoal and not es.modelo
    left join ev on ev.pessoa_id = p.id
    left join nos_c nc on nc.espaco_id = es.id
    left join it on it.espaco_id = es.id
    left join comp on comp.espaco_id = es.id
    left join rec on rec.pessoa_id = p.id
   where p.auth_user_id is not null
   order by coalesce(u.created_at, p.criado_em) desc;
end $$;

-- série por dia (gráficos)
create or replace function public.admin_uso_diario(p_dias integer default 30) returns table (
  dia date, cadastros bigint, ativos bigint, entradas bigint, minutos_ativos bigint, erros bigint, carregar_ms integer, salvar_ms integer
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare n int := least(greatest(coalesce(p_dias, 30), 1), 365);
begin
  perform interno.exigir_dono();
  return query
  with d as (select generate_series(current_date - (n - 1), current_date, interval '1 day')::date as dia),
       ev as (select e.em::date as dia, e.pessoa_id, e.tipo, e.ms from public.uso_eventos e where e.em >= current_date - (n - 1))
  select d.dia,
         (select count(*) from public.pessoas p where p.auth_user_id is not null and p.criado_em::date = d.dia),
         (select count(distinct ev.pessoa_id) from ev where ev.dia = d.dia),
         (select count(*) from ev where ev.dia = d.dia and ev.tipo = 'entrou'),
         (select count(*) * 5 from ev where ev.dia = d.dia and ev.tipo = 'ativo'),
         (select count(*) from ev where ev.dia = d.dia and ev.tipo = 'erro'),
         (select percentile_cont(0.5) within group (order by ev.ms)::int from ev where ev.dia = d.dia and ev.tipo = 'carregou'),
         (select percentile_cont(0.5) within group (order by ev.ms)::int from ev where ev.dia = d.dia and ev.tipo = 'salvou')
    from d order by d.dia;
end $$;

-- telas mais usadas
create or replace function public.admin_telas(p_dias integer default 30) returns table (tela text, aberturas bigint, pessoas bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select e.tela, count(*), count(distinct e.pessoa_id) from public.uso_eventos e
    where e.tipo = 'tela' and e.tela is not null and e.em > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365))
    group by e.tela order by 2 desc limit 30;
end $$;

-- histórico de uso de uma pessoa
create or replace function public.admin_historico(p_pessoa uuid, p_limite integer default 200) returns table (em timestamptz, tipo text, tela text, ms integer, detalhe jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select e.em, e.tipo, e.tela, e.ms, e.detalhe from public.uso_eventos e
    where e.pessoa_id = p_pessoa and e.tipo <> 'ativo' order by e.em desc limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end $$;

-- tamanho das tabelas (desempenho do banco)
create or replace function public.admin_banco() returns table (tabela text, linhas bigint, tamanho_kb bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select c.relname::text, greatest(c.reltuples, 0)::bigint, (pg_total_relation_size(c.oid) / 1024)::bigint
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 25;
end $$;

-- permissões: nada para anon; as funções do Admin checam o dono por dentro
revoke execute on function interno.eh_dono_sistema(), interno.exigir_dono() from public, anon;
grant execute on function interno.eh_dono_sistema(), interno.exigir_dono() to authenticated, service_role;
revoke execute on function public.sou_dono_sistema(), public.admin_resumo(), public.admin_usuarios(), public.admin_uso_diario(integer),
  public.admin_telas(integer), public.admin_historico(uuid, integer), public.admin_banco() from public, anon;
grant execute on function public.sou_dono_sistema(), public.admin_resumo(), public.admin_usuarios(), public.admin_uso_diario(integer),
  public.admin_telas(integer), public.admin_historico(uuid, integer), public.admin_banco() to authenticated;

-- Política de Privacidade: o registro de uso fica no máximo 12 meses (rotina diária; só no Supabase, onde existe pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_limpar_uso';
    perform cron.schedule('ciclodev_limpar_uso', '17 3 * * *', $c$delete from public.uso_eventos where em < now() - interval '12 months'$c$);
  end if;
end $$;

-- Marco Civil da Internet, art. 15: guardar data, hora e endereço IP de cada acesso por pelo menos 6 meses.
-- A entrada no sistema ("entrou") guarda o IP e o navegador, lidos do pedido que chega ao banco (a tela não manda nada).
alter table public.uso_eventos add column if not exists ip text, add column if not exists navegador text;
comment on column public.uso_eventos.ip is 'Endereço IP da entrada (Marco Civil, art. 15). Guardado 12 meses, como o resto do registro de uso.';
create or replace function interno.uso_guardar_acesso() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare h jsonb;
begin
  if new.tipo = 'entrou' then
    begin h := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then h := null; end;
    if h is not null then
      new.ip := left(btrim(split_part(coalesce(h ->> 'cf-connecting-ip', h ->> 'x-real-ip', h ->> 'x-forwarded-for', ''), ',', 1)), 64);
      new.navegador := left(h ->> 'user-agent', 300);
      if new.ip = '' then new.ip := null; end if;
    end if;
  else
    new.ip := null; new.navegador := null;
  end if;
  return new;
end $$;
revoke execute on function interno.uso_guardar_acesso() from public, anon, authenticated;
drop trigger if exists uso_eventos_acesso on public.uso_eventos;
create trigger uso_eventos_acesso before insert on public.uso_eventos for each row execute function interno.uso_guardar_acesso();

-- >>>>>>>>>> 17_agent_studio.sql
-- =====================================================================
-- Parte 17: Agent Studio novo (só o dono do sistema)
-- Depende da parte 16 (interno.eh_dono_sistema).
--
-- 1. Tira os agentes antigos (AI PO, Agente de atendimento, Billy) e as 5 tabelas deles.
-- 2. Cria a oficina do assistente de IA do CicloDev. O agente nasce "em branco":
--    sem instruções, sem conhecimento e sem funções. Tudo o que ele sabe e faz é o
--    dono do sistema quem coloca, pela tela Agent Studio.
--
-- Peças:
--   studio_agentes             o agente (nome, instruções, modelo, ligado ou não)
--   studio_instrucoes_versoes  cada versão anterior das instruções (dá para voltar)
--   studio_conhecimento        os documentos (.md) que ele estuda: livros, manuais, regras
--   studio_trechos             cada documento cortado em pedaços pequenos, com busca em português
--   studio_funcoes             o que ele poderá fazer no sistema (vazio até o dono cadastrar)
--
-- Regra de acesso: só o dono do sistema lê e muda qualquer uma dessas tabelas.
-- Ninguém mais, nem para ler. Quando o assistente for ligado para os usuários, ele
-- lê o conhecimento pelo servidor, e o usuário nunca vê os documentos crus.
-- =====================================================================

-- ---------- 1. saem os agentes antigos ----------
alter table if exists public.pedidos_mensagens drop column if exists agente_id;
drop table if exists public.agentes_avaliacoes;
drop table if exists public.agentes_execucoes;
drop table if exists public.agentes_ferramentas;
drop table if exists public.agentes_fontes;
drop table if exists public.agentes;

-- ---------- 2. o agente ----------
create table if not exists public.studio_agentes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(btrim(nome)) between 1 and 80),
  descricao      text check (descricao is null or length(descricao) <= 500),
  instrucoes     text not null default '' check (length(instrucoes) <= 200000),
  modelo         text not null default 'claude-opus-5-5' check (modelo ~ '^[a-z0-9.-]{3,60}$'),
  ativo          boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table public.studio_agentes is 'Agent Studio: o assistente de IA do CicloDev. Nasce em branco; só o dono do sistema configura. ativo = false até o dono ligar.';

create table if not exists public.studio_instrucoes_versoes (
  id          bigint generated always as identity primary key,
  agente_id   uuid not null references public.studio_agentes(id) on delete cascade,
  instrucoes  text not null,
  salvo_em    timestamptz not null default now()
);
create index if not exists studio_instrucoes_versoes_idx on public.studio_instrucoes_versoes (agente_id, salvo_em desc);
comment on table public.studio_instrucoes_versoes is 'Cada vez que as instruções mudam, a versão anterior fica guardada aqui.';

-- ---------- 3. o conhecimento ----------
create table if not exists public.studio_conhecimento (
  id                uuid primary key default gen_random_uuid(),
  agente_id         uuid not null references public.studio_agentes(id) on delete cascade,
  titulo            text not null check (length(btrim(titulo)) between 1 and 200),
  tipo              text not null default 'livro' check (tipo in ('livro','manual','regra','exemplo','outro')),
  peso              text not null default 'fundamental' check (peso in ('fundamental','apoio')),
  descricao         text check (descricao is null or length(descricao) <= 1000),
  arquivo_nome      text check (arquivo_nome is null or length(arquivo_nome) <= 200),
  conteudo          text not null check (length(conteudo) between 1 and 8000000),
  caracteres        integer generated always as (length(conteudo)) stored,
  tokens_estimados  integer generated always as ((length(conteudo) + 3) / 4) stored,
  versao            integer not null default 1,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index if not exists studio_conhecimento_agente_idx on public.studio_conhecimento (agente_id);
comment on table public.studio_conhecimento is 'Documentos que o assistente estuda (livros em .md, manuais, regras). peso: fundamental = base principal; apoio = consulta. ativo = false tira o documento das respostas sem apagar.';

create table if not exists public.studio_trechos (
  id            bigint generated always as identity primary key,
  documento_id  uuid not null references public.studio_conhecimento(id) on delete cascade,
  ordem         integer not null,
  secao         text,
  texto         text not null,
  busca         tsvector generated always as (to_tsvector('portuguese', coalesce(secao, '') || ' ' || texto)) stored,
  unique (documento_id, ordem)
);
create index if not exists studio_trechos_busca_idx on public.studio_trechos using gin (busca);
comment on table public.studio_trechos is 'Cada documento cortado em pedaços de até uns 2.000 caracteres, com o capítulo de onde veio. É o que o assistente busca antes de responder. Refeito sozinho quando o documento muda.';

-- ---------- 4. as funções (o que ele poderá fazer) ----------
create table if not exists public.studio_funcoes (
  id                 uuid primary key default gen_random_uuid(),
  agente_id          uuid not null references public.studio_agentes(id) on delete cascade,
  nome               text not null check (length(btrim(nome)) between 1 and 80),
  descricao          text not null default '' check (length(descricao) <= 4000),
  acao               text not null default 'ler' check (acao in ('ler','criar','editar','apagar','outra')),
  pede_confirmacao   boolean not null default true,
  ativo              boolean not null default false,
  ordem              integer not null default 0,
  criado_em          timestamptz not null default now(),
  unique (agente_id, nome),
  check (acao = 'ler' or pede_confirmacao)   -- criar, editar e apagar sempre esperam o "confirmar" do usuário
);
comment on table public.studio_funcoes is 'O que o assistente pode fazer no sistema. Nasce vazio. Criar, editar e apagar sempre pedem confirmação do usuário, e sempre rodam com as permissões dele.';

-- ---------- 5. cortar o documento em trechos ----------
-- corta por parágrafo, respeitando os títulos (#, ##, ###) do markdown; um parágrafo
-- gigante é quebrado no último espaço antes do limite
create or replace function interno.studio_cortar(p_texto text, p_limite integer default 2000)
returns table (ordem integer, secao text, texto text)
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  par text; tit text[] := array[null, null, null]::text[]; nivel integer;
  buf text := ''; sec_buf text; n integer := 0; corte integer; sec_atual text;
begin
  for par in select btrim(x, E' \t\r\n') from regexp_split_to_table(replace(coalesce(p_texto, ''), E'\r\n', E'\n'), E'\n[ \t]*\n') x loop
    continue when par = '';
    if par ~ '^#{1,6}[ \t]' then
      nivel := length(substring(par from '^(#+)'));
      if nivel <= 3 then
        if buf <> '' then n := n + 1; ordem := n; secao := sec_buf; texto := buf; return next; buf := ''; end if;
        tit[nivel] := btrim(regexp_replace(split_part(par, E'\n', 1), '^#+[ \t]*', ''));
        for k in nivel + 1 .. 3 loop tit[k] := null; end loop;
        -- o título vai para a seção do trecho; só o texto que vier logo abaixo dele entra no trecho
        par := btrim(substr(par, length(split_part(par, E'\n', 1)) + 2), E' \t\r\n');
        continue when par = '';
      end if;
    end if;
    sec_atual := nullif(array_to_string(array_remove(tit, null), ' › '), '');
    if buf <> '' and length(buf) + length(par) + 2 > p_limite then
      n := n + 1; ordem := n; secao := sec_buf; texto := buf; return next; buf := '';
    end if;
    while length(par) > p_limite loop
      corte := p_limite - position(' ' in reverse(left(par, p_limite)));
      if corte < p_limite / 2 then corte := p_limite; end if;
      n := n + 1; ordem := n; secao := sec_atual; texto := btrim(left(par, corte)); return next;
      par := btrim(substr(par, corte + 1));
    end loop;
    if buf = '' then sec_buf := sec_atual; buf := par; else buf := buf || E'\n\n' || par; end if;
  end loop;
  if buf <> '' then n := n + 1; ordem := n; secao := sec_buf; texto := buf; return next; end if;
end $$;

create or replace function interno.studio_refazer_trechos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.conteudo is not distinct from old.conteudo then return null; end if;
  delete from public.studio_trechos where documento_id = new.id;
  insert into public.studio_trechos (documento_id, ordem, secao, texto)
    select new.id, c.ordem, c.secao, c.texto from interno.studio_cortar(new.conteudo) c;
  return null;
end $$;
drop trigger if exists studio_conhecimento_trechos on public.studio_conhecimento;
create trigger studio_conhecimento_trechos after insert or update of conteudo on public.studio_conhecimento
  for each row execute function interno.studio_refazer_trechos();

create or replace function interno.studio_antes_mudar_documento() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  if new.conteudo is distinct from old.conteudo then new.versao := old.versao + 1; end if;
  return new;
end $$;
drop trigger if exists studio_conhecimento_versao on public.studio_conhecimento;
create trigger studio_conhecimento_versao before update on public.studio_conhecimento
  for each row execute function interno.studio_antes_mudar_documento();

-- guarda a versão anterior das instruções
create or replace function interno.studio_antes_mudar_agente() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  if new.instrucoes is distinct from old.instrucoes and btrim(old.instrucoes) <> '' then
    insert into public.studio_instrucoes_versoes (agente_id, instrucoes) values (old.id, old.instrucoes);
  end if;
  return new;
end $$;
drop trigger if exists studio_agentes_versao on public.studio_agentes;
create trigger studio_agentes_versao before update on public.studio_agentes
  for each row execute function interno.studio_antes_mudar_agente();

-- ---------- 6. busca no conhecimento (para testar agora e para o assistente depois) ----------
create or replace function public.studio_buscar(p_agente uuid, p_pergunta text, p_limite integer default 8)
returns table (documento_id uuid, titulo text, peso text, secao text, texto text, relevancia real)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare q tsquery;
begin
  perform interno.exigir_dono();
  q := websearch_to_tsquery('portuguese', coalesce(p_pergunta, ''));
  if q is null or q::text = '' then return; end if;
  -- várias palavras: primeiro tenta achar trechos com todas; se não houver, qualquer uma delas
  if not exists (select 1 from public.studio_trechos t join public.studio_conhecimento c on c.id = t.documento_id
                  where c.agente_id = p_agente and c.ativo and t.busca @@ q) then
    q := replace(q::text, ' & ', ' | ')::tsquery;
  end if;
  return query
    select c.id, c.titulo, c.peso, t.secao, t.texto,
           (ts_rank_cd(t.busca, q) * case when c.peso = 'fundamental' then 1.5 else 1 end)::real
      from public.studio_trechos t join public.studio_conhecimento c on c.id = t.documento_id
     where c.agente_id = p_agente and c.ativo and t.busca @@ q
     order by 6 desc, c.titulo, t.ordem
     limit greatest(1, least(coalesce(p_limite, 8), 30));
end $$;

-- lista dos documentos para a tela, sem o texto inteiro (que pode ter megabytes)
create or replace function public.studio_documentos(p_agente uuid)
returns table (id uuid, titulo text, tipo text, peso text, descricao text, arquivo_nome text, caracteres integer, tokens_estimados integer,
               versao integer, ativo boolean, criado_em timestamptz, atualizado_em timestamptz, trechos bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query
    select c.id, c.titulo, c.tipo, c.peso, c.descricao, c.arquivo_nome, c.caracteres, c.tokens_estimados, c.versao, c.ativo, c.criado_em, c.atualizado_em,
           (select count(*) from public.studio_trechos t where t.documento_id = c.id)
      from public.studio_conhecimento c where c.agente_id = p_agente
     order by (c.peso = 'fundamental') desc, c.titulo;
end $$;

-- ---------- 7. regras de acesso: só o dono do sistema ----------
do $$ declare t text; begin
  foreach t in array array['studio_agentes','studio_instrucoes_versoes','studio_conhecimento','studio_trechos','studio_funcoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists dono on public.%I', t);
    execute format('create policy dono on public.%I for all to authenticated using ((select interno.eh_dono_sistema())) with check ((select interno.eh_dono_sistema()))', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant select, insert, update, delete on public.studio_agentes, public.studio_conhecimento, public.studio_funcoes to authenticated;
grant select, delete on public.studio_instrucoes_versoes to authenticated;   -- versões são gravadas só pelo gatilho
grant select on public.studio_trechos to authenticated;                        -- trechos são gravados só pelo gatilho
revoke all on function public.studio_buscar(uuid, text, integer) from public, anon;
grant execute on function public.studio_buscar(uuid, text, integer) to authenticated;
revoke all on function public.studio_documentos(uuid) from public, anon;
grant execute on function public.studio_documentos(uuid) to authenticated;
revoke all on function interno.studio_cortar(text, integer) from public, anon, authenticated;

-- ---------- 8. o agente em branco ----------
insert into public.studio_agentes (id, nome, descricao)
  values ('5f0c1d2e-0000-4000-8000-00000000c1c0', 'Assistente CicloDev', 'O assistente de IA de cada usuário. Em branco: o dono do sistema define o que ele sabe e o que faz.')
  on conflict (id) do nothing;

-- >>>>>>>>>> 18_tarefas_lixeira_modelos.sql
-- =====================================================================
-- Parte 18: itens mais completos, lixeira e modelos
-- Depende das partes 01 a 17.
--
-- O que entra:
--   1. Item que se repete (recorrencia): quando é concluído, a tela cria o próximo.
--   2. Lembrete no item (lembrete_em): na hora marcada vira aviso no sininho.
--   3. Histórico da descrição (itens_descricao_versoes): cada versão fica guardada,
--      juntando as edições seguidas da mesma pessoa em 10 minutos.
--   4. Lixeira: excluir item, cliente, projeto, produto, aplicação ou frente guarda
--      por 30 dias (excluido_em). Dá para restaurar. Depois de 30 dias, sai de vez.
--   5. Modelos (modelos): item pronto e estrutura pronta (projeto, produto,
--      aplicação ou frente, com o que tem dentro), para criar a partir deles.
--
-- Regras de acesso: as mesmas do resto. Mexe na lixeira quem pode editar o ponto.
-- Modelos são do espaço de quem criou.
-- =====================================================================

-- ---------- 1. colunas novas ----------
alter table public.itens
  add column if not exists recorrencia jsonb,
  add column if not exists lembrete_em timestamptz,
  add column if not exists lembrete_para uuid references public.pessoas(id) on delete set null,
  add column if not exists lembrete_enviado_em timestamptz,
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.pessoas(id) on delete set null;
alter table public.nos
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.pessoas(id) on delete set null;

comment on column public.itens.recorrencia is 'Repetição: {"freq":"dia|semana|mes|ano","a_cada":1,"ate":"2027-01-31"}. Quando o item é concluído, a tela cria o próximo e passa a repetição para ele.';
comment on column public.itens.lembrete_em is 'Quando lembrar. Na hora, vira aviso para lembrete_para (rotina a cada minuto).';
comment on column public.itens.excluido_em is 'Na lixeira desde. Some das telas; sai de vez 30 dias depois.';
comment on column public.nos.excluido_em is 'Na lixeira desde (com tudo o que tem dentro). Sai de vez 30 dias depois.';

do $$ begin
  alter table public.itens add constraint itens_recorrencia_ok check (recorrencia is null or (
    jsonb_typeof(recorrencia) = 'object' and recorrencia->>'freq' in ('dia','semana','mes','ano')
    and coalesce(recorrencia->>'a_cada', '1') ~ '^[1-9][0-9]{0,2}$'
    and (recorrencia->>'ate' is null or recorrencia->>'ate' ~ '^\d{4}-\d{2}-\d{2}$')));
exception when duplicate_object then null; end $$;

create index if not exists itens_lembrete_idx on public.itens (lembrete_em) where lembrete_em is not null and lembrete_enviado_em is null;
create index if not exists itens_excluido_idx on public.itens (excluido_em) where excluido_em is not null;
create index if not exists nos_excluido_idx on public.nos (excluido_em) where excluido_em is not null;

-- lembrete: ao mudar a hora, volta a valer; se ninguém foi escolhido, lembra quem marcou
create or replace function interno.itens_lembrete() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.lembrete_em is distinct from old.lembrete_em then
    new.lembrete_enviado_em := null;
    if new.lembrete_em is not null and new.lembrete_para is null then new.lembrete_para := interno.pessoa_atual(); end if;
  end if;
  return new;
end $$;
drop trigger if exists itens_lembrete on public.itens;
create trigger itens_lembrete before insert or update of lembrete_em, lembrete_para on public.itens for each row execute function interno.itens_lembrete();

-- item na lixeira não aparece para ninguém (a lixeira lê pelo servidor)
drop policy if exists ver on public.itens;
create policy ver on public.itens for select to authenticated using (
  excluido_em is null and frente_id in (select interno.nos_visiveis()) and (visivel_cliente or not (select interno.eh_stakeholder())));

-- ---------- 2. histórico da descrição ----------
create table if not exists public.itens_descricao_versoes (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.itens(id) on delete cascade,
  texto     text not null default '',
  autor_id  uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists itens_descricao_versoes_idx on public.itens_descricao_versoes (item_id, criado_em desc);
comment on table public.itens_descricao_versoes is 'Cada versão da descrição de um item. Quem mexe seguido (até 10 minutos) fica numa versão só.';

create or replace function interno.itens_guardar_descricao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); ult record;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.descricao, '') <> '' then insert into public.itens_descricao_versoes (item_id, texto, autor_id) values (new.id, new.descricao, eu); end if;
    return null;
  end if;
  if new.descricao is not distinct from old.descricao then return null; end if;
  -- item antigo, sem histórico ainda: guarda primeiro como estava
  if coalesce(old.descricao, '') <> '' and not exists (select 1 from public.itens_descricao_versoes v where v.item_id = new.id) then
    insert into public.itens_descricao_versoes (item_id, texto, autor_id, criado_em) values (new.id, old.descricao, null, coalesce(old.atualizado_em, now()) - interval '1 second');
  end if;
  select v.id, v.autor_id, v.criado_em into ult from public.itens_descricao_versoes v where v.item_id = new.id order by v.criado_em desc limit 1;
  if ult.id is not null and ult.autor_id is not distinct from eu and ult.criado_em > now() - interval '10 minutes' then
    update public.itens_descricao_versoes set texto = coalesce(new.descricao, ''), criado_em = now() where id = ult.id;
  else
    insert into public.itens_descricao_versoes (item_id, texto, autor_id) values (new.id, coalesce(new.descricao, ''), eu);
  end if;
  return null;
end $$;
drop trigger if exists itens_descricao_versoes on public.itens;
create trigger itens_descricao_versoes after insert or update of descricao on public.itens for each row execute function interno.itens_guardar_descricao();

alter table public.itens_descricao_versoes enable row level security;
drop policy if exists ver on public.itens_descricao_versoes;
create policy ver on public.itens_descricao_versoes for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
revoke all on public.itens_descricao_versoes from anon, authenticated;
grant select on public.itens_descricao_versoes to authenticated;   -- só o gatilho grava

-- ---------- 3. modelos ----------
create table if not exists public.modelos (
  id            uuid primary key default gen_random_uuid(),
  espaco_id     uuid not null default interno.meu_espaco() references public.espacos(id) on delete cascade,
  tipo          text not null check (tipo in ('item','estrutura')),
  nivel         text check (nivel in ('projeto','produto','aplicacao','frente')),
  nome          text not null check (length(btrim(nome)) between 1 and 120),
  descricao     text,
  conteudo      jsonb not null default '{}'::jsonb,
  criado_por    uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint modelos_nivel_ok check ((tipo = 'estrutura') = (nivel is not null)),
  constraint modelos_tamanho_ok check (pg_column_size(conteudo) < 800000)
);
create index if not exists modelos_espaco_idx on public.modelos (espaco_id, tipo, nome);
comment on table public.modelos is 'Modelos prontos: um item (com checklist e subitens) ou uma estrutura (projeto, produto, aplicação ou frente com o que tem dentro).';
alter table public.modelos enable row level security;
drop policy if exists ver on public.modelos; drop policy if exists cria on public.modelos; drop policy if exists muda on public.modelos; drop policy if exists apaga on public.modelos;
create policy ver on public.modelos for select to authenticated using (espaco_id in (select interno.meus_espacos()));
create policy cria on public.modelos for insert to authenticated with check (espaco_id in (select interno.meus_espacos()));
create policy muda on public.modelos for update to authenticated using (espaco_id in (select interno.meus_espacos())) with check (espaco_id in (select interno.meus_espacos()));
create policy apaga on public.modelos for delete to authenticated using (espaco_id in (select interno.meus_espacos()));
revoke all on public.modelos from anon, authenticated;
grant select, insert, update, delete on public.modelos to authenticated;

create or replace function interno.modelos_tocar() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists modelos_tocar on public.modelos;
create trigger modelos_tocar before update on public.modelos for each row execute function interno.modelos_tocar();

-- ---------- 4. lixeira ----------
-- pode mexer no ponto: é do meu espaço, ou está dentro de algo compartilhado comigo como owner ou dev
-- (o ponto compartilhado em si só quem é dono do espaço exclui, como na regra de apagar da parte 15)
create or replace function interno.pode_excluir_no(p_no uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.nos n where n.id = p_no and n.espaco_id in (select interno.meus_espacos()))
      or exists (select 1 from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
                  where a.no_id = p_no and a.distancia > 0 and p.papel in ('owner','dev'))
$$;
-- o ponto está escondido por estar dentro de algo na lixeira (ou nele mesmo)?
create or replace function interno.no_na_lixeira(p_no uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select n.nome from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
   where a.no_id = p_no and n.excluido_em is not null order by a.distancia desc limit 1
$$;

create or replace function public.lixeira_mover(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); agora timestamptz := now(); fr uuid;
begin
  if eu is null then raise exception 'Entre no sistema para excluir.'; end if;
  if p_tipo = 'item' then
    select frente_id into fr from public.itens where id = p_id and excluido_em is null;
    if fr is null then raise exception 'Item não encontrado ou já está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode excluir este item.'; end if;
    -- o item e tudo o que está dentro dele (subitens) vão juntos, com a mesma hora
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id where i.excluido_em is null)
    update public.itens set excluido_em = agora, excluido_por = eu where id in (select id from sub);
  elsif p_tipo = 'no' then
    if not exists (select 1 from public.nos where id = p_id and excluido_em is null) then raise exception 'Não encontrado ou já está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode excluir este ponto da estrutura.'; end if;
    update public.nos set excluido_em = agora, excluido_por = eu where id = p_id;
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $$;

create or replace function public.lixeira_restaurar(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
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
end $$;

-- apaga de verdade (sem volta). Usada pela tela ("Apagar de vez") e pela limpeza de 30 dias.
create or replace function interno.lixeira_apagar_sem_conferir(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if p_tipo = 'item' then
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id)
    delete from public.itens where id in (select id from sub);
  else
    -- itens das frentes, custos, receitas e pedidos que ficam dentro; depois os pontos, do mais fundo para cima
    delete from public.itens where frente_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    delete from public.custos_tecnicos where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    delete from public.receitas where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    delete from public.pedidos where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    update public.dominios set no_id = null where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    for r in select no_id from public.nos_ancestrais where ancestral_id = p_id order by distancia desc loop
      delete from public.nos where id = r.no_id;
    end loop;
  end if;
end $$;

create or replace function public.lixeira_apagar(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare fr uuid;
begin
  if interno.pessoa_atual() is null then raise exception 'Entre no sistema.'; end if;
  if p_tipo = 'item' then
    select frente_id into fr from public.itens where id = p_id and excluido_em is not null;
    if fr is null then raise exception 'Só dá para apagar de vez o que está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode apagar este item.'; end if;
  elsif p_tipo = 'no' then
    if not exists (select 1 from public.nos where id = p_id and excluido_em is not null) then raise exception 'Só dá para apagar de vez o que está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode apagar este ponto da estrutura.'; end if;
  else raise exception 'Tipo inválido: %', p_tipo; end if;
  perform interno.lixeira_apagar_sem_conferir(p_tipo, p_id);
end $$;

-- o que está na lixeira e eu posso ver: só o que foi excluído diretamente (o que estava dentro vai junto)
create or replace function public.lixeira_listar() returns table (
  tipo text, id uuid, nome text, onde text, excluido_em timestamptz, excluido_por text, dentro integer, apaga_em timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
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
$$;

-- limpeza: o que está na lixeira há mais de 30 dias sai de vez
create or replace function interno.lixeira_limpar() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in select n2.id from public.nos n2 where n2.excluido_em < now() - interval '30 days'
            and not exists (select 1 from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = n2.id and a.distancia > 0 and x.excluido_em is not null) loop
    perform interno.lixeira_apagar_sem_conferir('no', r.id); n := n + 1;
  end loop;
  for r in select i.id from public.itens i where i.excluido_em < now() - interval '30 days'
            and not exists (select 1 from public.itens p where p.id = i.pai_id and p.excluido_em is not null) loop
    perform interno.lixeira_apagar_sem_conferir('item', r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- lembretes: na hora marcada, aviso no sininho de quem pediu
create or replace function interno.enviar_lembretes() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  with vence as (
    select i.id, i.titulo, i.lembrete_para from public.itens i
     where i.lembrete_em <= now() and i.lembrete_enviado_em is null and i.excluido_em is null and i.lembrete_para is not null
     for update skip locked),
  aviso as (insert into public.notificacoes (pessoa_id, titulo, texto, item_id)
            select v.lembrete_para, 'Lembrete: ' || v.titulo, 'Você pediu para ser lembrado deste item agora.', v.id from vence v returning 1)
  update public.itens set lembrete_enviado_em = now() where id in (select id from vence);
  get diagnostics n = row_count;
  return n;
end $$;

-- prazo vencido: item na lixeira não dispara automação
create or replace function interno.automacoes_prazo_vencido() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; r record;
begin
  for r in select s.id from bi.itens_situacao s join public.itens i on i.id = s.id
            where s.grupo <> 'done' and s.prazo = bi.hoje() - 1 and i.excluido_em is null and interno.no_na_lixeira(i.frente_id) is null loop
    perform interno.rodar_automacoes(r.id, 'prazo_vencido'); n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.lixeira_mover(text, uuid), public.lixeira_restaurar(text, uuid), public.lixeira_apagar(text, uuid), public.lixeira_listar() from public, anon;
grant execute on function public.lixeira_mover(text, uuid), public.lixeira_restaurar(text, uuid), public.lixeira_apagar(text, uuid), public.lixeira_listar() to authenticated;
revoke all on function interno.lixeira_apagar_sem_conferir(text, uuid), interno.lixeira_limpar(), interno.enviar_lembretes() from public, anon, authenticated;
grant execute on function interno.pode_excluir_no(uuid), interno.no_na_lixeira(uuid) to authenticated;

-- rotinas (só no Supabase, onde existe pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('ciclodev_lembretes', 'ciclodev_lixeira');
    perform cron.schedule('ciclodev_lembretes', '* * * * *', 'select interno.enviar_lembretes()');
    perform cron.schedule('ciclodev_lixeira', '23 4 * * *', 'select interno.lixeira_limpar()');
  end if;
end $$;

-- >>>>>>>>>> 19_codigo_entregas.sql
-- =====================================================================
-- Parte 19: desenvolvimento ligado ao código (GitHub e GitLab), publicações e notas de versão
-- Depende das partes 01 a 18 e do pgcrypto (no Supabase ele fica no schema extensions).
--
-- O que entra:
--   1. Repositórios (repositorios): um repositório do GitHub ou do GitLab ligado a um projeto
--      ou a uma aplicação. Cada um tem um segredo próprio para o aviso automático (webhook).
--      O segredo fica em interno.repositorios_segredos, que a tela não lê; só quem pode editar
--      o ponto vê o segredo, pela função repositorio_segredo.
--   2. Código no item (codigo_vinculos): branch, commit e pull request (merge request no GitLab)
--      de cada item. Chegam sozinhos pelo aviso automático, achando a chave do item (ex.: BL-37)
--      no nome do branch, na mensagem do commit ou no título do PR. Também dá para colar um link.
--   3. O status muda sozinho (se o repositório estiver com mover_status ligado):
--      branch ou commit leva para Em andamento, PR aberto para Em revisão, PR mesclado para Concluído.
--      Só anda para a frente: nunca volta um item.
--   4. Publicações (publicacoes): o registro do que foi para o ar, quando, em que ambiente e com qual versão.
--      Chega sozinho (release e deployment do GitHub, release e deployment do GitLab) ou é registrado na tela.
--   5. Notas de versão (marcos.notas): as versões são os marcos do tipo release que já existem.
--      A tela gera as notas a partir dos itens concluídos e guarda aqui. Publicação em produção
--      de uma versão com o mesmo nome marca a versão como entregue.
--
-- A função que recebe os avisos (git_receber) só pode ser chamada pela Edge Function git-webhook
-- (papel service_role). Ninguém logado nem de fora chama direto.
-- =====================================================================

-- ---------- 1. versões: notas ----------
alter table public.marcos add column if not exists notas text;
comment on column public.marcos.notas is 'Notas de versão (texto formatado), geradas a partir dos itens concluídos e editáveis. Vale para marcos do tipo release.';

-- ---------- 2. repositórios ----------
create table if not exists public.repositorios (
  id               uuid primary key default gen_random_uuid(),
  no_id            uuid not null references public.nos(id) on delete cascade,
  provedor         text not null check (provedor in ('github','gitlab')),
  nome             text not null check (nome ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$' and length(nome) <= 200),
  url              text check (url is null or url ~ '^https://'),
  branch_principal text not null default 'main' check (length(btrim(branch_principal)) between 1 and 200),
  mover_status     boolean not null default true,
  ativo            boolean not null default true,
  ultimo_evento    text,
  ultimo_evento_em timestamptz,
  ultimo_erro      text,
  criado_por       uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em        timestamptz not null default now(),
  unique (no_id, provedor, nome)
);
create index if not exists repositorios_no_idx on public.repositorios (no_id);
comment on table public.repositorios is 'Repositório do GitHub ou do GitLab ligado a um projeto ou a uma aplicação. O segredo do aviso automático fica em interno.repositorios_segredos.';

create table if not exists interno.repositorios_segredos (
  repositorio_id uuid primary key references public.repositorios(id) on delete cascade,
  segredo        text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  criado_em      timestamptz not null default now()
);
revoke all on interno.repositorios_segredos from public, anon, authenticated;

create or replace function interno.repositorio_criar_segredo() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin insert into interno.repositorios_segredos (repositorio_id) values (new.id) on conflict do nothing; return null; end $$;
drop trigger if exists repositorios_segredo on public.repositorios;
create trigger repositorios_segredo after insert on public.repositorios for each row execute function interno.repositorio_criar_segredo();

-- só quem pode editar o ponto vê (ou troca) o segredo
create or replace function public.repositorio_segredo(p_repo uuid, p_trocar boolean default false) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s text;
begin
  if not exists (select 1 from public.repositorios r where r.id = p_repo and r.no_id in (select interno.nos_editaveis())) then
    raise exception 'Você não pode ver o segredo deste repositório.'; end if;
  if p_trocar then
    insert into interno.repositorios_segredos (repositorio_id, segredo) values (p_repo, encode(gen_random_bytes(24), 'hex'))
    on conflict (repositorio_id) do update set segredo = excluded.segredo, criado_em = now();
  end if;
  select segredo into s from interno.repositorios_segredos where repositorio_id = p_repo;
  if s is null then insert into interno.repositorios_segredos (repositorio_id) values (p_repo) returning segredo into s; end if;
  return s;
end $$;

-- ---------- 3. código de cada item ----------
create table if not exists public.codigo_vinculos (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.itens(id) on delete cascade,
  repositorio_id uuid references public.repositorios(id) on delete cascade,
  provedor       text not null check (provedor in ('github','gitlab','outro')),
  tipo           text not null check (tipo in ('branch','commit','pr')),
  ref            text not null check (length(ref) between 1 and 300),
  titulo         text,
  url            text check (url is null or url ~ '^https?://'),
  estado         text not null default 'ativo' check (estado in ('ativo','aberto','rascunho','mesclado','fechado','excluido')),
  autor          text,
  quando         timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  criado_por     uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null
);
create unique index if not exists codigo_vinculos_uq on public.codigo_vinculos (item_id, coalesce(repositorio_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, ref);
create index if not exists codigo_vinculos_repo_idx on public.codigo_vinculos (repositorio_id, quando desc);
comment on table public.codigo_vinculos is 'Branch, commit e pull request (merge request) ligados a um item. Chegam pelo aviso automático do repositório ou por link colado na tela.';

-- ---------- 4. publicações ----------
create table if not exists public.publicacoes (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  repositorio_id uuid references public.repositorios(id) on delete set null,
  marco_id       uuid references public.marcos(id) on delete set null,
  versao         text check (versao is null or length(versao) <= 120),
  ambiente       text not null default 'producao' check (length(btrim(ambiente)) between 1 and 60),
  status         text not null default 'sucesso' check (status in ('sucesso','falha','em_andamento')),
  origem         text not null default 'manual' check (origem in ('manual','github','gitlab')),
  referencia     text,
  url            text check (url is null or url ~ '^https?://'),
  observacao     text,
  id_externo     text,
  publicado_em   timestamptz not null default now(),
  criado_por     uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create unique index if not exists publicacoes_externo_uq on public.publicacoes (repositorio_id, id_externo) where id_externo is not null;
create index if not exists publicacoes_no_idx on public.publicacoes (no_id, publicado_em desc);
comment on table public.publicacoes is 'O que foi para o ar: quando, em que ambiente, com qual versão e de onde veio (manual, GitHub, GitLab).';

-- ---------- 5. quem vê e quem mexe ----------
alter table public.repositorios enable row level security;
alter table public.codigo_vinculos enable row level security;
alter table public.publicacoes enable row level security;
do $$ declare t text; begin
  foreach t in array array['repositorios','publicacoes'] loop
    execute format('drop policy if exists ver on public.%I', t); execute format('drop policy if exists cria on public.%I', t);
    execute format('drop policy if exists muda on public.%I', t); execute format('drop policy if exists apaga on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using (no_id in (select interno.nos_visiveis()) and not (select interno.eh_stakeholder()))', t);
    execute format('create policy cria on public.%I for insert to authenticated with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy muda on public.%I for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()))', t);
    execute format('create policy apaga on public.%I for delete to authenticated using (no_id in (select interno.nos_editaveis()))', t);
  end loop;
end $$;
drop policy if exists ver on public.codigo_vinculos; drop policy if exists cria on public.codigo_vinculos; drop policy if exists apaga on public.codigo_vinculos;
create policy ver on public.codigo_vinculos for select to authenticated using (
  exists (select 1 from public.itens i where i.id = item_id) and not (select interno.eh_stakeholder()));
create policy cria on public.codigo_vinculos for insert to authenticated with check (
  exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis()))
  and (repositorio_id is null or exists (select 1 from public.repositorios r where r.id = repositorio_id)));
create policy apaga on public.codigo_vinculos for delete to authenticated using (
  exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));
revoke all on public.repositorios, public.codigo_vinculos, public.publicacoes from anon, authenticated;
grant select, insert, update, delete on public.repositorios, public.publicacoes to authenticated;
grant select, insert, delete on public.codigo_vinculos to authenticated;
grant select, insert, update, delete on public.repositorios, public.codigo_vinculos, public.publicacoes to service_role;   -- como na parte 14

-- ---------- 6. receber os avisos do GitHub e do GitLab ----------
-- itens citados num texto (branch, mensagem, título), só dentro do ponto ligado ao repositório
create or replace function interno.codigo_itens(p_no uuid, p_texto text) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct i.id from public.itens i
   where i.excluido_em is null and i.chave is not null
     and upper(i.chave) in (select upper(m[1]) from regexp_matches(coalesce(p_texto, ''), '([A-Za-z][A-Za-z0-9]{0,9}-[0-9]{1,7})', 'g') m)
     and i.frente_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no)
$$;

-- anda o status para a frente (nunca volta): backlog/todo -> doing -> review -> done
create or replace function interno.codigo_mover(p_item uuid, p_para text) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare atual text; novo uuid;
  rank constant jsonb := '{"backlog":0,"todo":1,"doing":2,"blocked":2,"review":3,"done":4}';
begin
  select s.grupo into atual from public.itens i join public.status_fluxo s on s.id = i.status_id where i.id = p_item;
  if atual is null or coalesce((rank->>atual)::int, 0) >= (rank->>p_para)::int then return false; end if;
  select id into novo from public.status_fluxo where no_id is null and chave = p_para;
  if novo is null then return false; end if;
  update public.itens set status_id = novo where id = p_item;
  return true;
end $$;

create or replace function interno.codigo_ligar(p_repo public.repositorios, p_itens uuid[], p_tipo text, p_ref text, p_titulo text, p_url text, p_estado text, p_autor text, p_quando timestamptz)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; it uuid;
begin
  foreach it in array coalesce(p_itens, '{}') loop
    insert into public.codigo_vinculos (item_id, repositorio_id, provedor, tipo, ref, titulo, url, estado, autor, quando, criado_por)
    values (it, p_repo.id, p_repo.provedor, p_tipo, left(p_ref, 300), left(p_titulo, 500), case when p_url ~ '^https?://[^/]' then p_url end, p_estado, left(p_autor, 200), coalesce(p_quando, now()), null)
    on conflict (item_id, coalesce(repositorio_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, ref)
    do update set titulo = coalesce(excluded.titulo, codigo_vinculos.titulo), url = coalesce(excluded.url, codigo_vinculos.url),
                  estado = excluded.estado, autor = coalesce(excluded.autor, codigo_vinculos.autor), atualizado_em = now();
    n := n + 1;
  end loop;
  return n;
end $$;

-- a versão (marco do tipo release) do mesmo projeto com o mesmo nome (v1.2 = 1.2)
create or replace function interno.codigo_versao(p_no uuid, p_nome text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  with pj as (select coalesce((select a.ancestral_id from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
                               where a.no_id = p_no and n.tipo = 'projeto' limit 1), p_no) as id)
  select m.id from public.marcos m
   where m.tipo = 'release' and p_nome is not null
     and m.no_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = (select id from pj))
     and lower(regexp_replace(btrim(m.nome), '^[vV]', '')) = lower(regexp_replace(btrim(p_nome), '^[vV]', ''))
   order by m.data desc limit 1
$$;

create or replace function interno.codigo_publicar(p_repo public.repositorios, p_externo text, p_versao text, p_ambiente text, p_status text, p_ref text, p_url text, p_quando timestamptz)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid; mid uuid := interno.codigo_versao(p_repo.no_id, p_versao);
begin
  insert into public.publicacoes (no_id, repositorio_id, marco_id, versao, ambiente, status, origem, referencia, url, id_externo, publicado_em, criado_por)
  values (p_repo.no_id, p_repo.id, mid, left(p_versao, 120), left(coalesce(nullif(btrim(p_ambiente), ''), 'producao'), 60), p_status, p_repo.provedor, left(p_ref, 200), case when p_url ~ '^https?://[^/]' then p_url end, p_externo, coalesce(p_quando, now()), null)
  on conflict (repositorio_id, id_externo) where id_externo is not null
  do update set status = excluded.status, url = coalesce(excluded.url, publicacoes.url), marco_id = coalesce(publicacoes.marco_id, excluded.marco_id), publicado_em = excluded.publicado_em
  returning id into pid;
  -- publicação em produção que deu certo: a versão de mesmo nome fica entregue
  if mid is not null and p_status = 'sucesso' and p_ambiente = 'producao' then
    update public.marcos set entregue_em = coalesce(entregue_em, (coalesce(p_quando, now()) at time zone 'America/Sao_Paulo')::date) where id = mid;
  end if;
  return pid;
end $$;

-- ambiente com nome da gente: Production/prod -> producao; Preview/staging/homolog -> previa/homologacao
create or replace function interno.codigo_ambiente(p text) returns text language sql immutable set search_path = pg_catalog, pg_temp as $$
  select case when p is null or btrim(p) = '' then 'producao'
              when p ~* '^(prod|production|produ)' then 'producao'
              when p ~* '(preview|previa)' then 'previa'
              when p ~* '(stag|homolog|qa|test)' then 'homologacao'
              else lower(left(btrim(p), 60)) end $$;

create or replace function public.git_receber(p_repo uuid, p_provedor text, p_evento text, p_assinatura text, p_token text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r public.repositorios; s text; j jsonb; ev text := lower(coalesce(p_evento, '')); res jsonb := '{}'::jsonb;
  br text; its uuid[]; its_b uuid[]; c jsonb; n_lig integer := 0; n_mov integer := 0; x uuid;
  pr jsonb; est text; ok_sig boolean;
begin
  select * into r from public.repositorios where id = p_repo;
  if r.id is null then return jsonb_build_object('ok', false, 'erro', 'repositório não encontrado'); end if;
  select segredo into s from interno.repositorios_segredos where repositorio_id = r.id;
  if p_provedor <> r.provedor then ok_sig := false;
  elsif r.provedor = 'github' then ok_sig := s is not null and p_assinatura = 'sha256=' || encode(hmac(convert_to(p_corpo, 'UTF8'), convert_to(s, 'UTF8'), 'sha256'), 'hex');
  else ok_sig := s is not null and p_token = s; end if;
  if not ok_sig then
    update public.repositorios set ultimo_erro = 'Aviso recusado: segredo não confere (' || coalesce(p_evento, '?') || ')', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida');
  end if;
  if not r.ativo then return jsonb_build_object('ok', true, 'ignorado', 'repositório desligado'); end if;
  begin j := p_corpo::jsonb; exception when others then
    update public.repositorios set ultimo_erro = 'Aviso com conteúdo inválido', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;

  if r.provedor = 'github' then
    if ev = 'ping' then res := jsonb_build_object('ping', true);
    elsif ev in ('push') then
      if coalesce(j->>'ref', '') like 'refs/heads/%' then
        br := substr(j->>'ref', 12);
        its_b := array(select interno.codigo_itens(r.no_id, br));
        if coalesce((j->>'deleted')::boolean, false) then
          update public.codigo_vinculos set estado = 'excluido', atualizado_em = now() where repositorio_id = r.id and tipo = 'branch' and ref = br;
        else
          n_lig := n_lig + interno.codigo_ligar(r, its_b, 'branch', br, br, coalesce(j#>>'{repository,html_url}', '') || '/tree/' || br, 'ativo', j#>>'{sender,login}', now());
          for c in select * from jsonb_array_elements(coalesce(j->'commits', '[]')) loop
            its := array(select interno.codigo_itens(r.no_id, c->>'message')) || its_b;
            its := array(select distinct unnest(its));
            n_lig := n_lig + interno.codigo_ligar(r, its, 'commit', c->>'id', split_part(c->>'message', E'\n', 1), c->>'url', 'ativo', c#>>'{author,name}', (c->>'timestamp')::timestamptz);
            if r.mover_status then foreach x in array its loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
          end loop;
          if r.mover_status then foreach x in array coalesce(its_b, '{}') loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
        end if;
      end if;
    elsif ev = 'create' and j->>'ref_type' = 'branch' then
      br := j->>'ref'; its_b := array(select interno.codigo_itens(r.no_id, br));
      n_lig := interno.codigo_ligar(r, its_b, 'branch', br, br, coalesce(j#>>'{repository,html_url}', '') || '/tree/' || br, 'ativo', j#>>'{sender,login}', now());
      if r.mover_status then foreach x in array coalesce(its_b, '{}') loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
    elsif ev = 'delete' and j->>'ref_type' = 'branch' then
      update public.codigo_vinculos set estado = 'excluido', atualizado_em = now() where repositorio_id = r.id and tipo = 'branch' and ref = j->>'ref';
    elsif ev = 'pull_request' then
      pr := j->'pull_request';
      est := case when coalesce((pr->>'merged')::boolean, false) then 'mesclado' when pr->>'state' = 'closed' then 'fechado'
                  when coalesce((pr->>'draft')::boolean, false) then 'rascunho' else 'aberto' end;
      its := array(select interno.codigo_itens(r.no_id, coalesce(pr->>'title', '') || ' ' || coalesce(pr#>>'{head,ref}', '')));
      n_lig := interno.codigo_ligar(r, its, 'pr', pr->>'number', pr->>'title', pr->>'html_url', est, pr#>>'{user,login}', coalesce((pr->>'updated_at')::timestamptz, now()));
      if r.mover_status then foreach x in array coalesce(its, '{}') loop
        if interno.codigo_mover(x, case est when 'mesclado' then 'done' when 'aberto' then 'review' when 'rascunho' then 'doing' else 'backlog' end) then n_mov := n_mov + 1; end if;
      end loop; end if;
    elsif ev = 'release' and j->>'action' in ('published','released') then
      x := interno.codigo_publicar(r, 'release:' || (j#>>'{release,id}'), coalesce(nullif(j#>>'{release,tag_name}', ''), j#>>'{release,name}'), 'producao', 'sucesso',
             j#>>'{release,tag_name}', j#>>'{release,html_url}', coalesce((j#>>'{release,published_at}')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    elsif ev = 'deployment_status' then
      x := interno.codigo_publicar(r, 'deploy:' || (j#>>'{deployment,id}'), j#>>'{deployment,ref}', interno.codigo_ambiente(coalesce(j#>>'{deployment_status,environment}', j#>>'{deployment,environment}')),
             case j#>>'{deployment_status,state}' when 'success' then 'sucesso' when 'failure' then 'falha' when 'error' then 'falha' else 'em_andamento' end,
             left(j#>>'{deployment,sha}', 40), coalesce(nullif(j#>>'{deployment_status,environment_url}', ''), nullif(j#>>'{deployment_status,target_url}', '')), coalesce((j#>>'{deployment_status,updated_at}')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    else res := jsonb_build_object('ignorado', ev); end if;
  else -- GitLab
    if ev = 'push hook' then
      br := regexp_replace(coalesce(j->>'ref', ''), '^refs/heads/', '');
      its_b := array(select interno.codigo_itens(r.no_id, br));
      if coalesce(j->>'after', '') ~ '^0+$' then
        update public.codigo_vinculos set estado = 'excluido', atualizado_em = now() where repositorio_id = r.id and tipo = 'branch' and ref = br;
      else
        n_lig := n_lig + interno.codigo_ligar(r, its_b, 'branch', br, br, coalesce(j#>>'{project,web_url}', '') || '/-/tree/' || br, 'ativo', j->>'user_username', now());
        for c in select * from jsonb_array_elements(coalesce(j->'commits', '[]')) loop
          its := array(select distinct unnest(array(select interno.codigo_itens(r.no_id, c->>'message')) || its_b));
          n_lig := n_lig + interno.codigo_ligar(r, its, 'commit', c->>'id', split_part(c->>'message', E'\n', 1), c->>'url', 'ativo', c#>>'{author,name}', (c->>'timestamp')::timestamptz);
          if r.mover_status then foreach x in array its loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
        end loop;
        if r.mover_status then foreach x in array coalesce(its_b, '{}') loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
      end if;
    elsif ev = 'merge request hook' then
      pr := j->'object_attributes';
      est := case pr->>'state' when 'merged' then 'mesclado' when 'closed' then 'fechado' when 'locked' then 'fechado'
                  else case when coalesce((pr->>'draft')::boolean, (pr->>'work_in_progress')::boolean, false) then 'rascunho' else 'aberto' end end;
      its := array(select interno.codigo_itens(r.no_id, coalesce(pr->>'title', '') || ' ' || coalesce(pr->>'source_branch', '')));
      n_lig := interno.codigo_ligar(r, its, 'pr', pr->>'iid', pr->>'title', pr->>'url', est, j#>>'{user,username}', coalesce((pr->>'updated_at')::timestamptz, now()));
      if r.mover_status then foreach x in array coalesce(its, '{}') loop
        if interno.codigo_mover(x, case est when 'mesclado' then 'done' when 'aberto' then 'review' when 'rascunho' then 'doing' else 'backlog' end) then n_mov := n_mov + 1; end if;
      end loop; end if;
    elsif ev = 'release hook' and coalesce(j->>'action', 'create') in ('create','update') then
      x := interno.codigo_publicar(r, 'release:' || coalesce(j->>'id', j->>'tag'), coalesce(nullif(j->>'tag', ''), j->>'name'), 'producao', 'sucesso', j->>'tag', j->>'url',
             coalesce((j->>'released_at')::timestamptz, (j->>'created_at')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    elsif ev = 'deployment hook' then
      x := interno.codigo_publicar(r, 'deploy:' || (j->>'deployment_id'), j->>'ref', interno.codigo_ambiente(j->>'environment'),
             case j->>'status' when 'success' then 'sucesso' when 'failed' then 'falha' when 'canceled' then 'falha' else 'em_andamento' end,
             left(j->>'sha', 40), nullif(j->>'environment_external_url', ''), coalesce((j->>'status_changed_at')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    else res := jsonb_build_object('ignorado', ev); end if;
  end if;
  update public.repositorios set ultimo_evento = p_evento, ultimo_evento_em = now(), ultimo_erro = null where id = r.id;
  return jsonb_build_object('ok', true, 'evento', p_evento, 'ligados', n_lig, 'status_mudou', n_mov) || res;
end $$;

revoke all on function public.git_receber(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.git_receber(uuid, text, text, text, text, text) to service_role;
revoke all on function public.repositorio_segredo(uuid, boolean) from public, anon;
grant execute on function public.repositorio_segredo(uuid, boolean) to authenticated;
revoke all on function interno.codigo_itens(uuid, text), interno.codigo_mover(uuid, text), interno.codigo_versao(uuid, text),
  interno.codigo_ligar(public.repositorios, uuid[], text, text, text, text, text, text, timestamptz),
  interno.codigo_publicar(public.repositorios, text, text, text, text, text, text, timestamptz),
  interno.repositorio_criar_segredo() from public, anon, authenticated;

-- >>>>>>>>>> 20_comunicacao_metas.sql
-- =====================================================================
-- Parte 20: comunicação (menções, avisos, e-mail) e metas
-- Depende das partes 01 a 19.
--
-- O que entra:
--   1. Preferências de cada pessoa (pessoas_preferencias): como quer receber os avisos por e-mail
--      (na hora, num resumo por dia, ou nunca), de quais tipos, se quer o aviso do navegador,
--      se quer o relatório da semana e a arrumação do "Meu painel".
--   2. Avisos com tipo e fila de e-mail (colunas novas em notificacoes). Os avisos continuam
--      aparecendo no sininho como hoje; o e-mail é uma cópia, que sai pela função enviar-avisos.
--   3. Avisos automáticos:
--      - menção: comentário com @[Nome](id) avisa a pessoa mencionada;
--      - comentário: avisa o responsável, quem pediu e os observadores do item;
--      - responsável: quem passa a ser o responsável de um item é avisado.
--      Ninguém é avisado do que ele mesmo fez, e ninguém recebe aviso de item que não pode ver.
--   4. Metas (metas, metas_resultados, metas_resultados_itens): o objetivo de um projeto,
--      produto ou aplicação num período, com resultados medidos por número ou pelos itens ligados.
--   5. Funções só para a função enviar-avisos (papel service_role): pegar o lote de e-mails,
--      marcar como enviado e montar o relatório da semana.
-- =====================================================================

-- ---------- 1. preferências ----------
create table if not exists public.pessoas_preferencias (
  pessoa_id          uuid primary key references public.pessoas(id) on delete cascade,
  email_modo         text not null default 'diario' check (email_modo in ('imediato','diario','nunca')),
  email_tipos        text[] not null default '{mencao,responsavel,comentario,lembrete}'
                     check (email_tipos <@ '{mencao,responsavel,comentario,lembrete,automacao,aviso}'::text[]),
  navegador          boolean not null default false,
  relatorio_semanal  boolean not null default false,
  painel             jsonb not null default '[]'::jsonb check (jsonb_typeof(painel) = 'array' and pg_column_size(painel) < 20000),
  atualizado_em      timestamptz not null default now()
);
comment on table public.pessoas_preferencias is 'Como cada pessoa quer receber os avisos (e-mail na hora, resumo por dia ou nunca; aviso do navegador; relatório da semana) e a arrumação do Meu painel.';
drop trigger if exists pessoas_preferencias_carimbo on public.pessoas_preferencias;
create trigger pessoas_preferencias_carimbo before update on public.pessoas_preferencias for each row execute function interno.carimbar_atualizacao();

alter table public.pessoas_preferencias enable row level security;
drop policy if exists dono on public.pessoas_preferencias;
create policy dono on public.pessoas_preferencias for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));
revoke all on public.pessoas_preferencias from anon, authenticated;
grant select, insert, update on public.pessoas_preferencias to authenticated;
grant select, insert, update, delete on public.pessoas_preferencias to service_role;

-- ---------- 2. avisos com tipo, quem fez e fila de e-mail ----------
alter table public.notificacoes add column if not exists tipo text not null default 'aviso';
alter table public.notificacoes add column if not exists autor_id uuid references public.pessoas(id) on delete set null;
alter table public.notificacoes add column if not exists email_modo text;
alter table public.notificacoes add column if not exists email_status text;
alter table public.notificacoes add column if not exists email_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'notificacoes_tipo_ck') then
    alter table public.notificacoes add constraint notificacoes_tipo_ck check (tipo in ('mencao','responsavel','comentario','lembrete','automacao','aviso'));
    alter table public.notificacoes add constraint notificacoes_email_ck check ((email_modo is null or email_modo in ('imediato','diario'))
      and (email_status is null or email_status in ('fila','enviando','enviado','erro','ignorado')));
  end if;
end $$;
create index if not exists notificacoes_email_fila_idx on public.notificacoes (email_modo, criado_em) where email_status in ('fila','enviando');
comment on column public.notificacoes.tipo is 'mencao, responsavel, comentario, lembrete, automacao ou aviso.';
comment on column public.notificacoes.email_status is 'Cópia por e-mail: fila (esperando), enviando, enviado, erro, ignorado (já lido antes do resumo). Vazio: não vai por e-mail.';

-- quem pode ver um item (para não avisar ninguém de algo que ele não enxerga)
create or replace function interno.pessoa_ve_item(p_pessoa uuid, p_item uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.itens i join public.pessoas p on p.id = p_pessoa and p.ativo
     where i.id = p_item and i.excluido_em is null
       and (i.visivel_cliente or p.papel <> 'stakeholder')
       and (exists (select 1 from public.nos n join public.espaco_membros m on m.espaco_id = n.espaco_id and m.pessoa_id = p_pessoa where n.id = i.frente_id)
            or exists (select 1 from public.nos_ancestrais a
                        where a.no_id = i.frente_id
                          and a.ancestral_id in (select pa.no_id from public.participacoes pa where pa.pessoa_id = p_pessoa
                                                 union
                                                 select en.no_id from public.equipes_nos en join public.equipes e on e.id = en.equipe_id and e.ativa
                                                   join public.equipes_membros em on em.equipe_id = en.equipe_id where em.pessoa_id = p_pessoa))))
$$;

-- cada aviso novo: tipo certo e, se a pessoa quiser, entra na fila de e-mail
create or replace function interno.notificacao_preparar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare pr record; tem_email boolean;
begin
  if new.tipo = 'aviso' and new.titulo like 'Lembrete:%' then new.tipo := 'lembrete'; end if;   -- os lembretes da parte 18
  select coalesce(x.email_modo, 'diario') as modo, coalesce(x.email_tipos, '{mencao,responsavel,comentario,lembrete}') as tipos
    into pr from public.pessoas p left join public.pessoas_preferencias x on x.pessoa_id = p.id where p.id = new.pessoa_id;
  select p.email is not null and p.ativo into tem_email from public.pessoas p where p.id = new.pessoa_id;
  if coalesce(tem_email, false) and pr.modo <> 'nunca' and new.tipo = any(pr.tipos) then
    new.email_modo := pr.modo; new.email_status := 'fila';
  else
    new.email_modo := null; new.email_status := null;
  end if;
  return new;
end $$;
drop trigger if exists notificacoes_preparar on public.notificacoes;
create trigger notificacoes_preparar before insert on public.notificacoes for each row execute function interno.notificacao_preparar();

-- texto do comentário com as menções escritas como @Nome
create or replace function interno.texto_sem_mencoes(p text) returns text language sql immutable set search_path = pg_catalog, pg_temp as $$
  select regexp_replace(coalesce(p, ''), '@\[([^\]]{1,120})\]\([0-9a-fA-F-]{36}\)', '@\1', 'g')
$$;

-- ---------- 3. avisos automáticos ----------
create or replace function interno.avisar_comentario() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare it record; autor text; resumo text; mencionados uuid[]; alvo uuid;
begin
  if new.item_id is null then return new; end if;
  select i.id, i.titulo, i.chave, i.responsavel_id, i.relator_id into it from public.itens i where i.id = new.item_id and i.excluido_em is null;
  if it.id is null then return new; end if;
  autor := coalesce((select nome from public.pessoas where id = new.autor_id), 'Alguém');
  resumo := left(interno.texto_sem_mencoes(new.texto), 240);
  select coalesce(array_agg(distinct m[1]::uuid), '{}') into mencionados
    from regexp_matches(new.texto, '@\[[^\]]{1,120}\]\(([0-9a-fA-F-]{36})\)', 'g') as m;
  -- quem foi mencionado
  foreach alvo in array mencionados loop
    if alvo is distinct from new.autor_id and exists (select 1 from public.pessoas where id = alvo)
       and interno.pessoa_ve_item(alvo, it.id)
       and (new.visivel_cliente or (select papel from public.pessoas where id = alvo) <> 'stakeholder') then
      insert into public.notificacoes (pessoa_id, titulo, texto, item_id, tipo, autor_id)
      values (alvo, autor || ' mencionou você', coalesce(it.chave || ' ', '') || it.titulo || ': ' || resumo, it.id, 'mencao', new.autor_id);
    end if;
  end loop;
  -- responsável, quem pediu e observadores (sem repetir quem já foi mencionado)
  for alvo in
    select distinct x from unnest(array[it.responsavel_id, it.relator_id]
                                  || coalesce((select array_agg(ip.pessoa_id) from public.itens_pessoas ip where ip.item_id = it.id and ip.papel = 'observador'), '{}')) as x
     where x is not null
  loop
    if alvo is distinct from new.autor_id and not (alvo = any(mencionados))
       and interno.pessoa_ve_item(alvo, it.id)
       and (new.visivel_cliente or (select papel from public.pessoas where id = alvo) <> 'stakeholder') then
      insert into public.notificacoes (pessoa_id, titulo, texto, item_id, tipo, autor_id)
      values (alvo, autor || ' comentou', coalesce(it.chave || ' ', '') || it.titulo || ': ' || resumo, it.id, 'comentario', new.autor_id);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists comentarios_avisar on public.comentarios;
create trigger comentarios_avisar after insert on public.comentarios for each row execute function interno.avisar_comentario();

create or replace function interno.avisar_responsavel() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare quem uuid := interno.pessoa_atual(); autor text;
begin
  if new.responsavel_id is null or new.excluido_em is not null then return new; end if;
  if tg_op = 'UPDATE' and new.responsavel_id is not distinct from old.responsavel_id then return new; end if;
  if new.responsavel_id is not distinct from quem then return new; end if;
  if not interno.pessoa_ve_item(new.responsavel_id, new.id) then return new; end if;
  autor := coalesce((select nome from public.pessoas where id = quem), 'Alguém');
  insert into public.notificacoes (pessoa_id, titulo, texto, item_id, tipo, autor_id)
  values (new.responsavel_id, autor || ' passou um item para você', coalesce(new.chave || ' ', '') || new.titulo, new.id, 'responsavel', quem);
  return new;
end $$;
drop trigger if exists itens_avisar_responsavel on public.itens;
create trigger itens_avisar_responsavel after insert or update of responsavel_id on public.itens for each row execute function interno.avisar_responsavel();

-- ---------- 4. metas ----------
create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  no_id       uuid not null references public.nos(id) on delete cascade,
  titulo      text not null check (length(btrim(titulo)) between 1 and 200),
  descricao   text check (descricao is null or length(descricao) <= 4000),
  dono_id     uuid references public.pessoas(id) on delete set null,
  inicio      date not null default current_date,
  fim         date not null default (current_date + 90),
  situacao    text not null default 'ativa' check (situacao in ('ativa','concluida','cancelada')),
  criado_por  uuid references public.pessoas(id) on delete set null default interno.pessoa_atual(),
  criado_em   timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists metas_no_idx on public.metas (no_id, fim);
comment on table public.metas is 'Metas (OKR: o objetivo) de um ponto da estrutura num período. O progresso vem dos resultados.';

create table if not exists public.metas_resultados (
  id        uuid primary key default gen_random_uuid(),
  meta_id   uuid not null references public.metas(id) on delete cascade,
  titulo    text not null check (length(btrim(titulo)) between 1 and 200),
  medida    text not null default 'numero' check (medida in ('numero','itens')),
  inicial   numeric not null default 0,
  alvo      numeric not null default 100,
  atual     numeric not null default 0,
  unidade   text check (unidade is null or length(unidade) <= 20),
  ordem     integer not null default 0,
  check (medida = 'itens' or alvo <> inicial)
);
create index if not exists metas_resultados_meta_idx on public.metas_resultados (meta_id, ordem);
comment on table public.metas_resultados is 'Resultados de uma meta (OKR: key results). Por número (de inicial até alvo) ou pelos itens ligados (quantos já foram concluídos).';

create table if not exists public.metas_resultados_itens (
  resultado_id  uuid not null references public.metas_resultados(id) on delete cascade,
  item_id       uuid not null references public.itens(id) on delete cascade,
  primary key (resultado_id, item_id)
);
create index if not exists metas_resultados_itens_item_idx on public.metas_resultados_itens (item_id);

alter table public.metas enable row level security;
alter table public.metas_resultados enable row level security;
alter table public.metas_resultados_itens enable row level security;
drop policy if exists ver on public.metas; drop policy if exists cria on public.metas; drop policy if exists muda on public.metas; drop policy if exists apaga on public.metas;
create policy ver on public.metas for select to authenticated using (no_id in (select interno.nos_visiveis()) and not (select interno.eh_stakeholder()));
create policy cria on public.metas for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
create policy muda on public.metas for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy apaga on public.metas for delete to authenticated using (no_id in (select interno.nos_editaveis()));
drop policy if exists ver on public.metas_resultados; drop policy if exists cria on public.metas_resultados; drop policy if exists muda on public.metas_resultados; drop policy if exists apaga on public.metas_resultados;
create policy ver on public.metas_resultados for select to authenticated using (exists (select 1 from public.metas m where m.id = meta_id));
create policy cria on public.metas_resultados for insert to authenticated with check (exists (select 1 from public.metas m where m.id = meta_id and m.no_id in (select interno.nos_editaveis())));
create policy muda on public.metas_resultados for update to authenticated
  using (exists (select 1 from public.metas m where m.id = meta_id and m.no_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.metas m where m.id = meta_id and m.no_id in (select interno.nos_editaveis())));
create policy apaga on public.metas_resultados for delete to authenticated using (exists (select 1 from public.metas m where m.id = meta_id and m.no_id in (select interno.nos_editaveis())));
drop policy if exists ver on public.metas_resultados_itens; drop policy if exists cria on public.metas_resultados_itens; drop policy if exists apaga on public.metas_resultados_itens;
create policy ver on public.metas_resultados_itens for select to authenticated using (exists (select 1 from public.metas_resultados r where r.id = resultado_id));
create policy cria on public.metas_resultados_itens for insert to authenticated with check (
  exists (select 1 from public.metas_resultados r join public.metas m on m.id = r.meta_id where r.id = resultado_id and m.no_id in (select interno.nos_editaveis()))
  and exists (select 1 from public.itens i where i.id = item_id));
create policy apaga on public.metas_resultados_itens for delete to authenticated using (
  exists (select 1 from public.metas_resultados r join public.metas m on m.id = r.meta_id where r.id = resultado_id and m.no_id in (select interno.nos_editaveis())));
revoke all on public.metas, public.metas_resultados, public.metas_resultados_itens from anon, authenticated;
grant select, insert, update, delete on public.metas, public.metas_resultados to authenticated;
grant select, insert, delete on public.metas_resultados_itens to authenticated;
grant select, insert, update, delete on public.metas, public.metas_resultados, public.metas_resultados_itens to service_role;

-- ---------- 5. para a função enviar-avisos (só service_role) ----------
-- pega o próximo lote de e-mails de um modo (imediato ou diario), já agrupado por pessoa
create or replace function public.avisos_email_lote(p_modo text, p_limite integer default 300) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  if p_modo not in ('imediato','diario') then raise exception 'modo inválido'; end if;
  -- quem ficou preso em "enviando" por muito tempo volta para a fila
  update public.notificacoes set email_status = 'fila' where email_status = 'enviando' and email_em < now() - interval '30 minutes';
  -- o que já foi lido no sistema não vai no resumo do dia
  if p_modo = 'diario' then
    update public.notificacoes set email_status = 'ignorado', email_em = now() where email_status = 'fila' and email_modo = 'diario' and lida_em is not null;
  end if;
  with lote as (
    select n.id from public.notificacoes n
     where n.email_status = 'fila' and n.email_modo = p_modo
     order by n.criado_em limit greatest(1, least(coalesce(p_limite, 300), 1000))
     for update skip locked),
  marcados as (
    update public.notificacoes n set email_status = 'enviando', email_em = now() from lote where n.id = lote.id
    returning n.id, n.pessoa_id, n.titulo, n.texto, n.item_id, n.tipo, n.criado_em)
  select coalesce(jsonb_agg(p order by p->>'nome'), '[]'::jsonb) into r from (
    select jsonb_build_object('pessoa_id', pe.id, 'nome', pe.nome, 'email', pe.email,
             'avisos', jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.tipo, 'titulo', m.titulo, 'texto', m.texto, 'item_id', m.item_id, 'quando', m.criado_em) order by m.criado_em)) as p
      from marcados m join public.pessoas pe on pe.id = m.pessoa_id
     where pe.email is not null
     group by pe.id, pe.nome, pe.email) x;
  return r;
end $$;

create or replace function public.avisos_email_marcar(p_ids uuid[], p_ok boolean) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update public.notificacoes set email_status = case when p_ok then 'enviado' else 'erro' end, email_em = now()
   where id = any(p_ids) and email_status = 'enviando';
  get diagnostics n = row_count;
  return n;
end $$;

-- relatório da semana de cada pessoa que pediu: o que ela concluiu, o que está atrasado e o que vence nos próximos 7 dias
create or replace function public.relatorio_semanal_lote() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'pessoa_id', pe.id, 'nome', pe.nome, 'email', pe.email,
      'feitos', (select coalesce(jsonb_agg(jsonb_build_object('chave', i.chave, 'titulo', i.titulo) order by i.concluido_em), '[]'::jsonb)
                   from public.itens i join public.status_fluxo s on s.id = i.status_id
                  where i.responsavel_id = pe.id and i.excluido_em is null and s.grupo = 'done' and i.concluido_em >= now() - interval '7 days'),
      'atrasados', (select coalesce(jsonb_agg(jsonb_build_object('chave', i.chave, 'titulo', i.titulo, 'prazo', i.prazo) order by i.prazo), '[]'::jsonb)
                   from public.itens i join public.status_fluxo s on s.id = i.status_id
                  where i.responsavel_id = pe.id and i.excluido_em is null and i.arquivado_em is null and s.grupo <> 'done' and i.prazo < current_date),
      'proximos', (select coalesce(jsonb_agg(jsonb_build_object('chave', i.chave, 'titulo', i.titulo, 'prazo', i.prazo) order by i.prazo), '[]'::jsonb)
                   from public.itens i join public.status_fluxo s on s.id = i.status_id
                  where i.responsavel_id = pe.id and i.excluido_em is null and i.arquivado_em is null and s.grupo <> 'done' and i.prazo between current_date and current_date + 7),
      'nao_lidos', (select count(*) from public.notificacoes n where n.pessoa_id = pe.id and n.lida_em is null)
    ) order by pe.nome), '[]'::jsonb)
    from public.pessoas pe join public.pessoas_preferencias pr on pr.pessoa_id = pe.id
   where pr.relatorio_semanal and pe.ativo and pe.email is not null
$$;

revoke all on function public.avisos_email_lote(text, integer), public.avisos_email_marcar(uuid[], boolean), public.relatorio_semanal_lote() from public, anon, authenticated;
grant execute on function public.avisos_email_lote(text, integer), public.avisos_email_marcar(uuid[], boolean), public.relatorio_semanal_lote() to service_role;
revoke all on function interno.pessoa_ve_item(uuid, uuid), interno.notificacao_preparar(), interno.avisar_comentario(), interno.avisar_responsavel() from public, anon, authenticated;
grant execute on function interno.texto_sem_mencoes(text) to authenticated, service_role;

-- As rotinas que chamam a função enviar-avisos (a cada 5 minutos, o resumo às 8h e o relatório de segunda)
-- NÃO entram aqui: precisam da extensão pg_net e do segredo no Vault. Estão em 21_avisos_email_SUPABASE.sql,
-- para aplicar só depois de a função estar no ar e o envio de e-mail configurado.

-- >>>>>>>>>> 22_preferencias_tela.sql
-- =====================================================================
-- CicloDev · 22 · Preferências de tela e lembretes já vistos no banco
-- Antes ficavam só no navegador (e sumiam ao trocar de computador ou limpar o navegador):
--   tela              : tema escuro, abas escolhidas da barra, largura da Estrutura, o que está aberto nela,
--                       onde a pessoa estava (ponto e aba) e os filtros de cada tela
--   lembretes_vistos  : quais lembretes já apareceram na tela desta pessoa (para não repetir o aviso)
-- Cada pessoa só lê e grava a própria linha (política "dono" da parte 20). Depende da parte 20.
-- =====================================================================
alter table public.pessoas_preferencias
  add column if not exists tela jsonb not null default '{}'::jsonb,
  add column if not exists lembretes_vistos jsonb not null default '{}'::jsonb;

alter table public.pessoas_preferencias drop constraint if exists pessoas_preferencias_tela_ok;
alter table public.pessoas_preferencias add constraint pessoas_preferencias_tela_ok
  check (jsonb_typeof(tela) = 'object' and pg_column_size(tela) < 60000);
alter table public.pessoas_preferencias drop constraint if exists pessoas_preferencias_lembretes_ok;
alter table public.pessoas_preferencias add constraint pessoas_preferencias_lembretes_ok
  check (jsonb_typeof(lembretes_vistos) = 'object' and pg_column_size(lembretes_vistos) < 60000);

comment on column public.pessoas_preferencias.tela is 'Arrumação da tela desta pessoa: tema, abas da barra, largura e itens abertos da Estrutura, último ponto e aba, filtros.';
comment on column public.pessoas_preferencias.lembretes_vistos is 'Lembretes que já apareceram na tela desta pessoa: chave "item|quando" e o momento em que apareceu.';

-- >>>>>>>>>> 23_portal_stakeholder.sql
-- =====================================================================
-- CicloDev · 23 · Portal do stakeholder (primeiro uso: Blanco & Lisboa, no sistema Java deles)
--
-- Um portal é uma janela só de leitura para um cliente da Estrutura, com uma única coisa que dá para fazer
-- de fora: responder as perguntas que a equipe manda. Tudo fica aqui no banco do CicloDev; o sistema de fora
-- (o Java da Blanco & Lisboa) não guarda nada, só mostra e responde pela função portal-api.
--
--   portais                 o portal: de qual cliente da Estrutura e de quem é (só o dono vê e mexe)
--   portais_membros         quem pode responder pelo portal (o dono convida pelo e-mail)
--   portais_chaves          as chaves que o sistema de fora usa para chamar a função (só o resumo fica guardado)
--   portais_segredos        o segredo que assina os avisos enviados ao sistema de fora (ninguém lê pela tela)
--   perguntas_stakeholder   cada pergunta mandada a partir de um item ou épico, com a resposta
--   portais_eventos         a fila de avisos para o sistema de fora (pergunta nova, respondida, cancelada)
--
-- Mandar uma pergunta muda o item para o status "Aguardando stakeholder"; a resposta volta o item para o status
-- que ele tinha, vira comentário no item e avisa no sininho de quem perguntou e do dono do portal.
-- Depende das partes 01, 02, 14, 15 e 20.
-- =====================================================================

create table if not exists public.portais (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null references public.pessoas(id) on delete cascade,
  no_id       uuid not null references public.nos(id) on delete cascade,
  nome        text not null check (length(btrim(nome)) between 1 and 120),
  ativo       boolean not null default true,
  webhook_url text check (webhook_url is null or webhook_url ~ '^https://[^\s]+$'),
  criado_em   timestamptz not null default now(),
  unique (no_id)
);
comment on table public.portais is 'Portal do stakeholder: um cliente da Estrutura visto de fora, só para ler e responder perguntas. Só o dono vê.';

create table if not exists public.portais_membros (
  portal_id    uuid not null references public.portais(id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  nome         text not null check (length(btrim(nome)) between 1 and 120),
  ativo        boolean not null default true,
  convidado_em timestamptz not null default now(),
  primary key (portal_id, email)
);
comment on table public.portais_membros is 'Quem pode responder pelo portal. O sistema de fora diz o e-mail de quem está respondendo; só e-mail ativo daqui passa.';

create table if not exists public.portais_chaves (
  id          uuid primary key default gen_random_uuid(),
  portal_id   uuid not null references public.portais(id) on delete cascade,
  nome        text not null default 'Chave',
  prefixo     text not null,
  resumo      text not null unique,   -- sha256 da chave; a chave em si só aparece uma vez, na hora de gerar
  criada_em   timestamptz not null default now(),
  usada_em    timestamptz,
  revogada_em timestamptz
);
comment on table public.portais_chaves is 'Chaves do sistema de fora. Guarda só o resumo (sha256) e o começo, para reconhecer na tela.';

create table if not exists public.portais_segredos (
  portal_id       uuid primary key references public.portais(id) on delete cascade,
  webhook_segredo text not null
);
comment on table public.portais_segredos is 'Segredo que assina os avisos enviados ao sistema de fora. Ninguém lê pela tela: só a rotina do banco.';

create table if not exists public.perguntas_stakeholder (
  id                   uuid primary key default gen_random_uuid(),
  portal_id            uuid not null references public.portais(id) on delete cascade,
  item_id              uuid not null references public.itens(id) on delete cascade,
  pergunta             text not null check (length(btrim(pergunta)) between 1 and 4000),
  criada_por           uuid references public.pessoas(id) on delete set null,
  criada_em            timestamptz not null default now(),
  status               text not null default 'aguardando' check (status in ('aguardando','respondida','cancelada')),
  resposta             text check (resposta is null or length(resposta) <= 8000),
  respondida_por_email text,
  respondida_por_nome  text,
  respondida_em        timestamptz,
  status_antes         uuid references public.status_fluxo(id) on delete set null,
  check ((status = 'respondida') = (resposta is not null and respondida_em is not null))
);
create index if not exists perguntas_item_idx on public.perguntas_stakeholder (item_id);
create index if not exists perguntas_portal_idx on public.perguntas_stakeholder (portal_id, status, criada_em desc);
comment on table public.perguntas_stakeholder is 'Perguntas mandadas ao stakeholder a partir de um item ou épico, com a resposta que veio pelo portal.';

create table if not exists public.portais_eventos (
  id          bigint generated always as identity primary key,
  portal_id   uuid not null references public.portais(id) on delete cascade,
  tipo        text not null check (tipo in ('pergunta_criada','pergunta_respondida','pergunta_cancelada')),
  dados       jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now(),
  pedido_id   bigint,          -- pedido do pg_net em andamento
  enviado_em  timestamptz,     -- quando o pedido em andamento saiu (sem resposta em 10 minutos, tenta de novo)
  tentativas  smallint not null default 0,
  entregue_em timestamptz,
  ultimo_erro text
);
create index if not exists portais_eventos_fila_idx on public.portais_eventos (portal_id, id) where entregue_em is null;
comment on table public.portais_eventos is 'Fila de avisos ao sistema de fora. A rotina da parte 24 manda por webhook; o sistema de fora também pode buscar pela função.';

-- ---------------------------------------------------------------------
-- regras de acesso: tudo do portal só para o dono; as perguntas também para quem enxerga o item
-- ---------------------------------------------------------------------
alter table public.portais enable row level security;
alter table public.portais_membros enable row level security;
alter table public.portais_chaves enable row level security;
alter table public.portais_segredos enable row level security;
alter table public.perguntas_stakeholder enable row level security;
alter table public.portais_eventos enable row level security;

drop policy if exists dono on public.portais;
create policy dono on public.portais for all to authenticated
  using (dono_id = (select interno.pessoa_atual())) with check (dono_id = (select interno.pessoa_atual()));
drop policy if exists dono on public.portais_membros;
create policy dono on public.portais_membros for all to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())))
  with check (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())));
drop policy if exists dono_ve on public.portais_chaves;
create policy dono_ve on public.portais_chaves for select to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())));
drop policy if exists ver on public.perguntas_stakeholder;
create policy ver on public.perguntas_stakeholder for select to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual()))
         or exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_visiveis())));
drop policy if exists dono_ve on public.portais_eventos;
create policy dono_ve on public.portais_eventos for select to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())));

revoke all on public.portais, public.portais_membros, public.portais_chaves, public.portais_segredos, public.perguntas_stakeholder, public.portais_eventos from anon, authenticated;
grant select, update on public.portais to authenticated;
grant select, insert, update, delete on public.portais_membros to authenticated;
grant select on public.portais_chaves, public.perguntas_stakeholder, public.portais_eventos to authenticated;
grant all on public.portais, public.portais_membros, public.portais_chaves, public.portais_segredos, public.perguntas_stakeholder, public.portais_eventos to service_role;
grant usage, select on all sequences in schema public to service_role;

-- o dono não muda de quem é nem de qual cliente é pela tela (só nome, ativo e endereço do webhook)
create or replace function interno.portal_so_campos_livres() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.dono_id <> old.dono_id or new.no_id <> old.no_id or new.id <> old.id then
    raise exception 'O portal não muda de dono nem de cliente' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists portais_campos_livres on public.portais;
create trigger portais_campos_livres before update on public.portais for each row execute function interno.portal_so_campos_livres();

-- ---------------------------------------------------------------------
-- funções que a tela do CicloDev chama
-- ---------------------------------------------------------------------
-- o status "Aguardando stakeholder" do cliente do portal (cria se não existir)
create or replace function interno.portal_status_aguardando(p_no uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid;
begin
  select id into v from public.status_fluxo where no_id = p_no and chave = 'aguardando_stakeholder';
  if v is null then
    insert into public.status_fluxo (no_id, chave, nome, explicacao, cor, grupo, ordem)
    values (p_no, 'aguardando_stakeholder', 'Aguardando stakeholder', 'Mandamos uma pergunta ao stakeholder e esperamos a resposta.', '#B04A00', 'blocked', 90)
    returning id into v;
  end if;
  return v;
end $$;

create or replace function public.portal_criar(p_no uuid, p_nome text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); v uuid; tp text;
begin
  if eu is null then raise exception 'Entre no sistema primeiro' using errcode = '42501'; end if;
  select tipo into tp from public.nos where id = p_no;
  if tp is distinct from 'cliente' then raise exception 'O portal é de um cliente da Estrutura' using errcode = '22023'; end if;
  if p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mexer neste cliente' using errcode = '42501'; end if;
  insert into public.portais (dono_id, no_id, nome) values (eu, p_no, btrim(p_nome)) returning id into v;
  perform interno.portal_status_aguardando(p_no);
  return v;
end $$;

-- a chave aparece só agora, uma vez; o banco guarda só o resumo
create or replace function public.portal_gerar_chave(p_portal uuid, p_nome text default 'Chave') returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare chave text;
begin
  if not exists (select 1 from public.portais where id = p_portal and dono_id = interno.pessoa_atual()) then raise exception 'Portal não encontrado' using errcode = '42501'; end if;
  chave := 'cdp_' || translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.portais_chaves (portal_id, nome, prefixo, resumo) values (p_portal, coalesce(nullif(btrim(p_nome), ''), 'Chave'), left(chave, 10), encode(digest(chave, 'sha256'), 'hex'));
  return chave;
end $$;

create or replace function public.portal_revogar_chave(p_chave uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.portais_chaves c set revogada_em = now() where c.id = p_chave and c.revogada_em is null
    and c.portal_id in (select id from public.portais where dono_id = interno.pessoa_atual());
  if not found then raise exception 'Chave não encontrada' using errcode = '42501'; end if;
end $$;

-- endereço do webhook e um segredo novo para assinar (o segredo aparece só agora)
create or replace function public.portal_webhook(p_portal uuid, p_url text) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s text;
begin
  if not exists (select 1 from public.portais where id = p_portal and dono_id = interno.pessoa_atual()) then raise exception 'Portal não encontrado' using errcode = '42501'; end if;
  update public.portais set webhook_url = nullif(btrim(p_url), '') where id = p_portal;
  if nullif(btrim(p_url), '') is null then delete from public.portais_segredos where portal_id = p_portal; return null; end if;
  s := 'cdw_' || encode(gen_random_bytes(24), 'hex');
  insert into public.portais_segredos (portal_id, webhook_segredo) values (p_portal, s)
    on conflict (portal_id) do update set webhook_segredo = excluded.webhook_segredo;
  return s;
end $$;

-- os dados de uma pergunta como vão no aviso e na função
create or replace function interno.portal_pergunta_json(p uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('pergunta_id', q.id, 'pergunta', q.pergunta, 'status', q.status, 'criada_em', q.criada_em,
    'criada_por', pe.nome, 'resposta', q.resposta, 'respondida_por', q.respondida_por_nome, 'respondida_em', q.respondida_em,
    'item', jsonb_build_object('id', i.id, 'chave', i.chave, 'titulo', i.titulo, 'tipo', i.tipo))
  from public.perguntas_stakeholder q join public.itens i on i.id = q.item_id left join public.pessoas pe on pe.id = q.criada_por where q.id = p
$$;

create or replace function public.pergunta_criar(p_item uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); it record; pt record; st uuid; v uuid;
begin
  select * into it from public.itens where id = p_item;
  if it.id is null or it.frente_id not in (select interno.nos_editaveis()) then raise exception 'Você não pode mexer neste item' using errcode = '42501'; end if;
  select p.* into pt from public.portais p join public.nos_ancestrais a on a.ancestral_id = p.no_id and a.no_id = it.frente_id where p.ativo limit 1;
  if pt.id is null then raise exception 'Este item não está num cliente com portal do stakeholder' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva a pergunta' using errcode = '22023'; end if;
  st := interno.portal_status_aguardando(pt.no_id);
  insert into public.perguntas_stakeholder (portal_id, item_id, pergunta, criada_por, status_antes)
  values (pt.id, p_item, btrim(p_texto), eu, case when it.status_id = st then (select q.status_antes from public.perguntas_stakeholder q where q.item_id = p_item and q.status = 'aguardando' order by criada_em limit 1) else it.status_id end)
  returning id into v;
  update public.itens set status_id = st where id = p_item and status_id <> st;
  insert into public.portais_eventos (portal_id, tipo, dados) values (pt.id, 'pergunta_criada', interno.portal_pergunta_json(v));
  return v;
end $$;

-- volta o item para o status de antes quando não sobra nenhuma pergunta esperando nele
create or replace function interno.portal_liberar_item(p_item uuid, p_status_antes uuid, p_no uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare st uuid;
begin
  select id into st from public.status_fluxo where no_id = p_no and chave = 'aguardando_stakeholder';
  if exists (select 1 from public.perguntas_stakeholder where item_id = p_item and status = 'aguardando') then return; end if;
  update public.itens set status_id = coalesce(p_status_antes, (select id from public.status_fluxo where no_id is null and chave = 'todo' limit 1))
   where id = p_item and status_id = st;
end $$;

create or replace function public.pergunta_cancelar(p_pergunta uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare q record; pt record;
begin
  select * into q from public.perguntas_stakeholder where id = p_pergunta;
  if q.id is null or not exists (select 1 from public.itens i where i.id = q.item_id and i.frente_id in (select interno.nos_editaveis())) then raise exception 'Pergunta não encontrada' using errcode = '42501'; end if;
  if q.status <> 'aguardando' then raise exception 'Esta pergunta já foi respondida ou cancelada' using errcode = '22023'; end if;
  select * into pt from public.portais where id = q.portal_id;
  update public.perguntas_stakeholder set status = 'cancelada' where id = p_pergunta;
  perform interno.portal_liberar_item(q.item_id, q.status_antes, pt.no_id);
  insert into public.portais_eventos (portal_id, tipo, dados) values (q.portal_id, 'pergunta_cancelada', interno.portal_pergunta_json(p_pergunta));
end $$;

-- os clientes com portal ligado que a pessoa enxerga (para a tela mostrar "Perguntar ao stakeholder" só onde dá)
create or replace function public.portais_clientes() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.no_id from public.portais p where p.ativo and p.no_id in (select interno.nos_visiveis())
$$;

-- ---------------------------------------------------------------------
-- funções da portal-api (só service_role: a função confere a chave antes)
-- ---------------------------------------------------------------------
create or replace function public.portal_por_chave(p_chave text) returns table (portal_id uuid, no_id uuid, nome text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  return query
  update public.portais_chaves c set usada_em = now()
    from public.portais p
   where c.resumo = encode(digest(p_chave, 'sha256'), 'hex') and c.revogada_em is null and p.id = c.portal_id and p.ativo
  returning p.id, p.no_id, p.nome;
end $$;

-- o nome do status em português, igual à tela do CicloDev (os status padrão têm nome em inglês no banco)
create or replace function interno.portal_nome_status(p_status uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when sf.no_id is null then coalesce('{"backlog":"Na fila","todo":"A fazer","doing":"Fazendo","review":"Em revisão","blocked":"Travado","done":"Feito"}'::jsonb ->> sf.chave, sf.nome) else sf.nome end
  from public.status_fluxo sf where sf.id = p_status
$$;

-- os itens que o portal enxerga: tudo o que está debaixo do cliente, menos os arquivados
create or replace function interno.portal_itens(p_portal uuid) returns setof public.itens
language sql stable security definer set search_path = public, pg_temp as $$
  select i.* from public.itens i
  join public.nos_ancestrais a on a.no_id = i.frente_id
  join public.portais p on p.id = p_portal and a.ancestral_id = p.no_id
  where i.arquivado_em is null
$$;

-- a Estrutura do cliente, com o andamento de cada parte
create or replace function public.portal_estrutura(p_portal uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with p as (select * from public.portais where id = p_portal),
  nos as (select n.id, n.tipo, n.pai_id, n.nome, n.status, n.ordem, a.distancia from public.nos n join public.nos_ancestrais a on a.no_id = n.id join p on a.ancestral_id = p.no_id where n.status <> 'arquivado'),
  its as (select i.id, i.frente_id, sf.grupo from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id),
  soma as (select a.ancestral_id as no_id, count(*) as itens, count(*) filter (where its.grupo = 'done') as feitos, count(*) filter (where its.grupo = 'blocked') as travados
           from its join public.nos_ancestrais a on a.no_id = its.frente_id group by a.ancestral_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', nos.id, 'tipo', nos.tipo, 'pai_id', nos.pai_id, 'nome', nos.nome, 'status', nos.status, 'nivel', nos.distancia,
           'itens', coalesce(s.itens, 0), 'concluidos', coalesce(s.feitos, 0), 'travados', coalesce(s.travados, 0),
           'progresso', case when coalesce(s.itens, 0) = 0 then 0 else round(100.0 * s.feitos / s.itens) end) order by nos.distancia, nos.ordem, nos.nome), '[]'::jsonb)
  from nos left join soma s on s.no_id = nos.id
$$;

-- o painel: os mesmos números do painel do CicloDev, para o cliente todo ou para uma parte dele
create or replace function public.portal_painel(p_portal uuid, p_no uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare base uuid; r jsonb;
begin
  select coalesce(p_no, no_id) into base from public.portais where id = p_portal;
  if not exists (select 1 from public.portais p join public.nos_ancestrais a on a.ancestral_id = p.no_id and a.no_id = base where p.id = p_portal) then
    raise exception 'Fora do portal' using errcode = '42501'; end if;
  with its as (select i.*, sf.grupo, interno.portal_nome_status(sf.id) as status_nome from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id
               join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = base),
  frentes as (select n.id, n.status from public.nos n join public.nos_ancestrais a on a.no_id = n.id and a.ancestral_id = base where n.tipo = 'frente' and n.status <> 'arquivado'),
  filhos as (select n.id, n.nome, n.tipo from public.nos n where n.pai_id = base and n.status <> 'arquivado')
  select jsonb_build_object(
    'no', (select jsonb_build_object('id', n.id, 'tipo', n.tipo, 'nome', n.nome) from public.nos n where n.id = base),
    'numeros', jsonb_build_object(
      'itens', (select count(*) from its),
      'a_fazer', (select count(*) from its where grupo in ('backlog','todo')),
      'em_andamento', (select count(*) from its where grupo in ('doing','review')),
      'travados', (select count(*) from its where grupo = 'blocked'),
      'concluidos', (select count(*) from its where grupo = 'done'),
      'atrasados', (select count(*) from its where grupo <> 'done' and prazo < current_date),
      'frentes_ativas', (select count(*) from frentes where status = 'ativo'),
      'frentes_paradas', (select count(*) from frentes where status = 'pausado'),
      'perguntas_esperando', (select count(*) from public.perguntas_stakeholder q where q.portal_id = p_portal and q.status = 'aguardando' and q.item_id in (select id from its))),
    'por_grupo', (select coalesce(jsonb_object_agg(grupo, n), '{}'::jsonb) from (select grupo, count(*) n from its group by grupo) g),
    'por_parte', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'itens', x.itens, 'concluidos', x.feitos,
                    'progresso', case when x.itens = 0 then 0 else round(100.0 * x.feitos / x.itens) end) order by f.nome), '[]'::jsonb)
                  from filhos f cross join lateral (select count(*) itens, count(*) filter (where i.grupo = 'done') feitos from its i join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = f.id) x),
    'concluidos_por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'concluidos', (select count(*) from its where grupo = 'done' and concluido_em::date = d::date)) order by d), '[]'::jsonb)
                  from generate_series(current_date - 13, current_date, interval '1 day') d),
    'ultimos_concluidos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'chave', chave, 'titulo', titulo, 'concluido_em', concluido_em) order by concluido_em desc), '[]'::jsonb)
                  from (select * from its where grupo = 'done' and concluido_em is not null order by concluido_em desc limit 8) u),
    'proximos_prazos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'chave', chave, 'titulo', titulo, 'prazo', prazo, 'status', status_nome) order by prazo), '[]'::jsonb)
                  from (select * from its where grupo <> 'done' and prazo is not null order by prazo limit 8) u)
  ) into r;
  return r;
end $$;

-- o quadro analítico: as colunas do fluxo com os épicos em cartões (andamento de cada um) e os itens soltos contados
create or replace function public.portal_quadro(p_portal uuid, p_no uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare base uuid; r jsonb;
begin
  select coalesce(p_no, no_id) into base from public.portais where id = p_portal;
  if not exists (select 1 from public.portais p join public.nos_ancestrais a on a.ancestral_id = p.no_id and a.no_id = base where p.id = p_portal) then
    raise exception 'Fora do portal' using errcode = '42501'; end if;
  with its as (select i.*, sf.grupo, interno.portal_nome_status(sf.id) as status_nome from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id
               join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = base),
  ep as (select e.*, (select count(*) from its f where f.pai_id = e.id) as n_itens, (select count(*) from its f where f.pai_id = e.id and f.grupo = 'done') as n_feitos,
                (select count(*) from public.perguntas_stakeholder q where q.item_id = e.id and q.status = 'aguardando')
                + (select count(*) from public.perguntas_stakeholder q join its f on f.id = q.item_id where f.pai_id = e.id and q.status = 'aguardando') as n_perguntas
         from its e where e.tipo = 'epic')
  select jsonb_build_object('colunas', (select jsonb_agg(jsonb_build_object('grupo', g.grupo, 'nome', g.nome,
      'itens', (select count(*) from its where its.grupo = g.grupo),
      'epicos', (select coalesce(jsonb_agg(jsonb_build_object('id', ep.id, 'chave', ep.chave, 'titulo', ep.titulo, 'status', ep.status_nome, 'prazo', ep.prazo,
                   'itens', ep.n_itens, 'concluidos', ep.n_feitos, 'progresso', case when ep.n_itens = 0 then 0 else round(100.0 * ep.n_feitos / ep.n_itens) end,
                   'perguntas_esperando', ep.n_perguntas,
                   'frente', (select nome from public.nos where id = ep.frente_id)) order by ep.prazo nulls last, ep.titulo), '[]'::jsonb) from ep where ep.grupo = g.grupo),
      'sem_epico', (select count(*) from its where its.grupo = g.grupo and its.tipo <> 'epic' and (its.pai_id is null or its.pai_id not in (select id from ep))))
      order by g.ordem)
    from (values ('backlog', 'Na fila', 1), ('todo', 'A fazer', 2), ('doing', 'Fazendo', 3), ('review', 'Em revisão', 4), ('blocked', 'Travado ou esperando', 5), ('done', 'Feito', 6)) g(grupo, nome, ordem))
  ) into r;
  return r;
end $$;

-- um item ou épico em modo apresentação: tudo o que o cliente pode ler, com os itens de dentro e as perguntas
create or replace function public.portal_item(p_portal uuid, p_item uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with it as (select i.*, interno.portal_nome_status(sf.id) as status_nome, sf.grupo from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id where i.id = p_item)
  select jsonb_build_object('id', it.id, 'chave', it.chave, 'titulo', it.titulo, 'tipo', it.tipo, 'descricao', it.descricao, 'status', it.status_nome, 'grupo', it.grupo,
    'prioridade', it.prioridade, 'inicio', it.inicio, 'prazo', it.prazo, 'concluido_em', it.concluido_em,
    'responsavel', (select nome from public.pessoas where id = it.responsavel_id),
    'onde', (select jsonb_agg(jsonb_build_object('id', n.id, 'tipo', n.tipo, 'nome', n.nome) order by a.distancia desc) from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id where a.no_id = it.frente_id),
    'epico', (select jsonb_build_object('id', e.id, 'chave', e.chave, 'titulo', e.titulo) from public.itens e where e.id = it.pai_id),
    'versao', (select jsonb_build_object('id', m.id, 'nome', m.nome, 'data', m.data) from public.marcos m where m.id = it.marco_id),
    'checklist', (select coalesce(jsonb_agg(jsonb_build_object('texto', c.texto, 'feito', c.feito) order by c.ordem), '[]'::jsonb) from public.itens_checklist c where c.item_id = it.id),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'chave', f.chave, 'titulo', f.titulo, 'tipo', f.tipo, 'status', interno.portal_nome_status(sf.id), 'grupo', sf.grupo, 'prazo', f.prazo,
                'responsavel', (select nome from public.pessoas where id = f.responsavel_id)) order by f.ordem, f.titulo), '[]'::jsonb)
              from interno.portal_itens(p_portal) f join public.status_fluxo sf on sf.id = f.status_id where f.pai_id = it.id),
    'comentarios_do_cliente', (select coalesce(jsonb_agg(jsonb_build_object('texto', c.texto, 'autor', (select nome from public.pessoas where id = c.autor_id), 'quando', c.criado_em) order by c.criado_em), '[]'::jsonb)
              from public.comentarios c where c.item_id = it.id and c.visivel_cliente),
    'perguntas', (select coalesce(jsonb_agg(interno.portal_pergunta_json(q.id) order by q.criada_em desc), '[]'::jsonb) from public.perguntas_stakeholder q where q.item_id = it.id and q.status <> 'cancelada'))
  from it
$$;

create or replace function public.portal_perguntas(p_portal uuid, p_status text default 'aguardando') returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(interno.portal_pergunta_json(q.id) order by q.criada_em desc), '[]'::jsonb)
  from public.perguntas_stakeholder q where q.portal_id = p_portal and (p_status is null or p_status = 'todas' or q.status = p_status)
$$;

create or replace function public.portal_eventos_lista(p_portal uuid, p_depois bigint default 0, p_limite int default 100) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'criado_em', e.criado_em, 'dados', e.dados) order by e.id), '[]'::jsonb)
  from (select * from public.portais_eventos where portal_id = p_portal and id > coalesce(p_depois, 0) order by id limit least(greatest(coalesce(p_limite, 100), 1), 500)) e
$$;

create or replace function public.portal_responder(p_portal uuid, p_pergunta uuid, p_email text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m record; q record; pt record; it record; aviso text;
begin
  select * into m from public.portais_membros where portal_id = p_portal and email = lower(btrim(p_email)) and ativo;
  if m.email is null then raise exception 'Este e-mail não é membro do portal' using errcode = '42501'; end if;
  select * into q from public.perguntas_stakeholder where id = p_pergunta and portal_id = p_portal for update;
  if q.id is null then raise exception 'Pergunta não encontrada' using errcode = 'P0002'; end if;
  if q.status <> 'aguardando' then raise exception 'Esta pergunta já foi respondida ou cancelada' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva a resposta' using errcode = '22023'; end if;
  select * into pt from public.portais where id = p_portal;
  select * into it from public.itens where id = q.item_id;
  update public.perguntas_stakeholder set status = 'respondida', resposta = btrim(p_texto), respondida_por_email = m.email, respondida_por_nome = m.nome, respondida_em = now() where id = q.id;
  perform interno.portal_liberar_item(q.item_id, q.status_antes, pt.no_id);
  insert into public.comentarios (item_id, autor_id, texto, visivel_cliente)
  values (q.item_id, null, 'Resposta do stakeholder (' || m.nome || '), pela pergunta "' || left(q.pergunta, 300) || '":' || chr(10) || btrim(p_texto), true);
  aviso := coalesce(it.chave || ' ', '') || it.titulo;
  insert into public.notificacoes (pessoa_id, titulo, texto, item_id, tipo)
  select distinct x, 'Resposta do stakeholder: ' || left(aviso, 120), m.nome || ' respondeu: ' || left(btrim(p_texto), 300), q.item_id, 'aviso'
  from unnest(array[pt.dono_id, q.criada_por]) x where x is not null;
  insert into public.portais_eventos (portal_id, tipo, dados) values (p_portal, 'pergunta_respondida', interno.portal_pergunta_json(q.id));
  return interno.portal_pergunta_json(q.id);
end $$;

-- quem chama o quê
revoke all on function public.portal_criar(uuid, text), public.portal_gerar_chave(uuid, text), public.portal_revogar_chave(uuid), public.portal_webhook(uuid, text),
  public.pergunta_criar(uuid, text), public.pergunta_cancelar(uuid), public.portais_clientes() from public, anon;
grant execute on function public.portal_criar(uuid, text), public.portal_gerar_chave(uuid, text), public.portal_revogar_chave(uuid), public.portal_webhook(uuid, text),
  public.pergunta_criar(uuid, text), public.pergunta_cancelar(uuid), public.portais_clientes() to authenticated;
revoke all on function public.portal_por_chave(text), public.portal_estrutura(uuid), public.portal_painel(uuid, uuid), public.portal_quadro(uuid, uuid), public.portal_item(uuid, uuid),
  public.portal_perguntas(uuid, text), public.portal_eventos_lista(uuid, bigint, int), public.portal_responder(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.portal_por_chave(text), public.portal_estrutura(uuid), public.portal_painel(uuid, uuid), public.portal_quadro(uuid, uuid), public.portal_item(uuid, uuid),
  public.portal_perguntas(uuid, text), public.portal_eventos_lista(uuid, bigint, int), public.portal_responder(uuid, uuid, text, text) to service_role;
revoke all on function interno.portal_nome_status(uuid), interno.portal_status_aguardando(uuid), interno.portal_pergunta_json(uuid), interno.portal_liberar_item(uuid, uuid, uuid), interno.portal_itens(uuid), interno.portal_so_campos_livres() from public, anon, authenticated;

-- >>>>>>>>>> 25_ia_permissoes_chat.sql
-- =====================================================================
-- CicloDev · 25 · Permissões de IA e conversa de cada usuário com o seu agente
--
--   ia_permissoes   quem pode usar a IA. Começa todo mundo desligado; só o dono do sistema liga ou desliga
--                   (Admin › Permissões de IA). Cada pessoa só lê a própria linha, para a tela saber se mostra o balão.
--   ia_mensagens    a conversa de cada usuário com o seu agente. Cada pessoa só lê e escreve a própria conversa;
--                   nem o dono do sistema lê a conversa dos outros pela tela.
--
-- Regra que vale para quando o agente for ligado (ainda não existe agente respondendo):
--   o agente de um usuário só enxerga o que esse usuário enxerga no sistema (interno.nos_visiveis() dele).
--   Nunca vê nem fala de projeto a que o dono dele não tem acesso.
-- Depende das partes 01, 15 e 16.
-- =====================================================================

create table if not exists public.ia_permissoes (
  pessoa_id    uuid primary key references public.pessoas(id) on delete cascade,
  ativo        boolean not null default false,
  alterado_por uuid references public.pessoas(id) on delete set null,
  alterado_em  timestamptz not null default now()
);
comment on table public.ia_permissoes is 'Quem pode usar a IA. Sem linha ou ativo = false: não usa. Só o dono do sistema muda (função admin_ia_definir).';

create table if not exists public.ia_mensagens (
  id        uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null default interno.pessoa_atual() references public.pessoas(id) on delete cascade,
  autor     text not null check (autor in ('usuario','agente')),
  texto     text not null check (length(btrim(texto)) between 1 and 8000),
  criado_em timestamptz not null default now()
);
create index if not exists ia_mensagens_pessoa_idx on public.ia_mensagens (pessoa_id, criado_em);
comment on table public.ia_mensagens is 'Conversa de cada usuário com o seu agente. Cada pessoa só vê a própria. O agente (quando existir) grava as respostas pelo lado do servidor.';

alter table public.ia_permissoes enable row level security;
alter table public.ia_mensagens enable row level security;

drop policy if exists propria on public.ia_permissoes;
create policy propria on public.ia_permissoes for select to authenticated
  using (pessoa_id = (select interno.pessoa_atual()));

drop policy if exists ver on public.ia_mensagens;
create policy ver on public.ia_mensagens for select to authenticated
  using (pessoa_id = (select interno.pessoa_atual()));
drop policy if exists escrever on public.ia_mensagens;
create policy escrever on public.ia_mensagens for insert to authenticated
  with check (pessoa_id = (select interno.pessoa_atual()) and autor = 'usuario'
              and exists (select 1 from public.ia_permissoes p where p.pessoa_id = (select interno.pessoa_atual()) and p.ativo));

revoke all on public.ia_permissoes, public.ia_mensagens from anon, authenticated;
grant select on public.ia_permissoes to authenticated;
grant select, insert on public.ia_mensagens to authenticated;
grant all on public.ia_permissoes, public.ia_mensagens to service_role;

-- a própria pessoa: posso usar a IA?
create or replace function public.ia_posso() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select p.ativo from public.ia_permissoes p where p.pessoa_id = interno.pessoa_atual()), false)
$$;

-- Admin: a situação de cada usuário (a lista de nomes vem de admin_usuarios)
create or replace function public.admin_ia_permissoes() returns table (pessoa_id uuid, ativo boolean, alterado_em timestamptz, alterado_por text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select p.id, coalesce(ip.ativo, false), ip.alterado_em, q.nome
    from public.pessoas p left join public.ia_permissoes ip on ip.pessoa_id = p.id left join public.pessoas q on q.id = ip.alterado_por;
end $$;

-- Admin: liga ou desliga a IA de um usuário
create or replace function public.admin_ia_definir(p_pessoa uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  if not exists (select 1 from public.pessoas where id = p_pessoa) then raise exception 'Usuário não encontrado' using errcode = 'P0002'; end if;
  insert into public.ia_permissoes (pessoa_id, ativo, alterado_por, alterado_em) values (p_pessoa, coalesce(p_ativo, false), interno.pessoa_atual(), now())
    on conflict (pessoa_id) do update set ativo = excluded.ativo, alterado_por = excluded.alterado_por, alterado_em = excluded.alterado_em;
  return coalesce(p_ativo, false);
end $$;

revoke all on function public.ia_posso(), public.admin_ia_permissoes(), public.admin_ia_definir(uuid, boolean) from public, anon;
grant execute on function public.ia_posso(), public.admin_ia_permissoes(), public.admin_ia_definir(uuid, boolean) to authenticated;

-- >>>>>>>>>> 26_ia_agente_historico.sql
-- =====================================================================
-- CicloDev · 26 · O agente (DevIT) de cada usuário nasce com a conta, a conversa também fica em .md e aceita anexos
--
--   ia_agentes   um por usuário, criado sozinho quando a conta é criada (junto com a permissão de IA, desligada).
--                historico_md guarda a conversa inteira em Markdown, para o agente poder lembrar depois.
--                Cada mensagem nova entra no fim do .md sozinha (gatilho); ninguém edita nem apaga pela tela.
--
-- A conversa nunca se perde: ia_mensagens e historico_md não têm mudança nem apagamento pela tela.
-- Desligar a IA de alguém só esconde o balão; ligar de novo traz a mesma conversa de volta.
-- Os arquivos anexados ficam no depósito anexos (parte 09), na pasta <login>/ia/; as regras do depósito para essa pasta
-- estão na parte 27 (só no Supabase).
-- Depende da parte 25.
-- =====================================================================

create table if not exists public.ia_agentes (
  pessoa_id     uuid primary key references public.pessoas(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  historico_md  text not null default '',
  mensagens     integer not null default 0,
  atualizado_em timestamptz not null default now()
);
comment on table public.ia_agentes is 'O agente de IA de cada usuário: nasce com a conta. historico_md é a conversa inteira em Markdown, só cresce.';

alter table public.ia_agentes enable row level security;
drop policy if exists proprio on public.ia_agentes;
create policy proprio on public.ia_agentes for select to authenticated using (pessoa_id = (select interno.pessoa_atual()));
revoke all on public.ia_agentes from anon, authenticated;
grant select on public.ia_agentes to authenticated;
grant all on public.ia_agentes to service_role;

-- anexos de cada mensagem: [{nome, tipo, tamanho, caminho}], com o arquivo no depósito anexos, na pasta <login>/ia/ da própria pessoa
alter table public.ia_mensagens add column if not exists anexos jsonb not null default '[]'::jsonb;
alter table public.ia_mensagens drop constraint if exists ia_mensagens_texto_check;
alter table public.ia_mensagens drop constraint if exists ia_mensagens_conteudo_ok;
alter table public.ia_mensagens add constraint ia_mensagens_conteudo_ok check (
  jsonb_typeof(anexos) = 'array' and jsonb_array_length(anexos) <= 10 and pg_column_size(anexos) <= 20000 and length(texto) <= 8000
  and (length(btrim(texto)) >= 1 or jsonb_array_length(anexos) >= 1));
comment on column public.ia_mensagens.anexos is 'Arquivos mandados junto com a mensagem: [{nome, tipo, tamanho, caminho}]. O arquivo fica no depósito anexos, em <login>/ia/.';

-- cada anexo precisa estar na pasta da própria pessoa (ninguém aponta para arquivo de outro)
create or replace function interno.ia_conferir_anexos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare a jsonb; login text;
begin
  if jsonb_array_length(new.anexos) = 0 then return new; end if;
  select auth_user_id::text into login from public.pessoas where id = new.pessoa_id;
  for a in select * from jsonb_array_elements(new.anexos) loop
    if jsonb_typeof(a) <> 'object' or coalesce(length(btrim(a ->> 'nome')), 0) = 0 or length(a ->> 'nome') > 200
       or jsonb_typeof(a -> 'tamanho') <> 'number' or login is null or coalesce(a ->> 'caminho', '') not like login || '/ia/%' then
      raise exception 'Anexo inválido' using errcode = '22023';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists ia_mensagens_anexos on public.ia_mensagens;
create trigger ia_mensagens_anexos before insert on public.ia_mensagens for each row execute function interno.ia_conferir_anexos();

-- a permissão que nasce com a conta não conta como "mudada" no Admin: só quem liga ou desliga preenche alterado_em
alter table public.ia_permissoes alter column alterado_em drop not null, alter column alterado_em drop default;

-- o começo do .md de cada agente
create or replace function interno.ia_cabecalho(p uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select '# Conversa com o DevIT' || chr(10) || chr(10) ||
         '- Dono: ' || coalesce(pe.nome, 'sem nome') || coalesce(' (ID ' || pe.numero || ')', '') || chr(10) ||
         '- Agente criado em: ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || chr(10) ||
         '- O agente só enxerga o que o dono enxerga no CicloDev.' || chr(10)
  from public.pessoas pe where pe.id = p
$$;

-- cria o agente (e a permissão de IA, desligada) de uma pessoa, se ainda não existir
create or replace function interno.ia_preparar(p uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.ia_agentes (pessoa_id, historico_md) values (p, interno.ia_cabecalho(p)) on conflict (pessoa_id) do nothing;
  insert into public.ia_permissoes (pessoa_id, ativo) values (p, false) on conflict (pessoa_id) do nothing;
end $$;

-- conta nova: o agente nasce junto
create or replace function interno.ia_ao_criar_pessoa() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform interno.ia_preparar(new.id);
  return new;
end $$;
drop trigger if exists pessoas_ia_agente on public.pessoas;
create trigger pessoas_ia_agente after insert on public.pessoas for each row execute function interno.ia_ao_criar_pessoa();

-- cada mensagem entra no fim do .md
create or replace function interno.ia_md_mensagem(m public.ia_mensagens) returns text
language sql stable set search_path = public, pg_temp as $$
  select chr(10) || '## ' || to_char(m.criado_em at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' ||
         case when m.autor = 'agente' then 'DevIT' else 'Usuário' end || chr(10) || chr(10) ||
         case when length(btrim(m.texto)) > 0 then m.texto || chr(10) else '' end ||
         case when jsonb_array_length(m.anexos) > 0 then
           (case when length(btrim(m.texto)) > 0 then chr(10) else '' end) || 'Anexos:' || chr(10) ||
           (select string_agg('- ' || (x ->> 'nome') || ' (' || coalesce(nullif(x ->> 'tipo', ''), 'arquivo') || ', ' ||
                    case when (x ->> 'tamanho')::numeric >= 1048576 then round((x ->> 'tamanho')::numeric / 1048576, 1) || ' MB' else ceil((x ->> 'tamanho')::numeric / 1024) || ' KB' end ||
                    ') · `' || (x ->> 'caminho') || '`', chr(10)) from jsonb_array_elements(m.anexos) x) || chr(10)
         else '' end
$$;
create or replace function interno.ia_guardar_md() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform interno.ia_preparar(new.pessoa_id);
  update public.ia_agentes set historico_md = historico_md || interno.ia_md_mensagem(new), mensagens = mensagens + 1, atualizado_em = now()
   where pessoa_id = new.pessoa_id;
  return new;
end $$;
drop trigger if exists ia_mensagens_md on public.ia_mensagens;
create trigger ia_mensagens_md after insert on public.ia_mensagens for each row execute function interno.ia_guardar_md();

-- quem já tem conta ganha o agente agora, com a conversa que já existia no .md
insert into public.ia_agentes (pessoa_id, historico_md, mensagens)
select pe.id,
       interno.ia_cabecalho(pe.id) || coalesce((select string_agg(interno.ia_md_mensagem(m), '' order by m.criado_em, m.id) from public.ia_mensagens m where m.pessoa_id = pe.id), ''),
       (select count(*) from public.ia_mensagens m where m.pessoa_id = pe.id)
  from public.pessoas pe
on conflict (pessoa_id) do nothing;
insert into public.ia_permissoes (pessoa_id, ativo) select id, false from public.pessoas on conflict (pessoa_id) do nothing;

revoke all on function interno.ia_conferir_anexos(), interno.ia_cabecalho(uuid), interno.ia_preparar(uuid), interno.ia_ao_criar_pessoa(), interno.ia_md_mensagem(public.ia_mensagens), interno.ia_guardar_md() from public, anon, authenticated;

-- >>>>>>>>>> 28_ia_avisos.sql
-- =====================================================================
-- CicloDev · 28 · Aviso de mensagem nova do DevIT com o chat fechado
--
-- ia_agentes.visto_ate: até quando a pessoa já viu a conversa (abrindo o chat). Mensagem do DevIT depois disso
-- é novidade: o balão se mexe e pulsa até a pessoa abrir o chat.
--   ia_novidades()    quantas mensagens do DevIT a pessoa ainda não viu
--   ia_marcar_visto() a pessoa abriu o chat: tudo até agora fica visto
-- Depende da parte 26.
-- =====================================================================
alter table public.ia_agentes add column if not exists visto_ate timestamptz;
comment on column public.ia_agentes.visto_ate is 'Até quando a pessoa já viu a conversa com o DevIT (abriu o chat). Mensagem do DevIT depois disso aparece como aviso no balão.';

create or replace function public.ia_novidades() returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.ia_mensagens m
   where m.pessoa_id = interno.pessoa_atual() and m.autor = 'agente'
     and m.criado_em > coalesce((select a.visto_ate from public.ia_agentes a where a.pessoa_id = interno.pessoa_atual()), '-infinity'::timestamptz)
$$;

create or replace function public.ia_marcar_visto() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual();
begin
  if eu is null then raise exception 'Entre no sistema primeiro' using errcode = '42501'; end if;
  perform interno.ia_preparar(eu);
  update public.ia_agentes set visto_ate = now() where pessoa_id = eu;
end $$;

revoke all on function public.ia_novidades(), public.ia_marcar_visto() from public, anon;
grant execute on function public.ia_novidades(), public.ia_marcar_visto() to authenticated;

-- >>>>>>>>>> 29_infraestrutura.sql
-- =====================================================================
-- CicloDev · 29 · Infraestrutura: desenhos do sistema como código (projeto = macro, produto = micro)
--
-- Cada projeto e cada produto tem a aba Infraestrutura com 10 sub-abas (a coluna "aba"):
--   solucao      Arquitetura de Solução        (Structurizr DSL, visão C4 de contexto e containers)
--   software     Arquitetura de Software       (PlantUML de componentes e módulos)
--   dominio      Modelo de Domínio             (PlantUML de classes e entidades)
--   der          DER / Banco de Dados          (DBML)
--   processos    Fluxos de Processo            (Mermaid)
--   sequencias   Diagramas de Sequência        (PlantUML)
--   infra        Arquitetura de Infraestrutura (Graphviz do Terraform, ou Structurizr)
--   seguranca    Arquitetura de Segurança      (Structurizr DSL com fronteiras de confiança)
--   ux           Fluxos de Usuário             (Mermaid)
--   prototipos   Protótipos de Interface       (especificação em Markdown e links do Figma)
--
--   infra_canvas            o quadro (canvas) de cada sub-aba: os documentos que o canvas grava (quadros/<id>, meta/eventos)
--   infra_diagramas         cada desenho: o texto (a fonte de verdade), a imagem gerada, de onde veio a evidência
--   infra_diagramas_versoes toda vez que o texto muda, a versão anterior fica guardada (nunca se perde)
--   infra_geracoes          cada pedido ao DevIT para gerar ou atualizar desenhos, com o resultado
--
-- Quem enxerga o projeto ou produto enxerga os desenhos; quem pode editar o nó pode mexer.
-- Depende das partes 01, 14 e 15.
-- =====================================================================

create or replace function interno.infra_aba_ok(a text) returns boolean
language sql immutable as $$ select a in ('solucao','software','dominio','der','processos','sequencias','infra','seguranca','ux','prototipos') $$;

-- só projeto e produto têm a aba
create or replace function interno.infra_no_ok(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select exists (select 1 from public.nos where id = p and tipo in ('projeto','produto')) $$;

create table if not exists public.infra_canvas (
  no_id          uuid not null references public.nos(id) on delete cascade,
  aba            text not null check (interno.infra_aba_ok(aba)),
  caminho        text not null check (caminho ~ '^[a-z]+/[A-Za-z0-9_-]{1,80}$'),
  dados          jsonb not null default '{}'::jsonb check (pg_column_size(dados) <= 600000),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  primary key (no_id, aba, caminho)
);
comment on table public.infra_canvas is 'O canvas de cada sub-aba da Infraestrutura: cada linha é um documento que o canvas grava (quadros/<id> com cards e ligações, meta/eventos).';

create table if not exists public.infra_diagramas (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  aba            text not null check (interno.infra_aba_ok(aba)),
  nome           text not null check (length(btrim(nome)) between 1 and 160),
  formato        text not null check (formato in ('structurizr','plantuml','dbml','mermaid','graphviz','c4plantuml','markdown')),
  fonte          text not null default '' check (length(fonte) <= 200000),
  svg            text check (svg is null or length(svg) <= 3000000),
  erro           text,
  origem         text not null default 'manual' check (origem in ('manual','devit')),
  evidencias     jsonb not null default '[]'::jsonb check (jsonb_typeof(evidencias) = 'array' and pg_column_size(evidencias) <= 200000),
  lacunas        jsonb not null default '[]'::jsonb check (jsonb_typeof(lacunas) = 'array'),
  links          jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  versao         integer not null default 1,
  renderizado_em timestamptz,
  criado_por     uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  arquivado_em   timestamptz
);
create index if not exists infra_diagramas_no_idx on public.infra_diagramas (no_id, aba);
comment on table public.infra_diagramas is 'Desenhos do sistema como código. fonte é a fonte de verdade (.dsl, .puml, .dbml, .mmd, .dot, .md); svg é a imagem gerada pelo conversor. evidencias diz de onde cada parte veio (arquivo, tabela, item).';

create table if not exists public.infra_diagramas_versoes (
  diagrama_id uuid not null references public.infra_diagramas(id) on delete cascade,
  versao      integer not null,
  fonte       text not null,
  svg         text,
  origem      text not null,
  evidencias  jsonb not null default '[]'::jsonb,
  autor       uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  primary key (diagrama_id, versao)
);
comment on table public.infra_diagramas_versoes is 'Cada versão anterior do texto de um desenho. Só cresce: ninguém muda nem apaga pela tela.';

create table if not exists public.infra_geracoes (
  id           uuid primary key default gen_random_uuid(),
  no_id        uuid not null references public.nos(id) on delete cascade,
  aba          text not null check (interno.infra_aba_ok(aba)),
  status       text not null default 'pedido' check (status in ('pedido','gerando','pronto','erro')),
  pedido_por   uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  pedido_em    timestamptz not null default now(),
  concluido_em timestamptz,
  diagramas    uuid[] not null default '{}',
  fontes_lidas jsonb not null default '[]'::jsonb,
  erro         text
);
create index if not exists infra_geracoes_no_idx on public.infra_geracoes (no_id, aba, pedido_em desc);
comment on table public.infra_geracoes is 'Cada pedido ao DevIT para gerar ou atualizar os desenhos de uma sub-aba, com as fontes que ele leu e o que saiu.';

-- nada de aba em nó que não é projeto nem produto
create or replace function interno.infra_conferir_no() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if not interno.infra_no_ok(new.no_id) then raise exception 'A Infraestrutura fica em projetos e produtos' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists infra_canvas_no on public.infra_canvas;
create trigger infra_canvas_no before insert or update of no_id on public.infra_canvas for each row execute function interno.infra_conferir_no();
drop trigger if exists infra_diagramas_no on public.infra_diagramas;
create trigger infra_diagramas_no before insert or update of no_id on public.infra_diagramas for each row execute function interno.infra_conferir_no();
drop trigger if exists infra_geracoes_no on public.infra_geracoes;
create trigger infra_geracoes_no before insert on public.infra_geracoes for each row execute function interno.infra_conferir_no();

drop trigger if exists infra_canvas_carimbo on public.infra_canvas;
create trigger infra_canvas_carimbo before update on public.infra_canvas for each row execute function interno.carimbar_atualizacao();

-- o texto mudou: guarda a versão anterior e sobe o número; a imagem antiga deixa de valer até gerar de novo
create or replace function interno.infra_versionar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  if new.fonte is distinct from old.fonte then
    insert into public.infra_diagramas_versoes (diagrama_id, versao, fonte, svg, origem, evidencias, autor)
    values (old.id, old.versao, old.fonte, old.svg, old.origem, old.evidencias, interno.pessoa_atual())
    on conflict (diagrama_id, versao) do nothing;
    new.versao := old.versao + 1;
    if new.svg is not distinct from old.svg then new.svg := null; new.renderizado_em := null; end if;
  end if;
  if new.id <> old.id or new.criado_em <> old.criado_em or new.criado_por is distinct from old.criado_por then
    raise exception 'Não dá para trocar quem criou o desenho' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists infra_diagramas_versao on public.infra_diagramas;
create trigger infra_diagramas_versao before update on public.infra_diagramas for each row execute function interno.infra_versionar();

alter table public.infra_canvas enable row level security;
alter table public.infra_diagramas enable row level security;
alter table public.infra_diagramas_versoes enable row level security;
alter table public.infra_geracoes enable row level security;

drop policy if exists ver on public.infra_canvas;
create policy ver on public.infra_canvas for select to authenticated using (no_id in (select interno.nos_visiveis()));
drop policy if exists mexe on public.infra_canvas;
create policy mexe on public.infra_canvas for all to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

drop policy if exists ver on public.infra_diagramas;
create policy ver on public.infra_diagramas for select to authenticated using (no_id in (select interno.nos_visiveis()));
drop policy if exists cria on public.infra_diagramas;
create policy cria on public.infra_diagramas for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
drop policy if exists muda on public.infra_diagramas;
create policy muda on public.infra_diagramas for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

drop policy if exists ver on public.infra_diagramas_versoes;
create policy ver on public.infra_diagramas_versoes for select to authenticated
  using (exists (select 1 from public.infra_diagramas d where d.id = diagrama_id and d.no_id in (select interno.nos_visiveis())));

drop policy if exists ver on public.infra_geracoes;
create policy ver on public.infra_geracoes for select to authenticated using (no_id in (select interno.nos_visiveis()));
drop policy if exists cria on public.infra_geracoes;
create policy cria on public.infra_geracoes for insert to authenticated with check (no_id in (select interno.nos_editaveis()) and pedido_por = (select interno.pessoa_atual()));

revoke all on public.infra_canvas, public.infra_diagramas, public.infra_diagramas_versoes, public.infra_geracoes from anon, authenticated;
grant select, insert, update, delete on public.infra_canvas to authenticated;
grant select, insert, update on public.infra_diagramas to authenticated;   -- apagar = arquivar (arquivado_em); o texto antigo fica nas versões
grant select on public.infra_diagramas_versoes to authenticated;
grant select, insert on public.infra_geracoes to authenticated;
grant all on public.infra_canvas, public.infra_diagramas, public.infra_diagramas_versoes, public.infra_geracoes to service_role;

revoke all on function interno.infra_conferir_no(), interno.infra_versionar() from public, anon, authenticated;
grant execute on function interno.infra_aba_ok(text), interno.infra_no_ok(uuid) to authenticated, service_role;

-- >>>>>>>>>> 30_infra_automatica.sql
-- =====================================================================
-- CicloDev · 30 · Infraestrutura automática: os desenhos que saem sozinhos, sem IA
--
-- Três jeitos de um desenho nascer na aba Infraestrutura:
--   1. Do código (origem 'github'): cada publicação em PRODUÇÃO que chega do GitHub (tabela publicacoes, parte 19)
--      põe um pedido na fila. A função diagramas-auto baixa o código daquele commit e monta, sem IA:
--        software  módulos do código e quem importa quem (PlantUML)
--        infra     Docker, Terraform, Vercel, Supabase, GitHub Actions (Graphviz)
--        ux        mapa de telas pelas rotas (Next.js, SvelteKit, Nuxt, Remix) (Mermaid)
--        der       modelos do Prisma, quando houver (DBML)
--   2. Do banco (origem 'banco'): o projeto ou produto liga o banco de dados do sistema (só leitura).
--      A função olha o banco de hora em hora e, quando a estrutura muda, redesenha:
--        der       tabelas, colunas e ligações (DBML)
--        seguranca quem acessa cada tabela, RLS e regras (Graphviz)
--   3. Do DevIT (origem 'devit', parte 29): o que depende de interpretação (solução, domínio, processos,
--      sequências, protótipos). Continua sob pedido, e agora usa os desenhos automáticos como evidência.
--
--   infra_bancos                  qual projeto ou produto tem banco ligado, e o estado da última leitura
--   interno.infra_bancos_conexao  o endereço de conexão (com a senha). Ninguém lê pela tela; só a função
--   infra_automacoes              a fila: cada publicação, mudança no banco ou "Atualizar agora"
--
--   Cada desenho automático ou do DevIT também é montado como um quadro do canvas (infra_quadro_gravar).
-- A chamada da função (pg_net), a rotina de hora em hora (pg_cron) e o segredo (Vault) ficam na
-- parte 31, que é só do Supabase. Aqui, interno.infra_auto_chamar() não faz nada (teste local).
-- Depende das partes 01, 15, 19 e 29.
-- =====================================================================

-- ---------- desenhos: de onde vieram e qual é a chave do desenho automático ----------
alter table public.infra_diagramas drop constraint if exists infra_diagramas_origem_check;
alter table public.infra_diagramas add constraint infra_diagramas_origem_check check (origem in ('manual','devit','github','banco'));
alter table public.infra_diagramas add column if not exists chave_auto text check (chave_auto is null or length(chave_auto) <= 300);
alter table public.infra_diagramas add column if not exists referencia text check (referencia is null or length(referencia) <= 200);
alter table public.infra_diagramas add column if not exists auto_em timestamptz;
create unique index if not exists infra_diagramas_auto_uq on public.infra_diagramas (no_id, chave_auto) where chave_auto is not null;
comment on column public.infra_diagramas.chave_auto is 'Só nos desenhos automáticos: identifica o desenho (ex.: github:org/repo:software, banco:der:public) para a próxima rodada atualizar o mesmo, e não criar outro.';
comment on column public.infra_diagramas.referencia is 'De qual versão saiu: o commit (github) ou o resumo da estrutura do banco (banco).';

-- ---------- banco ligado ----------
create table if not exists public.infra_bancos (
  no_id             uuid primary key references public.nos(id) on delete cascade,
  nome              text not null default 'Banco de dados' check (length(btrim(nome)) between 1 and 120),
  esquemas          text[] not null default '{public}' check (cardinality(esquemas) between 1 and 20),
  ativo             boolean not null default true,
  ultimo_hash       text,
  ultima_leitura_em timestamptz,
  ultima_mudanca_em timestamptz,
  ultimo_erro       text,
  criado_por        uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em         timestamptz not null default now()
);
comment on table public.infra_bancos is 'Projeto ou produto com o banco de dados do sistema ligado (só leitura), para o DER e o mapa de acesso saírem sozinhos. O endereço com a senha fica em interno.infra_bancos_conexao.';

create table if not exists interno.infra_bancos_conexao (
  no_id     uuid primary key references public.infra_bancos(no_id) on delete cascade,
  conexao   text not null check (conexao ~ '^postgres(ql)?://' and length(conexao) <= 1000),
  trocado_em timestamptz not null default now()
);
revoke all on interno.infra_bancos_conexao from public, anon, authenticated;

drop trigger if exists infra_bancos_no on public.infra_bancos;
create trigger infra_bancos_no before insert or update of no_id on public.infra_bancos for each row execute function interno.infra_conferir_no();

-- ---------- a fila ----------
create table if not exists public.infra_automacoes (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  origem         text not null check (origem in ('github','banco','manual')),
  repositorio_id uuid references public.repositorios(id) on delete set null,
  publicacao_id  uuid references public.publicacoes(id) on delete set null,
  referencia     text check (referencia is null or length(referencia) <= 200),
  status         text not null default 'pendente' check (status in ('pendente','rodando','pronto','erro')),
  tentativas     integer not null default 0,
  pedido_por     uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em      timestamptz not null default now(),
  iniciado_em    timestamptz,
  concluido_em   timestamptz,
  diagramas      uuid[] not null default '{}',
  resumo         jsonb not null default '[]'::jsonb check (jsonb_typeof(resumo) = 'array'),
  erro           text
);
create index if not exists infra_automacoes_no_idx on public.infra_automacoes (no_id, criado_em desc);
create index if not exists infra_automacoes_fila_idx on public.infra_automacoes (criado_em) where status in ('pendente','rodando');
comment on table public.infra_automacoes is 'Fila dos desenhos automáticos: cada publicação em produção, mudança na estrutura do banco ou pedido de "Atualizar agora", com o que saiu.';

drop trigger if exists infra_automacoes_no on public.infra_automacoes;
create trigger infra_automacoes_no before insert on public.infra_automacoes for each row execute function interno.infra_conferir_no();

-- chama a função diagramas-auto. Aqui não faz nada: a parte 31 (Supabase) troca por pg_net.
create or replace function interno.infra_auto_chamar() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$ begin return null; end $$;

-- o projeto ou produto de um nó: ele mesmo, se já for, ou o mais próximo acima
create or replace function interno.infra_no_de(p uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select a.ancestral_id from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
   where a.no_id = p and n.tipo in ('produto','projeto')
   order by a.distancia limit 1
$$;

-- publicação em produção com sucesso, vinda de um repositório: pede os desenhos do código daquele commit
create or replace function interno.infra_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare alvo uuid;
begin
  if new.status <> 'sucesso' or new.ambiente <> 'producao' or new.repositorio_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'sucesso' and old.ambiente = 'producao' and old.referencia is not distinct from new.referencia then return null; end if;
  alvo := interno.infra_no_de(new.no_id);
  if alvo is null then return null; end if;
  if not exists (select 1 from public.repositorios r where r.id = new.repositorio_id and r.ativo and r.provedor = 'github') then return null; end if;
  -- o mesmo commit já está na fila: não repete
  if exists (select 1 from public.infra_automacoes a where a.no_id = alvo and a.repositorio_id = new.repositorio_id
              and a.referencia is not distinct from new.referencia and a.status in ('pendente','rodando')) then return null; end if;
  insert into public.infra_automacoes (no_id, origem, repositorio_id, publicacao_id, referencia, pedido_por)
  values (alvo, 'github', new.repositorio_id, new.id, left(new.referencia, 200), null);
  perform interno.infra_auto_chamar();
  return null;
end $$;
drop trigger if exists publicacoes_infra on public.publicacoes;
create trigger publicacoes_infra after insert or update of status, ambiente, referencia on public.publicacoes
  for each row execute function interno.infra_publicou();

-- ---------- o que a tela chama ----------
-- ligar ou trocar o banco. p_conexao vazio mantém o endereço que já está guardado.
create or replace function public.infra_banco_definir(p_no uuid, p_nome text, p_esquemas text[], p_conexao text default null, p_ativo boolean default true)
returns public.infra_bancos
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.infra_bancos; esq text[];
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos e produtos' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct btrim(e)) filter (where btrim(e) <> ''), '{public}') into esq from unnest(coalesce(p_esquemas, '{public}')) e;
  if exists (select 1 from unnest(esq) e where e !~ '^[A-Za-z_][A-Za-z0-9_$]{0,62}$') then raise exception 'Nome de esquema inválido' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_conexao, '')), '') is null and not exists (select 1 from interno.infra_bancos_conexao c where c.no_id = p_no) then
    raise exception 'Informe o endereço de conexão do banco' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_conexao, '')), '') is not null and btrim(p_conexao) !~ '^postgres(ql)?://' then
    raise exception 'O endereço precisa começar com postgresql://' using errcode = '22023'; end if;
  insert into public.infra_bancos (no_id, nome, esquemas, ativo) values (p_no, coalesce(nullif(btrim(p_nome), ''), 'Banco de dados'), esq, coalesce(p_ativo, true))
  on conflict (no_id) do update set nome = excluded.nome, esquemas = excluded.esquemas, ativo = excluded.ativo
  returning * into r;
  if nullif(btrim(coalesce(p_conexao, '')), '') is not null then
    insert into interno.infra_bancos_conexao (no_id, conexao) values (p_no, btrim(p_conexao))
    on conflict (no_id) do update set conexao = excluded.conexao, trocado_em = now();
    -- endereço novo: lê de novo na próxima rodada
    update public.infra_bancos set ultimo_hash = null, ultima_leitura_em = null, ultimo_erro = null where no_id = p_no returning * into r;
  end if;
  perform interno.infra_auto_chamar();
  return r;
end $$;

-- desligar: tira o endereço guardado (os desenhos que já saíram ficam)
create or replace function public.infra_banco_remover(p_no uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  delete from public.infra_bancos where no_id = p_no;
end $$;

-- "Atualizar agora": refaz os desenhos do código (último commit do branch principal) e relê o banco
create or replace function public.infra_auto_pedir(p_no uuid) returns public.infra_automacoes
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.infra_automacoes;
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  select * into r from public.infra_automacoes a where a.no_id = p_no and a.origem = 'manual' and a.status in ('pendente','rodando') limit 1;
  if found then return r; end if;
  insert into public.infra_automacoes (no_id, origem) values (p_no, 'manual') returning * into r;
  perform interno.infra_auto_chamar();
  return r;
end $$;

-- ---------- o que só a função diagramas-auto chama (service_role) ----------
-- pega os próximos pedidos da fila e marca como rodando. Pedido que ficou rodando mais de 15 minutos volta (até 3 vezes).
create or replace function public.infra_auto_proximos(p_limite integer default 3) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare ids uuid[]; saida jsonb;
begin
  update public.infra_automacoes set status = 'erro', concluido_em = now(), erro = 'Parou no meio três vezes'
   where status = 'rodando' and iniciado_em < now() - interval '15 minutes' and tentativas >= 3;
  with fila as (
    select a.id from public.infra_automacoes a
     where a.status = 'pendente' or (a.status = 'rodando' and a.iniciado_em < now() - interval '15 minutes')
     order by a.criado_em limit greatest(1, least(coalesce(p_limite, 3), 10)) for update skip locked),
  pegos as (
    update public.infra_automacoes a set status = 'rodando', iniciado_em = now(), tentativas = a.tentativas + 1
      from fila where a.id = fila.id returning a.id)
  select array_agg(id) into ids from pegos;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'no_id', a.no_id, 'origem', a.origem, 'referencia', a.referencia,
      'repositorios', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor) order by r.nome), '[]')
                         from public.repositorios r
                        where r.ativo and (case when a.repositorio_id is not null then r.id = a.repositorio_id
                                                else interno.infra_no_de(r.no_id) = a.no_id end)),
      'banco', (select jsonb_build_object('esquemas', b.esquemas, 'conexao', c.conexao)
                  from public.infra_bancos b join interno.infra_bancos_conexao c on c.no_id = b.no_id
                 where b.no_id = a.no_id and b.ativo and a.origem in ('manual','banco'))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $$;

-- bancos que não são lidos há mais de uma hora
create or replace function public.infra_auto_bancos_devidos(p_limite integer default 5) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('no_id', b.no_id, 'esquemas', b.esquemas, 'conexao', c.conexao, 'ultimo_hash', b.ultimo_hash)), '[]')
    from (select * from public.infra_bancos b where b.ativo and (b.ultima_leitura_em is null or b.ultima_leitura_em < now() - interval '55 minutes')
           order by b.ultima_leitura_em nulls first limit greatest(1, least(coalesce(p_limite, 5), 20))) b
    join interno.infra_bancos_conexao c on c.no_id = b.no_id
$$;

-- a função leu o banco: guarda o resumo da estrutura; se mudou (e p_abrir), abre um pedido 'banco' já rodando e devolve o id.
-- Dentro de um "Atualizar agora" o pedido já existe: p_abrir = false só guarda o resumo.
create or replace function public.infra_auto_banco_lido(p_no uuid, p_hash text, p_erro text default null, p_abrir boolean default true) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.infra_bancos; novo uuid;
begin
  select * into b from public.infra_bancos where no_id = p_no for update;
  if not found then return null; end if;
  if p_erro is not null then
    update public.infra_bancos set ultima_leitura_em = now(), ultimo_erro = left(p_erro, 1000) where no_id = p_no; return null; end if;
  update public.infra_bancos set ultima_leitura_em = now(), ultimo_erro = null,
         ultimo_hash = p_hash, ultima_mudanca_em = case when b.ultimo_hash is distinct from p_hash then now() else b.ultima_mudanca_em end
   where no_id = p_no;
  if b.ultimo_hash is not distinct from p_hash or not coalesce(p_abrir, true) then return null; end if;
  insert into public.infra_automacoes (no_id, origem, referencia, status, iniciado_em, tentativas, pedido_por)
  values (p_no, 'banco', left(p_hash, 200), 'rodando', now(), 1, null) returning id into novo;
  return novo;
end $$;

-- grava (ou atualiza) um desenho automático. Devolve o id e se precisa gerar a imagem de novo.
create or replace function public.infra_auto_gravar(p_no uuid, p_aba text, p_chave text, p_nome text, p_formato text, p_fonte text,
                                                    p_origem text, p_referencia text, p_evidencias jsonb default '[]', p_lacunas jsonb default '[]')
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.infra_diagramas;
begin
  if p_origem not in ('github','banco') then raise exception 'Origem inválida' using errcode = '22023'; end if;
  if coalesce(btrim(p_chave), '') = '' then raise exception 'Falta a chave do desenho' using errcode = '22023'; end if;
  select * into d from public.infra_diagramas where no_id = p_no and chave_auto = p_chave for update;
  if not found then
    insert into public.infra_diagramas (no_id, aba, nome, formato, fonte, origem, chave_auto, referencia, auto_em, evidencias, lacunas, criado_por)
    values (p_no, p_aba, left(p_nome, 160), p_formato, p_fonte, p_origem, p_chave, left(p_referencia, 200), now(),
            coalesce(p_evidencias, '[]'), coalesce(p_lacunas, '[]'), null)
    returning * into d;
    return jsonb_build_object('id', d.id, 'renderizar', true, 'novo', true);
  end if;
  update public.infra_diagramas set nome = left(p_nome, 160), formato = p_formato, fonte = p_fonte, origem = p_origem, referencia = left(p_referencia, 200),
         auto_em = now(), evidencias = coalesce(p_evidencias, '[]'), lacunas = coalesce(p_lacunas, '[]')
   where id = d.id returning * into d;
  return jsonb_build_object('id', d.id, 'renderizar', d.svg is null, 'novo', false);
end $$;

create or replace function public.infra_auto_imagem(p_id uuid, p_svg text, p_erro text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_erro is not null then update public.infra_diagramas set erro = left(p_erro, 500) where id = p_id and chave_auto is not null;
  else update public.infra_diagramas set svg = p_svg, erro = null, renderizado_em = now() where id = p_id and chave_auto is not null; end if;
end $$;

-- fecha o pedido. Os desenhos automáticos da mesma família (p_prefixos) que não saíram desta vez são arquivados
-- (ex.: uma tabela ou um esquema sumiu, um repositório foi desligado). Arquivar não apaga: o texto fica nas versões.
create or replace function public.infra_auto_concluir(p_id uuid, p_status text, p_erro text, p_diagramas uuid[], p_resumo jsonb, p_prefixos text[] default '{}')
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.infra_automacoes;
begin
  if p_status not in ('pronto','erro') then raise exception 'Status inválido' using errcode = '22023'; end if;
  update public.infra_automacoes set status = p_status, concluido_em = now(), erro = left(p_erro, 1000),
         diagramas = coalesce(p_diagramas, '{}'), resumo = coalesce(p_resumo, '[]')
   where id = p_id returning * into a;
  if not found or p_status <> 'pronto' then return; end if;
  update public.infra_diagramas d set arquivado_em = now()
   where d.no_id = a.no_id and d.chave_auto is not null and d.arquivado_em is null
     and not (d.id = any(coalesce(p_diagramas, '{}')))
     and exists (select 1 from unnest(coalesce(p_prefixos, '{}')) px where px <> '' and left(d.chave_auto, length(px)) = px);
end $$;

-- ---------- o quadro de cada desenho ----------
-- Todo desenho automático (e todo desenho do DevIT) aparece como um quadro do canvas da sub-aba (infra_canvas, quadros/auto...),
-- montado com os cards, grupos e ligações do canvas. No quadro principal da sub-aba entra, uma vez só, um card que abre esse quadro.
alter table public.infra_diagramas add column if not exists quadro text check (quadro is null or quadro ~ '^quadros/[A-Za-z0-9_-]{1,80}$');
comment on column public.infra_diagramas.quadro is 'O quadro do canvas onde o desenho está montado (infra_canvas.caminho), para a tela abrir direto nele.';

create or replace function interno.infra_quadro_gravar(p_no uuid, p_aba text, p_chave text, p_nome text, p_doc jsonb, p_diagrama uuid, p_nota text) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare qid text; cam text; raiz jsonb; nx numeric; ny numeric;
begin
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos e produtos' using errcode = '22023'; end if;
  if not interno.infra_aba_ok(p_aba) then raise exception 'Sub-aba inválida' using errcode = '22023'; end if;
  if coalesce(btrim(p_chave), '') = '' then raise exception 'Falta a chave do quadro' using errcode = '22023'; end if;
  if jsonb_typeof(p_doc -> 'nodes') is distinct from 'array' or jsonb_typeof(p_doc -> 'edges') is distinct from 'array' then raise exception 'Documento de quadro inválido' using errcode = '22023'; end if;
  qid := 'auto' || substr(md5(p_chave), 1, 16); cam := 'quadros/' || qid;
  insert into public.infra_canvas (no_id, aba, caminho, dados, atualizado_por)
  values (p_no, p_aba, cam, jsonb_build_object('nome', left(coalesce(nullif(btrim(p_nome), ''), 'Desenho'), 160), 'pai', 'raiz', 'nodes', p_doc -> 'nodes', 'edges', p_doc -> 'edges',
          'atualizadoEm', (extract(epoch from now()) * 1000)::bigint), interno.pessoa_atual())
  on conflict (no_id, aba, caminho) do update set dados = excluded.dados, atualizado_por = excluded.atualizado_por;
  select dados into raiz from public.infra_canvas where no_id = p_no and aba = p_aba and caminho = 'quadros/raiz' for update;
  raiz := coalesce(raiz, jsonb_build_object('nome', 'Quadro principal', 'pai', null, 'nodes', '[]'::jsonb, 'edges', '[]'::jsonb));
  if not exists (select 1 from jsonb_array_elements(coalesce(raiz -> 'nodes', '[]'::jsonb)) n where n ->> 'quadroId' = qid) then
    select coalesce(max((n ->> 'x')::numeric + coalesce((n ->> 'w')::numeric, 250)) + 80, 0), coalesce(min((n ->> 'y')::numeric), 0) into nx, ny
      from jsonb_array_elements(coalesce(raiz -> 'nodes', '[]'::jsonb)) n where jsonb_typeof(n -> 'x') = 'number';
    raiz := jsonb_set(raiz, '{nodes}', coalesce(raiz -> 'nodes', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'n' || substr(md5('card:' || qid), 1, 14), 'tipo', 'quadro', 'x', round(coalesce(nx, 0) / 20) * 20, 'y', round(coalesce(ny, 0) / 20) * 20, 'w', 260, 'cor', 'ouro',
      'titulo', left(coalesce(nullif(btrim(p_nome), ''), 'Desenho'), 160), 'quadroId', qid, 'nota', coalesce(p_nota, ''))));
    insert into public.infra_canvas (no_id, aba, caminho, dados, atualizado_por) values (p_no, p_aba, 'quadros/raiz', raiz, interno.pessoa_atual())
    on conflict (no_id, aba, caminho) do update set dados = excluded.dados, atualizado_por = excluded.atualizado_por;
  end if;
  if p_diagrama is not null then update public.infra_diagramas set quadro = cam where id = p_diagrama and no_id = p_no and quadro is distinct from cam; end if;
  return cam;
end $$;

-- a função diagramas-auto (service_role) publica o quadro do desenho automático
create or replace function public.infra_auto_quadro(p_no uuid, p_aba text, p_chave text, p_nome text, p_doc jsonb, p_diagrama uuid default null) returns text
language sql security definer set search_path = public, pg_temp as $$
  select interno.infra_quadro_gravar(p_no, p_aba, p_chave, p_nome, p_doc, p_diagrama, 'Montado sozinho a partir do código publicado ou do banco. A próxima atualização refaz este quadro (mantém onde você arrumou os cards, se nada mudou).')
$$;
-- o que o robô já tinha montado (para manter onde a pessoa arrumou os cards)
create or replace function public.infra_auto_quadro_ler(p_no uuid, p_aba text, p_chave text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select dados from public.infra_canvas where no_id = p_no and aba = p_aba and caminho = 'quadros/auto' || substr(md5(p_chave), 1, 16)
$$;
-- a função diagramas (com o login da pessoa) publica o quadro do desenho do DevIT: só quem pode editar o projeto ou produto
create or replace function public.infra_quadro_publicar(p_no uuid, p_aba text, p_chave text, p_nome text, p_doc jsonb, p_diagrama uuid default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  return interno.infra_quadro_gravar(p_no, p_aba, p_chave, p_nome, p_doc, p_diagrama, 'Montado pelo DevIT a partir das fontes reais. Pedir de novo ao DevIT refaz este quadro.');
end $$;

-- ---------- acesso ----------
alter table public.infra_bancos enable row level security;
alter table public.infra_automacoes enable row level security;
drop policy if exists ver on public.infra_bancos;
create policy ver on public.infra_bancos for select to authenticated using (no_id in (select interno.nos_editaveis()));
drop policy if exists ver on public.infra_automacoes;
create policy ver on public.infra_automacoes for select to authenticated using (no_id in (select interno.nos_visiveis()));

revoke all on public.infra_bancos, public.infra_automacoes from anon, authenticated;
grant select on public.infra_bancos, public.infra_automacoes to authenticated;   -- mudar, só pelas funções acima
grant all on public.infra_bancos, public.infra_automacoes to service_role;

revoke all on function interno.infra_auto_chamar(), interno.infra_no_de(uuid), interno.infra_publicou(), interno.infra_quadro_gravar(uuid, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.infra_auto_quadro(uuid, text, text, text, jsonb, uuid), public.infra_auto_quadro_ler(uuid, text, text), public.infra_quadro_publicar(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.infra_auto_quadro(uuid, text, text, text, jsonb, uuid), public.infra_auto_quadro_ler(uuid, text, text) to service_role;
grant execute on function public.infra_quadro_publicar(uuid, text, text, text, jsonb, uuid) to authenticated, service_role;
revoke all on function public.infra_banco_definir(uuid, text, text[], text, boolean), public.infra_banco_remover(uuid), public.infra_auto_pedir(uuid) from public, anon;
grant execute on function public.infra_banco_definir(uuid, text, text[], text, boolean), public.infra_banco_remover(uuid), public.infra_auto_pedir(uuid) to authenticated;
revoke all on function public.infra_auto_proximos(integer), public.infra_auto_bancos_devidos(integer), public.infra_auto_banco_lido(uuid, text, text, boolean),
                       public.infra_auto_gravar(uuid, text, text, text, text, text, text, text, jsonb, jsonb), public.infra_auto_imagem(uuid, text, text),
                       public.infra_auto_concluir(uuid, text, text, uuid[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.infra_auto_proximos(integer), public.infra_auto_bancos_devidos(integer), public.infra_auto_banco_lido(uuid, text, text, boolean),
                          public.infra_auto_gravar(uuid, text, text, text, text, text, text, text, jsonb, jsonb), public.infra_auto_imagem(uuid, text, text),
                          public.infra_auto_concluir(uuid, text, text, uuid[], jsonb, text[]) to service_role;

-- >>>>>>>>>> 32_conexoes_git.sql
-- =====================================================================
-- Parte 32: conectar o GitHub e o GitLab com um clique, por espaço (cada empresa conecta a própria conta)
-- Depende das partes 15 (espaços), 16 (dono do sistema), 19 (repositórios) e 30 (desenhos automáticos).
--
-- Como fica:
--   1. GitHub: o CicloDev tem UM app no GitHub (criado uma vez pelo dono do sistema, com um clique na tela Admin).
--      Cada empresa instala esse app na conta ou na organização dela pela janelinha do GitHub e escolhe os repositórios.
--      Os avisos (push, pull request, publicação) chegam sozinhos pelo app, sem configurar nada em cada repositório.
--      O código é lido com uma chave temporária do app (vale 1 hora), nunca com a chave de uma pessoa.
--   2. GitLab: o CicloDev tem UM aplicativo OAuth no GitLab (o dono do sistema cadastra o número e o segredo na tela Admin).
--      A empresa clica em Conectar ao GitLab, autoriza na janelinha do GitLab e escolhe os projetos.
--      O aviso de cada projeto é criado sozinho pelo CicloDev, com um segredo que ninguém precisa ver.
--   3. Cada conexão é do espaço (da empresa), não da pessoa. Quem é do espaço vê as contas conectadas e liga
--      os repositórios dela aos projetos, produtos e aplicações.
--
-- Sai (não é mais usado): o segredo que a tela mostrava para colar no GitHub ou no GitLab (repositorio_segredo),
-- a ligação digitando o endereço do repositório e a função git_receber antiga.
-- =====================================================================

-- ---------- 1. os apps do CicloDev (um do GitHub, um do GitLab) ----------
create table if not exists interno.git_apps (
  provedor      text primary key check (provedor in ('github','gitlab')),
  dados         jsonb not null,                       -- tudo, com os segredos (só a função lê)
  publico       jsonb not null default '{}'::jsonb,   -- o que a tela pode saber (nome do app, número público, endereço de volta)
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.pessoas(id) on delete set null
);
comment on table interno.git_apps is 'O app do CicloDev no GitHub e o aplicativo OAuth no GitLab. Os segredos ficam em dados; a tela só vê publico, pela função git_apps_status.';
revoke all on interno.git_apps from public, anon, authenticated;

-- o que a tela sabe: se cada um está pronto e os dados públicos
create or replace function public.git_apps_status() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'github', coalesce((select a.publico || jsonb_build_object('pronto', true) from interno.git_apps a where a.provedor = 'github'), '{"pronto":false}'::jsonb),
    'gitlab', coalesce((select a.publico || jsonb_build_object('pronto', true) from interno.git_apps a where a.provedor = 'gitlab'), '{"pronto":false}'::jsonb))
$$;

-- só o dono do sistema grava. GitHub: o que o GitHub devolve ao criar o app. GitLab: número, segredo e endereço.
create or replace function public.git_app_gravar(p_provedor text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb := coalesce(p_dados, '{}'::jsonb); pub jsonb; antigo jsonb;
begin
  perform interno.exigir_dono();
  select dados into antigo from interno.git_apps where provedor = p_provedor;
  if p_provedor = 'github' then
    if coalesce(d->>'app_id', '') !~ '^[0-9]+$' or coalesce(d->>'slug', '') !~ '^[a-z0-9-]+$' or coalesce(d->>'client_id', '') = ''
       or coalesce(d->>'client_secret', '') = '' or coalesce(d->>'webhook_secret', '') = '' or coalesce(d->>'pem', '') !~ 'PRIVATE KEY' then
      raise exception 'Faltam dados do app do GitHub' using errcode = '22023'; end if;
    pub := jsonb_build_object('slug', d->>'slug', 'client_id', d->>'client_id', 'nome', d->>'nome', 'html_url', d->>'html_url', 'dono', d->>'dono', 'retorno', d->>'retorno');
  elsif p_provedor = 'gitlab' then
    if coalesce(btrim(d->>'client_secret'), '') = '' and antigo is not null then d := d || jsonb_build_object('client_secret', antigo->>'client_secret'); end if;
    d := d || jsonb_build_object('base', rtrim(coalesce(nullif(btrim(d->>'base'), ''), 'https://gitlab.com'), '/'));
    if coalesce(btrim(d->>'client_id'), '') = '' or coalesce(btrim(d->>'client_secret'), '') = '' then
      raise exception 'Informe o Application ID e o Secret do GitLab' using errcode = '22023'; end if;
    if d->>'base' !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'O endereço do GitLab precisa ser https://servidor' using errcode = '22023'; end if;
    if coalesce(d->>'retorno', '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
    pub := jsonb_build_object('client_id', btrim(d->>'client_id'), 'base', d->>'base', 'retorno', d->>'retorno');
  else raise exception 'Provedor inválido' using errcode = '22023'; end if;
  insert into interno.git_apps (provedor, dados, publico, atualizado_por) values (p_provedor, d, pub, interno.pessoa_atual())
  on conflict (provedor) do update set dados = excluded.dados, publico = excluded.publico, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return pub || jsonb_build_object('pronto', true);
end $$;

-- a função git-conectar, a git-webhook e as dos desenhos leem os segredos (só service_role)
create or replace function public.git_app_ler(p_provedor text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$ select dados from interno.git_apps where provedor = p_provedor $$;

-- ---------- 2. as contas conectadas de cada espaço ----------
create table if not exists public.git_conexoes (
  id          uuid primary key default gen_random_uuid(),
  espaco_id   uuid not null references public.espacos(id) on delete cascade,
  provedor    text not null check (provedor in ('github','gitlab')),
  externo_id  text not null check (length(externo_id) between 1 and 60),   -- GitHub: número da instalação do app; GitLab: número da pessoa
  conta       text not null check (length(conta) between 1 and 200),       -- o nome da conta ou da organização
  conta_tipo  text,                                                        -- GitHub: Organization ou User
  avatar_url  text check (avatar_url is null or avatar_url ~ '^https://'),
  url         text check (url is null or url ~ '^https://'),               -- onde mudar o acesso (GitHub: tela da instalação)
  criado_por  uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  removida_em timestamptz,
  ultimo_erro text,
  unique (espaco_id, provedor, externo_id)
);
create index if not exists git_conexoes_externo_idx on public.git_conexoes (provedor, externo_id);
comment on table public.git_conexoes is 'Conta do GitHub (instalação do app do CicloDev) ou do GitLab (autorização OAuth) conectada a um espaço. Quem é do espaço vê e usa.';
-- GitHub: uma instalação pode ser de outra pessoa (o dono instalou o app e você é colaborador de um repositório dele).
-- Na hora de conectar, guardamos só os repositórios que QUEM CONECTOU pode acessar; só esses aparecem e podem ser ligados.
-- Vazio (null) só no GitLab, onde a chave já é da própria pessoa e o GitLab já limita.
alter table public.git_conexoes add column if not exists repos_permitidos text[];
comment on column public.git_conexoes.repos_permitidos is 'GitHub: números dos repositórios desta instalação que a pessoa que conectou pode acessar. Só eles aparecem e podem ser ligados. Atualiza ao conectar de novo.';

create table if not exists interno.git_tokens (
  conexao_id  uuid primary key references public.git_conexoes(id) on delete cascade,
  acesso      text not null,
  renovacao   text,
  expira_em   timestamptz,
  trocado_em  timestamptz not null default now()
);
comment on table interno.git_tokens is 'Só GitLab: a chave de acesso e a de renovação da conexão. O GitHub não guarda chave: pede uma temporária ao app a cada uso.';
revoke all on interno.git_tokens from public, anon, authenticated;

alter table public.git_conexoes enable row level security;
drop policy if exists ver on public.git_conexoes;
create policy ver on public.git_conexoes for select to authenticated using (espaco_id in (select interno.meus_espacos()) and not (select interno.eh_stakeholder()));
revoke all on public.git_conexoes from anon, authenticated;
grant select on public.git_conexoes to authenticated;
grant select, insert, update, delete on public.git_conexoes to service_role;

-- ---------- 3. o vai e volta da janelinha (evita que alguém "pendure" a conta de outro no seu espaço) ----------
create table if not exists interno.git_estados (
  estado     text primary key,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  espaco_id  uuid references public.espacos(id) on delete cascade,
  provedor   text not null check (provedor in ('github','gitlab','github-app')),
  criado_em  timestamptz not null default now()
);
revoke all on interno.git_estados from public, anon, authenticated;

create or replace function public.git_estado_novo(p_provedor text) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare e text := encode(gen_random_bytes(24), 'hex'); p uuid := interno.pessoa_atual(); esp uuid := interno.meu_espaco();
begin
  if p is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if p_provedor not in ('github','gitlab','github-app') then raise exception 'Provedor inválido' using errcode = '22023'; end if;
  if p_provedor = 'github-app' then perform interno.exigir_dono(); end if;
  if p_provedor <> 'github-app' and esp is null then raise exception 'Você ainda não tem um espaço' using errcode = '42501'; end if;
  delete from interno.git_estados where criado_em < now() - interval '1 day';
  insert into interno.git_estados (estado, pessoa_id, espaco_id, provedor) values (e, p, esp, p_provedor);
  return e;
end $$;

-- a pessoa voltou da janelinha: confere que o vai e volta é dela e é recente, e usa (não vale de novo)
create or replace function public.git_estado_usar(p_estado text, p_provedor text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s interno.git_estados;
begin
  delete from interno.git_estados where estado = p_estado and provedor = p_provedor and pessoa_id = interno.pessoa_atual()
   and criado_em > now() - interval '30 minutes' returning * into s;
  if s.estado is null then raise exception 'A conexão expirou ou não é sua. Tente de novo.' using errcode = '42501'; end if;
  return jsonb_build_object('pessoa_id', s.pessoa_id, 'espaco_id', s.espaco_id);
end $$;

-- ---------- 4. gravar e ler as conexões (só a função git-conectar) ----------
create or replace function public.git_conexao_gravar(p_espaco uuid, p_pessoa uuid, p_provedor text, p_externo text, p_conta text, p_tipo text,
                                                     p_avatar text, p_url text, p_tokens jsonb default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare cid uuid;
begin
  insert into public.git_conexoes (espaco_id, provedor, externo_id, conta, conta_tipo, avatar_url, url, criado_por)
  values (p_espaco, p_provedor, p_externo, left(p_conta, 200), left(p_tipo, 40),
          case when p_avatar ~ '^https://' then p_avatar end, case when p_url ~ '^https://' then p_url end, p_pessoa)
  on conflict (espaco_id, provedor, externo_id) do update set conta = excluded.conta, conta_tipo = excluded.conta_tipo,
     avatar_url = excluded.avatar_url, url = coalesce(excluded.url, git_conexoes.url), removida_em = null, ultimo_erro = null
  returning id into cid;
  if p_tokens is not null and coalesce(p_tokens->>'acesso', '') <> '' then
    insert into interno.git_tokens (conexao_id, acesso, renovacao, expira_em) values (cid, p_tokens->>'acesso', p_tokens->>'renovacao', (p_tokens->>'expira_em')::timestamptz)
    on conflict (conexao_id) do update set acesso = excluded.acesso, renovacao = excluded.renovacao, expira_em = excluded.expira_em, trocado_em = now();
  end if;
  -- os repositórios que tinham parado por causa desta conta voltam
  update public.repositorios set ativo = true, ultimo_erro = null where conexao_id = cid and not ativo and ultimo_erro like 'Conta %';
  return cid;
end $$;

create or replace function public.git_conexao_ler(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', t.acesso, 'renovacao', t.renovacao, 'expira_em', t.expira_em) from interno.git_tokens t where t.conexao_id = c.id))
    from public.git_conexoes c where c.id = p_id
$$;

create or replace function public.git_tokens_gravar(p_conexao uuid, p_acesso text, p_renovacao text, p_expira timestamptz) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into interno.git_tokens (conexao_id, acesso, renovacao, expira_em) values (p_conexao, p_acesso, p_renovacao, p_expira)
  on conflict (conexao_id) do update set acesso = excluded.acesso, renovacao = coalesce(excluded.renovacao, git_tokens.renovacao), expira_em = excluded.expira_em, trocado_em = now()
$$;

-- a conta não responde mais (chave revogada, app removido): anota e para os repositórios dela
create or replace function public.git_conexao_erro(p_conexao uuid, p_erro text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.git_conexoes set ultimo_erro = left(p_erro, 500) where id = p_conexao
$$;

-- tirar uma conta do espaço (a pessoa do espaço). Com repositório ligado, pede para desligar antes.
create or replace function public.git_conexao_remover(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.git_conexoes c where c.id = p_id and c.espaco_id in (select interno.meus_espacos())) then
    raise exception 'Você não pode mudar esta conta' using errcode = '42501'; end if;
  if exists (select 1 from public.repositorios r where r.conexao_id = p_id) then
    raise exception 'Desligue antes os repositórios desta conta' using errcode = '23503'; end if;
  delete from public.git_conexoes where id = p_id;
end $$;

-- ---------- 5. repositórios: agora só entram pela conexão ----------
alter table public.repositorios
  add column if not exists conexao_id uuid references public.git_conexoes(id) on delete restrict,
  add column if not exists externo_id text,
  add column if not exists webhook_id text;
create index if not exists repositorios_externo_idx on public.repositorios (provedor, externo_id);
comment on column public.repositorios.conexao_id is 'A conta conectada (GitHub ou GitLab) por onde o repositório foi ligado.';
comment on column public.repositorios.externo_id is 'O número do repositório no GitHub ou do projeto no GitLab.';
comment on column public.repositorios.webhook_id is 'Só GitLab: o aviso que o CicloDev criou no projeto (sai junto quando desliga).';

-- a tela não insere mais direto nem muda nome e número: só liga pela função, e muda só as opções
drop policy if exists cria on public.repositorios;
revoke insert, update on public.repositorios from authenticated;
grant update (mover_status, ativo, branch_principal) on public.repositorios to authenticated;

-- o segredo do aviso agora só existe no GitLab e ninguém vê: a função cria o aviso no projeto sozinha
drop function if exists public.repositorio_segredo(uuid, boolean);
create or replace function interno.repositorio_criar_segredo() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.provedor = 'gitlab' then insert into interno.repositorios_segredos (repositorio_id) values (new.id) on conflict do nothing; end if;
  return null;
end $$;
delete from interno.repositorios_segredos s using public.repositorios r where r.id = s.repositorio_id and r.provedor = 'github';

-- ligar um repositório da conta conectada a um ponto. Quem chama é a função git-conectar, com o login da pessoa,
-- depois de conferir no GitHub ou no GitLab que o repositório existe nessa conta.
create or replace function public.git_repo_ligar(p_no uuid, p_conexao uuid, p_externo text, p_nome text, p_url text, p_branch text, p_mover boolean default true)
returns public.repositorios
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.git_conexoes; r public.repositorios;
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  select * into c from public.git_conexoes where id = p_conexao and espaco_id in (select interno.meus_espacos()) and removida_em is null;
  if c.id is null then raise exception 'Esta conta não está conectada ao seu espaço' using errcode = '42501'; end if;
  if coalesce(p_externo, '') !~ '^[0-9]+$' then raise exception 'Repositório inválido' using errcode = '22023'; end if;
  if c.provedor = 'github' and not (p_externo = any(coalesce(c.repos_permitidos, '{}'))) then
    raise exception 'Quem conectou esta conta não tem acesso a este repositório no GitHub' using errcode = '42501'; end if;
  insert into public.repositorios (no_id, provedor, nome, url, branch_principal, mover_status, conexao_id, externo_id)
  values (p_no, c.provedor, p_nome, case when p_url ~ '^https://' then p_url end, coalesce(nullif(btrim(p_branch), ''), 'main'), coalesce(p_mover, true), c.id, p_externo)
  on conflict (no_id, provedor, nome) do update set conexao_id = excluded.conexao_id, externo_id = excluded.externo_id, url = excluded.url,
     branch_principal = excluded.branch_principal, ativo = true, ultimo_erro = null
  returning * into r;
  return r;
end $$;

-- ao conectar de novo, a lista é refeita: repositório ligado que quem conectou não acessa mais para (e volta se o acesso voltar)
create or replace function public.git_conexao_repos(p_conexao uuid, p_repos text[]) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare l text[] := array(select distinct x from unnest(coalesce(p_repos, '{}')) x where x ~ '^[0-9]+$');
begin
  update public.git_conexoes set repos_permitidos = l where id = p_conexao and provedor = 'github';
  update public.repositorios set ativo = false, ultimo_erro = 'Conta sem acesso a este repositório: quem conectou não tem mais acesso a ele no GitHub'
   where conexao_id = p_conexao and provedor = 'github' and ativo and not (externo_id = any(l));
  update public.repositorios set ativo = true, ultimo_erro = null
   where conexao_id = p_conexao and provedor = 'github' and not ativo and ultimo_erro like 'Conta sem acesso%' and externo_id = any(l);
end $$;
revoke all on function public.git_conexao_repos(uuid, text[]) from public, anon, authenticated;
grant execute on function public.git_conexao_repos(uuid, text[]) to service_role;

create or replace function public.git_repo_segredo(p_repo uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$ select segredo from interno.repositorios_segredos where repositorio_id = p_repo $$;
create or replace function public.git_repo_gancho(p_repo uuid, p_gancho text) returns void
language sql security definer set search_path = public, pg_temp as $$ update public.repositorios set webhook_id = left(p_gancho, 60) where id = p_repo $$;

-- ---------- 6. receber os avisos ----------
-- o que cada aviso faz, igual para os dois provedores depois de conferido
-- o repositório mudou de nome ou de dono no GitHub ou no GitLab: o CicloDev acompanha sozinho no próximo aviso.
-- É só uma troca de nome: a ligação é pelo id do repositório no GitHub/GitLab (externo_id), que não muda.
-- Nunca derruba o aviso: se o nome novo não couber nas regras da tabela, fica o antigo.
create or replace function interno.git_nome_repo(r public.repositorios, j jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare nm text; u text; ext text;
begin
  if r.provedor = 'github' then nm := j#>>'{repository,full_name}'; u := j#>>'{repository,html_url}'; ext := j#>>'{repository,id}';
  else nm := j#>>'{project,path_with_namespace}'; u := j#>>'{project,web_url}'; ext := j#>>'{project,id}'; end if;
  if nm is null or ext is null or r.externo_id is null or ext <> r.externo_id then return; end if;
  if nm !~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$' or length(nm) > 200 then return; end if;
  if u is not null and u !~ '^https://' then u := null; end if;
  begin
    update public.repositorios set nome = nm, url = coalesce(u, url)
     where id = r.id and (nome is distinct from nm or (u is not null and url is distinct from u));
  exception when unique_violation then null;
  end;
end $$;
revoke all on function interno.git_nome_repo(public.repositorios, jsonb) from public, anon, authenticated;

create or replace function interno.git_processar(r public.repositorios, p_evento text, j jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare ev text := lower(coalesce(p_evento, '')); res jsonb := '{}'::jsonb;
  br text; its uuid[]; its_b uuid[]; c jsonb; n_lig integer := 0; n_mov integer := 0; x uuid; pr jsonb; est text;
begin
  if not r.ativo then return jsonb_build_object('ignorado', 'repositório desligado'); end if;
  perform interno.git_nome_repo(r, j);
  if r.provedor = 'github' then
    if ev = 'ping' then res := jsonb_build_object('ping', true);
    elsif ev = 'push' then
      if coalesce(j->>'ref', '') like 'refs/heads/%' then
        br := substr(j->>'ref', 12);
        its_b := array(select interno.codigo_itens(r.no_id, br));
        if coalesce((j->>'deleted')::boolean, false) then
          update public.codigo_vinculos set estado = 'excluido', atualizado_em = now() where repositorio_id = r.id and tipo = 'branch' and ref = br;
        else
          n_lig := n_lig + interno.codigo_ligar(r, its_b, 'branch', br, br, coalesce(j#>>'{repository,html_url}', '') || '/tree/' || br, 'ativo', j#>>'{sender,login}', now());
          for c in select * from jsonb_array_elements(coalesce(j->'commits', '[]')) loop
            its := array(select distinct unnest(array(select interno.codigo_itens(r.no_id, c->>'message')) || its_b));
            n_lig := n_lig + interno.codigo_ligar(r, its, 'commit', c->>'id', split_part(c->>'message', E'\n', 1), c->>'url', 'ativo', c#>>'{author,name}', (c->>'timestamp')::timestamptz);
            if r.mover_status then foreach x in array its loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
          end loop;
          if r.mover_status then foreach x in array coalesce(its_b, '{}') loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
        end if;
      end if;
    elsif ev = 'create' and j->>'ref_type' = 'branch' then
      br := j->>'ref'; its_b := array(select interno.codigo_itens(r.no_id, br));
      n_lig := interno.codigo_ligar(r, its_b, 'branch', br, br, coalesce(j#>>'{repository,html_url}', '') || '/tree/' || br, 'ativo', j#>>'{sender,login}', now());
      if r.mover_status then foreach x in array coalesce(its_b, '{}') loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
    elsif ev = 'delete' and j->>'ref_type' = 'branch' then
      update public.codigo_vinculos set estado = 'excluido', atualizado_em = now() where repositorio_id = r.id and tipo = 'branch' and ref = j->>'ref';
    elsif ev = 'pull_request' then
      pr := j->'pull_request';
      est := case when coalesce((pr->>'merged')::boolean, false) then 'mesclado' when pr->>'state' = 'closed' then 'fechado'
                  when coalesce((pr->>'draft')::boolean, false) then 'rascunho' else 'aberto' end;
      its := array(select interno.codigo_itens(r.no_id, coalesce(pr->>'title', '') || ' ' || coalesce(pr#>>'{head,ref}', '')));
      n_lig := interno.codigo_ligar(r, its, 'pr', pr->>'number', pr->>'title', pr->>'html_url', est, pr#>>'{user,login}', coalesce((pr->>'updated_at')::timestamptz, now()));
      if r.mover_status then foreach x in array coalesce(its, '{}') loop
        if interno.codigo_mover(x, case est when 'mesclado' then 'done' when 'aberto' then 'review' when 'rascunho' then 'doing' else 'backlog' end) then n_mov := n_mov + 1; end if;
      end loop; end if;
    elsif ev = 'release' and j->>'action' in ('published','released') then
      x := interno.codigo_publicar(r, 'release:' || (j#>>'{release,id}'), coalesce(nullif(j#>>'{release,tag_name}', ''), j#>>'{release,name}'), 'producao', 'sucesso',
             j#>>'{release,tag_name}', j#>>'{release,html_url}', coalesce((j#>>'{release,published_at}')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    elsif ev = 'deployment_status' then
      x := interno.codigo_publicar(r, 'deploy:' || (j#>>'{deployment,id}'), j#>>'{deployment,ref}', interno.codigo_ambiente(coalesce(j#>>'{deployment_status,environment}', j#>>'{deployment,environment}')),
             case j#>>'{deployment_status,state}' when 'success' then 'sucesso' when 'failure' then 'falha' when 'error' then 'falha' else 'em_andamento' end,
             left(j#>>'{deployment,sha}', 40), coalesce(nullif(j#>>'{deployment_status,environment_url}', ''), nullif(j#>>'{deployment_status,target_url}', '')), coalesce((j#>>'{deployment_status,updated_at}')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    else res := jsonb_build_object('ignorado', ev); end if;
  else -- GitLab
    if ev = 'push hook' then
      br := regexp_replace(coalesce(j->>'ref', ''), '^refs/heads/', '');
      its_b := array(select interno.codigo_itens(r.no_id, br));
      if coalesce(j->>'after', '') ~ '^0+$' then
        update public.codigo_vinculos set estado = 'excluido', atualizado_em = now() where repositorio_id = r.id and tipo = 'branch' and ref = br;
      else
        n_lig := n_lig + interno.codigo_ligar(r, its_b, 'branch', br, br, coalesce(j#>>'{project,web_url}', '') || '/-/tree/' || br, 'ativo', j->>'user_username', now());
        for c in select * from jsonb_array_elements(coalesce(j->'commits', '[]')) loop
          its := array(select distinct unnest(array(select interno.codigo_itens(r.no_id, c->>'message')) || its_b));
          n_lig := n_lig + interno.codigo_ligar(r, its, 'commit', c->>'id', split_part(c->>'message', E'\n', 1), c->>'url', 'ativo', c#>>'{author,name}', (c->>'timestamp')::timestamptz);
          if r.mover_status then foreach x in array its loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
        end loop;
        if r.mover_status then foreach x in array coalesce(its_b, '{}') loop if interno.codigo_mover(x, 'doing') then n_mov := n_mov + 1; end if; end loop; end if;
      end if;
    elsif ev = 'merge request hook' then
      pr := j->'object_attributes';
      est := case pr->>'state' when 'merged' then 'mesclado' when 'closed' then 'fechado' when 'locked' then 'fechado'
                  else case when coalesce((pr->>'draft')::boolean, (pr->>'work_in_progress')::boolean, false) then 'rascunho' else 'aberto' end end;
      its := array(select interno.codigo_itens(r.no_id, coalesce(pr->>'title', '') || ' ' || coalesce(pr->>'source_branch', '')));
      n_lig := interno.codigo_ligar(r, its, 'pr', pr->>'iid', pr->>'title', pr->>'url', est, j#>>'{user,username}', coalesce((pr->>'updated_at')::timestamptz, now()));
      if r.mover_status then foreach x in array coalesce(its, '{}') loop
        if interno.codigo_mover(x, case est when 'mesclado' then 'done' when 'aberto' then 'review' when 'rascunho' then 'doing' else 'backlog' end) then n_mov := n_mov + 1; end if;
      end loop; end if;
    elsif ev = 'release hook' and coalesce(j->>'action', 'create') in ('create','update') then
      x := interno.codigo_publicar(r, 'release:' || coalesce(j->>'id', j->>'tag'), coalesce(nullif(j->>'tag', ''), j->>'name'), 'producao', 'sucesso', j->>'tag', j->>'url',
             coalesce((j->>'released_at')::timestamptz, (j->>'created_at')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    elsif ev = 'deployment hook' then
      x := interno.codigo_publicar(r, 'deploy:' || (j->>'deployment_id'), j->>'ref', interno.codigo_ambiente(j->>'environment'),
             case j->>'status' when 'success' then 'sucesso' when 'failed' then 'falha' when 'canceled' then 'falha' else 'em_andamento' end,
             left(j->>'sha', 40), nullif(j->>'environment_external_url', ''), coalesce((j->>'status_changed_at')::timestamptz, now()));
      res := jsonb_build_object('publicacao', x);
    else res := jsonb_build_object('ignorado', ev); end if;
  end if;
  update public.repositorios set ultimo_evento = p_evento, ultimo_evento_em = now(), ultimo_erro = null where id = r.id;
  return jsonb_build_object('ligados', n_lig, 'status_mudou', n_mov) || res;
end $$;

-- GitHub: todos os avisos chegam pelo app, assinados com o segredo do app
create or replace function public.git_receber_github(p_evento text, p_assinatura text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s text := (select dados->>'webhook_secret' from interno.git_apps where provedor = 'github');
  ev text := lower(coalesce(p_evento, '')); j jsonb; inst text; rid text; r public.repositorios; n integer := 0; res jsonb := '[]'::jsonb; msg text;
begin
  if s is null then return jsonb_build_object('ok', false, 'erro', 'app do GitHub não configurado'); end if;
  if coalesce(p_assinatura, '') <> 'sha256=' || encode(hmac(convert_to(p_corpo, 'UTF8'), convert_to(s, 'UTF8'), 'sha256'), 'hex') then
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida'); end if;
  begin j := p_corpo::jsonb; exception when others then return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  inst := j#>>'{installation,id}';

  if ev = 'ping' then return jsonb_build_object('ok', true, 'ping', true); end if;
  -- a empresa tirou, suspendeu ou voltou com o app na conta dela
  if ev = 'installation' then
    if j->>'action' in ('deleted','suspend') then
      msg := case when j->>'action' = 'deleted' then 'Conta desconectada: o app do CicloDev foi removido no GitHub' else 'Conta suspensa: o app do CicloDev foi suspenso no GitHub' end;
      update public.git_conexoes set removida_em = case when j->>'action' = 'deleted' then now() else removida_em end, ultimo_erro = msg where provedor = 'github' and externo_id = inst;
      update public.repositorios set ativo = false, ultimo_erro = msg
       where conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    elsif j->>'action' = 'unsuspend' then
      update public.git_conexoes set ultimo_erro = null where provedor = 'github' and externo_id = inst;
      update public.repositorios set ativo = true, ultimo_erro = null
       where ultimo_erro like 'Conta %' and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    end if;
    return jsonb_build_object('ok', true, 'instalacao', j->>'action');
  end if;
  -- a empresa tirou (ou devolveu) o acesso a alguns repositórios
  if ev = 'installation_repositories' then
    update public.repositorios set ativo = false, ultimo_erro = 'Conta sem acesso a este repositório: ele saiu do app do CicloDev no GitHub'
     where provedor = 'github' and externo_id in (select x.value->>'id' from jsonb_array_elements(coalesce(j->'repositories_removed', '[]')) x)
       and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    update public.repositorios set ativo = true, ultimo_erro = null
     where provedor = 'github' and ultimo_erro like 'Conta %' and externo_id in (select x.value->>'id' from jsonb_array_elements(coalesce(j->'repositories_added', '[]')) x)
       and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    return jsonb_build_object('ok', true, 'repositorios', j->>'action');
  end if;
  -- os avisos de um repositório: vale para todos os pontos em que ele está ligado por esta instalação
  rid := j#>>'{repository,id}';
  if rid is null or inst is null then return jsonb_build_object('ok', true, 'ignorado', ev); end if;
  for r in select x.* from public.repositorios x join public.git_conexoes c on c.id = x.conexao_id
            where x.provedor = 'github' and x.externo_id = rid and c.provedor = 'github' and c.externo_id = inst and c.removida_em is null loop
    res := res || jsonb_build_array(interno.git_processar(r, p_evento, j) || jsonb_build_object('repositorio', r.id));
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'evento', p_evento, 'repositorios', n, 'resultado', res);
end $$;

-- GitLab: um aviso por projeto, com o segredo que o CicloDev criou para ele
create or replace function public.git_receber_gitlab(p_repo uuid, p_evento text, p_token text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.repositorios; s text; j jsonb;
begin
  select * into r from public.repositorios where id = p_repo and provedor = 'gitlab';
  if r.id is null then return jsonb_build_object('ok', false, 'erro', 'repositório não encontrado'); end if;
  select segredo into s from interno.repositorios_segredos where repositorio_id = r.id;
  if s is null or coalesce(p_token, '') <> s then
    update public.repositorios set ultimo_erro = 'Aviso recusado: segredo não confere (' || coalesce(p_evento, '?') || ')', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida');
  end if;
  begin j := p_corpo::jsonb; exception when others then
    update public.repositorios set ultimo_erro = 'Aviso com conteúdo inválido', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  return jsonb_build_object('ok', true, 'evento', p_evento) || interno.git_processar(r, p_evento, j);
end $$;

drop function if exists public.git_receber(uuid, text, text, text, text, text);

-- ---------- 7. os desenhos automáticos (parte 30) passam a ler também o GitLab ----------
alter table public.infra_automacoes drop constraint if exists infra_automacoes_origem_check;
alter table public.infra_automacoes add constraint infra_automacoes_origem_check check (origem in ('github','gitlab','banco','manual'));
alter table public.infra_diagramas drop constraint if exists infra_diagramas_origem_check;
alter table public.infra_diagramas add constraint infra_diagramas_origem_check check (origem in ('manual','devit','github','gitlab','banco'));

-- Parte 29 (troca): a aplicação também tem a aba Infraestrutura, com os desenhos do código ligado a ela
create or replace function interno.infra_no_ok(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select exists (select 1 from public.nos where id = p and tipo in ('projeto','produto','aplicacao')) $$;

-- Parte 19 (troca): a versão (release) publicada pelo GitHub/GitLab é procurada só no lugar do repositório e no que
-- está dentro dele, nunca no projeto inteiro: dois produtos com "v1.0" não se confundem.
create or replace function interno.codigo_versao(p_no uuid, p_nome text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id from public.marcos m
   where m.tipo = 'release' and p_nome is not null
     and m.no_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no)
     and lower(regexp_replace(btrim(m.nome), '^[vV]', '')) = lower(regexp_replace(btrim(p_nome), '^[vV]', ''))
   order by m.data desc limit 1
$$;
revoke all on function interno.codigo_versao(uuid, text) from public, anon, authenticated;

create or replace function interno.infra_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare alvo uuid; prov text; n integer := 0;
begin
  if new.status <> 'sucesso' or new.ambiente <> 'producao' or new.repositorio_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'sucesso' and old.ambiente = 'producao' and old.referencia is not distinct from new.referencia then return null; end if;
  select r.provedor into prov from public.repositorios r where r.id = new.repositorio_id and r.ativo and r.conexao_id is not null;
  if prov is null then return null; end if;
  -- a aplicação dona do repositório (se for uma) e o produto ou projeto em que ela está: os dois ficam em dia
  for alvo in select distinct x from unnest(array[(select id from public.nos where id = new.no_id and tipo = 'aplicacao'), interno.infra_no_de(new.no_id)]) x where x is not null loop
    if exists (select 1 from public.infra_automacoes a where a.no_id = alvo and a.repositorio_id = new.repositorio_id
                and a.referencia is not distinct from new.referencia and a.status in ('pendente','rodando')) then continue; end if;
    insert into public.infra_automacoes (no_id, origem, repositorio_id, publicacao_id, referencia, pedido_por)
    values (alvo, prov, new.repositorio_id, new.id, left(new.referencia, 200), null);
    n := n + 1;
  end loop;
  if n > 0 then perform interno.infra_auto_chamar(); end if;
  return null;
end $$;

create or replace function public.infra_auto_gravar(p_no uuid, p_aba text, p_chave text, p_nome text, p_formato text, p_fonte text,
                                                    p_origem text, p_referencia text, p_evidencias jsonb default '[]', p_lacunas jsonb default '[]')
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.infra_diagramas;
begin
  if p_origem not in ('github','gitlab','banco') then raise exception 'Origem inválida' using errcode = '22023'; end if;
  if coalesce(btrim(p_chave), '') = '' then raise exception 'Falta a chave do desenho' using errcode = '22023'; end if;
  select * into d from public.infra_diagramas where no_id = p_no and chave_auto = p_chave for update;
  if not found then
    insert into public.infra_diagramas (no_id, aba, nome, formato, fonte, origem, chave_auto, referencia, auto_em, evidencias, lacunas, criado_por)
    values (p_no, p_aba, left(p_nome, 160), p_formato, p_fonte, p_origem, p_chave, left(p_referencia, 200), now(),
            coalesce(p_evidencias, '[]'), coalesce(p_lacunas, '[]'), null)
    returning * into d;
    return jsonb_build_object('id', d.id, 'renderizar', true, 'novo', true);
  end if;
  update public.infra_diagramas set nome = left(p_nome, 160), formato = p_formato, fonte = p_fonte, origem = p_origem, referencia = left(p_referencia, 200),
         auto_em = now(), evidencias = coalesce(p_evidencias, '[]'), lacunas = coalesce(p_lacunas, '[]')
   where id = d.id returning * into d;
  return jsonb_build_object('id', d.id, 'renderizar', d.svg is null, 'novo', false);
end $$;

-- a fila leva junto a conexão e o número de cada repositório (para a função pedir a chave certa)
create or replace function public.infra_auto_proximos(p_limite integer default 3) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare ids uuid[]; saida jsonb;
begin
  update public.infra_automacoes set status = 'erro', concluido_em = now(), erro = 'Parou no meio três vezes'
   where status = 'rodando' and iniciado_em < now() - interval '15 minutes' and tentativas >= 3;
  with fila as (
    select a.id from public.infra_automacoes a
     where a.status = 'pendente' or (a.status = 'rodando' and a.iniciado_em < now() - interval '15 minutes')
     order by a.criado_em limit greatest(1, least(coalesce(p_limite, 3), 10)) for update skip locked),
  pegos as (
    update public.infra_automacoes a set status = 'rodando', iniciado_em = now(), tentativas = a.tentativas + 1
      from fila where a.id = fila.id returning a.id)
  select array_agg(id) into ids from pegos;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'no_id', a.no_id, 'origem', a.origem, 'referencia', a.referencia,
      'repositorios', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor,
                                                                    'conexao_id', r.conexao_id, 'externo_id', r.externo_id) order by r.nome), '[]')
                         from public.repositorios r
                        where r.ativo and r.conexao_id is not null and (case when a.repositorio_id is not null then r.id = a.repositorio_id
                                                else r.no_id = a.no_id or interno.infra_no_de(r.no_id) = a.no_id end)),
      'banco', (select jsonb_build_object('esquemas', b.esquemas, 'conexao', c.conexao)
                  from public.infra_bancos b join interno.infra_bancos_conexao c on c.no_id = b.no_id
                 where b.no_id = a.no_id and b.ativo and a.origem in ('manual','banco'))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $$;

-- ---------- 8. quem chama o quê ----------
revoke all on function public.git_apps_status(), public.git_app_gravar(text, jsonb), public.git_app_ler(text),
  public.git_estado_novo(text), public.git_estado_usar(text, text),
  public.git_conexao_gravar(uuid, uuid, text, text, text, text, text, text, jsonb), public.git_conexao_ler(uuid),
  public.git_tokens_gravar(uuid, text, text, timestamptz), public.git_conexao_erro(uuid, text), public.git_conexao_remover(uuid),
  public.git_repo_ligar(uuid, uuid, text, text, text, text, boolean), public.git_repo_segredo(uuid), public.git_repo_gancho(uuid, text),
  public.git_receber_github(text, text, text), public.git_receber_gitlab(uuid, text, text, text),
  interno.git_processar(public.repositorios, text, jsonb) from public, anon, authenticated;
grant execute on function public.git_apps_status(), public.git_app_gravar(text, jsonb), public.git_estado_novo(text), public.git_estado_usar(text, text),
  public.git_conexao_remover(uuid), public.git_repo_ligar(uuid, uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.git_apps_status(), public.git_app_ler(text), public.git_conexao_gravar(uuid, uuid, text, text, text, text, text, text, jsonb),
  public.git_conexao_ler(uuid), public.git_tokens_gravar(uuid, text, text, timestamptz), public.git_conexao_erro(uuid, text),
  public.git_repo_segredo(uuid), public.git_repo_gancho(uuid, text),
  public.git_receber_github(text, text, text), public.git_receber_gitlab(uuid, text, text, text) to service_role;
