-- =====================================================================
-- Parte 67 · Ao vivo: a tela recebe na hora o que outra pessoa (ou o robô) mudou, sem recarregar a página.
-- Como funciona (o jeito que o Supabase recomenda para escala e segurança, "Broadcast from Database"):
--   1. Um gatilho POR INSTRUÇÃO (não por linha) em cada tabela que a tela usa junta as linhas mexidas e manda UM aviso
--      por espaço (empresa) pelo realtime.send, num canal PRIVADO "ciclodev:<espaço>". Importar 300 itens = 1 aviso.
--   2. O aviso leva só {t: tabela, c: coluna-chave, ids: valores dessa coluna, op}. NUNCA o conteúdo das linhas.
--      A tela relê essas linhas pela API normal, onde valem as regras de acesso de sempre (o que cada um pode ver,
--      o que o cliente não vê). Mesmo que alguém escutasse um canal, só veria identificadores.
--   3. Só entra no canal quem é do espaço ou participa de algum ponto dele (política em realtime.messages).
--   4. Um aviso que falha nunca derruba a gravação (o erro é engolido; na pior hipótese a tela não atualiza sozinha).
-- O que NÃO entra: uso_eventos (registro de uso, muda o tempo todo), nos_ancestrais (derivada de nos), logs e segredos.
-- Plano de volta: 67_ao_vivo_VOLTA.sql.
-- =====================================================================

-- de cada coisa para o espaço dela
-- (o "espaço" é texto: o id do espaço, "p:<pessoa>" para o que é de uma pessoa só, ou "geral")
create or replace function interno.av_esp_no(p uuid) returns text language sql stable security definer set search_path = public, pg_temp as
$$ select n.espaco_id::text from public.nos n where n.id = p $$;
create or replace function interno.av_esp_item(p uuid) returns text language sql stable security definer set search_path = public, pg_temp as
$$ select n.espaco_id::text from public.itens i join public.nos n on n.id = i.frente_id where i.id = p $$;
-- o que é de uma pessoa só (conversa com a IA, notificação, preferências) vai para o canal pessoal dela
create or replace function interno.av_esp_pessoa(p uuid) returns text language sql stable set search_path = public, pg_temp as $$ select 'p:' || p::text where p is not null $$;
revoke all on function interno.av_esp_no(uuid), interno.av_esp_item(uuid), interno.av_esp_pessoa(uuid) from public, anon, authenticated, service_role;

-- a lista: tabela, coluna que a tela usa para reler (a chave, ou o "dono" quando a chave é composta) e como achar o espaço (x = a linha)
create table if not exists interno.ao_vivo_tabelas (tabela text primary key, chave text not null, espaco text not null);
alter table interno.ao_vivo_tabelas enable row level security;
truncate interno.ao_vivo_tabelas;
insert into interno.ao_vivo_tabelas (tabela, chave, espaco) values
  -- estrutura e cadastros
  ('nos', 'id', 'x.espaco_id'), ('espacos', 'id', 'x.id'), ('espaco_membros', 'espaco_id', 'x.espaco_id'),
  ('pessoas', 'id', 'coalesce(x.espaco_id::text, (select m.espaco_id::text from public.espaco_membros m where m.pessoa_id = x.id order by m.desde limit 1))'), ('pessoas_custos', 'id', 'x.espaco_id'), ('pessoas_preferencias', 'pessoa_id', 'interno.av_esp_pessoa(x.pessoa_id)'),
  ('clientes', 'no_id', 'interno.av_esp_no(x.no_id)'), ('projetos', 'no_id', 'interno.av_esp_no(x.no_id)'),
  ('aplicacoes', 'no_id', 'interno.av_esp_no(x.no_id)'), ('frentes', 'no_id', 'interno.av_esp_no(x.no_id)'),
  ('participacoes', 'no_id', 'interno.av_esp_no(x.no_id)'), ('convites', 'id', 'interno.av_esp_no(x.no_id)'),
  ('etiquetas', 'id', 'x.espaco_id'), ('etiquetas_nos', 'no_id', 'interno.av_esp_no(x.no_id)'),
  ('status_fluxo', 'id', 'interno.av_esp_no(x.no_id)'), ('requisitos', 'id', 'x.espaco_id'), ('servicos', 'id', 'x.espaco_id'),
  ('servicos_cobranca', 'id', '(select s.espaco_id from public.servicos s where s.id = x.servico_id)'),
  ('servicos_requisitos', 'servico_id', '(select s.espaco_id from public.servicos s where s.id = x.servico_id)'),
  ('regras_calculo', 'espaco_id', 'x.espaco_id'), ('custos_operacao', 'id', 'x.espaco_id'), ('custos_tecnicos', 'id', 'interno.av_esp_no(x.no_id)'),
  ('custos_uso', 'custo_id', '(select interno.av_esp_no(c.no_id) from public.custos_tecnicos c where c.id = x.custo_id)'),
  ('receitas', 'id', 'interno.av_esp_no(x.no_id)'), ('slas', 'no_id', 'interno.av_esp_no(x.no_id)'),
  ('sprints', 'id', 'interno.av_esp_no(x.projeto_id)'), ('marcos', 'id', 'interno.av_esp_no(x.no_id)'),
  ('automacoes', 'id', 'interno.av_esp_no(x.no_id)'), ('campos_personalizados', 'id', 'interno.av_esp_no(x.no_id)'),
  ('ficha_campos', 'no_id', 'interno.av_esp_no(x.no_id)'), ('etapas_modelo', 'id', 'x.espaco_id'),
  ('etapas_modelo_itens', 'id', '(select e.espaco_id from public.etapas_modelo e where e.id = x.etapa_id)'),
  ('etapas_nos', 'no_id', 'interno.av_esp_no(x.no_id)'), ('provas', 'id', 'interno.av_esp_no(x.no_id)'),
  ('boards_config', 'no_id', 'interno.av_esp_no(x.no_id)'), ('boards_colunas', 'id', 'interno.av_esp_no(x.no_id)'),
  ('boards_colunas_status', 'coluna_id', '(select interno.av_esp_no(b.no_id) from public.boards_colunas b where b.id = x.coluna_id)'),
  ('equipes', 'id', 'x.espaco_id'), ('equipes_membros', 'equipe_id', '(select q.espaco_id from public.equipes q where q.id = x.equipe_id)'),
  ('equipes_nos', 'equipe_id', 'interno.av_esp_no(x.no_id)'),
  ('quadros', 'no_id', 'interno.av_esp_no(x.no_id)'), ('quadro_elementos', 'id', 'interno.av_esp_no(x.quadro_id)'),
  ('visoes_salvas', 'id', 'coalesce(interno.av_esp_no(x.no_id), interno.av_esp_pessoa(x.pessoa_id))'),
  ('modelos', 'id', 'x.espaco_id'), ('decisoes', 'id', 'interno.av_esp_no(x.no_id)'), ('metas', 'id', 'interno.av_esp_no(x.no_id)'),
  ('integracoes', 'id', 'coalesce(x.espaco_id::text, interno.av_esp_no(x.no_id))'), ('dominios', 'id', 'coalesce(x.espaco_id::text, interno.av_esp_no(x.no_id))'),
  ('dominios_registros', 'id', '(select coalesce(d.espaco_id::text, interno.av_esp_no(d.no_id)) from public.dominios d where d.id = x.dominio_id)'),
  -- itens e o que pendura neles
  ('itens', 'id', 'interno.av_esp_no(x.frente_id)'),
  ('itens_campos', 'item_id', 'interno.av_esp_item(x.item_id)'), ('itens_checklist', 'id', 'interno.av_esp_item(x.item_id)'),
  ('itens_criterios', 'id', 'interno.av_esp_item(x.item_id)'), ('itens_ligacoes', 'origem_id', 'interno.av_esp_item(x.origem_id)'),
  ('itens_pessoas', 'item_id', 'interno.av_esp_item(x.item_id)'), ('etiquetas_itens', 'item_id', 'interno.av_esp_item(x.item_id)'),
  ('itens_historico', 'id', 'interno.av_esp_item(x.item_id)'), ('itens_descricao_versoes', 'id', 'interno.av_esp_item(x.item_id)'),
  ('comentarios', 'id', 'coalesce(interno.av_esp_item(x.item_id), interno.av_esp_no(x.no_id))'),
  ('comentarios_reacoes', 'comentario_id', '(select coalesce(interno.av_esp_item(c.item_id), interno.av_esp_no(c.no_id)) from public.comentarios c where c.id = x.comentario_id)'),
  ('anexos', 'id', 'coalesce(interno.av_esp_item(x.item_id), interno.av_esp_no(x.no_id))'),
  ('blocos_agenda', 'id', 'coalesce(interno.av_esp_item(x.item_id), interno.av_esp_pessoa(x.pessoa_id))'),
  ('tempo_registros', 'id', 'coalesce(interno.av_esp_item(x.item_id), interno.av_esp_pessoa(x.pessoa_id))'),
  ('notificacoes', 'id', 'interno.av_esp_pessoa(x.pessoa_id)'),
  ('automacoes_execucoes', 'id', 'interno.av_esp_item(x.item_id)'), ('codigo_vinculos', 'id', 'interno.av_esp_item(x.item_id)'),
  ('perguntas_stakeholder', 'id', 'interno.av_esp_item(x.item_id)'),
  ('pedidos', 'id', 'interno.av_esp_no(x.no_id)'),
  ('pedidos_mensagens', 'id', '(select interno.av_esp_no(p.no_id) from public.pedidos p where p.id = x.pedido_id)'),
  -- portal
  ('portais', 'id', 'interno.av_esp_no(x.no_id)'),
  ('portais_membros', 'portal_id', '(select interno.av_esp_no(p.no_id) from public.portais p where p.id = x.portal_id)'),
  ('portais_chaves', 'id', '(select interno.av_esp_no(p.no_id) from public.portais p where p.id = x.portal_id)'),
  ('portais_eventos', 'id', '(select interno.av_esp_no(p.no_id) from public.portais p where p.id = x.portal_id)'),
  -- infraestrutura, automático, análise, ficha
  ('repositorios', 'id', 'interno.av_esp_no(x.no_id)'), ('infra_bancos', 'id', 'interno.av_esp_no(x.no_id)'),
  ('git_conexoes', 'id', 'x.espaco_id'), ('supa_conexoes', 'id', 'x.espaco_id'),
  ('infra_automacoes', 'id', 'interno.av_esp_no(x.no_id)'), ('infra_geracoes', 'id', 'interno.av_esp_no(x.no_id)'),
  ('infra_diagramas', 'id', 'interno.av_esp_no(x.no_id)'),
  ('infra_diagramas_versoes', 'diagrama_id', '(select interno.av_esp_no(d.no_id) from public.infra_diagramas d where d.id = x.diagrama_id)'),
  ('infra_canvas', 'no_id', 'interno.av_esp_no(x.no_id)'), ('publicacoes', 'id', 'interno.av_esp_no(x.no_id)'),
  ('analise_rodadas', 'no_id', 'interno.av_esp_no(x.no_id)'), ('analise_achados', 'id', 'interno.av_esp_no(x.no_id)'),
  ('analise_inventario', 'id', 'interno.av_esp_no(x.no_id)'), ('ficha_auto', 'id', 'interno.av_esp_no(x.no_id)'),
  -- servidores
  ('servidores', 'id', 'interno.av_esp_no(x.no_id)'),
  ('servidores_alcance', 'servidor_id', 'interno.av_esp_no(x.no_id)'),
  ('servidores_servicos', 'id', '(select interno.av_esp_no(s.no_id) from public.servidores s where s.id = x.servidor_id)'),
  ('servidores_custos', 'id', '(select interno.av_esp_no(s.no_id) from public.servidores s where s.id = x.servidor_id)'),
  ('servidores_lancamentos', 'id', '(select interno.av_esp_no(s.no_id) from public.servidores s where s.id = x.servidor_id)'),
  -- inventário (tudo pendura no cliente)
  ('inv_ativos', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_baixas', 'ativo_id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_anexos', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_categorias', 'id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_conferencias', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_conferencias_itens', 'ativo_id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_funcionarios', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_funcionarios_apps', 'funcionario_id', 'interno.av_esp_no(x.no_id)'),
  ('inv_itens', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_licencas', 'id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_licencas_uso', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_ligacoes', 'id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_locais', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_manutencoes', 'id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_modelos', 'id', 'interno.av_esp_no(x.cliente_id)'), ('inv_movimentos', 'id', 'interno.av_esp_no(x.cliente_id)'),
  ('inv_saldos', 'item_id', 'interno.av_esp_no(x.cliente_id)'), ('inv_termos', 'id', 'interno.av_esp_no(x.cliente_id)'),
  -- conversa com a IA (de cada pessoa) e o Agent Studio (sem espaço: canal "geral")
  ('ia_mensagens', 'id', 'interno.av_esp_pessoa(x.pessoa_id)'),
  ('studio_agentes', 'id', '''geral'''), ('studio_conhecimento', 'id', '''geral'''), ('studio_funcoes', 'id', '''geral'''),
  ('studio_instrucoes_versoes', 'id', '''geral''');

-- o aviso: um por espaço, por instrução. Os argumentos (chave e espaço) vêm da lista acima, nunca de quem grava.
create or replace function interno.ao_vivo_avisar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare parte text; r record; muitas constant int := 300;
begin
  parte := case TG_OP when 'INSERT' then 'select (%1$s)::text e, x.%2$I::text k from novas x'
                      when 'DELETE' then 'select (%1$s)::text e, x.%2$I::text k from velhas x'
                      else 'select (%1$s)::text e, x.%2$I::text k from novas x union all select (%1$s)::text e, x.%2$I::text k from velhas x' end;
  for r in execute format('select e, array_agg(distinct k) ks from (' || parte || ') s where e is not null and k is not null group by e', TG_ARGV[1], TG_ARGV[0]) loop
    begin
      -- muitas linhas de uma vez (importação grande): manda "relê a tabela" em vez da lista
      perform realtime.send(jsonb_build_object('t', TG_TABLE_NAME, 'c', TG_ARGV[0], 'op', left(TG_OP, 1),
                              'ids', case when cardinality(r.ks) > muitas then null else to_jsonb(r.ks) end),
                            'mudou', 'ciclodev:' || r.e, true);
    exception when others then null;   -- o aviso ao vivo nunca derruba a gravação
    end;
  end loop;
  return null;
exception when others then return null;
end $$;
revoke all on function interno.ao_vivo_avisar() from public, anon, authenticated, service_role;

-- liga os gatilhos (três por tabela: incluir, alterar, apagar; cada um vê as linhas mexidas de uma vez só)
do $$
declare t record;
begin
  for t in select * from interno.ao_vivo_tabelas loop
    if to_regclass('public.' || t.tabela) is null then continue; end if;
    execute format('drop trigger if exists zz_ao_vivo_i on public.%I', t.tabela);
    execute format('drop trigger if exists zz_ao_vivo_u on public.%I', t.tabela);
    execute format('drop trigger if exists zz_ao_vivo_d on public.%I', t.tabela);
    execute format('create trigger zz_ao_vivo_i after insert on public.%I referencing new table as novas for each statement execute function interno.ao_vivo_avisar(%L, %L)', t.tabela, t.chave, t.espaco);
    execute format('create trigger zz_ao_vivo_u after update on public.%I referencing old table as velhas new table as novas for each statement execute function interno.ao_vivo_avisar(%L, %L)', t.tabela, t.chave, t.espaco);
    execute format('create trigger zz_ao_vivo_d after delete on public.%I referencing old table as velhas for each statement execute function interno.ao_vivo_avisar(%L, %L)', t.tabela, t.chave, t.espaco);
  end loop;
end $$;

-- os canais de cada pessoa: os espaços dela, os espaços onde ela participa de algum ponto (convidado), o pessoal dela e o "geral"
create or replace function interno.ao_vivo_meus_topicos() returns setof text
language sql stable security definer set search_path = public, pg_temp as $$
  select 'ciclodev:' || e::text from (select interno.meus_espacos() e
    union select n.espaco_id from public.nos n where n.id in (select interno.nos_visiveis())) s where e is not null
  union all select 'ciclodev:p:' || interno.pessoa_atual()::text where interno.pessoa_atual() is not null
  union all select 'ciclodev:geral' where interno.pessoa_atual() is not null
$$;
revoke all on function interno.ao_vivo_meus_topicos() from public, anon;
grant execute on function interno.ao_vivo_meus_topicos() to authenticated;

-- a tela pergunta em quais canais entrar
create or replace function logica.ao_vivo_topicos() returns text[]
language sql stable security definer set search_path = public, pg_temp as $$ select coalesce(array_agg(t order by t), '{}') from interno.ao_vivo_meus_topicos() t $$;
revoke all on function logica.ao_vivo_topicos() from public, anon;
grant execute on function logica.ao_vivo_topicos() to authenticated;
create or replace function public.ao_vivo_topicos() returns text[]
language sql security invoker set search_path = '' as $$ select logica.ao_vivo_topicos() $$;
comment on function public.ao_vivo_topicos() is 'Porta da API (security invoker). Os canais ao vivo da pessoa logada; a regra está em interno.ao_vivo_meus_topicos.';
revoke all on function public.ao_vivo_topicos() from public, anon;
grant execute on function public.ao_vivo_topicos() to authenticated;

-- quem pode RECEBER num canal privado do CicloDev (ninguém manda por aqui: só o banco, pelo realtime.send)
do $$ begin
  if to_regclass('realtime.messages') is null then return; end if;
  drop policy if exists ciclodev_ao_vivo_receber on realtime.messages;
  create policy ciclodev_ao_vivo_receber on realtime.messages for select to authenticated
    using (realtime.messages.extension = 'broadcast'
           and (select realtime.topic()) like 'ciclodev:%'
           and (select realtime.topic()) in (select interno.ao_vivo_meus_topicos()));
end $$;
