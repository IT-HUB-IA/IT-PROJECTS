-- =====================================================================
-- CicloDev · 33 · Vários bancos de dados por ponto (Supabase, AWS e outros)
-- Um projeto, produto ou aplicação pode ligar quantos bancos quiser (produção, relatórios, legado...). Cada banco tem:
--   nome, provedor (supabase, aws ou outro), motor (postgres ou mysql), os esquemas (no MySQL, os bancos) e o endereço.
-- O endereço com a senha continua em interno.infra_bancos_conexao, agora um por banco, e só a função diagramas-auto lê.
-- Cada banco gera os próprios desenhos (DER por esquema e, no Postgres, o mapa de acesso), com a chave "banco:<id>:".
-- Troca a parte 30: infra_banco_definir(p_no, ...) sai e entra infra_banco_salvar(p_no, p_id, ...);
-- infra_banco_remover e infra_auto_banco_lido passam a receber o id do banco.
-- =====================================================================

-- ---------- a tabela: um id por banco ----------
alter table public.infra_bancos add column if not exists id uuid not null default gen_random_uuid();
alter table public.infra_bancos add column if not exists provedor text not null default 'outro';
alter table public.infra_bancos add column if not exists motor text not null default 'postgres';
alter table public.infra_bancos add column if not exists servidor text;   -- o host, sem usuário nem senha, para a tela mostrar
alter table public.infra_bancos drop constraint if exists infra_bancos_provedor_check;
alter table public.infra_bancos add constraint infra_bancos_provedor_check check (provedor in ('supabase','aws','outro'));
alter table public.infra_bancos drop constraint if exists infra_bancos_motor_check;
alter table public.infra_bancos add constraint infra_bancos_motor_check check (motor in ('postgres','mysql'));
alter table public.infra_bancos drop constraint if exists infra_bancos_servidor_check;
alter table public.infra_bancos add constraint infra_bancos_servidor_check check (servidor is null or length(servidor) <= 255);

-- a conexão passa a ser do banco (e não mais do ponto)
alter table interno.infra_bancos_conexao add column if not exists banco_id uuid;
update interno.infra_bancos_conexao c set banco_id = b.id from public.infra_bancos b where b.no_id = c.no_id and c.banco_id is null;
alter table interno.infra_bancos_conexao drop constraint if exists infra_bancos_conexao_no_id_fkey;
alter table interno.infra_bancos_conexao drop constraint if exists infra_bancos_conexao_pkey;
alter table interno.infra_bancos_conexao drop column if exists no_id;
alter table interno.infra_bancos_conexao alter column banco_id set not null;

alter table public.infra_bancos drop constraint if exists infra_bancos_pkey;
alter table public.infra_bancos add constraint infra_bancos_pkey primary key (id);
create index if not exists infra_bancos_no_idx on public.infra_bancos (no_id);
alter table public.infra_bancos drop constraint if exists infra_bancos_no_nome_key;
alter table public.infra_bancos add constraint infra_bancos_no_nome_key unique (no_id, nome);

alter table interno.infra_bancos_conexao drop constraint if exists infra_bancos_conexao_banco_pkey;
alter table interno.infra_bancos_conexao add constraint infra_bancos_conexao_banco_pkey primary key (banco_id);
alter table interno.infra_bancos_conexao drop constraint if exists infra_bancos_conexao_banco_fkey;
alter table interno.infra_bancos_conexao add constraint infra_bancos_conexao_banco_fkey foreign key (banco_id) references public.infra_bancos(id) on delete cascade;
alter table interno.infra_bancos_conexao drop constraint if exists infra_bancos_conexao_conexao_check;
alter table interno.infra_bancos_conexao add constraint infra_bancos_conexao_conexao_check check (conexao ~ '^(postgres(ql)?|mysql)://' and length(conexao) <= 1000);

comment on table public.infra_bancos is 'Bancos de dados ligados a um projeto, produto ou aplicação (só leitura), para o DER e o mapa de acesso saírem sozinhos. Vários por ponto. O endereço com a senha fica em interno.infra_bancos_conexao.';
comment on column public.infra_bancos.provedor is 'Onde o banco está: supabase, aws (RDS ou Aurora) ou outro.';
comment on column public.infra_bancos.motor is 'postgres ou mysql (no MySQL os esquemas são os bancos).';

-- o pedido da fila sabe de qual banco é (leitura de hora em hora de um banco só)
alter table public.infra_automacoes add column if not exists banco_id uuid references public.infra_bancos(id) on delete set null;

-- ---------- o que a tela chama ----------
drop function if exists public.infra_banco_definir(uuid, text, text[], text, boolean);
drop function if exists public.infra_banco_remover(uuid);

-- criar (p_id vazio) ou mudar um banco. p_conexao vazio mantém o endereço que já está guardado.
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
  end if;
  if con is null and p_id is null then raise exception 'Informe o endereço de conexão do banco' using errcode = '22023'; end if;
  if con is not null and ((v_motor = 'postgres' and con !~ '^postgres(ql)?://') or (v_motor = 'mysql' and con !~ '^mysql://')) then
    raise exception 'O endereço precisa começar com %', case when v_motor = 'mysql' then 'mysql://' else 'postgresql://' end using errcode = '22023'; end if;
  if con is not null then host := left(substring(con from '@([^:/?]+)'), 255); end if;
  if p_id is null then
    insert into public.infra_bancos (no_id, nome, provedor, motor, esquemas, ativo, servidor)
    values (p_no, coalesce(nullif(btrim(p_nome), ''), 'Banco de dados'), p_provedor, v_motor, esq, coalesce(p_ativo, true), host) returning * into r;
  else
    update public.infra_bancos set nome = coalesce(nullif(btrim(p_nome), ''), nome), provedor = p_provedor, motor = v_motor, esquemas = esq, ativo = coalesce(p_ativo, true),
           servidor = coalesce(host, servidor) where id = p_id returning * into r;
  end if;
  if con is not null then
    insert into interno.infra_bancos_conexao (banco_id, conexao) values (r.id, con)
    on conflict (banco_id) do update set conexao = excluded.conexao, trocado_em = now();
    -- endereço novo: lê de novo na próxima rodada
    update public.infra_bancos set ultimo_hash = null, ultima_leitura_em = null, ultimo_erro = null where id = r.id returning * into r;
  end if;
  perform interno.infra_auto_chamar();
  return r;
exception when unique_violation then raise exception 'Já existe um banco com esse nome aqui' using errcode = '23505';
end $$;

-- desligar um banco: tira o endereço guardado (os desenhos que já saíram ficam)
create or replace function public.infra_banco_remover(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.infra_bancos;
begin
  select * into b from public.infra_bancos where id = p_id;
  if b.id is null or b.no_id not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este banco' using errcode = '42501'; end if;
  delete from public.infra_bancos where id = p_id;
end $$;

-- ---------- o que só a função diagramas-auto chama (service_role) ----------
-- os bancos que não são lidos há mais de uma hora
create or replace function public.infra_auto_bancos_devidos(p_limite integer default 5) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'no_id', b.no_id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', c.conexao, 'ultimo_hash', b.ultimo_hash)), '[]')
    from (select * from public.infra_bancos b where b.ativo and (b.ultima_leitura_em is null or b.ultima_leitura_em < now() - interval '55 minutes')
           order by b.ultima_leitura_em nulls first limit greatest(1, least(coalesce(p_limite, 5), 20))) b
    join interno.infra_bancos_conexao c on c.banco_id = b.id
$$;

-- a função leu um banco: guarda o resumo da estrutura; se mudou (e p_abrir), abre um pedido 'banco' já rodando e devolve o id.
-- Dentro de um "Atualizar agora" o pedido já existe: p_abrir = false só guarda o resumo.
drop function if exists public.infra_auto_banco_lido(uuid, text, text, boolean);
create or replace function public.infra_auto_banco_lido(p_banco uuid, p_hash text, p_erro text default null, p_abrir boolean default true) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.infra_bancos; novo uuid;
begin
  select * into b from public.infra_bancos where id = p_banco for update;
  if not found then return null; end if;
  if p_erro is not null then
    update public.infra_bancos set ultima_leitura_em = now(), ultimo_erro = left(p_erro, 1000) where id = p_banco; return null; end if;
  update public.infra_bancos set ultima_leitura_em = now(), ultimo_erro = null,
         ultimo_hash = p_hash, ultima_mudanca_em = case when b.ultimo_hash is distinct from p_hash then now() else b.ultima_mudanca_em end
   where id = p_banco;
  if b.ultimo_hash is not distinct from p_hash or not coalesce(p_abrir, true) then return null; end if;
  insert into public.infra_automacoes (no_id, origem, referencia, status, iniciado_em, tentativas, pedido_por, banco_id)
  values (b.no_id, 'banco', left(p_hash, 200), 'rodando', now(), 1, null, b.id) returning id into novo;
  return novo;
end $$;

-- a fila: cada pedido leva a lista de bancos (o "Atualizar agora" relê todos os do ponto; a leitura de hora em hora, só o dela)
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
      'bancos', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'provedor', b.provedor, 'motor', b.motor, 'esquemas', b.esquemas, 'conexao', c.conexao) order by b.nome), '[]')
                   from public.infra_bancos b join interno.infra_bancos_conexao c on c.banco_id = b.id
                  where b.no_id = a.no_id and b.ativo and a.repositorio_id is null
                    and (a.origem = 'manual' or (a.origem = 'banco' and (a.banco_id is null or b.id = a.banco_id))))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $$;

-- ---------- quem chama o quê ----------
revoke all on function public.infra_banco_salvar(uuid, uuid, text, text, text, text[], text, boolean), public.infra_banco_remover(uuid) from public, anon;
grant execute on function public.infra_banco_salvar(uuid, uuid, text, text, text, text[], text, boolean), public.infra_banco_remover(uuid) to authenticated;
revoke all on function public.infra_auto_bancos_devidos(integer), public.infra_auto_banco_lido(uuid, text, text, boolean), public.infra_auto_proximos(integer) from public, anon, authenticated;
grant execute on function public.infra_auto_bancos_devidos(integer), public.infra_auto_banco_lido(uuid, text, text, boolean), public.infra_auto_proximos(integer) to service_role;
