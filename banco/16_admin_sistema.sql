-- =====================================================================
-- Parte 16: dono do sistema (único Master) e módulo Admin
-- Depende da parte 15 (espaços).
-- Todo usuário continua com um nível só. O dono do sistema tem, além do espaço dele,
-- o módulo Admin: lista de usuários, dados do cadastro, uso, histórico e desempenho.
-- Ele NÃO ganha acesso aos projetos dos outros: vê números (quantos projetos, itens,
-- acessos), nunca o conteúdo.
-- =====================================================================

-- quem é dono do sistema (só pelo banco; a tela não grava aqui)
create table if not exists interno.donos_sistema (
  pessoa_id  uuid primary key references public.pessoas(id) on delete cascade,
  desde      timestamptz not null default now()
);
comment on table interno.donos_sistema is 'Dono(s) do Sistema IT.IA. Só muda pelo banco. Hoje: William (login admin@it-ia.tec.br).';
revoke all on interno.donos_sistema from public, anon, authenticated;
insert into interno.donos_sistema (pessoa_id)
  select id from public.pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28' on conflict do nothing;

create or replace function interno.eh_dono_sistema() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from interno.donos_sistema d where d.pessoa_id = interno.pessoa_atual())
$$;
create or replace function public.sou_dono_sistema() returns boolean
language sql stable security invoker set search_path = public, pg_temp as $$ select interno.eh_dono_sistema() $$;

-- o dono do sistema também pode ver os dados do cadastro (o texto do aceite avisa isso)
comment on table public.pessoas_privado is 'Dados pessoais do cadastro (LGPD). Só a própria pessoa e a administração do sistema (módulo Admin) veem. Nunca aparecem para quem compartilha com ela.';

-- ---------------------------------------------------------------------
-- registro de uso: a tela anota entradas, telas abertas, tempo ativo e desempenho
-- ---------------------------------------------------------------------
create table if not exists public.uso_eventos (
  id         bigint generated always as identity primary key,
  pessoa_id  uuid not null default interno.pessoa_atual() references public.pessoas(id) on delete cascade,
  espaco_id  uuid default interno.meu_espaco() references public.espacos(id) on delete set null,
  tipo       text not null check (tipo in ('entrou','tela','ativo','carregou','salvou','erro','saiu')),
  tela       text check (tela is null or length(tela) <= 60),
  ms         integer check (ms is null or ms between 0 and 600000),
  detalhe    jsonb check (detalhe is null or pg_column_size(detalhe) <= 2000),
  em         timestamptz not null default now()
);
comment on table public.uso_eventos is 'Uso do sistema (para o módulo Admin): entradas, telas, minutos ativos, tempo de carregar e salvar, erros. Cada um só grava o próprio; ninguém lê pela tela, só pelas funções do Admin.';
create index if not exists uso_eventos_pessoa_em on public.uso_eventos (pessoa_id, em desc);
create index if not exists uso_eventos_em on public.uso_eventos (em desc);
create index if not exists uso_eventos_tipo_em on public.uso_eventos (tipo, em desc);
alter table public.uso_eventos enable row level security;
drop policy if exists grava on public.uso_eventos;
create policy grava on public.uso_eventos for insert to authenticated
  with check (pessoa_id = (select interno.pessoa_atual()) and em > now() - interval '5 minutes' and em < now() + interval '5 minutes');
revoke all on public.uso_eventos from public, anon, authenticated;
grant insert (tipo, tela, ms, detalhe) on public.uso_eventos to authenticated;
grant all on public.uso_eventos to service_role;

-- ---------------------------------------------------------------------
-- funções do Admin (todas conferem se quem chama é o dono do sistema)
-- ---------------------------------------------------------------------
create or replace function interno.exigir_dono() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not interno.eh_dono_sistema() then raise exception 'Só o dono do sistema pode ver isso' using errcode = '42501'; end if;
end $$;

-- números gerais
create or replace function public.admin_resumo() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r jsonb;
begin
  perform interno.exigir_dono();
  with contas as (select p.id, p.criado_em from public.pessoas p where p.auth_user_id is not null),
       ev as (select pessoa_id, tipo, ms, em from public.uso_eventos where em > now() - interval '30 days')
  select jsonb_build_object(
    'usuarios',            (select count(*) from contas),
    'novos_7d',            (select count(*) from contas where criado_em > now() - interval '7 days'),
    'novos_30d',           (select count(*) from contas where criado_em > now() - interval '30 days'),
    'ativos_1d',           (select count(distinct pessoa_id) from ev where em > now() - interval '1 day'),
    'ativos_7d',           (select count(distinct pessoa_id) from ev where em > now() - interval '7 days'),
    'ativos_30d',          (select count(distinct pessoa_id) from ev),
    'confirmados',         (select count(*) from auth.users where email_confirmed_at is not null),
    'espacos',             (select count(*) from public.espacos where not modelo),
    'clientes',            (select count(*) from public.nos where tipo = 'cliente'),
    'projetos',            (select count(*) from public.nos where tipo = 'projeto'),
    'aplicacoes',          (select count(*) from public.nos where tipo = 'aplicacao'),
    'itens',               (select count(*) from public.itens),
    'compartilhamentos',   (select count(*) from public.participacoes p join public.nos n on n.id = p.no_id where not exists (select 1 from public.espacos e where e.id = n.espaco_id and e.dono_id = p.pessoa_id)),
    'convites_pendentes',  (select count(*) from public.convites where aceito_em is null),
    'minutos_ativos_7d',   (select count(*) * 5 from ev where tipo = 'ativo' and em > now() - interval '7 days'),
    'carregar_ms_mediana', (select percentile_cont(0.5) within group (order by ms)::int from ev where tipo = 'carregou' and em > now() - interval '7 days'),
    'carregar_ms_p95',     (select percentile_cont(0.95) within group (order by ms)::int from ev where tipo = 'carregou' and em > now() - interval '7 days'),
    'salvar_ms_mediana',   (select percentile_cont(0.5) within group (order by ms)::int from ev where tipo = 'salvou' and em > now() - interval '7 days'),
    'erros_7d',            (select count(*) from ev where tipo = 'erro' and em > now() - interval '7 days'),
    'salvamentos_7d',      (select count(*) from ev where tipo = 'salvou' and em > now() - interval '7 days'),
    'banco_mb',            round(pg_database_size(current_database()) / 1048576.0, 1),
    'gerado_em',           now()
  ) into r;
  return r;
end $$;

-- lista de usuários com o cadastro e os índices de uso
create or replace function public.admin_usuarios() returns table (
  pessoa_id uuid, numero bigint, nome text, email text, usuario text, dono_sistema boolean,
  criado_em timestamptz, email_confirmado boolean, ultimo_acesso timestamptz,
  nome_completo text, data_nascimento date, cpf text, cep text, logradouro text, numero_end text, complemento text,
  bairro text, cidade text, uf text, uso text, cargo text, empresa text, termos_aceitos_em timestamptz,
  clientes bigint, projetos bigint, aplicacoes bigint, itens bigint, itens_concluidos bigint,
  compartilhou bigint, recebeu bigint, entradas_30d bigint, dias_ativos_30d bigint, minutos_ativos_30d bigint,
  eventos_30d bigint, erros_30d bigint, indice_uso integer
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query
  with ev as (
    select e.pessoa_id,
           count(*) filter (where e.tipo = 'entrou') as entradas,
           count(distinct date_trunc('day', e.em)) as dias,
           count(*) filter (where e.tipo = 'ativo') * 5 as minutos,
           count(*) as eventos,
           count(*) filter (where e.tipo = 'erro') as erros,
           max(e.em) as ultimo
      from public.uso_eventos e where e.em > now() - interval '30 days' group by e.pessoa_id
  ), nos_c as (
    select n.espaco_id,
           count(*) filter (where n.tipo = 'cliente') as clientes,
           count(*) filter (where n.tipo = 'projeto') as projetos,
           count(*) filter (where n.tipo = 'aplicacao') as aplicacoes
      from public.nos n group by n.espaco_id
  ), it as (
    select n.espaco_id, count(*) as itens,
           count(*) filter (where i.concluido_em is not null) as concluidos
      from public.itens i join public.nos n on n.id = i.frente_id group by n.espaco_id
  ), comp as (
    select n.espaco_id, count(*) as qtd from public.participacoes pa join public.nos n on n.id = pa.no_id
      where not exists (select 1 from public.espacos e where e.id = n.espaco_id and e.dono_id = pa.pessoa_id) group by n.espaco_id
  ), rec as (
    select pa.pessoa_id, count(*) as qtd from public.participacoes pa join public.nos n on n.id = pa.no_id
      where not exists (select 1 from public.espacos e where e.id = n.espaco_id and e.dono_id = pa.pessoa_id) group by pa.pessoa_id
  )
  select p.id, p.numero, p.nome, coalesce(u.email, p.email)::text, p.usuario, exists (select 1 from interno.donos_sistema d where d.pessoa_id = p.id),
         coalesce(u.created_at, p.criado_em), u.email_confirmed_at is not null, greatest(u.last_sign_in_at, ev.ultimo),
         pp.nome_completo, pp.data_nascimento, pp.cpf, pp.cep, pp.logradouro, pp.numero, pp.complemento,
         pp.bairro, pp.cidade, pp.uf, pp.uso, pp.cargo, pp.empresa, pp.termos_aceitos_em,
         coalesce(nc.clientes, 0), coalesce(nc.projetos, 0), coalesce(nc.aplicacoes, 0), coalesce(it.itens, 0), coalesce(it.concluidos, 0),
         coalesce(comp.qtd, 0), coalesce(rec.qtd, 0), coalesce(ev.entradas, 0), coalesce(ev.dias, 0), coalesce(ev.minutos, 0),
         coalesce(ev.eventos, 0), coalesce(ev.erros, 0),
         -- índice de uso (0 a 100): frequência (dias ativos) 50%, tempo ativo 30%, volume de trabalho 20%
         least(100, round(
           least(coalesce(ev.dias, 0), 20) / 20.0 * 50 +
           least(coalesce(ev.minutos, 0), 1200) / 1200.0 * 30 +
           least(coalesce(it.itens, 0) + coalesce(nc.projetos, 0) * 5, 100) / 100.0 * 20))::int
    from public.pessoas p
    left join auth.users u on u.id = p.auth_user_id
    left join public.pessoas_privado pp on pp.pessoa_id = p.id
    left join public.espacos es on es.dono_id = p.id and es.pessoal and not es.modelo
    left join ev on ev.pessoa_id = p.id
    left join nos_c nc on nc.espaco_id = es.id
    left join it on it.espaco_id = es.id
    left join comp on comp.espaco_id = es.id
    left join rec on rec.pessoa_id = p.id
   where p.auth_user_id is not null
   order by coalesce(u.created_at, p.criado_em) desc;
end $$;

-- série por dia (gráficos)
create or replace function public.admin_uso_diario(p_dias integer default 30) returns table (
  dia date, cadastros bigint, ativos bigint, entradas bigint, minutos_ativos bigint, erros bigint, carregar_ms integer, salvar_ms integer
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare n int := least(greatest(coalesce(p_dias, 30), 1), 365);
begin
  perform interno.exigir_dono();
  return query
  with d as (select generate_series(current_date - (n - 1), current_date, interval '1 day')::date as dia),
       ev as (select e.em::date as dia, e.pessoa_id, e.tipo, e.ms from public.uso_eventos e where e.em >= current_date - (n - 1))
  select d.dia,
         (select count(*) from public.pessoas p where p.auth_user_id is not null and p.criado_em::date = d.dia),
         (select count(distinct ev.pessoa_id) from ev where ev.dia = d.dia),
         (select count(*) from ev where ev.dia = d.dia and ev.tipo = 'entrou'),
         (select count(*) * 5 from ev where ev.dia = d.dia and ev.tipo = 'ativo'),
         (select count(*) from ev where ev.dia = d.dia and ev.tipo = 'erro'),
         (select percentile_cont(0.5) within group (order by ev.ms)::int from ev where ev.dia = d.dia and ev.tipo = 'carregou'),
         (select percentile_cont(0.5) within group (order by ev.ms)::int from ev where ev.dia = d.dia and ev.tipo = 'salvou')
    from d order by d.dia;
end $$;

-- telas mais usadas
create or replace function public.admin_telas(p_dias integer default 30) returns table (tela text, aberturas bigint, pessoas bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select e.tela, count(*), count(distinct e.pessoa_id) from public.uso_eventos e
    where e.tipo = 'tela' and e.tela is not null and e.em > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365))
    group by e.tela order by 2 desc limit 30;
end $$;

-- histórico de uso de uma pessoa
create or replace function public.admin_historico(p_pessoa uuid, p_limite integer default 200) returns table (em timestamptz, tipo text, tela text, ms integer, detalhe jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select e.em, e.tipo, e.tela, e.ms, e.detalhe from public.uso_eventos e
    where e.pessoa_id = p_pessoa and e.tipo <> 'ativo' order by e.em desc limit least(greatest(coalesce(p_limite, 200), 1), 1000);
end $$;

-- tamanho das tabelas (desempenho do banco)
create or replace function public.admin_banco() returns table (tabela text, linhas bigint, tamanho_kb bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select c.relname::text, greatest(c.reltuples, 0)::bigint, (pg_total_relation_size(c.oid) / 1024)::bigint
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 25;
end $$;

-- permissões: nada para anon; as funções do Admin checam o dono por dentro
revoke execute on function interno.eh_dono_sistema(), interno.exigir_dono() from public, anon;
grant execute on function interno.eh_dono_sistema(), interno.exigir_dono() to authenticated, service_role;
revoke execute on function public.sou_dono_sistema(), public.admin_resumo(), public.admin_usuarios(), public.admin_uso_diario(integer),
  public.admin_telas(integer), public.admin_historico(uuid, integer), public.admin_banco() from public, anon;
grant execute on function public.sou_dono_sistema(), public.admin_resumo(), public.admin_usuarios(), public.admin_uso_diario(integer),
  public.admin_telas(integer), public.admin_historico(uuid, integer), public.admin_banco() to authenticated;
