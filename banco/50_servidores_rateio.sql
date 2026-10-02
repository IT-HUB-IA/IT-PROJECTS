-- CicloDev · 50 · Servidores: divisão por percentual ou por valor, mais recorrências e os lançamentos de cada período.
--   * servidores.rateio: igual, peso, percentual (cada aplicação com o seu %) ou valor (cada aplicação com o seu R$ por mês).
--   * servidores_alcance.percentual e .valor: a parte de cada ponto (o front grava nas linhas das aplicações).
--   * servidores_custos.recorrencia: mensal, trimestral, semestral, anual ou único. fim vazio = renova até cancelar;
--     fim com data = para de cobrar naquela data.
--   * servidores_lancamentos: um lançamento por período (mês, trimestre, semestre ou ano) de cada custo, do início até
--     hoje ou até o fim. Gerado pelo banco (todo dia e quando o servidor é salvo); ninguém escreve direto.
-- Pode rodar de novo sem estragar nada.

-- ---------- divisão ----------
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.servidores'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%rateio%' loop
    execute format('alter table public.servidores drop constraint %I', c);
  end loop;
  alter table public.servidores add constraint servidores_rateio_check check (rateio in ('igual','peso','percentual','valor'));
  for c in select conname from pg_constraint where conrelid = 'public.servidores_custos'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%recorrencia%' loop
    execute format('alter table public.servidores_custos drop constraint %I', c);
  end loop;
  alter table public.servidores_custos add constraint servidores_custos_recorrencia_check check (recorrencia in ('mensal','trimestral','semestral','anual','unico'));
end $$;
alter table public.servidores_alcance add column if not exists percentual numeric(6,2) check (percentual is null or percentual between 0 and 100);
alter table public.servidores_alcance add column if not exists valor numeric(12,2) check (valor is null or valor >= 0);
comment on column public.servidores_alcance.percentual is 'Rateio por percentual: quanto (%) do custo mensal este ponto paga.';
comment on column public.servidores_alcance.valor is 'Rateio por valor: quanto (R$ por mês) este ponto paga.';
comment on column public.servidores_custos.fim is 'Vazio: renova até cancelar (todo período gera um lançamento). Com data: para de cobrar nela.';

-- ---------- lançamentos ----------
create table if not exists public.servidores_lancamentos (
  id           uuid primary key default gen_random_uuid(),
  servidor_id  uuid not null references public.servidores(id) on delete cascade,
  custo_id     uuid references public.servidores_custos(id) on delete set null,   -- o custo some, o histórico fica
  descricao    text not null default '',
  competencia  date not null,
  valor        numeric(12,2) not null check (valor >= 0),
  moeda        text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  recorrencia  text not null default 'mensal',
  criado_em    timestamptz not null default now(),
  unique (custo_id, competencia)
);
create index if not exists servidores_lancamentos_srv_idx on public.servidores_lancamentos (servidor_id, competencia);
comment on table public.servidores_lancamentos is 'Um lançamento por período de cada custo do servidor (gerado pelo banco). Cancelar o custo (fim) para de gerar; o histórico fica.';
revoke all on public.servidores_lancamentos from public, anon, authenticated;
alter table public.servidores_lancamentos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'servidores_lancamentos' and policyname = 'ver') then
    create policy ver on public.servidores_lancamentos for select to authenticated using (interno.servidor_ve(servidor_id));
  end if;
end $$;
grant select on public.servidores_lancamentos to authenticated;
grant all on public.servidores_lancamentos to service_role;

-- gera o que falta: do início até hoje (ou até o fim), um por período; nunca repete
create or replace function interno.servidores_lancar(p_servidor uuid default null) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  insert into public.servidores_lancamentos (servidor_id, custo_id, descricao, competencia, valor, moeda, recorrencia)
  select c.servidor_id, c.id, c.descricao, d::date, c.valor, c.moeda, c.recorrencia
    from public.servidores_custos c
    join public.servidores s on s.id = c.servidor_id and s.status <> 'desligado'
    cross join lateral generate_series(c.inicio::timestamp, least(coalesce(c.fim, current_date), current_date)::timestamp,
      case c.recorrencia when 'trimestral' then interval '3 months' when 'semestral' then interval '6 months' when 'anual' then interval '1 year' when 'unico' then interval '1000 years' else interval '1 month' end) d
   where (p_servidor is null or c.servidor_id = p_servidor) and c.inicio <= current_date
  on conflict (custo_id, competencia) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function interno.servidores_lancar(uuid) from public, anon, authenticated;
grant execute on function interno.servidores_lancar(uuid) to service_role;

-- quem edita o servidor pede para gerar na hora (depois de salvar)
create or replace function public.servidores_lancar(p_servidor uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not interno.servidor_edita(p_servidor) then raise exception 'Só quem edita este servidor gera os lançamentos' using errcode = '42501'; end if;
  return interno.servidores_lancar(p_servidor);
end $$;
revoke execute on function public.servidores_lancar(uuid) from public, anon;
grant execute on function public.servidores_lancar(uuid) to authenticated, service_role;

-- todo dia (só onde existe pg_cron, no Supabase)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ciclodev_servidores_lancamentos';
    perform cron.schedule('ciclodev_servidores_lancamentos', '17 3 * * *', 'select interno.servidores_lancar()');
  end if;
end $$;
