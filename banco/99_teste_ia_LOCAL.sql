-- SOMENTE TESTE LOCAL: parte 25 (permissões de IA e conversa). Roda depois das partes 00 a 20, 22, 23, 25 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t as select
  (select id from pessoas where auth_user_id = '00000000-0000-0000-0000-00000000000a') as william,
  (select id from pessoas where auth_user_id = '00000000-0000-0000-0000-00000000000d') as bruno;
grant all on t to authenticated;

-- Bruno (não é dono do sistema) não liga a IA de ninguém, nem a dele
select pg_temp.como('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select pg_temp.ok(ia_posso() = false, 'Bruno começa sem IA');
do $$ begin perform admin_ia_definir((select bruno from t), true); raise exception 'ligou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'quem não é dono do sistema não liga a IA');
do $$ begin perform admin_ia_permissoes(); raise exception 'leu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'quem não é dono do sistema não vê a lista de permissões');
do $$ begin insert into ia_mensagens (autor, texto) values ('usuario', 'oi'); raise exception 'escreveu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'sem permissão, Bruno não escreve no chat');
do $$ begin insert into ia_permissoes (pessoa_id, ativo) values ((select bruno from t), true); raise exception 'burlou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém se dá permissão direto pela tabela');
reset role;

-- William (dono) liga a IA dele e a do Bruno
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select count(*) from admin_ia_permissoes() where not ativo) = (select count(*) from pessoas), 'todos começam desligados');
select admin_ia_definir((select william from t), true); select admin_ia_definir((select bruno from t), true);
select pg_temp.ok(ia_posso(), 'William tem IA');
insert into ia_mensagens (autor, texto) values ('usuario', 'mensagem do William');
do $$ begin insert into ia_mensagens (autor, texto) values ('agente', 'finge ser o agente'); raise exception 'fingiu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'pela tela ninguém escreve como se fosse o agente');
do $$ begin insert into ia_mensagens (pessoa_id, autor, texto) values ((select bruno from t), 'usuario', 'na conversa do outro'); raise exception 'invadiu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém escreve na conversa de outra pessoa');
reset role;

select pg_temp.como('00000000-0000-0000-0000-00000000000d'); set role authenticated;
insert into ia_mensagens (autor, texto) values ('usuario', 'mensagem do Bruno');
select pg_temp.ok((select string_agg(texto, '|') from ia_mensagens) = 'mensagem do Bruno', 'Bruno só vê a própria conversa');
select pg_temp.ok((select count(*) from ia_permissoes) = 1, 'Bruno só vê a própria permissão');
do $$ begin update ia_mensagens set texto = 'mudou'; raise exception 'mudou'; exception when insufficient_privilege then null; end $$;
do $$ begin delete from ia_mensagens; raise exception 'apagou'; exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.ok((select count(*) from ia_mensagens) = 2 and not exists (select 1 from ia_mensagens where texto = 'mudou'), 'ninguém muda nem apaga mensagem pela tela');

select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select string_agg(texto, '|') from ia_mensagens) = 'mensagem do William', 'William (mesmo sendo dono do sistema) só vê a própria conversa');
select admin_ia_definir((select bruno from t), false);
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000d'); set role authenticated;
select pg_temp.ok(ia_posso() = false, 'desligada, Bruno perde a IA');
do $$ begin insert into ia_mensagens (autor, texto) values ('usuario', 'de novo'); raise exception 'escreveu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'desligada, Bruno não escreve mais');
select pg_temp.ok((select count(*) from ia_mensagens) = 1, 'a conversa antiga do Bruno continua guardada');
reset role;
select 'FIM DO TESTE DA IA';
