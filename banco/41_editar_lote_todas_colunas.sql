-- Parte 41: o Editar em lote muda qualquer coluna da Lista e da janela do item. 01/10/2026.
-- O histórico de edição (tipo 'edicao') passa a guardar também descrição, horas, início, data alvo, cliente vê e sprint.
-- A situação continua no histórico próprio (tipo 'situacao', parte 38) e o "onde" (a frente) já estava (frente_id).
-- Só troca a função; o gatilho itens_po_historico_edicao (parte 39) continua o mesmo.
create or replace function interno.po_historico_edicao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare partes text[] := '{}';
  c text;
  f constant text[] := array['titulo','historia_quem','historia_quero','historia_para','moscow','nivel','valor','pontos','tipo','melhoria','externa','responsavel_id','prazo','pai_id','marco_id','frente_id','arquivado_em','resolucao','descricao','estimativa_h','inicio','data_prevista','visivel_cliente','sprint_id'];
  rot constant jsonb := '{"titulo":"título","historia_quem":"como","historia_quero":"quero","historia_para":"para","moscow":"prioridade","nivel":"nível","valor":"valor","pontos":"pontos","tipo":"tipo","melhoria":"melhoria","externa":"tarefa externa","responsavel_id":"responsável","prazo":"prazo","pai_id":"épico","marco_id":"versão","frente_id":"frente","arquivado_em":"arquivado","resolucao":"resolução","descricao":"descrição","estimativa_h":"horas","inicio":"início","data_prevista":"data alvo","visivel_cliente":"cliente vê","sprint_id":"sprint"}';
  a text; b text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  foreach c in array f loop
    a := vo ->> c; b := vn ->> c;
    if a is distinct from b then
      if c = 'responsavel_id' then a := (select nome from public.pessoas where id = a::uuid); b := (select nome from public.pessoas where id = b::uuid); end if;
      if c in ('pai_id') then a := (select titulo from public.itens where id = a::uuid); b := (select titulo from public.itens where id = b::uuid); end if;
      if c = 'marco_id' then a := (select nome from public.marcos where id = a::uuid); b := (select nome from public.marcos where id = b::uuid); end if;
      if c = 'frente_id' then a := (select nome from public.nos where id = a::uuid); b := (select nome from public.nos where id = b::uuid); end if;
      if c = 'sprint_id' then a := (select nome from public.sprints where id = a::uuid); b := (select nome from public.sprints where id = b::uuid); end if;
      if c = 'visivel_cliente' then a := case when a = 'true' then 'sim' else 'não' end; b := case when b = 'true' then 'sim' else 'não' end; end if;
      if c = 'arquivado_em' then a := case when a is null then 'não' else 'sim' end; b := case when b is null then 'não' else 'sim' end; end if;
      partes := array_append(partes, (rot ->> c) || ': ' || coalesce(left(a, 120), '(vazio)') || ' → ' || coalesce(left(b, 120), '(vazio)'));
    end if;
  end loop;
  if array_length(partes, 1) > 0 then
    insert into public.itens_historico (item_id, tipo, de, para, texto, pessoa_id) values (new.id, 'edicao', null, null, left(array_to_string(partes, '; '), 2000), interno.pessoa_atual());
  end if;
  return null;
end $$;
revoke all on function interno.po_historico_edicao() from public, anon;
