-- =====================================================================
-- Sistema IT.IA · 02 · Trabalho: status, itens (issues), ciclos, marcos, tempo, visões, automações
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
