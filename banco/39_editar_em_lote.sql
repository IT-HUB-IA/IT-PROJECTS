-- Parte 39: Editar em lote e Tarefa externa. 01/10/2026.
-- 1. itens.externa: a Tarefa externa (algo que não é desenvolvimento, como marcar um vínculo em outro sistema).
--    Fica com tipo 'task' e externa = true; não conta nos pontos da versão.
-- 2. O histórico passa a guardar também as edições (tipo 'edicao'): título, história, prioridade, nível, valor, pontos,
--    tipo, responsável, prazo, épico, versão, frente, arquivado e cancelado. Gravado pelo gatilho; só leitura para a tela.
alter table public.itens add column if not exists externa boolean not null default false;
comment on column public.itens.externa is 'Tarefa externa: não é desenvolvimento (tipo task). Não conta nos pontos da versão';

alter table public.itens_historico drop constraint if exists itens_historico_tipo_check;
alter table public.itens_historico add constraint itens_historico_tipo_check check (tipo in ('situacao','criterio','edicao'));

create or replace function interno.po_historico_edicao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare partes text[] := '{}';
  c text;
  f constant text[] := array['titulo','historia_quem','historia_quero','historia_para','moscow','nivel','valor','pontos','tipo','melhoria','externa','responsavel_id','prazo','pai_id','marco_id','frente_id','arquivado_em','resolucao'];
  rot constant jsonb := '{"titulo":"título","historia_quem":"como","historia_quero":"quero","historia_para":"para","moscow":"prioridade","nivel":"nível","valor":"valor","pontos":"pontos","tipo":"tipo","melhoria":"melhoria","externa":"tarefa externa","responsavel_id":"responsável","prazo":"prazo","pai_id":"épico","marco_id":"versão","frente_id":"frente","arquivado_em":"arquivado","resolucao":"resolução"}';
  a text; b text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  foreach c in array f loop
    a := vo ->> c; b := vn ->> c;
    if a is distinct from b then
      if c = 'responsavel_id' then a := (select nome from public.pessoas where id = a::uuid); b := (select nome from public.pessoas where id = b::uuid); end if;
      if c in ('pai_id') then a := (select titulo from public.itens where id = a::uuid); b := (select titulo from public.itens where id = b::uuid); end if;
      if c = 'marco_id' then a := (select nome from public.marcos where id = a::uuid); b := (select nome from public.marcos where id = b::uuid); end if;
      if c = 'frente_id' then a := (select nome from public.nos where id = a::uuid); b := (select nome from public.nos where id = b::uuid); end if;
      if c = 'arquivado_em' then a := case when a is null then 'não' else 'sim' end; b := case when b is null then 'não' else 'sim' end; end if;
      partes := array_append(partes, (rot ->> c) || ': ' || coalesce(left(a, 120), '(vazio)') || ' → ' || coalesce(left(b, 120), '(vazio)'));
    end if;
  end loop;
  if array_length(partes, 1) > 0 then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'edicao', null, null, left(array_to_string(partes, '; '), 2000), interno.pessoa_atual());
  end if;
  return null;
end $$;
drop trigger if exists itens_po_historico_edicao on public.itens;
create trigger itens_po_historico_edicao after update on public.itens for each row execute function interno.po_historico_edicao();
revoke all on function interno.po_historico_edicao() from public, anon;
