-- =====================================================================
-- CicloDev · 23 · Portal do stakeholder (primeiro uso: Blanco & Lisboa, no sistema Java deles)
--
-- Um portal é uma janela só de leitura para um cliente da Estrutura, com uma única coisa que dá para fazer
-- de fora: responder as perguntas que a equipe manda. Tudo fica aqui no banco do CicloDev; o sistema de fora
-- (o Java da Blanco & Lisboa) não guarda nada, só mostra e responde pela função portal-api.
--
--   portais                 o portal: de qual cliente da Estrutura e de quem é (só o dono vê e mexe)
--   portais_membros         quem pode responder pelo portal (o dono convida pelo e-mail)
--   portais_chaves          as chaves que o sistema de fora usa para chamar a função (só o resumo fica guardado)
--   portais_segredos        o segredo que assina os avisos enviados ao sistema de fora (ninguém lê pela tela)
--   perguntas_stakeholder   cada pergunta mandada a partir de um item ou épico, com a resposta
--   portais_eventos         a fila de avisos para o sistema de fora (pergunta nova, respondida, cancelada)
--
-- Mandar uma pergunta muda o item para o status "Aguardando stakeholder"; a resposta volta o item para o status
-- que ele tinha, vira comentário no item e avisa no sininho de quem perguntou e do dono do portal.
-- Depende das partes 01, 02, 14, 15 e 20.
-- =====================================================================

create table if not exists public.portais (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null references public.pessoas(id) on delete cascade,
  no_id       uuid not null references public.nos(id) on delete cascade,
  nome        text not null check (length(btrim(nome)) between 1 and 120),
  ativo       boolean not null default true,
  webhook_url text check (webhook_url is null or webhook_url ~ '^https://[^\s]+$'),
  criado_em   timestamptz not null default now(),
  unique (no_id)
);
comment on table public.portais is 'Portal do stakeholder: um cliente da Estrutura visto de fora, só para ler e responder perguntas. Só o dono vê.';

create table if not exists public.portais_membros (
  portal_id    uuid not null references public.portais(id) on delete cascade,
  email        text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+$'),
  nome         text not null check (length(btrim(nome)) between 1 and 120),
  ativo        boolean not null default true,
  convidado_em timestamptz not null default now(),
  primary key (portal_id, email)
);
comment on table public.portais_membros is 'Quem pode responder pelo portal. O sistema de fora diz o e-mail de quem está respondendo; só e-mail ativo daqui passa.';

create table if not exists public.portais_chaves (
  id          uuid primary key default gen_random_uuid(),
  portal_id   uuid not null references public.portais(id) on delete cascade,
  nome        text not null default 'Chave',
  prefixo     text not null,
  resumo      text not null unique,   -- sha256 da chave; a chave em si só aparece uma vez, na hora de gerar
  criada_em   timestamptz not null default now(),
  usada_em    timestamptz,
  revogada_em timestamptz
);
comment on table public.portais_chaves is 'Chaves do sistema de fora. Guarda só o resumo (sha256) e o começo, para reconhecer na tela.';

create table if not exists public.portais_segredos (
  portal_id       uuid primary key references public.portais(id) on delete cascade,
  webhook_segredo text not null
);
comment on table public.portais_segredos is 'Segredo que assina os avisos enviados ao sistema de fora. Ninguém lê pela tela: só a rotina do banco.';

create table if not exists public.perguntas_stakeholder (
  id                   uuid primary key default gen_random_uuid(),
  portal_id            uuid not null references public.portais(id) on delete cascade,
  item_id              uuid not null references public.itens(id) on delete cascade,
  pergunta             text not null check (length(btrim(pergunta)) between 1 and 4000),
  criada_por           uuid references public.pessoas(id) on delete set null,
  criada_em            timestamptz not null default now(),
  status               text not null default 'aguardando' check (status in ('aguardando','respondida','cancelada')),
  resposta             text check (resposta is null or length(resposta) <= 8000),
  respondida_por_email text,
  respondida_por_nome  text,
  respondida_em        timestamptz,
  status_antes         uuid references public.status_fluxo(id) on delete set null,
  check ((status = 'respondida') = (resposta is not null and respondida_em is not null))
);
create index if not exists perguntas_item_idx on public.perguntas_stakeholder (item_id);
create index if not exists perguntas_portal_idx on public.perguntas_stakeholder (portal_id, status, criada_em desc);
comment on table public.perguntas_stakeholder is 'Perguntas mandadas ao stakeholder a partir de um item ou épico, com a resposta que veio pelo portal.';

create table if not exists public.portais_eventos (
  id          bigint generated always as identity primary key,
  portal_id   uuid not null references public.portais(id) on delete cascade,
  tipo        text not null check (tipo in ('pergunta_criada','pergunta_respondida','pergunta_cancelada')),
  dados       jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now(),
  pedido_id   bigint,          -- pedido do pg_net em andamento
  enviado_em  timestamptz,     -- quando o pedido em andamento saiu (sem resposta em 10 minutos, tenta de novo)
  tentativas  smallint not null default 0,
  entregue_em timestamptz,
  ultimo_erro text
);
create index if not exists portais_eventos_fila_idx on public.portais_eventos (portal_id, id) where entregue_em is null;
comment on table public.portais_eventos is 'Fila de avisos ao sistema de fora. A rotina da parte 24 manda por webhook; o sistema de fora também pode buscar pela função.';

-- ---------------------------------------------------------------------
-- regras de acesso: tudo do portal só para o dono; as perguntas também para quem enxerga o item
-- ---------------------------------------------------------------------
alter table public.portais enable row level security;
alter table public.portais_membros enable row level security;
alter table public.portais_chaves enable row level security;
alter table public.portais_segredos enable row level security;
alter table public.perguntas_stakeholder enable row level security;
alter table public.portais_eventos enable row level security;

drop policy if exists dono on public.portais;
create policy dono on public.portais for all to authenticated
  using (dono_id = (select interno.pessoa_atual())) with check (dono_id = (select interno.pessoa_atual()));
drop policy if exists dono on public.portais_membros;
create policy dono on public.portais_membros for all to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())))
  with check (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())));
drop policy if exists dono_ve on public.portais_chaves;
create policy dono_ve on public.portais_chaves for select to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())));
drop policy if exists ver on public.perguntas_stakeholder;
create policy ver on public.perguntas_stakeholder for select to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual()))
         or exists (select 1 from public.itens i where i.id = item_id and i.frente_id in (select interno.nos_visiveis())));
drop policy if exists dono_ve on public.portais_eventos;
create policy dono_ve on public.portais_eventos for select to authenticated
  using (portal_id in (select id from public.portais where dono_id = (select interno.pessoa_atual())));

revoke all on public.portais, public.portais_membros, public.portais_chaves, public.portais_segredos, public.perguntas_stakeholder, public.portais_eventos from anon, authenticated;
grant select, update on public.portais to authenticated;
grant select, insert, update, delete on public.portais_membros to authenticated;
grant select on public.portais_chaves, public.perguntas_stakeholder, public.portais_eventos to authenticated;
grant all on public.portais, public.portais_membros, public.portais_chaves, public.portais_segredos, public.perguntas_stakeholder, public.portais_eventos to service_role;
grant usage, select on all sequences in schema public to service_role;

-- o dono não muda de quem é nem de qual cliente é pela tela (só nome, ativo e endereço do webhook)
create or replace function interno.portal_so_campos_livres() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.dono_id <> old.dono_id or new.no_id <> old.no_id or new.id <> old.id then
    raise exception 'O portal não muda de dono nem de cliente' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists portais_campos_livres on public.portais;
create trigger portais_campos_livres before update on public.portais for each row execute function interno.portal_so_campos_livres();

-- ---------------------------------------------------------------------
-- funções que a tela do CicloDev chama
-- ---------------------------------------------------------------------
-- o status "Aguardando stakeholder" do cliente do portal (cria se não existir)
create or replace function interno.portal_status_aguardando(p_no uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v uuid;
begin
  select id into v from public.status_fluxo where no_id = p_no and chave = 'aguardando_stakeholder';
  if v is null then
    insert into public.status_fluxo (no_id, chave, nome, explicacao, cor, grupo, ordem)
    values (p_no, 'aguardando_stakeholder', 'Aguardando stakeholder', 'Mandamos uma pergunta ao stakeholder e esperamos a resposta.', '#B04A00', 'blocked', 90)
    returning id into v;
  end if;
  return v;
end $$;

create or replace function public.portal_criar(p_no uuid, p_nome text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); v uuid; tp text;
begin
  if eu is null then raise exception 'Entre no sistema primeiro' using errcode = '42501'; end if;
  select tipo into tp from public.nos where id = p_no;
  if tp is distinct from 'cliente' then raise exception 'O portal é de um cliente da Estrutura' using errcode = '22023'; end if;
  if p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mexer neste cliente' using errcode = '42501'; end if;
  insert into public.portais (dono_id, no_id, nome) values (eu, p_no, btrim(p_nome)) returning id into v;
  perform interno.portal_status_aguardando(p_no);
  return v;
end $$;

-- a chave aparece só agora, uma vez; o banco guarda só o resumo
create or replace function public.portal_gerar_chave(p_portal uuid, p_nome text default 'Chave') returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare chave text;
begin
  if not exists (select 1 from public.portais where id = p_portal and dono_id = interno.pessoa_atual()) then raise exception 'Portal não encontrado' using errcode = '42501'; end if;
  chave := 'cdp_' || translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.portais_chaves (portal_id, nome, prefixo, resumo) values (p_portal, coalesce(nullif(btrim(p_nome), ''), 'Chave'), left(chave, 10), encode(digest(chave, 'sha256'), 'hex'));
  return chave;
end $$;

create or replace function public.portal_revogar_chave(p_chave uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.portais_chaves c set revogada_em = now() where c.id = p_chave and c.revogada_em is null
    and c.portal_id in (select id from public.portais where dono_id = interno.pessoa_atual());
  if not found then raise exception 'Chave não encontrada' using errcode = '42501'; end if;
end $$;

-- endereço do webhook e um segredo novo para assinar (o segredo aparece só agora)
create or replace function public.portal_webhook(p_portal uuid, p_url text) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s text;
begin
  if not exists (select 1 from public.portais where id = p_portal and dono_id = interno.pessoa_atual()) then raise exception 'Portal não encontrado' using errcode = '42501'; end if;
  update public.portais set webhook_url = nullif(btrim(p_url), '') where id = p_portal;
  if nullif(btrim(p_url), '') is null then delete from public.portais_segredos where portal_id = p_portal; return null; end if;
  s := 'cdw_' || encode(gen_random_bytes(24), 'hex');
  insert into public.portais_segredos (portal_id, webhook_segredo) values (p_portal, s)
    on conflict (portal_id) do update set webhook_segredo = excluded.webhook_segredo;
  return s;
end $$;

-- os dados de uma pergunta como vão no aviso e na função
create or replace function interno.portal_pergunta_json(p uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('pergunta_id', q.id, 'pergunta', q.pergunta, 'status', q.status, 'criada_em', q.criada_em,
    'criada_por', pe.nome, 'resposta', q.resposta, 'respondida_por', q.respondida_por_nome, 'respondida_em', q.respondida_em,
    'item', jsonb_build_object('id', i.id, 'chave', i.chave, 'titulo', i.titulo, 'tipo', i.tipo))
  from public.perguntas_stakeholder q join public.itens i on i.id = q.item_id left join public.pessoas pe on pe.id = q.criada_por where q.id = p
$$;

create or replace function public.pergunta_criar(p_item uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); it record; pt record; st uuid; v uuid;
begin
  select * into it from public.itens where id = p_item;
  if it.id is null or it.frente_id not in (select interno.nos_editaveis()) then raise exception 'Você não pode mexer neste item' using errcode = '42501'; end if;
  select p.* into pt from public.portais p join public.nos_ancestrais a on a.ancestral_id = p.no_id and a.no_id = it.frente_id where p.ativo limit 1;
  if pt.id is null then raise exception 'Este item não está num cliente com portal do stakeholder' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva a pergunta' using errcode = '22023'; end if;
  st := interno.portal_status_aguardando(pt.no_id);
  insert into public.perguntas_stakeholder (portal_id, item_id, pergunta, criada_por, status_antes)
  values (pt.id, p_item, btrim(p_texto), eu, case when it.status_id = st then (select q.status_antes from public.perguntas_stakeholder q where q.item_id = p_item and q.status = 'aguardando' order by criada_em limit 1) else it.status_id end)
  returning id into v;
  update public.itens set status_id = st where id = p_item and status_id <> st;
  insert into public.portais_eventos (portal_id, tipo, dados) values (pt.id, 'pergunta_criada', interno.portal_pergunta_json(v));
  return v;
end $$;

-- volta o item para o status de antes quando não sobra nenhuma pergunta esperando nele
create or replace function interno.portal_liberar_item(p_item uuid, p_status_antes uuid, p_no uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare st uuid;
begin
  select id into st from public.status_fluxo where no_id = p_no and chave = 'aguardando_stakeholder';
  if exists (select 1 from public.perguntas_stakeholder where item_id = p_item and status = 'aguardando') then return; end if;
  update public.itens set status_id = coalesce(p_status_antes, (select id from public.status_fluxo where no_id is null and chave = 'todo' limit 1))
   where id = p_item and status_id = st;
end $$;

create or replace function public.pergunta_cancelar(p_pergunta uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare q record; pt record;
begin
  select * into q from public.perguntas_stakeholder where id = p_pergunta;
  if q.id is null or not exists (select 1 from public.itens i where i.id = q.item_id and i.frente_id in (select interno.nos_editaveis())) then raise exception 'Pergunta não encontrada' using errcode = '42501'; end if;
  if q.status <> 'aguardando' then raise exception 'Esta pergunta já foi respondida ou cancelada' using errcode = '22023'; end if;
  select * into pt from public.portais where id = q.portal_id;
  update public.perguntas_stakeholder set status = 'cancelada' where id = p_pergunta;
  perform interno.portal_liberar_item(q.item_id, q.status_antes, pt.no_id);
  insert into public.portais_eventos (portal_id, tipo, dados) values (q.portal_id, 'pergunta_cancelada', interno.portal_pergunta_json(p_pergunta));
end $$;

-- os clientes com portal ligado que a pessoa enxerga (para a tela mostrar "Perguntar ao stakeholder" só onde dá)
create or replace function public.portais_clientes() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.no_id from public.portais p where p.ativo and p.no_id in (select interno.nos_visiveis())
$$;

-- ---------------------------------------------------------------------
-- funções da portal-api (só service_role: a função confere a chave antes)
-- ---------------------------------------------------------------------
create or replace function public.portal_por_chave(p_chave text) returns table (portal_id uuid, no_id uuid, nome text)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  return query
  update public.portais_chaves c set usada_em = now()
    from public.portais p
   where c.resumo = encode(digest(p_chave, 'sha256'), 'hex') and c.revogada_em is null and p.id = c.portal_id and p.ativo
  returning p.id, p.no_id, p.nome;
end $$;

-- o nome do status em português, igual à tela do CicloDev (os status padrão têm nome em inglês no banco)
create or replace function interno.portal_nome_status(p_status uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when sf.no_id is null then coalesce('{"backlog":"Na fila","todo":"A fazer","doing":"Fazendo","review":"Em revisão","blocked":"Travado","done":"Feito"}'::jsonb ->> sf.chave, sf.nome) else sf.nome end
  from public.status_fluxo sf where sf.id = p_status
$$;

-- os itens que o portal enxerga: tudo o que está debaixo do cliente, menos os arquivados
create or replace function interno.portal_itens(p_portal uuid) returns setof public.itens
language sql stable security definer set search_path = public, pg_temp as $$
  select i.* from public.itens i
  join public.nos_ancestrais a on a.no_id = i.frente_id
  join public.portais p on p.id = p_portal and a.ancestral_id = p.no_id
  where i.arquivado_em is null
$$;

-- a Estrutura do cliente, com o andamento de cada parte
create or replace function public.portal_estrutura(p_portal uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with p as (select * from public.portais where id = p_portal),
  nos as (select n.id, n.tipo, n.pai_id, n.nome, n.status, n.ordem, a.distancia from public.nos n join public.nos_ancestrais a on a.no_id = n.id join p on a.ancestral_id = p.no_id where n.status <> 'arquivado'),
  its as (select i.id, i.frente_id, sf.grupo from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id),
  soma as (select a.ancestral_id as no_id, count(*) as itens, count(*) filter (where its.grupo = 'done') as feitos, count(*) filter (where its.grupo = 'blocked') as travados
           from its join public.nos_ancestrais a on a.no_id = its.frente_id group by a.ancestral_id)
  select coalesce(jsonb_agg(jsonb_build_object('id', nos.id, 'tipo', nos.tipo, 'pai_id', nos.pai_id, 'nome', nos.nome, 'status', nos.status, 'nivel', nos.distancia,
           'itens', coalesce(s.itens, 0), 'concluidos', coalesce(s.feitos, 0), 'travados', coalesce(s.travados, 0),
           'progresso', case when coalesce(s.itens, 0) = 0 then 0 else round(100.0 * s.feitos / s.itens) end) order by nos.distancia, nos.ordem, nos.nome), '[]'::jsonb)
  from nos left join soma s on s.no_id = nos.id
$$;

-- o painel: os mesmos números do painel do CicloDev, para o cliente todo ou para uma parte dele
create or replace function public.portal_painel(p_portal uuid, p_no uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare base uuid; r jsonb;
begin
  select coalesce(p_no, no_id) into base from public.portais where id = p_portal;
  if not exists (select 1 from public.portais p join public.nos_ancestrais a on a.ancestral_id = p.no_id and a.no_id = base where p.id = p_portal) then
    raise exception 'Fora do portal' using errcode = '42501'; end if;
  with its as (select i.*, sf.grupo, interno.portal_nome_status(sf.id) as status_nome from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id
               join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = base),
  frentes as (select n.id, n.status from public.nos n join public.nos_ancestrais a on a.no_id = n.id and a.ancestral_id = base where n.tipo = 'frente' and n.status <> 'arquivado'),
  filhos as (select n.id, n.nome, n.tipo from public.nos n where n.pai_id = base and n.status <> 'arquivado')
  select jsonb_build_object(
    'no', (select jsonb_build_object('id', n.id, 'tipo', n.tipo, 'nome', n.nome) from public.nos n where n.id = base),
    'numeros', jsonb_build_object(
      'itens', (select count(*) from its),
      'a_fazer', (select count(*) from its where grupo in ('backlog','todo')),
      'em_andamento', (select count(*) from its where grupo in ('doing','review')),
      'travados', (select count(*) from its where grupo = 'blocked'),
      'concluidos', (select count(*) from its where grupo = 'done'),
      'atrasados', (select count(*) from its where grupo <> 'done' and prazo < current_date),
      'frentes_ativas', (select count(*) from frentes where status = 'ativo'),
      'frentes_paradas', (select count(*) from frentes where status = 'pausado'),
      'perguntas_esperando', (select count(*) from public.perguntas_stakeholder q where q.portal_id = p_portal and q.status = 'aguardando' and q.item_id in (select id from its))),
    'por_grupo', (select coalesce(jsonb_object_agg(grupo, n), '{}'::jsonb) from (select grupo, count(*) n from its group by grupo) g),
    'por_parte', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'nome', f.nome, 'tipo', f.tipo, 'itens', x.itens, 'concluidos', x.feitos,
                    'progresso', case when x.itens = 0 then 0 else round(100.0 * x.feitos / x.itens) end) order by f.nome), '[]'::jsonb)
                  from filhos f cross join lateral (select count(*) itens, count(*) filter (where i.grupo = 'done') feitos from its i join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = f.id) x),
    'concluidos_por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'concluidos', (select count(*) from its where grupo = 'done' and concluido_em::date = d::date)) order by d), '[]'::jsonb)
                  from generate_series(current_date - 13, current_date, interval '1 day') d),
    'ultimos_concluidos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'chave', chave, 'titulo', titulo, 'concluido_em', concluido_em) order by concluido_em desc), '[]'::jsonb)
                  from (select * from its where grupo = 'done' and concluido_em is not null order by concluido_em desc limit 8) u),
    'proximos_prazos', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'chave', chave, 'titulo', titulo, 'prazo', prazo, 'status', status_nome) order by prazo), '[]'::jsonb)
                  from (select * from its where grupo <> 'done' and prazo is not null order by prazo limit 8) u)
  ) into r;
  return r;
end $$;

-- o quadro analítico: as colunas do fluxo com os épicos em cartões (andamento de cada um) e os itens soltos contados
create or replace function public.portal_quadro(p_portal uuid, p_no uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare base uuid; r jsonb;
begin
  select coalesce(p_no, no_id) into base from public.portais where id = p_portal;
  if not exists (select 1 from public.portais p join public.nos_ancestrais a on a.ancestral_id = p.no_id and a.no_id = base where p.id = p_portal) then
    raise exception 'Fora do portal' using errcode = '42501'; end if;
  with its as (select i.*, sf.grupo, interno.portal_nome_status(sf.id) as status_nome from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id
               join public.nos_ancestrais a on a.no_id = i.frente_id and a.ancestral_id = base),
  ep as (select e.*, (select count(*) from its f where f.pai_id = e.id) as n_itens, (select count(*) from its f where f.pai_id = e.id and f.grupo = 'done') as n_feitos,
                (select count(*) from public.perguntas_stakeholder q where q.item_id = e.id and q.status = 'aguardando')
                + (select count(*) from public.perguntas_stakeholder q join its f on f.id = q.item_id where f.pai_id = e.id and q.status = 'aguardando') as n_perguntas
         from its e where e.tipo = 'epic')
  select jsonb_build_object('colunas', (select jsonb_agg(jsonb_build_object('grupo', g.grupo, 'nome', g.nome,
      'itens', (select count(*) from its where its.grupo = g.grupo),
      'epicos', (select coalesce(jsonb_agg(jsonb_build_object('id', ep.id, 'chave', ep.chave, 'titulo', ep.titulo, 'status', ep.status_nome, 'prazo', ep.prazo,
                   'itens', ep.n_itens, 'concluidos', ep.n_feitos, 'progresso', case when ep.n_itens = 0 then 0 else round(100.0 * ep.n_feitos / ep.n_itens) end,
                   'perguntas_esperando', ep.n_perguntas,
                   'frente', (select nome from public.nos where id = ep.frente_id)) order by ep.prazo nulls last, ep.titulo), '[]'::jsonb) from ep where ep.grupo = g.grupo),
      'sem_epico', (select count(*) from its where its.grupo = g.grupo and its.tipo <> 'epic' and (its.pai_id is null or its.pai_id not in (select id from ep))))
      order by g.ordem)
    from (values ('backlog', 'Na fila', 1), ('todo', 'A fazer', 2), ('doing', 'Fazendo', 3), ('review', 'Em revisão', 4), ('blocked', 'Travado ou esperando', 5), ('done', 'Feito', 6)) g(grupo, nome, ordem))
  ) into r;
  return r;
end $$;

-- um item ou épico em modo apresentação: tudo o que o cliente pode ler, com os itens de dentro e as perguntas
create or replace function public.portal_item(p_portal uuid, p_item uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with it as (select i.*, interno.portal_nome_status(sf.id) as status_nome, sf.grupo from interno.portal_itens(p_portal) i join public.status_fluxo sf on sf.id = i.status_id where i.id = p_item)
  select jsonb_build_object('id', it.id, 'chave', it.chave, 'titulo', it.titulo, 'tipo', it.tipo, 'descricao', it.descricao, 'status', it.status_nome, 'grupo', it.grupo,
    'prioridade', it.prioridade, 'inicio', it.inicio, 'prazo', it.prazo, 'concluido_em', it.concluido_em,
    'responsavel', (select nome from public.pessoas where id = it.responsavel_id),
    'onde', (select jsonb_agg(jsonb_build_object('id', n.id, 'tipo', n.tipo, 'nome', n.nome) order by a.distancia desc) from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id where a.no_id = it.frente_id),
    'epico', (select jsonb_build_object('id', e.id, 'chave', e.chave, 'titulo', e.titulo) from public.itens e where e.id = it.pai_id),
    'versao', (select jsonb_build_object('id', m.id, 'nome', m.nome, 'data', m.data) from public.marcos m where m.id = it.marco_id),
    'checklist', (select coalesce(jsonb_agg(jsonb_build_object('texto', c.texto, 'feito', c.feito) order by c.ordem), '[]'::jsonb) from public.itens_checklist c where c.item_id = it.id),
    'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'chave', f.chave, 'titulo', f.titulo, 'tipo', f.tipo, 'status', interno.portal_nome_status(sf.id), 'grupo', sf.grupo, 'prazo', f.prazo,
                'responsavel', (select nome from public.pessoas where id = f.responsavel_id)) order by f.ordem, f.titulo), '[]'::jsonb)
              from interno.portal_itens(p_portal) f join public.status_fluxo sf on sf.id = f.status_id where f.pai_id = it.id),
    'comentarios_do_cliente', (select coalesce(jsonb_agg(jsonb_build_object('texto', c.texto, 'autor', (select nome from public.pessoas where id = c.autor_id), 'quando', c.criado_em) order by c.criado_em), '[]'::jsonb)
              from public.comentarios c where c.item_id = it.id and c.visivel_cliente),
    'perguntas', (select coalesce(jsonb_agg(interno.portal_pergunta_json(q.id) order by q.criada_em desc), '[]'::jsonb) from public.perguntas_stakeholder q where q.item_id = it.id and q.status <> 'cancelada'))
  from it
$$;

create or replace function public.portal_perguntas(p_portal uuid, p_status text default 'aguardando') returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(interno.portal_pergunta_json(q.id) order by q.criada_em desc), '[]'::jsonb)
  from public.perguntas_stakeholder q where q.portal_id = p_portal and (p_status is null or p_status = 'todas' or q.status = p_status)
$$;

create or replace function public.portal_eventos_lista(p_portal uuid, p_depois bigint default 0, p_limite int default 100) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'criado_em', e.criado_em, 'dados', e.dados) order by e.id), '[]'::jsonb)
  from (select * from public.portais_eventos where portal_id = p_portal and id > coalesce(p_depois, 0) order by id limit least(greatest(coalesce(p_limite, 100), 1), 500)) e
$$;

create or replace function public.portal_responder(p_portal uuid, p_pergunta uuid, p_email text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare m record; q record; pt record; it record; aviso text;
begin
  select * into m from public.portais_membros where portal_id = p_portal and email = lower(btrim(p_email)) and ativo;
  if m.email is null then raise exception 'Este e-mail não é membro do portal' using errcode = '42501'; end if;
  select * into q from public.perguntas_stakeholder where id = p_pergunta and portal_id = p_portal for update;
  if q.id is null then raise exception 'Pergunta não encontrada' using errcode = 'P0002'; end if;
  if q.status <> 'aguardando' then raise exception 'Esta pergunta já foi respondida ou cancelada' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva a resposta' using errcode = '22023'; end if;
  select * into pt from public.portais where id = p_portal;
  select * into it from public.itens where id = q.item_id;
  update public.perguntas_stakeholder set status = 'respondida', resposta = btrim(p_texto), respondida_por_email = m.email, respondida_por_nome = m.nome, respondida_em = now() where id = q.id;
  perform interno.portal_liberar_item(q.item_id, q.status_antes, pt.no_id);
  insert into public.comentarios (item_id, autor_id, texto, visivel_cliente)
  values (q.item_id, null, 'Resposta do stakeholder (' || m.nome || '), pela pergunta "' || left(q.pergunta, 300) || '":' || chr(10) || btrim(p_texto), true);
  aviso := coalesce(it.chave || ' ', '') || it.titulo;
  insert into public.notificacoes (pessoa_id, titulo, texto, item_id, tipo)
  select distinct x, 'Resposta do stakeholder: ' || left(aviso, 120), m.nome || ' respondeu: ' || left(btrim(p_texto), 300), q.item_id, 'aviso'
  from unnest(array[pt.dono_id, q.criada_por]) x where x is not null;
  insert into public.portais_eventos (portal_id, tipo, dados) values (p_portal, 'pergunta_respondida', interno.portal_pergunta_json(q.id));
  return interno.portal_pergunta_json(q.id);
end $$;

-- quem chama o quê
revoke all on function public.portal_criar(uuid, text), public.portal_gerar_chave(uuid, text), public.portal_revogar_chave(uuid), public.portal_webhook(uuid, text),
  public.pergunta_criar(uuid, text), public.pergunta_cancelar(uuid), public.portais_clientes() from public, anon;
grant execute on function public.portal_criar(uuid, text), public.portal_gerar_chave(uuid, text), public.portal_revogar_chave(uuid), public.portal_webhook(uuid, text),
  public.pergunta_criar(uuid, text), public.pergunta_cancelar(uuid), public.portais_clientes() to authenticated;
revoke all on function public.portal_por_chave(text), public.portal_estrutura(uuid), public.portal_painel(uuid, uuid), public.portal_quadro(uuid, uuid), public.portal_item(uuid, uuid),
  public.portal_perguntas(uuid, text), public.portal_eventos_lista(uuid, bigint, int), public.portal_responder(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.portal_por_chave(text), public.portal_estrutura(uuid), public.portal_painel(uuid, uuid), public.portal_quadro(uuid, uuid), public.portal_item(uuid, uuid),
  public.portal_perguntas(uuid, text), public.portal_eventos_lista(uuid, bigint, int), public.portal_responder(uuid, uuid, text, text) to service_role;
revoke all on function interno.portal_nome_status(uuid), interno.portal_status_aguardando(uuid), interno.portal_pergunta_json(uuid), interno.portal_liberar_item(uuid, uuid, uuid), interno.portal_itens(uuid), interno.portal_so_campos_livres() from public, anon, authenticated;
