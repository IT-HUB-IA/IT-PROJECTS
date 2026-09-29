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
