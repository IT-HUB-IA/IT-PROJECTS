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
