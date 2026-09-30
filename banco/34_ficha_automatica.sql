-- =====================================================================
-- CicloDev · 34 · Ficha técnica que se preenche sozinha pelo código e pelo banco
-- A função diagramas-auto, ao ler o código de um repositório ou a estrutura de um banco, tira o que dá para a ficha técnica
-- (linguagens, frameworks, bibliotecas, build, plataformas, APIs, integrações, nomes dos segredos sem o valor, banco,
-- tabelas, RLS, gatilhos) e grava aqui, separado do que as pessoas escrevem (ficha_campos nunca é tocada).
-- Cada repositório e cada banco tem as próprias linhas (origem), com o valor anterior e quando mudou: é o aviso de mudança.
-- E o push no branch principal passa a pedir os desenhos e a ficha na hora (antes, só a publicação em produção pedia).
-- =====================================================================

create table if not exists public.ficha_auto (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  origem         text not null check (origem ~ '^(repo|banco):[0-9a-f-]{36}$'),
  repositorio_id uuid references public.repositorios(id) on delete cascade,
  banco_id       uuid references public.infra_bancos(id) on delete cascade,
  fonte          text not null check (fonte in ('codigo','banco')),
  rotulo         text not null default '' check (length(rotulo) <= 200),   -- o nome do repositório ou do banco, para a tela
  secao          text not null check (length(secao) between 1 and 80),
  campo          text not null check (length(campo) between 1 and 120),
  valor          text not null check (length(valor) between 1 and 4000),
  referencia     text check (referencia is null or length(referencia) <= 200),   -- o commit, ou o resumo da estrutura do banco
  anterior       text check (anterior is null or length(anterior) <= 4000),
  mudou_em       timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (no_id, origem, secao, campo),
  check ((fonte = 'codigo' and repositorio_id is not null and banco_id is null) or (fonte = 'banco' and banco_id is not null and repositorio_id is null))
);
create index if not exists ficha_auto_no_idx on public.ficha_auto (no_id, mudou_em desc);
comment on table public.ficha_auto is 'Ficha técnica preenchida sozinha pela função diagramas-auto a partir do código (repositório) e da estrutura do banco. Só leitura para as pessoas; o que elas escrevem fica em ficha_campos.';
alter table public.ficha_auto enable row level security;
drop policy if exists ver on public.ficha_auto;
create policy ver on public.ficha_auto for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
revoke all on public.ficha_auto from public, anon, authenticated;
grant select on public.ficha_auto to authenticated;
grant all on public.ficha_auto to service_role;

-- a função diagramas-auto grava o que tirou de UM repositório ou de UM banco; o que essa origem não trouxe mais, sai.
-- Devolve quantos campos mudaram (novos ou com valor diferente).
create or replace function public.infra_ficha_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_referencia text, p_campos jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare c jsonb; v text; sc text; cp text; n integer := 0; chaves text[] := '{}'; velho public.ficha_auto; org text; fnt text;
begin
  if (p_repositorio is null) = (p_banco is null) then raise exception 'Diga o repositório ou o banco (um dos dois)' using errcode = '22023'; end if;
  if not exists (select 1 from public.nos where id = p_no) then raise exception 'Ponto não encontrado' using errcode = '22023'; end if;
  -- cada ponto tem a própria ficha: só entra o que é do repositório ou do banco ligado a ESTE ponto (o do app não vai para o produto)
  if p_repositorio is not null and not exists (select 1 from public.repositorios where id = p_repositorio and no_id = p_no) then return 0; end if;
  if p_banco is not null and not exists (select 1 from public.infra_bancos where id = p_banco and no_id = p_no) then return 0; end if;
  org := case when p_repositorio is not null then 'repo:' || p_repositorio else 'banco:' || p_banco end;
  fnt := case when p_repositorio is not null then 'codigo' else 'banco' end;
  if jsonb_typeof(coalesce(p_campos, '[]')) <> 'array' then raise exception 'Campos inválidos' using errcode = '22023'; end if;
  for c in select * from jsonb_array_elements(coalesce(p_campos, '[]')) loop
    sc := left(btrim(coalesce(c->>'secao', '')), 80); cp := left(btrim(coalesce(c->>'campo', '')), 120); v := left(btrim(coalesce(c->>'valor', '')), 4000);
    if sc = '' or cp = '' or v = '' then continue; end if;
    chaves := array_append(chaves, sc || '|' || cp);
    velho := null;
    select * into velho from public.ficha_auto where no_id = p_no and origem = org and secao = sc and campo = cp;
    if velho.id is null then
      insert into public.ficha_auto (no_id, origem, repositorio_id, banco_id, fonte, rotulo, secao, campo, valor, referencia)
      values (p_no, org, p_repositorio, p_banco, fnt, left(coalesce(p_rotulo, ''), 200), sc, cp, v, left(p_referencia, 200));
      n := n + 1;
    elsif velho.valor is distinct from v then
      update public.ficha_auto set anterior = left(velho.valor, 4000), valor = v, mudou_em = now(), atualizado_em = now(), rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200) where id = velho.id;
      n := n + 1;
    else
      update public.ficha_auto set atualizado_em = now(), rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200) where id = velho.id;
    end if;
  end loop;
  delete from public.ficha_auto where no_id = p_no and origem = org and not ((secao || '|' || campo) = any(chaves));
  return n;
end $$;
revoke all on function public.infra_ficha_gravar(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.infra_ficha_gravar(uuid, uuid, uuid, text, text, jsonb) to service_role;

-- push no branch principal de um repositório ligado: pede os desenhos (e a ficha) da aplicação e do produto ou projeto dela.
-- Pedido do mesmo repositório ainda esperando: só troca para o commit mais novo (não enfileira de novo).
create or replace function interno.infra_codigo_mudou(r public.repositorios, p_branch text, p_sha text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare alvo uuid; n integer := 0; ref text := left(nullif(p_sha, ''), 200);
begin
  if r.id is null or not r.ativo or r.conexao_id is null or ref is null or ref ~ '^0+$' then return; end if;
  if p_branch is distinct from coalesce(nullif(r.branch_principal, ''), 'main') then return; end if;
  for alvo in select distinct x from unnest(array[(select id from public.nos where id = r.no_id and tipo = 'aplicacao'), interno.infra_no_de(r.no_id)]) x where x is not null loop
    update public.infra_automacoes set referencia = ref where no_id = alvo and repositorio_id = r.id and status = 'pendente';
    if found then continue; end if;
    if exists (select 1 from public.infra_automacoes a where a.no_id = alvo and a.repositorio_id = r.id and a.referencia is not distinct from ref and a.status in ('pendente','rodando')) then continue; end if;
    insert into public.infra_automacoes (no_id, origem, repositorio_id, referencia, pedido_por) values (alvo, r.provedor, r.id, ref, null);
    n := n + 1;
  end loop;
  if n > 0 then perform interno.infra_auto_chamar(); end if;
end $$;
revoke all on function interno.infra_codigo_mudou(public.repositorios, text, text) from public, anon, authenticated;

-- a mesma interno.git_processar da parte 32 (com o complemento 41), com uma linha a mais no push do GitHub e no do GitLab
create or replace function interno.git_processar(r public.repositorios, p_evento text, j jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
          perform interno.infra_codigo_mudou(r, br, j->>'after');   -- parte 34: o push no branch principal refaz desenhos e ficha
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
        perform interno.infra_codigo_mudou(r, br, j->>'after');     -- parte 34
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
end $function$;
revoke all on function interno.git_processar(public.repositorios, text, jsonb) from public, anon, authenticated;
