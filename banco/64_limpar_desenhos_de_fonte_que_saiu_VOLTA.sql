-- VOLTA da parte 64: tira a limpeza automática. Os desenhos já arquivados continuam no arquivo (dá para tirar o arquivado_em à mão).
drop trigger if exists infra_fonte_saiu on public.repositorios;
drop trigger if exists infra_fonte_saiu on public.infra_bancos;
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
end $function$;
drop function if exists interno.infra_fonte_saiu_tg();
drop function if exists interno.infra_limpar_no(uuid);
drop function if exists interno.infra_fonte_e_do_no(uuid, text);
