-- =====================================================================
-- Parte 18: itens mais completos, lixeira e modelos
-- Depende das partes 01 a 17.
--
-- O que entra:
--   1. Item que se repete (recorrencia): quando é concluído, a tela cria o próximo.
--   2. Lembrete no item (lembrete_em): na hora marcada vira aviso no sininho.
--   3. Histórico da descrição (itens_descricao_versoes): cada versão fica guardada,
--      juntando as edições seguidas da mesma pessoa em 10 minutos.
--   4. Lixeira: excluir item, cliente, projeto, produto, aplicação ou frente guarda
--      por 30 dias (excluido_em). Dá para restaurar. Depois de 30 dias, sai de vez.
--   5. Modelos (modelos): item pronto e estrutura pronta (projeto, produto,
--      aplicação ou frente, com o que tem dentro), para criar a partir deles.
--
-- Regras de acesso: as mesmas do resto. Mexe na lixeira quem pode editar o ponto.
-- Modelos são do espaço de quem criou.
-- =====================================================================

-- ---------- 1. colunas novas ----------
alter table public.itens
  add column if not exists recorrencia jsonb,
  add column if not exists lembrete_em timestamptz,
  add column if not exists lembrete_para uuid references public.pessoas(id) on delete set null,
  add column if not exists lembrete_enviado_em timestamptz,
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.pessoas(id) on delete set null;
alter table public.nos
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references public.pessoas(id) on delete set null;

comment on column public.itens.recorrencia is 'Repetição: {"freq":"dia|semana|mes|ano","a_cada":1,"ate":"2027-01-31"}. Quando o item é concluído, a tela cria o próximo e passa a repetição para ele.';
comment on column public.itens.lembrete_em is 'Quando lembrar. Na hora, vira aviso para lembrete_para (rotina a cada minuto).';
comment on column public.itens.excluido_em is 'Na lixeira desde. Some das telas; sai de vez 30 dias depois.';
comment on column public.nos.excluido_em is 'Na lixeira desde (com tudo o que tem dentro). Sai de vez 30 dias depois.';

do $$ begin
  alter table public.itens add constraint itens_recorrencia_ok check (recorrencia is null or (
    jsonb_typeof(recorrencia) = 'object' and recorrencia->>'freq' in ('dia','semana','mes','ano')
    and coalesce(recorrencia->>'a_cada', '1') ~ '^[1-9][0-9]{0,2}$'
    and (recorrencia->>'ate' is null or recorrencia->>'ate' ~ '^\d{4}-\d{2}-\d{2}$')));
exception when duplicate_object then null; end $$;

create index if not exists itens_lembrete_idx on public.itens (lembrete_em) where lembrete_em is not null and lembrete_enviado_em is null;
create index if not exists itens_excluido_idx on public.itens (excluido_em) where excluido_em is not null;
create index if not exists nos_excluido_idx on public.nos (excluido_em) where excluido_em is not null;

-- lembrete: ao mudar a hora, volta a valer; se ninguém foi escolhido, lembra quem marcou
create or replace function interno.itens_lembrete() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or new.lembrete_em is distinct from old.lembrete_em then
    new.lembrete_enviado_em := null;
    if new.lembrete_em is not null and new.lembrete_para is null then new.lembrete_para := interno.pessoa_atual(); end if;
  end if;
  return new;
end $$;
drop trigger if exists itens_lembrete on public.itens;
create trigger itens_lembrete before insert or update of lembrete_em, lembrete_para on public.itens for each row execute function interno.itens_lembrete();

-- item na lixeira não aparece para ninguém (a lixeira lê pelo servidor)
drop policy if exists ver on public.itens;
create policy ver on public.itens for select to authenticated using (
  excluido_em is null and frente_id in (select interno.nos_visiveis()) and (visivel_cliente or not (select interno.eh_stakeholder())));

-- ---------- 2. histórico da descrição ----------
create table if not exists public.itens_descricao_versoes (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.itens(id) on delete cascade,
  texto     text not null default '',
  autor_id  uuid references public.pessoas(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists itens_descricao_versoes_idx on public.itens_descricao_versoes (item_id, criado_em desc);
comment on table public.itens_descricao_versoes is 'Cada versão da descrição de um item. Quem mexe seguido (até 10 minutos) fica numa versão só.';

create or replace function interno.itens_guardar_descricao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); ult record;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.descricao, '') <> '' then insert into public.itens_descricao_versoes (item_id, texto, autor_id) values (new.id, new.descricao, eu); end if;
    return null;
  end if;
  if new.descricao is not distinct from old.descricao then return null; end if;
  -- item antigo, sem histórico ainda: guarda primeiro como estava
  if coalesce(old.descricao, '') <> '' and not exists (select 1 from public.itens_descricao_versoes v where v.item_id = new.id) then
    insert into public.itens_descricao_versoes (item_id, texto, autor_id, criado_em) values (new.id, old.descricao, null, coalesce(old.atualizado_em, now()) - interval '1 second');
  end if;
  select v.id, v.autor_id, v.criado_em into ult from public.itens_descricao_versoes v where v.item_id = new.id order by v.criado_em desc limit 1;
  if ult.id is not null and ult.autor_id is not distinct from eu and ult.criado_em > now() - interval '10 minutes' then
    update public.itens_descricao_versoes set texto = coalesce(new.descricao, ''), criado_em = now() where id = ult.id;
  else
    insert into public.itens_descricao_versoes (item_id, texto, autor_id) values (new.id, coalesce(new.descricao, ''), eu);
  end if;
  return null;
end $$;
drop trigger if exists itens_descricao_versoes on public.itens;
create trigger itens_descricao_versoes after insert or update of descricao on public.itens for each row execute function interno.itens_guardar_descricao();

alter table public.itens_descricao_versoes enable row level security;
drop policy if exists ver on public.itens_descricao_versoes;
create policy ver on public.itens_descricao_versoes for select to authenticated using (exists (select 1 from public.itens i where i.id = item_id));
revoke all on public.itens_descricao_versoes from anon, authenticated;
grant select on public.itens_descricao_versoes to authenticated;   -- só o gatilho grava

-- ---------- 3. modelos ----------
create table if not exists public.modelos (
  id            uuid primary key default gen_random_uuid(),
  espaco_id     uuid not null default interno.meu_espaco() references public.espacos(id) on delete cascade,
  tipo          text not null check (tipo in ('item','estrutura')),
  nivel         text check (nivel in ('projeto','produto','aplicacao','frente')),
  nome          text not null check (length(btrim(nome)) between 1 and 120),
  descricao     text,
  conteudo      jsonb not null default '{}'::jsonb,
  criado_por    uuid default interno.pessoa_atual() references public.pessoas(id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint modelos_nivel_ok check ((tipo = 'estrutura') = (nivel is not null)),
  constraint modelos_tamanho_ok check (pg_column_size(conteudo) < 800000)
);
create index if not exists modelos_espaco_idx on public.modelos (espaco_id, tipo, nome);
comment on table public.modelos is 'Modelos prontos: um item (com checklist e subitens) ou uma estrutura (projeto, produto, aplicação ou frente com o que tem dentro).';
alter table public.modelos enable row level security;
drop policy if exists ver on public.modelos; drop policy if exists cria on public.modelos; drop policy if exists muda on public.modelos; drop policy if exists apaga on public.modelos;
create policy ver on public.modelos for select to authenticated using (espaco_id in (select interno.meus_espacos()));
create policy cria on public.modelos for insert to authenticated with check (espaco_id in (select interno.meus_espacos()));
create policy muda on public.modelos for update to authenticated using (espaco_id in (select interno.meus_espacos())) with check (espaco_id in (select interno.meus_espacos()));
create policy apaga on public.modelos for delete to authenticated using (espaco_id in (select interno.meus_espacos()));
revoke all on public.modelos from anon, authenticated;
grant select, insert, update, delete on public.modelos to authenticated;

create or replace function interno.modelos_tocar() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists modelos_tocar on public.modelos;
create trigger modelos_tocar before update on public.modelos for each row execute function interno.modelos_tocar();

-- ---------- 4. lixeira ----------
-- pode mexer no ponto: é do meu espaço, ou está dentro de algo compartilhado comigo como owner ou dev
-- (o ponto compartilhado em si só quem é dono do espaço exclui, como na regra de apagar da parte 15)
create or replace function interno.pode_excluir_no(p_no uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.nos n where n.id = p_no and n.espaco_id in (select interno.meus_espacos()))
      or exists (select 1 from interno.minhas_participacoes() p join public.nos_ancestrais a on a.ancestral_id = p.no_id
                  where a.no_id = p_no and a.distancia > 0 and p.papel in ('owner','dev'))
$$;
-- o ponto está escondido por estar dentro de algo na lixeira (ou nele mesmo)?
create or replace function interno.no_na_lixeira(p_no uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select n.nome from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
   where a.no_id = p_no and n.excluido_em is not null order by a.distancia desc limit 1
$$;

create or replace function public.lixeira_mover(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); agora timestamptz := now(); fr uuid;
begin
  if eu is null then raise exception 'Entre no sistema para excluir.'; end if;
  if p_tipo = 'item' then
    select frente_id into fr from public.itens where id = p_id and excluido_em is null;
    if fr is null then raise exception 'Item não encontrado ou já está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode excluir este item.'; end if;
    -- o item e tudo o que está dentro dele (subitens) vão juntos, com a mesma hora
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id where i.excluido_em is null)
    update public.itens set excluido_em = agora, excluido_por = eu where id in (select id from sub);
  elsif p_tipo = 'no' then
    if not exists (select 1 from public.nos where id = p_id and excluido_em is null) then raise exception 'Não encontrado ou já está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode excluir este ponto da estrutura.'; end if;
    update public.nos set excluido_em = agora, excluido_por = eu where id = p_id;
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $$;

create or replace function public.lixeira_restaurar(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare quando timestamptz; fr uuid; pai uuid; acima text;
begin
  if interno.pessoa_atual() is null then raise exception 'Entre no sistema para restaurar.'; end if;
  if p_tipo = 'item' then
    select excluido_em, frente_id, pai_id into quando, fr, pai from public.itens where id = p_id;
    if quando is null then raise exception 'Este item não está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode restaurar este item.'; end if;
    acima := interno.no_na_lixeira(fr);
    if acima is not null then raise exception 'Restaure antes "%", que também está na lixeira.', acima; end if;
    if pai is not null and exists (select 1 from public.itens where id = pai and excluido_em is not null) then
      raise exception 'Restaure antes o item de cima, que também está na lixeira.'; end if;
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id where i.excluido_em = quando)
    update public.itens set excluido_em = null, excluido_por = null where id in (select id from sub);
  elsif p_tipo = 'no' then
    select excluido_em into quando from public.nos where id = p_id;
    if quando is null then raise exception 'Este ponto não está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode restaurar este ponto da estrutura.'; end if;
    select n.nome into acima from public.nos_ancestrais a join public.nos n on n.id = a.ancestral_id
     where a.no_id = p_id and a.distancia > 0 and n.excluido_em is not null order by a.distancia desc limit 1;
    if acima is not null then raise exception 'Restaure antes "%", que também está na lixeira.', acima; end if;
    update public.nos set excluido_em = null, excluido_por = null where id = p_id;
  else raise exception 'Tipo inválido: %', p_tipo; end if;
end $$;

-- apaga de verdade (sem volta). Usada pela tela ("Apagar de vez") e pela limpeza de 30 dias.
create or replace function interno.lixeira_apagar_sem_conferir(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if p_tipo = 'item' then
    with recursive sub as (select p_id as id union all select i.id from public.itens i join sub on i.pai_id = sub.id)
    delete from public.itens where id in (select id from sub);
  else
    -- itens das frentes, custos, receitas e pedidos que ficam dentro; depois os pontos, do mais fundo para cima
    delete from public.itens where frente_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    delete from public.custos_tecnicos where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    delete from public.receitas where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    delete from public.pedidos where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    update public.dominios set no_id = null where no_id in (select no_id from public.nos_ancestrais where ancestral_id = p_id);
    for r in select no_id from public.nos_ancestrais where ancestral_id = p_id order by distancia desc loop
      delete from public.nos where id = r.no_id;
    end loop;
  end if;
end $$;

create or replace function public.lixeira_apagar(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare fr uuid;
begin
  if interno.pessoa_atual() is null then raise exception 'Entre no sistema.'; end if;
  if p_tipo = 'item' then
    select frente_id into fr from public.itens where id = p_id and excluido_em is not null;
    if fr is null then raise exception 'Só dá para apagar de vez o que está na lixeira.'; end if;
    if fr not in (select interno.nos_editaveis()) then raise exception 'Você não pode apagar este item.'; end if;
  elsif p_tipo = 'no' then
    if not exists (select 1 from public.nos where id = p_id and excluido_em is not null) then raise exception 'Só dá para apagar de vez o que está na lixeira.'; end if;
    if not interno.pode_excluir_no(p_id) then raise exception 'Você não pode apagar este ponto da estrutura.'; end if;
  else raise exception 'Tipo inválido: %', p_tipo; end if;
  perform interno.lixeira_apagar_sem_conferir(p_tipo, p_id);
end $$;

-- o que está na lixeira e eu posso ver: só o que foi excluído diretamente (o que estava dentro vai junto)
create or replace function public.lixeira_listar() returns table (
  tipo text, id uuid, nome text, onde text, excluido_em timestamptz, excluido_por text, dentro integer, apaga_em timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select n.tipo, n.id, n.nome,
         (select string_agg(x.nome, ' › ' order by a.distancia desc) from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = n.id and a.distancia > 0),
         n.excluido_em, p.nome,
         ((select count(*) from public.nos_ancestrais a where a.ancestral_id = n.id and a.distancia > 0)
          + (select count(*) from public.itens i where i.frente_id in (select a.no_id from public.nos_ancestrais a where a.ancestral_id = n.id)))::integer,
         n.excluido_em + interval '30 days'
    from public.nos n left join public.pessoas p on p.id = n.excluido_por
   where n.excluido_em is not null and n.id in (select interno.nos_visiveis()) and interno.pode_excluir_no(n.id)
  union all
  select 'item', i.id, i.titulo,
         (select string_agg(x.nome, ' › ' order by a.distancia desc) from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = i.frente_id),
         i.excluido_em, p.nome,
         (select count(*) from public.itens f where f.excluido_em = i.excluido_em and f.id <> i.id and f.frente_id = i.frente_id)::integer,
         i.excluido_em + interval '30 days'
    from public.itens i left join public.pessoas p on p.id = i.excluido_por
   where i.excluido_em is not null and i.frente_id in (select interno.nos_editaveis())
     and not exists (select 1 from public.itens pai where pai.id = i.pai_id and pai.excluido_em = i.excluido_em)
   order by 5 desc
$$;

-- limpeza: o que está na lixeira há mais de 30 dias sai de vez
create or replace function interno.lixeira_limpar() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in select n2.id from public.nos n2 where n2.excluido_em < now() - interval '30 days'
            and not exists (select 1 from public.nos_ancestrais a join public.nos x on x.id = a.ancestral_id where a.no_id = n2.id and a.distancia > 0 and x.excluido_em is not null) loop
    perform interno.lixeira_apagar_sem_conferir('no', r.id); n := n + 1;
  end loop;
  for r in select i.id from public.itens i where i.excluido_em < now() - interval '30 days'
            and not exists (select 1 from public.itens p where p.id = i.pai_id and p.excluido_em is not null) loop
    perform interno.lixeira_apagar_sem_conferir('item', r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- lembretes: na hora marcada, aviso no sininho de quem pediu
create or replace function interno.enviar_lembretes() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  with vence as (
    select i.id, i.titulo, i.lembrete_para from public.itens i
     where i.lembrete_em <= now() and i.lembrete_enviado_em is null and i.excluido_em is null and i.lembrete_para is not null
     for update skip locked),
  aviso as (insert into public.notificacoes (pessoa_id, titulo, texto, item_id)
            select v.lembrete_para, 'Lembrete: ' || v.titulo, 'Você pediu para ser lembrado deste item agora.', v.id from vence v returning 1)
  update public.itens set lembrete_enviado_em = now() where id in (select id from vence);
  get diagnostics n = row_count;
  return n;
end $$;

-- prazo vencido: item na lixeira não dispara automação
create or replace function interno.automacoes_prazo_vencido() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer := 0; r record;
begin
  for r in select s.id from bi.itens_situacao s join public.itens i on i.id = s.id
            where s.grupo <> 'done' and s.prazo = bi.hoje() - 1 and i.excluido_em is null and interno.no_na_lixeira(i.frente_id) is null loop
    perform interno.rodar_automacoes(r.id, 'prazo_vencido'); n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.lixeira_mover(text, uuid), public.lixeira_restaurar(text, uuid), public.lixeira_apagar(text, uuid), public.lixeira_listar() from public, anon;
grant execute on function public.lixeira_mover(text, uuid), public.lixeira_restaurar(text, uuid), public.lixeira_apagar(text, uuid), public.lixeira_listar() to authenticated;
revoke all on function interno.lixeira_apagar_sem_conferir(text, uuid), interno.lixeira_limpar(), interno.enviar_lembretes() from public, anon, authenticated;
grant execute on function interno.pode_excluir_no(uuid), interno.no_na_lixeira(uuid) to authenticated;

-- rotinas (só no Supabase, onde existe pg_cron)
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname in ('ciclodev_lembretes', 'ciclodev_lixeira');
    perform cron.schedule('ciclodev_lembretes', '* * * * *', 'select interno.enviar_lembretes()');
    perform cron.schedule('ciclodev_lixeira', '23 4 * * *', 'select interno.lixeira_limpar()');
  end if;
end $$;
