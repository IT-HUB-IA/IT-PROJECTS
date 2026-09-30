-- =====================================================================
-- Parte 32: conectar o GitHub e o GitLab com um clique, por espaço (cada empresa conecta a própria conta)
-- Depende das partes 15 (espaços), 16 (dono do sistema), 19 (repositórios) e 30 (desenhos automáticos).
--
-- Como fica:
--   1. GitHub: o CicloDev tem UM app no GitHub (criado uma vez pelo dono do sistema, com um clique na tela Admin).
--      Cada empresa instala esse app na conta ou na organização dela pela janelinha do GitHub e escolhe os repositórios.
--      Os avisos (push, pull request, publicação) chegam sozinhos pelo app, sem configurar nada em cada repositório.
--      O código é lido com uma chave temporária do app (vale 1 hora), nunca com a chave de uma pessoa.
--   2. GitLab: o CicloDev tem UM aplicativo OAuth no GitLab (o dono do sistema cadastra o número e o segredo na tela Admin).
--      A empresa clica em Conectar ao GitLab, autoriza na janelinha do GitLab e escolhe os projetos.
--      O aviso de cada projeto é criado sozinho pelo CicloDev, com um segredo que ninguém precisa ver.
--   3. Cada conexão é do espaço (da empresa), não da pessoa. Quem é do espaço vê as contas conectadas e liga
--      os repositórios dela aos projetos, produtos e aplicações.
--
-- Sai (não é mais usado): o segredo que a tela mostrava para colar no GitHub ou no GitLab (repositorio_segredo),
-- a ligação digitando o endereço do repositório e a função git_receber antiga.
-- =====================================================================

-- ---------- 1. os apps do CicloDev (um do GitHub, um do GitLab) ----------
create table if not exists interno.git_apps (
  provedor      text primary key check (provedor in ('github','gitlab')),
  dados         jsonb not null,                       -- tudo, com os segredos (só a função lê)
  publico       jsonb not null default '{}'::jsonb,   -- o que a tela pode saber (nome do app, número público, endereço de volta)
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.pessoas(id) on delete set null
);
comment on table interno.git_apps is 'O app do CicloDev no GitHub e o aplicativo OAuth no GitLab. Os segredos ficam em dados; a tela só vê publico, pela função git_apps_status.';
revoke all on interno.git_apps from public, anon, authenticated;

-- o que a tela sabe: se cada um está pronto e os dados públicos
create or replace function public.git_apps_status() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'github', coalesce((select a.publico || jsonb_build_object('pronto', true) from interno.git_apps a where a.provedor = 'github'), '{"pronto":false}'::jsonb),
    'gitlab', coalesce((select a.publico || jsonb_build_object('pronto', true) from interno.git_apps a where a.provedor = 'gitlab'), '{"pronto":false}'::jsonb))
$$;

-- só o dono do sistema grava. GitHub: o que o GitHub devolve ao criar o app. GitLab: número, segredo e endereço.
create or replace function public.git_app_gravar(p_provedor text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d jsonb := coalesce(p_dados, '{}'::jsonb); pub jsonb; antigo jsonb;
begin
  perform interno.exigir_dono();
  select dados into antigo from interno.git_apps where provedor = p_provedor;
  if p_provedor = 'github' then
    if coalesce(d->>'app_id', '') !~ '^[0-9]+$' or coalesce(d->>'slug', '') !~ '^[a-z0-9-]+$' or coalesce(d->>'client_id', '') = ''
       or coalesce(d->>'client_secret', '') = '' or coalesce(d->>'webhook_secret', '') = '' or coalesce(d->>'pem', '') !~ 'PRIVATE KEY' then
      raise exception 'Faltam dados do app do GitHub' using errcode = '22023'; end if;
    pub := jsonb_build_object('slug', d->>'slug', 'client_id', d->>'client_id', 'nome', d->>'nome', 'html_url', d->>'html_url', 'dono', d->>'dono', 'retorno', d->>'retorno');
  elsif p_provedor = 'gitlab' then
    if coalesce(btrim(d->>'client_secret'), '') = '' and antigo is not null then d := d || jsonb_build_object('client_secret', antigo->>'client_secret'); end if;
    d := d || jsonb_build_object('base', rtrim(coalesce(nullif(btrim(d->>'base'), ''), 'https://gitlab.com'), '/'));
    if coalesce(btrim(d->>'client_id'), '') = '' or coalesce(btrim(d->>'client_secret'), '') = '' then
      raise exception 'Informe o Application ID e o Secret do GitLab' using errcode = '22023'; end if;
    if d->>'base' !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'O endereço do GitLab precisa ser https://servidor' using errcode = '22023'; end if;
    if coalesce(d->>'retorno', '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
    pub := jsonb_build_object('client_id', btrim(d->>'client_id'), 'base', d->>'base', 'retorno', d->>'retorno');
  else raise exception 'Provedor inválido' using errcode = '22023'; end if;
  insert into interno.git_apps (provedor, dados, publico, atualizado_por) values (p_provedor, d, pub, interno.pessoa_atual())
  on conflict (provedor) do update set dados = excluded.dados, publico = excluded.publico, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return pub || jsonb_build_object('pronto', true);
end $$;

-- a função git-conectar, a git-webhook e as dos desenhos leem os segredos (só service_role)
create or replace function public.git_app_ler(p_provedor text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$ select dados from interno.git_apps where provedor = p_provedor $$;

-- ---------- 2. as contas conectadas de cada espaço ----------
create table if not exists public.git_conexoes (
  id          uuid primary key default gen_random_uuid(),
  espaco_id   uuid not null references public.espacos(id) on delete cascade,
  provedor    text not null check (provedor in ('github','gitlab')),
  externo_id  text not null check (length(externo_id) between 1 and 60),   -- GitHub: número da instalação do app; GitLab: número da pessoa
  conta       text not null check (length(conta) between 1 and 200),       -- o nome da conta ou da organização
  conta_tipo  text,                                                        -- GitHub: Organization ou User
  avatar_url  text check (avatar_url is null or avatar_url ~ '^https://'),
  url         text check (url is null or url ~ '^https://'),               -- onde mudar o acesso (GitHub: tela da instalação)
  criado_por  uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  removida_em timestamptz,
  ultimo_erro text,
  unique (espaco_id, provedor, externo_id)
);
create index if not exists git_conexoes_externo_idx on public.git_conexoes (provedor, externo_id);
comment on table public.git_conexoes is 'Conta do GitHub (instalação do app do CicloDev) ou do GitLab (autorização OAuth) conectada a um espaço. Quem é do espaço vê e usa.';
-- GitHub: uma instalação pode ser de outra pessoa (o dono instalou o app e você é colaborador de um repositório dele).
-- Na hora de conectar, guardamos só os repositórios que QUEM CONECTOU pode acessar; só esses aparecem e podem ser ligados.
-- Vazio (null) só no GitLab, onde a chave já é da própria pessoa e o GitLab já limita.
alter table public.git_conexoes add column if not exists repos_permitidos text[];
comment on column public.git_conexoes.repos_permitidos is 'GitHub: números dos repositórios desta instalação que a pessoa que conectou pode acessar. Só eles aparecem e podem ser ligados. Atualiza ao conectar de novo.';

create table if not exists interno.git_tokens (
  conexao_id  uuid primary key references public.git_conexoes(id) on delete cascade,
  acesso      text not null,
  renovacao   text,
  expira_em   timestamptz,
  trocado_em  timestamptz not null default now()
);
comment on table interno.git_tokens is 'Só GitLab: a chave de acesso e a de renovação da conexão. O GitHub não guarda chave: pede uma temporária ao app a cada uso.';
revoke all on interno.git_tokens from public, anon, authenticated;

alter table public.git_conexoes enable row level security;
drop policy if exists ver on public.git_conexoes;
create policy ver on public.git_conexoes for select to authenticated using (espaco_id in (select interno.meus_espacos()) and not (select interno.eh_stakeholder()));
revoke all on public.git_conexoes from anon, authenticated;
grant select on public.git_conexoes to authenticated;
grant select, insert, update, delete on public.git_conexoes to service_role;

-- ---------- 3. o vai e volta da janelinha (evita que alguém "pendure" a conta de outro no seu espaço) ----------
create table if not exists interno.git_estados (
  estado     text primary key,
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  espaco_id  uuid references public.espacos(id) on delete cascade,
  provedor   text not null check (provedor in ('github','gitlab','github-app')),
  criado_em  timestamptz not null default now()
);
revoke all on interno.git_estados from public, anon, authenticated;

create or replace function public.git_estado_novo(p_provedor text) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare e text := encode(gen_random_bytes(24), 'hex'); p uuid := interno.pessoa_atual(); esp uuid := interno.meu_espaco();
begin
  if p is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if p_provedor not in ('github','gitlab','github-app') then raise exception 'Provedor inválido' using errcode = '22023'; end if;
  if p_provedor = 'github-app' then perform interno.exigir_dono(); end if;
  if p_provedor <> 'github-app' and esp is null then raise exception 'Você ainda não tem um espaço' using errcode = '42501'; end if;
  delete from interno.git_estados where criado_em < now() - interval '1 day';
  insert into interno.git_estados (estado, pessoa_id, espaco_id, provedor) values (e, p, esp, p_provedor);
  return e;
end $$;

-- a pessoa voltou da janelinha: confere que o vai e volta é dela e é recente, e usa (não vale de novo)
create or replace function public.git_estado_usar(p_estado text, p_provedor text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s interno.git_estados;
begin
  delete from interno.git_estados where estado = p_estado and provedor = p_provedor and pessoa_id = interno.pessoa_atual()
   and criado_em > now() - interval '30 minutes' returning * into s;
  if s.estado is null then raise exception 'A conexão expirou ou não é sua. Tente de novo.' using errcode = '42501'; end if;
  return jsonb_build_object('pessoa_id', s.pessoa_id, 'espaco_id', s.espaco_id);
end $$;

-- ---------- 4. gravar e ler as conexões (só a função git-conectar) ----------
create or replace function public.git_conexao_gravar(p_espaco uuid, p_pessoa uuid, p_provedor text, p_externo text, p_conta text, p_tipo text,
                                                     p_avatar text, p_url text, p_tokens jsonb default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare cid uuid;
begin
  insert into public.git_conexoes (espaco_id, provedor, externo_id, conta, conta_tipo, avatar_url, url, criado_por)
  values (p_espaco, p_provedor, p_externo, left(p_conta, 200), left(p_tipo, 40),
          case when p_avatar ~ '^https://' then p_avatar end, case when p_url ~ '^https://' then p_url end, p_pessoa)
  on conflict (espaco_id, provedor, externo_id) do update set conta = excluded.conta, conta_tipo = excluded.conta_tipo,
     avatar_url = excluded.avatar_url, url = coalesce(excluded.url, git_conexoes.url), removida_em = null, ultimo_erro = null
  returning id into cid;
  if p_tokens is not null and coalesce(p_tokens->>'acesso', '') <> '' then
    insert into interno.git_tokens (conexao_id, acesso, renovacao, expira_em) values (cid, p_tokens->>'acesso', p_tokens->>'renovacao', (p_tokens->>'expira_em')::timestamptz)
    on conflict (conexao_id) do update set acesso = excluded.acesso, renovacao = excluded.renovacao, expira_em = excluded.expira_em, trocado_em = now();
  end if;
  -- os repositórios que tinham parado por causa desta conta voltam
  update public.repositorios set ativo = true, ultimo_erro = null where conexao_id = cid and not ativo and ultimo_erro like 'Conta %';
  return cid;
end $$;

create or replace function public.git_conexao_ler(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', t.acesso, 'renovacao', t.renovacao, 'expira_em', t.expira_em) from interno.git_tokens t where t.conexao_id = c.id))
    from public.git_conexoes c where c.id = p_id
$$;

create or replace function public.git_tokens_gravar(p_conexao uuid, p_acesso text, p_renovacao text, p_expira timestamptz) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into interno.git_tokens (conexao_id, acesso, renovacao, expira_em) values (p_conexao, p_acesso, p_renovacao, p_expira)
  on conflict (conexao_id) do update set acesso = excluded.acesso, renovacao = coalesce(excluded.renovacao, git_tokens.renovacao), expira_em = excluded.expira_em, trocado_em = now()
$$;

-- a conta não responde mais (chave revogada, app removido): anota e para os repositórios dela
create or replace function public.git_conexao_erro(p_conexao uuid, p_erro text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.git_conexoes set ultimo_erro = left(p_erro, 500) where id = p_conexao
$$;

-- tirar uma conta do espaço (a pessoa do espaço). Com repositório ligado, pede para desligar antes.
create or replace function public.git_conexao_remover(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.git_conexoes c where c.id = p_id and c.espaco_id in (select interno.meus_espacos())) then
    raise exception 'Você não pode mudar esta conta' using errcode = '42501'; end if;
  if exists (select 1 from public.repositorios r where r.conexao_id = p_id) then
    raise exception 'Desligue antes os repositórios desta conta' using errcode = '23503'; end if;
  delete from public.git_conexoes where id = p_id;
end $$;

-- ---------- 5. repositórios: agora só entram pela conexão ----------
alter table public.repositorios
  add column if not exists conexao_id uuid references public.git_conexoes(id) on delete restrict,
  add column if not exists externo_id text,
  add column if not exists webhook_id text;
create index if not exists repositorios_externo_idx on public.repositorios (provedor, externo_id);
comment on column public.repositorios.conexao_id is 'A conta conectada (GitHub ou GitLab) por onde o repositório foi ligado.';
comment on column public.repositorios.externo_id is 'O número do repositório no GitHub ou do projeto no GitLab.';
comment on column public.repositorios.webhook_id is 'Só GitLab: o aviso que o CicloDev criou no projeto (sai junto quando desliga).';

-- a tela não insere mais direto nem muda nome e número: só liga pela função, e muda só as opções
drop policy if exists cria on public.repositorios;
revoke insert, update on public.repositorios from authenticated;
grant update (mover_status, ativo, branch_principal) on public.repositorios to authenticated;

-- o segredo do aviso agora só existe no GitLab e ninguém vê: a função cria o aviso no projeto sozinha
drop function if exists public.repositorio_segredo(uuid, boolean);
create or replace function interno.repositorio_criar_segredo() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.provedor = 'gitlab' then insert into interno.repositorios_segredos (repositorio_id) values (new.id) on conflict do nothing; end if;
  return null;
end $$;
delete from interno.repositorios_segredos s using public.repositorios r where r.id = s.repositorio_id and r.provedor = 'github';

-- ligar um repositório da conta conectada a um ponto. Quem chama é a função git-conectar, com o login da pessoa,
-- depois de conferir no GitHub ou no GitLab que o repositório existe nessa conta.
create or replace function public.git_repo_ligar(p_no uuid, p_conexao uuid, p_externo text, p_nome text, p_url text, p_branch text, p_mover boolean default true)
returns public.repositorios
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.git_conexoes; r public.repositorios;
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  select * into c from public.git_conexoes where id = p_conexao and espaco_id in (select interno.meus_espacos()) and removida_em is null;
  if c.id is null then raise exception 'Esta conta não está conectada ao seu espaço' using errcode = '42501'; end if;
  if coalesce(p_externo, '') !~ '^[0-9]+$' then raise exception 'Repositório inválido' using errcode = '22023'; end if;
  if c.provedor = 'github' and not (p_externo = any(coalesce(c.repos_permitidos, '{}'))) then
    raise exception 'Quem conectou esta conta não tem acesso a este repositório no GitHub' using errcode = '42501'; end if;
  insert into public.repositorios (no_id, provedor, nome, url, branch_principal, mover_status, conexao_id, externo_id)
  values (p_no, c.provedor, p_nome, case when p_url ~ '^https://' then p_url end, coalesce(nullif(btrim(p_branch), ''), 'main'), coalesce(p_mover, true), c.id, p_externo)
  on conflict (no_id, provedor, nome) do update set conexao_id = excluded.conexao_id, externo_id = excluded.externo_id, url = excluded.url,
     branch_principal = excluded.branch_principal, ativo = true, ultimo_erro = null
  returning * into r;
  return r;
end $$;

create or replace function public.git_conexao_repos(p_conexao uuid, p_repos text[]) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.git_conexoes set repos_permitidos = array(select distinct x from unnest(coalesce(p_repos, '{}')) x where x ~ '^[0-9]+$') where id = p_conexao and provedor = 'github'
$$;
revoke all on function public.git_conexao_repos(uuid, text[]) from public, anon, authenticated;
grant execute on function public.git_conexao_repos(uuid, text[]) to service_role;

create or replace function public.git_repo_segredo(p_repo uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$ select segredo from interno.repositorios_segredos where repositorio_id = p_repo $$;
create or replace function public.git_repo_gancho(p_repo uuid, p_gancho text) returns void
language sql security definer set search_path = public, pg_temp as $$ update public.repositorios set webhook_id = left(p_gancho, 60) where id = p_repo $$;

-- ---------- 6. receber os avisos ----------
-- o que cada aviso faz, igual para os dois provedores depois de conferido
-- o repositório mudou de nome ou de dono no GitHub ou no GitLab: o CicloDev acompanha sozinho no próximo aviso.
-- É só uma troca de nome: a ligação é pelo id do repositório no GitHub/GitLab (externo_id), que não muda.
-- Nunca derruba o aviso: se o nome novo não couber nas regras da tabela, fica o antigo.
create or replace function interno.git_nome_repo(r public.repositorios, j jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare nm text; u text; ext text;
begin
  if r.provedor = 'github' then nm := j#>>'{repository,full_name}'; u := j#>>'{repository,html_url}'; ext := j#>>'{repository,id}';
  else nm := j#>>'{project,path_with_namespace}'; u := j#>>'{project,web_url}'; ext := j#>>'{project,id}'; end if;
  if nm is null or ext is null or r.externo_id is null or ext <> r.externo_id then return; end if;
  if nm !~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$' or length(nm) > 200 then return; end if;
  if u is not null and u !~ '^https://' then u := null; end if;
  begin
    update public.repositorios set nome = nm, url = coalesce(u, url)
     where id = r.id and (nome is distinct from nm or (u is not null and url is distinct from u));
  exception when unique_violation then null;
  end;
end $$;
revoke all on function interno.git_nome_repo(public.repositorios, jsonb) from public, anon, authenticated;

create or replace function interno.git_processar(r public.repositorios, p_evento text, j jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
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
  return jsonb_build_object('ligados', n_lig, 'status_mudou', n_mov) || res;
end $$;

-- GitHub: todos os avisos chegam pelo app, assinados com o segredo do app
create or replace function public.git_receber_github(p_evento text, p_assinatura text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s text := (select dados->>'webhook_secret' from interno.git_apps where provedor = 'github');
  ev text := lower(coalesce(p_evento, '')); j jsonb; inst text; rid text; r public.repositorios; n integer := 0; res jsonb := '[]'::jsonb; msg text;
begin
  if s is null then return jsonb_build_object('ok', false, 'erro', 'app do GitHub não configurado'); end if;
  if coalesce(p_assinatura, '') <> 'sha256=' || encode(hmac(convert_to(p_corpo, 'UTF8'), convert_to(s, 'UTF8'), 'sha256'), 'hex') then
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida'); end if;
  begin j := p_corpo::jsonb; exception when others then return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  inst := j#>>'{installation,id}';

  if ev = 'ping' then return jsonb_build_object('ok', true, 'ping', true); end if;
  -- a empresa tirou, suspendeu ou voltou com o app na conta dela
  if ev = 'installation' then
    if j->>'action' in ('deleted','suspend') then
      msg := case when j->>'action' = 'deleted' then 'Conta desconectada: o app do CicloDev foi removido no GitHub' else 'Conta suspensa: o app do CicloDev foi suspenso no GitHub' end;
      update public.git_conexoes set removida_em = case when j->>'action' = 'deleted' then now() else removida_em end, ultimo_erro = msg where provedor = 'github' and externo_id = inst;
      update public.repositorios set ativo = false, ultimo_erro = msg
       where conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    elsif j->>'action' = 'unsuspend' then
      update public.git_conexoes set ultimo_erro = null where provedor = 'github' and externo_id = inst;
      update public.repositorios set ativo = true, ultimo_erro = null
       where ultimo_erro like 'Conta %' and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    end if;
    return jsonb_build_object('ok', true, 'instalacao', j->>'action');
  end if;
  -- a empresa tirou (ou devolveu) o acesso a alguns repositórios
  if ev = 'installation_repositories' then
    update public.repositorios set ativo = false, ultimo_erro = 'Conta sem acesso a este repositório: ele saiu do app do CicloDev no GitHub'
     where provedor = 'github' and externo_id in (select x.value->>'id' from jsonb_array_elements(coalesce(j->'repositories_removed', '[]')) x)
       and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    update public.repositorios set ativo = true, ultimo_erro = null
     where provedor = 'github' and ultimo_erro like 'Conta %' and externo_id in (select x.value->>'id' from jsonb_array_elements(coalesce(j->'repositories_added', '[]')) x)
       and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    return jsonb_build_object('ok', true, 'repositorios', j->>'action');
  end if;
  -- os avisos de um repositório: vale para todos os pontos em que ele está ligado por esta instalação
  rid := j#>>'{repository,id}';
  if rid is null or inst is null then return jsonb_build_object('ok', true, 'ignorado', ev); end if;
  for r in select x.* from public.repositorios x join public.git_conexoes c on c.id = x.conexao_id
            where x.provedor = 'github' and x.externo_id = rid and c.provedor = 'github' and c.externo_id = inst and c.removida_em is null loop
    res := res || jsonb_build_array(interno.git_processar(r, p_evento, j) || jsonb_build_object('repositorio', r.id));
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'evento', p_evento, 'repositorios', n, 'resultado', res);
end $$;

-- GitLab: um aviso por projeto, com o segredo que o CicloDev criou para ele
create or replace function public.git_receber_gitlab(p_repo uuid, p_evento text, p_token text, p_corpo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.repositorios; s text; j jsonb;
begin
  select * into r from public.repositorios where id = p_repo and provedor = 'gitlab';
  if r.id is null then return jsonb_build_object('ok', false, 'erro', 'repositório não encontrado'); end if;
  select segredo into s from interno.repositorios_segredos where repositorio_id = r.id;
  if s is null or coalesce(p_token, '') <> s then
    update public.repositorios set ultimo_erro = 'Aviso recusado: segredo não confere (' || coalesce(p_evento, '?') || ')', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida');
  end if;
  begin j := p_corpo::jsonb; exception when others then
    update public.repositorios set ultimo_erro = 'Aviso com conteúdo inválido', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  return jsonb_build_object('ok', true, 'evento', p_evento) || interno.git_processar(r, p_evento, j);
end $$;

drop function if exists public.git_receber(uuid, text, text, text, text, text);

-- ---------- 7. os desenhos automáticos (parte 30) passam a ler também o GitLab ----------
alter table public.infra_automacoes drop constraint if exists infra_automacoes_origem_check;
alter table public.infra_automacoes add constraint infra_automacoes_origem_check check (origem in ('github','gitlab','banco','manual'));
alter table public.infra_diagramas drop constraint if exists infra_diagramas_origem_check;
alter table public.infra_diagramas add constraint infra_diagramas_origem_check check (origem in ('manual','devit','github','gitlab','banco'));

-- Parte 19 (troca): a versão (release) publicada pelo GitHub/GitLab é procurada só no lugar do repositório e no que
-- está dentro dele, nunca no projeto inteiro: dois produtos com "v1.0" não se confundem.
create or replace function interno.codigo_versao(p_no uuid, p_nome text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select m.id from public.marcos m
   where m.tipo = 'release' and p_nome is not null
     and m.no_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no)
     and lower(regexp_replace(btrim(m.nome), '^[vV]', '')) = lower(regexp_replace(btrim(p_nome), '^[vV]', ''))
   order by m.data desc limit 1
$$;
revoke all on function interno.codigo_versao(uuid, text) from public, anon, authenticated;

create or replace function interno.infra_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare alvo uuid; prov text;
begin
  if new.status <> 'sucesso' or new.ambiente <> 'producao' or new.repositorio_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'sucesso' and old.ambiente = 'producao' and old.referencia is not distinct from new.referencia then return null; end if;
  alvo := interno.infra_no_de(new.no_id);
  if alvo is null then return null; end if;
  select r.provedor into prov from public.repositorios r where r.id = new.repositorio_id and r.ativo and r.conexao_id is not null;
  if prov is null then return null; end if;
  if exists (select 1 from public.infra_automacoes a where a.no_id = alvo and a.repositorio_id = new.repositorio_id
              and a.referencia is not distinct from new.referencia and a.status in ('pendente','rodando')) then return null; end if;
  insert into public.infra_automacoes (no_id, origem, repositorio_id, publicacao_id, referencia, pedido_por)
  values (alvo, prov, new.repositorio_id, new.id, left(new.referencia, 200), null);
  perform interno.infra_auto_chamar();
  return null;
end $$;

create or replace function public.infra_auto_gravar(p_no uuid, p_aba text, p_chave text, p_nome text, p_formato text, p_fonte text,
                                                    p_origem text, p_referencia text, p_evidencias jsonb default '[]', p_lacunas jsonb default '[]')
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.infra_diagramas;
begin
  if p_origem not in ('github','gitlab','banco') then raise exception 'Origem inválida' using errcode = '22023'; end if;
  if coalesce(btrim(p_chave), '') = '' then raise exception 'Falta a chave do desenho' using errcode = '22023'; end if;
  select * into d from public.infra_diagramas where no_id = p_no and chave_auto = p_chave for update;
  if not found then
    insert into public.infra_diagramas (no_id, aba, nome, formato, fonte, origem, chave_auto, referencia, auto_em, evidencias, lacunas, criado_por)
    values (p_no, p_aba, left(p_nome, 160), p_formato, p_fonte, p_origem, p_chave, left(p_referencia, 200), now(),
            coalesce(p_evidencias, '[]'), coalesce(p_lacunas, '[]'), null)
    returning * into d;
    return jsonb_build_object('id', d.id, 'renderizar', true, 'novo', true);
  end if;
  update public.infra_diagramas set nome = left(p_nome, 160), formato = p_formato, fonte = p_fonte, origem = p_origem, referencia = left(p_referencia, 200),
         auto_em = now(), evidencias = coalesce(p_evidencias, '[]'), lacunas = coalesce(p_lacunas, '[]')
   where id = d.id returning * into d;
  return jsonb_build_object('id', d.id, 'renderizar', d.svg is null, 'novo', false);
end $$;

-- a fila leva junto a conexão e o número de cada repositório (para a função pedir a chave certa)
create or replace function public.infra_auto_proximos(p_limite integer default 3) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare ids uuid[]; saida jsonb;
begin
  update public.infra_automacoes set status = 'erro', concluido_em = now(), erro = 'Parou no meio três vezes'
   where status = 'rodando' and iniciado_em < now() - interval '15 minutes' and tentativas >= 3;
  with fila as (
    select a.id from public.infra_automacoes a
     where a.status = 'pendente' or (a.status = 'rodando' and a.iniciado_em < now() - interval '15 minutes')
     order by a.criado_em limit greatest(1, least(coalesce(p_limite, 3), 10)) for update skip locked),
  pegos as (
    update public.infra_automacoes a set status = 'rodando', iniciado_em = now(), tentativas = a.tentativas + 1
      from fila where a.id = fila.id returning a.id)
  select array_agg(id) into ids from pegos;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'no_id', a.no_id, 'origem', a.origem, 'referencia', a.referencia,
      'repositorios', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor,
                                                                    'conexao_id', r.conexao_id, 'externo_id', r.externo_id) order by r.nome), '[]')
                         from public.repositorios r
                        where r.ativo and r.conexao_id is not null and (case when a.repositorio_id is not null then r.id = a.repositorio_id
                                                else interno.infra_no_de(r.no_id) = a.no_id end)),
      'banco', (select jsonb_build_object('esquemas', b.esquemas, 'conexao', c.conexao)
                  from public.infra_bancos b join interno.infra_bancos_conexao c on c.no_id = b.no_id
                 where b.no_id = a.no_id and b.ativo and a.origem in ('manual','banco'))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $$;

-- ---------- 8. quem chama o quê ----------
revoke all on function public.git_apps_status(), public.git_app_gravar(text, jsonb), public.git_app_ler(text),
  public.git_estado_novo(text), public.git_estado_usar(text, text),
  public.git_conexao_gravar(uuid, uuid, text, text, text, text, text, text, jsonb), public.git_conexao_ler(uuid),
  public.git_tokens_gravar(uuid, text, text, timestamptz), public.git_conexao_erro(uuid, text), public.git_conexao_remover(uuid),
  public.git_repo_ligar(uuid, uuid, text, text, text, text, boolean), public.git_repo_segredo(uuid), public.git_repo_gancho(uuid, text),
  public.git_receber_github(text, text, text), public.git_receber_gitlab(uuid, text, text, text),
  interno.git_processar(public.repositorios, text, jsonb) from public, anon, authenticated;
grant execute on function public.git_apps_status(), public.git_app_gravar(text, jsonb), public.git_estado_novo(text), public.git_estado_usar(text, text),
  public.git_conexao_remover(uuid), public.git_repo_ligar(uuid, uuid, text, text, text, text, boolean) to authenticated;
grant execute on function public.git_apps_status(), public.git_app_ler(text), public.git_conexao_gravar(uuid, uuid, text, text, text, text, text, text, jsonb),
  public.git_conexao_ler(uuid), public.git_tokens_gravar(uuid, text, text, timestamptz), public.git_conexao_erro(uuid, text),
  public.git_repo_segredo(uuid), public.git_repo_gancho(uuid, text),
  public.git_receber_github(text, text, text), public.git_receber_gitlab(uuid, text, text, text) to service_role;
