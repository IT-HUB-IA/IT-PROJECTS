-- =====================================================================
-- Sistema IT.IA · 04 · Service Desk, agentes, anexos e auditoria
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
  agente_id    uuid,
  texto        text,
  transcricao  text,   -- quando a mensagem é um áudio
  criado_em    timestamptz not null default now(),
  check (num_nonnulls(texto, transcricao) >= 1 or autor_tipo = 'cliente'),
  check ((autor_tipo = 'ia') = (agente_id is not null))
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

-- AGENTES (Agent Studio)
create table public.agentes (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique check (codigo ~ '^[a-z0-9_]{2,40}$'),
  nome             text not null,
  papel            text,
  instrucoes       text not null default '',
  regras_passagem  text,          -- Handoff rules
  modelo_ia        text,          -- qual modelo de IA ele usa, quando houver provedor ligado
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now()
);

alter table public.pedidos_mensagens
  add constraint pedidos_mensagens_agente_fk foreign key (agente_id) references public.agentes(id) on delete set null;

create table public.agentes_fontes (
  id         uuid primary key default gen_random_uuid(),
  agente_id  uuid not null references public.agentes(id) on delete cascade,
  nome       text not null,
  tipo       text not null default 'documento' check (tipo in ('documento','banco','ficha','historico','canvas','link')),
  ref        text,
  unique (agente_id, nome)
);

create table public.agentes_ferramentas (
  agente_id   uuid not null references public.agentes(id) on delete cascade,
  ferramenta  text not null,
  permissao   text not null check (permissao in ('livre','automatica','confirmacao','bloqueada')),
  primary key (agente_id, ferramenta)
);

create table public.agentes_execucoes (
  id          bigint generated always as identity primary key,
  agente_id   uuid not null references public.agentes(id) on delete cascade,
  pedido_id   uuid references public.pedidos(id) on delete set null,
  item_id     uuid references public.itens(id) on delete set null,
  ferramenta  text,
  entrada     text,
  saida       text,
  resultado   text not null check (resultado in ('ok','erro','aguardando_aprovacao','recusado')),
  tokens      integer check (tokens is null or tokens >= 0),
  custo_usd   numeric(10,4),
  em          timestamptz not null default now()
);
create index agentes_execucoes_idx on public.agentes_execucoes (agente_id, em desc);
create index agentes_execucoes_pedido_idx on public.agentes_execucoes (pedido_id) where pedido_id is not null;
create index agentes_execucoes_item_idx on public.agentes_execucoes (item_id) where item_id is not null;

create table public.agentes_avaliacoes (
  id                 uuid primary key default gen_random_uuid(),
  agente_id          uuid not null references public.agentes(id) on delete cascade,
  pergunta           text not null,
  resposta_esperada  text not null,
  ultima_resposta    text,
  nota               numeric(4,1) check (nota is null or nota between 0 and 10),
  avaliado_em        timestamptz
);
create index agentes_avaliacoes_agente_idx on public.agentes_avaliacoes (agente_id);

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
                           'pessoas_custos','servicos','automacoes','marcos','sprints','decisoes','agentes'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function auditoria.registrar()',
                   t || '_auditoria', t);
  end loop;
end $$;
