-- SOMENTE TESTE LOCAL: parte 68 (cofre). Tenta de tudo para ver o que não devia. Numa transação que volta atrás.
-- Pessoas: William (dono), Ana (mesmo espaço), CEO da B&L (cliente que acompanha) e Zé (outra empresa, criado aqui).
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
-- roda um comando como a pessoa e devolve o erro (ou 'sem erro')
create or replace function pg_temp.erro(auth uuid, sql text) returns text language plpgsql as $$
begin
  if auth is not null then perform pg_temp.como(auth); end if; execute 'set local role authenticated';
  begin execute sql; exception when others then execute 'reset role'; return sqlerrm; end;
  execute 'reset role'; return 'sem erro';
end $$;
create or replace function pg_temp.valor(auth uuid, sql text) returns text language plpgsql as $$
declare r text;
begin perform pg_temp.como(auth); execute 'set local role authenticated'; execute sql into r; execute 'reset role'; return r; end $$;
insert into auth.users (id, email) values ('68000000-0000-0000-0000-0000000000aa', 'ze@outra.com');
-- o sistema cria a pessoa (e o espaço pessoal dela) sozinho quando entra um login novo
update public.pessoas set nome = 'Zé de outra empresa' where auth_user_id = '68000000-0000-0000-0000-0000000000aa';
create temp table fx as select
  (select auth_user_id from pessoas where nome = 'William') w, (select id from pessoas where nome = 'William') wp,
  (select auth_user_id from pessoas where nome = 'Ana (exemplo)') a, (select id from pessoas where nome = 'Ana (exemplo)') ap,
  (select auth_user_id from pessoas where nome = 'CEO da B&L (exemplo)') c,
  '68000000-0000-0000-0000-0000000000aa'::uuid z, (select id from pessoas where auth_user_id = '68000000-0000-0000-0000-0000000000aa') zp;
grant select on fx to authenticated;
create temp table it (id uuid); grant select on it to authenticated;

-- 1. William guarda uma senha
insert into it select pg_temp.valor((select w from fx), $q$select public.cofre_criar('{"tipo":"senha","nome":"Painel AWS","url":"https://aws.amazon.com","descricao":"conta principal"}', '{"usuario":"william","senha":"S3nh@-Ultra-Secreta","notas":"MFA no celular"}')$q$)::uuid;
select pg_temp.ok((select id from it) is not null, 'William guarda uma senha no cofre');

-- 2. o valor não está em nenhuma tabela comum, nem no histórico, nem na auditoria; só no Vault (e lá a descrição não tem o nome do item)
create temp table achados (onde text);
do $$ declare t record; n int; begin
  for t in select table_schema s, table_name n from information_schema.tables where table_type = 'BASE TABLE' and table_schema in ('public', 'interno', 'auditoria', 'logica', 'realtime') loop
    execute format('select count(*) from %I.%I x where x::text like %L', t.s, t.n, '%S3nh@-Ultra-Secreta%') into n;
    if n > 0 then insert into achados values (t.s || '.' || t.n); end if;
  end loop; end $$;
select pg_temp.ok(not exists (select 1 from achados), 'a senha não aparece em nenhuma tabela do sistema (public, interno, auditoria, logica, realtime)' || coalesce(': achada em ' || (select string_agg(onde, ', ') from achados), ''));
select pg_temp.ok((select count(*) from vault.secrets s join interno.cofre_vault v on v.segredo_id = s.id where v.item_id = (select id from it) and s.secret like '%S3nh@-Ultra-Secreta%' and s.description not like '%Painel%') = 1,
  'ela está só no Vault, e a descrição do Vault (que não é criptografada) não leva o nome do item');
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name like 'cofre%' and column_name ~ '(senha|segredo|valor|chave|secret|password)'),
  'as tabelas do cofre não têm nenhuma coluna para valor secreto');

-- 3. o dono revela, e fica registrado
select pg_temp.ok(pg_temp.valor((select w from fx), $q$select public.cofre_revelar((select id from it))->>'senha'$q$) = 'S3nh@-Ultra-Secreta', 'o dono vê a senha');
select pg_temp.ok((select count(*) from cofre_registros where item_id = (select id from it) and acao = 'revelou') = 1, 'e a revelação fica registrada');

-- 4. Ana, do mesmo espaço, sem acesso: não vê nada, por nenhum caminho
select pg_temp.ok(pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_itens') = '0', 'Ana (sem acesso) não vê o item na lista');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_revelar((select id from it))$q$) = 'Item não encontrado', 'Ana não revela (e a resposta é a mesma de "não existe")');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_alterar((select id from it), null, '{"senha":"hack"}')$q$) = 'Item não encontrado', 'Ana não troca a senha');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_compartilhar((select id from it), (select ap from fx), 'editar')$q$) = 'Item não encontrado', 'Ana não se dá acesso sozinha');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_lixeira((select id from it))$q$) = 'Item não encontrado', 'Ana não manda para a lixeira');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$insert into public.cofre_acessos (item_id, pessoa_id, nivel) select id, (select ap from fx), 'editar' from it$q$) like 'permission denied%', 'Ana não grava acesso direto na tabela');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$update public.cofre_itens set dono_id = (select ap from fx)$q$) like 'permission denied%', 'Ana não muda o dono direto na tabela');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$delete from public.cofre_itens$q$) like 'permission denied%', 'Ana não apaga direto na tabela');
select pg_temp.ok(pg_temp.erro((select a from fx), 'select * from interno.cofre_vault') like 'permission denied%', 'Ana não lê a ligação com o Vault');
select pg_temp.ok(pg_temp.erro((select a from fx), 'select * from vault.decrypted_secrets') like 'permission denied%', 'Ana não lê o Vault');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select logica.cofre_revelar((select id from it))$q$) = 'Item não encontrado', 'nem chamando a função de dentro (logica) direto');
select pg_temp.ok(pg_temp.valor((select a from fx), $q$select coalesce(interno.cofre_nivel((select id from it)), 'nada')$q$) = 'nada', 'para Ana, o nível no item é nenhum');
select pg_temp.ok(pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_registros') = '0' and pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_acessos') = '0', 'Ana não vê histórico nem lista de acessos');

-- 5. sem login: nada
select pg_temp.ok(pg_temp.erro(null, 'set local role anon; select * from public.cofre_itens') like 'permission denied%', 'sem login: não lê o cofre');
select pg_temp.ok(pg_temp.erro(null, $q$set local role anon; select public.cofre_revelar((select id from it))$q$) like 'permission denied%', 'sem login: não chama as funções');

-- 6. William compartilha com Ana só para ver
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_compartilhar((select id from it), (select ap from fx), 'ver')$q$) = 'sem erro', 'William compartilha com Ana (ver)');
select pg_temp.ok(pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_itens') = '1' and pg_temp.valor((select a from fx), $q$select public.cofre_revelar((select id from it))->>'senha'$q$) = 'S3nh@-Ultra-Secreta', 'agora Ana vê o item e a senha');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_alterar((select id from it), null, '{"senha":"hack"}')$q$) = 'Item não encontrado', 'com "ver", Ana não troca a senha');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_compartilhar((select id from it), (select (select id from pessoas where nome = 'Bruno (exemplo)')), 'ver')$q$) = 'Item não encontrado', 'Ana não repassa o acesso para outra pessoa');
select pg_temp.ok(pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_registros') = '1', 'Ana vê só o que ela mesma fez no histórico (a revelação dela)');
-- 7. editar
\o /dev/null
select pg_temp.erro((select w from fx), $q$select public.cofre_compartilhar((select id from it), (select ap from fx), 'editar')$q$);
\o
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_alterar((select id from it), '{"descricao":"trocada pela Ana"}', '{"usuario":"william","senha":"Nova-Senha-2"}')$q$) = 'sem erro', 'com "editar", Ana troca a senha');
select pg_temp.ok(pg_temp.valor((select w from fx), $q$select public.cofre_revelar((select id from it))->>'senha'$q$) = 'Nova-Senha-2', 'e William vê a senha nova');
select pg_temp.ok((select count(*) from vault.secrets s join interno.cofre_vault v on v.segredo_id = s.id where v.item_id = (select id from it)) = 1, 'trocar a senha atualiza o mesmo segredo no Vault (não deixa cópia velha)');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_apagar((select id from it))$q$) = 'Item não encontrado', 'com "editar", Ana ainda não apaga');
-- 8. tirar o acesso
\o /dev/null
select pg_temp.erro((select w from fx), $q$select public.cofre_compartilhar((select id from it), (select ap from fx), null)$q$);
\o
select pg_temp.ok(pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_itens') = '0' and pg_temp.erro((select a from fx), $q$select public.cofre_revelar((select id from it))$q$) = 'Item não encontrado', 'acesso tirado: Ana não vê mais nada');
-- 9. pessoa de outra empresa não pode receber
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_compartilhar((select id from it), (select zp from fx), 'ver')$q$) = 'Essa pessoa não é do mesmo espaço', 'não dá para compartilhar com alguém de outra empresa');
select pg_temp.ok(not exists (select 1 from (select pg_temp.valor((select w from fx), $q$select string_agg(nome, ',') from public.cofre_pessoas((select id from it))$q$) l) s where l like '%Zé%'), 'e ele nem aparece na lista de com quem compartilhar');
select pg_temp.ok(pg_temp.valor((select z from fx), 'select count(*)::text from public.cofre_itens') = '0' and pg_temp.erro((select z from fx), $q$select public.cofre_revelar((select id from it))$q$) = 'Item não encontrado', 'Zé (outra empresa) não vê nada');
-- 10. o cliente que acompanha (stakeholder) guarda o dele, e não vê o do William
select pg_temp.ok(pg_temp.erro((select c from fx), $q$select public.cofre_criar('{"tipo":"chave_api","nome":"Chave do cliente"}', '{"chave":"sk-cliente-123"}')$q$) = 'sem erro', 'o cliente guarda a chave dele');
select pg_temp.ok(pg_temp.valor((select c from fx), $q$select string_agg(nome, ',') from public.cofre_itens$q$) = 'Chave do cliente', 'e só vê o que é dele');
select pg_temp.ok(pg_temp.valor((select w from fx), $q$select string_agg(nome, ',') from public.cofre_itens$q$) = 'Painel AWS', 'William (dono do espaço) não vê o cofre do cliente');
-- 11. entradas ruins
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_criar('{"nome":"x","dono_id":"00000000-0000-0000-0000-000000000000"}', '{"a":"b"}')$q$) like 'Campo desconhecido%', 'campo estranho nos dados é recusado (não dá para forjar o dono)');
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_criar('{"nome":"x"}', '"texto solto"')$q$) like 'O segredo precisa%', 'segredo que não é um conjunto de campos é recusado');
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_criar('{"nome":"x"}', jsonb_build_object('n', repeat('a', 70000)))$q$) like '%64 KB%', 'segredo acima de 64 KB é recusado');
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_criar('{"nome":"x","tipo":"virus"}', '{"a":"b"}')$q$) like '%check%', 'tipo desconhecido é recusado');
-- 12. limite de revelações
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select count(public.cofre_revelar((select id from it))) from generate_series(1, 70)$q$) like 'Muitas revelações%', 'mais de 60 revelações em 10 minutos: para');
-- 13. ao vivo: o aviso vai só pelo canal pessoal, nunca pelo da empresa
delete from realtime.messages;
\o /dev/null
select pg_temp.erro((select w from fx), $q$select public.cofre_compartilhar((select id from it), (select ap from fx), 'ver')$q$);
\o
select pg_temp.ok(exists (select 1 from realtime.messages where topic = 'ciclodev:p:' || (select ap from fx) and payload->>'t' = 'cofre_acessos')
  and not exists (select 1 from realtime.messages where payload->>'t' like 'cofre%' and topic not like 'ciclodev:p:%')
  and not exists (select 1 from realtime.messages where payload::text like '%Painel AWS%' or payload::text like '%Senha%'), 'ao vivo: só pelo canal pessoal, sem nome nem valor');
-- 14. lixeira e apagar de vez (o segredo sai do Vault)
\o /dev/null
select pg_temp.erro((select w from fx), $q$select public.cofre_lixeira((select id from it))$q$);
\o
select pg_temp.ok(pg_temp.valor((select a from fx), 'select count(*)::text from public.cofre_itens') = '0' and pg_temp.valor((select w from fx), 'select count(*)::text from public.cofre_itens where excluido_em is not null') = '1',
  'na lixeira: quem tinha acesso para de ver; o dono ainda vê');
select pg_temp.ok(pg_temp.erro((select a from fx), $q$select public.cofre_revelar((select id from it))$q$) = 'Item não encontrado', 'na lixeira, Ana (que tinha acesso) não revela');
create temp table sid as select segredo_id from interno.cofre_vault where item_id = (select id from it);
select pg_temp.ok(pg_temp.erro((select w from fx), $q$select public.cofre_apagar((select id from it))$q$) = 'sem erro', 'William apaga de vez');
select pg_temp.ok(not exists (select 1 from vault.secrets where id = (select segredo_id from sid)) and not exists (select 1 from public.cofre_itens where id = (select id from it)), 'o segredo saiu do Vault junto');
select pg_temp.ok(not exists (select 1 from information_schema.role_table_grants where table_name like 'cofre%' and grantee in ('anon', 'service_role')), 'nenhuma permissão nas tabelas do cofre para anon nem para a chave de serviço');
rollback;
