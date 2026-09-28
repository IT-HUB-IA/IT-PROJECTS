-- =====================================================================
-- Sistema IT.IA · 14 · Board no formato Jira e Trello, equipes e integrações (pedido do William em 28/09/2026)
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
