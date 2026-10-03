-- =====================================================================
-- Parte 64 · Repositório ou banco que sai de um ponto leva junto o que o robô montou com ele ali.
-- Problema: ligar um repositório no ponto errado e depois mover (ou trocar, ou remover) deixava no ponto antigo os desenhos,
--   os quadros do canvas e a ficha técnica feitos a partir dele. A limpeza do robô só olhava as fontes que ainda estavam no ponto.
-- Agora: ao mudar o ponto de um repositório ou banco, ao apagá-lo, e no fim de toda atualização do robô, o ponto é conferido:
--   desenho automático cuja fonte não é mais dele vai para o arquivo (as versões continuam guardadas); o quadro dele sai do
--   canvas (vai para arquivo/, não é apagado) e o card some do quadro principal; a ficha técnica preenchida por essa fonte sai
--   (ela é refeita pelo robô no ponto certo). Achados da análise não são mexidos (têm decisões das pessoas).
-- Plano de volta: 64_limpar_desenhos_de_fonte_que_saiu_VOLTA.sql.
-- =====================================================================
create or replace function interno.infra_fonte_e_do_no(p_no uuid, p_chave text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_chave like 'banco:%' then exists (select 1 from public.infra_bancos b where b.id::text = split_part(p_chave, ':', 2) and b.no_id = p_no)
    when split_part(p_chave, ':', 1) in ('github', 'gitlab') then exists (select 1 from public.repositorios r
          where r.provedor = split_part(p_chave, ':', 1) and r.nome = split_part(p_chave, ':', 2) and (r.no_id = p_no or interno.infra_no_de(r.no_id) = p_no))
    else true end   -- chave que não é de fonte automática: não mexe
$$;

create or replace function interno.infra_limpar_no(p_no uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare d record; n int := 0; qid text; raiz jsonb;
begin
  if p_no is null then return 0; end if;
  for d in select x.id, x.aba, x.quadro, x.chave_auto from public.infra_diagramas x
            where x.no_id = p_no and x.chave_auto is not null and x.arquivado_em is null and not interno.infra_fonte_e_do_no(p_no, x.chave_auto) loop
    update public.infra_diagramas set arquivado_em = now() where id = d.id;
    if d.quadro like 'quadros/%' and d.quadro <> 'quadros/raiz' then
      qid := substr(d.quadro, 9);
      -- o quadro do desenho vai para o arquivo (não aparece mais no canvas nem no Desenho completo)
      delete from public.infra_canvas where no_id = p_no and aba = d.aba and caminho = 'arquivo/' || qid;
      update public.infra_canvas set caminho = 'arquivo/' || qid where no_id = p_no and aba = d.aba and caminho = d.quadro;
      select dados into raiz from public.infra_canvas where no_id = p_no and aba = d.aba and caminho = 'quadros/raiz' for update;
      if raiz is not null then
        update public.infra_canvas set dados = jsonb_set(raiz, '{nodes}', coalesce((select jsonb_agg(c) from jsonb_array_elements(raiz -> 'nodes') c where c ->> 'quadroId' is distinct from qid), '[]'::jsonb))
         where no_id = p_no and aba = d.aba and caminho = 'quadros/raiz';
      end if;
    end if;
    n := n + 1;
  end loop;
  -- ficha técnica preenchida por fonte que não é mais deste ponto
  delete from public.ficha_auto f where f.no_id = p_no
     and ((f.repositorio_id is not null and not exists (select 1 from public.repositorios r where r.id = f.repositorio_id and (r.no_id = p_no or interno.infra_no_de(r.no_id) = p_no)))
       or (f.banco_id is not null and not exists (select 1 from public.infra_bancos b where b.id = f.banco_id and b.no_id = p_no)));
  return n;
end $$;
revoke all on function interno.infra_fonte_e_do_no(uuid, text), interno.infra_limpar_no(uuid) from public, anon, authenticated, service_role;

-- repositório ou banco que muda de ponto ou é apagado: confere o ponto antigo (e o produto/projeto dele)
create or replace function interno.infra_fonte_saiu_tg() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' or new.no_id is distinct from old.no_id then
    perform interno.infra_limpar_no(old.no_id);
    perform interno.infra_limpar_no(interno.infra_no_de(old.no_id));
  end if;
  return null;
end $$;
revoke all on function interno.infra_fonte_saiu_tg() from public, anon, authenticated, service_role;
drop trigger if exists infra_fonte_saiu on public.repositorios;
create trigger infra_fonte_saiu after update of no_id or delete on public.repositorios for each row execute function interno.infra_fonte_saiu_tg();
drop trigger if exists infra_fonte_saiu on public.infra_bancos;
create trigger infra_fonte_saiu after update of no_id or delete on public.infra_bancos for each row execute function interno.infra_fonte_saiu_tg();

-- e no fim de toda atualização do robô (pega também o que ficou para trás antes desta parte)
create or replace function public.infra_auto_concluir(p_id uuid, p_status text, p_erro text, p_diagramas uuid[], p_resumo jsonb, p_prefixos text[] DEFAULT '{}'::text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
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
  perform interno.infra_limpar_no(a.no_id);
end $function$;

-- o que já ficou para trás hoje
do $$
declare r record; n int := 0;
begin
  for r in select distinct no_id from public.infra_diagramas where chave_auto is not null and arquivado_em is null loop
    n := n + interno.infra_limpar_no(r.no_id);
  end loop;
  raise notice 'Parte 64: % desenhos de fonte que saiu do ponto foram para o arquivo', n;
end $$;
