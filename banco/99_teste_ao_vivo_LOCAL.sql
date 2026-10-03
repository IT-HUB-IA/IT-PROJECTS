-- SOMENTE TESTE LOCAL: parte 67 (avisos ao vivo). Usa a simulação do Realtime da parte 00. Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create temp table fx as select (select id from espacos where nome = 'Espaço de William') ea,
  (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') a1,
  (select id from nos where pai_id = (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') and tipo = 'frente' limit 1) fr,
  (select status_id from itens where status_id is not null limit 1) st,
  (select auth_user_id from pessoas where nome = 'William') will_auth, (select id from pessoas where nome = 'William') will,
  (select auth_user_id from pessoas where nome = 'Ana (exemplo)') ana_auth, (select id from pessoas where nome = 'Ana (exemplo)') ana;
grant select on fx to authenticated;
-- um segundo espaço, de outra empresa, onde William não está
insert into espacos (id, nome, dono_id) select '77777777-0000-0000-0000-000000000001', 'Outra empresa', ana from fx;
insert into espaco_membros (espaco_id, pessoa_id, papel) select '77777777-0000-0000-0000-000000000001', ana, 'dono' from fx;
delete from realtime.messages;
create temp view av as select topic, payload->>'t' t, payload->>'c' c, payload->>'op' op, payload->'ids' ids, payload, private, event from realtime.messages;
grant select on av to authenticated;

-- 1. incluir um item: um aviso no canal do espaço, só com a identificação
insert into itens (id, frente_id, titulo, tipo, status_id) select '67000000-0000-0000-0000-000000000001', fr, 'Item ao vivo', 'task', st from fx;
select pg_temp.ok((select count(*) from av where t = 'itens' and topic = 'ciclodev:' || (select ea from fx) and op = 'I' and ids ? '67000000-0000-0000-0000-000000000001' and private and event = 'mudou') = 1,
  'incluir item: um aviso privado no canal do espaço, com o id');
select pg_temp.ok((select bool_and(jsonb_object_keys_ok) from (select (select array_agg(k order by k) from jsonb_object_keys(payload) k) = array['c','ids','op','t'] jsonb_object_keys_ok from av) s),
  'o aviso nunca leva o conteúdo da linha (só tabela, chave, operação e ids)');
select pg_temp.ok(not exists (select 1 from av where payload::text like '%Item ao vivo%'), 'o título do item não vai no aviso');
-- 2. alterar várias linhas numa instrução só: UM aviso com todas
delete from realtime.messages;
insert into itens (id, frente_id, titulo, tipo, status_id) select ('67000000-0000-0000-0000-00000000001' || n)::uuid, fr, 'Lote ' || n, 'task', st from fx, generate_series(0, 4) n;
select pg_temp.ok((select count(*) from av where t = 'itens' and op = 'I') = 1 and (select jsonb_array_length(ids) from av where t = 'itens' and op = 'I') = 5, 'incluir 5 itens de uma vez: um aviso só, com os 5');
delete from realtime.messages;
update itens set prioridade = 'high' where titulo like 'Lote %';
select pg_temp.ok((select count(*) from av where t = 'itens' and op = 'U') = 1, 'alterar 5 itens de uma vez: um aviso só');
-- 3. muitas linhas (importação grande): manda "relê a tabela"
delete from realtime.messages;
insert into itens (frente_id, titulo, tipo, status_id) select fr, 'Grande ' || n, 'task', st from fx, generate_series(1, 320) n;
select pg_temp.ok((select count(*) from av where t = 'itens' and op = 'I' and jsonb_typeof(ids) = 'null') = 1, 'importar 320 de uma vez: um aviso "relê a tabela" (sem a lista)');
-- 4. o que pendura no item vai para o mesmo canal; chave composta manda o "dono"
delete from realtime.messages;
insert into comentarios (id, item_id, texto) values ('67000000-0000-0000-0000-000000000099', '67000000-0000-0000-0000-000000000001', 'oi');
insert into itens_pessoas (item_id, pessoa_id, papel) select '67000000-0000-0000-0000-000000000001', will, 'observador' from fx;
select pg_temp.ok(exists (select 1 from av where t = 'comentarios' and ids ? '67000000-0000-0000-0000-000000000099' and topic = 'ciclodev:' || (select ea from fx)), 'comentário avisa no canal do espaço do item');
select pg_temp.ok(exists (select 1 from av where t = 'itens_pessoas' and c = 'item_id' and ids ? '67000000-0000-0000-0000-000000000001'), 'tabela de chave composta avisa pelo dono (item_id)');
-- 5. apagar avisa com a identificação de quem saiu
delete from realtime.messages;
delete from comentarios where id = '67000000-0000-0000-0000-000000000099';
select pg_temp.ok(exists (select 1 from av where t = 'comentarios' and op = 'D' and ids ? '67000000-0000-0000-0000-000000000099'), 'apagar avisa com o id que saiu');
-- 6. mudar de espaço avisa os dois (quem perdeu e quem ganhou)
insert into etiquetas (id, espaco_id, nome) select '67000000-0000-0000-0000-0000000000e1', ea, 'ao vivo' from fx;
delete from realtime.messages;
update etiquetas set espaco_id = '77777777-0000-0000-0000-000000000001' where id = '67000000-0000-0000-0000-0000000000e1';
select pg_temp.ok((select count(*) from av where t = 'etiquetas' and topic in ('ciclodev:' || (select ea from fx), 'ciclodev:77777777-0000-0000-0000-000000000001')) = 2, 'o que muda de espaço avisa o antigo e o novo');
-- 7. o que é de uma pessoa só vai para o canal pessoal dela
delete from realtime.messages;
insert into ia_mensagens (pessoa_id, autor, texto) select will, 'usuario', 'teste' from fx;
select pg_temp.ok(exists (select 1 from av where t = 'ia_mensagens' and topic = 'ciclodev:p:' || (select will from fx)), 'conversa com a IA avisa só no canal pessoal');
-- 8. um aviso que falha não derruba a gravação
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$ begin raise exception 'Realtime fora do ar'; end $$;
insert into itens (id, frente_id, titulo, tipo, status_id) select '67000000-0000-0000-0000-000000000002', fr, 'Mesmo sem aviso', 'task', st from fx;
select pg_temp.ok(exists (select 1 from itens where id = '67000000-0000-0000-0000-000000000002'), 'com o Realtime fora do ar, a gravação continua');
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$
begin insert into realtime.messages (topic, extension, payload, event, private) values (topic, 'broadcast', payload, event, private); end $$;
-- 9. quem pode entrar em qual canal (a política que o Realtime consulta ao entrar)
insert into realtime.messages (topic, extension, payload, event, private) select 'ciclodev:' || ea, 'broadcast', '{}', 'mudou', true from fx;
insert into realtime.messages (topic, extension, payload, event, private) values ('ciclodev:77777777-0000-0000-0000-000000000001', 'broadcast', '{}', 'mudou', true);
select pg_temp.como((select will_auth from fx));
set local role authenticated;
select pg_temp.ok((select ao_vivo_topicos()) @> array['ciclodev:' || (select ea from fx), 'ciclodev:p:' || (select will from fx), 'ciclodev:geral']
  and not (select ao_vivo_topicos()) @> array['ciclodev:77777777-0000-0000-0000-000000000001'], 'William recebe a lista dos canais dele (espaço, pessoal, geral), sem o da outra empresa');
\o /dev/null
select set_config('realtime.topic', 'ciclodev:' || (select ea from fx), true);
\o
select pg_temp.ok((select count(*) from realtime.messages) > 0, 'William entra no canal do espaço dele');
\o /dev/null
select set_config('realtime.topic', 'ciclodev:77777777-0000-0000-0000-000000000001', true);
\o
select pg_temp.ok((select count(*) from realtime.messages) = 0, 'William NÃO entra no canal da outra empresa');
\o /dev/null
select set_config('realtime.topic', 'ciclodev:p:' || (select ana from fx), true);
\o
select pg_temp.ok((select count(*) from realtime.messages) = 0, 'William NÃO entra no canal pessoal de outra pessoa');
\o /dev/null
select set_config('realtime.topic', 'outro:qualquer', true);
\o
select pg_temp.ok((select count(*) from realtime.messages) = 0, 'canal que não é do CicloDev: nada');
select pg_temp.ok(not exists (select 1 from information_schema.role_routine_grants where routine_name = 'ao_vivo_avisar' and grantee in ('authenticated', 'anon')), 'ninguém de fora chama a função do aviso');
reset role;
select pg_temp.como((select ana_auth from fx));
set local role authenticated;
\o /dev/null
select set_config('realtime.topic', 'ciclodev:77777777-0000-0000-0000-000000000001', true);
\o
select pg_temp.ok((select count(*) from realtime.messages) > 0, 'Ana (da outra empresa) entra no canal dela');
reset role;
select pg_temp.ok(not has_table_privilege('anon', 'realtime.messages', 'select'), 'sem login: nenhum canal');
select pg_temp.ok((select count(*) from pg_trigger where tgname like 'zz_ao_vivo_%') = 3 * (select count(*) from interno.ao_vivo_tabelas t where to_regclass('public.' || t.tabela) is not null), 'todas as tabelas da lista têm os três avisos (incluir, alterar, apagar)');
rollback;
