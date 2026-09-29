-- =====================================================================
-- CicloDev · 25 · Permissões de IA e conversa de cada usuário com o seu agente
--
--   ia_permissoes   quem pode usar a IA. Começa todo mundo desligado; só o dono do sistema liga ou desliga
--                   (Admin › Permissões de IA). Cada pessoa só lê a própria linha, para a tela saber se mostra o balão.
--   ia_mensagens    a conversa de cada usuário com o seu agente. Cada pessoa só lê e escreve a própria conversa;
--                   nem o dono do sistema lê a conversa dos outros pela tela.
--
-- Regra que vale para quando o agente for ligado (ainda não existe agente respondendo):
--   o agente de um usuário só enxerga o que esse usuário enxerga no sistema (interno.nos_visiveis() dele).
--   Nunca vê nem fala de projeto a que o dono dele não tem acesso.
-- Depende das partes 01, 15 e 16.
-- =====================================================================

create table if not exists public.ia_permissoes (
  pessoa_id    uuid primary key references public.pessoas(id) on delete cascade,
  ativo        boolean not null default false,
  alterado_por uuid references public.pessoas(id) on delete set null,
  alterado_em  timestamptz not null default now()
);
comment on table public.ia_permissoes is 'Quem pode usar a IA. Sem linha ou ativo = false: não usa. Só o dono do sistema muda (função admin_ia_definir).';

create table if not exists public.ia_mensagens (
  id        uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null default interno.pessoa_atual() references public.pessoas(id) on delete cascade,
  autor     text not null check (autor in ('usuario','agente')),
  texto     text not null check (length(btrim(texto)) between 1 and 8000),
  criado_em timestamptz not null default now()
);
create index if not exists ia_mensagens_pessoa_idx on public.ia_mensagens (pessoa_id, criado_em);
comment on table public.ia_mensagens is 'Conversa de cada usuário com o seu agente. Cada pessoa só vê a própria. O agente (quando existir) grava as respostas pelo lado do servidor.';

alter table public.ia_permissoes enable row level security;
alter table public.ia_mensagens enable row level security;

drop policy if exists propria on public.ia_permissoes;
create policy propria on public.ia_permissoes for select to authenticated
  using (pessoa_id = (select interno.pessoa_atual()));

drop policy if exists ver on public.ia_mensagens;
create policy ver on public.ia_mensagens for select to authenticated
  using (pessoa_id = (select interno.pessoa_atual()));
drop policy if exists escrever on public.ia_mensagens;
create policy escrever on public.ia_mensagens for insert to authenticated
  with check (pessoa_id = (select interno.pessoa_atual()) and autor = 'usuario'
              and exists (select 1 from public.ia_permissoes p where p.pessoa_id = (select interno.pessoa_atual()) and p.ativo));

revoke all on public.ia_permissoes, public.ia_mensagens from anon, authenticated;
grant select on public.ia_permissoes to authenticated;
grant select, insert on public.ia_mensagens to authenticated;
grant all on public.ia_permissoes, public.ia_mensagens to service_role;

-- a própria pessoa: posso usar a IA?
create or replace function public.ia_posso() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select p.ativo from public.ia_permissoes p where p.pessoa_id = interno.pessoa_atual()), false)
$$;

-- Admin: a situação de cada usuário (a lista de nomes vem de admin_usuarios)
create or replace function public.admin_ia_permissoes() returns table (pessoa_id uuid, ativo boolean, alterado_em timestamptz, alterado_por text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  return query select p.id, coalesce(ip.ativo, false), ip.alterado_em, q.nome
    from public.pessoas p left join public.ia_permissoes ip on ip.pessoa_id = p.id left join public.pessoas q on q.id = ip.alterado_por;
end $$;

-- Admin: liga ou desliga a IA de um usuário
create or replace function public.admin_ia_definir(p_pessoa uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform interno.exigir_dono();
  if not exists (select 1 from public.pessoas where id = p_pessoa) then raise exception 'Usuário não encontrado' using errcode = 'P0002'; end if;
  insert into public.ia_permissoes (pessoa_id, ativo, alterado_por, alterado_em) values (p_pessoa, coalesce(p_ativo, false), interno.pessoa_atual(), now())
    on conflict (pessoa_id) do update set ativo = excluded.ativo, alterado_por = excluded.alterado_por, alterado_em = excluded.alterado_em;
  return coalesce(p_ativo, false);
end $$;

revoke all on function public.ia_posso(), public.admin_ia_permissoes(), public.admin_ia_definir(uuid, boolean) from public, anon;
grant execute on function public.ia_posso(), public.admin_ia_permissoes(), public.admin_ia_definir(uuid, boolean) to authenticated;
