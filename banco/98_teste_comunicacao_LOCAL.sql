-- SOMENTE TESTE LOCAL: parte 20 (menções, avisos, fila de e-mail, preferências e metas)
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when c then 'OK    ' else 'FALHA ' end || m $$;

-- quem é quem: William (dono do BL), Maria (dona do BL por compartilhamento), Ana (de fora), o CEO da B&L (stakeholder do BL)
create temp table gente as select
  'd148fdc5-eef3-5398-bf89-f49b55b5cd28'::uuid as william, '01309fc0-a358-4b33-870e-2f7ac8f6f1d2'::uuid as maria,
  'f51b69b0-5616-4a60-8b3b-c51e5bb60bfc'::uuid as ana, '2246aac4-fcc9-5564-af95-054b9cc42889'::uuid as ceo,
  (select i.id from itens i where i.excluido_em is null and not i.visivel_cliente and i.frente_id in (select no_id from nos_ancestrais where ancestral_id = 'cea3db88-841f-5511-98d1-3bedcc411131') order by i.chave limit 1) as item,
  'cea3db88-841f-5511-98d1-3bedcc411131'::uuid as projeto;
update pessoas set email = 'william@teste.com' where id = (select william from gente);
update itens set responsavel_id = (select william from gente), relator_id = null where id = (select item from gente);
delete from notificacoes;
grant select on gente to authenticated, service_role;

select pg_temp.ok(interno.pessoa_ve_item((select maria from gente), (select item from gente)), 'Maria vê o item do BL');
select pg_temp.ok(not interno.pessoa_ve_item((select ana from gente), (select item from gente)), 'Ana não vê o item do BL');
select pg_temp.ok(not interno.pessoa_ve_item((select ceo from gente), (select item from gente)), 'o CEO (stakeholder) não vê item interno');

-- ---------- Maria comenta mencionando William, Ana e o CEO ----------
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
insert into comentarios (item_id, autor_id, texto)
select item, maria, 'Oi @[William](' || william || '), veja isto. @[Ana Lima Costa](' || ana || ') e @[CEO](' || ceo || ') também.' from gente;
select pg_temp.ok((select count(*) from notificacoes) = 0, 'Maria não vê os avisos dos outros');
reset role;
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select william from gente) and tipo = 'mencao') = 1, 'William recebe o aviso de menção');
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select william from gente) and tipo = 'comentario') = 0, 'e não recebe outro de comentário pelo mesmo texto');
select pg_temp.ok((select texto like '%Oi @William, veja isto.%' from notificacoes where pessoa_id = (select william from gente) and tipo = 'mencao'), 'o texto do aviso mostra @William, sem o código');
select pg_temp.ok((select titulo from notificacoes where pessoa_id = (select william from gente)) = 'Maria Souza mencionou você', 'título diz quem mencionou');
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select ana from gente)) = 0, 'Ana, que não vê o item, não recebe nada');
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select ceo from gente)) = 0, 'o CEO não recebe aviso de comentário interno');
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select maria from gente)) = 0, 'quem comentou não é avisado');
select pg_temp.ok((select email_status = 'fila' and email_modo = 'diario' from notificacoes where pessoa_id = (select william from gente)), 'sem preferência: vai para o resumo do dia');

-- ---------- comentário sem menção: avisa o responsável ----------
insert into comentarios (item_id, autor_id, texto) select item, maria, 'Atualizei a descrição.' from gente;
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select william from gente) and tipo = 'comentario') = 1, 'comentário no item avisa o responsável');

-- ---------- preferências: William quer na hora e só menções ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
insert into pessoas_preferencias (pessoa_id, email_modo, email_tipos) select william, 'imediato', '{mencao}' from gente;
select pg_temp.ok((select count(*) from pessoas_preferencias) = 1, 'William grava a preferência dele');
do $$ begin
  begin insert into pessoas_preferencias (pessoa_id) select maria from gente; raise notice 'FALHA William gravou preferência da Maria';
  exception when insufficient_privilege then raise notice 'OK    ninguém grava preferência de outra pessoa'; end;
  begin update pessoas_preferencias set email_modo = 'toda hora'; raise notice 'FALHA aceitou modo inválido';
  exception when check_violation then raise notice 'OK    só imediato, diario ou nunca'; end;
  begin perform public.avisos_email_lote('imediato'); raise notice 'FALHA pessoa logada pegou o lote de e-mails';
  exception when insufficient_privilege then raise notice 'OK    só a função de avisos pega o lote de e-mails'; end;
  begin insert into notificacoes (pessoa_id, titulo) select maria, 'falso' from gente; raise notice 'FALHA William criou aviso para Maria';
  exception when insufficient_privilege then raise notice 'OK    ninguém cria aviso na mão para outra pessoa'; end;
end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
insert into comentarios (item_id, autor_id, texto) select item, maria, 'De novo @[William](' || william || ')' from gente;
insert into comentarios (item_id, autor_id, texto) select item, maria, 'Sem menção agora.' from gente;
select pg_temp.ok((select email_status = 'fila' and email_modo = 'imediato' from notificacoes where pessoa_id = (select william from gente) and texto like '%De novo%'), 'menção nova vai para o e-mail na hora');
select pg_temp.ok((select email_status is null from notificacoes where pessoa_id = (select william from gente) and texto like '%Sem menção agora.%'), 'comentário comum não vai por e-mail (ele só quer menções)');

-- ---------- responsável ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
update itens set responsavel_id = (select maria from gente) where id = (select item from gente);
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select maria from gente) and tipo = 'responsavel' and titulo = 'William passou um item para você') = 1, 'Maria é avisada quando vira responsável');
update itens set titulo = titulo where id = (select item from gente);
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select maria from gente) and tipo = 'responsavel') = 1, 'mexer em outra coisa não avisa de novo');
update itens set responsavel_id = (select william from gente) where id = (select item from gente);
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select william from gente) and tipo = 'responsavel') = 0, 'quem pega o item para si não é avisado');
update itens set responsavel_id = (select ana from gente) where id = (select item from gente);
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select ana from gente)) = 0, 'Ana, que não vê o item, não é avisada nem com o nome dela lá');
update itens set responsavel_id = (select william from gente) where id = (select item from gente);

-- ---------- lembretes da parte 18 ganham o tipo certo ----------
insert into notificacoes (pessoa_id, titulo, texto) select william, 'Lembrete: teste', 'x' from gente;
select pg_temp.ok((select tipo from notificacoes where titulo = 'Lembrete: teste') = 'lembrete', 'lembrete vira tipo lembrete');

-- ---------- a função de avisos pega o lote e marca ----------
set role service_role;
select pg_temp.ok(jsonb_array_length(public.avisos_email_lote('imediato')) = 1, 'lote imediato: um grupo (William)');
select pg_temp.ok(jsonb_array_length(public.avisos_email_lote('imediato')) = 0, 'o mesmo lote não sai duas vezes');
select pg_temp.ok(public.avisos_email_marcar((select array_agg(id) from notificacoes where email_status = 'enviando'), true) = 1, 'marca como enviado');
reset role;
update notificacoes set lida_em = now() where pessoa_id = (select william from gente) and tipo = 'comentario';
set role service_role;
create temp table lote_d as select public.avisos_email_lote('diario') as l;
select pg_temp.ok((select jsonb_array_length(g->'avisos') from lote_d, jsonb_array_elements(l) g where g->>'email' = 'william@teste.com') = 1, 'resumo do dia do William leva só o que ele ainda não leu');
select pg_temp.ok((select count(*) from lote_d, jsonb_array_elements(l) g) = 2, 'e o da Maria vai separado');
reset role;
select pg_temp.ok((select count(*) from notificacoes where email_status = 'ignorado') = 1, 'o que já foi lido fica como ignorado');
update notificacoes set email_em = now() - interval '1 hour' where email_status = 'enviando';
set role service_role;
select pg_temp.ok(jsonb_array_length(public.avisos_email_lote('diario')) = 2, 'o que ficou preso em "enviando" volta para a fila');
reset role;

-- ---------- relatório da semana ----------
update pessoas_preferencias set relatorio_semanal = true where pessoa_id = (select william from gente);
set role service_role;
select pg_temp.ok((select jsonb_array_length(public.relatorio_semanal_lote())) = 1 and (select public.relatorio_semanal_lote()->0 ? 'atrasados'), 'relatório da semana sai para quem pediu, com atrasados, próximos e feitos');
reset role;

-- ---------- metas ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
insert into metas (no_id, titulo, dono_id) select projeto, 'Lançar o app do CEO', william from gente;
insert into metas_resultados (meta_id, titulo, medida, inicial, alvo, atual, unidade) select id, 'Usuários ativos', 'numero', 0, 50, 10, 'pessoas' from metas;
insert into metas_resultados (meta_id, titulo, medida) select id, 'Itens do lançamento concluídos', 'itens' from metas;
insert into metas_resultados_itens (resultado_id, item_id) select r.id, (select item from gente) from metas_resultados r where r.medida = 'itens';
select pg_temp.ok((select count(*) from metas) = 1 and (select count(*) from metas_resultados) = 2 and (select count(*) from metas_resultados_itens) = 1, 'William cria meta com dois resultados e liga um item');
select pg_temp.ok((select criado_por from metas) = (select william from gente), 'a meta guarda quem criou');
do $$ begin
  begin insert into metas_resultados (meta_id, titulo, medida, inicial, alvo) select id, 'x', 'numero', 5, 5 from metas; raise notice 'FALHA aceitou alvo igual ao inicial';
  exception when check_violation then raise notice 'OK    resultado por número precisa de alvo diferente do inicial'; end;
end $$;
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from metas) = 0 and (select count(*) from metas_resultados) = 0 and (select count(*) from metas_resultados_itens) = 0, 'Ana não vê as metas do BL');
do $$ begin
  begin insert into metas (no_id, titulo) select projeto, 'invasão' from gente; raise notice 'FALHA Ana criou meta no BL';
  exception when insufficient_privilege then raise notice 'OK    Ana não cria meta no BL'; end;
end $$;
delete from metas;
reset role;
select pg_temp.ok((select count(*) from metas) = 1, 'Ana não apaga a meta do William');
select pg_temp.como('00000000-0000-0000-0000-00000000000c', 'ceo@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from metas) = 0, 'o CEO (stakeholder) não vê as metas internas');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
update metas_resultados set atual = 25 where medida = 'numero';
select pg_temp.ok((select atual from metas_resultados where medida = 'numero') = 25, 'Maria, dona do BL por compartilhamento, atualiza o resultado');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
delete from metas;
reset role;
select pg_temp.ok((select count(*) from metas_resultados) = 0 and (select count(*) from metas_resultados_itens) = 0, 'apagar a meta leva junto os resultados e os itens ligados (os itens em si ficam)');
select pg_temp.ok((select count(*) from itens where id = (select item from gente)) = 1, 'o item continua existindo');

-- ---------- conferências gerais ----------
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name in ('pessoas_preferencias','metas','metas_resultados','metas_resultados_itens') and grantee = 'anon') = 0, 'nada para quem não está logado');
select pg_temp.ok((select count(*) from information_schema.role_table_grants where table_name in ('pessoas_preferencias','metas','metas_resultados','metas_resultados_itens') and grantee = 'authenticated' and privilege_type = 'SELECT') = 4, 'as quatro tabelas novas têm GRANT para quem está logado');
select pg_temp.ok((select count(*) from pg_proc where proname in ('avisos_email_lote','avisos_email_marcar','relatorio_semanal_lote','avisar_comentario','avisar_responsavel','pessoa_ve_item','notificacao_preparar')) = 7, 'uma versão só de cada função nova');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.relatorio_semanal_lote()', 'execute') and not has_function_privilege('anon', 'public.avisos_email_marcar(uuid[], boolean)', 'execute'), 'as funções do e-mail não são chamadas por quem está logado nem de fora');
