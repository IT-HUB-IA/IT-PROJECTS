-- =====================================================================
-- CicloDev · 29 · Infraestrutura: desenhos do sistema como código (projeto = macro, produto = micro)
--
-- Cada projeto e cada produto tem a aba Infraestrutura com 10 sub-abas (a coluna "aba"):
--   solucao      Arquitetura de Solução        (Structurizr DSL, visão C4 de contexto e containers)
--   software     Arquitetura de Software       (PlantUML de componentes e módulos)
--   dominio      Modelo de Domínio             (PlantUML de classes e entidades)
--   der          DER / Banco de Dados          (DBML)
--   processos    Fluxos de Processo            (Mermaid)
--   sequencias   Diagramas de Sequência        (PlantUML)
--   infra        Arquitetura de Infraestrutura (Graphviz do Terraform, ou Structurizr)
--   seguranca    Arquitetura de Segurança      (Structurizr DSL com fronteiras de confiança)
--   ux           Fluxos de Usuário             (Mermaid)
--   prototipos   Protótipos de Interface       (especificação em Markdown e links do Figma)
--
--   infra_canvas            o quadro (canvas) de cada sub-aba: os documentos que o canvas grava (quadros/<id>, meta/eventos)
--   infra_diagramas         cada desenho: o texto (a fonte de verdade), a imagem gerada, de onde veio a evidência
--   infra_diagramas_versoes toda vez que o texto muda, a versão anterior fica guardada (nunca se perde)
--   infra_geracoes          cada pedido ao DevIT para gerar ou atualizar desenhos, com o resultado
--
-- Quem enxerga o projeto ou produto enxerga os desenhos; quem pode editar o nó pode mexer.
-- Depende das partes 01, 14 e 15.
-- =====================================================================

create or replace function interno.infra_aba_ok(a text) returns boolean
language sql immutable as $$ select a in ('solucao','software','dominio','der','processos','sequencias','infra','seguranca','ux','prototipos') $$;

-- só projeto e produto têm a aba
create or replace function interno.infra_no_ok(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$ select exists (select 1 from public.nos where id = p and tipo in ('projeto','produto')) $$;

create table if not exists public.infra_canvas (
  no_id          uuid not null references public.nos(id) on delete cascade,
  aba            text not null check (interno.infra_aba_ok(aba)),
  caminho        text not null check (caminho ~ '^[a-z]+/[A-Za-z0-9_-]{1,80}$'),
  dados          jsonb not null default '{}'::jsonb check (pg_column_size(dados) <= 600000),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  primary key (no_id, aba, caminho)
);
comment on table public.infra_canvas is 'O canvas de cada sub-aba da Infraestrutura: cada linha é um documento que o canvas grava (quadros/<id> com cards e ligações, meta/eventos).';

create table if not exists public.infra_diagramas (
  id             uuid primary key default gen_random_uuid(),
  no_id          uuid not null references public.nos(id) on delete cascade,
  aba            text not null check (interno.infra_aba_ok(aba)),
  nome           text not null check (length(btrim(nome)) between 1 and 160),
  formato        text not null check (formato in ('structurizr','plantuml','dbml','mermaid','graphviz','c4plantuml','markdown')),
  fonte          text not null default '' check (length(fonte) <= 200000),
  svg            text check (svg is null or length(svg) <= 3000000),
  erro           text,
  origem         text not null default 'manual' check (origem in ('manual','devit')),
  evidencias     jsonb not null default '[]'::jsonb check (jsonb_typeof(evidencias) = 'array' and pg_column_size(evidencias) <= 200000),
  lacunas        jsonb not null default '[]'::jsonb check (jsonb_typeof(lacunas) = 'array'),
  links          jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'),
  versao         integer not null default 1,
  renderizado_em timestamptz,
  criado_por     uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  arquivado_em   timestamptz
);
create index if not exists infra_diagramas_no_idx on public.infra_diagramas (no_id, aba);
comment on table public.infra_diagramas is 'Desenhos do sistema como código. fonte é a fonte de verdade (.dsl, .puml, .dbml, .mmd, .dot, .md); svg é a imagem gerada pelo conversor. evidencias diz de onde cada parte veio (arquivo, tabela, item).';

create table if not exists public.infra_diagramas_versoes (
  diagrama_id uuid not null references public.infra_diagramas(id) on delete cascade,
  versao      integer not null,
  fonte       text not null,
  svg         text,
  origem      text not null,
  evidencias  jsonb not null default '[]'::jsonb,
  autor       uuid references public.pessoas(id) on delete set null,
  criado_em   timestamptz not null default now(),
  primary key (diagrama_id, versao)
);
comment on table public.infra_diagramas_versoes is 'Cada versão anterior do texto de um desenho. Só cresce: ninguém muda nem apaga pela tela.';

create table if not exists public.infra_geracoes (
  id           uuid primary key default gen_random_uuid(),
  no_id        uuid not null references public.nos(id) on delete cascade,
  aba          text not null check (interno.infra_aba_ok(aba)),
  status       text not null default 'pedido' check (status in ('pedido','gerando','pronto','erro')),
  pedido_por   uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  pedido_em    timestamptz not null default now(),
  concluido_em timestamptz,
  diagramas    uuid[] not null default '{}',
  fontes_lidas jsonb not null default '[]'::jsonb,
  erro         text
);
create index if not exists infra_geracoes_no_idx on public.infra_geracoes (no_id, aba, pedido_em desc);
comment on table public.infra_geracoes is 'Cada pedido ao DevIT para gerar ou atualizar os desenhos de uma sub-aba, com as fontes que ele leu e o que saiu.';

-- nada de aba em nó que não é projeto nem produto
create or replace function interno.infra_conferir_no() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if not interno.infra_no_ok(new.no_id) then raise exception 'A Infraestrutura fica em projetos e produtos' using errcode = '22023'; end if;
  return new;
end $$;
drop trigger if exists infra_canvas_no on public.infra_canvas;
create trigger infra_canvas_no before insert or update of no_id on public.infra_canvas for each row execute function interno.infra_conferir_no();
drop trigger if exists infra_diagramas_no on public.infra_diagramas;
create trigger infra_diagramas_no before insert or update of no_id on public.infra_diagramas for each row execute function interno.infra_conferir_no();
drop trigger if exists infra_geracoes_no on public.infra_geracoes;
create trigger infra_geracoes_no before insert on public.infra_geracoes for each row execute function interno.infra_conferir_no();

drop trigger if exists infra_canvas_carimbo on public.infra_canvas;
create trigger infra_canvas_carimbo before update on public.infra_canvas for each row execute function interno.carimbar_atualizacao();

-- o texto mudou: guarda a versão anterior e sobe o número; a imagem antiga deixa de valer até gerar de novo
create or replace function interno.infra_versionar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.atualizado_em := now();
  if new.fonte is distinct from old.fonte then
    insert into public.infra_diagramas_versoes (diagrama_id, versao, fonte, svg, origem, evidencias, autor)
    values (old.id, old.versao, old.fonte, old.svg, old.origem, old.evidencias, interno.pessoa_atual())
    on conflict (diagrama_id, versao) do nothing;
    new.versao := old.versao + 1;
    if new.svg is not distinct from old.svg then new.svg := null; new.renderizado_em := null; end if;
  end if;
  if new.id <> old.id or new.criado_em <> old.criado_em or new.criado_por is distinct from old.criado_por then
    raise exception 'Não dá para trocar quem criou o desenho' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists infra_diagramas_versao on public.infra_diagramas;
create trigger infra_diagramas_versao before update on public.infra_diagramas for each row execute function interno.infra_versionar();

alter table public.infra_canvas enable row level security;
alter table public.infra_diagramas enable row level security;
alter table public.infra_diagramas_versoes enable row level security;
alter table public.infra_geracoes enable row level security;

drop policy if exists ver on public.infra_canvas;
create policy ver on public.infra_canvas for select to authenticated using (no_id in (select interno.nos_visiveis()));
drop policy if exists mexe on public.infra_canvas;
create policy mexe on public.infra_canvas for all to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

drop policy if exists ver on public.infra_diagramas;
create policy ver on public.infra_diagramas for select to authenticated using (no_id in (select interno.nos_visiveis()));
drop policy if exists cria on public.infra_diagramas;
create policy cria on public.infra_diagramas for insert to authenticated with check (no_id in (select interno.nos_editaveis()));
drop policy if exists muda on public.infra_diagramas;
create policy muda on public.infra_diagramas for update to authenticated using (no_id in (select interno.nos_editaveis())) with check (no_id in (select interno.nos_editaveis()));

drop policy if exists ver on public.infra_diagramas_versoes;
create policy ver on public.infra_diagramas_versoes for select to authenticated
  using (exists (select 1 from public.infra_diagramas d where d.id = diagrama_id and d.no_id in (select interno.nos_visiveis())));

drop policy if exists ver on public.infra_geracoes;
create policy ver on public.infra_geracoes for select to authenticated using (no_id in (select interno.nos_visiveis()));
drop policy if exists cria on public.infra_geracoes;
create policy cria on public.infra_geracoes for insert to authenticated with check (no_id in (select interno.nos_editaveis()) and pedido_por = (select interno.pessoa_atual()));

revoke all on public.infra_canvas, public.infra_diagramas, public.infra_diagramas_versoes, public.infra_geracoes from anon, authenticated;
grant select, insert, update, delete on public.infra_canvas to authenticated;
grant select, insert, update on public.infra_diagramas to authenticated;   -- apagar = arquivar (arquivado_em); o texto antigo fica nas versões
grant select on public.infra_diagramas_versoes to authenticated;
grant select, insert on public.infra_geracoes to authenticated;
grant all on public.infra_canvas, public.infra_diagramas, public.infra_diagramas_versoes, public.infra_geracoes to service_role;

revoke all on function interno.infra_conferir_no(), interno.infra_versionar() from public, anon, authenticated;
grant execute on function interno.infra_aba_ok(text), interno.infra_no_ok(uuid) to authenticated, service_role;
