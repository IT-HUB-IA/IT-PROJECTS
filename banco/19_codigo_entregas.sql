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
