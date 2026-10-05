-- Volta da parte 70: as escolhas Ficha técnica, Análise e Mapa do Sistema deixam de existir (voltam a rodar sempre)
-- e fonte_opcoes volta a ter 5 parâmetros. mover_status (que já existia antes) fica como está.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.infra_auto_proximos(integer)'::regprocedure);
  def := replace(def, ', ''gera_ficha'', r.gera_ficha, ''gera_analise'', r.gera_analise)', ')');
  def := replace(def, ', ''gera_ficha'', b.gera_ficha, ''gera_analise'', b.gera_analise)', ')');
  execute def;
  def := pg_get_functiondef('public.infra_auto_bancos_devidos(integer)'::regprocedure);
  execute replace(def, ', ''gera_ficha'', b.gera_ficha, ''gera_analise'', b.gera_analise)', ')');
  def := pg_get_functiondef('public.infra_ficha_gravar(uuid,uuid,uuid,text,text,jsonb)'::regprocedure);
  execute replace(def, '  -- parte 70: com a Ficha técnica desligada nesta fonte, nada é gravado (a ficha que já existe fica como está)
  if exists (select 1 from public.repositorios where id = p_repositorio and not gera_ficha) or exists (select 1 from public.infra_bancos where id = p_banco and not gera_ficha) then return 0; end if;
', '');
  def := pg_get_functiondef('public.analise_gravar(uuid,uuid,uuid,text,text,integer,jsonb,text)'::regprocedure);
  execute replace(def, '  -- parte 70: com a Análise desligada nesta fonte, nada é gravado (os alertas que já existem ficam como estão)
  if exists (select 1 from public.repositorios where id = p_repositorio and not gera_analise) or exists (select 1 from public.infra_bancos where id = p_banco and not gera_analise) then return null; end if;
', '');
end $$;
create or replace function interno.mapa_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if new.repositorio_id is null or new.origem not in ('github','gitlab') then return null; end if;
  select id, no_id into r from public.repositorios where id = new.repositorio_id and ativo;
  if not found then return null; end if;
  insert into public.mapa_analises (no_id, repositorio_id, origem, referencia) values (r.no_id, r.id, 'publicacao', new.referencia)
    on conflict (repositorio_id) where status = 'fila' do update set referencia = excluded.referencia, criado_em = now();
  return null;
end $$;
revoke all on function interno.mapa_publicou() from public, anon, authenticated, service_role;
drop function if exists public.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
drop function if exists logica.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
drop function if exists public.fonte_opcoes_arquivo_65(text, uuid, boolean, boolean, boolean);
drop function if exists logica.fonte_opcoes_arquivo_65(text, uuid, boolean, boolean, boolean);
create or replace function logica.fonte_opcoes(p_tipo text, p_id uuid, p_desenhos boolean, p_itens boolean, p_lixeira boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); no uuid; des_antes boolean; itn_antes boolean; desl timestamptz; org text; prov text; nome text;
        agora timestamptz := now(); n_lix int := 0; n_volta int := 0; n_des int := 0; prefixo text;
begin
  if eu is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if p_tipo = 'repo' then
    select r.no_id, r.gera_desenhos, r.gera_itens, r.itens_desligados_em, r.provedor, r.nome into no, des_antes, itn_antes, desl, prov, nome from public.repositorios r where r.id = p_id;
    org := 'repo:' || p_id; prefixo := prov || ':' || nome || ':';
  elsif p_tipo = 'banco' then
    select b.no_id, b.gera_desenhos, b.gera_itens, b.itens_desligados_em into no, des_antes, itn_antes, desl from public.infra_bancos b where b.id = p_id;
    org := 'banco:' || p_id; prefixo := 'banco:' || p_id || ':';
  else raise exception 'Tipo inválido' using errcode = '22023'; end if;
  if no is null then raise exception 'Fonte não encontrada' using errcode = '22023'; end if;
  if no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  p_desenhos := coalesce(p_desenhos, des_antes); p_itens := coalesce(p_itens, itn_antes);

  -- épicos e histórias desligados: para de montar; os intactos podem ir para a lixeira (mesma hora, para voltarem juntos)
  if itn_antes and not p_itens then
    delete from public.analise_inventario where origem = org and item_id is null;
    if coalesce(p_lixeira, false) then
      update public.itens set excluido_em = agora, excluido_por = eu where id in (select interno.itens_da_fonte_intactos(no, org));
      get diagnostics n_lix = row_count;
    end if;
  end if;
  -- ligados de novo: volta da lixeira o que foi por isso
  if not itn_antes and p_itens and desl is not null then
    update public.itens set excluido_em = null, excluido_por = null where excluido_em = desl
       and (id in (select v.item_id from public.analise_inventario v where v.origem = org)
            or (tipo = 'epic' and id in (select i.pai_id from public.itens i join public.analise_inventario v on v.item_id = i.id and v.origem = org)));
    get diagnostics n_volta = row_count;
  end if;

  if p_tipo = 'repo' then
    update public.repositorios set gera_desenhos = p_desenhos, gera_itens = p_itens,
           itens_desligados_em = case when itn_antes and not p_itens and n_lix > 0 then agora when p_itens then null else itens_desligados_em end where id = p_id;
  else
    update public.infra_bancos set gera_desenhos = p_desenhos, gera_itens = p_itens,
           itens_desligados_em = case when itn_antes and not p_itens and n_lix > 0 then agora when p_itens then null else itens_desligados_em end where id = p_id;
  end if;

  -- desenhos ligados de novo: voltam do arquivo (o robô atualiza em seguida)
  if not des_antes and p_desenhos then
    update public.infra_canvas c set caminho = 'quadros/' || substr(c.caminho, 9)
     where c.caminho like 'arquivo/%' and exists (select 1 from public.infra_diagramas d where d.no_id = c.no_id and d.aba = c.aba and d.quadro = 'quadros/' || substr(c.caminho, 9)
                                                    and left(d.chave_auto, length(prefixo)) = prefixo and d.arquivado_em is not null)
       and not exists (select 1 from public.infra_canvas q where q.no_id = c.no_id and q.aba = c.aba and q.caminho = 'quadros/' || substr(c.caminho, 9));
    update public.infra_diagramas set arquivado_em = null where left(chave_auto, length(prefixo)) = prefixo and arquivado_em is not null
       and (no_id = no or no_id = interno.infra_no_de(no));
    get diagnostics n_des = row_count;
  end if;
  -- algo foi ligado: pede uma atualização ao robô
  if (not des_antes and p_desenhos) or (not itn_antes and p_itens) then perform public.infra_auto_pedir(no); end if;
  return jsonb_build_object('desenhos', p_desenhos, 'itens', p_itens, 'para_lixeira', n_lix, 'voltaram', n_volta, 'desenhos_voltaram', n_des);
end $$;
revoke all on function logica.fonte_opcoes(text, uuid, boolean, boolean, boolean) from public, anon;
grant execute on function logica.fonte_opcoes(text, uuid, boolean, boolean, boolean) to authenticated;
create or replace function public.fonte_opcoes(p_tipo text, p_id uuid, p_desenhos boolean, p_itens boolean, p_lixeira boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$ select * from logica.fonte_opcoes($1, $2, $3, $4, $5) $$;
comment on function public.fonte_opcoes(text, uuid, boolean, boolean, boolean) is 'Porta da API (security invoker). O corpo e a regra de acesso estão em logica.fonte_opcoes.';
revoke all on function public.fonte_opcoes(text, uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.fonte_opcoes(text, uuid, boolean, boolean, boolean) to authenticated;
alter table public.repositorios drop column if exists gera_ficha, drop column if exists gera_analise, drop column if exists gera_mapa;
alter table public.infra_bancos drop column if exists gera_ficha, drop column if exists gera_analise;
drop function if exists interno.fonte_inventario_limpar(text);
