-- =====================================================================
-- CicloDev · 47 · Cadastro de servidores (VPS, dedicado, nuvem)
-- servidores            a máquina: provedor, plano, região, sistema, CPU, memória, disco, rede, contrato, backup,
--                       monitoramento e ONDE fica o acesso (nunca a senha). Mora num ponto da estrutura (o dono).
-- servidores_alcance    onde se aplica: num cliente, projeto ou produto vale para todas as aplicações de dentro;
--                       numa aplicação, só para ela. O peso serve para dividir o custo (rateio por peso).
-- servidores_servicos   o que roda nela: aplicação, API, site, banco, proxy, container, fila, cache, rotina, backup...
--                       cada serviço pode dizer a qual aplicação atende.
-- servidores_custos     os custos da máquina (plano, backup, IP extra, licença), mensais, anuais ou únicos.
-- Quem vê: quem vê o dono ou qualquer ponto onde ela se aplica (menos stakeholder). Quem muda: quem edita o dono.
-- =====================================================================
set lock_timeout = '5s';

create table if not exists public.servidores (
  id              uuid primary key default gen_random_uuid(),
  no_id           uuid not null references public.nos(id) on delete cascade,
  nome            text not null check (length(btrim(nome)) between 1 and 120),
  tipo            text not null default 'vps' check (tipo in ('vps','dedicado','nuvem','container','fisico','outro')),
  ambiente        text not null default 'producao' check (ambiente in ('producao','homologacao','desenvolvimento','backup','outro')),
  status          text not null default 'ativo' check (status in ('ativo','pausado','desligado')),
  provedor        text not null default '' check (length(provedor) <= 80),
  plano           text not null default '' check (length(plano) <= 120),
  regiao          text not null default '' check (length(regiao) <= 80),
  sistema         text not null default '' check (length(sistema) <= 120),
  cpu             integer check (cpu between 0 and 1024),
  memoria_gb      numeric(8,2) check (memoria_gb >= 0),
  disco_gb        numeric(10,2) check (disco_gb >= 0),
  disco_tipo      text not null default '' check (disco_tipo in ('','ssd','nvme','hdd')),
  banda_tb        numeric(8,2) check (banda_tb >= 0),
  ip_publico      text not null default '' check (length(ip_publico) <= 64),
  ip_privado      text not null default '' check (length(ip_privado) <= 64),
  hostname        text not null default '' check (length(hostname) <= 255),
  painel_url      text not null default '' check (painel_url = '' or (painel_url ~* '^https?://' and length(painel_url) <= 500)),
  -- onde fica o acesso (cofre de senhas, chave SSH de quem), NUNCA a senha
  acesso_onde     text not null default '' check (length(acesso_onde) <= 300 and acesso_onde !~* '(senha|password|passwd|pwd|token|secret)\s*[:=]\s*\S'),
  backup          text not null default '' check (length(backup) <= 500),
  monitoramento   text not null default '' check (length(monitoramento) <= 500),
  responsavel_id  uuid references public.pessoas(id) on delete set null,
  contratado_em   date,
  renova_em       date,
  rateio          text not null default 'igual' check (rateio in ('igual','peso')),
  notas           text not null default '' check (length(notas) <= 4000),
  criado_por      uuid default interno.pessoa_atual(),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists servidores_no_idx on public.servidores (no_id);
comment on table public.servidores is 'Servidores (VPS, dedicado, nuvem): a máquina, o contrato e onde fica o acesso (nunca a senha). Mora num ponto da estrutura; onde se aplica fica em servidores_alcance.';

create table if not exists public.servidores_alcance (
  servidor_id  uuid not null references public.servidores(id) on delete cascade,
  no_id        uuid not null references public.nos(id) on delete cascade,
  peso         numeric(6,2) not null default 1 check (peso > 0),
  primary key (servidor_id, no_id)
);
create index if not exists servidores_alcance_no_idx on public.servidores_alcance (no_id);
comment on table public.servidores_alcance is 'Onde o servidor se aplica: cliente, projeto ou produto valem para todas as aplicações de dentro; aplicação, só para ela. peso: para dividir o custo quando o rateio é por peso.';

create table if not exists public.servidores_servicos (
  id           uuid primary key default gen_random_uuid(),
  servidor_id  uuid not null references public.servidores(id) on delete cascade,
  nome         text not null check (length(btrim(nome)) between 1 and 120),
  tipo         text not null default 'aplicacao' check (tipo in ('aplicacao','api','site','banco','proxy','container','fila','cache','agendada','monitoramento','backup','painel','outro')),
  tecnologia   text not null default '' check (length(tecnologia) <= 120),
  versao       text not null default '' check (length(versao) <= 40),
  porta        integer check (porta between 1 and 65535),
  endereco     text not null default '' check (length(endereco) <= 500),
  no_id        uuid references public.nos(id) on delete set null,   -- a aplicação (ou outro ponto) que este serviço atende
  caminho      text not null default '' check (length(caminho) <= 500),
  notas        text not null default '' check (length(notas) <= 1000),
  ordem        integer not null default 0
);
create index if not exists servidores_servicos_srv_idx on public.servidores_servicos (servidor_id, ordem);
comment on table public.servidores_servicos is 'O que roda no servidor: cada serviço com tecnologia, versão, porta, endereço, pasta e a aplicação que ele atende.';

create table if not exists public.servidores_custos (
  id           uuid primary key default gen_random_uuid(),
  servidor_id  uuid not null references public.servidores(id) on delete cascade,
  descricao    text not null check (length(btrim(descricao)) between 1 and 200),
  valor        numeric(12,2) not null check (valor >= 0),
  moeda        text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  recorrencia  text not null default 'mensal' check (recorrencia in ('mensal','anual','unico')),
  inicio       date not null default current_date,
  fim          date check (fim is null or fim >= inicio),
  notas        text not null default '' check (length(notas) <= 500)
);
create index if not exists servidores_custos_srv_idx on public.servidores_custos (servidor_id);
comment on table public.servidores_custos is 'Custos do servidor (plano, backup, IP extra, licença). A divisão entre as aplicações segue servidores.rateio e servidores_alcance.peso.';

-- ---------- quem vê e quem muda ----------
-- o dono e o alcance só podem ser cliente, projeto, produto ou aplicação
create or replace function interno.servidor_no_ok(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.nos where id = p and tipo in ('cliente','projeto','produto','aplicacao')) $$;
-- vê: quem vê o dono ou algum ponto onde ele se aplica (stakeholder não vê infraestrutura)
create or replace function interno.servidor_ve(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not interno.eh_stakeholder() and (
    exists (select 1 from public.servidores s where s.id = p and s.no_id in (select interno.nos_visiveis()))
    or exists (select 1 from public.servidores_alcance a where a.servidor_id = p and a.no_id in (select interno.nos_visiveis()))) $$;
-- muda: quem edita o dono
create or replace function interno.servidor_edita(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not interno.eh_stakeholder() and exists (select 1 from public.servidores s where s.id = p and s.no_id in (select interno.nos_editaveis())) $$;
revoke all on function interno.servidor_no_ok(uuid), interno.servidor_ve(uuid), interno.servidor_edita(uuid) from public, anon;
grant execute on function interno.servidor_no_ok(uuid), interno.servidor_ve(uuid), interno.servidor_edita(uuid) to authenticated, service_role;

create or replace function interno.servidores_tocar() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists servidores_tocar on public.servidores;
create trigger servidores_tocar before update on public.servidores for each row execute function interno.servidores_tocar();

revoke all on public.servidores, public.servidores_alcance, public.servidores_servicos, public.servidores_custos from public, anon, authenticated;
alter table public.servidores enable row level security;
alter table public.servidores_alcance enable row level security;
alter table public.servidores_servicos enable row level security;
alter table public.servidores_custos enable row level security;

drop policy if exists ver on public.servidores;
drop policy if exists cria on public.servidores;
drop policy if exists muda on public.servidores;
drop policy if exists apaga on public.servidores;
-- a coluna do dono vem primeiro: a linha recém-gravada (insert ... returning) já aparece para quem a criou
create policy ver on public.servidores for select to authenticated using (not (select interno.eh_stakeholder()) and (no_id in (select interno.nos_visiveis()) or interno.servidor_ve(id)));
create policy cria on public.servidores for insert to authenticated with check (not interno.eh_stakeholder() and no_id in (select interno.nos_editaveis()) and interno.servidor_no_ok(no_id));
create policy muda on public.servidores for update to authenticated using (interno.servidor_edita(id)) with check (no_id in (select interno.nos_editaveis()) and interno.servidor_no_ok(no_id));
create policy apaga on public.servidores for delete to authenticated using (interno.servidor_edita(id));

drop policy if exists ver on public.servidores_alcance;
drop policy if exists cria on public.servidores_alcance;
drop policy if exists muda on public.servidores_alcance;
drop policy if exists apaga on public.servidores_alcance;
create policy ver on public.servidores_alcance for select to authenticated using (interno.servidor_ve(servidor_id));
create policy cria on public.servidores_alcance for insert to authenticated with check (interno.servidor_edita(servidor_id) and no_id in (select interno.nos_editaveis()) and interno.servidor_no_ok(no_id));
create policy muda on public.servidores_alcance for update to authenticated using (interno.servidor_edita(servidor_id)) with check (interno.servidor_edita(servidor_id) and no_id in (select interno.nos_editaveis()));
create policy apaga on public.servidores_alcance for delete to authenticated using (interno.servidor_edita(servidor_id));

drop policy if exists ver on public.servidores_servicos;
drop policy if exists cria on public.servidores_servicos;
drop policy if exists muda on public.servidores_servicos;
drop policy if exists apaga on public.servidores_servicos;
create policy ver on public.servidores_servicos for select to authenticated using (interno.servidor_ve(servidor_id));
create policy cria on public.servidores_servicos for insert to authenticated with check (interno.servidor_edita(servidor_id) and (no_id is null or no_id in (select interno.nos_visiveis())));
create policy muda on public.servidores_servicos for update to authenticated using (interno.servidor_edita(servidor_id)) with check (interno.servidor_edita(servidor_id) and (no_id is null or no_id in (select interno.nos_visiveis())));
create policy apaga on public.servidores_servicos for delete to authenticated using (interno.servidor_edita(servidor_id));

drop policy if exists ver on public.servidores_custos;
drop policy if exists cria on public.servidores_custos;
drop policy if exists muda on public.servidores_custos;
drop policy if exists apaga on public.servidores_custos;
create policy ver on public.servidores_custos for select to authenticated using (interno.servidor_ve(servidor_id));
create policy cria on public.servidores_custos for insert to authenticated with check (interno.servidor_edita(servidor_id));
create policy muda on public.servidores_custos for update to authenticated using (interno.servidor_edita(servidor_id)) with check (interno.servidor_edita(servidor_id));
create policy apaga on public.servidores_custos for delete to authenticated using (interno.servidor_edita(servidor_id));

grant select, insert, update, delete on public.servidores, public.servidores_alcance, public.servidores_servicos, public.servidores_custos to authenticated;
grant all on public.servidores, public.servidores_alcance, public.servidores_servicos, public.servidores_custos to service_role;
