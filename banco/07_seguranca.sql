-- =====================================================================
-- Sistema IT.IA · 07 · Segurança: RLS (quem vê cada linha) + GRANT (quem pode cada operação)
-- Papéis:  master = vê e muda tudo · dev = trabalha onde participa · stakeholder = só o visível ao cliente, sem valores
-- Padrão de desempenho: toda função dentro de uma regra vai entre parênteses com select, "(select interno.eh_master())",
-- para o banco calcular uma vez por consulta, e não uma vez por linha.
-- =====================================================================

-- recomeça do zero (este arquivo pode ser rodado de novo: recria todas as regras)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- liga a RLS em todas as tabelas do produto
-- (sem FORCE: as rotinas security definer, donas das tabelas, continuam lendo tudo para fazer as contas)
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- estrutura ----------
create policy ver on public.nos for select to authenticated using (id in (select interno.nos_visiveis()));
create policy master_muda on public.nos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.nos_ancestrais for select to authenticated using (no_id in (select interno.nos_visiveis()));

create policy ver on public.clientes   for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.projetos   for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.aplicacoes for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy ver on public.frentes    for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.clientes   for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master_muda on public.projetos   for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master_muda on public.aplicacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master_muda on public.frentes    for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- pessoas ----------
create policy ver on public.pessoas for select to authenticated using (ativo or (select interno.eh_master()));
create policy master_muda on public.pessoas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.participacoes for select to authenticated using ((select interno.eh_master()) or pessoa_id = (select interno.pessoa_atual()));
create policy master_muda on public.participacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- etiquetas ----------
create policy ver on public.etiquetas for select to authenticated using (true);
create policy master_muda on public.etiquetas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.etiquetas_nos for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.etiquetas_nos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- trabalho ----------
create policy ver on public.status_fluxo for select to authenticated using (no_id is null or no_id in (select interno.nos_visiveis()));
create policy master_muda on public.status_fluxo for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.sprints for select to authenticated using (projeto_id in (select interno.nos_visiveis()));
create policy time_muda on public.sprints for all to authenticated
  using (projeto_id in (select interno.nos_editaveis())) with check (projeto_id in (select interno.nos_editaveis()));

create policy ver on public.marcos for select to authenticated
  using (no_id in (select interno.nos_visiveis()) and (visivel_cliente or not (select interno.eh_stakeholder())));
create policy time_muda on public.marcos for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

create policy ver on public.itens for select to authenticated
  using (frente_id in (select interno.nos_visiveis()) and (visivel_cliente or not (select interno.eh_stakeholder())));
create policy time_cria on public.itens for insert to authenticated with check (frente_id in (select interno.nos_editaveis()));
create policy time_edita on public.itens for update to authenticated
  using (frente_id in (select interno.nos_editaveis())) with check (frente_id in (select interno.nos_editaveis()));
create policy master_apaga on public.itens for delete to authenticated using ((select interno.eh_master()));

-- tabelas penduradas no item: vale a visibilidade do item (a RLS de itens roda dentro do exists)
create policy ver on public.itens_ligacoes for select to authenticated using (exists (select 1 from public.itens i where i.id = origem_id));
create policy time_muda on public.itens_ligacoes for all to authenticated
  using (exists (select 1 from public.itens i where i.id = origem_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = origem_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.itens_checklist for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
create policy time_muda on public.itens_checklist for all to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.campos_personalizados for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.campos_personalizados for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.itens_campos for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
create policy time_muda on public.itens_campos for all to authenticated
  using (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))
  with check (exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.comentarios for select to authenticated using (
  (visivel_cliente or not (select interno.eh_stakeholder()))
  and ((item_id is not null and exists (select 1 from public.itens i where i.id = item_id))
       or (no_id is not null and no_id in (select interno.nos_visiveis()))));
create policy cria on public.comentarios for insert to authenticated with check (
  autor_id = (select interno.pessoa_atual())
  and (not (select interno.eh_stakeholder()) or visivel_cliente)
  and ((item_id is not null and exists (select 1 from public.itens i where i.id = item_id))
       or (no_id is not null and no_id in (select interno.nos_visiveis()))));
create policy autor_muda on public.comentarios for update to authenticated
  using (autor_id = (select interno.pessoa_atual()) or (select interno.eh_master())) with check (autor_id = (select interno.pessoa_atual()) or (select interno.eh_master()));
create policy autor_apaga on public.comentarios for delete to authenticated using (autor_id = (select interno.pessoa_atual()) or (select interno.eh_master()));

create policy ver on public.tempo_registros for select to authenticated using (
  pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master())
  or (not (select interno.eh_stakeholder()) and (frente_id in (select interno.nos_editaveis())
      or exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())))));
create policy dono_muda on public.tempo_registros for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()))
  with check (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()));

create policy ver on public.blocos_agenda for select to authenticated using (
  not (select interno.eh_stakeholder()) and exists (select 1 from public.itens i where i.id = item_id));
create policy dono_muda on public.blocos_agenda for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()))
  with check ((pessoa_id = (select interno.pessoa_atual()) or (select interno.eh_master()))
              and exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_editaveis())));

create policy ver on public.visoes_salvas for select to authenticated using (pessoa_id = (select interno.pessoa_atual()) or compartilhada);
create policy dono_muda on public.visoes_salvas for all to authenticated
  using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));

create policy master on public.automacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.automacoes_execucoes for select to authenticated using ((select interno.eh_master()));

create policy dono on public.notificacoes for select to authenticated using (pessoa_id = (select interno.pessoa_atual()));
create policy dono_marca_lida on public.notificacoes for update to authenticated
  using (pessoa_id = (select interno.pessoa_atual())) with check (pessoa_id = (select interno.pessoa_atual()));

create policy ver on public.quadros for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.quadros for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy ver on public.quadro_elementos for select to authenticated using (exists (select 1 from public.quadros q where q.no_id = quadro_id));
create policy time_muda on public.quadro_elementos for all to authenticated
  using (quadro_id in (select interno.nos_editaveis())) with check (quadro_id in (select interno.nos_editaveis()));

-- ---------- ficha técnica e etapas ----------
create policy ver on public.ficha_campos for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.ficha_campos for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy ver on public.decisoes for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.decisoes for all to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));
create policy master on public.segredos_catalogo for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.requisitos for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.requisitos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.etapas_modelo for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.etapas_modelo for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.etapas_modelo_itens for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.etapas_modelo_itens for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
-- cumprir e dispensar passam pelas rotinas cumprir_etapa e dispensar_etapa; o Master ajusta modo e prova direto
create policy ver on public.etapas_nos for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy master_muda on public.etapas_nos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.provas for select to authenticated using (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis()));
create policy master_muda on public.provas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- comercial e custos: só o Master (o time vê o catálogo, sem preços) ----------
create policy ver on public.servicos for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.servicos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.servicos_requisitos for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.servicos_requisitos for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
do $$
declare t text;
begin
  foreach t in array array['servicos_cobranca','regras_calculo','pessoas_custos','cambio','custos_operacao',
                           'custos_tecnicos','custos_uso','receitas'] loop
    execute format('create policy master on public.%I for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()))', t);
  end loop;
end $$;

-- ---------- service desk ----------
create policy ver on public.slas for select to authenticated using (no_id in (select interno.nos_visiveis()));
create policy master_muda on public.slas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

create policy ver on public.pedidos for select to authenticated using (
  autor_id = (select interno.pessoa_atual()) or (not (select interno.eh_stakeholder()) and no_id in (select interno.nos_visiveis())));
create policy cria on public.pedidos for insert to authenticated with check (
  autor_id = (select interno.pessoa_atual()) and no_id in (select interno.nos_visiveis()));
create policy time_muda on public.pedidos for update to authenticated
  using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

create policy ver on public.pedidos_mensagens for select to authenticated using (exists (select 1 from public.pedidos p where p.id = pedido_id));
create policy cria on public.pedidos_mensagens for insert to authenticated with check (
  pessoa_id = (select interno.pessoa_atual())
  and autor_tipo = case when (select interno.eh_stakeholder()) then 'cliente' else 'equipe' end
  and exists (select 1 from public.pedidos p where p.id = pedido_id));

-- ---------- agentes ----------
create policy ver on public.agentes for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.agentes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.agentes_fontes for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.agentes_fontes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy ver on public.agentes_ferramentas for select to authenticated using (not (select interno.eh_stakeholder()));
create policy master_muda on public.agentes_ferramentas for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.agentes_execucoes for select to authenticated using ((select interno.eh_master()));
create policy master on public.agentes_avaliacoes for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));

-- ---------- anexos: vale a visibilidade de onde o anexo está ----------
create or replace function interno.anexo_visivel(a public.anexos) returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$
  select case
    when a.no_id is not null then not interno.eh_stakeholder() and a.no_id in (select interno.nos_visiveis())
    when a.item_id is not null then exists (select 1 from public.itens i where i.id = a.item_id)
    when a.comentario_id is not null then exists (select 1 from public.comentarios c where c.id = a.comentario_id)
    when a.pedido_id is not null then exists (select 1 from public.pedidos p where p.id = a.pedido_id)
    when a.mensagem_id is not null then exists (select 1 from public.pedidos_mensagens m where m.id = a.mensagem_id)
    when a.prova_id is not null then exists (select 1 from public.provas pr where pr.id = a.prova_id)
    when a.decisao_id is not null then exists (select 1 from public.decisoes d where d.id = a.decisao_id)
    else false end
$$;
create policy ver on public.anexos for select to authenticated using (interno.anexo_visivel(anexos));
create policy cria on public.anexos for insert to authenticated with check (enviado_por = (select interno.pessoa_atual()) and interno.anexo_visivel(anexos));
create policy dono_apaga on public.anexos for delete to authenticated using (enviado_por = (select interno.pessoa_atual()) or (select interno.eh_master()));

-- ---------- desempenho: uma regra só por operação ----------
-- Onde a tabela tem uma regra "ver" (leitura) e outra regra de mudança escrita "para tudo", a leitura avaliaria as duas.
-- Aqui a regra de mudança vira três (incluir, alterar, apagar), com as mesmas condições, e a leitura fica só com a "ver".
do $$
declare p record; cond text; conf text;
begin
  for p in
    select a.tablename, a.policyname, a.qual, a.with_check
      from pg_policies a
     where a.schemaname = 'public' and a.cmd = 'ALL'
       and exists (select 1 from pg_policies b where b.schemaname = 'public' and b.tablename = a.tablename and b.cmd = 'SELECT')
  loop
    cond := p.qual; conf := coalesce(p.with_check, p.qual);
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p.policyname || '_inclui', p.tablename, conf);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p.policyname || '_altera', p.tablename, cond, conf);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', p.policyname || '_apaga', p.tablename, cond);
  end loop;
end $$;

-- =====================================================================
-- GRANT explícito (RLS filtra linhas; GRANT libera a operação. Sem os dois, a tela quebra)
-- =====================================================================
revoke all on all tables in schema public from anon, public;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to authenticated, service_role;

-- as views do BI respeitam a RLS de quem consulta
do $$
declare v text;
begin
  for v in select viewname from pg_views where schemaname = 'bi' loop
    execute format('alter view bi.%I set (security_invoker = true)', v);
  end loop;
end $$;
revoke all on all tables in schema bi from public, anon, authenticated;
grant select on all tables in schema bi to service_role;
revoke all on all tables in schema auditoria from public, anon, authenticated;

-- funções: ninguém executa por padrão; libera só o que a tela e as regras usam
revoke execute on all functions in schema public, interno, bi, auditoria from public, anon;
grant execute on function interno.pessoa_atual(), interno.eh_master(), interno.eh_stakeholder(),
                          interno.nos_visiveis(), interno.nos_editaveis(), interno.anexo_visivel(public.anexos) to authenticated;
grant execute on function bi.painel(uuid), bi.financeiro(uuid), bi.calcular_preco(numeric, text, text), bi.ficha_do_no(uuid),
                          bi.carga(date, date), bi.queima_sprint(uuid), bi.mudancas_recentes(uuid, int),
                          bi.hoje(), bi.mes_atual() to authenticated;
grant execute on function public.mover_no(uuid, uuid), public.trocar_foco(uuid), public.parar_foco(),
                          public.iniciar_cronometro(uuid), public.parar_cronometro(), public.converter_pedido(uuid, uuid, text),
                          public.cumprir_etapa(uuid, uuid, text, text), public.dispensar_etapa(uuid, uuid, text),
                          public.painel(uuid), public.financeiro(uuid), public.calcular_preco(numeric, text, text),
                          public.ficha(uuid), public.carga(date, date), public.queima_sprint(uuid), public.vincular_meu_login() to authenticated;
-- o miolo das rotinas da tela (as cascas da API chamam estas)
grant execute on function interno.mover_no(uuid, uuid), interno.trocar_foco(uuid), interno.parar_foco(),
                          interno.iniciar_cronometro(uuid), interno.parar_cronometro(), interno.converter_pedido(uuid, uuid, text),
                          interno.cumprir_etapa(uuid, uuid, text, text), interno.dispensar_etapa(uuid, uuid, text),
                          interno.vincular_meu_login() to authenticated;
grant execute on all functions in schema public, interno, bi, auditoria to service_role;

-- o Supabase dá permissão automática para anon em tudo que nasce no schema public. Aqui isso é desligado para o futuro:
-- tabela ou função nova só fica acessível quando alguém der o GRANT de propósito.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
