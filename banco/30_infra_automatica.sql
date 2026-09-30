-- =====================================================================
-- CicloDev · 30 · Infraestrutura automática: os desenhos que saem sozinhos, sem IA
--
-- Três jeitos de um desenho nascer na aba Infraestrutura:
--   1. Do código (origem 'github'): cada publicação em PRODUÇÃO que chega do GitHub (tabela publicacoes, parte 19)
--      põe um pedido na fila. A função diagramas-auto baixa o código daquele commit e monta, sem IA:
--        software  módulos do código e quem importa quem (PlantUML)
--        infra     Docker, Terraform, Vercel, Supabase, GitHub Actions (Graphviz)
--        ux        mapa de telas pelas rotas (Next.js, SvelteKit, Nuxt, Remix) (Mermaid)
--        der       modelos do Prisma, quando houver (DBML)
--   2. Do banco (origem 'banco'): o projeto ou produto liga o banco de dados do sistema (só leitura).
--      A função olha o banco de hora em hora e, quando a estrutura muda, redesenha:
--        der       tabelas, colunas e ligações (DBML)
--        seguranca quem acessa cada tabela, RLS e regras (Graphviz)
--   3. Do DevIT (origem 'devit', parte 29): o que depende de interpretação (solução, domínio, processos,
--      sequências, protótipos). Continua sob pedido, e agora usa os desenhos automáticos como evidência.
--
--   infra_bancos                  qual projeto ou produto tem banco ligado, e o estado da última leitura
--   interno.infra_bancos_conexao  o endereço de conexão (com a senha). Ninguém lê pela tela; só a função
--   infra_automacoes              a fila: cada publicação, mudança no banco ou "Atualizar agora"
--
--   Cada desenho automático ou do DevIT também é montado como um quadro do canvas (infra_quadro_gravar).
-- A chamada da função (pg_net), a rotina de hora em hora (pg_cron) e o segredo (Vault) ficam na
-- parte 31, que é só do Supabase. Aqui, interno.infra_auto_chamar() não faz nada (teste local).
-- Depende das partes 01, 15, 19 e 29.
-- =====================================================================

-- ---------- desenhos: de onde vieram e qual é a chave do desenho automático ----------
alter table public.infra_diagramas drop constraint if exists infra_diagramas_origem_check;
alter table public.infra_diagramas add constraint infra_diagramas_origem_check check (origem in ('manual','devit','github','banco'));
alter table public.infra_diagramas add column if not exists chave_auto text check (chave_auto is null or length(chave_auto) <= 300);
alter table public.infra_diagramas add column if not exists referencia text check (referencia is null or length(referencia) <= 200);
alter table public.infra_diagramas add column if not exists auto_em timestamptz;
create unique index if not exists infra_diagramas_auto_uq on public.infra_diagramas (no_id, chave_auto) where chave_auto is not null;
comment on column public.infra_diagramas.chave_auto is 'Só nos desenhos automáticos: identifica o desenho (ex.: github:org/repo:software, banco:der:public) para a próxima rodada atualizar o mesmo, e não criar outro.';
comment on column public.infra_diagramas.referencia is 'De qual versão saiu: o commit (github) ou o resumo da estrutura do banco (banco).';

-- ---------- banco ligado ----------
create table if not exists public.infra_bancos (
  no_id             uuid primary key references public.nos(id) on delete cascade,
  nome              text not null default 'Banco de dados' check (length(btrim(nome)) between 1 and 120),
  esquemas          text[] not null default '{public}' check (cardinality(esquemas) between 1 and 20),
  ativo             boolean not null default true,
  ultimo_hash       text,
  ultima_leitura_em timestamptz,
  ultima_mudanca_em timestamptz,
  ultimo_erro       text,
  criado_por        uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em         timestamptz not null default now()
);
comment on table public.infra_bancos is 'Projeto ou produto com o banco de dados do sistema ligado (só leitura), para o DER e o mapa de acesso saírem sozinhos. O endereço com a senha fica em interno.infra_bancos_conexao.';

create table if not exists interno.infra_bancos_conexao (
  no_id     uuid primary key references public.infra_bancos(no_id) on delete cascade,
  conexao   text not null check (conexao ~ '^postgres(ql)?://' and length(conexao) <= 1000),
  trocado_em timestamptz not null default now()
);
revoke all on interno.infra_bancos_conexao from public, anon, authenticated;

drop trigger if exists infra_bancos_no on public.infra_bancos;
create trigger infra_bancos_no before insert or update of no_id on public.infra_bancos for each row execute function interno.infra_conferir_no();

-- ---------- a fila ----------
create table if not exists public.infra_automacoes (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  origem         text not null check (origem in ('github','banco','manual')),
  repositorio_id uuid references public.repositorios(id) on delete set null,
  publicacao_id  uuid references public.publicacoes(id) on delete set null,
  referencia     text check (referencia is null or length(referencia) <= 200),
  status         text not null default 'pendente' check (status in ('pendente','rodando','pronto','erro')),
  tentativas     integer not null default 0,
  pedido_por     uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em      timestamptz not null default now(),
  iniciado_em    timestamptz,
  concluido_em   timestamptz,
  diagramas      uuid[] not null default '{}',
  resumo         jsonb not null default '[]'::jsonb check (jsonb_typeof(resumo) = 'array'),
  erro           text
);
create index if not exists infra_automacoes_no_idx on public.infra_automacoes (no_id, criado_em desc);
create index if not exists infra_automacoes_fila_idx on public.infra_automacoes (criado_em) where status in ('pendente','rodando');
comment on table public.infra_automacoes is 'Fila dos desenhos automáticos: cada publicação em produção, mudança na estrutura do banco ou pedido de "Atualizar agora", com o que saiu.';

drop trigger if exists infra_automacoes_no on public.infra_automacoes;
create trigger infra_automacoes_no before insert on public.infra_automacoes for each row execute function interno.infra_conferir_no();

-- chama a função diagramas-auto. Aqui não faz nada: a parte 31 (Supabase) troca por pg_net.
create or replace function interno.infra_auto_chamar() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$ begin return null; end $$;

-- o projeto ou produto de um nó: ele mesmo, se já for, ou o mais próximo acima
create or replace function interno.infra_no_de(p uuid) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select a.ancestral_id from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
   where a.no_id = p and n.tipo in ('produto','projeto')
   order by a.distancia limit 1
$$;

-- publicação em produção com sucesso, vinda de um repositório: pede os desenhos do código daquele commit
create or replace function interno.infra_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare alvo uuid;
begin
  if new.status <> 'sucesso' or new.ambiente <> 'producao' or new.repositorio_id is null then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'sucesso' and old.ambiente = 'producao' and old.referencia is not distinct from new.referencia then return null; end if;
  alvo := interno.infra_no_de(new.no_id);
  if alvo is null then return null; end if;
  if not exists (select 1 from public.repositorios r where r.id = new.repositorio_id and r.ativo and r.provedor = 'github') then return null; end if;
  -- o mesmo commit já está na fila: não repete
  if exists (select 1 from public.infra_automacoes a where a.no_id = alvo and a.repositorio_id = new.repositorio_id
              and a.referencia is not distinct from new.referencia and a.status in ('pendente','rodando')) then return null; end if;
  insert into public.infra_automacoes (no_id, origem, repositorio_id, publicacao_id, referencia, pedido_por)
  values (alvo, 'github', new.repositorio_id, new.id, left(new.referencia, 200), null);
  perform interno.infra_auto_chamar();
  return null;
end $$;
drop trigger if exists publicacoes_infra on public.publicacoes;
create trigger publicacoes_infra after insert or update of status, ambiente, referencia on public.publicacoes
  for each row execute function interno.infra_publicou();

-- ---------- o que a tela chama ----------
-- ligar ou trocar o banco. p_conexao vazio mantém o endereço que já está guardado.
create or replace function public.infra_banco_definir(p_no uuid, p_nome text, p_esquemas text[], p_conexao text default null, p_ativo boolean default true)
returns public.infra_bancos
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.infra_bancos; esq text[];
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos e produtos' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct btrim(e)) filter (where btrim(e) <> ''), '{public}') into esq from unnest(coalesce(p_esquemas, '{public}')) e;
  if exists (select 1 from unnest(esq) e where e !~ '^[A-Za-z_][A-Za-z0-9_$]{0,62}$') then raise exception 'Nome de esquema inválido' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_conexao, '')), '') is null and not exists (select 1 from interno.infra_bancos_conexao c where c.no_id = p_no) then
    raise exception 'Informe o endereço de conexão do banco' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_conexao, '')), '') is not null and btrim(p_conexao) !~ '^postgres(ql)?://' then
    raise exception 'O endereço precisa começar com postgresql://' using errcode = '22023'; end if;
  insert into public.infra_bancos (no_id, nome, esquemas, ativo) values (p_no, coalesce(nullif(btrim(p_nome), ''), 'Banco de dados'), esq, coalesce(p_ativo, true))
  on conflict (no_id) do update set nome = excluded.nome, esquemas = excluded.esquemas, ativo = excluded.ativo
  returning * into r;
  if nullif(btrim(coalesce(p_conexao, '')), '') is not null then
    insert into interno.infra_bancos_conexao (no_id, conexao) values (p_no, btrim(p_conexao))
    on conflict (no_id) do update set conexao = excluded.conexao, trocado_em = now();
    -- endereço novo: lê de novo na próxima rodada
    update public.infra_bancos set ultimo_hash = null, ultima_leitura_em = null, ultimo_erro = null where no_id = p_no returning * into r;
  end if;
  perform interno.infra_auto_chamar();
  return r;
end $$;

-- desligar: tira o endereço guardado (os desenhos que já saíram ficam)
create or replace function public.infra_banco_remover(p_no uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  delete from public.infra_bancos where no_id = p_no;
end $$;

-- "Atualizar agora": refaz os desenhos do código (último commit do branch principal) e relê o banco
create or replace function public.infra_auto_pedir(p_no uuid) returns public.infra_automacoes
language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.infra_automacoes;
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  select * into r from public.infra_automacoes a where a.no_id = p_no and a.origem = 'manual' and a.status in ('pendente','rodando') limit 1;
  if found then return r; end if;
  insert into public.infra_automacoes (no_id, origem) values (p_no, 'manual') returning * into r;
  perform interno.infra_auto_chamar();
  return r;
end $$;

-- ---------- o que só a função diagramas-auto chama (service_role) ----------
-- pega os próximos pedidos da fila e marca como rodando. Pedido que ficou rodando mais de 15 minutos volta (até 3 vezes).
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
      'repositorios', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'branch', r.branch_principal, 'provedor', r.provedor) order by r.nome), '[]')
                         from public.repositorios r
                        where r.ativo and (case when a.repositorio_id is not null then r.id = a.repositorio_id
                                                else interno.infra_no_de(r.no_id) = a.no_id end)),
      'banco', (select jsonb_build_object('esquemas', b.esquemas, 'conexao', c.conexao)
                  from public.infra_bancos b join interno.infra_bancos_conexao c on c.no_id = b.no_id
                 where b.no_id = a.no_id and b.ativo and a.origem in ('manual','banco'))
    ) order by a.criado_em), '[]') into saida
    from public.infra_automacoes a where a.id = any(coalesce(ids, '{}'));
  return saida;
end $$;

-- bancos que não são lidos há mais de uma hora
create or replace function public.infra_auto_bancos_devidos(p_limite integer default 5) returns jsonb
language sql security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('no_id', b.no_id, 'esquemas', b.esquemas, 'conexao', c.conexao, 'ultimo_hash', b.ultimo_hash)), '[]')
    from (select * from public.infra_bancos b where b.ativo and (b.ultima_leitura_em is null or b.ultima_leitura_em < now() - interval '55 minutes')
           order by b.ultima_leitura_em nulls first limit greatest(1, least(coalesce(p_limite, 5), 20))) b
    join interno.infra_bancos_conexao c on c.no_id = b.no_id
$$;

-- a função leu o banco: guarda o resumo da estrutura; se mudou (e p_abrir), abre um pedido 'banco' já rodando e devolve o id.
-- Dentro de um "Atualizar agora" o pedido já existe: p_abrir = false só guarda o resumo.
create or replace function public.infra_auto_banco_lido(p_no uuid, p_hash text, p_erro text default null, p_abrir boolean default true) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare b public.infra_bancos; novo uuid;
begin
  select * into b from public.infra_bancos where no_id = p_no for update;
  if not found then return null; end if;
  if p_erro is not null then
    update public.infra_bancos set ultima_leitura_em = now(), ultimo_erro = left(p_erro, 1000) where no_id = p_no; return null; end if;
  update public.infra_bancos set ultima_leitura_em = now(), ultimo_erro = null,
         ultimo_hash = p_hash, ultima_mudanca_em = case when b.ultimo_hash is distinct from p_hash then now() else b.ultima_mudanca_em end
   where no_id = p_no;
  if b.ultimo_hash is not distinct from p_hash or not coalesce(p_abrir, true) then return null; end if;
  insert into public.infra_automacoes (no_id, origem, referencia, status, iniciado_em, tentativas, pedido_por)
  values (p_no, 'banco', left(p_hash, 200), 'rodando', now(), 1, null) returning id into novo;
  return novo;
end $$;

-- grava (ou atualiza) um desenho automático. Devolve o id e se precisa gerar a imagem de novo.
create or replace function public.infra_auto_gravar(p_no uuid, p_aba text, p_chave text, p_nome text, p_formato text, p_fonte text,
                                                    p_origem text, p_referencia text, p_evidencias jsonb default '[]', p_lacunas jsonb default '[]')
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.infra_diagramas;
begin
  if p_origem not in ('github','banco') then raise exception 'Origem inválida' using errcode = '22023'; end if;
  if coalesce(btrim(p_chave), '') = '' then raise exception 'Falta a chave do desenho' using errcode = '22023'; end if;
  select * into d from public.infra_diagramas where no_id = p_no and chave_auto = p_chave for update;
  if not found then
    insert into public.infra_diagramas (no_id, aba, nome, formato, fonte, origem, chave_auto, referencia, auto_em, evidencias, lacunas, criado_por)
    values (p_no, p_aba, left(p_nome, 160), p_formato, p_fonte, p_origem, p_chave, left(p_referencia, 200), now(),
            coalesce(p_evidencias, '[]'), coalesce(p_lacunas, '[]'), null)
    returning * into d;
    return jsonb_build_object('id', d.id, 'renderizar', true, 'novo', true);
  end if;
  update public.infra_diagramas set nome = left(p_nome, 160), formato = p_formato, fonte = p_fonte, origem = p_origem, referencia = left(p_referencia, 200),
         auto_em = now(), evidencias = coalesce(p_evidencias, '[]'), lacunas = coalesce(p_lacunas, '[]')
   where id = d.id returning * into d;
  return jsonb_build_object('id', d.id, 'renderizar', d.svg is null, 'novo', false);
end $$;

create or replace function public.infra_auto_imagem(p_id uuid, p_svg text, p_erro text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_erro is not null then update public.infra_diagramas set erro = left(p_erro, 500) where id = p_id and chave_auto is not null;
  else update public.infra_diagramas set svg = p_svg, erro = null, renderizado_em = now() where id = p_id and chave_auto is not null; end if;
end $$;

-- fecha o pedido. Os desenhos automáticos da mesma família (p_prefixos) que não saíram desta vez são arquivados
-- (ex.: uma tabela ou um esquema sumiu, um repositório foi desligado). Arquivar não apaga: o texto fica nas versões.
create or replace function public.infra_auto_concluir(p_id uuid, p_status text, p_erro text, p_diagramas uuid[], p_resumo jsonb, p_prefixos text[] default '{}')
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a public.infra_automacoes;
begin
  if p_status not in ('pronto','erro') then raise exception 'Status inválido' using errcode = '22023'; end if;
  update public.infra_automacoes set status = p_status, concluido_em = now(), erro = left(p_erro, 1000),
         diagramas = coalesce(p_diagramas, '{}'), resumo = coalesce(p_resumo, '[]')
   where id = p_id returning * into a;
  if not found or p_status <> 'pronto' then return; end if;
  update public.infra_diagramas d set arquivado_em = now()
   where d.no_id = a.no_id and d.chave_auto is not null and d.arquivado_em is null
     and not (d.id = any(coalesce(p_diagramas, '{}')))
     and exists (select 1 from unnest(coalesce(p_prefixos, '{}')) px where px <> '' and left(d.chave_auto, length(px)) = px);
end $$;

-- ---------- o quadro de cada desenho ----------
-- Todo desenho automático (e todo desenho do DevIT) aparece como um quadro do canvas da sub-aba (infra_canvas, quadros/auto...),
-- montado com os cards, grupos e ligações do canvas. No quadro principal da sub-aba entra, uma vez só, um card que abre esse quadro.
alter table public.infra_diagramas add column if not exists quadro text check (quadro is null or quadro ~ '^quadros/[A-Za-z0-9_-]{1,80}$');
comment on column public.infra_diagramas.quadro is 'O quadro do canvas onde o desenho está montado (infra_canvas.caminho), para a tela abrir direto nele.';

create or replace function interno.infra_quadro_gravar(p_no uuid, p_aba text, p_chave text, p_nome text, p_doc jsonb, p_diagrama uuid, p_nota text) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare qid text; cam text; raiz jsonb; nx numeric; ny numeric;
begin
  if not interno.infra_no_ok(p_no) then raise exception 'A Infraestrutura fica em projetos e produtos' using errcode = '22023'; end if;
  if not interno.infra_aba_ok(p_aba) then raise exception 'Sub-aba inválida' using errcode = '22023'; end if;
  if coalesce(btrim(p_chave), '') = '' then raise exception 'Falta a chave do quadro' using errcode = '22023'; end if;
  if jsonb_typeof(p_doc -> 'nodes') is distinct from 'array' or jsonb_typeof(p_doc -> 'edges') is distinct from 'array' then raise exception 'Documento de quadro inválido' using errcode = '22023'; end if;
  qid := 'auto' || substr(md5(p_chave), 1, 16); cam := 'quadros/' || qid;
  insert into public.infra_canvas (no_id, aba, caminho, dados, atualizado_por)
  values (p_no, p_aba, cam, jsonb_build_object('nome', left(coalesce(nullif(btrim(p_nome), ''), 'Desenho'), 160), 'pai', 'raiz', 'nodes', p_doc -> 'nodes', 'edges', p_doc -> 'edges',
          'atualizadoEm', (extract(epoch from now()) * 1000)::bigint), interno.pessoa_atual())
  on conflict (no_id, aba, caminho) do update set dados = excluded.dados, atualizado_por = excluded.atualizado_por;
  select dados into raiz from public.infra_canvas where no_id = p_no and aba = p_aba and caminho = 'quadros/raiz' for update;
  raiz := coalesce(raiz, jsonb_build_object('nome', 'Quadro principal', 'pai', null, 'nodes', '[]'::jsonb, 'edges', '[]'::jsonb));
  if not exists (select 1 from jsonb_array_elements(coalesce(raiz -> 'nodes', '[]'::jsonb)) n where n ->> 'quadroId' = qid) then
    select coalesce(max((n ->> 'x')::numeric + coalesce((n ->> 'w')::numeric, 250)) + 80, 0), coalesce(min((n ->> 'y')::numeric), 0) into nx, ny
      from jsonb_array_elements(coalesce(raiz -> 'nodes', '[]'::jsonb)) n where jsonb_typeof(n -> 'x') = 'number';
    raiz := jsonb_set(raiz, '{nodes}', coalesce(raiz -> 'nodes', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'n' || substr(md5('card:' || qid), 1, 14), 'tipo', 'quadro', 'x', round(coalesce(nx, 0) / 20) * 20, 'y', round(coalesce(ny, 0) / 20) * 20, 'w', 260, 'cor', 'ouro',
      'titulo', left(coalesce(nullif(btrim(p_nome), ''), 'Desenho'), 160), 'quadroId', qid, 'nota', coalesce(p_nota, ''))));
    insert into public.infra_canvas (no_id, aba, caminho, dados, atualizado_por) values (p_no, p_aba, 'quadros/raiz', raiz, interno.pessoa_atual())
    on conflict (no_id, aba, caminho) do update set dados = excluded.dados, atualizado_por = excluded.atualizado_por;
  end if;
  if p_diagrama is not null then update public.infra_diagramas set quadro = cam where id = p_diagrama and no_id = p_no and quadro is distinct from cam; end if;
  return cam;
end $$;

-- a função diagramas-auto (service_role) publica o quadro do desenho automático
create or replace function public.infra_auto_quadro(p_no uuid, p_aba text, p_chave text, p_nome text, p_doc jsonb, p_diagrama uuid default null) returns text
language sql security definer set search_path = public, pg_temp as $$
  select interno.infra_quadro_gravar(p_no, p_aba, p_chave, p_nome, p_doc, p_diagrama, 'Montado sozinho a partir do código publicado ou do banco. A próxima atualização refaz este quadro (mantém onde você arrumou os cards, se nada mudou).')
$$;
-- o que o robô já tinha montado (para manter onde a pessoa arrumou os cards)
create or replace function public.infra_auto_quadro_ler(p_no uuid, p_aba text, p_chave text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select dados from public.infra_canvas where no_id = p_no and aba = p_aba and caminho = 'quadros/auto' || substr(md5(p_chave), 1, 16)
$$;
-- a função diagramas (com o login da pessoa) publica o quadro do desenho do DevIT: só quem pode editar o projeto ou produto
create or replace function public.infra_quadro_publicar(p_no uuid, p_aba text, p_chave text, p_nome text, p_doc jsonb, p_diagrama uuid default null) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_no is null or p_no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este projeto ou produto' using errcode = '42501'; end if;
  return interno.infra_quadro_gravar(p_no, p_aba, p_chave, p_nome, p_doc, p_diagrama, 'Montado pelo DevIT a partir das fontes reais. Pedir de novo ao DevIT refaz este quadro.');
end $$;

-- ---------- acesso ----------
alter table public.infra_bancos enable row level security;
alter table public.infra_automacoes enable row level security;
drop policy if exists ver on public.infra_bancos;
create policy ver on public.infra_bancos for select to authenticated using (no_id in (select interno.nos_editaveis()));
drop policy if exists ver on public.infra_automacoes;
create policy ver on public.infra_automacoes for select to authenticated using (no_id in (select interno.nos_visiveis()));

revoke all on public.infra_bancos, public.infra_automacoes from anon, authenticated;
grant select on public.infra_bancos, public.infra_automacoes to authenticated;   -- mudar, só pelas funções acima
grant all on public.infra_bancos, public.infra_automacoes to service_role;

revoke all on function interno.infra_auto_chamar(), interno.infra_no_de(uuid), interno.infra_publicou(), interno.infra_quadro_gravar(uuid, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.infra_auto_quadro(uuid, text, text, text, jsonb, uuid), public.infra_auto_quadro_ler(uuid, text, text), public.infra_quadro_publicar(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.infra_auto_quadro(uuid, text, text, text, jsonb, uuid), public.infra_auto_quadro_ler(uuid, text, text) to service_role;
grant execute on function public.infra_quadro_publicar(uuid, text, text, text, jsonb, uuid) to authenticated, service_role;
revoke all on function public.infra_banco_definir(uuid, text, text[], text, boolean), public.infra_banco_remover(uuid), public.infra_auto_pedir(uuid) from public, anon;
grant execute on function public.infra_banco_definir(uuid, text, text[], text, boolean), public.infra_banco_remover(uuid), public.infra_auto_pedir(uuid) to authenticated;
revoke all on function public.infra_auto_proximos(integer), public.infra_auto_bancos_devidos(integer), public.infra_auto_banco_lido(uuid, text, text, boolean),
                       public.infra_auto_gravar(uuid, text, text, text, text, text, text, text, jsonb, jsonb), public.infra_auto_imagem(uuid, text, text),
                       public.infra_auto_concluir(uuid, text, text, uuid[], jsonb, text[]) from public, anon, authenticated;
grant execute on function public.infra_auto_proximos(integer), public.infra_auto_bancos_devidos(integer), public.infra_auto_banco_lido(uuid, text, text, boolean),
                          public.infra_auto_gravar(uuid, text, text, text, text, text, text, text, jsonb, jsonb), public.infra_auto_imagem(uuid, text, text),
                          public.infra_auto_concluir(uuid, text, text, uuid[], jsonb, text[]) to service_role;
