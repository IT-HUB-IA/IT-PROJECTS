-- SOMENTE TESTE LOCAL: módulo Admin (rodar depois do 93)
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when c then 'OK    ' else 'FALHA ' end || m $$;

-- Maria usa o sistema
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
insert into uso_eventos (tipo) values ('entrou');
insert into uso_eventos (tipo, tela) values ('tela', 'operacoes');
insert into uso_eventos (tipo, ms) values ('carregou', 850);
insert into uso_eventos (tipo) values ('ativo');
select pg_temp.ok(not sou_dono_sistema(), 'Maria não é dona do sistema');
do $$ begin
  begin perform admin_resumo(); raise notice 'FALHA Maria abriu o Admin';
  exception when insufficient_privilege then raise notice 'OK    Maria não abre o resumo do Admin'; end;
  begin perform * from admin_usuarios(); raise notice 'FALHA Maria viu a lista de usuários';
  exception when insufficient_privilege then raise notice 'OK    Maria não vê a lista de usuários'; end;
  begin perform count(*) from uso_eventos; raise notice 'FALHA Maria leu o registro de uso';
  exception when insufficient_privilege then raise notice 'OK    ninguém lê o registro de uso direto'; end;
  begin insert into uso_eventos (pessoa_id, tipo) values ('d148fdc5-eef3-5398-bf89-f49b55b5cd28', 'entrou'); raise notice 'FALHA Maria gravou uso em nome de outro';
  exception when insufficient_privilege then raise notice 'OK    ninguém grava uso em nome de outra pessoa'; end;
end $$;
reset role;

-- William (dono do sistema)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'william@teste.com') on conflict do nothing;
update pessoas set auth_user_id = '00000000-0000-0000-0000-00000000000a' where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' and auth_user_id is null;
select pg_temp.como((select auth_user_id from pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'), 'william@teste.com');
set role authenticated;
select pg_temp.ok(sou_dono_sistema(), 'William é o dono do sistema');
select pg_temp.ok((admin_resumo() ->> 'usuarios')::int >= 3 and (admin_resumo() ->> 'ativos_30d')::int = 1 and (admin_resumo() ->> 'carregar_ms_mediana')::int = 850, 'resumo conta usuários, ativos e tempo de carregar');
select pg_temp.ok((select cpf = '52998224725' and cargo = 'Diretora' from admin_usuarios() where email = 'ana@teste.com'), 'lista mostra os dados do cadastro');
select pg_temp.ok((select projetos = 1 and clientes = 1 and entradas_30d = 1 and minutos_ativos_30d = 5 and indice_uso > 0 from admin_usuarios() where email = 'maria@teste.com'), 'lista mostra projetos e uso de cada um');
select pg_temp.ok((select count(*) from admin_historico((select id from pessoas where email = 'maria@teste.com'))) = 3, 'histórico de uso da Maria (sem os minutos ativos)');
select pg_temp.ok((select count(*) from admin_uso_diario(30)) = 30, 'série de 30 dias');
select pg_temp.ok((select aberturas from admin_telas(30) where tela = 'operacoes') = 1, 'telas mais usadas');
select pg_temp.ok((select count(*) from admin_banco()) > 5, 'tamanho das tabelas');
select pg_temp.ok((select count(*) from nos where nome = 'Cliente da Maria') = 0, 'mesmo dono do sistema, William NÃO vê os projetos da Maria');
select pg_temp.ok((select count(*) from pessoas_privado) = 0, 'e não lê a tabela privada direto (só pelo Admin)');
reset role;
