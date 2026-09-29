-- SOMENTE TESTE LOCAL: parte 19 (repositórios, código no item, status sozinho, publicações e notas de versão)
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when c then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.grupo(p uuid) returns text language sql as $$ select s.grupo from itens i join status_fluxo s on s.id = i.status_id where i.id = p $$;

-- o projeto BL do William e dois itens dele em "A fazer"
create temp table alvo as
  select 'cea3db88-841f-5511-98d1-3bedcc411131'::uuid as projeto,
         (select i.id from itens i join status_fluxo s on s.id = i.status_id where s.grupo in ('todo','backlog') and i.chave is not null and i.excluido_em is null
            and i.frente_id in (select no_id from nos_ancestrais where ancestral_id = 'cea3db88-841f-5511-98d1-3bedcc411131') order by i.chave limit 1) as item1,
         (select i.id from itens i join status_fluxo s on s.id = i.status_id where s.grupo in ('todo','backlog') and i.chave is not null and i.excluido_em is null
            and i.frente_id in (select no_id from nos_ancestrais where ancestral_id = 'cea3db88-841f-5511-98d1-3bedcc411131') order by i.chave offset 1 limit 1) as item2;
alter table alvo add column chave1 text, add column chave2 text, add column repo uuid, add column repo_gl uuid;
update alvo set chave1 = (select chave from itens where id = item1), chave2 = (select chave from itens where id = item2);
grant select, update on alvo to authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;   -- como no Supabase
select pg_temp.ok((select item1 is not null and item2 is not null from alvo), 'achou dois itens do projeto BL em A fazer (' || (select chave1 || ', ' || chave2 from alvo) || ')');

-- ---------- William liga os repositórios ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
insert into repositorios (no_id, provedor, nome, url) select projeto, 'github', 'it-hub-ia/portal', 'https://github.com/it-hub-ia/portal' from alvo;
insert into repositorios (no_id, provedor, nome, url) select projeto, 'gitlab', 'it-hub-ia/grupo/portal-app', 'https://gitlab.com/it-hub-ia/grupo/portal-app' from alvo;
update alvo set repo = (select id from repositorios where provedor = 'github'), repo_gl = (select id from repositorios where provedor = 'gitlab');
select pg_temp.ok((select count(*) from repositorios) = 2, 'William liga um repositório do GitHub e um do GitLab ao projeto');
select pg_temp.ok(length(repositorio_segredo((select repo from alvo))) = 48, 'cada repositório nasce com um segredo');
do $$ begin
  begin perform count(*) from interno.repositorios_segredos; raise notice 'FALHA a tela leu a tabela de segredos';
  exception when insufficient_privilege then raise notice 'OK    a tabela de segredos não é lida direto'; end;
  begin insert into repositorios (no_id, provedor, nome) select projeto, 'bitbucket', 'x/y' from alvo; raise notice 'FALHA aceitou provedor desconhecido';
  exception when check_violation then raise notice 'OK    só GitHub ou GitLab'; end;
  begin perform public.git_receber((select repo from alvo), 'github', 'ping', null, null, '{}'); raise notice 'FALHA pessoa logada chamou git_receber';
  exception when insufficient_privilege then raise notice 'OK    só a função de avisos chama git_receber'; end;
end $$;
reset role;
create temp table seg as select repo, repositorio_segredo_sem as s from (select (select repo from alvo) repo) x,
  lateral (select segredo as repositorio_segredo_sem from interno.repositorios_segredos where repositorio_id = x.repo) y;
insert into seg select repo_gl, (select segredo from interno.repositorios_segredos where repositorio_id = repo_gl) from alvo;
grant select on seg to service_role, authenticated;
-- assinatura igual à do GitHub: HMAC SHA-256 do corpo com o segredo
create or replace function pg_temp.gh(evento text, corpo text) returns jsonb language sql as $$
  select public.git_receber((select repo from alvo), 'github', evento, 'sha256=' || encode(extensions.hmac(convert_to(corpo, 'UTF8'), convert_to((select s from seg where repo = (select repo from alvo)), 'UTF8'), 'sha256'), 'hex'), null, corpo) $$;
create or replace function pg_temp.gl(evento text, corpo text) returns jsonb language sql as $$
  select public.git_receber((select repo_gl from alvo), 'gitlab', evento, null, (select s from seg where repo = (select repo_gl from alvo)), corpo) $$;

set role service_role;
select pg_temp.ok((pg_temp.gh('ping', '{"zen":"ok"}')->>'ok')::boolean, 'GitHub: o teste de ligação (ping) passa');
select pg_temp.ok(not (public.git_receber((select repo from alvo), 'github', 'push', 'sha256=errado', null, '{}')->>'ok')::boolean, 'assinatura errada é recusada');
select pg_temp.ok((select ultimo_erro like 'Aviso recusado%' from repositorios where id = (select repo from alvo)), 'e fica anotado no repositório, para aparecer na tela');
select pg_temp.ok(not (public.git_receber((select repo_gl from alvo), 'gitlab', 'Push Hook', null, 'token-errado', '{}')->>'ok')::boolean, 'GitLab: token errado é recusado');

-- branch com a chave do item: liga e anda para Em andamento
select pg_temp.gh('create', json_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro', 'ref_type', 'branch', 'repository', json_build_object('html_url', 'https://github.com/it-hub-ia/portal'), 'sender', json_build_object('login', 'william'))::text);
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item1 from alvo) and tipo = 'branch') = 1, 'branch com a chave (minúscula) liga ao item');
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'doing', 'item foi para Em andamento sozinho');

-- push com commits: um cita o item 2 na mensagem
select pg_temp.gh('push', json_build_object('ref', 'refs/heads/' || lower((select chave1 from alvo)) || '-tela-de-cadastro', 'repository', json_build_object('html_url', 'https://github.com/it-hub-ia/portal'),
  'commits', json_build_array(
    json_build_object('id', 'aaa111', 'message', 'Monta a tela' || E'\n\ndetalhes', 'url', 'https://github.com/it-hub-ia/portal/commit/aaa111', 'author', json_build_object('name', 'William'), 'timestamp', '2026-09-29T10:00:00Z'),
    json_build_object('id', 'bbb222', 'message', 'Corrige ' || (select chave2 from alvo) || ' também', 'url', 'https://github.com/it-hub-ia/portal/commit/bbb222', 'author', json_build_object('name', 'William'), 'timestamp', '2026-09-29T10:05:00Z')))::text);
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item1 from alvo) and tipo = 'commit') = 2, 'os commits do branch ligam ao item 1');
select pg_temp.ok((select titulo from codigo_vinculos where ref = 'aaa111' and item_id = (select item1 from alvo)) = 'Monta a tela', 'guarda só a primeira linha da mensagem');
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item2 from alvo) and ref = 'bbb222') = 1 and pg_temp.grupo((select item2 from alvo)) = 'doing', 'commit que cita outro item liga e move ele também');
-- o GitHub reenviando o mesmo aviso não duplica
select pg_temp.gh('create', json_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro', 'ref_type', 'branch')::text);
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item1 from alvo) and tipo = 'branch') = 1, 'aviso repetido não duplica');

-- pull request aberto: Em revisão; mesclado: Concluído
select pg_temp.gh('pull_request', json_build_object('action', 'opened', 'pull_request', json_build_object('number', 12, 'title', 'Tela de cadastro', 'html_url', 'https://github.com/it-hub-ia/portal/pull/12', 'state', 'open', 'merged', false,
  'head', json_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro'), 'user', json_build_object('login', 'william')))::text);
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'review' and (select estado from codigo_vinculos where tipo = 'pr' and item_id = (select item1 from alvo)) = 'aberto', 'PR aberto: item em revisão');
select pg_temp.gh('pull_request', json_build_object('action', 'closed', 'pull_request', json_build_object('number', 12, 'title', 'Tela de cadastro', 'html_url', 'https://github.com/it-hub-ia/portal/pull/12', 'state', 'closed', 'merged', true,
  'head', json_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro')))::text);
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'done' and (select estado from codigo_vinculos where tipo = 'pr' and item_id = (select item1 from alvo)) = 'mesclado', 'PR mesclado: item concluído');
select pg_temp.ok((select concluido_em is not null from itens where id = (select item1 from alvo)), 'o banco marcou a data de conclusão');
-- depois de concluído, um commit novo não volta o item
select pg_temp.gh('push', json_build_object('ref', 'refs/heads/main', 'commits', json_build_array(json_build_object('id', 'ccc333', 'message', 'Ajuste ' || (select chave1 from alvo), 'timestamp', '2026-09-29T11:00:00Z')))::text);
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'done', 'status só anda para a frente (commit depois não volta o item)');

-- versão, release e deployment
reset role;
insert into marcos (no_id, tipo, nome, data) select projeto, 'release', 'v1.2.0', current_date + 7 from alvo;
set role service_role;
select pg_temp.gh('release', json_build_object('action', 'published', 'release', json_build_object('id', 777, 'tag_name', '1.2.0', 'html_url', 'https://github.com/it-hub-ia/portal/releases/tag/1.2.0', 'published_at', '2026-09-29T12:00:00Z'))::text);
select pg_temp.ok((select count(*) from publicacoes where origem = 'github' and versao = '1.2.0') = 1, 'release publicada vira publicação');
select pg_temp.ok((select entregue_em is not null from marcos where nome = 'v1.2.0'), 'e marca a versão v1.2.0 como entregue (1.2.0 = v1.2.0)');
select pg_temp.ok((select marco_id is not null from publicacoes where versao = '1.2.0'), 'a publicação fica ligada à versão');
select pg_temp.gh('deployment_status', json_build_object('deployment', json_build_object('id', 55, 'ref', 'main', 'sha', 'ddd444eee555', 'environment', 'Preview'),
  'deployment_status', json_build_object('state', 'in_progress', 'environment', 'Preview'))::text);
select pg_temp.gh('deployment_status', json_build_object('deployment', json_build_object('id', 55, 'ref', 'main', 'sha', 'ddd444eee555', 'environment', 'Preview'),
  'deployment_status', json_build_object('state', 'success', 'environment', 'Preview', 'environment_url', 'https://portal-previa.vercel.app'))::text);
select pg_temp.ok((select count(*) from publicacoes where id_externo = 'deploy:55') = 1 and (select status || '|' || ambiente from publicacoes where id_externo = 'deploy:55') = 'sucesso|previa',
  'deployment: em andamento e depois sucesso ficam num registro só, no ambiente Prévia');

-- GitLab: push, merge request e deployment
select pg_temp.gl('Push Hook', json_build_object('ref', 'refs/heads/feature/' || (select chave2 from alvo), 'after', 'fff666', 'project', json_build_object('web_url', 'https://gitlab.com/it-hub-ia/grupo/portal-app'), 'user_username', 'william',
  'commits', json_build_array(json_build_object('id', 'fff666', 'message', 'Começa', 'url', 'https://gitlab.com/x/-/commit/fff666', 'author', json_build_object('name', 'William'), 'timestamp', '2026-09-29T13:00:00+00:00')))::text);
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item2 from alvo) and repositorio_id = (select repo_gl from alvo) and tipo in ('branch','commit')) = 2, 'GitLab: branch e commit ligam ao item 2');
select pg_temp.gl('Merge Request Hook', json_build_object('object_attributes', json_build_object('iid', 3, 'title', 'Ajustes', 'url', 'https://gitlab.com/x/-/merge_requests/3', 'state', 'merged', 'source_branch', 'feature/' || (select chave2 from alvo)), 'user', json_build_object('username', 'william'))::text);
select pg_temp.ok(pg_temp.grupo((select item2 from alvo)) = 'done', 'GitLab: merge request mesclado conclui o item');
select pg_temp.gl('Deployment Hook', json_build_object('deployment_id', 9, 'status', 'success', 'environment', 'production', 'sha', 'fff666', 'ref', 'v1.3.0', 'environment_external_url', 'https://portal.it-ia.tec.br')::text);
select pg_temp.ok((select ambiente || '|' || status || '|' || origem from publicacoes where id_externo = 'deploy:9') = 'producao|sucesso|gitlab', 'GitLab: deployment em produção registrado');
select pg_temp.ok((select ultimo_evento = 'Deployment Hook' and ultimo_erro is null from repositorios where id = (select repo_gl from alvo)), 'o repositório guarda o último aviso recebido');
-- repositório com "mudar status" desligado só liga, não mexe no status
reset role;
update repositorios set mover_status = false where id = (select repo from alvo);
update itens set status_id = (select id from status_fluxo where no_id is null and chave = 'todo') where id = (select item2 from alvo);
set role service_role;
select pg_temp.gh('create', json_build_object('ref', (select chave2 from alvo) || '-outro', 'ref_type', 'branch')::text);
select pg_temp.ok(pg_temp.grupo((select item2 from alvo)) = 'todo' and (select count(*) from codigo_vinculos where ref = (select chave2 from alvo) || '-outro') = 1, 'com "mudar status" desligado, só liga o branch');
reset role;

-- ---------- William: publicação manual, excluir e o que a tela lê ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
insert into publicacoes (no_id, versao, ambiente) select projeto, 'v1.2.1', 'producao' from alvo;
select pg_temp.ok((select count(*) from publicacoes where versao = 'v1.2.1' and origem = 'manual' and criado_por = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28') = 1, 'publicação registrada na tela');
insert into codigo_vinculos (item_id, provedor, tipo, ref, url) select item1, 'github', 'pr', '99', 'https://github.com/it-hub-ia/portal/pull/99' from alvo;
select pg_temp.ok((select count(*) from codigo_vinculos where ref = '99') = 1, 'link de PR colado na tela');
delete from codigo_vinculos where ref = '99';
select pg_temp.ok((select count(*) from codigo_vinculos where ref = '99') = 0, 'Excluir o link do código');
delete from publicacoes where versao = 'v1.2.1';
select pg_temp.ok((select count(*) from publicacoes where versao = 'v1.2.1') = 0, 'Excluir a publicação');
update marcos set notas = E'## v1.2.0\n\n### Novidades\n- Tela de cadastro' where nome = 'v1.2.0';
select pg_temp.ok((select notas like '## v1.2.0%' from marcos where nome = 'v1.2.0'), 'notas de versão gravadas na versão');
select pg_temp.ok(repositorio_segredo((select repo from alvo), true) <> (select s from seg where repo = (select repo from alvo)), 'trocar o segredo gera outro');
reset role;

-- ---------- Ana (outro espaço) ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from repositorios) = 0 and (select count(*) from publicacoes) = 0 and (select count(*) from codigo_vinculos) = 0, 'Ana não vê repositórios, publicações nem código do William');
do $$ begin
  begin perform repositorio_segredo((select repo from alvo)); raise notice 'FALHA Ana viu o segredo';
  exception when raise_exception then raise notice 'OK    Ana não vê o segredo'; end;
  begin insert into publicacoes (no_id, versao) select projeto, 'x' from alvo; raise notice 'FALHA Ana registrou publicação no projeto do William';
  exception when insufficient_privilege then raise notice 'OK    Ana não registra publicação no projeto do William'; end;
end $$;
delete from repositorios;
reset role;
select pg_temp.ok((select count(*) from repositorios) = 2, 'Ana não apaga os repositórios do William');

-- excluir o repositório leva junto o código ligado; a publicação fica
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
delete from repositorios where provedor = 'gitlab';
reset role;
select pg_temp.ok((select count(*) from codigo_vinculos where repositorio_id = (select repo_gl from alvo)) = 0 and (select count(*) from publicacoes where id_externo = 'deploy:9') = 1, 'Excluir o repositório tira os links dele; o registro da publicação fica');
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name in ('repositorios','publicacoes','codigo_vinculos') and grantee = 'anon') = 0, 'nada para quem não está logado');
select pg_temp.ok((select count(*) from pg_proc where proname = 'git_receber') = 1, 'uma versão só de git_receber');
