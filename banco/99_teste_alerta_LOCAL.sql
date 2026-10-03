-- SOMENTE TESTE LOCAL: parte 63 (alerta de biblioteca com falha, marcar como visto). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, true); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true); end $$;
create temp table fx as select (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') app,
  (select auth_user_id from pessoas where nome = 'William') will_auth, (select id from pessoas where nome = 'William') will,
  (select auth_user_id from pessoas where papel = 'stakeholder' and auth_user_id is not null limit 1) stake_auth, (select id from pessoas where papel = 'stakeholder' limit 1) stake;
insert into public.repositorios (no_id, provedor, nome) select app, 'github', 'teste/alerta' from fx;
alter table fx add column repo uuid; update fx set repo = (select id from repositorios where nome = 'teste/alerta');
grant select on fx to authenticated;
create temp table av0 as select count(*) n from notificacoes;
create or replace function pg_temp.rodar(p_titulo text, p_grav text) returns jsonb language sql as $$
  select analise_gravar((select app from fx), (select repo from fx), null, 'teste/alerta', 'abc', 10,
    jsonb_build_array(jsonb_build_object('regra','DEP-01','gravidade',p_grav,'titulo',p_titulo,'onde','package-lock.json · npm','trecho','Corrige na 4.17.21','impressao','aaaa0001'),
                      jsonb_build_object('regra','INJ-01','gravidade','critica','titulo','SQL montado','onde','a.js:1','trecho','x','impressao','bbbb0002'))) $$;

-- 1. aparece: alerta aceso e aviso no sininho de quem participa (não do stakeholder)
select pg_temp.rodar('lodash 4.17.15: 2 falhas conhecidas', 'alta');
select pg_temp.ok((select visto_em is null from analise_achados where impressao = 'aaaa0001') and (select visto_em is null from analise_achados where impressao = 'bbbb0002'), 'achado novo nasce com o alerta aceso');
select pg_temp.ok((select count(*) from notificacoes where titulo like 'Biblioteca com falha conhecida em teste/alerta' and pessoa_id = (select will from fx)) = 1
  and not exists (select 1 from notificacoes where titulo like '%teste/alerta%' and pessoa_id = (select stake from fx)), 'aviso no sininho para quem participa; o stakeholder não recebe');
select pg_temp.ok((select texto from notificacoes where titulo like '%teste/alerta%' limit 1) ~ 'Pior gravidade: alta.*lodash.*marque como visto. Nada foi travado', 'o aviso diz a gravidade, a biblioteca e que nada foi travado');
select pg_temp.ok(not exists (select 1 from notificacoes where titulo like '%SQL montado%'), 'achado que não é de biblioteca não manda aviso (só acende na tela)');
-- 2. a mesma coisa de novo: nem aviso repetido nem alerta mexido
create temp table av1 as select count(*) n from notificacoes;
select pg_temp.rodar('lodash 4.17.15: 2 falhas conhecidas', 'alta');
select pg_temp.ok((select count(*) from notificacoes) = (select n from av1), 'a mesma análise de novo não repete o aviso');
-- 3. marcar como visto
select pg_temp.como((select stake_auth from fx));
set local role authenticated;
do $$ begin perform analise_marcar_visto(array[(select id from analise_achados where impressao = 'aaaa0001')]); raise notice 'FALHA stakeholder marcou';
exception when insufficient_privilege then raise notice 'OK    quem só acompanha não marca alerta'; end $$;
reset role;
select pg_temp.como((select will_auth from fx));
set local role authenticated;
select pg_temp.ok(analise_marcar_visto(array[(select id from analise_achados where impressao = 'aaaa0001')]) = 1, 'quem participa marca como visto');
select pg_temp.ok(analise_marcar_visto(array[(select id from analise_achados where impressao = 'aaaa0001')]) = 0, 'marcar de novo não muda nada');
reset role;
select pg_temp.ok((select visto_em is not null and visto_por = (select will from fx) and status = 'aberto' from analise_achados where impressao = 'aaaa0001'), 'fica quem viu e quando; o achado continua aberto (visto não é corrigido)');
-- 4. pessoa de outro espaço não marca o que não vê
select gen_random_uuid() as fora \gset
insert into auth.users (id, email, raw_user_meta_data) values (:'fora', 'fora-' || :'fora' || '@t.com', '{"nome":"Fora"}');
select pg_temp.como(:'fora');
set local role authenticated;
select pg_temp.ok(analise_marcar_visto(array(select id from analise_achados where impressao = 'bbbb0002')) = 0, 'pessoa de outro espaço não marca (0 alterados)');
reset role;
-- 5. a biblioteca ganha falha nova: o alerta acende de novo e avisa
create temp table av2 as select count(*) n from notificacoes;
select pg_temp.rodar('lodash 4.17.15: 3 falhas conhecidas', 'critica');
select pg_temp.ok((select visto_em is null from analise_achados where impressao = 'aaaa0001') and (select count(*) from notificacoes) > (select n from av2), 'falha nova na mesma biblioteca: alerta aceso de novo e novo aviso');
select pg_temp.ok(exists (select 1 from notificacoes where titulo like '%teste/alerta%' and texto ~ '^Pior gravidade: crítica'), 'o aviso novo traz a gravidade nova (crítica)');
-- 6. nada é travado: a função só devolve números
select pg_temp.ok((pg_temp.rodar('lodash 4.17.15: 3 falhas conhecidas', 'critica')) ? 'alertas', 'a gravação devolve quantos alertas acenderam (sem travar nada)');
rollback;
