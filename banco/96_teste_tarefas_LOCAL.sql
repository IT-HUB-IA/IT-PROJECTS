-- SOMENTE TESTE LOCAL: parte 18 (repetição, lembrete, histórico da descrição, lixeira e modelos)
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when c then 'OK    ' else 'FALHA ' end || m $$;

-- pontos de teste: uma frente do William com itens, e o app acima dela
create temp table alvo as
  select i.frente_id as frente, (select pai_id from nos where id = i.frente_id) as app, min(i.id::text)::uuid as item
    from itens i join nos n on n.id = i.frente_id join espaco_membros m on m.espaco_id = n.espaco_id
   where m.pessoa_id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' and m.papel = 'dono' and i.tipo in ('task','bug') group by i.frente_id limit 1;
grant select on alvo to authenticated;
select pg_temp.ok((select count(*) from alvo) = 1, 'achou uma frente do William com itens para testar');

-- ---------- William ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;

-- repetição: só no formato combinado
update itens set recorrencia = '{"freq":"semana","a_cada":2}' where id = (select item from alvo);
select pg_temp.ok((select recorrencia->>'freq' from itens where id = (select item from alvo)) = 'semana', 'grava a repetição (a cada 2 semanas)');
do $$ begin
  begin update itens set recorrencia = '{"freq":"hora"}' where id = (select item from alvo); raise notice 'FALHA aceitou repetição inválida';
  exception when check_violation then raise notice 'OK    recusa repetição fora do formato'; end;
end $$;

-- lembrete: sem pessoa escolhida, lembra quem marcou; mudar a hora volta a valer
update itens set lembrete_em = now() - interval '1 minute' where id = (select item from alvo);
select pg_temp.ok((select lembrete_para from itens where id = (select item from alvo)) = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'lembrete sem pessoa fica para quem marcou');
reset role;
select pg_temp.ok(interno.enviar_lembretes() = 1, 'a rotina manda o lembrete que venceu');
select pg_temp.ok((select count(*) from notificacoes where item_id = (select item from alvo) and titulo like 'Lembrete:%' and pessoa_id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28') = 1, 'o lembrete virou aviso para o William');
select pg_temp.ok(interno.enviar_lembretes() = 0, 'não manda o mesmo lembrete duas vezes');
set role authenticated;
update itens set lembrete_em = now() + interval '1 day' where id = (select item from alvo);
select pg_temp.ok((select lembrete_enviado_em is null from itens where id = (select item from alvo)), 'mudar a hora do lembrete faz ele valer de novo');

-- histórico da descrição
update itens set descricao = 'Primeira versão' where id = (select item from alvo);
update itens set descricao = 'Primeira versão, ajustada' where id = (select item from alvo);
select pg_temp.ok((select count(*) from itens_descricao_versoes where item_id = (select item from alvo) and texto = 'Primeira versão, ajustada') = 1
  and (select count(*) from itens_descricao_versoes where item_id = (select item from alvo) and texto = 'Primeira versão') = 0, 'edições seguidas da mesma pessoa ficam numa versão só');
reset role;
-- simula a passagem do tempo (o histórico é só de inserção desde a parte 59: o teste desliga a trava só para isto)
do $$ begin if exists (select 1 from pg_trigger where tgname = 'so_insercao' and tgrelid = 'public.itens_descricao_versoes'::regclass) then
  alter table public.itens_descricao_versoes disable trigger so_insercao; end if; end $$;
update itens_descricao_versoes set criado_em = now() - interval '1 hour' where item_id = (select item from alvo);
do $$ begin if exists (select 1 from pg_trigger where tgname = 'so_insercao' and tgrelid = 'public.itens_descricao_versoes'::regclass) then
  alter table public.itens_descricao_versoes enable trigger so_insercao; end if; end $$;
set role authenticated;
update itens set descricao = 'Segunda versão' where id = (select item from alvo);
select pg_temp.ok((select count(*) from itens_descricao_versoes where item_id = (select item from alvo)) >= 2, 'depois de um tempo, vira versão nova');
select pg_temp.ok((select texto from itens_descricao_versoes where item_id = (select item from alvo) order by criado_em desc limit 1) = 'Segunda versão', 'a versão mais nova é a atual');
do $$ begin
  begin insert into itens_descricao_versoes (item_id, texto) select item, 'falsa' from alvo; raise notice 'FALHA gravou versão na mão';
  exception when insufficient_privilege then raise notice 'OK    versão só pelo gatilho'; end;
end $$;

-- modelos
insert into modelos (tipo, nome, conteudo) values ('item', 'Bug padrão', '{"tipo":"bug","titulo":"Bug: ","check":["Reproduzir","Corrigir","Testar"]}');
insert into modelos (tipo, nivel, nome, conteudo) values ('estrutura', 'aplicacao', 'App web padrão', '{"nome":"App","filhos":[{"tipo":"frente","nome":"Frontend"}]}');
select pg_temp.ok((select count(*) from modelos) = 2 and (select espaco_id is not null and criado_por = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' from modelos where nome = 'Bug padrão'), 'modelo fica no espaço de quem criou');
do $$ begin
  begin insert into modelos (tipo, nome, conteudo) values ('estrutura', 'Sem nível', '{}'); raise notice 'FALHA modelo de estrutura sem nível';
  exception when check_violation then raise notice 'OK    modelo de estrutura precisa dizer o nível'; end;
end $$;

-- lixeira: item (com subitem junto)
insert into itens (frente_id, pai_id, tipo, titulo, status_id) select frente, item, 'subtask', 'Subitem do teste', (select id from status_fluxo where no_id is null and chave = 'todo') from alvo;
select public.lixeira_mover('item', (select item from alvo));
select pg_temp.ok((select count(*) from itens where id = (select item from alvo)) = 0, 'item na lixeira some da leitura normal');
select pg_temp.ok((select count(*) from itens where titulo = 'Subitem do teste') = 0, 'o subitem vai junto para a lixeira');
select pg_temp.ok((select count(*) from lixeira_listar() where tipo = 'item' and id = (select item from alvo) and dentro = 1) = 1, 'a lixeira mostra o item (e que tinha 1 coisa dentro)');
select pg_temp.ok((select count(*) from lixeira_listar() where nome = 'Subitem do teste') = 0, 'o subitem não aparece solto na lixeira');
select public.lixeira_restaurar('item', (select item from alvo));
select pg_temp.ok((select count(*) from itens where id = (select item from alvo) or titulo = 'Subitem do teste') = 2, 'restaurar traz o item e o subitem de volta');

-- lixeira: ponto da estrutura (aplicação com frente e itens dentro)
select public.lixeira_mover('no', (select app from alvo));
select pg_temp.ok((select count(*) from lixeira_listar() where tipo = 'aplicacao' and id = (select app from alvo) and dentro > 1) = 1, 'aplicação na lixeira, com o que tem dentro');
select pg_temp.ok(interno.no_na_lixeira((select frente from alvo)) is not null, 'a frente de dentro fica escondida junto');
do $$ begin
  begin perform public.lixeira_mover('item', (select item from alvo)); perform public.lixeira_restaurar('item', (select item from alvo)); raise notice 'FALHA restaurou item dentro de aplicação excluída';
  exception when raise_exception then raise notice 'OK    item de dentro só volta depois da aplicação'; end;
end $$;
select public.lixeira_restaurar('no', (select app from alvo));
select pg_temp.ok(interno.no_na_lixeira((select frente from alvo)) is null, 'restaurar a aplicação traz a frente de volta');

-- apagar de vez
insert into itens (frente_id, tipo, titulo, status_id) select frente, 'task', 'Para apagar de vez', (select id from status_fluxo where no_id is null and chave = 'todo') from alvo;
do $$ begin
  begin perform public.lixeira_apagar('item', (select id from itens where titulo = 'Para apagar de vez')); raise notice 'FALHA apagou de vez sem passar pela lixeira';
  exception when raise_exception then raise notice 'OK    só apaga de vez o que está na lixeira'; end;
end $$;
select public.lixeira_mover('item', (select id from itens where titulo = 'Para apagar de vez'));
reset role;
create temp table apagar as select id from itens where titulo = 'Para apagar de vez';
grant select on apagar to authenticated;
set role authenticated;
select public.lixeira_apagar('item', (select id from apagar));
reset role;
select pg_temp.ok((select count(*) from itens where id = (select id from apagar)) = 0, 'apagar de vez tira do banco');

-- limpeza de 30 dias (ponto com itens, custo e filhos)
insert into nos (tipo, pai_id, nome) select 'aplicacao', (select pai_id from nos where id = (select app from alvo)), 'App para limpar';
insert into aplicacoes (no_id) select id from nos where nome = 'App para limpar';
insert into nos (tipo, pai_id, nome) select 'frente', id, 'Frente para limpar' from nos where nome = 'App para limpar';
insert into frentes (no_id) select id from nos where nome = 'Frente para limpar';
insert into itens (frente_id, tipo, titulo, status_id) select id, 'task', 'Item para limpar', (select id from status_fluxo where no_id is null and chave = 'todo') from nos where nome = 'Frente para limpar';
update nos set excluido_em = now() - interval '31 days' where nome = 'App para limpar';
select pg_temp.ok(interno.lixeira_limpar() >= 1, 'a limpeza roda');
select pg_temp.ok((select count(*) from nos where nome in ('App para limpar', 'Frente para limpar')) = 0 and (select count(*) from itens where titulo = 'Item para limpar') = 0, 'depois de 30 dias sai de vez, com o que tinha dentro');

-- ---------- Maria: o William compartilhou o projeto BL com ela como owner ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
do $$ begin
  begin perform public.lixeira_mover('no', 'cea3db88-841f-5511-98d1-3bedcc411131'); raise notice 'FALHA Maria excluiu o projeto compartilhado com ela';
  exception when raise_exception then raise notice 'OK    o ponto compartilhado em si só o dono do espaço exclui'; end;
end $$;
reset role;

-- ---------- Ana (outro espaço, nada compartilhado com ela) ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
do $$ begin
  begin perform public.lixeira_mover('no', (select app from alvo)); raise notice 'FALHA Ana excluiu aplicação do William';
  exception when raise_exception then raise notice 'OK    Ana não exclui o que é do William'; end;
  begin perform public.lixeira_mover('item', (select item from alvo)); raise notice 'FALHA Ana excluiu item do William';
  exception when raise_exception then raise notice 'OK    Ana não exclui item do William'; end;
end $$;
select pg_temp.ok((select count(*) from modelos) = 0, 'Ana não vê os modelos do William');
select pg_temp.ok((select count(*) from itens_descricao_versoes) = 0, 'Ana não vê o histórico dos itens do William');
select pg_temp.ok((select count(*) from lixeira_listar()) = 0, 'a lixeira da Ana não mostra nada do William');
reset role;
set role anon;
do $$ begin
  begin perform public.lixeira_listar(); raise notice 'FALHA sem login usou a lixeira';
  exception when insufficient_privilege then raise notice 'OK    sem login ninguém usa a lixeira'; end;
end $$;
reset role;
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name = 'modelos' and grantee = 'authenticated') = 4, 'modelos: permissão (GRANT) para quem está logado');
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name = 'itens_descricao_versoes' and grantee = 'authenticated' and privilege_type = 'SELECT') = 1, 'versões: só leitura para quem está logado');
select pg_temp.ok((select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in ('lixeira_mover','lixeira_restaurar','lixeira_apagar','lixeira_listar')) = 4, 'uma versão só de cada função da lixeira');
