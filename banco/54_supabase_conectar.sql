-- =====================================================================
-- CicloDev · 54 · Ligar um banco do Supabase com um clique, sem senha (02/10/2026)
-- Depende das partes 15 (espaços), 16 (dono do sistema), 30, 33, 36 e 42 (bancos ligados).
--
-- Como fica:
--   1. O CicloDev tem UM app OAuth no Supabase (o dono do sistema cadastra o número e o segredo na tela Admin).
--   2. A pessoa clica em Conectar ao Supabase, autoriza na janelinha do Supabase e escolhe o projeto.
--   3. Antes de ligar, a função supabase-conectar CONFERE de verdade, no projeto escolhido, que dá para ler a estrutura
--      inteira (esquemas, tabelas, colunas, chaves, regras de acesso e permissões) e que a leitura é só leitura.
--      Se faltar qualquer parte, não liga. Quando passa, ela grava uma prova (interno.supa_provas) e só com essa prova,
--      recente e da própria pessoa, o banco aceita ligar (infra_banco_supabase_ligar). A tela não consegue pular a conferência.
--   4. O robô (diagramas-auto) lê pelo modo "só leitura" do próprio Supabase e só roda consultas fixas no catálogo
--      (a estrutura). Nunca lê o conteúdo das tabelas.
-- As chaves da autorização ficam em interno.supa_tokens, que nenhuma tela lê (só as funções, com service_role).
-- O jeito antigo (endereço com usuário e senha) continua para quem quiser e para AWS e MySQL.
-- Pode rodar de novo sem estragar nada.
-- =====================================================================

-- ---------- 1. o app do CicloDev no Supabase (um só) ----------
create table if not exists interno.supa_app (
  id            boolean primary key default true check (id),
  client_id     text not null check (length(client_id) between 8 and 200),
  client_secret text not null check (length(client_secret) between 8 and 500),
  retorno       text not null check (retorno ~ '^https://'),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.pessoas(id) on delete set null
);
comment on table interno.supa_app is 'O app OAuth do CicloDev no Supabase. O segredo só a função supabase-conectar e o robô leem.';
revoke all on interno.supa_app from public, anon, authenticated;

create or replace function public.supa_app_status() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select jsonb_build_object('pronto', true, 'client_id', a.client_id, 'retorno', a.retorno, 'atualizado_em', a.atualizado_em) from interno.supa_app a), '{"pronto":false}'::jsonb)
$$;

-- só o dono do sistema grava. Segredo vazio mantém o que já está guardado.
create or replace function public.supa_app_gravar(p_client_id text, p_client_secret text, p_retorno text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare seg text := nullif(btrim(coalesce(p_client_secret, '')), '');
begin
  perform interno.exigir_dono();
  if coalesce(btrim(p_client_id), '') = '' then raise exception 'Informe o Client ID do app do Supabase' using errcode = '22023'; end if;
  if coalesce(p_retorno, '') !~ '^https://' then raise exception 'Falta o endereço de volta' using errcode = '22023'; end if;
  if seg is null then select client_secret into seg from interno.supa_app; end if;
  if seg is null then raise exception 'Informe o Client Secret do app do Supabase' using errcode = '22023'; end if;
  insert into interno.supa_app (id, client_id, client_secret, retorno, atualizado_por) values (true, btrim(p_client_id), seg, p_retorno, interno.pessoa_atual())
  on conflict (id) do update set client_id = excluded.client_id, client_secret = excluded.client_secret, retorno = excluded.retorno, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return public.supa_app_status();
end $$;

-- só service_role (função supabase-conectar e robô)
create or replace function public.supa_app_ler() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('client_id', a.client_id, 'client_secret', a.client_secret, 'retorno', a.retorno) from interno.supa_app a
$$;

-- ---------- 2. as contas do Supabase conectadas em cada espaço ----------
create table if not exists public.supa_conexoes (
  id          uuid primary key default gen_random_uuid(),
  espaco_id   uuid not null references public.espacos(id) on delete cascade,
  conta       text not null check (length(conta) between 1 and 300),   -- as organizações que a autorização alcança
  criado_por  uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  ultimo_erro text
);
comment on table public.supa_conexoes is 'Autorização do Supabase (OAuth) conectada a um espaço. Quem é do espaço vê e usa para ligar bancos. As chaves ficam em interno.supa_tokens.';
alter table public.supa_conexoes enable row level security;
drop policy if exists ver on public.supa_conexoes;
create policy ver on public.supa_conexoes for select to authenticated using (espaco_id in (select interno.meus_espacos()) and not (select interno.eh_stakeholder()));
revoke all on public.supa_conexoes from anon, authenticated;
grant select on public.supa_conexoes to authenticated;
grant select, insert, update, delete on public.supa_conexoes to service_role;

create table if not exists interno.supa_tokens (
  conexao_id  uuid primary key references public.supa_conexoes(id) on delete cascade,
  acesso      text not null,
  renovacao   text,
  expira_em   timestamptz,
  trocado_em  timestamptz not null default now()
);
comment on table interno.supa_tokens is 'As chaves de acesso e de renovação da autorização do Supabase. Só as funções leem.';
revoke all on interno.supa_tokens from public, anon, authenticated;

-- ---------- 3. o vai e volta da janelinha, com PKCE (o verificador fica aqui, nunca vai para o navegador) ----------
create table if not exists interno.supa_estados (
  estado      text primary key,
  verificador text not null,
  pessoa_id   uuid not null references public.pessoas(id) on delete cascade,
  espaco_id   uuid not null references public.espacos(id) on delete cascade,
  criado_em   timestamptz not null default now()
);
revoke all on interno.supa_estados from public, anon, authenticated;

create or replace function public.supa_estado_novo() returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare e text := encode(gen_random_bytes(24), 'hex'); v text := encode(gen_random_bytes(48), 'hex');
        p uuid := interno.pessoa_atual(); esp uuid := interno.meu_espaco(); desafio text;
begin
  if p is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if esp is null then raise exception 'Você ainda não tem um espaço' using errcode = '42501'; end if;
  if (select interno.eh_stakeholder()) then raise exception 'Quem só acompanha não liga banco' using errcode = '42501'; end if;
  if not exists (select 1 from interno.supa_app) then raise exception 'O Supabase ainda não foi configurado. O dono do sistema configura em Admin.' using errcode = '22023'; end if;
  delete from interno.supa_estados where criado_em < now() - interval '1 day';
  insert into interno.supa_estados (estado, verificador, pessoa_id, espaco_id) values (e, v, p, esp);
  desafio := rtrim(translate(encode(digest(v, 'sha256'), 'base64'), '+/', '-_'), '=');
  return jsonb_build_object('estado', e, 'desafio', desafio);
end $$;

-- a pessoa voltou da janelinha: confere que o vai e volta é dela e é recente, e usa (não vale de novo)
create or replace function public.supa_estado_usar(p_estado text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s interno.supa_estados;
begin
  delete from interno.supa_estados where estado = p_estado and pessoa_id = interno.pessoa_atual() and criado_em > now() - interval '30 minutes' returning * into s;
  if s.estado is null then raise exception 'A conexão expirou ou não é sua. Tente de novo.' using errcode = '42501'; end if;
  return jsonb_build_object('pessoa_id', s.pessoa_id, 'espaco_id', s.espaco_id, 'verificador', s.verificador);
end $$;

-- quem está logado (a função supabase-conectar grava a prova da conferência em nome dessa pessoa)
create or replace function public.supa_eu() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$ select interno.pessoa_atual() $$;

-- a pessoa pode mudar este ponto? (o botão Testar do endereço só roda para quem pode ligar banco ali)
create or replace function public.supa_pode_editar(p_no uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select p_no is not null and p_no in (select interno.nos_editaveis()) $$;

-- ---------- 4. gravar e ler as conexões e as chaves (só service_role) ----------
create or replace function public.supa_conexao_gravar(p_espaco uuid, p_pessoa uuid, p_conta text, p_acesso text, p_renovacao text, p_expira timestamptz) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare cid uuid;
begin
  if coalesce(p_acesso, '') = '' then raise exception 'Falta a chave de acesso' using errcode = '22023'; end if;
  insert into public.supa_conexoes (espaco_id, conta, criado_por) values (p_espaco, left(coalesce(nullif(btrim(p_conta), ''), 'Supabase'), 300), p_pessoa) returning id into cid;
  insert into interno.supa_tokens (conexao_id, acesso, renovacao, expira_em) values (cid, p_acesso, p_renovacao, p_expira);
  return cid;
end $$;

create or replace function public.supa_conexao_ler(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select to_jsonb(c) || jsonb_build_object('tokens', (select jsonb_build_object('acesso', t.acesso, 'renovacao', t.renovacao, 'expira_em', t.expira_em) from interno.supa_tokens t where t.conexao_id = c.id))
    from public.supa_conexoes c where c.id = p_id
$$;

create or replace function public.supa_tokens_gravar(p_conexao uuid, p_acesso text, p_renovacao text, p_expira timestamptz) returns void
language sql security definer set search_path = public, pg_temp as $$
  update interno.supa_tokens set acesso = p_acesso, renovacao = coalesce(p_renovacao, renovacao), expira_em = p_expira, trocado_em = now() where conexao_id = p_conexao;
  update public.supa_conexoes set ultimo_erro = null where id = p_conexao;
$$;

create or replace function public.supa_conexao_erro(p_conexao uuid, p_erro text) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.supa_conexoes set ultimo_erro = left(p_erro, 500) where id = p_conexao
$$;

-- tirar uma autorização do espaço. Com banco ligado por ela, pede para desligar antes.
create or replace function public.supa_conexao_remover(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.supa_conexoes c where c.id = p_id and c.espaco_id in (select interno.meus_espacos())) or (select interno.eh_stakeholder()) then
    raise exception 'Você não pode mudar esta conta' using errcode = '42501'; end if;
  if exists (select 1 from public.infra_bancos b where b.supa_conexao_id = p_id) then
    raise exception 'Desligue antes os bancos ligados por esta conta' using errcode = '23503'; end if;
  delete from public.supa_conexoes where id = p_id;
end $$;

-- ---------- 5. o banco ligado pelo Supabase ----------
alter table public.infra_bancos add column if not exists supa_conexao_id uuid references public.supa_conexoes(id) on delete restrict;
alter table public.infra_bancos add column if not exists supa_projeto text;
alter table public.infra_bancos add column if not exists validado_em timestamptz;
alter table public.infra_bancos add column if not exists validacao jsonb;
alter table public.infra_bancos drop constraint if exists infra_bancos_supa_projeto_check;
alter table public.infra_bancos add constraint infra_bancos_supa_projeto_check check (supa_projeto is null or supa_projeto ~ '^[a-z0-9]{8,40}$');
alter table public.infra_bancos drop constraint if exists infra_bancos_supa_check;
alter table public.infra_bancos add constraint infra_bancos_supa_check check ((supa_conexao_id is null) = (supa_projeto is null));
comment on column public.infra_bancos.supa_conexao_id is 'Ligado pelo Supabase (sem senha): a autorização usada. Vazio: ligado pelo endereço com usuário e senha.';
comment on column public.infra_bancos.supa_projeto is 'O código (ref) do projeto no Supabase.';
comment on column public.infra_bancos.validacao is 'O que a conferência achou ao ligar: tabelas, colunas, chaves, regras, permissões, papéis e se a leitura é só leitura.';

-- a prova de que a conferência passou (só a função grava; a pessoa usa uma vez para ligar)
create table if not exists interno.supa_provas (
  id          uuid primary key default gen_random_uuid(),
  conexao_id  uuid not null references public.supa_conexoes(id) on delete cascade,
  projeto     text not null,
  nome_projeto text,
  esquemas    text[] not null,
  pessoa_id   uuid not null references public.pessoas(id) on delete cascade,
  resultado   jsonb not null,
  criado_em   timestamptz not null default now()
);
revoke all on interno.supa_provas from public, anon, authenticated;

create or replace function public.supa_prova_gravar(p_conexao uuid, p_pessoa uuid, p_projeto text, p_nome text, p_esquemas text[], p_resultado jsonb) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare pid uuid;
begin
  -- só passa a prova completa: só leitura e cada parte da estrutura lida
  if coalesce(p_resultado->>'ok', '') <> 'true' or coalesce(p_resultado->>'so_leitura', '') <> 'true' then raise exception 'A conferência não passou' using errcode = '22023'; end if;
  if coalesce((p_resultado->>'tabelas')::int, 0) < 1 then raise exception 'A conferência não leu nenhuma tabela' using errcode = '22023'; end if;
  delete from interno.supa_provas where criado_em < now() - interval '1 day';
  insert into interno.supa_provas (conexao_id, projeto, nome_projeto, esquemas, pessoa_id, resultado) values (p_conexao, p_projeto, left(p_nome, 200), p_esquemas, p_pessoa, p_resultado) returning id into pid;
  return pid;
end $$;

-- ligar (p_id vazio) ou trocar um banco para o jeito do Supabase, com a prova da conferência. Quem chama é a pessoa.
create or replace function public.infra_banco_supabase_ligar(p_no uuid, p_id uuid, p_nome text, p_prova uuid) returns public.infra_bancos
language plpgsql security definer set search_path = public, pg_temp as $$
declare pr interno.supa_provas; r public.infra_bancos;
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos, produtos e aplicações' using errcode = '22023'; end if;
  delete from interno.supa_provas where id = p_prova and pessoa_id = interno.pessoa_atual() and criado_em > now() - interval '15 minutes' returning * into pr;
  if pr.id is null then raise exception 'A conferência expirou ou não é sua. Clique em Conferir de novo.' using errcode = '42501'; end if;
  if not exists (select 1 from public.supa_conexoes c where c.id = pr.conexao_id and c.espaco_id in (select interno.meus_espacos())) then
    raise exception 'Esta conta do Supabase não está conectada ao seu espaço' using errcode = '42501'; end if;
  if p_id is not null then
    select * into r from public.infra_bancos where id = p_id and no_id = p_no;
    if r.id is null then raise exception 'Banco não encontrado neste ponto' using errcode = '22023'; end if;
    update public.infra_bancos set nome = coalesce(nullif(btrim(p_nome), ''), nome), provedor = 'supabase', motor = 'postgres', esquemas = pr.esquemas, ativo = true,
           servidor = pr.projeto || '.supabase.co', supa_conexao_id = pr.conexao_id, supa_projeto = pr.projeto, validado_em = now(), validacao = pr.resultado,
           ultimo_hash = null, ultima_leitura_em = null, ultimo_erro = null, conexao_trocada_em = now()
     where id = p_id returning * into r;
    -- trocou para o jeito sem senha: o endereço com a senha antiga sai
    delete from interno.infra_bancos_conexao where banco_id = r.id;
  else
    insert into public.infra_bancos (no_id, nome, provedor, motor, esquemas, ativo, servidor, supa_conexao_id, supa_projeto, validado_em, validacao, conexao_trocada_em)
    values (p_no, coalesce(nullif(btrim(p_nome), ''), coalesce(nullif(pr.nome_projeto, ''), 'Banco de produção')), 'supabase', 'postgres', pr.esquemas, true, pr.projeto || '.supabase.co',
            pr.conexao_id, pr.projeto, now(), pr.resultado, now()) returning * into r;
  end if;
  perform interno.infra_auto_chamar();
  return r;
exception when unique_violation then raise exception 'Já existe um banco com esse nome aqui' using errcode = '23505';
end $$;

-- o jeito antigo (endereço): mesma assinatura das partes 33, 36 e 42 (não cria outra versão).
-- Novo: um banco que estava ligado pelo Supabase e recebe um endereço volta para o jeito antigo.
create or replace function public.infra_banco_salvar(p_no uuid, p_id uuid, p_nome text, p_provedor text, p_motor text, p_esquemas text[], p_conexao text default null, p_ativo boolean default true)
returns public.infra_bancos
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.infra_bancos; esq text[]; con text := nullif(btrim(coalesce(p_conexao, '')), ''); host text; v_motor text := coalesce(nullif(p_motor, ''), 'postgres');
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos, produtos e aplicações' using errcode = '22023'; end if;
  if coalesce(p_provedor, '') not in ('supabase','aws','outro') then raise exception 'Provedor inválido' using errcode = '22023'; end if;
  if v_motor not in ('postgres','mysql') then raise exception 'Motor inválido' using errcode = '22023'; end if;
  if p_provedor = 'supabase' and v_motor <> 'postgres' then raise exception 'O Supabase é PostgreSQL' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct btrim(e)) filter (where btrim(e) <> ''), case when v_motor = 'mysql' then '{}'::text[] else '{public}' end) into esq from unnest(coalesce(p_esquemas, '{}')) e;
  if cardinality(esq) = 0 then raise exception 'Diga qual banco (database) ler' using errcode = '22023'; end if;
  if exists (select 1 from unnest(esq) e where e !~ '^[A-Za-z_][A-Za-z0-9_$-]{0,62}$') then raise exception 'Nome de esquema inválido' using errcode = '22023'; end if;
  if p_id is not null then
    select * into r from public.infra_bancos where id = p_id and no_id = p_no;
    if r.id is null then raise exception 'Banco não encontrado neste ponto' using errcode = '22023'; end if;
    -- ligado pelo Supabase sem endereço novo: os esquemas só mudam com uma conferência nova
    if r.supa_conexao_id is not null and con is null and (select array_agg(x order by x) from unnest(esq) x) is distinct from (select array_agg(distinct x order by x) from unnest(r.esquemas) x) then
      raise exception 'Este banco foi ligado pelo Supabase: para mudar os esquemas, use Conectar ao Supabase de novo (a leitura é conferida antes)' using errcode = '22023'; end if;
  end if;
  if con is null and p_id is null then raise exception 'Informe o endereço de conexão do banco' using errcode = '22023'; end if;
  if con is not null and ((v_motor = 'postgres' and con !~ '^postgres(ql)?://') or (v_motor = 'mysql' and con !~ '^mysql://')) then
    raise exception 'O endereço precisa começar com %', case when v_motor = 'mysql' then 'mysql://' else 'postgresql://' end using errcode = '22023'; end if;
  if con is not null then host := left(substring(con from '^[A-Za-z0-9+.-]+://(?:.*@)?([^@:/?]+)'), 255); end if;   -- o host vem depois do ÚLTIMO @: senha com @ não vaza para a tela
  if p_id is null then
    insert into public.infra_bancos (no_id, nome, provedor, motor, esquemas, ativo, servidor)
    values (p_no, coalesce(nullif(btrim(p_nome), ''), 'Banco de dados'), p_provedor, v_motor, esq, coalesce(p_ativo, true), host) returning * into r;
  else
    update public.infra_bancos set nome = coalesce(nullif(btrim(p_nome), ''), nome), provedor = case when r.supa_conexao_id is not null and con is null then 'supabase' else p_provedor end,
           motor = case when r.supa_conexao_id is not null and con is null then 'postgres' else v_motor end, esquemas = esq, ativo = coalesce(p_ativo, true),
           servidor = coalesce(host, servidor) where id = p_id returning * into r;
  end if;
  if con is not null then
    insert into interno.infra_bancos_conexao (banco_id, conexao) values (r.id, con)
    on conflict (banco_id) do update set conexao = excluded.conexao, trocado_em = now();
    -- endereço novo: lê de novo na próxima rodada (e deixa de ser pelo Supabase, se era)
    update public.infra_bancos set ultimo_hash = null, ultima_leitura_em = null, ultimo_erro = null, conexao_trocada_em = now(),
           supa_conexao_id = null, supa_projeto = null, validado_em = null, validacao = null where id = r.id returning * into r;
  end if;
  perform interno.infra_auto_chamar();
  return r;
exception when unique_violation then raise exception 'Já existe um banco com esse nome aqui' using errcode = '23505';
end $$;

-- ---------- 6. o robô passa a receber os bancos ligados pelo Supabase (sem endereço) ----------
-- mesmas assinaturas da parte 33; o que muda: o endereço é opcional quando o banco é do Supabase, e vão supa_conexao_id e supa_projeto
create or replace function public.infra_auto_bancos_devidos(p_limite integer default 5) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'no_id', b.no_id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', c.conexao,
                                               'supa_conexao_id', b.supa_conexao_id, 'supa_projeto', b.supa_projeto, 'ultimo_hash', b.ultimo_hash)), '[]')
    from (select * from public.infra_bancos b where b.ativo and (b.ultima_leitura_em is null or b.ultima_leitura_em < now() - interval '55 minutes')
           order by b.ultima_leitura_em nulls first limit greatest(1, least(coalesce(p_limite, 5), 20))) b
    left join interno.infra_bancos_conexao c on c.banco_id = b.id
   where c.conexao is not null or b.supa_conexao_id is not null
$$;

create or replace function public.infra_auto_proximos(p_limite integer default 3) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
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
end $$;

-- ---------- quem chama o quê ----------
revoke all on function public.supa_app_status(), public.supa_app_gravar(text, text, text), public.supa_app_ler(), public.supa_estado_novo(), public.supa_estado_usar(text), public.supa_eu(), public.supa_pode_editar(uuid),
  public.supa_conexao_gravar(uuid, uuid, text, text, text, timestamptz), public.supa_conexao_ler(uuid), public.supa_tokens_gravar(uuid, text, text, timestamptz),
  public.supa_conexao_erro(uuid, text), public.supa_conexao_remover(uuid), public.supa_prova_gravar(uuid, uuid, text, text, text[], jsonb),
  public.infra_banco_supabase_ligar(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.supa_app_status(), public.supa_app_gravar(text, text, text), public.supa_estado_novo(), public.supa_estado_usar(text), public.supa_eu(), public.supa_pode_editar(uuid),
  public.supa_conexao_remover(uuid), public.infra_banco_supabase_ligar(uuid, uuid, text, uuid) to authenticated;
revoke all on function public.supa_app_ler(), public.supa_conexao_gravar(uuid, uuid, text, text, text, timestamptz), public.supa_conexao_ler(uuid),
  public.supa_tokens_gravar(uuid, text, text, timestamptz), public.supa_conexao_erro(uuid, text), public.supa_prova_gravar(uuid, uuid, text, text, text[], jsonb) from authenticated;
grant execute on function public.supa_app_ler(), public.supa_conexao_gravar(uuid, uuid, text, text, text, timestamptz), public.supa_conexao_ler(uuid),
  public.supa_tokens_gravar(uuid, text, text, timestamptz), public.supa_conexao_erro(uuid, text), public.supa_prova_gravar(uuid, uuid, text, text, text[], jsonb) to service_role;
