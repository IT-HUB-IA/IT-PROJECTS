-- SOMENTE TESTE LOCAL: parte 30 (Infraestrutura automática), com as contas conectadas da parte 32. Roda depois das partes 00 a 20, 22, 23, 25, 26, 28, 29, 30, 32 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t as select
  (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') as app,
  (select interno.infra_no_de(id) from nos where nome = 'Java BL' and tipo = 'aplicacao') as prod,
  (select id from nos where nome = 'BL' and tipo = 'projeto') as pj,
  (select id from nos where tipo = 'produto' and nome = 'YOU Contabilidade') as outro,
  null::uuid as repo_app, null::uuid as repo_prod, null::uuid as repo_pj, null::uuid as repo_gl, null::uuid as d1, null::uuid as d2;
grant all on t to authenticated, service_role;
select pg_temp.ok((select prod from t) is not null and (select tipo from nos where id = (select prod from t)) = 'produto', 'a aplicação Java BL fica dentro de um produto');

-- ---------- repositórios: um no produto, um numa aplicação do produto, um no projeto, um do GitLab ----------
with x as (insert into repositorios (no_id, provedor, nome) select prod, 'github', 'it-hub/bl-produto' from t returning id) update t set repo_prod = (select id from x);
with x as (insert into repositorios (no_id, provedor, nome) select app, 'github', 'it-hub/bl-java' from t returning id) update t set repo_app = (select id from x);
with x as (insert into repositorios (no_id, provedor, nome) select pj, 'github', 'it-hub/bl-projeto' from t returning id) update t set repo_pj = (select id from x);
with x as (insert into repositorios (no_id, provedor, nome) select prod, 'gitlab', 'it-hub/bl-gitlab' from t returning id) update t set repo_gl = (select id from x);
-- os repositórios entram pela conta conectada do espaço (parte 32); um sem conta conectada não pede desenho
insert into git_conexoes (espaco_id, provedor, externo_id, conta) select espaco_id, 'github', '1', 'it-hub' from nos where id = (select prod from t);
insert into git_conexoes (espaco_id, provedor, externo_id, conta) select espaco_id, 'gitlab', '2', 'it-hub' from nos where id = (select prod from t);
update repositorios r set conexao_id = c.id from git_conexoes c where c.provedor = r.provedor and r.id in (select repo_app from t union select repo_prod from t union select repo_pj from t union select repo_gl from t);
insert into repositorios (no_id, provedor, nome) select prod, 'github', 'it-hub/sem-conta' from t;
insert into publicacoes (no_id, repositorio_id, ambiente, status, origem, referencia, id_externo) select prod, (select id from repositorios where nome = 'it-hub/sem-conta'), 'producao', 'sucesso', 'github', 's1', 'deploy:9' from t;
select pg_temp.ok((select count(*) from infra_automacoes) = 0, 'repositório sem conta conectada não pede desenho');

-- ---------- publicação em produção pede os desenhos do código ----------
insert into publicacoes (no_id, repositorio_id, versao, ambiente, status, origem, referencia, id_externo) select app, repo_app, '1.0', 'producao', 'sucesso', 'github', 'abc123', 'deploy:1' from t;
select pg_temp.ok((select count(*) from infra_automacoes) = 2, 'publicação em produção de um app põe dois pedidos na fila (o app e o produto dele)');
select pg_temp.ok((select count(*) = 2 and bool_and(origem = 'github' and referencia = 'abc123' and repositorio_id = (select repo_app from t) and status = 'pendente') and bool_or(no_id = (select app from t)) and bool_or(no_id = (select prod from t)) from infra_automacoes), 'publicar pede os desenhos da aplicação dona do repositório e do produto em que ela está, com o commit publicado');
update publicacoes set status = 'sucesso', url = 'https://x.com' where id_externo = 'deploy:1';
select pg_temp.ok((select count(*) from infra_automacoes) = 2, 'o mesmo aviso de novo não repete os pedidos');
insert into publicacoes (no_id, repositorio_id, ambiente, status, origem, referencia, id_externo) select prod, repo_prod, 'previa', 'sucesso', 'github', 'p1', 'deploy:2' from t;
insert into publicacoes (no_id, repositorio_id, ambiente, status, origem, referencia, id_externo) select prod, repo_prod, 'producao', 'falha', 'github', 'f1', 'deploy:3' from t;
insert into publicacoes (no_id, repositorio_id, ambiente, status, origem, referencia, id_externo) select prod, repo_gl, 'producao', 'sucesso', 'gitlab', 'g1', 'deploy:4' from t;
insert into publicacoes (no_id, ambiente, status, origem, versao) select prod, 'producao', 'sucesso', 'manual', '2.0' from t;
select pg_temp.ok((select count(*) from infra_automacoes) = 3 and (select count(*) from infra_automacoes where origem = 'gitlab' and referencia = 'g1') = 1, 'prévia, falha e publicação manual não pedem desenho do código; o GitLab pede');
update publicacoes set status = 'sucesso' where id_externo = 'deploy:3';
select pg_temp.ok((select count(*) from infra_automacoes where referencia = 'f1') = 1, 'a falha que virou sucesso pede');
insert into publicacoes (no_id, repositorio_id, ambiente, status, origem, referencia, id_externo) select pj, repo_pj, 'producao', 'sucesso', 'github', 'pj1', 'deploy:5' from t;
select pg_temp.ok((select no_id from infra_automacoes where referencia = 'pj1') = (select pj from t), 'repositório ligado ao projeto pede os desenhos do projeto, não dos produtos');

-- ---------- a tela: Atualizar agora e ligar o banco ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select (infra_auto_pedir((select prod from t))).origem) = 'manual', 'William pede "Atualizar agora" no produto');
select pg_temp.ok((select count(*) from infra_automacoes where origem = 'manual') = 1, 'e pedir de novo antes de rodar não duplica') from (select infra_auto_pedir((select prod from t))) x;
do $$ begin insert into infra_automacoes (no_id, origem) select prod, 'manual' from t; raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém põe pedido direto na fila pela tela');
do $$ begin perform infra_banco_definir((select prod from t), 'Produção', '{public}', 'mysql://x'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'endereço que não é postgresql:// é recusado');
do $$ begin perform infra_banco_definir((select prod from t), 'Produção', '{public}'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'ligar pela primeira vez sem endereço é recusado');
do $$ begin perform infra_banco_definir((select prod from t), 'Produção', '{"public; drop"}', 'postgresql://leitor:x@db:5432/postgres'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'nome de esquema estranho é recusado');
select pg_temp.ok((select (infra_banco_definir((select prod from t), 'Produção', '{public, app}', 'postgresql://leitor:segredo@db.exemplo:5432/postgres')).esquemas) = '{app,public}', 'William liga o banco do produto');
select pg_temp.ok((select count(*) from infra_bancos) = 1 and (select nome from infra_bancos) = 'Produção', 'e vê que está ligado');
do $$ begin perform * from interno.infra_bancos_conexao; raise exception 'leu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'mas não lê o endereço guardado (a senha)');
select pg_temp.ok((select row_to_json(b)::text !~ 'segredo' from infra_bancos b), 'e o endereço não aparece em infra_bancos');
select pg_temp.ok((select (infra_banco_definir((select prod from t), 'Produção principal', '{public}', null)).nome) = 'Produção principal', 'trocar o nome sem mandar o endereço mantém o endereço');
reset role;
select pg_temp.ok((select conexao from interno.infra_bancos_conexao) = 'postgresql://leitor:segredo@db.exemplo:5432/postgres', 'o endereço continua o mesmo');

-- stakeholder e gente de fora
select pg_temp.como('00000000-0000-0000-0000-00000000000c'); set role authenticated;
select pg_temp.ok((select count(*) from infra_automacoes) > 0, 'o stakeholder vê a fila do que enxerga');
select pg_temp.ok((select count(*) from infra_bancos) = 0, 'mas não vê qual banco está ligado');
do $$ begin perform infra_auto_pedir((select prod from t)); raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'e não pede "Atualizar agora"');
do $$ begin perform infra_banco_definir((select prod from t), 'x', '{public}', 'postgresql://a'); raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'nem liga banco');
do $$ begin perform infra_auto_proximos(1); raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém logado chama as funções da fila');
reset role;
insert into pessoas (auth_user_id, nome, email, papel, ativo) values ('00000000-0000-0000-0000-0000000000ff', 'Pessoa de fora', 'fora@teste', 'dev', true);
select pg_temp.como('00000000-0000-0000-0000-0000000000ff'); set role authenticated;
select pg_temp.ok((select count(*) from infra_automacoes) = 0 and (select count(*) from infra_bancos) = 0, 'quem não enxerga o produto não vê fila nem banco');
do $$ begin perform infra_auto_pedir((select prod from t)); raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'e não pede nada');
reset role;

-- ---------- a função (service_role) ----------
set role service_role;
create temp table f as select infra_auto_proximos(10) as j;
select pg_temp.ok((select jsonb_array_length(j) from f) = 6, 'a função pega os 6 pedidos da fila');
select pg_temp.ok((select count(*) from infra_automacoes where status = 'rodando') = 6, 'e eles ficam rodando');
select pg_temp.ok((select jsonb_array_length(infra_auto_proximos(10))) = 0, 'chamar de novo não pega os mesmos');
select pg_temp.ok((select count(*) = 2 and bool_and((x->'repositorios'->0->>'nome') = 'it-hub/bl-java' and jsonb_array_length(x->'repositorios') = 1 and x->'banco' = 'null')
                     from f, jsonb_array_elements(j) x where x->>'referencia' = 'abc123'), 'pedidos da publicação (app e produto): só o repositório que publicou, sem banco');
select pg_temp.ok((select (select string_agg(r->>'nome', ',' order by r->>'nome') from jsonb_array_elements(x->'repositorios') r) = 'it-hub/bl-gitlab,it-hub/bl-java,it-hub/bl-produto'
                     and x->'banco'->>'conexao' like 'postgresql://%'
                     from f, jsonb_array_elements(j) x where x->>'origem' = 'manual'), '"Atualizar agora" do produto: os repositórios do produto e das aplicações dele (não o do projeto) e o banco');
reset role;
update infra_automacoes set iniciado_em = now() - interval '20 minutes' where referencia = 'pj1';
set role service_role;
select pg_temp.ok((select jsonb_array_length(infra_auto_proximos(10))) = 1, 'pedido parado há mais de 15 minutos volta para a fila');

-- gravar desenho automático
create temp table g as select infra_auto_gravar((select prod from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', 'plantuml', '@startuml\n[a]\n@enduml', 'github', 'abc123') as j;
update t set d1 = (select (j->>'id')::uuid from g);
select pg_temp.ok((select j->>'renderizar' = 'true' and j->>'novo' = 'true' from g), 'o desenho automático nasce e pede a imagem');
select pg_temp.ok((select origem = 'github' and referencia = 'abc123' and versao = 1 and criado_por is null from infra_diagramas where id = (select d1 from t)), 'com a origem e o commit');
select pg_temp.ok((select (infra_auto_gravar((select prod from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', 'plantuml', '@startuml\n[a]\n@enduml', 'github', 'abc124'))->>'id') = (select d1::text from t), 'a próxima rodada atualiza o mesmo desenho (não cria outro)');
select infra_auto_imagem((select d1 from t), '<svg/>');
select pg_temp.ok((select (infra_auto_gravar((select prod from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', 'plantuml', '@startuml\n[a]\n@enduml', 'github', 'abc125'))->>'renderizar') = 'false', 'código igual: não sobe versão nem gera imagem de novo');
select pg_temp.ok((select versao = 1 and svg = '<svg/>' from infra_diagramas where id = (select d1 from t)), 'a versão e a imagem continuam');
select pg_temp.ok((select (infra_auto_gravar((select prod from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', 'plantuml', '@startuml\n[a]-->[b]\n@enduml', 'github', 'abc126'))->>'renderizar') = 'true', 'código mudou: pede a imagem de novo');
select pg_temp.ok((select versao = 2 and svg is null from infra_diagramas where id = (select d1 from t)), 'sobe a versão e a imagem antiga deixa de valer');
select pg_temp.ok((select count(*) from infra_diagramas_versoes where diagrama_id = (select d1 from t)) = 1, 'e a versão anterior fica guardada');
update t set d2 = (select (infra_auto_gravar((select prod from t), 'infra', 'github:it-hub/bl-java:infra', 'Infraestrutura · it-hub/bl-java', 'graphviz', 'digraph{}', 'github', 'abc126')->>'id')::uuid);
do $$ begin perform infra_auto_gravar((select prod from t), 'software', '', 'x', 'plantuml', 'x', 'github', 'x'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'desenho automático sem chave é recusado');
reset role;
-- um desenho feito à mão no mesmo produto
insert into infra_diagramas (no_id, aba, nome, formato, fonte) select prod, 'software', 'Feito à mão', 'plantuml', '@startuml\n@enduml' from t;
set role service_role;
select infra_auto_concluir((select id from infra_automacoes where referencia = 'abc123' and no_id = (select prod from t)), 'pronto', null, array[(select d1 from t)], '[{"aba":"software"}]', array['github:it-hub/bl-java:']);
select pg_temp.ok((select status = 'pronto' and diagramas = array[(select d1 from t)] from infra_automacoes where referencia = 'abc123' and no_id = (select prod from t)), 'o pedido fecha com os desenhos que saíram');
select pg_temp.ok((select arquivado_em is not null from infra_diagramas where id = (select d2 from t)), 'o desenho automático da mesma família que não saiu desta vez é arquivado');
select pg_temp.ok((select arquivado_em is null from infra_diagramas where nome = 'Feito à mão'), 'o desenho feito à mão nunca é arquivado pelo automático');
select pg_temp.ok((select arquivado_em is null from infra_diagramas where id = (select d1 from t)), 'e o que saiu continua');

-- banco: leitura de hora em hora
select pg_temp.ok((select jsonb_array_length(infra_auto_bancos_devidos(5))) = 1, 'banco nunca lido está na hora de ler');
select pg_temp.ok((select infra_auto_banco_lido((select prod from t), 'h1')) is not null, 'primeira leitura abre um pedido de banco');
select pg_temp.ok((select status = 'rodando' and origem = 'banco' from infra_automacoes where referencia = 'h1'), 'já rodando');
select pg_temp.ok((select infra_auto_banco_lido((select prod from t), 'h1')) is null, 'estrutura igual: não pede nada');
select pg_temp.ok((select jsonb_array_length(infra_auto_bancos_devidos(5))) = 0, 'e só lê de novo daqui a uma hora');
select pg_temp.ok((select infra_auto_banco_lido((select prod from t), 'h2')) is not null, 'estrutura mudou: pede');
select pg_temp.ok((select infra_auto_banco_lido((select prod from t), 'h3', null, false)) is null, 'dentro do "Atualizar agora" a estrutura nova não abre outro pedido');
select pg_temp.ok((select ultimo_hash from infra_bancos) = 'h3', 'só guarda o resumo novo');
select infra_auto_banco_lido((select prod from t), null, 'senha errada');
select pg_temp.ok((select ultimo_erro = 'senha errada' and ultimo_hash = 'h3' from infra_bancos), 'erro de leitura fica guardado sem perder o último resumo');
reset role;

-- o quadro do desenho no canvas
set role service_role;
select pg_temp.ok((select infra_auto_quadro((select prod from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', '{"nodes":[{"id":"n1","tipo":"modulo","x":0,"y":0,"w":260}],"edges":[]}', (select d1 from t))) ~ '^quadros/auto[0-9a-f]{16}$', 'a função publica o quadro do desenho');
reset role;
select pg_temp.ok((select jsonb_array_length(dados -> 'nodes') = 1 and dados ->> 'pai' = 'raiz' and dados ->> 'nome' = 'Software · it-hub/bl-java' from infra_canvas where caminho like 'quadros/auto%'), 'o quadro fica no canvas da sub-aba, dentro do quadro principal');
select pg_temp.ok((select jsonb_array_length(dados -> 'nodes') = 1 and dados -> 'nodes' -> 0 ->> 'tipo' = 'quadro' from infra_canvas where caminho = 'quadros/raiz' and aba = 'software'), 'o quadro principal ganha o card que abre o quadro do desenho');
select pg_temp.ok((select quadro from infra_diagramas where id = (select d1 from t)) = (select caminho from infra_canvas where caminho like 'quadros/auto%'), 'o desenho sabe em qual quadro está');
set role service_role;
select infra_auto_quadro((select prod from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', '{"nodes":[{"id":"n1","tipo":"modulo","x":40,"y":0,"w":260},{"id":"n2","tipo":"modulo","x":400,"y":0,"w":260}],"edges":[]}', (select d1 from t));
select pg_temp.ok((select jsonb_array_length(infra_auto_quadro_ler((select prod from t), 'software', 'github:it-hub/bl-java:software') -> 'nodes')) = 2, 'publicar de novo atualiza o mesmo quadro (e a função lê o que já tinha)');
reset role;
select pg_temp.ok((select jsonb_array_length(dados -> 'nodes') from infra_canvas where caminho = 'quadros/raiz' and aba = 'software') = 1, 'e o card do quadro principal não se repete');
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select infra_quadro_publicar((select prod from t), 'dominio', 'devit:x', 'Domínio', '{"nodes":[],"edges":[]}')) like 'quadros/auto%', 'quem pode editar publica o quadro do DevIT');
do $$ begin perform infra_auto_quadro((select prod from t), 'software', 'x', 'x', '{"nodes":[],"edges":[]}'); raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'mas não chama a função do robô');
do $$ begin perform infra_quadro_publicar((select prod from t), 'dominio', 'devit:y', 'x', '{"nodes":"x","edges":[]}'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'documento de quadro inválido é recusado');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000c'); set role authenticated;
do $$ begin perform infra_quadro_publicar((select prod from t), 'dominio', 'devit:z', 'x', '{"nodes":[],"edges":[]}'); raise exception 'aceitou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'o stakeholder não publica quadro');
reset role;

-- a aplicação tem a própria Infraestrutura: desenhos só do código ligado a ela
reset role;
update infra_automacoes set status = 'pronto' where status in ('pendente','rodando');
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select (infra_auto_pedir((select app from t))).origem) = 'manual', 'William pede "Atualizar agora" no app');
reset role;
set role service_role;
select pg_temp.ok((select string_agg(r->>'nome', ',') = 'it-hub/bl-java' from jsonb_array_elements(infra_auto_proximos(10)) x, jsonb_array_elements(x->'repositorios') r where x->>'no_id' = (select app::text from t)), '"Atualizar agora" do app: só o repositório do app (nem o do produto, nem o do GitLab do produto)');
select pg_temp.ok((select (infra_auto_gravar((select app from t), 'software', 'github:it-hub/bl-java:software', 'Software · it-hub/bl-java', 'plantuml', '@startuml\n[a]\n@enduml', 'github', 'abc200'))->>'novo') = 'true', 'o desenho automático do app fica no app');
reset role;
select pg_temp.ok((select count(*) from infra_diagramas where no_id = (select app from t)) = 1 and (select count(*) from infra_diagramas where no_id = (select prod from t) and nome = 'Software · it-hub/bl-java') = 1, 'e o do produto continua separado');
do $$ begin insert into infra_diagramas (no_id, aba, nome, formato, fonte) select id, 'software', 'x', 'plantuml', 'x' from nos where tipo = 'frente' limit 1; raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'frente (parte de um app) continua sem Infraestrutura própria');

-- desligar o banco
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select infra_banco_remover((select prod from t));
reset role;
select pg_temp.ok((select count(*) from infra_bancos) = 0 and (select count(*) from interno.infra_bancos_conexao) = 0, 'desligar tira o endereço guardado');
select pg_temp.ok((select count(*) from infra_diagramas where id = (select d1 from t)) = 1, 'e os desenhos que já saíram ficam');

-- permissões conferidas no catálogo
select pg_temp.ok(not has_table_privilege('authenticated', 'interno.infra_bancos_conexao', 'select') and not has_table_privilege('anon', 'public.infra_automacoes', 'select')
   and has_table_privilege('authenticated', 'public.infra_automacoes', 'select') and not has_table_privilege('authenticated', 'public.infra_automacoes', 'insert')
   and not has_table_privilege('authenticated', 'public.infra_bancos', 'insert')
   and not has_function_privilege('authenticated', 'public.infra_auto_gravar(uuid, text, text, text, text, text, text, text, jsonb, jsonb)', 'execute')
   and not has_function_privilege('anon', 'public.infra_auto_pedir(uuid)', 'execute')
   and has_function_privilege('service_role', 'public.infra_auto_concluir(uuid, text, text, uuid[], jsonb, text[])', 'execute'), 'permissões: a tela só lê e chama as 3 funções dela; a fila é da função');
select pg_temp.ok((select count(*) from pg_proc where proname in ('infra_banco_definir','infra_auto_pedir','infra_auto_proximos','infra_auto_gravar','infra_auto_concluir','infra_auto_banco_lido','infra_auto_quadro','infra_quadro_publicar','infra_quadro_gravar')) = 9, 'uma versão só de cada função');
