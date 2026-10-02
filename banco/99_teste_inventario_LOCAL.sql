-- SOMENTE TESTE LOCAL: parte 48 (inventário de TI por cliente). Roda depois das partes 00 a 48 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t as select
  (select n.id from nos n where n.tipo = 'cliente' and exists (select 1 from nos_ancestrais a join nos x on x.id = a.no_id and x.tipo = 'aplicacao' where a.ancestral_id = n.id) order by n.nome limit 1) as cli,
  null::uuid as outro, null::uuid as app, null::uuid as app_outro, null::uuid as cat_note, null::uuid as cat_cabo, null::uuid as sala, null::uuid as almox,
  null::uuid as joao, null::uuid as maria, null::uuid as note, null::uuid as monitor, null::uuid as cabo, null::uuid as lic, null::uuid as conf,
  (select auth_user_id from pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28') as uid;
update t set outro = (select n.id from nos n where n.tipo = 'cliente' and n.id <> t.cli order by n.nome limit 1),
             app = (select a.no_id from nos_ancestrais a join nos x on x.id = a.no_id and x.tipo = 'aplicacao' where a.ancestral_id = t.cli limit 1);
update t set app_outro = (select a.no_id from nos_ancestrais a join nos x on x.id = a.no_id and x.tipo = 'aplicacao' where a.ancestral_id = t.outro limit 1);
grant all on t to authenticated, service_role;
select set_config('request.jwt.claim.sub', (select uid::text from t), false), set_config('request.jwt.claims', json_build_object('sub', (select uid from t))::text, false);
set role authenticated;

select pg_temp.ok(interno.inv_pode((select cli from t)), 'quem edita o cliente pode mexer no inventário dele');
select pg_temp.ok(public.inv_preparar((select cli from t)) >= 20 and public.inv_preparar((select cli from t)) = 0, 'as categorias de começo são criadas uma vez só');
update t set cat_note = (select id from inv_categorias where cliente_id = t.cli and nome = 'Notebook'), cat_cabo = (select id from inv_categorias where cliente_id = t.cli and nome = 'Cabo');
with x as (insert into inv_locais (cliente_id, nome, tipo) select cli, 'Sala TI', 'sala' from t returning id) update t set sala = (select id from x);
with x as (insert into inv_locais (cliente_id, nome, tipo) select cli, 'Almoxarifado', 'almoxarifado' from t returning id) update t set almox = (select id from x);

-- funcionários: CPF conferido
do $$ begin insert into inv_funcionarios (cliente_id, nome, cpf) select cli, 'CPF errado', '12345678900' from t; raise notice 'FALHA aceitou CPF inválido';
exception when check_violation then raise notice 'OK    CPF inválido é recusado'; end $$;
with x as (insert into inv_funcionarios (cliente_id, nome, cpf, telefone, cargo, departamento) select cli, 'João Silva', '52998224725', '11999990000', 'Analista', 'Financeiro' from t returning id) update t set joao = (select id from x);
with x as (insert into inv_funcionarios (cliente_id, nome, cpf, cargo, departamento) select cli, 'Maria Souza', '11144477735', 'Gerente', 'Comercial' from t returning id) update t set maria = (select id from x);
do $$ begin insert into inv_funcionarios (cliente_id, nome, cpf) select cli, 'Repetido', '52998224725' from t; raise notice 'FALHA CPF repetido no mesmo cliente';
exception when unique_violation then raise notice 'OK    o mesmo CPF não entra duas vezes no cliente'; end $$;
insert into inv_funcionarios_apps (funcionario_id, cliente_id, no_id) select joao, cli, app from t;
do $$ begin insert into inv_funcionarios_apps (funcionario_id, cliente_id, no_id) select maria, cli, app_outro from t; raise notice 'FALHA aceitou aplicação de outro cliente';
exception when others then raise notice 'OK    aplicação de outro cliente não entra na lista do funcionário'; end $$;

-- equipamento: cadastro grava a primeira movimentação
with x as (insert into inv_ativos (cliente_id, categoria_id, patrimonio, numero_serie, descricao, local_id, data_compra, valor_compra, garantia_ate)
  select cli, cat_note, 'PAT-001', 'SN123', 'Notebook Dell Latitude', almox, current_date - 400, 5000, current_date + 30 from t returning id) update t set note = (select id from x);
with x as (insert into inv_ativos (cliente_id, categoria_id, patrimonio, descricao, local_id) select cli, (select id from inv_categorias where cliente_id = t.cli and nome = 'Monitor'), 'PAT-002', 'Monitor 24', almox from t returning id) update t set monitor = (select id from x);
select pg_temp.ok((select count(*) = 1 and min(tipo) = 'cadastro' and min(situacao_depois) = 'estoque' from inv_movimentos where ativo_id = (select note from t)), 'cadastrar já grava a primeira movimentação (cadastro, em estoque)');
do $$ begin insert into inv_ativos (cliente_id, categoria_id, patrimonio) select cli, cat_note, 'pat-001' from t; raise notice 'FALHA patrimônio repetido';
exception when unique_violation then raise notice 'OK    o patrimônio não se repete no mesmo cliente (sem diferença de maiúscula)'; end $$;
do $$ begin insert into inv_ativos (cliente_id, categoria_id, patrimonio) select outro, cat_note, 'X1' from t; raise notice 'FALHA usou categoria de outro cliente';
exception when others then raise notice 'OK    equipamento não usa categoria (nem local, nem funcionário) de outro cliente'; end $$;
do $$ begin update inv_ativos set situacao = 'uso_funcionario', funcionario_id = (select joao from t) where id = (select note from t); raise notice 'FALHA mudou a situação sem movimentação';
exception when insufficient_privilege then raise notice 'OK    a situação não muda direto na tabela, só por movimentação'; end $$;
do $$ begin update inv_ativos set acesso_onde = 'senha: 123' where id = (select note from t); raise notice 'FALHA aceitou senha';
exception when check_violation then raise notice 'OK    senha escrita em "onde fica o acesso" é recusada'; end $$;
update inv_ativos set hostname = 'NB-JOAO' where id = (select note from t);
select pg_temp.ok((select hostname = 'NB-JOAO' from inv_ativos where id = (select note from t)), 'os dados do equipamento mudam direto (hostname)');

-- entregar, emprestar, usar em aplicação, devolver, transferir
select public.inv_movimentar((select note from t), 'entrega', null, null, (select joao from t), null, null, 'Entrega na admissão');
select pg_temp.ok((select situacao = 'uso_funcionario' and funcionario_id = (select joao from t) from inv_ativos where id = (select note from t)), 'entregar ao funcionário: fica em uso por ele');
do $$ begin perform public.inv_movimentar((select monitor from t), 'emprestimo', null, null, (select maria from t), null, null, 'x'); raise notice 'FALHA empréstimo sem data de volta';
exception when check_violation then raise notice 'OK    empréstimo pede a data de volta'; end $$;
select public.inv_movimentar((select monitor from t), 'emprestimo', null, null, (select maria from t), null, current_date + 7, 'Home office');
select pg_temp.ok((select situacao = 'emprestado' and devolucao_prevista = current_date + 7 from inv_ativos where id = (select monitor from t)), 'emprestar: com a data de volta');
select public.inv_movimentar((select monitor from t), 'devolucao', null, (select sala from t), null, null, null, 'Voltou');
select pg_temp.ok((select situacao = 'estoque' and funcionario_id is null and local_id = (select sala from t) from inv_ativos where id = (select monitor from t)), 'devolver: volta ao estoque, no local escolhido');
select public.inv_movimentar((select monitor from t), 'uso_aplicacao', null, (select sala from t), null, (select app from t), null, 'Totem da aplicação');
select pg_temp.ok((select situacao = 'uso_aplicacao' and aplicacao_id = (select app from t) from inv_ativos where id = (select monitor from t)), 'em uso por uma aplicação do cliente');
do $$ begin perform public.inv_movimentar((select monitor from t), 'uso_aplicacao', null, null, null, (select app_outro from t), null, 'x'); raise notice 'FALHA usou aplicação de outro cliente';
exception when check_violation then raise notice 'OK    aplicação de outro cliente não entra'; end $$;
select public.inv_movimentar((select note from t), 'transferencia', null, (select sala from t), null, null, null, 'Mudou de sala');
select pg_temp.ok((select situacao = 'uso_funcionario' and funcionario_id = (select joao from t) and local_id = (select sala from t) from inv_ativos where id = (select note from t)), 'transferir de local não tira de quem está usando');
select pg_temp.ok((select string_agg(tipo || ':' || situacao_depois, ',' order by em) from inv_movimentos where ativo_id = (select note from t)) = 'cadastro:estoque,entrega:uso_funcionario,transferencia:uso_funcionario', 'o histórico guarda tudo, na ordem');

-- estorno: só a última, e volta como era
do $$ begin perform public.inv_estornar((select id from inv_movimentos where ativo_id = (select note from t) and tipo = 'entrega')); raise notice 'FALHA estornou uma que não é a última';
exception when check_violation then raise notice 'OK    só a última movimentação pode ser desfeita'; end $$;
select public.inv_estornar((select id from inv_movimentos where ativo_id = (select note from t) and tipo = 'transferencia'), 'Errei a sala');
select pg_temp.ok((select local_id is null and situacao = 'uso_funcionario' and funcionario_id = (select joao from t) from inv_ativos where id = (select note from t)) and (select count(*) = 1 from inv_movimentos where ativo_id = (select note from t) and tipo = 'estorno'), 'desfazer a última: volta como estava antes (com o João, sem local) e grava um estorno');
do $$ begin update inv_movimentos set motivo = 'mexi' where ativo_id = (select note from t); raise notice 'FALHA mudou o histórico';
exception when others then raise notice 'OK    o histórico não muda (nem com update direto)'; end $$;
do $$ begin delete from inv_ativos where id = (select note from t); if exists (select 1 from inv_ativos where id = (select note from t)) then raise notice 'OK    equipamento com movimentação não se apaga (dá baixa)'; else raise notice 'FALHA apagou equipamento com histórico'; end if; end $$;

-- pendências do funcionário e baixa
select pg_temp.ok((select count(*) = 1 from public.inv_pendencias_funcionario((select joao from t))), 'funcionário: o que está com ele (para recolher no desligamento)');
do $$ begin update inv_funcionarios set situacao = 'desligado' where id = (select joao from t);
  perform public.inv_movimentar((select monitor from t), 'entrega', null, null, (select joao from t), null, null, 'x'); raise notice 'FALHA entregou para desligado';
exception when check_violation then raise notice 'OK    não entrega para funcionário desligado'; end $$;
update inv_funcionarios set situacao = 'ativo' where id = (select joao from t);
do $$ begin perform public.inv_movimentar((select monitor from t), 'baixa', null, null, null, null, null, 'x'); raise notice 'FALHA baixou sem preencher a baixa';
exception when check_violation then raise notice 'OK    baixa pede o motivo e o descarte antes'; end $$;
insert into inv_baixas (ativo_id, cliente_id, motivo, metodo_apagamento, recicladora, cdf) select monitor, cli, 'sucata', 'sem_dados', 'Recicla SP', 'CDF-99' from t;
select public.inv_movimentar((select monitor from t), 'baixa', null, null, null, null, null, 'Tela queimada');
select pg_temp.ok((select situacao = 'baixado' from inv_ativos where id = (select monitor from t)), 'baixa com motivo e certificado');
do $$ begin perform public.inv_movimentar((select monitor from t), 'entrega', null, null, (select maria from t), null, null, 'x'); raise notice 'FALHA movimentou baixado';
exception when check_violation then raise notice 'OK    equipamento baixado não se movimenta mais'; end $$;

-- itens por quantidade
with x as (insert into inv_itens (cliente_id, categoria_id, nome, estoque_minimo) select cli, cat_cabo, 'Cabo HDMI 2m', 10 from t returning id) update t set cabo = (select id from x);
select public.inv_estoque((select cabo from t), 'entrada', (select almox from t), 30, null, null, null, 'Compra NF 123');
select public.inv_estoque((select cabo from t), 'saida', (select almox from t), 4, null, (select maria from t), null, 'Para a sala de reunião');
select public.inv_estoque((select cabo from t), 'transferencia', (select almox from t), 6, (select sala from t), null, null, '');
select pg_temp.ok((select string_agg(l.nome || '=' || s.quantidade::int, ',' order by l.nome) from inv_saldos s join inv_locais l on l.id = s.local_id where s.item_id = (select cabo from t)) = 'Almoxarifado=20,Sala TI=6', 'cabos: entrada 30, saída 4, transferência 6 = 20 no almoxarifado e 6 na sala');
do $$ begin perform public.inv_estoque((select cabo from t), 'saida', (select sala from t), 99, null, null, null, ''); raise notice 'FALHA saiu mais que o saldo';
exception when check_violation then raise notice 'OK    não sai mais do que tem'; end $$;
do $$ begin insert into inv_saldos (item_id, local_id, cliente_id, quantidade) select cabo, sala, cli, 1000 from t on conflict (item_id, local_id) do update set quantidade = 1000; raise notice 'FALHA mexeu no saldo direto';
exception when insufficient_privilege then raise notice 'OK    o saldo só muda pela movimentação'; end $$;

-- licenças
with x as (insert into inv_licencas (cliente_id, nome, quantidade, vence_em) select cli, 'Microsoft 365 Business', 1, current_date + 30 from t returning id) update t set lic = (select id from x);
insert into inv_licencas_uso (cliente_id, licenca_id, funcionario_id) select cli, lic, joao from t;
do $$ begin insert into inv_licencas_uso (cliente_id, licenca_id, funcionario_id) select cli, lic, maria from t; raise notice 'FALHA passou da quantidade';
exception when check_violation then raise notice 'OK    a licença não passa da quantidade comprada'; end $$;

-- conferência
with x as (insert into inv_conferencias (cliente_id, nome) select cli, 'Conferência anual' from t returning id) update t set conf = (select id from x);
select public.inv_conferir((select conf from t), (select note from t), true, (select almox from t), '');
select pg_temp.ok((select ultima_conferencia = current_date and proxima_conferencia = (current_date + interval '12 months')::date from inv_ativos where id = (select note from t)), 'conferir marca a data e a próxima conferência pela categoria (12 meses)');

-- outro usuário sem acesso não vê nada
reset role;
select pg_temp.ok(not exists (select 1 from inv_ativos a where a.cliente_id = (select outro from t)), '(nada foi gravado no outro cliente)');
set role service_role;
select pg_temp.ok(interno.inv_avisos() >= 2, 'os avisos do dia saem (garantia em 30 dias, licença em 30 dias)');
reset role;
set role anon;
do $$ begin perform 1 from inv_ativos; raise notice 'FALHA anônimo leu'; exception when insufficient_privilege then raise notice 'OK    anônimo não lê o inventário'; end $$;
reset role;
