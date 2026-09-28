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
