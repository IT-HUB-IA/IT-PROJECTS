-- =====================================================================
-- VOLTA da parte 57 (segredos no Vault). Só rodar se for preciso desfazer a 57.
-- Devolve cada segredo do Vault para a coluna de antes, recria as funções como estavam em produção em 03/10/2026
-- e só então apaga os segredos do Vault e a tabela interno.segredos_vault. Nenhum valor se perde.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['interno.supa_app','interno.git_apps','interno.git_tokens','interno.supa_tokens','interno.infra_bancos_conexao','interno.repositorios_segredos','public.portais_segredos'] loop
    execute format('drop trigger if exists segredos_no_vault on %s', t);
    execute format('drop trigger if exists segredos_no_vault_apagar on %s', t);
    execute format('alter table %s drop constraint if exists segredo_fora_do_vault', t);
  end loop;
end $$;

update interno.supa_app x set client_secret = interno.segredo_de('interno.supa_app', x.id::text, 'client_secret');
update interno.git_apps x set dados = interno.segredo_de('interno.git_apps', x.provedor, 'dados')::jsonb where interno.segredo_de('interno.git_apps', x.provedor, 'dados') is not null;
update interno.git_tokens x set acesso = interno.segredo_de('interno.git_tokens', x.conexao_id::text, 'acesso'), renovacao = interno.segredo_de('interno.git_tokens', x.conexao_id::text, 'renovacao');
update interno.supa_tokens x set acesso = interno.segredo_de('interno.supa_tokens', x.conexao_id::text, 'acesso'), renovacao = interno.segredo_de('interno.supa_tokens', x.conexao_id::text, 'renovacao');
update interno.infra_bancos_conexao x set conexao = interno.segredo_de('interno.infra_bancos_conexao', x.banco_id::text, 'conexao');
update interno.repositorios_segredos x set segredo = interno.segredo_de('interno.repositorios_segredos', x.repositorio_id::text, 'segredo');
update public.portais_segredos x set webhook_segredo = interno.segredo_de('public.portais_segredos', x.portal_id::text, 'webhook_segredo');

-- se algum ficou vazio, para aqui (nada é apagado)
alter table interno.supa_app              alter column client_secret set not null;
alter table interno.git_tokens            alter column acesso set not null;
alter table interno.supa_tokens           alter column acesso set not null;
alter table interno.infra_bancos_conexao  alter column conexao set not null;
alter table interno.repositorios_segredos alter column segredo set not null;
alter table public.portais_segredos       alter column webhook_segredo set not null;

-- git_app_ler(text)
CREATE OR REPLACE FUNCTION public.git_app_ler(p_provedor text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select dados from interno.git_apps where provedor = p_provedor $function$
;

-- git_app_gravar(text,jsonb)
CREATE OR REPLACE FUNCTION public.git_app_gravar(p_provedor text, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d jsonb := coalesce(p_dados, '{}'::jsonb); pub jsonb; antigo jsonb;
begin
  perform interno.exigir_dono();
  select dados into antigo from interno.git_apps where provedor = p_provedor;
  if p_provedor = 'github' then
    if coalesce(d->>'app_id', '') !~ '^[0-9]+$' or coalesce(d->>'slug', '') !~ '^[a-z0-9-]+$' or coalesce(d->>'client_id', '') = ''
       or coalesce(d->>'client_secret', '') = '' or coalesce(d->>'webhook_secret', '') = '' or coalesce(d->>'pem', '') !~ 'PRIVATE KEY' then
      raise exception 'Faltam dados do app do GitHub' using errcode = '22023'; end if;
    pub := jsonb_build_object('slug', d->>'slug', 'client_id', d->>'client_id', 'nome', d->>'nome', 'html_url', d->>'html_url', 'dono', d->>'dono', 'retorno', d->>'retorno');
  elsif p_provedor = 'gitlab' then
    if coalesce(btrim(d->>'client_secret'), '') = '' and antigo is not null then d := d || jsonb_build_object('client_secret', antigo->>'client_secret'); end if;
    d := d || jsonb_build_object('base', rtrim(coalesce(nullif(btrim(d->>'base'), ''), 'https://gitlab.com'), '/'));
    if coalesce(btrim(d->>'client_id'), '') = '' or coalesce(btrim(d->>'client_secret'), '') = '' then
      raise exception 'Informe o Application ID e o Secret do GitLab' using errcode = '22023'; end if;
    if d->>'base' !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'O endereço do GitLab precisa ser https://servidor' using errcode = '22023'; end if;
    if coalesce(d->>'retorno', '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
    pub := jsonb_build_object('client_id', btrim(d->>'client_id'), 'base', d->>'base', 'retorno', d->>'retorno');
  else raise exception 'Provedor inválido' using errcode = '22023'; end if;
  insert into interno.git_apps (provedor, dados, publico, atualizado_por) values (p_provedor, d, pub, interno.pessoa_atual())
  on conflict (provedor) do update set dados = excluded.dados, publico = excluded.publico, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return pub || jsonb_build_object('pronto', true);
end $function$
;

-- git_conexao_ler(uuid)
CREATE OR REPLACE FUNCTION public.git_conexao_ler(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', t.acesso, 'renovacao', t.renovacao, 'expira_em', t.expira_em) from interno.git_tokens t where t.conexao_id = c.id))
    from public.git_conexoes c where c.id = p_id
$function$
;

-- git_repo_segredo(uuid)
CREATE OR REPLACE FUNCTION public.git_repo_segredo(p_repo uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select segredo from interno.repositorios_segredos where repositorio_id = p_repo $function$
;

-- supa_app_ler()
CREATE OR REPLACE FUNCTION public.supa_app_ler()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object('client_id', a.client_id, 'client_secret', a.client_secret, 'retorno', a.retorno) from interno.supa_app a
$function$
;

-- supa_conexao_ler(uuid)
CREATE OR REPLACE FUNCTION public.supa_conexao_ler(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', t.acesso, 'renovacao', t.renovacao, 'expira_em', t.expira_em) from interno.supa_tokens t where t.conexao_id = c.id))
    from public.supa_conexoes c where c.id = p_id
$function$
;

-- supa_app_gravar(text,text,text)
CREATE OR REPLACE FUNCTION public.supa_app_gravar(p_client_id text, p_client_secret text, p_retorno text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare seg text := nullif(btrim(coalesce(p_client_secret, '')), ''); cid text := lower(btrim(coalesce(p_client_id, '')));
begin
  perform interno.exigir_dono();
  if cid = '' then raise exception 'Informe o Client ID do app do Supabase' using errcode = '22023'; end if;
  if cid like 'sba\_%' then raise exception 'Isso é o Client Secret (começa com sba_), não o Client ID. O Client ID é o código no formato a1b2c3d4-e5f6-... que o Supabase mostra junto.' using errcode = '22023'; end if;
  if cid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'O Client ID do Supabase tem o formato a1b2c3d4-e5f6-7890-abcd-ef1234567890. Confira se copiou o código certo.' using errcode = '22023'; end if;
  if coalesce(p_retorno, '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
  if seg is null then select client_secret into seg from interno.supa_app; end if;
  if seg is null then raise exception 'Informe o Client Secret do app do Supabase' using errcode = '22023'; end if;
  if lower(seg) = cid then raise exception 'O Client Secret não pode ser igual ao Client ID' using errcode = '22023'; end if;
  insert into interno.supa_app (id, client_id, client_secret, retorno, atualizado_por) values (true, cid, seg, p_retorno, interno.pessoa_atual())
  on conflict (id) do update set client_id = excluded.client_id, client_secret = excluded.client_secret, retorno = excluded.retorno, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return public.supa_app_status();
end $function$
;

-- git_receber_gitlab(uuid,text,text,text)
CREATE OR REPLACE FUNCTION public.git_receber_gitlab(p_repo uuid, p_evento text, p_token text, p_corpo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.repositorios; s text; j jsonb;
begin
  select * into r from public.repositorios where id = p_repo and provedor = 'gitlab';
  if r.id is null then return jsonb_build_object('ok', false, 'erro', 'repositório não encontrado'); end if;
  select segredo into s from interno.repositorios_segredos where repositorio_id = r.id;
  if s is null or coalesce(p_token, '') <> s then
    update public.repositorios set ultimo_erro = 'Aviso recusado: segredo não confere (' || coalesce(p_evento, '?') || ')', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida');
  end if;
  begin j := p_corpo::jsonb; exception when others then
    update public.repositorios set ultimo_erro = 'Aviso com conteúdo inválido', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  return jsonb_build_object('ok', true, 'evento', p_evento) || interno.git_processar(r, p_evento, j);
end $function$
;

-- infra_auto_bancos_devidos(integer)
CREATE OR REPLACE FUNCTION public.infra_auto_bancos_devidos(p_limite integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'no_id', b.no_id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', c.conexao,
                                               'supa_conexao_id', b.supa_conexao_id, 'supa_projeto', b.supa_projeto, 'ultimo_hash', b.ultimo_hash)), '[]')
    from (select * from public.infra_bancos b where b.ativo and (b.ultima_leitura_em is null or b.ultima_leitura_em < now() - interval '55 minutes')
           order by b.ultima_leitura_em nulls first limit greatest(1, least(coalesce(p_limite, 5), 20))) b
    left join interno.infra_bancos_conexao c on c.banco_id = b.id
   where c.conexao is not null or b.supa_conexao_id is not null
$function$
;

-- infra_auto_proximos(integer)
CREATE OR REPLACE FUNCTION public.infra_auto_proximos(p_limite integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare ids uuid[]; saida jsonb;
begin
  update public.infra_automacoes set status = 'erro', concluido_em = now(), erro = 'Parou no meio três vezes'
   where status = 'rodando' and iniciado_em < now() - interval '15 minutes' and tentativas >= 3;
  with fila as (
    select a.id from public.infra_automacoes a
     where a.status = 'pendente' or (a.status = 'rodando' and a.iniciado_em < now() - interval '15 minutes')
     order by a.criado_em limit greatest(1, least(coalesce(p_limite, 3), 10)) for update skip locked),
  pegos as (
    update public.infra_automacoes a set status = 'rodando', iniciado_em = now(), tentativas = a.tentativas + 1
      from fila where a.id = fila.id returning a.id)
  select array_agg(id) into ids from pegos;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'no_id', a.no_id, 'origem', a.origem, 'referencia', a.referencia,
      'repositorios', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor,
                                                                    'conexao_id', r.conexao_id, 'externo_id', r.externo_id) order by r.nome), '[]')
                         from public.repositorios r
                        where a.origem <> 'banco' and r.ativo and r.conexao_id is not null and (case when a.repositorio_id is not null then r.id = a.repositorio_id
                                                else r.no_id = a.no_id or interno.infra_no_de(r.no_id) = a.no_id end)),
      'bancos', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', c.conexao,
                                                              'supa_conexao_id', b.supa_conexao_id, 'supa_projeto', b.supa_projeto) order by b.nome), '[]')
                   from public.infra_bancos b left join interno.infra_bancos_conexao c on c.banco_id = b.id
                  where b.no_id = a.no_id and b.ativo and a.repositorio_id is null and (c.conexao is not null or b.supa_conexao_id is not null)
                    and (a.origem = 'manual' or (a.origem = 'banco' and (a.banco_id is null or b.id = a.banco_id))))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $function$
;

-- git_receber_github(text,text,text)
CREATE OR REPLACE FUNCTION public.git_receber_github(p_evento text, p_assinatura text, p_corpo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare s text := (select dados->>'webhook_secret' from interno.git_apps where provedor = 'github');
  ev text := lower(coalesce(p_evento, '')); j jsonb; inst text; rid text; r public.repositorios; n integer := 0; res jsonb := '[]'::jsonb; msg text;
begin
  if s is null then return jsonb_build_object('ok', false, 'erro', 'app do GitHub não configurado'); end if;
  if coalesce(p_assinatura, '') <> 'sha256=' || encode(hmac(convert_to(p_corpo, 'UTF8'), convert_to(s, 'UTF8'), 'sha256'), 'hex') then
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida'); end if;
  begin j := p_corpo::jsonb; exception when others then return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  inst := j#>>'{installation,id}';
  if ev = 'ping' then return jsonb_build_object('ok', true, 'ping', true); end if;
  if ev = 'installation' then
    if j->>'action' in ('deleted','suspend') then
      msg := case when j->>'action' = 'deleted' then 'Conta desconectada: o app do CicloDev foi removido no GitHub' else 'Conta suspensa: o app do CicloDev foi suspenso no GitHub' end;
      update public.git_conexoes set removida_em = case when j->>'action' = 'deleted' then now() else removida_em end, ultimo_erro = msg where provedor = 'github' and externo_id = inst;
      update public.repositorios set ativo = false, ultimo_erro = msg
       where conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    elsif j->>'action' = 'unsuspend' then
      update public.git_conexoes set ultimo_erro = null where provedor = 'github' and externo_id = inst;
      update public.repositorios set ativo = true, ultimo_erro = null
       where ultimo_erro like 'Conta %' and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    end if;
    return jsonb_build_object('ok', true, 'instalacao', j->>'action');
  end if;
  if ev = 'installation_repositories' then
    update public.repositorios set ativo = false, ultimo_erro = 'Conta sem acesso a este repositório: ele saiu do app do CicloDev no GitHub'
     where provedor = 'github' and externo_id in (select x.value->>'id' from jsonb_array_elements(coalesce(j->'repositories_removed', '[]')) x)
       and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    update public.repositorios set ativo = true, ultimo_erro = null
     where provedor = 'github' and ultimo_erro like 'Conta %' and externo_id in (select x.value->>'id' from jsonb_array_elements(coalesce(j->'repositories_added', '[]')) x)
       and conexao_id in (select id from public.git_conexoes where provedor = 'github' and externo_id = inst);
    return jsonb_build_object('ok', true, 'repositorios', j->>'action');
  end if;
  rid := j#>>'{repository,id}';
  if rid is null or inst is null then return jsonb_build_object('ok', true, 'ignorado', ev); end if;
  for r in select x.* from public.repositorios x join public.git_conexoes c on c.id = x.conexao_id
            where x.provedor = 'github' and x.externo_id = rid and c.provedor = 'github' and c.externo_id = inst and c.removida_em is null loop
    res := res || jsonb_build_array(interno.git_processar(r, p_evento, j) || jsonb_build_object('repositorio', r.id));
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'evento', p_evento, 'repositorios', n, 'resultado', res);
end $function$
;

-- só onde existe (parte 24, Supabase)
do $volta$ begin if to_regprocedure('interno.portal_entregar()') is not null then execute $def$CREATE OR REPLACE FUNCTION interno.portal_entregar()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare e record; n int := 0; corpo text; st int;
begin
  for e in select ev.id, ev.pedido_id, ev.enviado_em from public.portais_eventos ev where ev.entregue_em is null and ev.pedido_id is not null loop
    select r.status_code into st from net._http_response r where r.id = e.pedido_id;
    if st between 200 and 299 then
      update public.portais_eventos set entregue_em = now(), pedido_id = null, ultimo_erro = null where id = e.id;
    elsif st is not null then
      update public.portais_eventos set pedido_id = null, ultimo_erro = 'O sistema de fora respondeu ' || st where id = e.id;
    elsif e.enviado_em < now() - interval '10 minutes' then
      update public.portais_eventos set pedido_id = null, ultimo_erro = 'Sem resposta em 10 minutos' where id = e.id;
    end if;
  end loop;
  for e in select ev.id, ev.tipo, ev.criado_em, ev.dados, p.webhook_url, s.webhook_segredo
             from public.portais_eventos ev join public.portais p on p.id = ev.portal_id join public.portais_segredos s on s.portal_id = p.id
            where ev.entregue_em is null and ev.pedido_id is null and ev.tentativas < 10 and p.ativo and p.webhook_url is not null
            order by ev.id limit 50 loop
    corpo := jsonb_build_object('id', e.id, 'tipo', e.tipo, 'criado_em', e.criado_em, 'dados', e.dados)::text;
    update public.portais_eventos
       set pedido_id = net.http_post(url := e.webhook_url, body := corpo::jsonb,
             headers := jsonb_build_object('content-type', 'application/json', 'x-ciclodev-evento', e.tipo,
                                           'x-ciclodev-assinatura', 'sha256=' || encode(hmac(corpo, e.webhook_segredo, 'sha256'), 'hex')),
             timeout_milliseconds := 10000),
           tentativas = tentativas + 1, enviado_em = now()
     where id = e.id;
    n := n + 1;
  end loop;
  return n;
end $function$
$def$; end if; end $volta$;

delete from vault.secrets x using interno.segredos_vault s where x.id = s.segredo_id;
drop table interno.segredos_vault;
drop function if exists interno.segredos_guardar_tg();
drop function if exists interno.segredos_apagar_tg();
drop function if exists interno.segredo_de(text, text, text);
