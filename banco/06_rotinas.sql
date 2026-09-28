-- =====================================================================
-- Sistema IT.IA · 06 · Rotinas chamadas pela tela (RPC) e motor das automações
-- Toda rotina confere a permissão da pessoa atual antes de agir.
-- O miolo com poder de dono (security definer) fica no schema interno, fora da API.
-- Na API (schema public) fica só a casca, sem poder especial, que chama o miolo.
-- =====================================================================

-- ---------- estrutura ----------
create or replace function interno.mover_no(p_no uuid, p_novo_pai uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not interno.eh_master() then raise exception 'Só o Master move a estrutura' using errcode = '42501'; end if;
  update public.nos set pai_id = p_novo_pai where id = p_no;
  if not found then raise exception 'Registro não encontrado' using errcode = 'P0002'; end if;
end $$;

-- ---------- tempo ----------
create or replace function interno.trocar_foco(p_frente uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); novo uuid;
begin
  if eu is null then raise exception 'Pessoa não identificada' using errcode = '42501'; end if;
  if p_frente not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a esta frente' using errcode = '42501'; end if;
  update public.tempo_registros set fim = now() where pessoa_id = eu and origem = 'foco' and fim is null;
  insert into public.tempo_registros (pessoa_id, origem, frente_id, inicio) values (eu, 'foco', p_frente, now()) returning id into novo;
  return novo;
end $$;

create or replace function interno.parar_foco()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.tempo_registros set fim = now() where pessoa_id = interno.pessoa_atual() and origem = 'foco' and fim is null
$$;

create or replace function interno.iniciar_cronometro(p_item uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); novo uuid; f uuid;
begin
  select frente_id into f from public.itens where id = p_item;
  if eu is null or f is null or f not in (select interno.nos_editaveis()) then
    raise exception 'Sem acesso a este item' using errcode = '42501';
  end if;
  update public.tempo_registros set fim = now() where pessoa_id = eu and origem = 'cronometro' and fim is null;
  insert into public.tempo_registros (pessoa_id, origem, item_id, inicio) values (eu, 'cronometro', p_item, now()) returning id into novo;
  return novo;
end $$;

create or replace function interno.parar_cronometro()
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.tempo_registros set fim = now() where pessoa_id = interno.pessoa_atual() and origem = 'cronometro' and fim is null
$$;

-- ---------- service desk ----------
create or replace function interno.converter_pedido(p_pedido uuid, p_frente uuid, p_tipo text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare p record; novo uuid; st uuid;
begin
  if p_frente not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a esta frente' using errcode = '42501'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido não encontrado' using errcode = 'P0002'; end if;
  if p.item_id is not null then return p.item_id; end if;
  select id into st from public.status_fluxo where no_id is null and grupo = 'backlog' order by ordem limit 1;
  insert into public.itens (frente_id, tipo, titulo, descricao, status_id, prioridade, relator_id, visivel_cliente)
  values (p_frente, coalesce(p_tipo, case when p.tipo in ('bug','correcao') then 'bug' else 'story' end), p.titulo,
          'Veio do Service Desk.', st,
          case p.gravidade when 'parado' then 'highest' when 'quebrada' then 'high' when 'incomodo' then 'medium' else 'low' end,
          p.autor_id, true)
  returning id into novo;
  update public.pedidos set item_id = novo, status = 'virou_item' where id = p_pedido;
  return novo;
end $$;

-- ---------- etapas ----------
create or replace function interno.cumprir_etapa(p_no uuid, p_item_modelo uuid, p_prova_tipo text default null, p_valor text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare pedida text;
begin
  if p_no not in (select interno.nos_editaveis()) then raise exception 'Sem acesso a este projeto' using errcode = '42501'; end if;
  select prova_tipo into pedida from bi.etapas_situacao where no_id = p_no and item_modelo_id = p_item_modelo;
  if pedida is null then raise exception 'Item de etapa não encontrado' using errcode = 'P0002'; end if;
  if pedida <> 'nenhuma' and (p_prova_tipo is null or p_valor is null or length(btrim(p_valor)) = 0) then
    raise exception 'Este item pede prova do tipo %', pedida using errcode = '23514';
  end if;
  insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em)
  values (p_no, p_item_modelo, 'cumprido', interno.pessoa_atual(), now())
  on conflict (no_id, item_modelo_id) do update
     set situacao = 'cumprido', cumprido_por = excluded.cumprido_por, cumprido_em = excluded.cumprido_em, motivo_dispensa = null;
  if p_prova_tipo is not null and p_prova_tipo <> 'nenhuma' then
    insert into public.provas (no_id, item_modelo_id, tipo, valor, enviado_por)
    values (p_no, p_item_modelo, p_prova_tipo, p_valor, interno.pessoa_atual());
  end if;
end $$;

create or replace function interno.dispensar_etapa(p_no uuid, p_item_modelo uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not interno.eh_master() then raise exception 'Só o Master dispensa um item de etapa' using errcode = '42501'; end if;
  insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em, motivo_dispensa)
  values (p_no, p_item_modelo, 'dispensado', interno.pessoa_atual(), now(), p_motivo)
  on conflict (no_id, item_modelo_id) do update
     set situacao = 'dispensado', cumprido_por = excluded.cumprido_por, cumprido_em = excluded.cumprido_em, motivo_dispensa = excluded.motivo_dispensa;
end $$;

-- ---------- login: liga a pessoa do time ao login pelo e-mail confirmado ----------
-- Só liga quando a pessoa ainda não tem login e o e-mail do login é o mesmo cadastrado nela.
create or replace function interno.vincular_meu_login()
returns table (pessoa_id uuid, nome text, papel text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := auth.uid(); meu_email text := lower(nullif(auth.jwt()->>'email', ''));
begin
  if eu is null then raise exception 'Faça login primeiro' using errcode = '42501'; end if;
  if meu_email is not null and not exists (select 1 from public.pessoas where auth_user_id = eu) then
    update public.pessoas set auth_user_id = eu
     where auth_user_id is null and ativo and lower(email) = meu_email;
  end if;
  return query select p.id, p.nome, p.papel from public.pessoas p where p.auth_user_id = eu and p.ativo;
end $$;

-- ---------- cascas na API (security invoker): a tela chama estas ----------
create or replace function public.mover_no(p_no uuid, p_novo_pai uuid) returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.mover_no(p_no, p_novo_pai) $$;
create or replace function public.trocar_foco(p_frente uuid) returns uuid
language sql security invoker set search_path = public, pg_temp as $$ select interno.trocar_foco(p_frente) $$;
create or replace function public.parar_foco() returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.parar_foco() $$;
create or replace function public.iniciar_cronometro(p_item uuid) returns uuid
language sql security invoker set search_path = public, pg_temp as $$ select interno.iniciar_cronometro(p_item) $$;
create or replace function public.parar_cronometro() returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.parar_cronometro() $$;
create or replace function public.converter_pedido(p_pedido uuid, p_frente uuid, p_tipo text default null) returns uuid
language sql security invoker set search_path = public, pg_temp as $$ select interno.converter_pedido(p_pedido, p_frente, p_tipo) $$;
create or replace function public.cumprir_etapa(p_no uuid, p_item_modelo uuid, p_prova_tipo text default null, p_valor text default null) returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.cumprir_etapa(p_no, p_item_modelo, p_prova_tipo, p_valor) $$;
create or replace function public.dispensar_etapa(p_no uuid, p_item_modelo uuid, p_motivo text) returns void
language sql security invoker set search_path = public, pg_temp as $$ select interno.dispensar_etapa(p_no, p_item_modelo, p_motivo) $$;

create or replace function public.vincular_meu_login() returns table (pessoa_id uuid, nome text, papel text)
language sql security invoker set search_path = public, pg_temp as $$ select * from interno.vincular_meu_login() $$;

-- ---------- leitura do BI pela tela (a API só enxerga o schema public) ----------
create or replace function public.painel(p_no uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$ select bi.painel(p_no) $$;
create or replace function public.financeiro(p_no uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$ select bi.financeiro(p_no) $$;
create or replace function public.calcular_preco(p_horas numeric, p_complexidade text default 'Média', p_urgencia text default 'Normal') returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$ select bi.calcular_preco(p_horas, p_complexidade, p_urgencia) $$;
create or replace function public.ficha(p_no uuid)
returns table (secao text, campo text, valor text, personalizado boolean, herdado boolean, origem_id uuid, origem_nome text)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from bi.ficha_do_no(p_no) $$;
create or replace function public.carga(p_de date, p_ate date)
returns table (pessoa_id uuid, dia date, horas numeric, capacidade_dia numeric)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from bi.carga(p_de, p_ate) $$;
create or replace function public.queima_sprint(p_sprint uuid)
returns table (dia date, restante_h numeric, restante_pontos numeric, ideal_h numeric)
language sql stable security invoker set search_path = public, pg_temp as $$ select * from bi.queima_sprint(p_sprint) $$;

-- =====================================================================
-- MOTOR DAS AUTOMAÇÕES
-- A condição é um objeto em que cada chave precisa bater com o item: tipo, prioridade, grupo, status (chave).
-- =====================================================================
create or replace function interno.rodar_automacoes(p_item uuid, p_gatilho text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare a record; i record; ok boolean; st uuid; dest uuid;
begin
  select it.*, s.grupo, s.chave as status_chave into i
    from public.itens it join public.status_fluxo s on s.id = it.status_id where it.id = p_item;
  if not found then return; end if;

  for a in
    select au.* from public.automacoes au
      join public.nos_ancestrais an on an.ancestral_id = au.no_id and an.no_id = i.frente_id
     where au.ativa and au.gatilho = p_gatilho
     order by an.distancia desc, au.criado_em
  loop
    ok := coalesce((a.condicao->>'tipo') is null or a.condicao->>'tipo' = i.tipo, true)
      and coalesce((a.condicao->>'prioridade') is null or a.condicao->>'prioridade' = i.prioridade, true)
      and coalesce((a.condicao->>'grupo') is null or a.condicao->>'grupo' = i.grupo, true)
      and coalesce((a.condicao->>'status') is null or a.condicao->>'status' = i.status_chave, true);
    if not ok then continue; end if;
    begin
      if a.acao = 'notificar' then
        dest := coalesce(nullif(a.parametros->>'pessoa_id', '')::uuid,
                         case when a.parametros->>'para' = 'relator' then i.relator_id else i.responsavel_id end);
        if dest is not null then
          insert into public.notificacoes (pessoa_id, titulo, texto, item_id)
          values (dest, coalesce(a.parametros->>'titulo', a.nome), i.titulo, i.id);
        end if;
      elsif a.acao = 'comentar' then
        insert into public.comentarios (item_id, texto, visivel_cliente)
        values (i.id, coalesce(a.parametros->>'texto', a.nome), coalesce((a.parametros->>'visivel_cliente')::boolean, false));
      elsif a.acao = 'mudar_prioridade' then
        update public.itens set prioridade = a.parametros->>'prioridade' where id = i.id;
      elsif a.acao = 'atribuir' then
        update public.itens set responsavel_id = (a.parametros->>'pessoa_id')::uuid where id = i.id;
      elsif a.acao = 'marcar_visivel' then
        update public.itens set visivel_cliente = true where id = i.id;
      elsif a.acao = 'mudar_status' then
        select sf.id into st from public.status_fluxo sf
          left join public.nos_ancestrais an on an.ancestral_id = sf.no_id and an.no_id = i.frente_id
         where sf.chave = a.parametros->>'status' and (sf.no_id is null or an.no_id is not null)
         order by an.distancia nulls last limit 1;
        if st is not null then update public.itens set status_id = st where id = i.id; end if;
      end if;
      insert into public.automacoes_execucoes (automacao_id, item_id, resultado) values (a.id, i.id, 'ok');
    exception when others then
      insert into public.automacoes_execucoes (automacao_id, item_id, resultado, detalhe) values (a.id, i.id, 'erro', sqlerrm);
    end;
  end loop;
end $$;

create or replace function interno.gatilho_automacoes() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- automações não disparam outras automações (evita ciclo infinito)
  if pg_trigger_depth() > 1 then return null; end if;
  if tg_op = 'INSERT' then
    perform interno.rodar_automacoes(new.id, 'item_criado');
  else
    if new.status_id is distinct from old.status_id then perform interno.rodar_automacoes(new.id, 'status_mudou'); end if;
    if new.prioridade is distinct from old.prioridade then perform interno.rodar_automacoes(new.id, 'prioridade_mudou'); end if;
    if new.responsavel_id is distinct from old.responsavel_id then perform interno.rodar_automacoes(new.id, 'responsavel_mudou'); end if;
  end if;
  return null;
end $$;

drop trigger if exists itens_automacoes on public.itens;
create trigger itens_automacoes after insert or update of status_id, prioridade, responsavel_id on public.itens
  for each row execute function interno.gatilho_automacoes();

-- rotina diária: itens que venceram ontem disparam "prazo_vencido"
create or replace function interno.automacoes_prazo_vencido() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; r record;
begin
  for r in select s.id from bi.itens_situacao s where s.grupo <> 'done' and s.prazo = bi.hoje() - 1 loop
    perform interno.rodar_automacoes(r.id, 'prazo_vencido'); n := n + 1;
  end loop;
  return n;
end $$;
