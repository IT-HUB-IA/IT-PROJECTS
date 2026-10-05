set client_min_messages = warning;
-- =====================================================================
-- Parte 69 · Mapa do Sistema ("Como está" na Infraestrutura)
-- O CicloDev monta, sozinho e sem login no sistema do cliente, o inventário da interface de cada aplicação ligada:
-- aplicações, módulos do menu, telas, abas, janelas flutuantes, botões e campos, para onde cada coisa leva,
-- quando aparece e quem vê. Quem monta é o trabalhador (worker/mapa): ele constrói uma cópia do sistema numa
-- caixa fechada, responde às chamadas com dados de exemplo no formato do banco real e percorre a cópia.
--   * mapa_analises  um pedido por repositório (fila → rodando → pronto/erro). A cada publicação entra um pedido.
--   * mapa_pecas     as peças achadas (chave estável, pai, tipo, o que faz, quando aparece, quem vê, arquivo e linha).
--   * mapa_ligacoes  leva para, abre, chama, grava em, lê de, outra aplicação, mesmo dado.
--   * mapa_alertas   dados sem lugar no banco: coluna ou tabela que não existe, campo sem destino, só no navegador,
--                    caminho que não dá para seguir, coluna que nenhuma tela usa. Só com o banco da aplicação ligado.
--   * mapa_proposito "é de propósito", com motivo, quem e quando. Vale enquanto a impressão (o trecho) não mudar.
-- Pela API só se LÊ (regra de acesso: o ponto visível). Escrever: só pelas funções.
-- O trabalhador nunca fala com o banco: fala com a Edge Function mapa-trabalho, que confere o segredo dele
-- (Vault, nome ciclodev_mapa_segredo) e chama as funções de serviço daqui (service_role).
-- Volta: 69_mapa_sistema_VOLTA.sql.
-- =====================================================================

/* ---------- tabelas ---------- */
create table if not exists public.mapa_analises (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,          -- onde o repositório está ligado
  repositorio_id uuid references public.repositorios(id) on delete cascade,
  status         text not null default 'fila' check (status in ('fila','rodando','pronto','erro')),
  origem         text not null default 'manual' check (origem in ('publicacao','manual')),
  referencia     text check (length(referencia) <= 200),
  pedido_por     uuid references public.pessoas(id) on delete set null,
  criado_em      timestamptz not null default now(),
  iniciado_em    timestamptz,
  concluido_em   timestamptz,
  tentativas     smallint not null default 0,
  erro           text check (length(erro) <= 2000),
  tecnologia     text check (length(tecnologia) <= 200),
  com_banco      boolean not null default false,                                    -- havia banco ligado para comparar
  resumo         jsonb not null default '{}'::jsonb check (pg_column_size(resumo) <= 100000),
  lacunas        jsonb not null default '[]'::jsonb check (pg_column_size(lacunas) <= 200000),
  papeis         jsonb not null default '[]'::jsonb check (pg_column_size(papeis) <= 20000)
);
create index if not exists mapa_analises_no_idx on public.mapa_analises (no_id, status);
create index if not exists mapa_analises_repo_idx on public.mapa_analises (repositorio_id, criado_em desc);
create unique index if not exists mapa_analises_uma_na_fila on public.mapa_analises (repositorio_id) where status = 'fila';
comment on table public.mapa_analises is 'Mapa do Sistema: um pedido de análise por repositório. O trabalhador constrói uma cópia do sistema numa caixa fechada (sem login, sem tocar no sistema real) e percorre.';

create table if not exists public.mapa_pecas (
  analise_id uuid not null references public.mapa_analises(id) on delete cascade,
  chave      text not null check (length(chave) between 1 and 300),
  pai        text check (length(pai) <= 300),
  tipo       text not null check (tipo in ('aplicacao','modulo','tela','aba','janela','botao','campo','link','comentario')),
  nome       text not null check (length(nome) <= 300),
  descricao  text check (length(descricao) <= 2000),
  quando     text check (length(quando) <= 500),
  destino    text check (length(destino) <= 300),
  papeis     text[] not null default '{}',
  arquivo    text check (length(arquivo) <= 500),
  linha      integer,
  certeza    text not null default 'rodando' check (certeza in ('rodando','codigo','confirmado')),
  dados      jsonb not null default '{}'::jsonb check (pg_column_size(dados) <= 20000),
  ordem      integer not null default 0,
  primary key (analise_id, chave)
);
create table if not exists public.mapa_ligacoes (
  analise_id uuid not null references public.mapa_analises(id) on delete cascade,
  de         text not null check (length(de) <= 300),
  para       text not null check (length(para) <= 300),
  tipo       text not null check (tipo in ('leva_para','abre','chama','grava_em','le_de','outra_aplicacao','mesmo_dado')),
  detalhe    text check (length(detalhe) <= 500),
  primary key (analise_id, de, para, tipo)
);
create table if not exists public.mapa_alertas (
  id         bigint generated always as identity primary key,
  analise_id uuid not null references public.mapa_analises(id) on delete cascade,
  peca       text check (length(peca) <= 300),
  modulo     text check (length(modulo) <= 300),
  tipo       text not null check (tipo in ('coluna_inexistente','tabela_inexistente','campo_sem_destino','so_navegador','caminho_sem_fim','coluna_sem_tela')),
  gravidade  text not null check (gravidade in ('erro','atencao','info')),
  texto      text not null check (length(texto) <= 1000),
  tabela     text check (length(tabela) <= 200),
  coluna     text check (length(coluna) <= 200),
  prova      jsonb not null default '{}'::jsonb check (pg_column_size(prova) <= 20000),
  impressao  text not null check (length(impressao) between 8 and 128)
);
create index if not exists mapa_alertas_analise_idx on public.mapa_alertas (analise_id);
create table if not exists public.mapa_proposito (
  no_id     uuid not null references public.nos(id) on delete cascade,
  impressao text not null check (length(impressao) between 8 and 128),
  motivo    text not null check (length(btrim(motivo)) between 3 and 500),
  por       uuid references public.pessoas(id) on delete set null,
  em        timestamptz not null default now(),
  primary key (no_id, impressao)
);
comment on table public.mapa_proposito is 'Alertas do Mapa do Sistema marcados como "é de propósito", com o motivo. Vale enquanto a impressão (o trecho de código) não mudar.';

alter table public.mapa_analises enable row level security;
alter table public.mapa_pecas enable row level security;
alter table public.mapa_ligacoes enable row level security;
alter table public.mapa_alertas enable row level security;
alter table public.mapa_proposito enable row level security;
revoke all on public.mapa_analises, public.mapa_pecas, public.mapa_ligacoes, public.mapa_alertas, public.mapa_proposito from public, anon, authenticated, service_role;
grant select on public.mapa_analises, public.mapa_pecas, public.mapa_ligacoes, public.mapa_alertas, public.mapa_proposito to authenticated;
revoke all on sequence public.mapa_alertas_id_seq from public, anon, authenticated;

drop policy if exists ver on public.mapa_analises;
drop policy if exists ver on public.mapa_pecas;
drop policy if exists ver on public.mapa_ligacoes;
drop policy if exists ver on public.mapa_alertas;
drop policy if exists ver on public.mapa_proposito;
create policy ver on public.mapa_analises for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.mapa_pecas for select to authenticated using (analise_id in (select a.id from public.mapa_analises a where a.no_id in (select interno.nos_visiveis())));
create policy ver on public.mapa_ligacoes for select to authenticated using (analise_id in (select a.id from public.mapa_analises a where a.no_id in (select interno.nos_visiveis())));
create policy ver on public.mapa_alertas for select to authenticated using (analise_id in (select a.id from public.mapa_analises a where a.no_id in (select interno.nos_visiveis())));
create policy ver on public.mapa_proposito for select to authenticated using (no_id in (select interno.nos_visiveis()));

/* ---------- a cada publicação de um repositório, entra um pedido ---------- */
create or replace function interno.mapa_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if new.repositorio_id is null or new.origem not in ('github','gitlab') then return null; end if;
  select id, no_id into r from public.repositorios where id = new.repositorio_id and ativo;
  if not found then return null; end if;
  insert into public.mapa_analises (no_id, repositorio_id, origem, referencia) values (r.no_id, r.id, 'publicacao', new.referencia)
    on conflict (repositorio_id) where status = 'fila' do update set referencia = excluded.referencia, criado_em = now();
  return null;
end $$;
revoke all on function interno.mapa_publicou() from public, anon, authenticated, service_role;
drop trigger if exists mapa_publicou on public.infra_automacoes;
create trigger mapa_publicou after insert on public.infra_automacoes for each row execute function interno.mapa_publicou();

-- os repositórios que valem para um ponto: ligados nele, acima dele (produto/projeto) ou abaixo dele (as aplicações)
create or replace function interno.mapa_repos_de(p_no uuid) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id from public.repositorios r
   where r.ativo and r.conexao_id is not null
     and (r.no_id = p_no
          or r.no_id in (select a.ancestral_id from public.nos_ancestrais a where a.no_id = p_no)
          or r.no_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no))
$$;
revoke all on function interno.mapa_repos_de(uuid) from public, anon, authenticated, service_role;

-- as colunas que as outras aplicações do mesmo espaço leem ou gravam (pela última análise pronta delas), "tabela.coluna":
-- uma coluna que esta aplicação não usa mas outra usa não é "coluna sem tela"
create or replace function interno.mapa_usadas_por_outras(p_analise uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(distinct substr(l.para, 8) || '.' || btrim(c)), '[]')
    from public.mapa_analises a
    join public.nos n on n.id = a.no_id
    join public.mapa_analises o on o.status = 'pronto' and o.repositorio_id is distinct from a.repositorio_id
    join public.nos m on m.id = o.no_id and m.espaco_id = n.espaco_id
    join public.mapa_ligacoes l on l.analise_id = o.id and l.tipo in ('grava_em', 'le_de') and l.para like 'tabela:%'
    cross join lateral unnest(string_to_array(coalesce(l.detalhe, ''), ',')) c
   where a.id = p_analise and btrim(c) <> ''
$$;
revoke all on function interno.mapa_usadas_por_outras(uuid) from public, anon, authenticated, service_role;

/* ---------- o que a pessoa faz (corpo em logica, porta fina no public) ---------- */
-- "Analisar agora": um pedido por repositório que vale para o ponto (sem repetir o que já está na fila)
create or replace function logica.mapa_pedir(p_no uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; r record;
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  for r in select id, no_id from public.repositorios where id in (select interno.mapa_repos_de(p_no)) loop
    insert into public.mapa_analises (no_id, repositorio_id, origem, pedido_por) values (r.no_id, r.id, 'manual', interno.pessoa_atual())
      on conflict (repositorio_id) where status = 'fila' do nothing;
    if found then n := n + 1; end if;
  end loop;
  if n = 0 and not exists (select 1 from public.mapa_analises a where a.repositorio_id in (select interno.mapa_repos_de(p_no)) and a.status in ('fila','rodando')) then
    raise exception 'Nenhum repositório ligado a este ponto. Ligue o código em Ligações.' using errcode = '22023';
  end if;
  return n;
end $$;

-- "É de propósito": só quem edita o ponto; o alerta tem de existir numa análise que vale para o ponto
create or replace function logica.mapa_proposito_marcar(p_no uuid, p_impressao text, p_motivo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escreva o motivo (pelo menos 3 letras)' using errcode = '22023'; end if;
  if not exists (select 1 from public.mapa_alertas l join public.mapa_analises a on a.id = l.analise_id
                  where l.impressao = p_impressao and a.no_id = p_no) then
    raise exception 'Alerta não encontrado neste ponto' using errcode = '22023'; end if;
  insert into public.mapa_proposito (no_id, impressao, motivo, por) values (p_no, p_impressao, left(btrim(p_motivo), 500), interno.pessoa_atual())
    on conflict (no_id, impressao) do update set motivo = excluded.motivo, por = excluded.por, em = now();
end $$;
create or replace function logica.mapa_proposito_tirar(p_no uuid, p_impressao text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- "apaga se puder, senão explica" (o formato "confere, depois apaga" travava a ferramenta de aplicar; o efeito é o mesmo)
  delete from public.mapa_proposito where no_id = p_no and impressao = p_impressao and p_no in (select interno.nos_editaveis());
  if not found and (p_no is null or p_no not in (select interno.nos_editaveis())) then
    raise exception 'Você não pode mudar este ponto' using errcode = '42501';
  end if;
end $$;

/* ---------- o que só a Edge Function mapa-trabalho chama (service_role) ---------- */
create or replace function logica.mapa_confere(p_segredo text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s text;
begin
  select decrypted_secret into s from vault.decrypted_secrets where name = 'ciclodev_mapa_segredo';
  return s is not null and length(coalesce(p_segredo, '')) >= 32 and p_segredo = s;
end $$;

-- pega o próximo pedido (o que parou no meio por mais de 30 minutos volta, até 3 vezes)
create or replace function logica.mapa_proximo() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.mapa_analises; repo jsonb; bancos jsonb;
begin
  update public.mapa_analises set status = 'erro', concluido_em = now(), erro = 'Parou no meio três vezes'
   where status = 'rodando' and iniciado_em < now() - interval '30 minutes' and tentativas >= 3;
  select * into a from public.mapa_analises
   where status = 'fila' or (status = 'rodando' and iniciado_em < now() - interval '30 minutes')
   order by criado_em limit 1 for update skip locked;
  if not found then return null; end if;
  update public.mapa_analises set status = 'rodando', iniciado_em = now(), tentativas = tentativas + 1, erro = null where id = a.id;
  select jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor, 'conexao_id', r.conexao_id, 'externo_id', r.externo_id)
    into repo from public.repositorios r where r.id = a.repositorio_id;
  -- os bancos que valem para onde o repositório está ligado (no ponto, acima ou abaixo dele)
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas,
           'conexao', interno.segredo_de('interno.infra_bancos_conexao', c.banco_id::text, 'conexao'),
           'supa_conexao_id', b.supa_conexao_id, 'supa_projeto', b.supa_projeto) order by b.nome), '[]')
    into bancos
    from public.infra_bancos b left join interno.infra_bancos_conexao c on c.banco_id = b.id
   where b.ativo and (c.banco_id is not null or b.supa_conexao_id is not null)
     and (b.no_id = a.no_id
          or b.no_id in (select x.ancestral_id from public.nos_ancestrais x where x.no_id = a.no_id)
          or b.no_id in (select x.no_id from public.nos_ancestrais x where x.ancestral_id = a.no_id));
  return jsonb_build_object('id', a.id, 'no_id', a.no_id, 'referencia', a.referencia, 'repositorio', repo, 'bancos', bancos,
    'no_nome', (select nome from public.nos where id = a.no_id), 'usadas_por_outras', interno.mapa_usadas_por_outras(a.id));
end $$;

-- apagar o conteúdo de uma análise e as análises antigas do mesmo repositório (em SQL simples: o formato com
-- "delete ... where x = y" dentro de plpgsql travava a ferramenta de aplicar no Supabase; o efeito é o mesmo)
create or replace function interno.mapa_limpar(p_analise uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  with a as (delete from public.mapa_pecas p where p.analise_id = p_analise returning 1),
       b as (delete from public.mapa_ligacoes l where l.analise_id = p_analise returning 1)
  delete from public.mapa_alertas x where x.analise_id = p_analise
$$;
revoke all on function interno.mapa_limpar(uuid) from public, anon, authenticated, service_role;
create or replace function interno.mapa_apagar_antigas(p_analise uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.mapa_analises v using public.mapa_analises n
   where n.id = p_analise and v.repositorio_id = n.repositorio_id and v.id <> n.id and v.status in ('pronto','erro')
$$;
revoke all on function interno.mapa_apagar_antigas(uuid) from public, anon, authenticated, service_role;

-- grava o resultado: troca o conteúdo da análise e apaga as análises antigas do mesmo repositório
create or replace function logica.mapa_gravar(p_analise uuid, p_resultado jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.mapa_analises; np int; nl int; na int;
begin
  select * into a from public.mapa_analises where id = p_analise for update;
  if not found then raise exception 'Análise não encontrada' using errcode = '22023'; end if;
  if a.status <> 'rodando' then raise exception 'Esta análise não está rodando (%)', a.status using errcode = '22023'; end if;
  if jsonb_typeof(p_resultado) <> 'object' then raise exception 'Resultado inválido' using errcode = '22023'; end if;
  np := jsonb_array_length(coalesce(p_resultado->'pecas', '[]')); nl := jsonb_array_length(coalesce(p_resultado->'ligacoes', '[]')); na := jsonb_array_length(coalesce(p_resultado->'alertas', '[]'));
  if np > 20000 or nl > 40000 or na > 5000 then raise exception 'Resultado grande demais (% peças, % ligações, % alertas)', np, nl, na using errcode = '54000'; end if;
  perform interno.mapa_limpar(a.id);
  insert into public.mapa_pecas (analise_id, chave, pai, tipo, nome, descricao, quando, destino, papeis, arquivo, linha, certeza, dados, ordem)
  select a.id, left(x->>'chave', 300), left(x->>'pai', 300), x->>'tipo', left(coalesce(x->>'nome', ''), 300), left(x->>'descricao', 2000), left(x->>'quando', 500),
         left(x->>'destino', 300), coalesce((select array_agg(left(v, 100)) from jsonb_array_elements_text(coalesce(x->'papeis', '[]')) v), '{}'),
         left(x->>'arquivo', 500), nullif(x->>'linha', '')::int, coalesce(x->>'certeza', 'rodando'), coalesce(x->'dados', '{}'), coalesce(nullif(x->>'ordem', '')::int, n::int)
    from jsonb_array_elements(coalesce(p_resultado->'pecas', '[]')) with ordinality as e(x, n)
  on conflict (analise_id, chave) do nothing;
  insert into public.mapa_ligacoes (analise_id, de, para, tipo, detalhe)
  select a.id, left(x->>'de', 300), left(x->>'para', 300), x->>'tipo', left(x->>'detalhe', 500)
    from jsonb_array_elements(coalesce(p_resultado->'ligacoes', '[]')) x
   where x->>'de' is not null and x->>'para' is not null
  on conflict do nothing;
  insert into public.mapa_alertas (analise_id, peca, modulo, tipo, gravidade, texto, tabela, coluna, prova, impressao)
  select a.id, left(x->>'peca', 300), left(x->>'modulo', 300), x->>'tipo', x->>'gravidade', left(x->>'texto', 1000), left(x->>'tabela', 200), left(x->>'coluna', 200),
         coalesce(x->'prova', '{}'), left(x->>'impressao', 128)
    from jsonb_array_elements(coalesce(p_resultado->'alertas', '[]')) x;
  update public.mapa_analises set status = 'pronto', concluido_em = now(), erro = null,
         tecnologia = left(p_resultado->>'tecnologia', 200), com_banco = coalesce((p_resultado->>'com_banco')::boolean, false),
         resumo = coalesce(p_resultado->'resumo', '{}'), lacunas = coalesce(p_resultado->'lacunas', '[]'), papeis = coalesce(p_resultado->'papeis', '[]')
   where id = a.id;
  perform interno.mapa_apagar_antigas(a.id);
  return jsonb_build_object('pecas', np, 'ligacoes', nl, 'alertas', na);
end $$;

-- o repositório de uma análise que está rodando (para a função baixar o código dela; nada de chave aqui)
create or replace function logica.mapa_repo_da_analise(p_analise uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor, 'conexao_id', r.conexao_id, 'externo_id', r.externo_id, 'referencia', a.referencia)
    from public.mapa_analises a join public.repositorios r on r.id = a.repositorio_id
   where a.id = p_analise and a.status = 'rodando'
$$;

create or replace function logica.mapa_falhou(p_analise uuid, p_erro text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.mapa_analises set status = 'erro', concluido_em = now(), erro = left(coalesce(p_erro, 'erro sem detalhe'), 2000)
   where id = p_analise and status = 'rodando';
end $$;

/* ---------- permissões e portas da API ---------- */
revoke all on function logica.mapa_pedir(uuid), logica.mapa_proposito_marcar(uuid, text, text), logica.mapa_proposito_tirar(uuid, text),
  logica.mapa_confere(text), logica.mapa_proximo(), logica.mapa_gravar(uuid, jsonb), logica.mapa_falhou(uuid, text), logica.mapa_repo_da_analise(uuid) from public, anon, authenticated, service_role;
grant execute on function logica.mapa_pedir(uuid), logica.mapa_proposito_marcar(uuid, text, text), logica.mapa_proposito_tirar(uuid, text) to authenticated;
grant execute on function logica.mapa_confere(text), logica.mapa_proximo(), logica.mapa_gravar(uuid, jsonb), logica.mapa_falhou(uuid, text), logica.mapa_repo_da_analise(uuid) to service_role;

create or replace function public.mapa_pedir(p_no uuid) returns integer language sql security invoker set search_path = '' as $$ select logica.mapa_pedir($1) $$;
create or replace function public.mapa_proposito_marcar(p_no uuid, p_impressao text, p_motivo text) returns void language sql security invoker set search_path = '' as $$ select logica.mapa_proposito_marcar($1, $2, $3) $$;
create or replace function public.mapa_proposito_tirar(p_no uuid, p_impressao text) returns void language sql security invoker set search_path = '' as $$ select logica.mapa_proposito_tirar($1, $2) $$;
create or replace function public.mapa_confere(p_segredo text) returns boolean language sql security invoker set search_path = '' as $$ select logica.mapa_confere($1) $$;
create or replace function public.mapa_proximo() returns jsonb language sql security invoker set search_path = '' as $$ select logica.mapa_proximo() $$;
create or replace function public.mapa_gravar(p_analise uuid, p_resultado jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select logica.mapa_gravar($1, $2) $$;
create or replace function public.mapa_falhou(p_analise uuid, p_erro text) returns void language sql security invoker set search_path = '' as $$ select logica.mapa_falhou($1, $2) $$;
create or replace function public.mapa_repo_da_analise(p_analise uuid) returns jsonb language sql stable security invoker set search_path = '' as $$ select logica.mapa_repo_da_analise($1) $$;
revoke all on function public.mapa_pedir(uuid), public.mapa_proposito_marcar(uuid, text, text), public.mapa_proposito_tirar(uuid, text),
  public.mapa_confere(text), public.mapa_proximo(), public.mapa_gravar(uuid, jsonb), public.mapa_falhou(uuid, text), public.mapa_repo_da_analise(uuid) from public, anon, authenticated, service_role;
grant execute on function public.mapa_pedir(uuid), public.mapa_proposito_marcar(uuid, text, text), public.mapa_proposito_tirar(uuid, text) to authenticated;
grant execute on function public.mapa_confere(text), public.mapa_proximo(), public.mapa_gravar(uuid, jsonb), public.mapa_falhou(uuid, text), public.mapa_repo_da_analise(uuid) to service_role;
comment on function public.mapa_pedir(uuid) is 'Porta da API do Mapa do Sistema (security invoker). O corpo e a regra de acesso estão em logica.mapa_pedir.';
comment on function public.mapa_proposito_marcar(uuid, text, text) is 'Porta da API do Mapa do Sistema (security invoker). O corpo e a regra de acesso estão em logica.mapa_proposito_marcar.';
comment on function public.mapa_proposito_tirar(uuid, text) is 'Porta da API do Mapa do Sistema (security invoker). O corpo e a regra de acesso estão em logica.mapa_proposito_tirar.';
comment on function public.mapa_confere(text) is 'Só a Edge Function mapa-trabalho (service_role): confere o segredo do trabalhador.';
comment on function public.mapa_proximo() is 'Só a Edge Function mapa-trabalho (service_role): pega o próximo pedido do Mapa do Sistema.';
comment on function public.mapa_gravar(uuid, jsonb) is 'Só a Edge Function mapa-trabalho (service_role): grava o resultado de uma análise.';
comment on function public.mapa_repo_da_analise(uuid) is 'Só a Edge Function mapa-trabalho (service_role): o repositório de uma análise que está rodando.';
comment on function public.mapa_falhou(uuid, text) is 'Só a Edge Function mapa-trabalho (service_role): marca a análise com erro.';

/* ---------- ao vivo (parte 67): a tela fica sabendo quando a análise muda e quando alguém marca "é de propósito" ---------- */
do $$ begin
  if to_regclass('interno.ao_vivo_tabelas') is null then return; end if;
  insert into interno.ao_vivo_tabelas (tabela, chave, espaco) values
    ('mapa_analises', 'id', 'interno.av_esp_no(x.no_id)'), ('mapa_proposito', 'impressao', 'interno.av_esp_no(x.no_id)')
  on conflict (tabela) do update set chave = excluded.chave, espaco = excluded.espaco;
end $$;
drop trigger if exists zz_ao_vivo_i on public.mapa_analises;
drop trigger if exists zz_ao_vivo_u on public.mapa_analises;
drop trigger if exists zz_ao_vivo_d on public.mapa_analises;
drop trigger if exists zz_ao_vivo_i on public.mapa_proposito;
drop trigger if exists zz_ao_vivo_u on public.mapa_proposito;
drop trigger if exists zz_ao_vivo_d on public.mapa_proposito;
create trigger zz_ao_vivo_i after insert on public.mapa_analises referencing new table as novas for each statement execute function interno.ao_vivo_avisar('id', 'interno.av_esp_no(x.no_id)');
create trigger zz_ao_vivo_u after update on public.mapa_analises referencing old table as velhas new table as novas for each statement execute function interno.ao_vivo_avisar('id', 'interno.av_esp_no(x.no_id)');
create trigger zz_ao_vivo_d after delete on public.mapa_analises referencing old table as velhas for each statement execute function interno.ao_vivo_avisar('id', 'interno.av_esp_no(x.no_id)');
create trigger zz_ao_vivo_i after insert on public.mapa_proposito referencing new table as novas for each statement execute function interno.ao_vivo_avisar('impressao', 'interno.av_esp_no(x.no_id)');
create trigger zz_ao_vivo_u after update on public.mapa_proposito referencing old table as velhas new table as novas for each statement execute function interno.ao_vivo_avisar('impressao', 'interno.av_esp_no(x.no_id)');
create trigger zz_ao_vivo_d after delete on public.mapa_proposito referencing old table as velhas for each statement execute function interno.ao_vivo_avisar('impressao', 'interno.av_esp_no(x.no_id)');
