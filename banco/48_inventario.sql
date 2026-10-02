-- =====================================================================
-- CicloDev · 48 · Inventário de TI por cliente (gestão de ativos de TI)
-- Cada cliente tem o seu: categorias, modelos, locais, funcionários (só cadastro, sem acesso), equipamentos
-- controlados um a um, itens controlados por quantidade (cabos, adaptadores) com saldo por local, licenças de
-- software, ligações entre equipamentos, manutenções, termos de responsabilidade, baixa e descarte, conferência
-- física e o histórico de movimentações, que nunca é alterado nem apagado.
-- Regras que o banco garante:
--   * nada aponta para outro cliente (chaves estrangeiras compostas com cliente_id; aplicação conferida na árvore);
--   * a situação do equipamento (estoque, em uso por funcionário, por aplicação...) só muda por movimentação,
--     pela função inv_movimentar, que grava o histórico junto: a situação atual nunca diverge do histórico;
--   * quem vê e quem mexe: quem edita o cliente (o time); stakeholder não vê. Funcionário do cliente não tem acesso.
--   * CPF conferido pelos dígitos; onde fica a senha, nunca a senha.
-- =====================================================================
set lock_timeout = '5s';

-- ---------- apoio ----------
create or replace function interno.cpf_valido(p text) returns boolean
language plpgsql immutable set search_path = pg_catalog as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if; if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if; return r = substr(d, 11, 1)::int;
end $$;
-- quem pode: quem edita o cliente (o time), nunca stakeholder
create or replace function interno.inv_pode(p_cliente uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not interno.eh_stakeholder() and exists (select 1 from public.nos n where n.id = p_cliente and n.tipo = 'cliente')
     and p_cliente in (select interno.nos_editaveis()) $$;
-- a aplicação (ou projeto/produto) é mesmo deste cliente
create or replace function interno.inv_no_do_cliente(p_no uuid, p_cliente uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_no is null or exists (select 1 from public.nos_ancestrais a join public.nos n on n.id = a.no_id
     where a.ancestral_id = p_cliente and a.no_id = p_no and n.tipo in ('projeto','produto','aplicacao')) $$;
revoke all on function interno.inv_pode(uuid), interno.inv_no_do_cliente(uuid, uuid) from public, anon;
grant execute on function interno.inv_pode(uuid), interno.inv_no_do_cliente(uuid, uuid), interno.cpf_valido(text) to authenticated, service_role;

-- ---------- cadastros ----------
create table if not exists public.inv_categorias (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.nos(id) on delete cascade,
  nome                text not null check (length(btrim(nome)) between 1 and 80),
  grupo               text not null default 'outro' check (grupo in ('computador','monitor','periferico','cabo','energia','rede','telefonia','impressao','componente','consumivel','armazenamento','audio_video','mobiliario','outro')),
  controle            text not null default 'unidade' check (controle in ('unidade','quantidade')),   -- um a um (com série) ou por quantidade
  depreciacao_pct_ano numeric(5,2) not null default 20 check (depreciacao_pct_ano between 0 and 100),
  vida_util_meses     integer check (vida_util_meses between 1 and 600),
  conferencia_meses   integer not null default 12 check (conferencia_meses between 1 and 120),
  ativo               boolean not null default true,
  ordem               integer not null default 0,
  unique (cliente_id, nome), unique (id, cliente_id)
);
create table if not exists public.inv_modelos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.nos(id) on delete cascade,
  categoria_id    uuid not null,
  fabricante      text not null default '' check (length(fabricante) <= 80),
  modelo          text not null check (length(btrim(modelo)) between 1 and 120),
  numero_modelo   text not null default '' check (length(numero_modelo) <= 80),
  especificacoes  text not null default '' check (length(especificacoes) <= 2000),
  fim_vida_meses  integer check (fim_vida_meses between 1 and 600),
  ativo           boolean not null default true,
  unique (id, cliente_id),
  foreign key (categoria_id, cliente_id) references public.inv_categorias(id, cliente_id)
);
create table if not exists public.inv_locais (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.nos(id) on delete cascade,
  pai_id      uuid,
  nome        text not null check (length(btrim(nome)) between 1 and 120),
  tipo        text not null default 'sala' check (tipo in ('unidade','predio','andar','sala','armario','almoxarifado','remoto','outro')),
  endereco    text not null default '' check (length(endereco) <= 300),
  notas       text not null default '' check (length(notas) <= 1000),
  ativo       boolean not null default true,
  unique (id, cliente_id),
  foreign key (pai_id, cliente_id) references public.inv_locais(id, cliente_id),
  check (pai_id is null or pai_id <> id)
);
-- funcionários do cliente: só cadastro de controle (não entram no sistema)
create table if not exists public.inv_funcionarios (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.nos(id) on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  cpf           text not null default '' check (cpf = '' or (cpf ~ '^\d{11}$' and interno.cpf_valido(cpf))),
  telefone      text not null default '' check (length(telefone) <= 30),
  cargo         text not null default '' check (length(cargo) <= 120),
  departamento  text not null default '' check (length(departamento) <= 120),
  situacao      text not null default 'ativo' check (situacao in ('ativo','afastado','desligado')),
  desligado_em  date,
  notas         text not null default '' check (length(notas) <= 1000),
  criado_em     timestamptz not null default now(),
  unique (id, cliente_id)
);
create unique index if not exists inv_funcionarios_cpf_uq on public.inv_funcionarios (cliente_id, cpf) where cpf <> '';
-- quais aplicações do cliente cada funcionário usa
create table if not exists public.inv_funcionarios_apps (
  funcionario_id  uuid not null,
  cliente_id      uuid not null,
  no_id           uuid not null references public.nos(id) on delete cascade,
  primary key (funcionario_id, no_id),
  foreign key (funcionario_id, cliente_id) references public.inv_funcionarios(id, cliente_id) on delete cascade
);

-- ---------- equipamentos (um a um) ----------
create table if not exists public.inv_ativos (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null references public.nos(id) on delete cascade,
  categoria_id         uuid not null,
  modelo_id            uuid,
  patrimonio           text not null default '' check (length(patrimonio) <= 60),
  numero_serie         text not null default '' check (length(numero_serie) <= 120),
  descricao            text not null default '' check (length(descricao) <= 300),
  situacao             text not null default 'estoque' check (situacao in ('estoque','uso_funcionario','uso_aplicacao','uso_local','emprestado','manutencao','aguardando','defeito','perdido','baixado')),
  local_id             uuid,
  funcionario_id       uuid,
  aplicacao_id         uuid references public.nos(id) on delete set null,
  devolucao_prevista   date,
  propriedade          text not null default 'proprio' check (propriedade in ('proprio','alugado','comodato','byod')),
  locadora             text not null default '' check (length(locadora) <= 120),
  contrato_fim         date,
  valor_mensal         numeric(12,2) check (valor_mensal >= 0),
  fornecedor           text not null default '' check (length(fornecedor) <= 120),
  nota_fiscal          text not null default '' check (length(nota_fiscal) <= 60),
  nf_chave             text not null default '' check (nf_chave = '' or nf_chave ~ '^\d{44}$'),
  data_compra          date,
  valor_compra         numeric(12,2) check (valor_compra >= 0),
  garantia_ate         date,
  depreciacao_pct_ano  numeric(5,2) check (depreciacao_pct_ano between 0 and 100),
  ultima_conferencia   date,
  proxima_conferencia  date,
  hostname             text not null default '' check (length(hostname) <= 120),
  ip                   text not null default '' check (length(ip) <= 64),
  mac                  text not null default '' check (length(mac) <= 64),
  sistema              text not null default '' check (length(sistema) <= 120),
  acesso_onde          text not null default '' check (length(acesso_onde) <= 300 and acesso_onde !~* '(senha|password|passwd|pwd|token|secret|pin)\s*[:=]\s*\S'),
  notas                text not null default '' check (length(notas) <= 4000),
  criado_por           uuid default interno.pessoa_atual(),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  unique (id, cliente_id),
  foreign key (categoria_id, cliente_id) references public.inv_categorias(id, cliente_id),
  foreign key (modelo_id, cliente_id) references public.inv_modelos(id, cliente_id),
  foreign key (local_id, cliente_id) references public.inv_locais(id, cliente_id),
  foreign key (funcionario_id, cliente_id) references public.inv_funcionarios(id, cliente_id),
  -- a situação e com quem está andam juntas
  constraint inv_ativos_situacao_ok check (
    case situacao
      when 'uso_funcionario' then funcionario_id is not null and aplicacao_id is null
      when 'emprestado' then funcionario_id is not null and aplicacao_id is null and devolucao_prevista is not null
      when 'uso_aplicacao' then aplicacao_id is not null and funcionario_id is null
      else funcionario_id is null and aplicacao_id is null end),
  constraint inv_ativos_alugado_ok check (propriedade <> 'alugado' or locadora <> '')
);
create unique index if not exists inv_ativos_patrimonio_uq on public.inv_ativos (cliente_id, lower(patrimonio)) where patrimonio <> '';
create index if not exists inv_ativos_cliente_idx on public.inv_ativos (cliente_id, situacao);
create index if not exists inv_ativos_func_idx on public.inv_ativos (funcionario_id) where funcionario_id is not null;
create index if not exists inv_ativos_app_idx on public.inv_ativos (aplicacao_id) where aplicacao_id is not null;
create index if not exists inv_ativos_serie_idx on public.inv_ativos (cliente_id, numero_serie) where numero_serie <> '';
-- monitor conectado ao computador, memória instalada no notebook
create table if not exists public.inv_ligacoes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null,
  ativo_id    uuid not null,
  alvo_id     uuid not null,
  tipo        text not null default 'conectado' check (tipo in ('conectado','instalado')),
  desde       date not null default current_date,
  notas       text not null default '' check (length(notas) <= 300),
  unique (ativo_id, alvo_id, tipo), check (ativo_id <> alvo_id),
  foreign key (ativo_id, cliente_id) references public.inv_ativos(id, cliente_id) on delete cascade,
  foreign key (alvo_id, cliente_id) references public.inv_ativos(id, cliente_id) on delete cascade
);

-- ---------- itens por quantidade (cabos, adaptadores, fontes, consumíveis) ----------
create table if not exists public.inv_itens (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references public.nos(id) on delete cascade,
  categoria_id    uuid not null,
  nome            text not null check (length(btrim(nome)) between 1 and 160),
  unidade         text not null default 'un' check (unidade in ('un','m','cx','pct','kit')),
  estoque_minimo  numeric(12,2) not null default 0 check (estoque_minimo >= 0),
  valor_unitario  numeric(12,2) check (valor_unitario >= 0),
  notas           text not null default '' check (length(notas) <= 1000),
  ativo           boolean not null default true,
  unique (id, cliente_id), unique (cliente_id, nome),
  foreign key (categoria_id, cliente_id) references public.inv_categorias(id, cliente_id)
);
-- saldo de cada item em cada local (só a função inv_estoque mexe)
create table if not exists public.inv_saldos (
  item_id     uuid not null,
  local_id    uuid not null,
  cliente_id  uuid not null,
  quantidade  numeric(12,2) not null default 0 check (quantidade >= 0),
  primary key (item_id, local_id),
  foreign key (item_id, cliente_id) references public.inv_itens(id, cliente_id) on delete cascade,
  foreign key (local_id, cliente_id) references public.inv_locais(id, cliente_id)
);

-- ---------- licenças de software ----------
create table if not exists public.inv_licencas (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            uuid not null references public.nos(id) on delete cascade,
  nome                  text not null check (length(btrim(nome)) between 1 and 160),
  fornecedor            text not null default '' check (length(fornecedor) <= 120),
  tipo                  text not null default 'assinatura' check (tipo in ('assinatura','perpetua','oem')),
  quantidade            integer not null default 1 check (quantidade between 1 and 100000),
  chave_onde            text not null default '' check (length(chave_onde) <= 300),   -- onde está a chave, não a chave
  inicio                date,
  vence_em              date,
  valor                 numeric(12,2) check (valor >= 0),
  moeda                 text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  recorrencia           text not null default 'mensal' check (recorrencia in ('mensal','anual','unico')),
  renovacao_automatica  boolean not null default false,
  notas                 text not null default '' check (length(notas) <= 1000),
  unique (id, cliente_id)
);
create table if not exists public.inv_licencas_uso (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null,
  licenca_id      uuid not null,
  funcionario_id  uuid,
  ativo_id        uuid,
  desde           date not null default current_date,
  check (num_nonnulls(funcionario_id, ativo_id) = 1),
  foreign key (licenca_id, cliente_id) references public.inv_licencas(id, cliente_id) on delete cascade,
  foreign key (funcionario_id, cliente_id) references public.inv_funcionarios(id, cliente_id) on delete cascade,
  foreign key (ativo_id, cliente_id) references public.inv_ativos(id, cliente_id) on delete cascade
);
create unique index if not exists inv_licencas_uso_uq on public.inv_licencas_uso (licenca_id, coalesce(funcionario_id, ativo_id));

-- ---------- termos de responsabilidade ----------
create table if not exists public.inv_termos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null,
  funcionario_id  uuid not null,
  tipo            text not null check (tipo in ('entrega','devolucao')),
  ativos          uuid[] not null default '{}',
  texto           text not null default '' check (length(texto) <= 20000),
  gerado_em       timestamptz not null default now(),
  gerado_por      uuid default interno.pessoa_atual(),
  assinado_em     date,
  unique (id, cliente_id),
  foreign key (funcionario_id, cliente_id) references public.inv_funcionarios(id, cliente_id)
);

-- ---------- histórico de movimentações (nunca muda nem some) ----------
create table if not exists public.inv_movimentos (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.nos(id) on delete cascade,
  tipo                text not null check (tipo in ('cadastro','entrega','uso_aplicacao','uso_local','emprestimo','devolucao','transferencia','manutencao','retorno_manutencao','aguardando','defeito','perda','baixa','estorno','entrada','saida','ajuste')),
  ativo_id            uuid references public.inv_ativos(id) on delete cascade,
  item_id             uuid references public.inv_itens(id) on delete cascade,
  quantidade          numeric(12,2),
  situacao_antes      text,
  situacao_depois     text,
  local_de            uuid references public.inv_locais(id) on delete set null,
  local_para          uuid references public.inv_locais(id) on delete set null,
  funcionario_de      uuid references public.inv_funcionarios(id) on delete set null,
  funcionario_para    uuid references public.inv_funcionarios(id) on delete set null,
  aplicacao_de        uuid references public.nos(id) on delete set null,
  aplicacao_para      uuid references public.nos(id) on delete set null,
  devolucao_prevista  date,
  data                date not null default current_date,
  em                  timestamptz not null default now(),
  motivo              text not null default '' check (length(motivo) <= 500),
  feito_por           uuid default interno.pessoa_atual(),
  estorno_de          uuid references public.inv_movimentos(id) on delete set null,
  termo_id            uuid references public.inv_termos(id) on delete set null,
  check (num_nonnulls(ativo_id, item_id) = 1)
);
create index if not exists inv_movimentos_ativo_idx on public.inv_movimentos (ativo_id, em desc) where ativo_id is not null;
create index if not exists inv_movimentos_item_idx on public.inv_movimentos (item_id, em desc) where item_id is not null;
create index if not exists inv_movimentos_cliente_idx on public.inv_movimentos (cliente_id, em desc);
create index if not exists inv_movimentos_func_idx on public.inv_movimentos (funcionario_para) where funcionario_para is not null;

-- ---------- manutenções, baixa e conferência ----------
create table if not exists public.inv_manutencoes (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null,
  ativo_id      uuid not null,
  tipo          text not null default 'corretiva' check (tipo in ('corretiva','preventiva','upgrade','garantia')),
  fornecedor    text not null default '' check (length(fornecedor) <= 120),
  na_garantia   boolean not null default false,
  aberta_em     date not null default current_date,
  concluida_em  date check (concluida_em is null or concluida_em >= aberta_em),
  custo         numeric(12,2) check (custo >= 0),
  descricao     text not null default '' check (length(descricao) <= 2000),
  item_id       uuid references public.itens(id) on delete set null,   -- o item de trabalho no CicloDev, quando houver
  foreign key (ativo_id, cliente_id) references public.inv_ativos(id, cliente_id) on delete cascade
);
create table if not exists public.inv_baixas (
  ativo_id           uuid primary key,
  cliente_id         uuid not null,
  motivo             text not null check (motivo in ('venda','doacao','sucata','perda','roubo','devolucao_locadora','outro')),
  data               date not null default current_date,
  metodo_apagamento  text not null default '' check (metodo_apagamento in ('','clear','purge','destroy','sem_dados')),   -- NIST 800-88
  apagamento_por     text not null default '' check (length(apagamento_por) <= 160),
  recicladora        text not null default '' check (length(recicladora) <= 160),
  mtr                text not null default '' check (length(mtr) <= 60),    -- manifesto de transporte de resíduos
  cdf                text not null default '' check (length(cdf) <= 60),    -- certificado de destinação final
  boletim            text not null default '' check (length(boletim) <= 60),
  valor_venda        numeric(12,2) check (valor_venda >= 0),
  notas              text not null default '' check (length(notas) <= 2000),
  foreign key (ativo_id, cliente_id) references public.inv_ativos(id, cliente_id) on delete cascade
);
create table if not exists public.inv_conferencias (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.nos(id) on delete cascade,
  nome          text not null check (length(btrim(nome)) between 1 and 160),
  local_id      uuid,
  iniciada_em   timestamptz not null default now(),
  concluida_em  timestamptz,
  feita_por     uuid default interno.pessoa_atual(),
  unique (id, cliente_id),
  foreign key (local_id, cliente_id) references public.inv_locais(id, cliente_id)
);
create table if not exists public.inv_conferencias_itens (
  conferencia_id  uuid not null,
  ativo_id        uuid not null,
  cliente_id      uuid not null,
  achado          boolean not null default true,
  local_achado    uuid,
  notas           text not null default '' check (length(notas) <= 300),
  em              timestamptz not null default now(),
  primary key (conferencia_id, ativo_id),
  foreign key (conferencia_id, cliente_id) references public.inv_conferencias(id, cliente_id) on delete cascade,
  foreign key (ativo_id, cliente_id) references public.inv_ativos(id, cliente_id) on delete cascade,
  foreign key (local_achado, cliente_id) references public.inv_locais(id, cliente_id)
);
-- fotos, nota fiscal, termo assinado, certificados (arquivo no bucket privado "inventario": <cliente>/<uuid>-<nome>)
create table if not exists public.inv_anexos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references public.nos(id) on delete cascade,
  ativo_id      uuid references public.inv_ativos(id) on delete cascade,
  termo_id      uuid references public.inv_termos(id) on delete cascade,
  licenca_id    uuid references public.inv_licencas(id) on delete cascade,
  papel         text not null default 'outro' check (papel in ('foto','nota_fiscal','termo','certificado_apagamento','cdf','garantia','contrato','outro')),
  nome          text not null check (length(nome) between 1 and 200),
  storage_path  text not null check (length(storage_path) <= 500),
  mime          text not null default '' check (length(mime) <= 120),
  tamanho       bigint check (tamanho >= 0),
  enviado_por   uuid default interno.pessoa_atual(),
  enviado_em    timestamptz not null default now(),
  check (num_nonnulls(ativo_id, termo_id, licenca_id) <= 1),
  check (storage_path like cliente_id::text || '/%')
);

comment on table public.inv_ativos is 'Inventário de TI: cada equipamento controlado um a um (com patrimônio e série), do cliente. A situação só muda pela função inv_movimentar, que grava o histórico junto.';
comment on table public.inv_movimentos is 'Histórico de movimentações do inventário. Nunca muda nem some: erro se corrige com estorno (inv_estornar).';
comment on table public.inv_funcionarios is 'Funcionários do cliente, só cadastro de controle do inventário (não entram no sistema). Só o time que edita o cliente vê.';

-- ---------- travas ----------
-- aplicação de outro cliente não entra
create or replace function interno.inv_conferir_aplicacao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.aplicacao_id is not null and not interno.inv_no_do_cliente(new.aplicacao_id, new.cliente_id) then
    raise exception 'Esta aplicação não é deste cliente' using errcode = '23514';
  end if;
  return new;
end $$;
create or replace function interno.inv_conferir_aplicacao_func() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not interno.inv_no_do_cliente(new.no_id, new.cliente_id) then raise exception 'Esta aplicação não é deste cliente' using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists inv_ativos_aplicacao on public.inv_ativos;
create trigger inv_ativos_aplicacao before insert or update of aplicacao_id, cliente_id on public.inv_ativos for each row execute function interno.inv_conferir_aplicacao();
drop trigger if exists inv_funcionarios_apps_aplicacao on public.inv_funcionarios_apps;
create trigger inv_funcionarios_apps_aplicacao before insert or update on public.inv_funcionarios_apps for each row execute function interno.inv_conferir_aplicacao_func();

-- a situação só muda por movimentação (a função liga a chave ciclodev.inv_mov durante a transação)
create or replace function interno.inv_ativos_trava() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('ciclodev.inv_mov', true), '') <> 'on' and (
     new.situacao is distinct from old.situacao or new.local_id is distinct from old.local_id or new.funcionario_id is distinct from old.funcionario_id
     or new.aplicacao_id is distinct from old.aplicacao_id or new.devolucao_prevista is distinct from old.devolucao_prevista or new.cliente_id is distinct from old.cliente_id) then
    raise exception 'A situação, o local e com quem está mudam só por movimentação (Entregar, Devolver, Transferir...)' using errcode = '42501';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists inv_ativos_trava on public.inv_ativos;
create trigger inv_ativos_trava before update on public.inv_ativos for each row execute function interno.inv_ativos_trava();

-- cadastrar já grava a primeira movimentação (o histórico começa no cadastro)
create or replace function interno.inv_ativos_cadastro() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.inv_movimentos (cliente_id, tipo, ativo_id, situacao_depois, local_para, funcionario_para, aplicacao_para, devolucao_prevista, data, motivo)
  values (new.cliente_id, 'cadastro', new.id, new.situacao, new.local_id, new.funcionario_id, new.aplicacao_id, new.devolucao_prevista, coalesce(new.data_compra, current_date), 'Cadastro no inventário');
  return new;
end $$;
drop trigger if exists inv_ativos_cadastro on public.inv_ativos;
create trigger inv_ativos_cadastro after insert on public.inv_ativos for each row execute function interno.inv_ativos_cadastro();

-- o histórico nunca muda
-- (só as ligações que viram vazias quando o local/funcionário/aplicação some podem mudar; o resto, nunca)
create or replace function interno.inv_movimentos_so_vazio() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.tipo is distinct from old.tipo or new.ativo_id is distinct from old.ativo_id or new.item_id is distinct from old.item_id or new.quantidade is distinct from old.quantidade
     or new.situacao_antes is distinct from old.situacao_antes or new.situacao_depois is distinct from old.situacao_depois or new.data is distinct from old.data
     or new.em is distinct from old.em or new.motivo is distinct from old.motivo or new.feito_por is distinct from old.feito_por or new.cliente_id is distinct from old.cliente_id
     or (new.local_de is not null and new.local_de is distinct from old.local_de) or (new.local_para is not null and new.local_para is distinct from old.local_para)
     or (new.funcionario_de is not null and new.funcionario_de is distinct from old.funcionario_de) or (new.funcionario_para is not null and new.funcionario_para is distinct from old.funcionario_para)
     or (new.aplicacao_de is not null and new.aplicacao_de is distinct from old.aplicacao_de) or (new.aplicacao_para is not null and new.aplicacao_para is distinct from old.aplicacao_para)
     or (new.estorno_de is not null and new.estorno_de is distinct from old.estorno_de) or (new.termo_id is not null and new.termo_id is distinct from old.termo_id) then
    raise exception 'O histórico do inventário não muda: corrija com um estorno' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists inv_movimentos_so_vazio on public.inv_movimentos;
create trigger inv_movimentos_so_vazio before update on public.inv_movimentos for each row execute function interno.inv_movimentos_so_vazio();

-- licença não passa da quantidade comprada
create or replace function interno.inv_licencas_limite() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare q integer; usados integer;
begin
  select quantidade into q from public.inv_licencas where id = new.licenca_id;
  select count(*) into usados from public.inv_licencas_uso where licenca_id = new.licenca_id and id <> new.id;
  if usados >= q then raise exception 'Esta licença já está toda em uso (% de %)', usados, q using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists inv_licencas_limite on public.inv_licencas_uso;
create trigger inv_licencas_limite before insert on public.inv_licencas_uso for each row execute function interno.inv_licencas_limite();

-- ---------- funções que movimentam ----------
-- as categorias de começo de um cliente (só cria quando ele ainda não tem nenhuma)
create or replace function public.inv_preparar(p_cliente uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  if not interno.inv_pode(p_cliente) then raise exception 'Sem acesso ao inventário deste cliente' using errcode = '42501'; end if;
  if exists (select 1 from public.inv_categorias where cliente_id = p_cliente) then return 0; end if;
  insert into public.inv_categorias (cliente_id, nome, grupo, controle, depreciacao_pct_ano, vida_util_meses, ordem)
  select p_cliente, c.nome, c.grupo, c.controle, c.pct, c.vida, c.ordem from (values
    ('Desktop', 'computador', 'unidade', 20, 60, 1), ('Notebook', 'computador', 'unidade', 20, 60, 2), ('Servidor físico', 'computador', 'unidade', 20, 60, 3),
    ('Monitor', 'monitor', 'unidade', 20, 60, 4), ('Teclado', 'periferico', 'unidade', 20, 36, 5), ('Mouse', 'periferico', 'unidade', 20, 36, 6),
    ('Headset', 'audio_video', 'unidade', 20, 36, 7), ('Webcam', 'audio_video', 'unidade', 20, 36, 8), ('Dock / hub', 'periferico', 'unidade', 20, 48, 9),
    ('Impressora', 'impressao', 'unidade', 10, 120, 10), ('Celular', 'telefonia', 'unidade', 20, 36, 11), ('Tablet', 'computador', 'unidade', 20, 48, 12),
    ('Roteador / switch', 'rede', 'unidade', 20, 60, 13), ('Access point', 'rede', 'unidade', 20, 60, 14), ('Nobreak', 'energia', 'unidade', 10, 120, 15),
    ('HD / SSD externo', 'armazenamento', 'unidade', 20, 48, 16), ('Memória / disco interno', 'componente', 'unidade', 20, 60, 17),
    ('Cabo', 'cabo', 'quantidade', 0, null, 18), ('Fonte / carregador', 'energia', 'quantidade', 0, null, 19), ('Adaptador', 'periferico', 'quantidade', 0, null, 20),
    ('Consumível (toner, pilha)', 'consumivel', 'quantidade', 0, null, 21)) as c(nome, grupo, controle, pct, vida, ordem);
  get diagnostics n = row_count; return n;
end $$;

-- muda a situação de um equipamento e grava o histórico junto
create or replace function public.inv_movimentar(p_ativo uuid, p_tipo text, p_situacao text, p_local uuid default null, p_funcionario uuid default null,
  p_aplicacao uuid default null, p_devolucao date default null, p_motivo text default '', p_data date default null, p_termo uuid default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.inv_ativos; mid uuid; sit text; transf boolean := p_tipo = 'transferencia';
begin
  select * into a from public.inv_ativos where id = p_ativo for update;
  if a.id is null or not interno.inv_pode(a.cliente_id) then raise exception 'Equipamento não encontrado ou sem acesso' using errcode = '42501'; end if;
  if a.situacao = 'baixado' then raise exception 'Equipamento baixado não se movimenta' using errcode = '23514'; end if;
  -- a situação sai do tipo da movimentação (a tela não decide sozinha)
  sit := case p_tipo when 'entrega' then 'uso_funcionario' when 'uso_aplicacao' then 'uso_aplicacao' when 'uso_local' then 'uso_local'
           when 'emprestimo' then 'emprestado' when 'devolucao' then 'estoque' when 'transferencia' then a.situacao when 'manutencao' then 'manutencao'
           when 'retorno_manutencao' then coalesce(nullif(p_situacao, ''), 'estoque') when 'aguardando' then 'aguardando' when 'defeito' then 'defeito'
           when 'perda' then 'perdido' when 'baixa' then 'baixado' end;
  if sit is null or sit not in ('estoque','uso_funcionario','uso_aplicacao','uso_local','emprestado','manutencao','aguardando','defeito','perdido','baixado') then
    raise exception 'Movimentação inválida: %', p_tipo using errcode = '22023'; end if;
  if p_tipo = 'baixa' and not exists (select 1 from public.inv_baixas where ativo_id = a.id) then
    raise exception 'Preencha a baixa (motivo e descarte) antes de baixar' using errcode = '23514'; end if;
  if p_tipo in ('entrega','emprestimo') and p_funcionario is null then raise exception 'Escolha o funcionário' using errcode = '23514'; end if;
  if p_tipo = 'uso_aplicacao' and p_aplicacao is null then raise exception 'Escolha a aplicação' using errcode = '23514'; end if;
  if p_tipo = 'emprestimo' and p_devolucao is null then raise exception 'Diga quando o empréstimo volta' using errcode = '23514'; end if;
  if p_tipo = 'transferencia' and p_local is null then raise exception 'Escolha o local de destino' using errcode = '23514'; end if;
  if p_funcionario is not null and not transf and not exists (select 1 from public.inv_funcionarios where id = p_funcionario and cliente_id = a.cliente_id and situacao <> 'desligado') then
    raise exception 'Funcionário não é deste cliente ou está desligado' using errcode = '23514'; end if;
  if p_local is not null and not exists (select 1 from public.inv_locais where id = p_local and cliente_id = a.cliente_id) then
    raise exception 'Local não é deste cliente' using errcode = '23514'; end if;
  perform set_config('ciclodev.inv_mov', 'on', true);
  update public.inv_ativos set situacao = sit,
         local_id = p_local,   -- o local escolhido (vazio: com a pessoa, não num local)
         funcionario_id = case when transf then funcionario_id when sit in ('uso_funcionario','emprestado') then p_funcionario else null end,
         aplicacao_id = case when transf then aplicacao_id when sit = 'uso_aplicacao' then p_aplicacao else null end,
         devolucao_prevista = case when transf then devolucao_prevista when sit = 'emprestado' then p_devolucao else null end
   where id = a.id;
  perform set_config('ciclodev.inv_mov', 'off', true);
  insert into public.inv_movimentos (cliente_id, tipo, ativo_id, situacao_antes, situacao_depois, local_de, local_para, funcionario_de, funcionario_para,
         aplicacao_de, aplicacao_para, devolucao_prevista, data, motivo, termo_id)
  select a.cliente_id, p_tipo, a.id, a.situacao, n.situacao, a.local_id, n.local_id, a.funcionario_id, n.funcionario_id, a.aplicacao_id, n.aplicacao_id,
         n.devolucao_prevista, coalesce(p_data, current_date), left(coalesce(p_motivo, ''), 500), p_termo
    from public.inv_ativos n where n.id = a.id
  returning id into mid;
  return mid;
end $$;

-- desfaz a ÚLTIMA movimentação do equipamento (grava um estorno; nada some)
create or replace function public.inv_estornar(p_mov uuid, p_motivo text default '') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.inv_movimentos; a public.inv_ativos; mid uuid;
begin
  select * into m from public.inv_movimentos where id = p_mov;
  if m.id is null or m.ativo_id is null or not interno.inv_pode(m.cliente_id) then raise exception 'Movimentação não encontrada ou sem acesso' using errcode = '42501'; end if;
  if m.tipo in ('cadastro','estorno') then raise exception 'O cadastro e o estorno não se estornam' using errcode = '23514'; end if;
  if exists (select 1 from public.inv_movimentos x where x.ativo_id = m.ativo_id and x.em > m.em) then raise exception 'Só a última movimentação do equipamento pode ser desfeita' using errcode = '23514'; end if;
  select * into a from public.inv_ativos where id = m.ativo_id for update;
  perform set_config('ciclodev.inv_mov', 'on', true);
  update public.inv_ativos set situacao = m.situacao_antes, local_id = m.local_de, funcionario_id = m.funcionario_de, aplicacao_id = m.aplicacao_de,
         devolucao_prevista = case when m.situacao_antes = 'emprestado' then (select x.devolucao_prevista from public.inv_movimentos x where x.ativo_id = m.ativo_id and x.em < m.em and x.situacao_depois = 'emprestado' order by x.em desc limit 1) else null end
   where id = a.id;
  perform set_config('ciclodev.inv_mov', 'off', true);
  -- desfeita uma baixa, a ficha da baixa fica sem valer (a tela tira; a regra 'apaga' só deixa quando não está mais baixado)
  insert into public.inv_movimentos (cliente_id, tipo, ativo_id, situacao_antes, situacao_depois, local_de, local_para, funcionario_de, funcionario_para, aplicacao_de, aplicacao_para, motivo, estorno_de)
  values (m.cliente_id, 'estorno', a.id, m.situacao_depois, m.situacao_antes, m.local_para, m.local_de, m.funcionario_para, m.funcionario_de, m.aplicacao_para, m.aplicacao_de,
          left(coalesce(nullif(p_motivo, ''), 'Desfeita a movimentação de ' || to_char(m.data, 'DD/MM/YYYY')), 500), m.id)
  returning id into mid;
  return mid;
end $$;

-- entrada, saída, transferência e ajuste dos itens por quantidade
create or replace function public.inv_estoque(p_item uuid, p_tipo text, p_local uuid, p_quantidade numeric, p_local_para uuid default null,
  p_funcionario uuid default null, p_aplicacao uuid default null, p_motivo text default '', p_data date default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare it public.inv_itens; saldo numeric; mid uuid;
begin
  select * into it from public.inv_itens where id = p_item;
  if it.id is null or not interno.inv_pode(it.cliente_id) then raise exception 'Item não encontrado ou sem acesso' using errcode = '42501'; end if;
  if p_tipo not in ('entrada','saida','transferencia','ajuste') then raise exception 'Movimentação inválida: %', p_tipo using errcode = '22023'; end if;
  if p_quantidade is null or p_quantidade < 0 or (p_tipo <> 'ajuste' and p_quantidade = 0) then raise exception 'Quantidade inválida' using errcode = '22023'; end if;
  if not exists (select 1 from public.inv_locais where id = p_local and cliente_id = it.cliente_id) then raise exception 'Local não é deste cliente' using errcode = '23514'; end if;
  if p_tipo = 'transferencia' and (p_local_para is null or p_local_para = p_local or not exists (select 1 from public.inv_locais where id = p_local_para and cliente_id = it.cliente_id)) then
    raise exception 'Escolha o local de destino (outro local do cliente)' using errcode = '23514'; end if;
  if p_funcionario is not null and not exists (select 1 from public.inv_funcionarios where id = p_funcionario and cliente_id = it.cliente_id) then raise exception 'Funcionário não é deste cliente' using errcode = '23514'; end if;
  if not interno.inv_no_do_cliente(p_aplicacao, it.cliente_id) then raise exception 'Esta aplicação não é deste cliente' using errcode = '23514'; end if;
  insert into public.inv_saldos (item_id, local_id, cliente_id, quantidade) values (it.id, p_local, it.cliente_id, 0) on conflict do nothing;
  select quantidade into saldo from public.inv_saldos where item_id = it.id and local_id = p_local for update;
  if p_tipo in ('saida','transferencia') and saldo < p_quantidade then raise exception 'Saldo insuficiente: há % em estoque neste local', saldo using errcode = '23514'; end if;
  update public.inv_saldos set quantidade = case p_tipo when 'entrada' then saldo + p_quantidade when 'ajuste' then p_quantidade else saldo - p_quantidade end
   where item_id = it.id and local_id = p_local;
  if p_tipo = 'transferencia' then
    insert into public.inv_saldos (item_id, local_id, cliente_id, quantidade) values (it.id, p_local_para, it.cliente_id, p_quantidade)
    on conflict (item_id, local_id) do update set quantidade = public.inv_saldos.quantidade + excluded.quantidade;
  end if;
  insert into public.inv_movimentos (cliente_id, tipo, item_id, quantidade, local_de, local_para, funcionario_para, aplicacao_para, data, motivo)
  values (it.cliente_id, p_tipo, it.id, case when p_tipo = 'ajuste' then p_quantidade - saldo else p_quantidade end,
          case when p_tipo = 'entrada' then null else p_local end, case p_tipo when 'entrada' then p_local when 'transferencia' then p_local_para when 'ajuste' then p_local else null end,
          p_funcionario, p_aplicacao, coalesce(p_data, current_date), left(coalesce(p_motivo, ''), 500))
  returning id into mid;
  return mid;
end $$;

-- conferência: marca o equipamento como achado (e onde) e atualiza a próxima conferência
create or replace function public.inv_conferir(p_conferencia uuid, p_ativo uuid, p_achado boolean, p_local uuid default null, p_notas text default '') returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.inv_conferencias; a public.inv_ativos; meses integer;
begin
  select * into c from public.inv_conferencias where id = p_conferencia;
  if c.id is null or not interno.inv_pode(c.cliente_id) then raise exception 'Conferência não encontrada ou sem acesso' using errcode = '42501'; end if;
  if c.concluida_em is not null then raise exception 'Esta conferência já foi concluída' using errcode = '23514'; end if;
  select * into a from public.inv_ativos where id = p_ativo and cliente_id = c.cliente_id;
  if a.id is null then raise exception 'Equipamento não é deste cliente' using errcode = '23514'; end if;
  insert into public.inv_conferencias_itens (conferencia_id, ativo_id, cliente_id, achado, local_achado, notas)
  values (c.id, a.id, c.cliente_id, p_achado, p_local, left(coalesce(p_notas, ''), 300))
  on conflict (conferencia_id, ativo_id) do update set achado = excluded.achado, local_achado = excluded.local_achado, notas = excluded.notas, em = now();
  if p_achado then
    select conferencia_meses into meses from public.inv_categorias where id = a.categoria_id;
    update public.inv_ativos set ultima_conferencia = current_date, proxima_conferencia = (current_date + make_interval(months => coalesce(meses, 12)))::date where id = a.id;
  end if;
  return true;
end $$;

-- funcionário desligado: o que ainda está com ele (para recolher)
create or replace function public.inv_pendencias_funcionario(p_funcionario uuid) returns table (tipo text, id uuid, nome text, situacao text)
language sql stable security definer set search_path = public, pg_temp as $$
  select 'equipamento', a.id, coalesce(nullif(a.patrimonio, '') || ' · ', '') || coalesce(nullif(a.descricao, ''), m.modelo, c.nome), a.situacao
    from public.inv_ativos a join public.inv_categorias c on c.id = a.categoria_id left join public.inv_modelos m on m.id = a.modelo_id
   where a.funcionario_id = p_funcionario and interno.inv_pode(a.cliente_id)
  union all
  select 'licenca', l.id, l.nome, 'em uso'
    from public.inv_licencas_uso u join public.inv_licencas l on l.id = u.licenca_id
   where u.funcionario_id = p_funcionario and interno.inv_pode(u.cliente_id) $$;

revoke all on function public.inv_preparar(uuid), public.inv_movimentar(uuid, text, text, uuid, uuid, uuid, date, text, date, uuid), public.inv_estornar(uuid, text),
  public.inv_estoque(uuid, text, uuid, numeric, uuid, uuid, uuid, text, date), public.inv_conferir(uuid, uuid, boolean, uuid, text), public.inv_pendencias_funcionario(uuid) from public, anon;
grant execute on function public.inv_preparar(uuid), public.inv_movimentar(uuid, text, text, uuid, uuid, uuid, date, text, date, uuid), public.inv_estornar(uuid, text),
  public.inv_estoque(uuid, text, uuid, numeric, uuid, uuid, uuid, text, date), public.inv_conferir(uuid, uuid, boolean, uuid, text), public.inv_pendencias_funcionario(uuid) to authenticated;

-- ---------- avisos (todo dia): garantia, empréstimo, aluguel, licença, conferência e estoque mínimo ----------
create or replace function interno.inv_avisos() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; k integer; hoje date := current_date;
begin
  with avisos as (
    select a.cliente_id, 'Garantia ' || case when a.garantia_ate = hoje then 'vence hoje' else 'vence em ' || (a.garantia_ate - hoje) || ' dias' end || ': ' || coalesce(nullif(a.patrimonio, ''), nullif(a.descricao, ''), 'equipamento') as titulo,
           'Garantia até ' || to_char(a.garantia_ate, 'DD/MM/YYYY') as texto
      from public.inv_ativos a where a.situacao <> 'baixado' and a.garantia_ate - hoje in (30, 7, 0)
    union all
    select a.cliente_id, 'Empréstimo ' || case when a.devolucao_prevista >= hoje then 'volta ' || case when a.devolucao_prevista = hoje then 'hoje' else 'amanhã' end else 'atrasado' end || ': ' || coalesce(nullif(a.patrimonio, ''), nullif(a.descricao, ''), 'equipamento'),
           'Devolução prevista para ' || to_char(a.devolucao_prevista, 'DD/MM/YYYY') || coalesce(' · com ' || f.nome, '')
      from public.inv_ativos a left join public.inv_funcionarios f on f.id = a.funcionario_id
     where a.situacao = 'emprestado' and a.devolucao_prevista - hoje in (1, 0, -1, -7)
    union all
    select a.cliente_id, 'Aluguel ' || case when a.contrato_fim = hoje then 'termina hoje' else 'termina em ' || (a.contrato_fim - hoje) || ' dias' end || ': ' || coalesce(nullif(a.patrimonio, ''), nullif(a.descricao, ''), 'equipamento'),
           'Contrato com ' || a.locadora || ' até ' || to_char(a.contrato_fim, 'DD/MM/YYYY')
      from public.inv_ativos a where a.situacao <> 'baixado' and a.propriedade = 'alugado' and a.contrato_fim - hoje in (60, 30, 7, 0)
    union all
    select l.cliente_id, 'Licença ' || case when l.vence_em = hoje then 'vence hoje' else 'vence em ' || (l.vence_em - hoje) || ' dias' end || ': ' || l.nome,
           'Vencimento em ' || to_char(l.vence_em, 'DD/MM/YYYY') || case when l.renovacao_automatica then ' · renovação automática ligada' else ' · confira a renovação' end
      from public.inv_licencas l where l.vence_em - hoje in (60, 30, 7, 0)
    union all
    select a.cliente_id, 'Conferência atrasada: ' || coalesce(nullif(a.patrimonio, ''), nullif(a.descricao, ''), 'equipamento'),
           'Devia ter sido conferido em ' || to_char(a.proxima_conferencia, 'DD/MM/YYYY')
      from public.inv_ativos a where a.situacao <> 'baixado' and hoje - a.proxima_conferencia in (1, 30)
    union all
    select i.cliente_id, 'Estoque abaixo do mínimo: ' || i.nome, 'Tem ' || coalesce((select sum(s.quantidade) from public.inv_saldos s where s.item_id = i.id), 0) || ', o mínimo é ' || i.estoque_minimo
      from public.inv_itens i
     where i.ativo and i.estoque_minimo > 0 and extract(isodow from hoje) = 1
       and coalesce((select sum(s.quantidade) from public.inv_saldos s where s.item_id = i.id), 0) < i.estoque_minimo)
  insert into public.notificacoes (pessoa_id, titulo, texto)
  select e.dono_id, left(v.titulo || ' (' || n.nome || ')', 300), v.texto
    from avisos v join public.nos n on n.id = v.cliente_id join public.espacos e on e.id = n.espaco_id
    join public.pessoas p on p.id = e.dono_id and p.ativo and p.auth_user_id is not null;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke execute on function interno.inv_avisos() from public, anon, authenticated;
grant execute on function interno.inv_avisos() to service_role;

-- ---------- histórico de quem fez o quê ----------
drop trigger if exists inv_ativos_auditoria on public.inv_ativos;
create trigger inv_ativos_auditoria after insert or update or delete on public.inv_ativos for each row execute function auditoria.registrar();
drop trigger if exists inv_licencas_auditoria on public.inv_licencas;
create trigger inv_licencas_auditoria after insert or update or delete on public.inv_licencas for each row execute function auditoria.registrar();
drop trigger if exists inv_itens_auditoria on public.inv_itens;
create trigger inv_itens_auditoria after insert or update or delete on public.inv_itens for each row execute function auditoria.registrar();

-- ---------- quem vê e quem mexe ----------
do $$
declare t text;
begin
  foreach t in array array['inv_categorias','inv_modelos','inv_locais','inv_funcionarios','inv_funcionarios_apps','inv_ativos','inv_ligacoes','inv_itens','inv_saldos',
                           'inv_licencas','inv_licencas_uso','inv_termos','inv_movimentos','inv_manutencoes','inv_baixas','inv_conferencias','inv_conferencias_itens','inv_anexos'] loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists ver on public.%I', t);
    execute format('drop policy if exists cria on public.%I', t);
    execute format('drop policy if exists muda on public.%I', t);
    execute format('drop policy if exists apaga on public.%I', t);
    execute format('create policy ver on public.%I for select to authenticated using (interno.inv_pode(cliente_id))', t);
    -- saldo e histórico: só pelas funções (inv_estoque, inv_movimentar, inv_estornar)
    if t not in ('inv_saldos','inv_movimentos','inv_conferencias_itens') then
      execute format('create policy cria on public.%I for insert to authenticated with check (interno.inv_pode(cliente_id)' || case when t = 'inv_funcionarios_apps' then ' and interno.inv_no_do_cliente(no_id, cliente_id)' else '' end || ')', t);
      execute format('create policy muda on public.%I for update to authenticated using (interno.inv_pode(cliente_id)) with check (interno.inv_pode(cliente_id))', t);
      execute format('grant insert, update on public.%I to authenticated', t);
    end if;
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
-- apagar: cadastros que nada usa; equipamento só sem movimentação além do cadastro (senão, baixa)
create policy apaga on public.inv_categorias for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_modelos for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_locais for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_funcionarios for delete to authenticated using (interno.inv_pode(cliente_id) and not exists (select 1 from public.inv_movimentos m where m.funcionario_de = inv_funcionarios.id or m.funcionario_para = inv_funcionarios.id));
create policy apaga on public.inv_funcionarios_apps for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_ativos for delete to authenticated using (interno.inv_pode(cliente_id) and not exists (select 1 from public.inv_movimentos m where m.ativo_id = inv_ativos.id and m.tipo <> 'cadastro'));
create policy apaga on public.inv_ligacoes for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_itens for delete to authenticated using (interno.inv_pode(cliente_id) and not exists (select 1 from public.inv_movimentos m where m.item_id = inv_itens.id));
create policy apaga on public.inv_licencas for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_licencas_uso for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_manutencoes for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_conferencias for delete to authenticated using (interno.inv_pode(cliente_id) and concluida_em is null);
create policy apaga on public.inv_anexos for delete to authenticated using (interno.inv_pode(cliente_id));
create policy apaga on public.inv_baixas for delete to authenticated using (interno.inv_pode(cliente_id) and not exists (select 1 from public.inv_ativos a where a.id = inv_baixas.ativo_id and a.situacao = 'baixado'));
create policy apaga on public.inv_termos for delete to authenticated using (interno.inv_pode(cliente_id) and assinado_em is null);
grant delete on public.inv_categorias, public.inv_modelos, public.inv_locais, public.inv_funcionarios, public.inv_funcionarios_apps, public.inv_ativos, public.inv_ligacoes,
  public.inv_itens, public.inv_licencas, public.inv_licencas_uso, public.inv_manutencoes, public.inv_conferencias, public.inv_anexos, public.inv_baixas, public.inv_termos to authenticated;
