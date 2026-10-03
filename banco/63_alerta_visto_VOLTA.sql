-- VOLTA da parte 63. A coluna visto_em fica (sem uso), para não perder quem já marcou.
CREATE OR REPLACE FUNCTION public.analise_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_referencia text, p_arquivos integer, p_achados jsonb, p_avisos text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a jsonb; org text; imp text; vistos text[] := '{}'; novos integer := 0; corr integer := 0; abertos integer; velho public.analise_achados;
  ids_corr uuid[]; itens_mov uuid[]; revisao uuid;
begin
  if (p_repositorio is null) = (p_banco is null) then raise exception 'Diga o repositório ou o banco (um dos dois)' using errcode = '22023'; end if;
  if p_repositorio is not null and not exists (select 1 from public.repositorios where id = p_repositorio and no_id = p_no) then return null; end if;
  if p_banco is not null and not exists (select 1 from public.infra_bancos where id = p_banco and no_id = p_no) then return null; end if;
  if jsonb_typeof(coalesce(p_achados, '[]')) <> 'array' then raise exception 'Achados inválidos' using errcode = '22023'; end if;
  org := case when p_repositorio is not null then 'repo:' || p_repositorio else 'banco:' || p_banco end;
  for a in select * from jsonb_array_elements(coalesce(p_achados, '[]')) limit 1000 loop
    imp := a->>'impressao';
    if imp is null or imp !~ '^[0-9a-f]{8}$' or imp = any(vistos) then continue; end if;
    vistos := array_append(vistos, imp);
    velho := null;
    select * into velho from public.analise_achados where no_id = p_no and origem = org and impressao = imp;
    if velho.id is null then
      insert into public.analise_achados (no_id, origem, repositorio_id, banco_id, rotulo, regra, gravidade, titulo, onde, trecho, impressao, referencia)
      values (p_no, org, p_repositorio, p_banco, left(coalesce(p_rotulo, ''), 200), a->>'regra', a->>'gravidade', left(a->>'titulo', 300), left(a->>'onde', 500), left(coalesce(a->>'trecho', ''), 400), imp, left(p_referencia, 200));
      novos := novos + 1;
    else
      update public.analise_achados set gravidade = a->>'gravidade', titulo = left(a->>'titulo', 300), onde = left(a->>'onde', 500), trecho = left(coalesce(a->>'trecho', ''), 400),
             rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200), ultimo_em = now(), vezes = vezes + 1,
             status = case when status = 'corrigido' then 'aberto' else status end, corrigido_em = case when status = 'corrigido' then null else corrigido_em end
       where id = velho.id;
      if velho.status = 'corrigido' then novos := novos + 1; end if;
    end if;
  end loop;
  with c as (
    update public.analise_achados set status = 'corrigido', corrigido_em = now()
     where no_id = p_no and origem = org and status = 'aberto' and not (impressao = any(vistos)) returning id, item_id)
  select array_agg(id), array_agg(item_id) filter (where item_id is not null) into ids_corr, itens_mov from c;
  corr := coalesce(cardinality(ids_corr), 0);
  if itens_mov is not null then
    update public.itens_criterios set feito = true, marcado_em = now()
     where item_id = any(itens_mov) and not feito and texto like 'A análise de segurança não acha mais este ponto%';
    select id into revisao from public.status_fluxo where no_id is null and chave = 'review' limit 1;
    if revisao is not null then
      update public.itens i set status_id = revisao
       where i.id = any(itens_mov) and interno.po_grupo(i.status_id) in ('backlog','todo','doing','blocked')
         and not exists (select 1 from public.analise_achados x where x.item_id = i.id and x.status = 'aberto');
    end if;
  end if;
  select count(*) into abertos from public.analise_achados where no_id = p_no and origem = org and status = 'aberto';
  insert into public.analise_rodadas (no_id, origem, rotulo, referencia, arquivos, abertos, novos, corrigidos, avisos, rodou_em)
  values (p_no, org, left(coalesce(p_rotulo, ''), 200), left(p_referencia, 200), p_arquivos, abertos, novos, corr, left(p_avisos, 1000), now())
  on conflict (no_id, origem) do update set rotulo = excluded.rotulo, referencia = excluded.referencia, arquivos = excluded.arquivos, abertos = excluded.abertos,
     novos = excluded.novos, corrigidos = excluded.corrigidos, avisos = excluded.avisos, rodou_em = now();
  return jsonb_build_object('abertos', abertos, 'novos', novos, 'corrigidos', corr, 'itens', coalesce(cardinality(itens_mov), 0));
end $function$;
drop function if exists public.analise_marcar_visto(uuid[]);
drop function if exists logica.analise_marcar_visto(uuid[]);
drop function if exists interno.analise_avisar(uuid, text, jsonb);
drop function if exists interno.pessoas_do_no(uuid);
