-- Parte 38: item completo pelo método do Product Owner (P.O.). 01/10/2026.
-- O item ganha história (quem, o quê, por quê), critérios de aceite com caixa de marcar, desenho (computador e celular),
-- prioridade MoSCoW + nível de 1 a 5, valor de negócio, tipo (Item, Bug, Melhoria) com o item de origem, e o ciclo de vida
-- com histórico (quem e quando). O épico ganha a meta, a versão ganha a meta e o projeto ganha o P.O. e a Definição de Pronto.
-- Tudo é acrescentado: nenhuma coluna antiga muda de sentido e o que já existe continua funcionando igual.
--
-- Regras que o banco garante (a tela também confere antes, para avisar com calma):
--   1. Item (história, tarefa, bug) não vai para "Aceito" (grupo done) com critério de aceite desmarcado.
--   2. Quando o projeto tem P.O., só ele aceita (leva para done) ou devolve (marca "Voltou") um item.
--      Quem não é pessoa (publicação, PR mesclado, rotina) não aceita: o item para em "Pronto para testar" (review).
--   3. Item aceito não muda a história nem os critérios: mudança depois de pronto é sempre item novo (Melhoria).
--   4. A mudança de situação e de critério fica em itens_historico, gravada pelo próprio banco (quem e quando). Só leitura.
--   5. nível <-> prioridade antiga andam juntos: 1 highest, 2 high, 3 medium, 4 e 5 low.

-- ---------- itens ----------
alter table public.itens
  add column if not exists historia_quem  text check (historia_quem  is null or length(historia_quem)  <= 300),
  add column if not exists historia_quero text check (historia_quero is null or length(historia_quero) <= 500),
  add column if not exists historia_para  text check (historia_para  is null or length(historia_para)  <= 500),
  add column if not exists moscow         text check (moscow is null or moscow in ('deve','deveria','poderia','nao_tera')),
  add column if not exists nivel          smallint check (nivel is null or nivel between 1 and 5),
  add column if not exists valor          smallint check (valor is null or valor between 1 and 10),
  add column if not exists valor_motivo   text check (valor_motivo is null or length(valor_motivo) <= 300),
  add column if not exists melhoria       boolean not null default false,
  add column if not exists origem_id      uuid references public.itens(id) on delete set null,
  add column if not exists voltou_em      timestamptz,
  add column if not exists voltou_motivo  text check (voltou_motivo is null or length(voltou_motivo) <= 1000),
  add column if not exists meta           text check (meta is null or length(meta) <= 1000);
comment on column public.itens.historia_quem is 'História: Como [quem]';
comment on column public.itens.historia_quero is 'História: quero [o quê]';
comment on column public.itens.historia_para is 'História: para [por quê]';
comment on column public.itens.moscow is 'Classe MoSCoW: deve, deveria, poderia, nao_tera (não terá agora)';
comment on column public.itens.nivel is 'Nível de prioridade: 1 só emergência, 2 o mais urgente do dia a dia, 5 ideia ainda sem detalhe. Anda junto com prioridade';
comment on column public.itens.valor is 'Valor de negócio de 1 a 10, usado para ordenar o backlog (no empate, sobe quem tem mais valor por ponto)';
comment on column public.itens.valor_motivo is 'Por que o item importa (curto)';
comment on column public.itens.melhoria is 'Tipo Melhoria: mudança pedida depois de pronto. É sempre item novo, ligado ao antigo por origem_id';
comment on column public.itens.origem_id is 'Bug: o item cujo critério de aceite não foi cumprido. Melhoria: o item que deu origem';
comment on column public.itens.voltou_em is 'Quando o P.O. devolveu o item (situação Voltou). Limpa quando volta para Pronto para testar ou é aceito';
comment on column public.itens.meta is 'Épico: a meta ou o valor da entrega';
create index if not exists itens_origem_idx on public.itens (origem_id) where origem_id is not null;

-- estimativa em pontos: 1, 2, 3, 5, 8, 13, 20 (o 21 antigo continua aceito para não perder o que já existe)
alter table public.itens drop constraint if exists itens_pontos_check;
alter table public.itens add constraint itens_pontos_check check (pontos is null or pontos in (1,2,3,5,8,13,20,21));

-- nível a partir da prioridade antiga, nos itens que já existem
update public.itens set nivel = case prioridade when 'highest' then 1 when 'high' then 2 when 'medium' then 3 else 4 end where nivel is null;

-- ---------- critérios de aceite ----------
create table if not exists public.itens_criterios (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.itens(id) on delete cascade,
  texto       text not null check (length(btrim(texto)) between 1 and 500),
  feito       boolean not null default false,
  ordem       smallint not null default 0,
  marcado_por uuid references public.pessoas(id) on delete set null,
  marcado_em  timestamptz,
  criado_em   timestamptz not null default now()
);
comment on table public.itens_criterios is 'Critérios de aceite do item: lista com caixa de marcar, ordem editável. Quem marcou e quando são gravados pelo banco';
create index if not exists itens_criterios_item_idx on public.itens_criterios (item_id, ordem);

-- ---------- histórico (só leitura para a tela) ----------
create table if not exists public.itens_historico (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.itens(id) on delete cascade,
  tipo      text not null check (tipo in ('situacao','criterio')),
  de        text,
  para      text,
  texto     text,
  pessoa_id uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);
comment on table public.itens_historico is 'Mudanças de situação (de/para: backlog, todo, doing, review, blocked, done ou voltou) e de critério de aceite. Gravado pelos gatilhos; nada é apagado pela tela';
create index if not exists itens_historico_item_idx on public.itens_historico (item_id, criado_em);

-- ---------- épico, versão e projeto ----------
alter table public.marcos add column if not exists meta text check (meta is null or length(meta) <= 1000);
comment on column public.marcos.meta is 'Versão: a meta da entrega';
alter table public.projetos
  add column if not exists definicao_pronto text check (definicao_pronto is null or length(definicao_pronto) <= 3000),
  add column if not exists po_id uuid references public.pessoas(id) on delete set null;
comment on column public.projetos.definicao_pronto is 'Definição de Pronto do projeto: lembrete mostrado em todo item';
comment on column public.projetos.po_id is 'Product Owner do projeto: só ele aceita ou devolve itens. Vazio: qualquer um do time aceita, como antes';

-- ---------- desenho: anexo de imagem com o papel de computador ou celular ----------
alter table public.anexos add column if not exists papel text check (papel is null or papel in ('desenho_computador','desenho_celular'));
comment on column public.anexos.papel is 'Desenho do item: versão de computador ou de celular';

-- ---------- funções de apoio ----------
create or replace function interno.po_projeto_do_no(p_no uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  with recursive c as (
    select n.id, n.pai_id, n.tipo, 0 as k from public.nos n where n.id = p_no
    union all
    select n.id, n.pai_id, n.tipo, c.k + 1 from public.nos n join c on n.id = c.pai_id where c.k < 12
  ) select id from c where tipo = 'projeto' limit 1
$$;
-- o P.O. que vale para a frente (só se a pessoa ainda estiver ativa)
create or replace function interno.po_da_frente(p_frente uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.po_id from public.projetos p join public.pessoas pe on pe.id = p.po_id and pe.ativo
   where p.no_id = interno.po_projeto_do_no(p_frente)
$$;
create or replace function interno.po_grupo(p_status uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select grupo from public.status_fluxo where id = p_status
$$;
create or replace function interno.po_nome(p uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select nome from public.pessoas where id = p
$$;

-- ---------- regras do item ----------
create or replace function interno.po_regras_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare g_novo text; g_velho text; po uuid; quem uuid; revisao uuid;
begin
  -- nível e prioridade antiga andam juntos
  if tg_op = 'INSERT' then
    if new.nivel is null then new.nivel := case new.prioridade when 'highest' then 1 when 'high' then 2 when 'medium' then 3 else 4 end;
    else new.prioridade := case new.nivel when 1 then 'highest' when 2 then 'high' when 3 then 'medium' else 'low' end; end if;
    return new;
  end if;
  if new.nivel is distinct from old.nivel and new.nivel is not null then
    new.prioridade := case new.nivel when 1 then 'highest' when 2 then 'high' when 3 then 'medium' else 'low' end;
  elsif new.prioridade is distinct from old.prioridade and not (new.prioridade = 'low' and new.nivel = 5) then
    new.nivel := case new.prioridade when 'highest' then 1 when 'high' then 2 when 'medium' then 3 else 4 end;
  end if;

  g_velho := interno.po_grupo(old.status_id);
  quem := interno.pessoa_atual();
  -- item aceito não muda a história: mudança depois de pronto vira Melhoria
  if g_velho = 'done' and interno.po_grupo(new.status_id) = 'done'
     and (new.historia_quem is distinct from old.historia_quem or new.historia_quero is distinct from old.historia_quero or new.historia_para is distinct from old.historia_para) then
    raise exception 'Item aceito não muda a história. Para mudar depois de pronto, crie uma Melhoria (item novo).' using errcode = '23514';
  end if;

  if new.tipo in ('epic','subtask') then return new; end if;
  po := interno.po_da_frente(new.frente_id);

  -- devolver (Voltou): só o P.O.
  if new.voltou_em is not null and old.voltou_em is null and po is not null and quem is not null and quem <> po then
    raise exception 'Só o P.O. do projeto (%) devolve um item.', interno.po_nome(po) using errcode = '42501';
  end if;

  if new.status_id is distinct from old.status_id then
    g_novo := interno.po_grupo(new.status_id);
    if g_novo = 'done' and coalesce(g_velho, '') <> 'done' then
      if quem is null then
        -- publicação, PR mesclado ou rotina: não aceita sozinho quando há P.O. ou critério pendente; para em Pronto para testar
        if po is not null or exists (select 1 from public.itens_criterios c where c.item_id = new.id and not c.feito) then
          select id into revisao from public.status_fluxo where no_id is null and chave = 'review';
          if revisao is not null then new.status_id := revisao; g_novo := 'review'; end if;
        end if;
      else
        if exists (select 1 from public.itens_criterios c where c.item_id = new.id and not c.feito) then
          raise exception 'Este item ainda tem critério de aceite desmarcado. Marque todos antes de aceitar.' using errcode = '23514';
        end if;
        if po is not null and quem <> po then
          raise exception 'Só o P.O. do projeto (%) aceita um item.', interno.po_nome(po) using errcode = '42501';
        end if;
      end if;
    end if;
    -- voltou para teste ou foi aceito: deixa de estar "Voltou"
    if g_novo in ('review','done') then new.voltou_em := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists itens_po_regras on public.itens;
create trigger itens_po_regras before insert or update on public.itens for each row execute function interno.po_regras_item();

-- ---------- histórico da situação ----------
create or replace function interno.po_historico_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare g_novo text := interno.po_grupo(new.status_id); g_velho text;
begin
  if tg_op = 'INSERT' then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'situacao', null, g_novo, 'Criado', interno.pessoa_atual());
    return null;
  end if;
  g_velho := interno.po_grupo(old.status_id);
  if new.voltou_em is not null and old.voltou_em is null then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'situacao', g_velho, 'voltou', new.voltou_motivo, interno.pessoa_atual());
  elsif g_novo is distinct from g_velho or (new.status_id is distinct from old.status_id) then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id)
      values (new.id, 'situacao', case when old.voltou_em is not null then 'voltou' else g_velho end, g_novo,
              (select nome from public.status_fluxo where id = new.status_id and no_id is not null), interno.pessoa_atual());
  end if;
  return null;
end $$;
drop trigger if exists itens_po_historico on public.itens;
create trigger itens_po_historico after insert or update of status_id, voltou_em on public.itens for each row execute function interno.po_historico_item();

-- ---------- critérios: quem marcou, trava no item aceito e histórico ----------
create or replace function interno.po_regras_criterio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare st uuid; alvo uuid := case when tg_op = 'DELETE' then old.item_id else new.item_id end;
begin
  select status_id into st from public.itens where id = alvo;
  -- item apagado de vez (cascata): não confere nada
  if st is null then return case when tg_op = 'DELETE' then old else new end; end if;
  if interno.po_grupo(st) = 'done' and (tg_op <> 'UPDATE' or new.texto is distinct from old.texto or new.feito is distinct from old.feito) then
    raise exception 'Item aceito não muda os critérios de aceite. Para mudar depois de pronto, crie uma Melhoria (item novo).' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if (tg_op = 'INSERT' and new.feito) or (tg_op = 'UPDATE' and new.feito is distinct from old.feito) then
    new.marcado_por := interno.pessoa_atual(); new.marcado_em := now();
  elsif tg_op = 'UPDATE' then
    new.marcado_por := old.marcado_por; new.marcado_em := old.marcado_em;   -- a tela não muda quem marcou
  end if;
  return new;
end $$;
drop trigger if exists itens_criterios_regras on public.itens_criterios;
create trigger itens_criterios_regras before insert or update or delete on public.itens_criterios for each row execute function interno.po_regras_criterio();

create or replace function interno.po_historico_criterio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.itens where id = old.item_id) then
      insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (old.item_id, 'criterio', old.texto, null, 'tirou', interno.pessoa_atual());
    end if;
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', null, new.texto, case when new.feito then 'criou marcado' else 'criou' end, interno.pessoa_atual());
  elsif new.feito is distinct from old.feito then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', null, new.texto, case when new.feito then 'marcou' else 'desmarcou' end, interno.pessoa_atual());
  elsif new.texto is distinct from old.texto then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', old.texto, new.texto, 'mudou o texto', interno.pessoa_atual());
  end if;
  return null;
end $$;
drop trigger if exists itens_criterios_historico on public.itens_criterios;
create trigger itens_criterios_historico after insert or update or delete on public.itens_criterios for each row execute function interno.po_historico_criterio();

-- ---------- P.O. do projeto: quando já tem um, só ele passa o papel ----------
create or replace function interno.po_regras_projeto() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare quem uuid := interno.pessoa_atual();
begin
  if new.po_id is distinct from old.po_id and old.po_id is not null and quem is not null and quem <> old.po_id
     and exists (select 1 from public.pessoas where id = old.po_id and ativo) then
    raise exception 'Só o P.O. atual (%) passa o papel de P.O. para outra pessoa.', interno.po_nome(old.po_id) using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists projetos_po_regras on public.projetos;
create trigger projetos_po_regras before update of po_id on public.projetos for each row execute function interno.po_regras_projeto();

-- ---------- acesso ----------
alter table public.itens_criterios enable row level security;
alter table public.itens_historico enable row level security;
drop policy if exists ver on public.itens_criterios;
create policy ver on public.itens_criterios for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
drop policy if exists time_muda on public.itens_criterios;
create policy time_muda on public.itens_criterios for all to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));
drop policy if exists ver on public.itens_historico;
create policy ver on public.itens_historico for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
revoke all on public.itens_criterios, public.itens_historico from anon;
grant select, insert, update, delete on public.itens_criterios to authenticated;
grant select on public.itens_historico to authenticated;
revoke insert, update, delete on public.itens_historico from authenticated;
grant all on public.itens_criterios, public.itens_historico to service_role;
revoke all on function interno.po_projeto_do_no(uuid), interno.po_da_frente(uuid), interno.po_grupo(uuid), interno.po_nome(uuid),
  interno.po_regras_item(), interno.po_historico_item(), interno.po_regras_criterio(), interno.po_historico_criterio(), interno.po_regras_projeto() from public, anon;
-- o histórico e os critérios não podem ser esvaziados por quem está logado (TRUNCATE passa por cima da RLS; o Supabase dá por padrão)
revoke truncate, references, trigger on public.itens_criterios, public.itens_historico from authenticated;
