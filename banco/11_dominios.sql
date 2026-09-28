-- =====================================================================
-- Sistema IT.IA · 11 · Cadastro de domínios (pedido do William em 28/09/2026)
-- Cada domínio, onde foi comprado, onde o DNS é administrado, vencimento, custo e os registros (subdomínios, e-mail, verificações).
-- Sem repetir informação: o custo aponta para custos_operacao (domínio da própria IT.IA) ou custos_tecnicos (domínio de cliente);
-- a empresa dona vem da árvore (no_id). Só o Master vê e muda.
-- =====================================================================

create table if not exists public.dominios (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null unique check (nome ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  no_id                 uuid references public.nos(id) on delete set null,
  registrador           text not null,
  dns_em                text,
  servidores_dns        text[] not null default '{}',
  comprado_em           date,
  vence_em              date,
  renovacao_automatica  boolean,
  custo_operacao_id     uuid references public.custos_operacao(id) on delete set null,
  custo_tecnico_id      uuid references public.custos_tecnicos(id) on delete set null,
  email_provedor        text,
  acesso_onde           text,
  observacoes           text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  check (vence_em is null or comprado_em is null or vence_em >= comprado_em),
  check (num_nonnulls(custo_operacao_id, custo_tecnico_id) <= 1)
);
comment on table public.dominios is 'Domínios do grupo. no_id vazio = domínio da própria IT.IA. acesso_onde diz onde fica o acesso ao painel, nunca a senha.';
comment on column public.dominios.renovacao_automatica is 'Vazio = ainda não informado.';
create index if not exists dominios_no_idx on public.dominios (no_id) where no_id is not null;
create index if not exists dominios_vence_idx on public.dominios (vence_em) where vence_em is not null;
create index if not exists dominios_custo_op_idx on public.dominios (custo_operacao_id) where custo_operacao_id is not null;
create index if not exists dominios_custo_tec_idx on public.dominios (custo_tecnico_id) where custo_tecnico_id is not null;

create table if not exists public.dominios_registros (
  id              uuid primary key default gen_random_uuid(),
  dominio_id      uuid not null references public.dominios(id) on delete cascade,
  nome            text not null check (nome = '@' or nome ~ '^[a-z0-9_]([a-z0-9_.-]*[a-z0-9])?$'),
  tipo            text not null check (tipo in ('A','AAAA','CNAME','MX','TXT','NS','CAA','Túnel','Outro')),
  aponta_para     text not null,
  servico         text,
  para_que        text,
  aplicacao_id    uuid,
  aplicacao_tipo  text not null default 'aplicacao' check (aplicacao_tipo = 'aplicacao'),
  proxy           boolean not null default false,
  criado_em       timestamptz not null default now(),
  foreign key (aplicacao_id, aplicacao_tipo) references public.nos (id, tipo) on delete set null (aplicacao_id)
);
comment on table public.dominios_registros is 'Os registros de DNS de cada domínio: subdomínios, e-mail e verificações. nome "@" = o próprio domínio.';
create index if not exists dominios_registros_dominio_idx on public.dominios_registros (dominio_id, nome);
create index if not exists dominios_registros_app_idx on public.dominios_registros (aplicacao_id) where aplicacao_id is not null;

drop trigger if exists dominios_carimbo on public.dominios;
create trigger dominios_carimbo before update on public.dominios for each row execute function interno.carimbar_atualizacao();
drop trigger if exists dominios_auditoria on public.dominios;
create trigger dominios_auditoria after insert or update or delete on public.dominios for each row execute function auditoria.registrar();

-- situação de cada domínio (calculada na hora)
create or replace view bi.dominios_situacao with (security_invoker = true) as
select d.id, d.nome, d.vence_em, d.renovacao_automatica,
       d.vence_em - bi.hoje() as dias_para_vencer,
       case when d.vence_em is null then 'sem_data'
            when d.vence_em < bi.hoje() then 'vencido'
            when d.vence_em - bi.hoje() <= 30 then 'vence_em_30_dias'
            when d.vence_em - bi.hoje() <= 60 then 'vence_em_60_dias'
            else 'em_dia' end as situacao,
       (select count(*) from public.dominios_registros r where r.dominio_id = d.id) as registros
  from public.dominios d;

-- aviso de vencimento: todo dia, avisa os Masters 60, 30, 7, 1 e 0 dias antes
create or replace function interno.avisar_vencimento_dominios() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  insert into public.notificacoes (pessoa_id, titulo, texto)
  select p.id,
         case when d.vence_em - bi.hoje() = 0 then 'O domínio ' || d.nome || ' vence hoje'
              else 'O domínio ' || d.nome || ' vence em ' || (d.vence_em - bi.hoje()) || ' dia' || case when d.vence_em - bi.hoje() = 1 then '' else 's' end end,
         'Vencimento em ' || to_char(d.vence_em, 'DD/MM/YYYY') || ' · comprado em ' || d.registrador ||
           case when d.renovacao_automatica then ' · renovação automática ligada' else ' · confira a renovação' end
    from public.dominios d
    cross join public.pessoas p
   where p.papel = 'master' and p.ativo
     and d.vence_em - bi.hoje() in (60, 30, 7, 1, 0);
  get diagnostics n = row_count;
  return n;
end $$;

-- segurança: só o Master; ninguém sem login
alter table public.dominios enable row level security;
alter table public.dominios_registros enable row level security;
drop policy if exists master on public.dominios;
drop policy if exists master on public.dominios_registros;
create policy master on public.dominios for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
create policy master on public.dominios_registros for all to authenticated using ((select interno.eh_master())) with check ((select interno.eh_master()));
revoke all on public.dominios, public.dominios_registros from anon, public;
grant select, insert, update, delete on public.dominios, public.dominios_registros to authenticated;
grant all on public.dominios, public.dominios_registros to service_role;
revoke all on bi.dominios_situacao from public, anon, authenticated;
grant select on bi.dominios_situacao to service_role;
revoke execute on function interno.avisar_vencimento_dominios() from public, anon, authenticated;
grant execute on function interno.avisar_vencimento_dominios() to service_role;

-- rotina diária do aviso (SÓ NO SUPABASE: precisa do pg_cron, criado na parte 10). 08:17 de Brasília.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'itia_dominios_vencimento';
    perform cron.schedule('itia_dominios_vencimento', '17 11 * * *', 'select interno.avisar_vencimento_dominios()');
  end if;
end $$;
