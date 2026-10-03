-- =====================================================================
-- Parte 62 · Ordem de serviço do banco nº1, onda 3: I1, I3, I4 e O5.
-- I1: índice em toda chave estrangeira que ainda não tinha (public, interno, auditoria). As tabelas são pequenas
--     (milhares de linhas), então o índice nasce em milissegundos; por isso sem "concurrently" (que não roda dentro
--     da transação da migração).
-- I3: rotinas de 10 em 10 e de 5 em 5 minutos deixam de cair no mesmo minuto; nova rotina de hora em hora avisa o dono do
--     sistema quando uma rotina falha 3 vezes seguidas. A limpeza do histórico do agendador espera o prazo do dono
--     (PRECISA_CONFIRMACAO_limpar_historico_agendador.sql).
-- I4: nas 13 tabelas com mais de uma política permissiva para a mesma ação, fica UMA política por ação, com a regra
--     igual à soma das antigas (A ou B). Quem enxerga o quê não muda (teste compara linha a linha por pessoa).
-- O5: comentário nas 64 tabelas do public que não tinham.
-- Plano de volta: 62_onda3_indices_rotinas_politicas_comentarios_VOLTA.sql.
-- =====================================================================

-- ---------- I1 ----------
do $$
declare f record; nome text; n int := 0;
begin
  for f in
    select c.conrelid, c.conrelid::regclass::text tab, rel.relname, rel.relnamespace::regnamespace::text esq,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) cols,
           (select string_agg(a.attname, '_' order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) nomes
      from pg_constraint c join pg_class rel on rel.oid = c.conrelid
     where c.contype = 'f' and rel.relnamespace in ('public'::regnamespace, 'interno'::regnamespace, 'auditoria'::regnamespace)
       and not exists (select 1 from pg_index i where i.indrelid = c.conrelid
                         and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey) loop
    nome := left(f.relname || '_' || f.nomes, 55) || '_fk_idx';
    execute format('create index if not exists %I on %s (%s)', nome, f.tab, f.cols);
    n := n + 1;
  end loop;
  raise notice 'I1: % índices de chave estrangeira criados', n;
end $$;

-- ---------- I3 ----------
-- (o agendador só existe no Supabase; no banco de teste local esta parte é pulada)
do $$
declare j record;
begin
  if to_regnamespace('cron') is null then return; end if;
  for j in select jobid, jobname from cron.job where jobname in ('ciclodev_bi_atualizar', 'ciclodev_diagramas_auto', 'ciclodev_email_imediato') loop
    perform cron.alter_job(j.jobid, schedule := case j.jobname when 'ciclodev_bi_atualizar' then '2-59/10 * * * *'
                                                               when 'ciclodev_diagramas_auto' then '6-59/10 * * * *'
                                                               else '4-59/5 * * * *' end);
  end loop;
end $$;

create or replace function interno.rotinas_conferir() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0; titulo text;
begin
  for r in
    select j.jobname, x.ultimas
      from cron.job j
      cross join lateral (select array_agg(d.status order by d.start_time desc) ultimas
                            from (select d2.status, d2.start_time from cron.job_run_details d2 where d2.jobid = j.jobid order by d2.start_time desc limit 3) d) x
     where j.active and cardinality(x.ultimas) = 3 and not ('succeeded' = any(x.ultimas)) and not ('running' = any(x.ultimas)) loop
    titulo := 'Rotina falhando: ' || r.jobname;
    insert into public.notificacoes (pessoa_id, titulo, texto, tipo)
    select d.pessoa_id, titulo, 'A rotina automática ' || r.jobname || ' falhou nas 3 últimas vezes. Veja o detalhe em cron.job_run_details.', 'aviso'
      from interno.donos_sistema d
     where not exists (select 1 from public.notificacoes x where x.pessoa_id = d.pessoa_id and x.titulo = titulo and x.criado_em > now() - interval '24 hours');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function interno.rotinas_conferir() from public, anon, authenticated, service_role;
do $$ begin
  if to_regnamespace('cron') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_rotinas_conferir';
  perform cron.schedule('ciclodev_rotinas_conferir', '41 * * * *', 'select interno.rotinas_conferir()');
end $$;

-- ---------- I4 ----------
do $$
declare t text; cmd record; u text; w text; n int;
begin
  foreach t in array array['custos_uso','dominios_registros','equipes','equipes_membros','espaco_membros','etapas_modelo_itens','etiquetas',
                           'infra_canvas','itens_criterios','servicos','servicos_cobranca','servicos_requisitos','vinculos_externos'] loop
    create temp table if not exists _pol (tab text, nome text, cmd "char", u text, w text) on commit drop;
    delete from _pol;
    insert into _pol select t, p.polname, p.polcmd, pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid)
      from pg_policy p where p.polrelid = ('public.' || quote_ident(t))::regclass and p.polpermissive
       and p.polroles = array['authenticated'::regrole]::oid[];
    for cmd in select * from (values ('r', 'ver'), ('a', 'cria'), ('w', 'muda'), ('d', 'apaga')) v(c, nome) loop
      select string_agg('(' || x.u || ')', ' or ') filter (where x.u is not null),
             string_agg('(' || coalesce(x.w, x.u) || ')', ' or ') filter (where coalesce(x.w, x.u) is not null), count(*)
        into u, w, n from _pol x where x.cmd in (cmd.c::"char", '*');
      if n = 0 then continue; end if;
      execute format('create policy %I on public.%I for %s to authenticated %s %s', '_nova_' || cmd.nome, t,
                     case cmd.c when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' else 'delete' end,
                     case when cmd.c <> 'a' and u is not null then 'using (' || u || ')' else '' end,
                     case when cmd.c in ('a', 'w') and w is not null then 'with check (' || w || ')' else '' end);
    end loop;
    for cmd in select nome from _pol loop execute format('drop policy %I on public.%I', cmd.nome, t); end loop;
    for cmd in select polname from pg_policy where polrelid = ('public.' || quote_ident(t))::regclass and polname like '\_nova\_%' loop
      execute format('alter policy %I on public.%I rename to %I', cmd.polname, t, substr(cmd.polname, 7));
    end loop;
  end loop;
end $$;

-- ---------- O5 ----------
comment on table public.analise_rodadas is 'Cada rodada da análise automática de um ponto (código ou banco): quantos arquivos, achados abertos, novos e corrigidos.';
comment on table public.anexos is 'Arquivos e links anexados a item, comentário, pedido, mensagem, prova ou decisão. O arquivo fica no Storage (bucket anexos), aqui só o caminho.';
comment on table public.aplicacoes is 'Dados de um nó do tipo aplicação: tipo, plataforma, de onde vem o código e o serviço contratado.';
comment on table public.automacoes is 'Regras automáticas de um ponto: quando acontece o gatilho e a condição bate, executa a ação.';
comment on table public.automacoes_execucoes is 'Registro de cada vez que uma automação rodou, em qual item e com que resultado. Só o banco grava.';
comment on table public.blocos_agenda is 'Blocos de tempo reservados na agenda de uma pessoa para trabalhar num item.';
comment on table public.boards_colunas_status is 'Quais situações do fluxo caem em cada coluna do quadro.';
comment on table public.cambio is 'Cotação diária de moedas (referência igual para todos). Usada em custos e receitas em moeda estrangeira.';
comment on table public.campos_personalizados is 'Campos extras que um ponto da estrutura define para os seus itens (nome, tipo e opções).';
comment on table public.clientes is 'Cadastro do cliente (nó do topo): tipo, documento, dados da empresa, endereço e holding. Tem dado pessoal/empresarial (LGPD).';
comment on table public.comentarios is 'Comentários em itens ou em pontos da estrutura; visivel_cliente marca o que o stakeholder também vê.';
comment on table public.comentarios_reacoes is 'Reações (emoji) de cada pessoa em um comentário.';
comment on table public.custos_operacao is 'Custos fixos da operação do espaço (ferramentas, aluguel...), com recorrência e depreciação.';
comment on table public.custos_tecnicos is 'Custos técnicos de um ponto (nuvem, licenças, APIs): fornecedor, plano, limites e repasse ao cliente.';
comment on table public.custos_uso is 'Uso e valor pago por mês de cada custo técnico.';
comment on table public.decisoes is 'Decisões registradas num ponto: o que foi decidido, por quê, alternativas, quem e quando.';
comment on table public.equipes_membros is 'Quem faz parte de cada equipe e com qual papel.';
comment on table public.espaco_membros is 'Pessoas convidadas para um espaço (multiempresa) e o papel de cada uma.';
comment on table public.etapas_modelo is 'Etapas do modelo de trabalho do espaço (ex.: descoberta, construção), com o que entregar em cada uma.';
comment on table public.etapas_modelo_itens is 'O que precisa ser cumprido em cada etapa do modelo (checklist, prova exigida, quem cumpre).';
comment on table public.etiquetas is 'Etiquetas do espaço (nome, cor, categoria) para marcar itens e pontos.';
comment on table public.etiquetas_itens is 'Quais etiquetas estão em cada item.';
comment on table public.etiquetas_nos is 'Quais etiquetas estão em cada ponto da estrutura.';
comment on table public.ficha_campos is 'Ficha técnica de um ponto: cada campo por seção, preenchido à mão ou pelo robô (repositório e banco).';
comment on table public.frentes is 'Dados de um nó do tipo frente: tipo, limite de trabalho em andamento e definição de pronto.';
comment on table public.integracoes_log is 'Registro de cada troca com uma integração externa (entrada ou saída, ok ou erro). Só leitura para quem está logado.';
comment on table public.inv_anexos is 'Inventário: arquivos de ativo, termo ou licença (o arquivo fica no Storage, bucket inventario).';
comment on table public.inv_baixas is 'Inventário: baixa de um ativo (motivo, como os dados foram apagados, destino e documentos).';
comment on table public.inv_categorias is 'Inventário: categorias de equipamento e material, com depreciação, vida útil e prazo de conferência.';
comment on table public.inv_conferencias is 'Inventário: rodadas de conferência física (onde, quando começou e terminou, quem fez).';
comment on table public.inv_conferencias_itens is 'Inventário: o que foi achado (ou não) em cada conferência, e onde.';
comment on table public.inv_funcionarios_apps is 'Inventário: em quais aplicações cada funcionário trabalha.';
comment on table public.inv_itens is 'Inventário: itens de estoque (material de consumo), com unidade, estoque mínimo e valor.';
comment on table public.inv_licencas is 'Inventário: licenças de software (quantidade, vencimento, renovação). A chave não fica aqui, só onde ela está guardada.';
comment on table public.inv_licencas_uso is 'Inventário: quem ou qual equipamento usa cada licença.';
comment on table public.inv_ligacoes is 'Inventário: ligação entre ativos (ex.: monitor ligado a um computador).';
comment on table public.inv_locais is 'Inventário: locais (prédio, sala, armário), em árvore.';
comment on table public.inv_manutencoes is 'Inventário: manutenções de um ativo (fornecedor, garantia, custo, item de trabalho ligado).';
comment on table public.inv_modelos is 'Inventário: modelos de equipamento (fabricante, especificações, fim de vida).';
comment on table public.inv_saldos is 'Inventário: quantidade de cada item de estoque em cada local (mantido pelo banco nas movimentações).';
comment on table public.inv_termos is 'Inventário: termos de responsabilidade gerados para funcionários (entrega e devolução), com data de assinatura.';
comment on table public.itens_campos is 'Valor de cada campo personalizado em cada item.';
comment on table public.itens_checklist is 'Checklist de um item (texto, feito, prazo e responsável).';
comment on table public.itens_ligacoes is 'Ligação entre itens (bloqueia, relaciona, duplica).';
comment on table public.marcos is 'Marcos de um ponto (entregas, metas), com data, entrega e se o cliente vê.';
comment on table public.metas_resultados_itens is 'Quais itens contribuem para cada resultado-chave de uma meta.';
comment on table public.notificacoes is 'Avisos para uma pessoa (menção, responsável, lembrete, automação) e o envio por e-mail.';
comment on table public.pedidos is 'Pedidos do Service Desk (dúvida, problema, melhoria) num ponto, com gravidade e situação.';
comment on table public.pedidos_mensagens is 'Mensagens da conversa de um pedido do Service Desk.';
comment on table public.pessoas is 'Pessoas do CicloDev (ligadas ao login do Supabase Auth): nome, e-mail, função, papel e espaço. Tem dado pessoal (LGPD).';
comment on table public.pessoas_custos is 'Custo de cada pessoa para o espaço (salário, pró-labore, PJ, benefícios). Dado sensível: só o dono do espaço vê.';
comment on table public.projetos is 'Dados de um nó do tipo projeto: datas, prefixo e sequência da chave dos itens, P.O., visão, riscos.';
comment on table public.provas is 'Provas enviadas para cumprir um requisito de etapa (arquivo, link ou texto).';
comment on table public.quadro_elementos is 'Elementos do quadro livre de um ponto (notas, cartões, setas) e suas posições.';
comment on table public.quadros is 'Quadro livre de um ponto (um por ponto); os elementos ficam em quadro_elementos.';
comment on table public.receitas is 'Receitas de um ponto (contrato, mensalidade, parcelas), por serviço.';
comment on table public.regras_calculo is 'Regras de cálculo de preço e custo (impostos, encargos, margens), com data de início de vigência.';
comment on table public.requisitos is 'Requisitos padrão que os serviços do espaço podem exigir.';
comment on table public.servicos is 'Catálogo de serviços do espaço (o que se vende, horas, SLA, frentes padrão).';
comment on table public.servicos_cobranca is 'Formas de cobrança de cada serviço (modelo e parâmetros).';
comment on table public.servicos_requisitos is 'Quais requisitos cada serviço exige.';
comment on table public.slas is 'Prazos de resposta e de solução por gravidade, por ponto (Service Desk).';
comment on table public.status_fluxo is 'Situações do fluxo de trabalho de um ponto (nome, cor, grupo: backlog, todo, doing, review, blocked, done).';
comment on table public.visoes_salvas is 'Visões salvas de uma lista ou quadro (filtros, agrupamento, ordem), de uma pessoa ou compartilhadas.';
