-- SOMENTE TESTE LOCAL: parte 34 (ficha técnica automática e push no branch principal). Roda depois das partes 00 a 34 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t as select
  (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') as app,
  (select interno.infra_no_de(id) from nos where nome = 'Java BL' and tipo = 'aplicacao') as prod,
  null::uuid as repo, null::uuid as banco;
grant all on t to authenticated, service_role;
insert into git_conexoes (espaco_id, provedor, externo_id, conta) select espaco_id, 'github', '77', 'blanco' from nos where id = (select app from t);
with x as (insert into repositorios (no_id, provedor, nome, conexao_id, externo_id, branch_principal)
  select app, 'github', 'blanco/bl', (select id from git_conexoes where externo_id = '77'), '555', 'main' from t returning id) update t set repo = (select id from x);
with x as (insert into infra_bancos (no_id, nome, provedor, motor, esquemas) select app, 'Produção', 'supabase', 'postgres', '{public}' from t returning id) update t set banco = (select id from x);

-- ---------- quem grava: só a função (service_role) ----------
set role authenticated;
do $$ begin perform public.infra_ficha_gravar((select app from t), (select repo from t), null, 'x', 'y', '[]'); raise notice 'FALHA pessoa logada gravou na ficha automática';
exception when insufficient_privilege then raise notice 'OK    pessoa logada não grava na ficha automática (só a função)'; end $$;
do $$ begin insert into ficha_auto (no_id, origem, repositorio_id, fonte, secao, campo, valor) values ((select app from t), 'repo:' || (select repo from t), (select repo from t), 'codigo', 'Stack', 'Frameworks', 'x'); raise notice 'FALHA pessoa logada inseriu direto';
exception when insufficient_privilege then raise notice 'OK    e nem direto na tabela'; end $$;
reset role;
set role service_role;
select pg_temp.ok(public.infra_ficha_gravar((select app from t), (select repo from t), null, 'blanco/bl', 'abc1234',
  '[{"secao":"Stack","campo":"Frameworks","valor":"Spring Boot 3.2"},{"secao":"Stack","campo":"Linguagens e versões","valor":"Java 17"},{"secao":"Secrets catalog","campo":"Nome de cada segredo e onde fica","valor":"DATABASE_URL"},{"secao":"x","campo":"","valor":"vazio sai"}]') = 3,
  'a primeira leitura do repositório grava 3 campos (o campo sem nome é ignorado)');
select pg_temp.ok(public.infra_ficha_gravar((select app from t), null, (select banco from t), 'Produção', 'h1',
  '[{"secao":"Database","campo":"Banco e schema","valor":"Supabase · PostgreSQL · public"},{"secao":"Database","campo":"Tabelas principais","valor":"clientes, lojas"}]') = 2, 'o banco grava os campos dele, separado do repositório');
select pg_temp.ok(public.infra_ficha_gravar((select app from t), (select repo from t), null, 'blanco/bl', 'def5678',
  '[{"secao":"Stack","campo":"Frameworks","valor":"Spring Boot 3.3"},{"secao":"Stack","campo":"Linguagens e versões","valor":"Java 17"}]') = 1, 'de novo: só o que mudou conta (Frameworks)');
select pg_temp.ok((select anterior = 'Spring Boot 3.2' and valor = 'Spring Boot 3.3' and referencia = 'def5678' and mudou_em >= now() - interval '1 minute' from ficha_auto where campo = 'Frameworks'), 'guarda o valor anterior e quando mudou (é o aviso de mudança)');
select pg_temp.ok((select count(*) from ficha_auto where secao = 'Secrets catalog') = 0 and (select count(*) from ficha_auto where fonte = 'banco') = 2, 'o que o repositório não trouxe mais sai; os campos do banco ficam');
select pg_temp.ok((select count(*) from ficha_campos where no_id = (select app from t) and campo = 'Frameworks') = 0, 'a ficha escrita pelas pessoas (ficha_campos) não é tocada');
select pg_temp.ok(public.infra_ficha_gravar((select prod from t), (select repo from t), null, 'blanco/bl', 'abc', '[{"secao":"Stack","campo":"Frameworks","valor":"x"}]') = 0 and (select count(*) from ficha_auto where no_id = (select prod from t)) = 0,
  'o repositório da aplicação não escreve na ficha do produto (cada ponto tem a própria ficha)');
do $$ begin perform public.infra_ficha_gravar((select app from t), (select repo from t), (select banco from t), 'x', 'y', '[]'); raise notice 'FALHA aceitou repositório e banco juntos';
exception when invalid_parameter_value then raise notice 'OK    repositório e banco juntos numa gravação é recusado'; end $$;
reset role;

-- ---------- quem vê: quem vê o ponto (RLS) ----------
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select count(*) from ficha_auto) = 4, 'o dono do espaço vê os campos automáticos do ponto');
reset role;
insert into pessoas (auth_user_id, nome, email, papel, ativo) values ('00000000-0000-0000-0000-0000000000fe', 'Pessoa de fora da ficha', 'fora-ficha@teste', 'dev', true);
select pg_temp.como('00000000-0000-0000-0000-0000000000fe'); set role authenticated;
select pg_temp.ok((select count(*) from ficha_auto) = 0, 'quem é de outro espaço não vê nada');
reset role;
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name = 'ficha_auto' and grantee = 'authenticated' and privilege_type = 'SELECT') = 1
  and (select count(*) from information_schema.role_table_grants where table_name = 'ficha_auto' and grantee = 'authenticated' and privilege_type <> 'SELECT') = 0
  and (select count(*) from information_schema.role_table_grants where table_name = 'ficha_auto' and grantee = 'anon') = 0, 'GRANT: authenticated só lê, anon nada');
select pg_temp.ok((select relrowsecurity from pg_class where oid = 'public.ficha_auto'::regclass), 'RLS ligada');

-- ---------- desligar o banco leva os campos dele ----------
delete from infra_bancos where id = (select banco from t);
select pg_temp.ok((select count(*) from ficha_auto where fonte = 'banco') = 0, 'desligar o banco apaga os campos automáticos dele');

-- ---------- push no branch principal pede desenhos e ficha ----------
delete from infra_automacoes;
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/feature/x","after":"aaa111","commits":[]}');
select pg_temp.ok((select count(*) from infra_automacoes) = 0, 'push em outro branch não pede nada');
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/main","after":"bbb222","commits":[]}');
select pg_temp.ok((select count(*) = 2 and bool_and(origem = 'github' and referencia = 'bbb222' and status = 'pendente') and bool_or(no_id = (select app from t)) and bool_or(no_id = (select prod from t)) from infra_automacoes), 'push no branch principal pede para a aplicação e para o produto dela, com o commit');
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/main","after":"ccc333","commits":[]}');
select pg_temp.ok((select count(*) = 2 and bool_and(referencia = 'ccc333') from infra_automacoes), 'outro push com o pedido ainda esperando só troca para o commit mais novo (não enfileira de novo)');
update infra_automacoes set status = 'rodando';
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/main","after":"ccc333","commits":[]}');
select pg_temp.ok((select count(*) from infra_automacoes) = 2, 'o mesmo commit que já está rodando não repete');
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/main","after":"ddd444","commits":[]}');
select pg_temp.ok((select count(*) from infra_automacoes where status = 'pendente' and referencia = 'ddd444') = 2, 'um commit novo enquanto o outro roda entra na fila');
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/main","after":"0000000000000000000000000000000000000000","deleted":true,"commits":[]}');
select pg_temp.ok((select count(*) from infra_automacoes) = 4, 'apagar o branch não pede nada');
update repositorios set ativo = false where id = (select repo from t);
delete from infra_automacoes;
select interno.git_processar((select r from repositorios r where id = (select repo from t)), 'push', '{"ref":"refs/heads/main","after":"eee555","commits":[]}');
select pg_temp.ok((select count(*) from infra_automacoes) = 0, 'repositório desligado não pede nada');
