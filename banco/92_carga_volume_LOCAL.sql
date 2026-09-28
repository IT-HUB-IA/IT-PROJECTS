-- SOMENTE TESTE LOCAL: volume grande para medir desempenho
\timing on
alter table public.itens disable trigger itens_auditoria;
alter table public.itens disable trigger itens_automacoes;
alter table public.nos disable trigger nos_auditoria;
-- 50 clientes, 6 projetos cada, 5 aplicações por projeto, 4 frentes por aplicação
insert into nos (id, tipo, pai_id, nome) select gen_random_uuid(), 'cliente', null, 'CargaCli ' || g from generate_series(1,50) g;
insert into clientes (no_id) select id from nos where tipo='cliente' and nome like 'CargaCli %';
insert into nos (tipo, pai_id, nome) select 'projeto', c.id, 'CargaProj ' || g from nos c, generate_series(1,6) g where c.tipo='cliente' and c.nome like 'CargaCli %';
insert into projetos (no_id) select id from nos where tipo='projeto' and nome like 'CargaProj %';
insert into nos (tipo, pai_id, nome) select 'aplicacao', p.id, 'CargaApp ' || g from nos p, generate_series(1,5) g where p.tipo='projeto' and p.nome like 'CargaProj %';
insert into aplicacoes (no_id) select id from nos where tipo='aplicacao' and nome like 'CargaApp %';
insert into nos (tipo, pai_id, nome) select 'frente', a.id, 'CargaFr ' || g from nos a, generate_series(1,4) g where a.tipo='aplicacao' and a.nome like 'CargaApp %';
insert into frentes (no_id) select id from nos where tipo='frente' and nome like 'CargaFr %';
-- 30 pessoas; cada dev participa de 10 projetos
insert into pessoas (nome, papel, capacidade_h) select 'CargaDev ' || g, 'dev', 40 from generate_series(1,30) g;
insert into participacoes (pessoa_id, no_id, papel)
  select p.id, pr.id, 'dev' from (select id, row_number() over () rn from pessoas where nome like 'CargaDev %') p
  join lateral (select id from nos where tipo='projeto' and nome like 'CargaProj %' order by md5(id::text || p.rn) limit 10) pr on true;
-- 300 mil itens espalhados pelas frentes, com status e datas variados
insert into itens (frente_id, tipo, titulo, status_id, prioridade, responsavel_id, estimativa_h, inicio, prazo, criado_em)
select f.id, 'task', 'Item ' || g,
       (select id from status_fluxo where no_id is null order by ordem offset (g % 6) limit 1),
       (array['highest','high','medium','low'])[1 + g % 4],
       (select id from pessoas where nome = 'CargaDev ' || (1 + g % 30)),
       1 + g % 16, current_date - (g % 120), current_date - (g % 120) + (g % 40),
       now() - make_interval(days => g % 180)
  from generate_series(1, 300000) g
  join lateral (select id from nos where tipo='frente' and nome like 'CargaFr %' order by id offset (g % 6000) limit 1) f on true;
alter table public.itens enable trigger itens_auditoria;
alter table public.itens enable trigger itens_automacoes;
alter table public.nos enable trigger nos_auditoria;
-- 500 mil registros de auditoria (histórico)
insert into auditoria.registros (tabela, registro_id, acao, mudancas, em)
select 'itens', i.id, 'U', '{"status_id":[null,null]}'::jsonb, now() - make_interval(mins => (random()*200000)::int)
  from itens i, generate_series(1,2) g;
insert into auditoria.registros (tabela, registro_id, acao, mudancas, em)
select 'itens', i.id, 'U', '{"prazo":[null,null]}'::jsonb, now() - make_interval(mins => (random()*20000)::int) from itens i where random() < 0.3;
analyze;
select bi.atualizar();
select (select count(*) from nos) nos, (select count(*) from nos_ancestrais) ancestrais, (select count(*) from itens) itens, (select count(*) from auditoria.registros) auditoria;
