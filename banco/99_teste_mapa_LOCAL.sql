-- SOMENTE TESTE LOCAL: parte 69 (Mapa do Sistema). Numa transação que volta atrás.
-- Pessoas: William (dono), Ana (mesmo espaço) e Zé (outra empresa, criado aqui).
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create or replace function pg_temp.erro(auth uuid, papel text, sql text) returns text language plpgsql as $$
begin
  if auth is not null then perform pg_temp.como(auth); end if; execute 'set local role ' || papel;
  begin execute sql; exception when others then execute 'reset role'; return sqlerrm; end;
  execute 'reset role'; return 'sem erro';
end $$;
create or replace function pg_temp.valor(auth uuid, papel text, sql text) returns text language plpgsql as $$
declare r text;
begin if auth is not null then perform pg_temp.como(auth); end if; execute 'set local role ' || papel; execute sql into r; execute 'reset role'; return r; end $$;
\o /dev/null
insert into auth.users (id, email) values ('69000000-0000-0000-0000-0000000000aa', 'ze@outra.com');
\o
update public.pessoas set nome = 'Zé de outra empresa' where auth_user_id = '69000000-0000-0000-0000-0000000000aa';
create temp table fx as select
  (select auth_user_id from pessoas where nome = 'William') w, (select id from pessoas where nome = 'William') wp,
  (select auth_user_id from pessoas where nome = 'Ana (exemplo)') a,
  '69000000-0000-0000-0000-0000000000aa'::uuid z,
  (select id from nos where tipo = 'aplicacao' and nome = 'Java BL') app,
  (select id from nos where tipo = 'aplicacao' and nome = 'Java Fiscal') outra;
grant select on fx to authenticated, service_role;
-- um repositório de verdade ligado na aplicação (com a conta conectada do espaço)
insert into git_conexoes (espaco_id, provedor, externo_id, conta) select n.espaco_id, 'github', '777', 'it-hub' from nos n where n.id = (select app from fx);
insert into repositorios (no_id, provedor, nome, branch_principal, conexao_id) select (select app from fx), 'github', 'it-hub/sistema-teste', 'main', (select id from git_conexoes where externo_id = '777');
create temp table rp as select id from repositorios where nome = 'it-hub/sistema-teste'; grant select on rp to authenticated, service_role;

-- 1. pela API só se lê; sem login, nada
select pg_temp.ok(not has_table_privilege('authenticated', 'public.mapa_pecas', 'insert') and not has_table_privilege('authenticated', 'public.mapa_analises', 'update')
  and not has_table_privilege('authenticated', 'public.mapa_proposito', 'insert') and not has_table_privilege('anon', 'public.mapa_analises', 'select')
  and not has_table_privilege('service_role', 'public.mapa_pecas', 'insert'), 'pela API só se lê; sem login não lê nada; nem a chave de serviço grava direto');
select pg_temp.ok(pg_temp.erro(null, 'anon', 'select count(*) from public.mapa_analises') like '%permission denied%', 'sem login: recusado');

-- 2. a publicação de um repositório põe o pedido na fila (sem repetir)
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) values ((select app from fx), 'github', (select id from rp), 'abc1234');
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) values ((select app from fx), 'github', (select id from rp), 'def5678');
select pg_temp.ok((select count(*) from mapa_analises where repositorio_id = (select id from rp)) = 1
  and (select referencia from mapa_analises where repositorio_id = (select id from rp)) = 'def5678', 'cada publicação põe o pedido na fila; duas seguidas viram um pedido só, com o commit mais novo');

-- 3. "Analisar agora": quem edita pede; de outra empresa não; ponto sem repositório explica
select pg_temp.ok(pg_temp.valor((select w from fx), 'authenticated', $q$select public.mapa_pedir((select app from fx))::text$q$) = '0', 'Analisar agora com o pedido já na fila não repete');
select pg_temp.ok(pg_temp.erro((select z from fx), 'authenticated', $q$select public.mapa_pedir((select app from fx))$q$) like 'Você não pode mudar%', 'pessoa de outra empresa não pede análise');
select pg_temp.ok(pg_temp.erro((select w from fx), 'authenticated', $q$select public.mapa_pedir((select outra from fx))$q$) like 'Nenhum repositório ligado%', 'ponto sem código ligado: explica que é preciso ligar em Ligações');

-- 4. as funções do trabalhador são só da chave de serviço, e o segredo confere
select pg_temp.ok(pg_temp.erro((select w from fx), 'authenticated', 'select public.mapa_proximo()') like '%permission denied%'
  and pg_temp.erro((select w from fx), 'authenticated', $q$select public.mapa_gravar(gen_random_uuid(), '{}')$q$) like '%permission denied%', 'pessoa logada não pega pedido nem grava resultado');
select pg_temp.ok(pg_temp.valor(null, 'service_role', $q$select public.mapa_confere(repeat('x', 40))::text$q$) = 'false', 'sem o segredo no Vault, nada confere');
\o /dev/null
select vault.create_secret(repeat('s', 48), 'ciclodev_mapa_segredo');
\o
select pg_temp.ok(pg_temp.valor(null, 'service_role', $q$select public.mapa_confere(repeat('s', 48))::text$q$) = 'true'
  and pg_temp.valor(null, 'service_role', $q$select public.mapa_confere(repeat('s', 47) || 't')::text$q$) = 'false'
  and pg_temp.valor(null, 'service_role', $q$select public.mapa_confere('curto')::text$q$) = 'false', 'o segredo certo confere; errado ou curto, não');

-- 5. o trabalhador pega o pedido: vem o repositório (sem chave nenhuma) e marca como rodando
create temp table job (j jsonb); grant all on job to service_role;
insert into job select pg_temp.valor(null, 'service_role', 'select public.mapa_proximo()::text')::jsonb;
select pg_temp.ok((select j->'repositorio'->>'nome' from job) = 'it-hub/sistema-teste' and (select j->>'referencia' from job) = 'def5678'
  and (select status from mapa_analises where id = (select (j->>'id')::uuid from job)) = 'rodando'
  and (select j::text from job) not like '%token%', 'o trabalhador pega o pedido (repositório e commit) e ele fica rodando');
select pg_temp.ok(pg_temp.valor(null, 'service_role', 'select coalesce(public.mapa_proximo()::text, $$nada$$)') = 'nada', 'sem mais nada na fila, volta vazio');
select pg_temp.ok(pg_temp.valor(null, 'service_role', format($q$select public.mapa_repo_da_analise(%L)->>'nome'$q$, (select j->>'id' from job))) = 'it-hub/sistema-teste'
  and pg_temp.erro((select w from fx), 'authenticated', format($q$select public.mapa_repo_da_analise(%L)$q$, (select j->>'id' from job))) like '%permission denied%', 'a função acha o repositório da análise que está rodando; pessoa logada não');

-- 6. grava o resultado: peças, ligações e alertas
create temp table gr (r jsonb); grant all on gr to service_role;
insert into gr select pg_temp.valor(null, 'service_role', format($q$select public.mapa_gravar(%L, %L)::text$q$, (select j->>'id' from job),
  '{"tecnologia":"vite + react","com_banco":true,"resumo":{"telas":2},"papeis":["administrador","atendente"],
    "pecas":[{"chave":"app","tipo":"aplicacao","nome":"Painel"},{"chave":"m:clientes","pai":"app","tipo":"modulo","nome":"Clientes","papeis":["administrador","atendente"]},
             {"chave":"m:clientes/b:novo","pai":"m:clientes","tipo":"botao","nome":"Novo cliente","destino":"m:clientes/j:novo","arquivo":"src/Clientes.jsx","linha":42,"certeza":"codigo"},
             {"chave":"m:clientes/j:novo","pai":"m:clientes","tipo":"janela","nome":"Novo cliente","quando":"ao clicar em Novo cliente"}],
    "ligacoes":[{"de":"m:clientes/b:novo","para":"m:clientes/j:novo","tipo":"abre"},{"de":"m:clientes/j:novo","para":"tabela:clientes","tipo":"grava_em","detalhe":"nome, cpf"}],
    "alertas":[{"peca":"m:clientes/j:novo","modulo":"m:clientes","tipo":"coluna_inexistente","gravidade":"erro","texto":"grava a coluna apelido da tabela clientes, que não existe","tabela":"clientes","coluna":"apelido","impressao":"imp-0001-apelido"},
               {"peca":"m:clientes","modulo":"m:clientes","tipo":"so_navegador","gravidade":"atencao","texto":"salvo só neste navegador","impressao":"imp-0002-filtro"}]}'))::jsonb;
select pg_temp.ok((select r->>'alertas' from gr) = '2'
  and (select status || '|' || com_banco || '|' || tecnologia from mapa_analises where id = (select (j->>'id')::uuid from job)) = 'pronto|true|vite + react'
  and (select count(*) from mapa_pecas where analise_id = (select (j->>'id')::uuid from job)) = 4, 'grava peças, ligações e alertas e a análise fica pronta');
select pg_temp.ok(pg_temp.erro(null, 'service_role', format($q$select public.mapa_gravar(%L, '{}')$q$, (select j->>'id' from job))) like 'Esta análise não está rodando%', 'não grava de novo numa análise que já terminou');
select pg_temp.ok(pg_temp.erro(null, 'service_role', format($q$select public.mapa_gravar(%L, %L)$q$, (select j->>'id' from job), '{"pecas":[{"chave":"x","tipo":"foguete","nome":"x"}]}')) is not null, 'peça de tipo que não existe é recusada');

-- 7. quem vê: William e Ana (mesmo espaço) veem; Zé não vê nada
select pg_temp.ok(pg_temp.valor((select w from fx), 'authenticated', 'select count(*)::text from public.mapa_pecas') = '4'
  and pg_temp.valor((select a from fx), 'authenticated', 'select count(*)::text from public.mapa_alertas') = '2', 'quem tem acesso ao ponto vê as peças e os alertas');
select pg_temp.ok(pg_temp.valor((select z from fx), 'authenticated', 'select (select count(*) from public.mapa_pecas) + (select count(*) from public.mapa_alertas) + (select count(*) from public.mapa_analises)')::int = 0, 'pessoa de outra empresa não vê nada do mapa');

-- 8. "é de propósito"
select pg_temp.ok(pg_temp.erro((select w from fx), 'authenticated', $q$select public.mapa_proposito_marcar((select app from fx), 'imp-0002-filtro', 'x')$q$) like 'Escreva o motivo%', 'é de propósito sem motivo é recusado');
select pg_temp.ok(pg_temp.erro((select z from fx), 'authenticated', $q$select public.mapa_proposito_marcar((select app from fx), 'imp-0002-filtro', 'o filtro fica no navegador')$q$) like 'Você não pode mudar%', 'pessoa de outra empresa não marca');
select pg_temp.ok(pg_temp.erro((select w from fx), 'authenticated', $q$select public.mapa_proposito_marcar((select app from fx), 'imp-que-nao-existe', 'qualquer motivo')$q$) like 'Alerta não encontrado%', 'alerta que não existe naquele ponto é recusado');
create temp table rs (r text); grant all on rs to authenticated;
insert into rs select pg_temp.erro((select w from fx), 'authenticated', $q$select public.mapa_proposito_marcar((select app from fx), 'imp-0002-filtro', 'o filtro da lista fica no navegador de propósito')$q$);
select pg_temp.ok((select r from rs) = 'sem erro'
  and (select motivo || '|' || (por = (select wp from fx)) from mapa_proposito where impressao = 'imp-0002-filtro') = 'o filtro da lista fica no navegador de propósito|true', 'quem edita marca "é de propósito", com motivo, quem e quando');
select pg_temp.ok(pg_temp.valor((select z from fx), 'authenticated', 'select count(*)::text from public.mapa_proposito') = '0', 'outra empresa não vê o que foi marcado');
delete from rs; insert into rs select pg_temp.erro((select w from fx), 'authenticated', $q$select public.mapa_proposito_tirar((select app from fx), 'imp-0002-filtro')$q$);
select pg_temp.ok((select r from rs) = 'sem erro'
  and not exists (select 1 from mapa_proposito where impressao = 'imp-0002-filtro'), 'e pode desmarcar');

-- 9. nova publicação: a análise antiga some quando a nova termina; erro fica registrado
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) values ((select app from fx), 'github', (select id from rp), 'fff0001');
delete from job; insert into job select pg_temp.valor(null, 'service_role', 'select public.mapa_proximo()::text')::jsonb;
\o /dev/null
select pg_temp.valor(null, 'service_role', format($q$select public.mapa_falhou(%L, 'não construiu: falta o script build')::text$q$, (select j->>'id' from job)));
\o
select pg_temp.ok((select status || '|' || erro from mapa_analises where id = (select (j->>'id')::uuid from job)) = 'erro|não construiu: falta o script build'
  and (select count(*) from mapa_analises where repositorio_id = (select id from rp) and status = 'pronto') = 1, 'erro fica registrado e a última análise pronta continua valendo');
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) values ((select app from fx), 'github', (select id from rp), 'fff0002');
delete from job; insert into job select pg_temp.valor(null, 'service_role', 'select public.mapa_proximo()::text')::jsonb;
\o /dev/null
select pg_temp.valor(null, 'service_role', format($q$select public.mapa_gravar(%L, %L)::text$q$, (select j->>'id' from job), '{"pecas":[{"chave":"app","tipo":"aplicacao","nome":"Painel"}]}'));
\o
select pg_temp.ok((select count(*) from mapa_analises where repositorio_id = (select id from rp)) = 1 and (select count(*) from mapa_pecas p join mapa_analises a on a.id = p.analise_id where a.repositorio_id = (select id from rp)) = 1,
  'a análise nova substitui as antigas do mesmo repositório (sem acumular)');

-- 10. colunas que outra aplicação do mesmo espaço usa chegam ao trabalhador (para não acusar "coluna sem tela")
insert into mapa_ligacoes (analise_id, de, para, tipo, detalhe) select id, 'x', 'tabela:clientes', 'grava_em', 'nome, cpf' from mapa_analises where repositorio_id = (select id from rp) and status = 'pronto';
insert into repositorios (no_id, provedor, nome, branch_principal, conexao_id) select (select outra from fx), 'github', 'it-hub/outro', 'main', (select id from git_conexoes where externo_id = '777');
insert into infra_automacoes (no_id, origem, repositorio_id, referencia) select (select outra from fx), 'github', id, 'aaa0001' from repositorios where nome = 'it-hub/outro';
delete from job; insert into job select pg_temp.valor(null, 'service_role', 'select public.mapa_proximo()::text')::jsonb;
select pg_temp.ok((select j->'repositorio'->>'nome' from job) = 'it-hub/outro' and (select j->'usadas_por_outras' from job) @> '["clientes.nome", "clientes.cpf"]'::jsonb, 'o trabalhador recebe as colunas que outras aplicações do espaço usam');

-- 11. o aviso ao vivo vai para o canal do espaço
select pg_temp.ok(exists (select 1 from interno.ao_vivo_tabelas where tabela = 'mapa_analises') and exists (select 1 from pg_trigger where tgrelid = 'public.mapa_analises'::regclass and tgname = 'zz_ao_vivo_u'), 'a tela fica sabendo, ao vivo, quando a análise muda');
rollback;
