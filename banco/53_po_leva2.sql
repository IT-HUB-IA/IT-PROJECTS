-- CicloDev · 53 · Segunda leva do P.O. (pedido-melhorias-ciclodev-2).
--   * itens_criterios: a prova de cada critério (quem testou, quando, resultado e a prova em texto, link ou anexo).
--   * frentes.definicao_pronto: a Definição de Pronto de cada frente, somada à comum do projeto.
--   * itens.auto_origem: de onde veio cada preenchimento automático (prazo padrão, situação inicial do lote...).
--   * itens.revisar: o item ficou para revisar porque uma decisão mudou (motivo, decisão, quando e quem).
--   * itens.decisao_texto / decisao_por / decisao_em: o texto da decisão quando ela foi fechada, quem e quando.
--   Tudo entra no histórico do item (itens_historico), com quem fez e quando.
-- Pode rodar de novo sem estragar nada.

alter table public.itens_criterios add column if not exists prova text check (prova is null or length(prova) <= 2000);
alter table public.itens_criterios add column if not exists prova_quem uuid references public.pessoas(id) on delete set null;
alter table public.itens_criterios add column if not exists prova_em date;
alter table public.itens_criterios add column if not exists prova_resultado text check (prova_resultado is null or prova_resultado in ('passou','falhou','parcial'));
comment on column public.itens_criterios.prova is 'O que prova o critério: resultado do teste, link ou anexo:<id do anexo do item>.';

alter table public.frentes add column if not exists definicao_pronto text check (definicao_pronto is null or length(definicao_pronto) <= 3000);
comment on column public.frentes.definicao_pronto is 'Regras de pronto só desta frente (somam à Definição de Pronto comum do projeto).';

alter table public.itens add column if not exists auto_origem jsonb;
alter table public.itens add column if not exists revisar jsonb;
alter table public.itens add column if not exists decisao_texto text check (decisao_texto is null or length(decisao_texto) <= 4000);
alter table public.itens add column if not exists decisao_por uuid references public.pessoas(id) on delete set null;
alter table public.itens add column if not exists decisao_em timestamptz;
comment on column public.itens.auto_origem is 'De onde veio cada preenchimento automático: {"prazo": "...", "situacao": "..."}.';
comment on column public.itens.revisar is 'Marcado para revisar quando uma decisão mudou: {"motivo","decisao","em","por"}. Vazio: nada a revisar.';

-- ---------- histórico: preenchimento automático ao criar, revisar e decisão ----------
create or replace function interno.po_historico_leva2() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare quem uuid := interno.pessoa_atual(); k text; partes text[] := '{}';
begin
  if tg_op = 'INSERT' then
    if new.auto_origem is not null and jsonb_typeof(new.auto_origem) = 'object' then
      for k in select jsonb_object_keys(new.auto_origem) loop
        partes := array_append(partes, (case k when 'prazo' then 'prazo' when 'situacao' then 'situação' when 'responsavel' then 'responsável' else k end) || ': ' || left(new.auto_origem ->> k, 300));
      end loop;
      if array_length(partes, 1) > 0 then
        insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'edicao', null, null, left('Preenchido automaticamente ao criar · ' || array_to_string(partes, '; '), 2000), quem);
      end if;
    end if;
    return null;
  end if;
  if new.revisar is distinct from old.revisar then
    if new.revisar is not null then
      insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'edicao', null, null, left('Marcado para revisar: ' || coalesce(new.revisar ->> 'motivo', 'uma decisão mudou'), 2000), quem);
    elsif old.revisar is not null then
      insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'edicao', null, null, left('Revisado (era: ' || coalesce(old.revisar ->> 'motivo', 'decisão mudou') || ')', 2000), quem);
    end if;
  end if;
  if new.decisao_texto is distinct from old.decisao_texto and new.decisao_texto is not null then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'edicao', null, null, left(case when old.decisao_texto is null then 'Decisão registrada: ' else 'Decisão mudou: ' end || new.decisao_texto, 2000), quem);
  end if;
  return null;
end $$;
revoke all on function interno.po_historico_leva2() from public, anon;
create or replace trigger itens_po_historico_leva2 after insert or update of revisar, decisao_texto on public.itens for each row execute function interno.po_historico_leva2();

-- quem registra a decisão e quando: o banco carimba (a tela não escolhe)
create or replace function interno.po_carimbar_decisao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.decisao_texto is distinct from (case when tg_op = 'UPDATE' then old.decisao_texto else null end) then
    new.decisao_por := coalesce(interno.pessoa_atual(), new.decisao_por); new.decisao_em := now();
  elsif tg_op = 'UPDATE' then new.decisao_por := old.decisao_por; new.decisao_em := old.decisao_em;
  end if;
  return new;
end $$;
revoke all on function interno.po_carimbar_decisao() from public, anon;
create or replace trigger itens_po_carimbar_decisao before insert or update of decisao_texto, decisao_por, decisao_em on public.itens for each row execute function interno.po_carimbar_decisao();

-- ---------- critérios: a prova entra no histórico (a regra do item aceito continua: texto e marcado não mudam; a prova pode entrar depois) ----------
create or replace function interno.po_historico_criterio() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op not in ('INSERT', 'UPDATE') then   -- o critério saiu
    if exists (select 1 from public.itens where id = old.item_id) then
      insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (old.item_id, 'criterio', old.texto, null, 'tirou', interno.pessoa_atual());
    end if;
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', null, new.texto, case when new.feito then 'criou marcado' else 'criou' end, interno.pessoa_atual());
  elsif new.feito is distinct from old.feito then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', null, new.texto, case when new.feito then 'marcou' else 'desmarcou' end, interno.pessoa_atual());
  elsif new.texto is distinct from old.texto then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', old.texto, new.texto, 'mudou o texto', interno.pessoa_atual());
  end if;
  if tg_op = 'INSERT' and new.prova is not null or tg_op = 'UPDATE' and (new.prova is distinct from old.prova or new.prova_resultado is distinct from old.prova_resultado or new.prova_quem is distinct from old.prova_quem or new.prova_em is distinct from old.prova_em) then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.item_id, 'criterio', null, new.texto,
      left('prova: ' || coalesce(case new.prova_resultado when 'passou' then 'passou' when 'falhou' then 'falhou' when 'parcial' then 'parcial' end || ' · ', '') || coalesce(new.prova, '(sem prova)'), 2000), interno.pessoa_atual());
  end if;
  return null;
end $$;
