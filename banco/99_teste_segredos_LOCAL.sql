-- SOMENTE TESTE LOCAL: parte 57 (segredos no Vault). Roda depois de todas as partes e dos usuários de teste (91). Tudo dentro de uma transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t (k text primary key, v uuid);
-- 1. gravar move para o Vault e deixa a coluna vazia
insert into interno.supa_app (id, client_id, client_secret, retorno) values (true, '00000000-0000-0000-0000-000000000001', 'sba_teste', 'https://x') on conflict (id) do update set client_secret = excluded.client_secret;
select pg_temp.ok((select client_secret is null and interno.segredo_de('interno.supa_app', 'true', 'client_secret') = 'sba_teste' from interno.supa_app), 'o segredo do app vai para o Vault e a coluna fica vazia');
insert into t select 'app', segredo_id from interno.segredos_vault where tabela = 'interno.supa_app';
select pg_temp.ok((select count(*) = 1 from vault.secrets where id = (select v from t where k = 'app') and secret = 'sba_teste'), 'o Vault tem o valor');
-- 2. trocar o valor reaproveita o mesmo segredo (não cria lixo no Vault)
update interno.supa_app set client_secret = 'sba_novo';
select pg_temp.ok(((select segredo_id from interno.segredos_vault where tabela = 'interno.supa_app') = (select v from t where k = 'app') and interno.segredo_de('interno.supa_app', 'true', 'client_secret') = 'sba_novo'), 'trocar o valor atualiza o mesmo segredo');
-- 3. gravar sem o valor (nulo) mantém o que estava
update interno.supa_app set retorno = 'https://y';
select pg_temp.ok((interno.segredo_de('interno.supa_app', 'true', 'client_secret') = 'sba_novo'), 'mudar outra coluna mantém o segredo');
select pg_temp.ok((supa_app_ler()->>'client_secret') = 'sba_novo', 'supa_app_ler devolve o segredo como antes');
-- 4. coluna antiga com valor é impossível (regra), mesmo sem o gatilho
alter table interno.supa_app disable trigger segredos_no_vault;
do $$ begin update interno.supa_app set client_secret = 'vazou'; raise notice 'FALHA gravou segredo em texto puro';
exception when check_violation then raise notice 'OK    a regra impede segredo em texto puro'; end $$;
alter table interno.supa_app enable trigger segredos_no_vault;
-- 5. tokens: renovação nula mantém a antiga; apagar a linha apaga do Vault
insert into public.supa_conexoes (id, espaco_id, conta) select '11111111-1111-1111-1111-111111111111', id, 'teste' from public.espacos limit 1;
insert into interno.supa_tokens (conexao_id, acesso, renovacao) values ('11111111-1111-1111-1111-111111111111', 'a1', 'r1');
select supa_tokens_gravar('11111111-1111-1111-1111-111111111111', 'a2', null, now());
select pg_temp.ok((supa_conexao_ler('11111111-1111-1111-1111-111111111111')->'tokens') @> '{"acesso":"a2","renovacao":"r1"}', 'chave nova grava, renovação vazia mantém a antiga');
insert into t select 'tok', segredo_id from interno.segredos_vault where tabela = 'interno.supa_tokens' and chave = '11111111-1111-1111-1111-111111111111' and coluna = 'acesso';
delete from public.supa_conexoes where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.ok(not exists (select 1 from vault.secrets where id = (select v from t where k = 'tok')) and not exists (select 1 from interno.segredos_vault where chave = '11111111-1111-1111-1111-111111111111'), 'apagar a conexão apaga as chaves do Vault (em cascata)');
-- 5b. o mesmo insert com "on conflict do update" (como as funções fazem) troca o segredo da linha que já existe
insert into public.supa_conexoes (id, espaco_id, conta) select '22222222-2222-2222-2222-222222222222', id, 'teste' from public.espacos limit 1;
insert into interno.supa_tokens (conexao_id, acesso, renovacao) values ('22222222-2222-2222-2222-222222222222', 'b1', null);
insert into interno.supa_tokens (conexao_id, acesso, renovacao) values ('22222222-2222-2222-2222-222222222222', 'b2', 'rb2')
  on conflict (conexao_id) do update set acesso = excluded.acesso, renovacao = excluded.renovacao;
select pg_temp.ok((supa_conexao_ler('22222222-2222-2222-2222-222222222222')->'tokens') @> '{"acesso":"b2","renovacao":"rb2"}'
  and (select count(*) from interno.segredos_vault where chave = '22222222-2222-2222-2222-222222222222') = 2, 'upsert numa linha que já existe troca as chaves (sem segredo solto)');
-- 5c. "on conflict do nothing" não troca o segredo que já existe (segredo do aviso do GitLab; roda depois do 97)
insert into public.repositorios (no_id, provedor, nome) select id, 'gitlab', 'teste/segredos' from nos where tipo = 'aplicacao' limit 1;
insert into t select 'gl', id from public.repositorios where nome = 'teste/segredos';
insert into t select 'gls', null; update t set v = null where k = 'gls';
create temp table gl as select git_repo_segredo((select v from t where k = 'gl')) s;
insert into interno.repositorios_segredos (repositorio_id, segredo) select v, 'trocado' from t where k = 'gl' on conflict do nothing;
select pg_temp.ok((select s from gl) is not null and git_repo_segredo((select v from t where k = 'gl')) = (select s from gl), '"on conflict do nothing" não troca o segredo do aviso do GitLab');
-- 6. git_apps: o jsonb inteiro vai para o Vault
insert into interno.git_apps (provedor, dados, publico) values ('gitlab', '{"client_id":"g","client_secret":"s"}', '{}') on conflict (provedor) do update set dados = excluded.dados;
select pg_temp.ok((select dados = '{}'::jsonb from interno.git_apps where provedor = 'gitlab') and (git_app_ler('gitlab')->>'client_secret') = 's', 'dados do app do Git ficam no Vault e git_app_ler devolve igual');
select pg_temp.ok((select count(*) from vault.secrets x where not exists (select 1 from interno.segredos_vault s where s.segredo_id = x.id) and x.description like 'ciclodev %') = 0, 'nenhum segredo solto no Vault');
-- 7. ninguém de fora lê
set local role authenticated;
do $$ begin perform interno.segredo_de('a', 'b', 'c'); raise notice 'FALHA authenticated leu segredo';
exception when insufficient_privilege then raise notice 'OK    authenticated não chama segredo_ler'; end $$;
do $$ begin perform 1 from vault.decrypted_secrets; raise notice 'FALHA authenticated leu o Vault';
exception when insufficient_privilege then raise notice 'OK    authenticated não lê o Vault'; end $$;
reset role;
set local role anon;
do $$ begin perform interno.segredo_de('a', 'b', 'c'); raise notice 'FALHA anon leu segredo';
exception when insufficient_privilege then raise notice 'OK    anon não chama segredo_ler'; end $$;
reset role;
-- 8. nenhuma coluna antiga com valor em nenhuma tabela
select pg_temp.ok(not exists (select 1 from interno.supa_app where client_secret is not null) and not exists (select 1 from interno.git_apps where dados <> '{}')
  and not exists (select 1 from interno.git_tokens where acesso is not null or renovacao is not null) and not exists (select 1 from interno.supa_tokens where acesso is not null or renovacao is not null)
  and not exists (select 1 from interno.infra_bancos_conexao where conexao is not null) and not exists (select 1 from interno.repositorios_segredos where segredo is not null)
  and not exists (select 1 from public.portais_segredos where webhook_segredo is not null), 'nenhum segredo em texto puro sobrou');
rollback;
