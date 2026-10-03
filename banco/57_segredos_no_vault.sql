-- =====================================================================
-- Parte 57 · Ordem de serviço do banco nº1, item S1: segredos saem do texto puro e vão para o Vault do Supabase.
-- O quê: chaves de acesso (GitHub/GitLab/Supabase), segredo dos apps, endereço de conexão dos bancos (tem senha),
--        segredo dos avisos do GitLab e do webhook do portal.
-- Como: um gatilho ANTES de gravar move qualquer valor que chegue na coluna antiga para o Vault e deixa a coluna
--       vazia (uma regra garante que ela fica vazia para sempre); interno.segredos_vault diz qual segredo é de qual linha. Assim as funções que GRAVAM não mudam; só as que LEEM passam a ler do Vault.
--       Ao apagar a linha, o segredo some do Vault junto.
-- Nada é apagado: o valor muda de lugar. Antes de esvaziar a coluna antiga, a migração confere que o Vault devolve
--       exatamente o mesmo valor; se não devolver, tudo volta atrás.
-- Plano de volta: 57_segredos_no_vault_VOLTA.sql (devolve os valores às colunas e recria as funções de antes).
-- Não usa pgsodium nem Transparent Column Encryption (o Vault usa a chave dele).
-- Quem lê: só as funções security definer abaixo. interno.segredo_de não é dada a ninguém (anon, authenticated, service_role).
-- =====================================================================

-- ---------- 1. Onde fica cada segredo ----------
-- Uma linha por (tabela, chave da linha, coluna) aponta para o segredo no Vault. Fica fora da linha de propósito:
-- num "insert ... on conflict do update" o Postgres roda o gatilho na linha proposta, então o segredo novo precisa
-- ficar guardado pela chave, não pela linha (senão o valor novo se perde quando a linha já existe).
create table if not exists interno.segredos_vault (
  tabela text not null, chave text not null, coluna text not null,
  segredo_id uuid not null unique,
  criado_em timestamptz not null default now(),
  primary key (tabela, chave, coluna));
alter table interno.segredos_vault enable row level security;
revoke all on interno.segredos_vault from public, anon, authenticated, service_role;

create or replace function interno.segredo_de(p_tabela text, p_chave text, p_coluna text) returns text
language sql stable security definer set search_path = '' as
$$ select d.decrypted_secret from interno.segredos_vault s join vault.decrypted_secrets d on d.id = s.segredo_id
    where s.tabela = p_tabela and s.chave = p_chave and s.coluna = p_coluna $$;

-- gatilho: TG_ARGV[0] = coluna da chave da linha; TG_ARGV[1] = 'atualiza' ou 'mantem' (mantem: insert numa linha que já
-- existe não troca o segredo, para o "on conflict do nothing"); os demais = colunas com segredo.
-- Valor vazio ou nulo na coluna = "não mudou" (mantém o que já estava no Vault).
create or replace function interno.segredos_guardar_tg() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(new); tab text := tg_table_schema || '.' || tg_table_name; k text := to_jsonb(new)->>tg_argv[0];
        col text; v text; sid uuid; i int; vazio jsonb;
begin
  for i in 2 .. tg_nargs - 1 loop
    col := tg_argv[i];
    vazio := case when jsonb_typeof(j->col) = 'object' then '{}'::jsonb else 'null'::jsonb end;
    v := case when jsonb_typeof(j->col) = 'object' then (j->col)::text else j->>col end;
    if v is not null and v not in ('', '{}') then
      select s.segredo_id into sid from interno.segredos_vault s where s.tabela = tab and s.chave = k and s.coluna = col;
      if sid is not null and tg_op = 'INSERT' and tg_argv[1] = 'mantem' then
        null;
      elsif sid is not null and exists (select 1 from vault.secrets x where x.id = sid) then
        perform vault.update_secret(sid, v);
      else
        delete from interno.segredos_vault s where s.tabela = tab and s.chave = k and s.coluna = col;
        sid := vault.create_secret(v, null, 'ciclodev ' || tab || '.' || col || ' ' || k);
        insert into interno.segredos_vault (tabela, chave, coluna, segredo_id) values (tab, k, col, sid);
      end if;
    end if;
    if v is not null then j := j || jsonb_build_object(col, vazio); end if;
  end loop;
  new := jsonb_populate_record(new, j);
  return new;
end $$;

create or replace function interno.segredos_apagar_tg() returns trigger
language plpgsql security definer set search_path = '' as $$
declare tab text := tg_table_schema || '.' || tg_table_name; k text := to_jsonb(old)->>tg_argv[0]; i int;
begin
  for i in 2 .. tg_nargs - 1 loop
    with fora as (delete from interno.segredos_vault s where s.tabela = tab and s.chave = k and s.coluna = tg_argv[i] returning s.segredo_id)
    delete from vault.secrets x using fora where x.id = fora.segredo_id;
  end loop;
  return old;
end $$;
revoke all on function interno.segredo_de(text, text, text), interno.segredos_guardar_tg(), interno.segredos_apagar_tg() from public, anon, authenticated, service_role;

-- ---------- 2. As colunas antigas deixam de ser obrigatórias (ficam sempre vazias) ----------
alter table interno.supa_app              alter column client_secret drop not null;
alter table interno.git_tokens            alter column acesso drop not null;
alter table interno.supa_tokens           alter column acesso drop not null;
alter table interno.infra_bancos_conexao  alter column conexao drop not null;
alter table interno.repositorios_segredos alter column segredo drop not null;
alter table public.portais_segredos       alter column webhook_segredo drop not null;
-- git_apps.dados continua não nulo: fica '{}' (o conteúdo vai inteiro para o Vault)

-- ---------- 3. Gatilhos ----------
do $$
declare t record; args text;
begin
  for t in select * from (values
      ('interno.supa_app',              'id',             'atualiza', array['client_secret']),
      ('interno.git_apps',              'provedor',       'atualiza', array['dados']),
      ('interno.git_tokens',            'conexao_id',     'atualiza', array['acesso','renovacao']),
      ('interno.supa_tokens',           'conexao_id',     'atualiza', array['acesso','renovacao']),
      ('interno.infra_bancos_conexao',  'banco_id',       'atualiza', array['conexao']),
      ('interno.repositorios_segredos', 'repositorio_id', 'mantem',   array['segredo']),
      ('public.portais_segredos',       'portal_id',      'atualiza', array['webhook_segredo'])) x(tab, chave, modo, cols) loop
    args := quote_literal(t.chave) || ', ' || quote_literal(t.modo) || ', ' || (select string_agg(quote_literal(c), ', ') from unnest(t.cols) c);
    execute format('drop trigger if exists segredos_no_vault on %s', t.tab);
    execute format('drop trigger if exists segredos_no_vault_apagar on %s', t.tab);
    execute format('create trigger segredos_no_vault before insert or update on %s for each row execute function interno.segredos_guardar_tg(%s)', t.tab, args);
    execute format('create trigger segredos_no_vault_apagar after delete on %s for each row execute function interno.segredos_apagar_tg(%s)', t.tab, args);
  end loop;
end $$;

-- ---------- 4. Mover o que já existe (conferindo antes de esvaziar) ----------
drop table if exists pg_temp._antes;
create temp table _antes as
  select 'interno.supa_app' t, id::text k, 'client_secret' c, client_secret v from interno.supa_app where client_secret is not null
  union all select 'interno.git_apps', provedor, 'dados', dados::text from interno.git_apps where dados <> '{}'::jsonb
  union all select 'interno.git_tokens', conexao_id::text, 'acesso', acesso from interno.git_tokens where acesso is not null
  union all select 'interno.git_tokens', conexao_id::text, 'renovacao', renovacao from interno.git_tokens where renovacao is not null
  union all select 'interno.supa_tokens', conexao_id::text, 'acesso', acesso from interno.supa_tokens where acesso is not null
  union all select 'interno.supa_tokens', conexao_id::text, 'renovacao', renovacao from interno.supa_tokens where renovacao is not null
  union all select 'interno.infra_bancos_conexao', banco_id::text, 'conexao', conexao from interno.infra_bancos_conexao where conexao is not null
  union all select 'interno.repositorios_segredos', repositorio_id::text, 'segredo', segredo from interno.repositorios_segredos where segredo is not null
  union all select 'public.portais_segredos', portal_id::text, 'webhook_segredo', webhook_segredo from public.portais_segredos where webhook_segredo is not null;

-- update sem mudar nada: o gatilho leva o valor para o Vault (trocado_em/atualizado_em ficam como estavam)
update interno.supa_app set client_secret = client_secret where client_secret is not null;
update interno.git_apps set dados = dados where dados <> '{}'::jsonb;
update interno.git_tokens set acesso = acesso where acesso is not null or renovacao is not null;
update interno.supa_tokens set acesso = acesso where acesso is not null or renovacao is not null;
update interno.infra_bancos_conexao set conexao = conexao where conexao is not null;
update interno.repositorios_segredos set segredo = segredo where segredo is not null;
update public.portais_segredos set webhook_segredo = webhook_segredo where webhook_segredo is not null;

do $$
declare n int; total int;
begin
  select count(*) into total from _antes;
  select count(*) into n from _antes a
   where a.v is distinct from case when a.t = 'interno.git_apps' then (interno.segredo_de(a.t, a.k, a.c)::jsonb)::text else interno.segredo_de(a.t, a.k, a.c) end;
  if n > 0 then raise exception 'S1: % de % segredos não voltaram iguais do Vault; nada foi mudado', n, total; end if;
  raise notice 'S1: % segredos movidos para o Vault e conferidos', total;
end $$;
drop table pg_temp._antes;

-- ---------- 5. Regra: a coluna antiga fica sempre vazia ----------
do $$
declare r record;
begin
  for r in select * from (values
      ('interno.supa_app', 'client_secret is null'),
      ('interno.git_apps', 'dados = ''{}''::jsonb'),
      ('interno.git_tokens', 'acesso is null and renovacao is null'),
      ('interno.supa_tokens', 'acesso is null and renovacao is null'),
      ('interno.infra_bancos_conexao', 'conexao is null'),
      ('interno.repositorios_segredos', 'segredo is null'),
      ('public.portais_segredos', 'webhook_segredo is null')) x(tab, regra) loop
    execute format('alter table %s drop constraint if exists segredo_fora_do_vault', r.tab);
    execute format('alter table %s add constraint segredo_fora_do_vault check (%s)', r.tab, r.regra);
  end loop;
end $$;

-- ---------- 6. Funções que LEEM passam a ler do Vault (mesma assinatura, mesma resposta) ----------
create or replace function public.git_app_ler(p_provedor text) returns jsonb
language sql stable security definer set search_path to 'public', 'pg_temp' as
$$ select interno.segredo_de('interno.git_apps', provedor, 'dados')::jsonb from interno.git_apps where provedor = p_provedor $$;

create or replace function public.git_app_gravar(p_provedor text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare d jsonb := coalesce(p_dados, '{}'::jsonb); pub jsonb; antigo jsonb;
begin
  perform interno.exigir_dono();
  select interno.segredo_de('interno.git_apps', provedor, 'dados')::jsonb into antigo from interno.git_apps where provedor = p_provedor;
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
end $function$;

create or replace function public.git_conexao_ler(p_id uuid) returns jsonb
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', interno.segredo_de('interno.git_tokens', t.conexao_id::text, 'acesso'), 'renovacao', interno.segredo_de('interno.git_tokens', t.conexao_id::text, 'renovacao'), 'expira_em', t.expira_em)
                                                       from interno.git_tokens t where t.conexao_id = c.id))
    from public.git_conexoes c where c.id = p_id
$function$;

create or replace function public.git_repo_segredo(p_repo uuid) returns text
language sql stable security definer set search_path to 'public', 'pg_temp' as
$$ select interno.segredo_de('interno.repositorios_segredos', repositorio_id::text, 'segredo') from interno.repositorios_segredos where repositorio_id = p_repo $$;

create or replace function public.supa_app_ler() returns jsonb
language sql stable security definer set search_path to 'public', 'pg_temp' as
$$ select jsonb_build_object('client_id', a.client_id, 'client_secret', interno.segredo_de('interno.supa_app', a.id::text, 'client_secret'), 'retorno', a.retorno) from interno.supa_app a $$;

create or replace function public.supa_conexao_ler(p_id uuid) returns jsonb
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', interno.segredo_de('interno.supa_tokens', t.conexao_id::text, 'acesso'), 'renovacao', interno.segredo_de('interno.supa_tokens', t.conexao_id::text, 'renovacao'), 'expira_em', t.expira_em)
                                                       from interno.supa_tokens t where t.conexao_id = c.id))
    from public.supa_conexoes c where c.id = p_id
$function$;

create or replace function public.supa_app_gravar(p_client_id text, p_client_secret text, p_retorno text) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare seg text := nullif(btrim(coalesce(p_client_secret, '')), ''); cid text := lower(btrim(coalesce(p_client_id, '')));
begin
  perform interno.exigir_dono();
  if cid = '' then raise exception 'Informe o Client ID do app do Supabase' using errcode = '22023'; end if;
  if cid like 'sba\_%' then raise exception 'Isso é o Client Secret (começa com sba_), não o Client ID. O Client ID é o código no formato a1b2c3d4-e5f6-... que o Supabase mostra junto.' using errcode = '22023'; end if;
  if cid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'O Client ID do Supabase tem o formato a1b2c3d4-e5f6-7890-abcd-ef1234567890. Confira se copiou o código certo.' using errcode = '22023'; end if;
  if coalesce(p_retorno, '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
  if seg is null then select interno.segredo_de('interno.supa_app', id::text, 'client_secret') into seg from interno.supa_app; end if;
  if seg is null then raise exception 'Informe o Client Secret do app do Supabase' using errcode = '22023'; end if;
  if lower(seg) = cid then raise exception 'O Client Secret não pode ser igual ao Client ID' using errcode = '22023'; end if;
  insert into interno.supa_app (id, client_id, client_secret, retorno, atualizado_por) values (true, cid, seg, p_retorno, interno.pessoa_atual())
  on conflict (id) do update set client_id = excluded.client_id, client_secret = excluded.client_secret, retorno = excluded.retorno, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return public.supa_app_status();
end $function$;

create or replace function public.git_receber_gitlab(p_repo uuid, p_evento text, p_token text, p_corpo text) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare r public.repositorios; s text; j jsonb;
begin
  select * into r from public.repositorios where id = p_repo and provedor = 'gitlab';
  if r.id is null then return jsonb_build_object('ok', false, 'erro', 'repositório não encontrado'); end if;
  select interno.segredo_de('interno.repositorios_segredos', repositorio_id::text, 'segredo') into s from interno.repositorios_segredos where repositorio_id = r.id;
  if s is null or coalesce(p_token, '') <> s then
    update public.repositorios set ultimo_erro = 'Aviso recusado: segredo não confere (' || coalesce(p_evento, '?') || ')', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'assinatura inválida');
  end if;
  begin j := p_corpo::jsonb; exception when others then
    update public.repositorios set ultimo_erro = 'Aviso com conteúdo inválido', ultimo_evento_em = now() where id = r.id;
    return jsonb_build_object('ok', false, 'erro', 'conteúdo inválido'); end;
  return jsonb_build_object('ok', true, 'evento', p_evento) || interno.git_processar(r, p_evento, j);
end $function$;

create or replace function public.infra_auto_bancos_devidos(p_limite integer default 5) returns jsonb
language sql security definer set search_path to 'public', 'pg_temp' as $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'no_id', b.no_id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', interno.segredo_de('interno.infra_bancos_conexao', c.banco_id::text, 'conexao'),
                                               'supa_conexao_id', b.supa_conexao_id, 'supa_projeto', b.supa_projeto, 'ultimo_hash', b.ultimo_hash)), '[]')
    from (select * from public.infra_bancos b where b.ativo and (b.ultima_leitura_em is null or b.ultima_leitura_em < now() - interval '55 minutes')
           order by b.ultima_leitura_em nulls first limit greatest(1, least(coalesce(p_limite, 5), 20))) b
    left join interno.infra_bancos_conexao c on c.banco_id = b.id
   where c.banco_id is not null or b.supa_conexao_id is not null
$function$;

create or replace function public.infra_auto_proximos(p_limite integer default 3) returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
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
      'bancos', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', interno.segredo_de('interno.infra_bancos_conexao', c.banco_id::text, 'conexao'),
                                                              'supa_conexao_id', b.supa_conexao_id, 'supa_projeto', b.supa_projeto) order by b.nome), '[]')
                   from public.infra_bancos b left join interno.infra_bancos_conexao c on c.banco_id = b.id
                  where b.no_id = a.no_id and b.ativo and a.repositorio_id is null and (c.banco_id is not null or b.supa_conexao_id is not null)
                    and (a.origem = 'manual' or (a.origem = 'banco' and (a.banco_id is null or b.id = a.banco_id))))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $function$;

-- git_receber_github: o segredo do webhook está dentro de dados (agora no Vault)
do $$
declare def text;
begin
  if to_regprocedure('public.git_receber_github(text,text,text)') is not null then
    def := pg_get_functiondef('public.git_receber_github(text,text,text)'::regprocedure);
    if position('dados->>''webhook_secret''' in def) > 0 then
      def := replace(def, 'select dados->>''webhook_secret'' from interno.git_apps', 'select interno.segredo_de(''interno.git_apps'', provedor, ''dados'')::jsonb->>''webhook_secret'' from interno.git_apps');
    end if;
    if position('segredo_de(''interno.git_apps''' in def) = 0 then raise exception 'S1: não achei onde trocar o segredo em git_receber_github'; end if;
    execute def;
  end if;
  -- interno.portal_entregar só existe onde há pg_net (parte 24, só no Supabase)
  if to_regprocedure('interno.portal_entregar()') is not null then
    def := pg_get_functiondef('interno.portal_entregar()'::regprocedure);
    def := replace(def, 'p.webhook_url, s.webhook_segredo', 'p.webhook_url, interno.segredo_de(''public.portais_segredos'', s.portal_id::text, ''webhook_segredo'') as webhook_segredo');
    if position('segredo_de(''public.portais_segredos''' in def) = 0 then raise exception 'S1: não achei onde trocar o segredo em interno.portal_entregar'; end if;
    execute def;
  end if;
end $$;
