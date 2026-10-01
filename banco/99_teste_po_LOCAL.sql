-- SOMENTE TESTE LOCAL: parte 38 (item completo pelo método do P.O.). Roda depois das partes 00 a 38 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p)::text, false); end $$;
create temp table t as select
  (select i.id from itens i join status_fluxo s on s.id = i.status_id where i.tipo = 'story' and s.grupo <> 'done' and i.excluido_em is null order by i.criado_em limit 1) as it,
  null::uuid as proj, (select id from pessoas where nome = 'William') as wil, (select id from pessoas where nome like 'Ana%') as ana,
  (select id from status_fluxo where no_id is null and chave = 'review') as st_review, (select id from status_fluxo where no_id is null and chave = 'done') as st_done,
  (select id from status_fluxo where no_id is null and chave = 'todo') as st_todo, (select id from status_fluxo where no_id is null and chave = 'doing') as st_doing;
update t set proj = interno.po_projeto_do_no((select frente_id from itens where id = t.it));
grant all on t to authenticated, service_role;

-- ---------- estrutura ----------
select pg_temp.ok((select count(*) from information_schema.columns where table_name = 'itens' and column_name in ('historia_quem','historia_quero','historia_para','moscow','nivel','valor','valor_motivo','melhoria','origem_id','voltou_em','voltou_motivo','meta')) = 12, 'itens tem as 12 colunas novas');
select pg_temp.ok((select count(*) from itens where nivel is null) = 0, 'todo item que já existia ganhou o nível a partir da prioridade antiga');
select pg_temp.ok((select relrowsecurity from pg_class where oid = 'public.itens_criterios'::regclass) and (select relrowsecurity from pg_class where oid = 'public.itens_historico'::regclass), 'RLS ligada nas duas tabelas novas');
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name = 'itens_historico' and grantee = 'authenticated' and privilege_type <> 'SELECT') = 0
  and (select count(*) from information_schema.role_table_grants where table_name = 'itens_historico' and grantee = 'authenticated' and privilege_type = 'SELECT') = 1, 'GRANT: o histórico é só leitura para quem está logado');
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name = 'itens_criterios' and grantee = 'authenticated' and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')) = 4
  and (select count(*) from information_schema.role_table_grants where table_name in ('itens_criterios','itens_historico') and grantee = 'anon') = 0, 'GRANT: critérios para quem está logado, nada para anon');
select pg_temp.ok((select count(*) from pg_proc where proname like 'po\_%' and pronamespace = 'interno'::regnamespace) = 9, 'uma versão só de cada função nova (9)');

-- ---------- nível e prioridade andam juntos ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update itens set nivel = 1 where id = (select it from t);
select pg_temp.ok((select prioridade = 'highest' from itens where id = (select it from t)), 'nível 1 vira prioridade Urgente (highest)');
update itens set prioridade = 'medium' where id = (select it from t);
select pg_temp.ok((select nivel = 3 from itens where id = (select it from t)), 'mudar a prioridade antiga muda o nível (média = 3)');
update itens set nivel = 5 where id = (select it from t);
select pg_temp.ok((select prioridade = 'low' and nivel = 5 from itens where id = (select it from t)), 'nível 5 fica 5 (prioridade baixa)');
do $$ begin update itens set nivel = 6 where id = (select it from t); raise notice 'FALHA aceitou nível 6';
exception when check_violation then raise notice 'OK    nível fora de 1 a 5 é recusado'; end $$;
do $$ begin update itens set moscow = 'talvez' where id = (select it from t); raise notice 'FALHA aceitou MoSCoW inexistente';
exception when check_violation then raise notice 'OK    classe MoSCoW inexistente é recusada'; end $$;
do $$ begin update itens set pontos = 4 where id = (select it from t); raise notice 'FALHA aceitou 4 pontos';
exception when check_violation then raise notice 'OK    estimativa fora da sequência é recusada (4)'; end $$;
update itens set pontos = 20, moscow = 'deve', valor = 8, valor_motivo = 'Reduz ligações', historia_quem = 'lojista', historia_quero = 'ver o saldo', historia_para = 'decidir a compra' where id = (select it from t);
select pg_temp.ok((select pontos = 20 and moscow = 'deve' and valor = 8 from itens where id = (select it from t)), 'grava 20 pontos, MoSCoW, valor e a história');

-- ---------- critérios: quem marcou e quando ----------
insert into itens_criterios (item_id, texto, ordem) values ((select it from t), 'Mostra o saldo', 0), ((select it from t), 'Funciona no celular', 1);
update itens_criterios set feito = true, marcado_por = (select ana from t) where item_id = (select it from t) and ordem = 0;
select pg_temp.ok((select marcado_por = (select wil from t) and marcado_em > now() - interval '1 minute' from itens_criterios where item_id = (select it from t) and ordem = 0), 'quem marcou é quem está logado (a tela não escolhe) e fica a hora');
update itens_criterios set ordem = 5 where item_id = (select it from t) and ordem = 0;
select pg_temp.ok((select marcado_por = (select wil from t) from itens_criterios where item_id = (select it from t) and ordem = 5), 'mudar a ordem não apaga quem marcou');

-- ---------- não aceita com critério desmarcado ----------
update itens set status_id = (select st_review from t) where id = (select it from t);
do $$ begin update itens set status_id = (select st_done from t) where id = (select it from t); raise notice 'FALHA aceitou com critério desmarcado';
exception when check_violation then raise notice 'OK    não vai para Aceito com critério desmarcado'; end $$;
update itens_criterios set feito = true where item_id = (select it from t);
reset role;

-- ---------- só o P.O. aceita e devolve ----------
update projetos set po_id = (select ana from t) where no_id = (select proj from t);
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin update itens set status_id = (select st_done from t) where id = (select it from t); raise notice 'FALHA quem não é P.O. aceitou';
exception when insufficient_privilege then raise notice 'OK    com P.O. definido, outra pessoa não aceita'; end $$;
do $$ begin update itens set voltou_em = now(), voltou_motivo = 'x', status_id = (select st_todo from t) where id = (select it from t); raise notice 'FALHA quem não é P.O. devolveu';
exception when insufficient_privilege then raise notice 'OK    e não devolve'; end $$;
do $$ begin update projetos set po_id = (select wil from t) where no_id = (select proj from t); raise notice 'FALHA tomou o papel de P.O.';
exception when insufficient_privilege then raise notice 'OK    ninguém toma o papel de P.O. de quem já é'; end $$;
reset role;
-- uma rotina (PR mesclado, publicação): não aceita sozinha, para em Pronto para testar
do $$ begin perform set_config('request.jwt.claim.sub', '', false); perform set_config('request.jwt.claims', '', false); end $$;
update itens set status_id = (select st_doing from t) where id = (select it from t);
do $$ begin perform interno.codigo_mover((select it from t), 'done'); end $$;
select pg_temp.ok((select (select s.grupo from status_fluxo s where s.id = status_id) = 'review' from itens where id = (select it from t)), 'PR mesclado não aceita sozinho: o item para em Pronto para testar');
update projetos set po_id = (select wil from t) where no_id = (select proj from t);
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update itens set voltou_em = now(), voltou_motivo = 'O saldo não bate', status_id = (select st_todo from t) where id = (select it from t);
select pg_temp.ok((select voltou_em is not null from itens where id = (select it from t)), 'o P.O. devolve (Voltou)');
update itens set status_id = (select st_review from t) where id = (select it from t);
select pg_temp.ok((select voltou_em is null from itens where id = (select it from t)), 'voltando para Pronto para testar, deixa de estar "Voltou"');
update itens set status_id = (select st_done from t) where id = (select it from t);
select pg_temp.ok((select (select s.grupo from status_fluxo s where s.id = status_id) = 'done' from itens where id = (select it from t)), 'o P.O. aceita com tudo marcado');

-- ---------- item aceito não muda: vira Melhoria ----------
do $$ begin update itens set historia_quero = 'outra coisa' where id = (select it from t); raise notice 'FALHA mudou a história do item aceito';
exception when check_violation then raise notice 'OK    item aceito não muda a história'; end $$;
do $$ begin insert into itens_criterios (item_id, texto) values ((select it from t), 'novo'); raise notice 'FALHA pôs critério no item aceito';
exception when check_violation then raise notice 'OK    nem ganha critério novo'; end $$;
do $$ begin update itens_criterios set feito = false where item_id = (select it from t); raise notice 'FALHA desmarcou critério do item aceito';
exception when check_violation then raise notice 'OK    nem desmarca critério'; end $$;

-- ---------- histórico ----------
do $$ begin insert into itens_historico (item_id, tipo, texto) values ((select it from t), 'situacao', 'falso'); raise notice 'FALHA a tela gravou no histórico';
exception when insufficient_privilege then raise notice 'OK    a tela não escreve no histórico (só o banco)'; end $$;
do $$ begin delete from itens_historico where item_id = (select it from t); if found then raise notice 'FALHA apagou histórico'; else raise notice 'OK    nem apaga'; end if;
exception when insufficient_privilege then raise notice 'OK    nem apaga'; end $$;
select pg_temp.ok((select count(*) from itens_historico where item_id = (select it from t) and tipo = 'situacao' and para = 'voltou' and texto = 'O saldo não bate' and pessoa_id = (select wil from t)) = 1, 'o histórico guarda o Voltou com o motivo e quem devolveu');
select pg_temp.ok((select count(*) from itens_historico where item_id = (select it from t) and tipo = 'situacao' and de = 'voltou' and para = 'review') = 1, 'e a volta para Pronto para testar');
select pg_temp.ok((select count(*) from itens_historico where item_id = (select it from t) and tipo = 'situacao' and para = 'done' and pessoa_id = (select wil from t)) = 1, 'e o aceite, com quem aceitou');
select pg_temp.ok((select count(*) from itens_historico where item_id = (select it from t) and tipo = 'criterio' and texto in ('criou','marcou')) >= 3, 'e os critérios criados e marcados');
reset role;
select pg_temp.ok((select count(*) from itens_historico where item_id = (select it from t) and tipo = 'situacao' and para = 'review' and pessoa_id is null) = 1, 'a parada automática em Pronto para testar fica sem pessoa (foi o sistema)');

-- ---------- sem P.O., tudo como antes ----------
update projetos set po_id = null where no_id = (select proj from t);
create temp table t2 as select (select i.id from itens i join status_fluxo s on s.id = i.status_id where i.tipo = 'task' and s.grupo <> 'done' and i.excluido_em is null order by i.criado_em limit 1) as it;
grant all on t2 to authenticated;
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
update itens set status_id = (select st_done from t) where id = (select it from t2);
select pg_temp.ok((select (select s.grupo from status_fluxo s where s.id = status_id) = 'done' from itens where id = (select it from t2)), 'projeto sem P.O. e item sem critérios: qualquer um do time conclui, como antes');
reset role;
-- item apagado de vez leva os critérios e o histórico junto, sem erro
create temp table t3 as select id from itens where tipo = 'subtask' and excluido_em is null limit 1;
insert into itens_criterios (item_id, texto) select id, 'apagar junto' from t3;
delete from itens where id = (select id from t3);
select pg_temp.ok((select count(*) from itens_criterios where texto = 'apagar junto') = 0, 'apagar o item de vez apaga os critérios e o histórico dele, sem erro');
