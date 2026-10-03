-- =====================================================================
-- PREPARADO, NÃO APLICADO. Ordem de serviço do banco nº1, item O1. Só rodar com ordem escrita do dono.
-- Hoje a regra do banco (interno.validar_pai, parte 01) aceita aplicação direto no projeto, de propósito.
-- Esta parte deixa a árvore estrita: cliente > projeto > produto > aplicação > frente.
-- Antes, o dono decide o que fazer com as aplicações que hoje estão direto num projeto (em 03/10/2026 eram 3):
--   ou cria/escolhe um produto para cada uma e move (mover_no), ou vira produto. Enquanto existir alguma, esta parte para.
-- =====================================================================
do $$
declare lista text;
begin
  select string_agg(n.nome || ' (no projeto ' || p.nome || ')', '; ') into lista
    from public.nos n join public.nos p on p.id = n.pai_id where n.tipo = 'aplicacao' and p.tipo = 'projeto';
  if lista is not null then raise exception 'Mova antes estas aplicações para dentro de um produto: %', lista; end if;
end $$;

create or replace function interno.validar_pai() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare tipo_pai text;
begin
  if new.pai_id is null then return new; end if;
  select tipo into tipo_pai from public.nos where id = new.pai_id;
  if not ((new.tipo = 'projeto' and tipo_pai = 'cliente') or (new.tipo = 'produto' and tipo_pai = 'projeto')
       or (new.tipo = 'aplicacao' and tipo_pai = 'produto') or (new.tipo = 'frente' and tipo_pai = 'aplicacao')) then
    raise exception 'Um % não pode ficar dentro de um %', new.tipo, tipo_pai using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.tipo <> old.tipo then raise exception 'O tipo de um registro da estrutura não muda' using errcode = '23514'; end if;
  return new;
end $$;
