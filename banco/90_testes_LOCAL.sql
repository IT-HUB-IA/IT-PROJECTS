-- SOMENTE TESTE LOCAL. Roda depois de 00..08 e 91. Cada bloco falha com erro se a regra não se comportar.
\set ON_ERROR_STOP 1
\set QUIET 1
\pset pager off

-- ids úteis
select id as bl from nos where nome = 'Blanco & Lisboa' and tipo = 'cliente' \gset
select id as pj from nos where tipo = 'projeto' and nome = 'BL' \gset
select id as pr_bl from nos where tipo = 'produto' and nome = 'Blanco & Lisboa' \gset
select id as pr_you from nos where tipo = 'produto' and nome = 'YOU Contabilidade' \gset
select id as ap_fiscal from nos where tipo = 'aplicacao' and nome = 'Java Fiscal' \gset
select n.id as fr_fiscal from nos n where n.tipo = 'frente' and n.pai_id = :'ap_fiscal' and n.nome = 'Backend' \gset
select id as st_todo from status_fluxo where chave = 'todo' and no_id is null \gset
select id as st_doing from status_fluxo where chave = 'doing' and no_id is null \gset
select id as st_done from status_fluxo where chave = 'done' and no_id is null \gset
select id as st_blocked from status_fluxo where chave = 'blocked' and no_id is null \gset
select id as william from pessoas where nome = 'William' \gset
select id as ana from pessoas where nome like 'Ana%' \gset
select id as ceo from pessoas where nome like 'CEO%' \gset

\echo '1. Estrutura: não aceita frente direto no cliente'
do $$ begin
  begin
    insert into nos (tipo, pai_id, nome) select 'frente', id, 'x' from nos where tipo = 'cliente' limit 1;
    raise exception 'FALHOU: aceitou frente dentro de cliente';
  exception when check_violation then null; end;
end $$;

\echo '2. Estrutura: mover a aplicação troca os ancestrais e voltar desfaz'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select mover_no(:'ap_fiscal', :'pr_bl');
reset role;
do $$ declare n int; begin
  select count(*) into n from nos_ancestrais a join nos p on p.id = a.ancestral_id
   where a.no_id = (select id from nos where nome = 'Java Fiscal') and p.nome = 'Blanco & Lisboa' and p.tipo = 'produto';
  if n <> 1 then raise exception 'FALHOU: ancestral novo não entrou'; end if;
  select count(*) into n from nos_ancestrais a join nos p on p.id = a.ancestral_id
   where a.no_id in (select no_id from nos_ancestrais where ancestral_id = (select id from nos where nome = 'Java Fiscal'))
     and p.nome = 'YOU Contabilidade' and p.tipo = 'produto';
  if n <> 0 then raise exception 'FALHOU: ancestral antigo ficou no galho'; end if;
end $$;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select mover_no(:'ap_fiscal', :'pr_you');
reset role;
do $$ begin
  if (select count(*) from nos_ancestrais a join nos p on p.id = a.ancestral_id
       where a.no_id = (select id from nos where nome = 'Java Fiscal') and p.nome = 'YOU Contabilidade' and p.tipo = 'produto') <> 1
  then raise exception 'FALHOU: não voltou'; end if;
  -- a tabela de ancestrais precisa bater com a árvore recalculada do zero
  if exists (
    with recursive arv as (select id as no_id, id as ancestral_id, 0 as d from nos
                           union all select arv.no_id, n.pai_id, arv.d + 1 from arv join nos n on n.id = arv.ancestral_id where n.pai_id is not null)
    (select no_id, ancestral_id, d from arv except select no_id, ancestral_id, distancia from nos_ancestrais)
    union all
    (select no_id, ancestral_id, distancia from nos_ancestrais except select no_id, ancestral_id, d from arv))
  then raise exception 'FALHOU: tabela de ancestrais diferente da árvore'; end if;
end $$;

\echo '3. Itens: subtarefa sem pai e epic dentro de item são recusados'
do $$ begin
  begin
    insert into itens (frente_id, tipo, titulo, status_id) select id, 'subtask', 'x', (select id from status_fluxo where chave='todo' and no_id is null) from nos where tipo='frente' limit 1;
    raise exception 'FALHOU: subtarefa sem pai';
  exception when check_violation then null; end;
end $$;

\echo '4. Fluxo: concluir carimba a data; reabrir limpa; começar carimba o início'
do $$ declare i uuid; r record; begin
  insert into itens (frente_id, tipo, titulo, status_id)
    values ((select id from nos where tipo='frente' limit 1), 'task', 'teste fluxo', (select id from status_fluxo where chave='todo' and no_id is null)) returning id into i;
  update itens set status_id = (select id from status_fluxo where chave='doing' and no_id is null) where id = i;
  select * into r from itens where id = i;
  if r.iniciado_em is null or r.concluido_em is not null then raise exception 'FALHOU: início'; end if;
  update itens set status_id = (select id from status_fluxo where chave='done' and no_id is null) where id = i;
  select * into r from itens where id = i;
  if r.concluido_em is null then raise exception 'FALHOU: conclusão'; end if;
  update itens set status_id = (select id from status_fluxo where chave='doing' and no_id is null) where id = i;
  if (select concluido_em from itens where id = i) is not null then raise exception 'FALHOU: reabrir'; end if;
  delete from itens where id = i;
end $$;

\echo '5. Automações: bug concluído avisa quem abriu; bloqueado sobe a prioridade'
do $$ declare i uuid; n int; p text; begin
  insert into itens (frente_id, tipo, titulo, status_id, relator_id, prioridade)
    values ((select n.id from nos n join nos a on a.id = n.pai_id where a.nome='Java Fiscal' and n.nome='Backend'), 'bug', 'bug de teste',
            (select id from status_fluxo where chave='todo' and no_id is null), (select id from pessoas where nome like 'CEO%'), 'low') returning id into i;
  update itens set status_id = (select id from status_fluxo where chave='done' and no_id is null) where id = i;
  select count(*) into n from notificacoes where item_id = i and pessoa_id = (select id from pessoas where nome like 'CEO%');
  if n <> 1 then raise exception 'FALHOU: notificação do bug (%).', n; end if;
  update itens set status_id = (select id from status_fluxo where chave='blocked' and no_id is null) where id = i;
  select prioridade into p from itens where id = i;
  if p <> 'high' then raise exception 'FALHOU: prioridade do bloqueado = %', p; end if;
  if (select count(*) from automacoes_execucoes where item_id = i and resultado = 'ok') < 2 then raise exception 'FALHOU: registro das execuções'; end if;
  delete from itens where id = i;
end $$;

\echo '6. Permissões: dev não vê dinheiro nem segredos; stakeholder vê só o visível e não cria item'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  if (select count(*) from custos_tecnicos) + (select count(*) from receitas) + (select count(*) from pessoas_custos)
     + (select count(*) from regras_calculo) + (select count(*) from servicos_cobranca) <> 0 then raise exception 'FALHOU: dev viu valores'; end if;
  if (select count(*) from itens) = 0 then raise exception 'FALHOU: dev não vê os itens'; end if;
  begin perform financeiro((select id from nos where tipo='projeto' limit 1)); raise exception 'FALHOU: dev abriu o financeiro';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if exists (select 1 from itens where not visivel_cliente) then raise exception 'FALHOU: stakeholder viu item interno'; end if;
  if exists (select 1 from comentarios where not visivel_cliente) then raise exception 'FALHOU: stakeholder viu comentário interno'; end if;
  if (select count(*) from ficha_campos) + (select count(*) from custos_tecnicos) + (select count(*) from etapas_nos) <> 0 then raise exception 'FALHOU: stakeholder viu área interna'; end if;
  if ((painel((select id from nos where tipo='projeto' limit 1)))->'kpis'->>'total')::int <> (select count(*) from itens) then raise exception 'FALHOU: painel do stakeholder'; end if;
  begin
    insert into itens (frente_id, tipo, titulo, status_id) select id, 'task', 'x', (select id from status_fluxo where chave='todo' and no_id is null) from nos where tipo='frente' limit 1;
    raise exception 'FALHOU: stakeholder criou item';
  exception when insufficient_privilege then null; end;
end $$;
-- stakeholder abre pedido e conversa como cliente
insert into pedidos (no_id, autor_id, tipo, gravidade, titulo) values (:'ap_fiscal', :'ceo', 'duvida', 'incomodo', 'pedido de teste do stakeholder');
insert into pedidos_mensagens (pedido_id, autor_tipo, pessoa_id, texto)
  select id, 'cliente', :'ceo', 'olá' from pedidos where titulo = 'pedido de teste do stakeholder';
reset role;

\echo '7. Service desk: resposta da equipe carimba o SLA; converter vira item e não duplica'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into pedidos_mensagens (pedido_id, autor_tipo, pessoa_id, texto)
  select id, 'equipe', :'william', 'resposta' from pedidos where titulo = 'pedido de teste do stakeholder';
select converter_pedido((select id from pedidos where titulo = 'pedido de teste do stakeholder'), :'fr_fiscal') as item1 \gset
select converter_pedido((select id from pedidos where titulo = 'pedido de teste do stakeholder'), :'fr_fiscal') as item2 \gset
reset role;
do $$ declare p record; begin
  select * into p from pedidos where titulo = 'pedido de teste do stakeholder';
  if p.respondido_em is null then raise exception 'FALHOU: SLA de resposta'; end if;
  if p.status <> 'virou_item' or p.item_id is null then raise exception 'FALHOU: converter'; end if;
  if (select count(*) from itens where titulo = 'pedido de teste do stakeholder') <> 1 then raise exception 'FALHOU: duplicou o item'; end if;
  if (select situacao from bi.pedidos_sla where pedido_id = p.id) not in ('no_prazo','perto_do_limite') then raise exception 'FALHOU: situação do SLA'; end if;
end $$;
select :'item1' = :'item2' as mesmo_item \gset
\if :mesmo_item
\else
  \echo 'FALHOU: converter duas vezes gerou itens diferentes'
  select 1/0;
\endif

\echo '8. Tempo: só um cronômetro aberto por pessoa; trocar foco fecha o anterior'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select iniciar_cronometro(:'item1');
select iniciar_cronometro(:'item1');
select trocar_foco(:'fr_fiscal');
select trocar_foco(:'fr_fiscal');
reset role;
do $$ begin
  if (select count(*) from tempo_registros where fim is null and origem = 'cronometro' and pessoa_id = (select id from pessoas where nome like 'Ana%')) <> 1 then raise exception 'FALHOU: cronômetro'; end if;
  if (select count(*) from tempo_registros where fim is null and origem = 'foco' and pessoa_id = (select id from pessoas where nome like 'Ana%')) <> 1 then raise exception 'FALHOU: foco'; end if;
  if (select count(*) from tempo_registros where origem = 'foco' and pessoa_id = (select id from pessoas where nome like 'Ana%')) <> 2 then raise exception 'FALHOU: histórico do foco'; end if;
end $$;

\echo '9. Etapas: item que pede prova recusa sem prova e aceita com prova'
update etapas_modelo_itens set prova_tipo = 'link' where id = (select id from etapas_modelo_itens order by etapa_id, ordem offset 20 limit 1);
select id as it_prova from etapas_modelo_itens where prova_tipo = 'link' limit 1 \gset
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  begin perform cumprir_etapa((select id from nos where tipo='projeto' limit 1), (select id from etapas_modelo_itens where prova_tipo='link' limit 1));
        raise exception 'FALHOU: cumpriu sem prova';
  exception when check_violation then null; end;
end $$;
select cumprir_etapa(:'pj', :'it_prova', 'link', 'https://exemplo.com/prova');
reset role;
do $$ begin
  if (select situacao from bi.etapas_situacao where no_id = (select id from nos where tipo='projeto' limit 1)
        and item_modelo_id = (select id from etapas_modelo_itens where prova_tipo='link' limit 1)) <> 'cumprido' then raise exception 'FALHOU: etapa'; end if;
  if not exists (select 1 from provas where valor = 'https://exemplo.com/prova') then raise exception 'FALHOU: prova'; end if;
end $$;

\echo '10. Ciclos e agenda não se sobrepõem'
do $$ begin
  begin
    insert into sprints (projeto_id, nome, inicio, fim) select projeto_id, 'sobreposto', inicio + 1, fim + 1 from sprints limit 1;
    raise exception 'FALHOU: ciclo sobreposto';
  exception when exclusion_violation then null; end;
  begin
    insert into blocos_agenda (item_id, pessoa_id, inicio, fim) select item_id, pessoa_id, inicio + interval '10 minutes', fim from blocos_agenda limit 1;
    raise exception 'FALHOU: horário sobreposto';
  exception when exclusion_violation then null; end;
end $$;

\echo '11. Anexo: precisa de exatamente um dono e ser arquivo ou link'
do $$ begin
  begin insert into anexos (nome, tipo, url) values ('solto', 'link', 'https://x'); raise exception 'FALHOU: anexo sem dono';
  exception when check_violation then null; end;
end $$;

\echo '12. Toda tabela do produto tem RLS ligada e GRANT para authenticated; anon não tem nada'
do $$ declare t text; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'FALHOU: tabela sem RLS: %', t;
  end loop;
  for t in select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
           except select table_name from information_schema.role_table_grants where table_schema = 'public' and grantee = 'authenticated' and privilege_type = 'SELECT' loop
    raise exception 'FALHOU: tabela sem GRANT: %', t;
  end loop;
  if exists (select 1 from information_schema.role_table_grants where table_schema in ('public','bi','auditoria') and grantee = 'anon') then
    raise exception 'FALHOU: anon tem permissão';
  end if;
end $$;

\echo '13. Nenhuma função duplicada (overload)'
do $$ declare r record; begin
  for r in select n.nspname, p.proname, count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname in ('public','interno','bi','auditoria')
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
            group by 1, 2 having count(*) > 1 loop
    raise exception 'FALHOU: função duplicada %.%', r.nspname, r.proname;
  end loop;
end $$;

\echo '14. Os números do BI batem com os da tela do sistema (Catalog e Costs)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ declare f jsonb; begin
  if (calcular_preco(1)->>'preco')::numeric <> 207.03 then raise exception 'FALHOU: preço hora %', calcular_preco(1)->>'preco'; end if;
  f := financeiro((select id from nos where tipo = 'cliente' and nome = 'Blanco & Lisboa'));
  if (f->>'gasto_ate_hoje')::numeric <> 15310.07 then raise exception 'FALHOU: já gasto %', f->>'gasto_ate_hoje'; end if;
  if (f->>'cobrado_ate_hoje')::numeric <> 209000 then raise exception 'FALHOU: já cobrado %', f->>'cobrado_ate_hoje'; end if;
  if (f->>'custo_mes')::numeric <> 1424.75 then raise exception 'FALHOU: custo do mês %', f->>'custo_mes'; end if;
  if (f->>'a_receber')::numeric <> 60000 then raise exception 'FALHOU: a receber %', f->>'a_receber'; end if;
end $$;
reset role;


\echo '15. Código de terceiros: a aplicação ganha os itens a mais do Discovery'
do $$ declare antes int; depois int; ap uuid := (select id from nos where nome = 'Java Fiscal'); begin
  select count(*) into antes from bi.etapas_situacao where no_id = ap;
  update aplicacoes set origem_codigo = 'terceiros' where no_id = ap;
  select count(*) into depois from bi.etapas_situacao where no_id = ap;
  if depois - antes <> 3 then raise exception 'FALHOU: itens de terceiros (% → %)', antes, depois; end if;
  update aplicacoes set origem_codigo = 'proprio' where no_id = ap;
end $$;

\echo '16. Status personalizado conta no grupo dele no painel'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ declare b0 int; b1 int; it uuid; pj uuid := (select id from nos where tipo = 'projeto' and nome = 'BL'); begin
  b0 := (painel(pj)->'kpis'->>'bloqueados')::int;
  select i.id into it from itens i join status_fluxo s on s.id = i.status_id where s.grupo = 'todo' limit 1;
  update itens set status_id = (select id from status_fluxo where chave = 'cs_cli') where id = it;
  b1 := (painel(pj)->'kpis'->>'bloqueados')::int;
  if b1 <> b0 + 1 then raise exception 'FALHOU: status personalizado não somou (% → %)', b0, b1; end if;
end $$;
reset role;

\echo 'TODOS OS TESTES PASSARAM'
