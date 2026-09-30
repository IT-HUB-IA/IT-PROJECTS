-- SOMENTE TESTE LOCAL: partes 19 e 32 (contas conectadas, repositórios, código no item, status sozinho, publicações e notas de versão)
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
alter table alvo add column chave1 text, add column chave2 text, add column repo uuid, add column repo_gl uuid, add column con_gh uuid, add column con_gl uuid, add column espaco uuid;
update alvo set chave1 = (select chave from itens where id = item1), chave2 = (select chave from itens where id = item2),
                espaco = (select espaco_id from nos where id = projeto);
grant select, update on alvo to authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;   -- como no Supabase
select pg_temp.ok((select item1 is not null and item2 is not null from alvo), 'achou dois itens do projeto BL em A fazer (' || (select chave1 || ', ' || chave2 from alvo) || ')');

-- ---------- o app do CicloDev: só o dono do sistema configura ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
do $$ begin
  begin perform git_app_gravar('github', '{"app_id":"1","slug":"x","client_id":"c","client_secret":"s","webhook_secret":"w","pem":"-----BEGIN RSA PRIVATE KEY-----"}'); raise notice 'FALHA Ana configurou o app do GitHub';
  exception when others then raise notice 'OK    só o dono do sistema configura o app do GitHub'; end;
  begin perform git_estado_novo('github-app'); raise notice 'FALHA Ana começou a criar o app';
  exception when others then raise notice 'OK    só o dono do sistema cria o app'; end;
  begin perform git_app_ler('github'); raise notice 'FALHA pessoa logada leu os segredos do app';
  exception when insufficient_privilege then raise notice 'OK    pessoa logada não lê os segredos do app'; end;
end $$;
select pg_temp.ok(not (git_apps_status()#>>'{github,pronto}')::boolean, 'antes de criar, o GitHub aparece como não pronto');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
select pg_temp.ok(length(git_estado_novo('github-app')) = 48, 'William (dono do sistema) começa a criar o app');
select git_app_gravar('github', '{"app_id":"123","slug":"ciclodev-teste","client_id":"Iv1.abc","client_secret":"segredo-cliente","webhook_secret":"segredo-dos-avisos","pem":"-----BEGIN RSA PRIVATE KEY-----\nx\n-----END RSA PRIVATE KEY-----","nome":"CicloDev","html_url":"https://github.com/apps/ciclodev-teste","dono":"it-hub-ia","retorno":"https://ciclodev.it-ia.tec.br/entrar?git=github"}');
select git_app_gravar('gitlab', '{"client_id":"gl-id","client_secret":"gl-segredo","retorno":"https://ciclodev.it-ia.tec.br/entrar?git=gitlab"}');
select pg_temp.ok((git_apps_status()#>>'{github,slug}') = 'ciclodev-teste' and git_apps_status()::text !~ 'segredo', 'a tela vê o nome do app, nunca os segredos');
select pg_temp.ok((git_apps_status()#>>'{gitlab,base}') = 'https://gitlab.com', 'GitLab sem endereço usa o gitlab.com');
select git_app_gravar('gitlab', '{"client_id":"gl-id","client_secret":"","retorno":"https://ciclodev.it-ia.tec.br/entrar?git=gitlab"}');
reset role;
select pg_temp.ok((select dados->>'client_secret' from interno.git_apps where provedor = 'gitlab') = 'gl-segredo', 'mudar o GitLab sem digitar o segredo mantém o segredo');

-- ---------- o vai e volta da janelinha ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
create temp table est as select git_estado_novo('github') as e;
select pg_temp.ok((git_estado_usar((select e from est), 'github')->>'espaco_id')::uuid = (select espaco from alvo), 'o vai e volta devolve o espaço de quem começou');
do $$ begin
  begin perform git_estado_usar((select e from est), 'github'); raise notice 'FALHA o vai e volta valeu duas vezes';
  exception when insufficient_privilege then raise notice 'OK    o vai e volta vale uma vez só'; end;
end $$;
insert into est select git_estado_novo('gitlab');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
do $$ begin
  begin perform git_estado_usar((select e from est offset 1 limit 1), 'gitlab'); raise notice 'FALHA Ana usou o vai e volta do William';
  exception when insufficient_privilege then raise notice 'OK    Ana não usa o vai e volta do William'; end;
end $$;
reset role;

-- ---------- a função git-conectar grava as contas conectadas (instalação do app e OAuth do GitLab) ----------
set role service_role;
update alvo set con_gh = git_conexao_gravar((select espaco from alvo), 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'github', '9001', 'it-hub-ia', 'Organization', 'https://avatars.githubusercontent.com/u/1', 'https://github.com/organizations/it-hub-ia/settings/installations/9001'),
                con_gl = git_conexao_gravar((select espaco from alvo), 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'gitlab', '77', 'william', null, null, null, '{"acesso":"gl-acesso","renovacao":"gl-renova","expira_em":"2030-01-01T00:00:00Z"}');
select pg_temp.ok((git_conexao_ler((select con_gl from alvo))#>>'{tokens,acesso}') = 'gl-acesso', 'a chave do GitLab fica guardada para a função');
select pg_temp.ok(git_conexao_gravar((select espaco from alvo), 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'github', '9001', 'it-hub-ia', 'Organization', null, null) = (select con_gh from alvo), 'conectar a mesma conta de novo não duplica');
-- a função guarda só os repositórios que quem conectou pode acessar (ela pode ser só colaboradora do dono da instalação)
select git_conexao_repos((select con_gh from alvo), array['555', '556', 'lixo']);
select pg_temp.ok((select repos_permitidos from git_conexoes where id = (select con_gh from alvo)) @> array['555','556'] and not ((select repos_permitidos from git_conexoes where id = (select con_gh from alvo)) @> array['lixo']), 'a conta do GitHub guarda só os números dos repositórios que quem conectou pode acessar');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from git_conexoes) = 2, 'William vê as duas contas conectadas do espaço dele');
do $$ begin
  begin perform count(*) from interno.git_tokens; raise notice 'FALHA a tela leu as chaves';
  exception when insufficient_privilege then raise notice 'OK    a tela não lê as chaves das contas'; end;
  begin insert into repositorios (no_id, provedor, nome) select projeto, 'github', 'x/y' from alvo; raise notice 'FALHA a tela inseriu repositório direto';
  exception when insufficient_privilege then raise notice 'OK    repositório só entra pela conta conectada'; end;
  begin perform git_repo_ligar((select projeto from alvo), (select con_gh from alvo), 'abc', 'it-hub-ia/portal', null, 'main'); raise notice 'FALHA aceitou número de repositório inválido';
  exception when invalid_parameter_value then raise notice 'OK    número de repositório inválido é recusado'; end;
  begin perform git_repo_ligar((select projeto from alvo), (select con_gh from alvo), '557', 'outra-pessoa/privado', null, 'main'); raise notice 'FALHA ligou repositório a que quem conectou não tem acesso';
  exception when insufficient_privilege then raise notice 'OK    repositório da instalação a que quem conectou não tem acesso não liga'; end;
end $$;

-- ---------- William liga um repositório de cada conta ----------
update alvo set repo = (git_repo_ligar(projeto, con_gh, '555', 'it-hub-ia/portal', 'https://github.com/it-hub-ia/portal', 'main')).id,
                repo_gl = (git_repo_ligar(projeto, con_gl, '888', 'it-hub-ia/grupo/portal-app', 'https://gitlab.com/it-hub-ia/grupo/portal-app', 'main')).id;
select pg_temp.ok((select count(*) from repositorios where conexao_id is not null) = 2, 'William liga um repositório do GitHub e um do GitLab ao projeto');
select pg_temp.ok((git_repo_ligar((select projeto from alvo), (select con_gh from alvo), '555', 'it-hub-ia/portal', null, 'main')).id = (select repo from alvo), 'ligar o mesmo repositório de novo não duplica');
update repositorios set mover_status = mover_status where id = (select repo from alvo);
do $$ begin
  begin update repositorios set externo_id = '1' where id = (select repo from alvo); raise notice 'FALHA a tela trocou o número do repositório';
  exception when insufficient_privilege then raise notice 'OK    a tela só muda as opções do repositório'; end;
end $$;
reset role;
select pg_temp.ok((select count(*) from interno.repositorios_segredos where repositorio_id = (select repo_gl from alvo)) = 1
              and (select count(*) from interno.repositorios_segredos where repositorio_id = (select repo from alvo)) = 0, 'só o GitLab ganha segredo de aviso (o GitHub usa o do app)');

-- assinatura igual à do GitHub: HMAC SHA-256 do corpo com o segredo do app. Todo aviso traz a instalação e o repositório.
create or replace function pg_temp.gh(evento text, corpo jsonb) returns jsonb language sql as $$
  select public.git_receber_github(evento, 'sha256=' || encode(extensions.hmac(convert_to(c, 'UTF8'), convert_to('segredo-dos-avisos', 'UTF8'), 'sha256'), 'hex'), c)
    from (select (jsonb_build_object('installation', jsonb_build_object('id', 9001), 'repository', jsonb_build_object('id', 555, 'html_url', 'https://github.com/it-hub-ia/portal')) || corpo)::text as c) x $$;
create or replace function pg_temp.gl(evento text, corpo text) returns jsonb language sql as $$
  select public.git_receber_gitlab((select repo_gl from alvo), evento, public.git_repo_segredo((select repo_gl from alvo)), corpo) $$;

set role authenticated;
do $$ begin
  begin perform public.git_conexao_repos((select con_gh from alvo), array['1']); raise notice 'FALHA pessoa logada mudou a lista de repositórios da conta';
  exception when insufficient_privilege then raise notice 'OK    só a função muda a lista de repositórios da conta'; end;
end $$;
do $$ begin
  begin perform public.git_receber_github('ping', null, '{}'); raise notice 'FALHA pessoa logada chamou o recebedor de avisos';
  exception when insufficient_privilege then raise notice 'OK    só a função de avisos recebe os avisos'; end;
end $$;
reset role;
set role service_role;
select pg_temp.ok((pg_temp.gh('ping', '{"zen":"ok"}')->>'ok')::boolean, 'GitHub: o teste do app (ping) passa');
select pg_temp.ok(not (public.git_receber_github('push', 'sha256=errado', '{}')->>'ok')::boolean, 'assinatura errada é recusada');
select pg_temp.ok(not (public.git_receber_gitlab((select repo_gl from alvo), 'Push Hook', 'token-errado', '{}')->>'ok')::boolean, 'GitLab: segredo errado é recusado');
select pg_temp.ok((select ultimo_erro like 'Aviso recusado%' from repositorios where id = (select repo_gl from alvo)), 'e fica anotado no repositório, para aparecer na tela');
select pg_temp.ok((public.git_receber_github('push', 'sha256=' || encode(extensions.hmac(convert_to(c, 'UTF8'), convert_to('segredo-dos-avisos', 'UTF8'), 'sha256'), 'hex'), c)->>'repositorios')::int = 0, 'aviso de outra instalação não entra em nenhum repositório')
  from (select '{"installation":{"id":1},"repository":{"id":555},"ref":"refs/heads/x"}'::text as c) x;

-- branch com a chave do item: liga e anda para Em andamento
select pg_temp.gh('create', jsonb_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro', 'ref_type', 'branch', 'sender', jsonb_build_object('login', 'william')));
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item1 from alvo) and tipo = 'branch') = 1, 'branch com a chave (minúscula) liga ao item');
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'doing', 'item foi para Em andamento sozinho');

-- push com commits: um cita o item 2 na mensagem
select pg_temp.gh('push', jsonb_build_object('ref', 'refs/heads/' || lower((select chave1 from alvo)) || '-tela-de-cadastro',
  'commits', jsonb_build_array(
    jsonb_build_object('id', 'aaa111', 'message', 'Monta a tela' || E'\n\ndetalhes', 'url', 'https://github.com/it-hub-ia/portal/commit/aaa111', 'author', jsonb_build_object('name', 'William'), 'timestamp', '2026-09-29T10:00:00Z'),
    jsonb_build_object('id', 'bbb222', 'message', 'Corrige ' || (select chave2 from alvo) || ' também', 'url', 'https://github.com/it-hub-ia/portal/commit/bbb222', 'author', jsonb_build_object('name', 'William'), 'timestamp', '2026-09-29T10:05:00Z'))));
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item1 from alvo) and tipo = 'commit') = 2, 'os commits do branch ligam ao item 1');
select pg_temp.ok((select titulo from codigo_vinculos where ref = 'aaa111' and item_id = (select item1 from alvo)) = 'Monta a tela', 'guarda só a primeira linha da mensagem');
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item2 from alvo) and ref = 'bbb222') = 1 and pg_temp.grupo((select item2 from alvo)) = 'doing', 'commit que cita outro item liga e move ele também');
select pg_temp.gh('create', jsonb_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro', 'ref_type', 'branch'));
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item1 from alvo) and tipo = 'branch') = 1, 'aviso repetido não duplica');

-- pull request aberto: Em revisão; mesclado: Concluído
select pg_temp.gh('pull_request', jsonb_build_object('action', 'opened', 'pull_request', jsonb_build_object('number', 12, 'title', 'Tela de cadastro', 'html_url', 'https://github.com/it-hub-ia/portal/pull/12', 'state', 'open', 'merged', false,
  'head', jsonb_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro'), 'user', jsonb_build_object('login', 'william'))));
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'review' and (select estado from codigo_vinculos where tipo = 'pr' and item_id = (select item1 from alvo)) = 'aberto', 'PR aberto: item em revisão');
select pg_temp.gh('pull_request', jsonb_build_object('action', 'closed', 'pull_request', jsonb_build_object('number', 12, 'title', 'Tela de cadastro', 'html_url', 'https://github.com/it-hub-ia/portal/pull/12', 'state', 'closed', 'merged', true,
  'head', jsonb_build_object('ref', lower((select chave1 from alvo)) || '-tela-de-cadastro'))));
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'done' and (select estado from codigo_vinculos where tipo = 'pr' and item_id = (select item1 from alvo)) = 'mesclado', 'PR mesclado: item concluído');
select pg_temp.ok((select concluido_em is not null from itens where id = (select item1 from alvo)), 'o banco marcou a data de conclusão');
select pg_temp.gh('push', jsonb_build_object('ref', 'refs/heads/main', 'commits', jsonb_build_array(jsonb_build_object('id', 'ccc333', 'message', 'Ajuste ' || (select chave1 from alvo), 'timestamp', '2026-09-29T11:00:00Z'))));
select pg_temp.ok(pg_temp.grupo((select item1 from alvo)) = 'done', 'status só anda para a frente (commit depois não volta o item)');

-- versão, release e deployment
reset role;
insert into marcos (no_id, tipo, nome, data) select projeto, 'release', 'v1.2.0', current_date + 7 from alvo;
set role service_role;
select pg_temp.gh('release', jsonb_build_object('action', 'published', 'release', jsonb_build_object('id', 777, 'tag_name', '1.2.0', 'html_url', 'https://github.com/it-hub-ia/portal/releases/tag/1.2.0', 'published_at', '2026-09-29T12:00:00Z')));
select pg_temp.ok((select count(*) from publicacoes where origem = 'github' and versao = '1.2.0') = 1, 'release publicada vira publicação');
select pg_temp.ok((select entregue_em is not null from marcos where nome = 'v1.2.0'), 'e marca a versão v1.2.0 como entregue (1.2.0 = v1.2.0)');
select pg_temp.ok((select marco_id is not null from publicacoes where versao = '1.2.0'), 'a publicação fica ligada à versão');
select pg_temp.gh('deployment_status', jsonb_build_object('deployment', jsonb_build_object('id', 55, 'ref', 'main', 'sha', 'ddd444eee555', 'environment', 'Preview'),
  'deployment_status', jsonb_build_object('state', 'in_progress', 'environment', 'Preview')));
select pg_temp.gh('deployment_status', jsonb_build_object('deployment', jsonb_build_object('id', 55, 'ref', 'main', 'sha', 'ddd444eee555', 'environment', 'Preview'),
  'deployment_status', jsonb_build_object('state', 'success', 'environment', 'Preview', 'environment_url', 'https://portal-previa.vercel.app')));
select pg_temp.ok((select count(*) from publicacoes where id_externo = 'deploy:55') = 1 and (select status || '|' || ambiente from publicacoes where id_externo = 'deploy:55') = 'sucesso|previa',
  'deployment: em andamento e depois sucesso ficam num registro só, no ambiente Prévia');
-- em produção, pede os desenhos do código daquele commit (parte 30)
select pg_temp.gh('deployment_status', jsonb_build_object('deployment', jsonb_build_object('id', 56, 'ref', 'main', 'sha', 'eee555', 'environment', 'Production'),
  'deployment_status', jsonb_build_object('state', 'success', 'environment', 'Production')));
select pg_temp.ok((select count(*) from infra_automacoes where origem = 'github' and repositorio_id = (select repo from alvo) and referencia = 'eee555') = 1, 'publicação em produção pede os desenhos do código');

-- GitLab: push, merge request e deployment
select pg_temp.gl('Push Hook', json_build_object('ref', 'refs/heads/feature/' || (select chave2 from alvo), 'after', 'fff666', 'project', json_build_object('web_url', 'https://gitlab.com/it-hub-ia/grupo/portal-app'), 'user_username', 'william',
  'commits', json_build_array(json_build_object('id', 'fff666', 'message', 'Começa', 'url', 'https://gitlab.com/x/-/commit/fff666', 'author', json_build_object('name', 'William'), 'timestamp', '2026-09-29T13:00:00+00:00')))::text);
select pg_temp.ok((select count(*) from codigo_vinculos where item_id = (select item2 from alvo) and repositorio_id = (select repo_gl from alvo) and tipo in ('branch','commit')) = 2, 'GitLab: branch e commit ligam ao item 2');
select pg_temp.gl('Merge Request Hook', json_build_object('object_attributes', json_build_object('iid', 3, 'title', 'Ajustes', 'url', 'https://gitlab.com/x/-/merge_requests/3', 'state', 'merged', 'source_branch', 'feature/' || (select chave2 from alvo)), 'user', json_build_object('username', 'william'))::text);
select pg_temp.ok(pg_temp.grupo((select item2 from alvo)) = 'done', 'GitLab: merge request mesclado conclui o item');
select pg_temp.gl('Deployment Hook', json_build_object('deployment_id', 9, 'status', 'success', 'environment', 'production', 'sha', 'fff666', 'ref', 'v1.3.0', 'environment_external_url', 'https://portal.it-ia.tec.br')::text);
select pg_temp.ok((select ambiente || '|' || status || '|' || origem from publicacoes where id_externo = 'deploy:9') = 'producao|sucesso|gitlab', 'GitLab: deployment em produção registrado');
select pg_temp.ok((select count(*) from infra_automacoes where origem = 'gitlab' and repositorio_id = (select repo_gl from alvo)) = 1, 'GitLab em produção também pede os desenhos do código');
select pg_temp.ok((select ultimo_evento = 'Deployment Hook' and ultimo_erro is null from repositorios where id = (select repo_gl from alvo)), 'o repositório guarda o último aviso recebido');
select pg_temp.ok((select jsonb_path_exists(infra_auto_proximos(10), '$[*].repositorios[*] ? (@.conexao_id != null && @.externo_id == "888")')), 'a fila dos desenhos leva a conta e o número do repositório');
-- trocar o nome é só trocar o nome: o repositório renomeado no GitHub/GitLab acompanha sozinho, sem perder nada
select pg_temp.gh('push', jsonb_build_object('ref', 'refs/heads/main', 'commits', '[]'::jsonb, 'repository', jsonb_build_object('id', 555, 'full_name', 'it-hub-ia/portal-novo', 'html_url', 'https://github.com/it-hub-ia/portal-novo')));
select pg_temp.ok((select nome || '|' || url from repositorios where id = (select repo from alvo)) = 'it-hub-ia/portal-novo|https://github.com/it-hub-ia/portal-novo', 'GitHub: repositório renomeado muda o nome e o endereço no CicloDev sozinho');
select pg_temp.ok((select count(*) from codigo_vinculos where repositorio_id = (select repo from alvo)) > 0 and (select ativo from repositorios where id = (select repo from alvo)), 'e continua com todo o código ligado e ativo');
select pg_temp.gh('push', jsonb_build_object('ref', 'refs/heads/main', 'commits', '[]'::jsonb, 'repository', jsonb_build_object('id', 555, 'full_name', 'nome inválido', 'html_url', 'javascript:x')));
select pg_temp.ok((select nome from repositorios where id = (select repo from alvo)) = 'it-hub-ia/portal-novo', 'nome estranho no aviso não troca o nome (e o aviso não quebra)');
select pg_temp.gl('Push Hook', json_build_object('ref', 'refs/heads/main', 'after', 'aaa000', 'project', json_build_object('id', 888, 'path_with_namespace', 'it-hub-ia/grupo/app-novo', 'web_url', 'https://gitlab.com/it-hub-ia/grupo/app-novo'), 'commits', '[]'::json)::text);
select pg_temp.ok((select nome from repositorios where id = (select repo_gl from alvo)) = 'it-hub-ia/grupo/app-novo', 'GitLab: projeto renomeado também acompanha');
select pg_temp.gl('Push Hook', json_build_object('ref', 'refs/heads/main', 'after', 'aaa001', 'project', json_build_object('id', 999, 'path_with_namespace', 'outro/projeto'), 'commits', '[]'::json)::text);
select pg_temp.ok((select nome from repositorios where id = (select repo_gl from alvo)) = 'it-hub-ia/grupo/app-novo', 'aviso com outro número de projeto não troca o nome');
-- a versão publicada é procurada só no lugar do repositório: um repositório ligado a um app não marca a versão de outro app
reset role;
create temp table apps_t as select n.id, row_number() over (order by n.id) k from nos n join nos_ancestrais a on a.no_id = n.id
  where n.tipo = 'aplicacao' and a.ancestral_id = (select projeto from alvo) and a.no_id <> a.ancestral_id;
grant select on apps_t to authenticated, service_role;
insert into marcos (no_id, tipo, nome, data) select id, 'release', 'v9.9.0', current_date from apps_t where k = 2;
insert into marcos (no_id, tipo, nome, data) select id, 'release', 'v9.9.1', current_date from apps_t where k = 1;
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
select (git_repo_ligar((select id from apps_t where k = 1), (select con_gh from alvo), '556', 'it-hub-ia/app-um', 'https://github.com/it-hub-ia/app-um', 'main')).id is not null;
reset role;
set role service_role;
select pg_temp.gh('release', jsonb_build_object('action', 'published', 'repository', jsonb_build_object('id', 556, 'html_url', 'https://github.com/it-hub-ia/app-um'), 'release', jsonb_build_object('id', 778, 'tag_name', 'v9.9.0', 'html_url', 'https://github.com/it-hub-ia/app-um/releases/tag/v9.9.0', 'published_at', '2026-09-29T13:00:00Z')));
select pg_temp.ok((select entregue_em is null from marcos where nome = 'v9.9.0') and (select count(*) from publicacoes where versao = 'v9.9.0' and marco_id is null) = 1, 'release do repositório de um app não marca a versão com o mesmo nome de outro app do projeto');
select pg_temp.gh('release', jsonb_build_object('action', 'published', 'repository', jsonb_build_object('id', 556, 'html_url', 'https://github.com/it-hub-ia/app-um'), 'release', jsonb_build_object('id', 779, 'tag_name', 'v9.9.1', 'html_url', 'https://github.com/it-hub-ia/app-um/releases/tag/v9.9.1', 'published_at', '2026-09-29T14:00:00Z')));
select pg_temp.ok((select entregue_em is not null from marcos where nome = 'v9.9.1'), 'e marca a versão do próprio app');
reset role;
delete from repositorios where externo_id = '556';
set role service_role;
reset role;
update infra_automacoes set status = 'pronto';

-- repositório com "mudar status" desligado só liga, não mexe no status
update repositorios set mover_status = false where id = (select repo from alvo);
update itens set status_id = (select id from status_fluxo where no_id is null and chave = 'todo') where id = (select item2 from alvo);
set role service_role;
select pg_temp.gh('create', jsonb_build_object('ref', (select chave2 from alvo) || '-outro', 'ref_type', 'branch'));
select pg_temp.ok(pg_temp.grupo((select item2 from alvo)) = 'todo' and (select count(*) from codigo_vinculos where ref = (select chave2 from alvo) || '-outro') = 1, 'com "mudar status" desligado, só liga o branch');

-- a empresa tira o repositório do app, depois devolve; depois suspende e volta o app
select pg_temp.gh('installation_repositories', '{"action":"removed","repositories_removed":[{"id":555}]}');
select pg_temp.ok((select not ativo and ultimo_erro like 'Conta sem acesso%' from repositorios where id = (select repo from alvo)), 'repositório tirado do app no GitHub para e mostra o motivo');
select pg_temp.gh('installation_repositories', '{"action":"added","repositories_added":[{"id":555}]}');
select pg_temp.ok((select ativo and ultimo_erro is null from repositorios where id = (select repo from alvo)), 'devolvido ao app, volta sozinho');
select pg_temp.gh('installation', '{"action":"suspend"}');
select pg_temp.ok((select not ativo from repositorios where id = (select repo from alvo)) and (select ultimo_erro like 'Conta suspensa%' from git_conexoes where id = (select con_gh from alvo)), 'app suspenso: a conta e os repositórios param');
select pg_temp.gh('installation', '{"action":"unsuspend"}');
select pg_temp.ok((select ativo from repositorios where id = (select repo from alvo)), 'app de volta: os repositórios voltam');
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
do $$ begin
  begin perform git_conexao_remover((select con_gh from alvo)); raise notice 'FALHA tirou a conta com repositório ligado';
  exception when foreign_key_violation then raise notice 'OK    tirar a conta pede para desligar os repositórios antes'; end;
end $$;
reset role;

-- ---------- Ana (outro espaço) ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from repositorios) = 0 and (select count(*) from publicacoes) = 0 and (select count(*) from codigo_vinculos) = 0, 'Ana não vê repositórios, publicações nem código do William');
select pg_temp.ok((select count(*) from git_conexoes) = 0, 'Ana não vê as contas conectadas do William');
do $$ begin
  begin perform git_repo_ligar((select projeto from alvo), (select con_gh from alvo), '555', 'x/y', null, 'main'); raise notice 'FALHA Ana ligou repositório no projeto do William';
  exception when insufficient_privilege then raise notice 'OK    Ana não liga repositório no projeto do William'; end;
  begin perform git_conexao_remover((select con_gh from alvo)); raise notice 'FALHA Ana tirou a conta do William';
  exception when insufficient_privilege then raise notice 'OK    Ana não tira a conta do William'; end;
  begin insert into publicacoes (no_id, versao) select projeto, 'x' from alvo; raise notice 'FALHA Ana registrou publicação no projeto do William';
  exception when insufficient_privilege then raise notice 'OK    Ana não registra publicação no projeto do William'; end;
end $$;
delete from repositorios;
reset role;
select pg_temp.ok((select count(*) from repositorios) = 2, 'Ana não apaga os repositórios do William');

-- excluir o repositório leva junto o código ligado; a publicação fica; sem repositório, a conta sai
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
delete from repositorios where provedor = 'gitlab';
select git_conexao_remover((select con_gl from alvo));
reset role;
select pg_temp.ok((select count(*) from codigo_vinculos where repositorio_id = (select repo_gl from alvo)) = 0 and (select count(*) from publicacoes where id_externo = 'deploy:9') = 1, 'Excluir o repositório tira os links dele; o registro da publicação fica');
select pg_temp.ok((select count(*) from git_conexoes where id = (select con_gl from alvo)) = 0 and (select count(*) from interno.git_tokens where conexao_id = (select con_gl from alvo)) = 0, 'sem repositório ligado, a conta sai com as chaves dela');
-- o app removido no GitHub: a conta fica marcada e os repositórios param
set role service_role;
select pg_temp.gh('installation', '{"action":"deleted"}');
reset role;
select pg_temp.ok((select removida_em is not null from git_conexoes where id = (select con_gh from alvo)) and (select not ativo from repositorios where id = (select repo from alvo)), 'app removido no GitHub: a conta sai e os repositórios param');
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name in ('repositorios','publicacoes','codigo_vinculos','git_conexoes') and grantee = 'anon') = 0, 'nada para quem não está logado');
select pg_temp.ok((select count(*) from pg_proc where proname in ('git_receber','repositorio_segredo')) = 0, 'o jeito antigo (segredo na tela e git_receber) saiu');
select pg_temp.ok((select max(n) from (select count(*) n from pg_proc where proname like 'git\_%' group by proname) x) = 1, 'uma versão só de cada função git_');
