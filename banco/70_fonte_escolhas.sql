-- =====================================================================
-- Parte 70 · Ao ligar um repositório ou um banco, cada coisa que o robô faz é uma escolha própria:
--   repositório: Desenhos, Ficha técnica, Análise, Épicos e histórias, Mudar a situação dos itens pelos commits e PRs
--                (mover_status, que já existia) e Mapa do Sistema (a cada publicação);
--   banco: Desenhos, Ficha técnica, Análise, Épicos e histórias.
-- Antes, Ficha técnica, Análise e Mapa do Sistema rodavam sempre. Agora:
--   gera_ficha = false: o robô não grava a Ficha técnica desta fonte (a que já existe fica como está, sem atualizar);
--   gera_analise = false: o robô não roda a Análise desta fonte (os alertas que já existem ficam como estão);
--   gera_mapa = false: publicar no GitHub/GitLab não pede mais o Mapa do Sistema (pedir à mão continua valendo).
-- O banco também recusa: infra_ficha_gravar e analise_gravar não gravam com a chave desligada.
-- fonte_opcoes ganha as chaves novas (todas opcionais: null = deixa como está). A versão antiga, de 5 parâmetros,
-- vai para o arquivo com o nome fonte_opcoes_arquivo_65 (sem acesso), para não ficarem duas (regra de ouro nº 7). Plano de volta: 70_fonte_escolhas_VOLTA.sql.
-- =====================================================================
alter table public.repositorios add column if not exists gera_ficha boolean not null default true,
  add column if not exists gera_analise boolean not null default true, add column if not exists gera_mapa boolean not null default true;
alter table public.infra_bancos add column if not exists gera_ficha boolean not null default true,
  add column if not exists gera_analise boolean not null default true;
comment on column public.repositorios.gera_ficha is 'O robô preenche a Ficha técnica com este repositório.';
comment on column public.repositorios.gera_analise is 'O robô roda a Análise (segurança, qualidade, bibliotecas com falha) deste repositório.';
comment on column public.repositorios.gera_mapa is 'Cada publicação deste repositório pede o Mapa do Sistema.';
comment on column public.infra_bancos.gera_ficha is 'O robô preenche a seção Database da Ficha técnica com este banco.';
comment on column public.infra_bancos.gera_analise is 'O robô roda a Análise de segurança e arquitetura deste banco.';

-- o robô recebe as chaves novas de cada fonte; e a ficha e a análise não gravam com a chave desligada
do $$
declare def text;
begin
  def := pg_get_functiondef('public.infra_auto_proximos(integer)'::regprocedure);
  if position('gera_ficha' in def) = 0 then
    if position('''gera_itens'', r.gera_itens)' in def) = 0 or position('''gera_itens'', b.gera_itens)' in def) = 0 then
      raise exception 'Parte 70: não achei onde pôr as chaves em infra_auto_proximos'; end if;
    def := replace(def, '''gera_itens'', r.gera_itens)', '''gera_itens'', r.gera_itens, ''gera_ficha'', r.gera_ficha, ''gera_analise'', r.gera_analise)');
    def := replace(def, '''gera_itens'', b.gera_itens)', '''gera_itens'', b.gera_itens, ''gera_ficha'', b.gera_ficha, ''gera_analise'', b.gera_analise)');
    execute def;
  end if;
  def := pg_get_functiondef('public.infra_auto_bancos_devidos(integer)'::regprocedure);
  if position('gera_ficha' in def) = 0 then
    if position('''gera_itens'', b.gera_itens)' in def) = 0 then raise exception 'Parte 70: não achei onde pôr as chaves em infra_auto_bancos_devidos'; end if;
    execute replace(def, '''gera_itens'', b.gera_itens)', '''gera_itens'', b.gera_itens, ''gera_ficha'', b.gera_ficha, ''gera_analise'', b.gera_analise)');
  end if;
  def := pg_get_functiondef('public.infra_ficha_gravar(uuid,uuid,uuid,text,text,jsonb)'::regprocedure);
  if position('gera_ficha' in def) = 0 then
    if position('  org := case when p_repositorio is not null then ''repo:''' in def) = 0 then raise exception 'Parte 70: não achei onde pôr a chave em infra_ficha_gravar'; end if;
    execute replace(def, '  org := case when p_repositorio is not null then ''repo:''',
      '  -- parte 70: com a Ficha técnica desligada nesta fonte, nada é gravado (a ficha que já existe fica como está)
  if exists (select 1 from public.repositorios where id = p_repositorio and not gera_ficha) or exists (select 1 from public.infra_bancos where id = p_banco and not gera_ficha) then return 0; end if;
  org := case when p_repositorio is not null then ''repo:''');
  end if;
  def := pg_get_functiondef('public.analise_gravar(uuid,uuid,uuid,text,text,integer,jsonb,text)'::regprocedure);
  if position('gera_analise' in def) = 0 then
    if position('  if jsonb_typeof(coalesce(p_achados, ''[]'')) <> ''array'' then' in def) = 0 then raise exception 'Parte 70: não achei onde pôr a chave em analise_gravar'; end if;
    execute replace(def, '  if jsonb_typeof(coalesce(p_achados, ''[]'')) <> ''array'' then',
      '  -- parte 70: com a Análise desligada nesta fonte, nada é gravado (os alertas que já existem ficam como estão)
  if exists (select 1 from public.repositorios where id = p_repositorio and not gera_analise) or exists (select 1 from public.infra_bancos where id = p_banco and not gera_analise) then return null; end if;
  if jsonb_typeof(coalesce(p_achados, ''[]'')) <> ''array'' then');
  end if;
end $$;

-- a publicação só pede o Mapa do Sistema se o repositório estiver com o Mapa ligado
create or replace function interno.mapa_publicou() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  if new.repositorio_id is null or new.origem not in ('github','gitlab') then return null; end if;
  select id, no_id into r from public.repositorios where id = new.repositorio_id and ativo and gera_mapa;
  if not found then return null; end if;
  insert into public.mapa_analises (no_id, repositorio_id, origem, referencia) values (r.no_id, r.id, 'publicacao', new.referencia)
    on conflict (repositorio_id) where status = 'fila' do update set referencia = excluded.referencia, criado_em = now();
  return null;
end $$;
revoke all on function interno.mapa_publicou() from public, anon, authenticated, service_role;

-- o inventário ainda não virado item de uma fonte, apagado numa função à parte (o mesmo efeito de antes)
create or replace function interno.fonte_inventario_limpar(p_origem text) returns integer
language sql security definer set search_path = public, pg_temp as $$
  with x as (delete from public.analise_inventario v using (select p_origem as o) q where v.origem = q.o and v.item_id is null returning 1) select count(*)::int from x
$$;
revoke all on function interno.fonte_inventario_limpar(text) from public, anon, authenticated, service_role;

-- fonte_opcoes com todas as chaves (sai a versão de 5 parâmetros)
-- a versão de 5 parâmetros não é apagada: vai para o arquivo com outro nome, sem acesso para ninguém (nunca apagar;
-- e com outro nome não sobram duas fonte_opcoes, regra de ouro nº 7)
do $$
begin
  if to_regprocedure('public.fonte_opcoes(text,uuid,boolean,boolean,boolean)') is not null then
    execute 'alter function public.fonte_opcoes(text, uuid, boolean, boolean, boolean) rename to fonte_opcoes_arquivo_65';
    execute 'revoke all on function public.fonte_opcoes_arquivo_65(text, uuid, boolean, boolean, boolean) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('logica.fonte_opcoes(text,uuid,boolean,boolean,boolean)') is not null then
    execute 'alter function logica.fonte_opcoes(text, uuid, boolean, boolean, boolean) rename to fonte_opcoes_arquivo_65';
    execute 'revoke all on function logica.fonte_opcoes_arquivo_65(text, uuid, boolean, boolean, boolean) from public, anon, authenticated, service_role';
  end if;
end $$;

create or replace function logica.fonte_opcoes(p_tipo text, p_id uuid, p_desenhos boolean, p_itens boolean, p_lixeira boolean default false,
  p_ficha boolean default null, p_analise boolean default null, p_mapa boolean default null, p_mover boolean default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); no uuid; des_antes boolean; itn_antes boolean; desl timestamptz; org text; prov text; nome text;
        agora timestamptz := now(); fic_antes boolean; ana_antes boolean; map_antes boolean; mov_antes boolean; n_lix int := 0; n_volta int := 0; n_des int := 0; prefixo text;
begin
  if eu is null then raise exception 'Entre no CicloDev primeiro' using errcode = '42501'; end if;
  if p_tipo = 'repo' then
    select r.no_id, r.gera_desenhos, r.gera_itens, r.itens_desligados_em, r.provedor, r.nome, r.gera_ficha, r.gera_analise, r.gera_mapa, r.mover_status
      into no, des_antes, itn_antes, desl, prov, nome, fic_antes, ana_antes, map_antes, mov_antes from public.repositorios r where r.id = p_id;
    org := 'repo:' || p_id; prefixo := prov || ':' || nome || ':';
  elsif p_tipo = 'banco' then
    select b.no_id, b.gera_desenhos, b.gera_itens, b.itens_desligados_em, b.gera_ficha, b.gera_analise into no, des_antes, itn_antes, desl, fic_antes, ana_antes from public.infra_bancos b where b.id = p_id;
    org := 'banco:' || p_id; prefixo := 'banco:' || p_id || ':';
  else raise exception 'Tipo inválido' using errcode = '22023'; end if;
  if no is null then raise exception 'Fonte não encontrada' using errcode = '22023'; end if;
  if no not in (select interno.nos_editaveis()) then raise exception 'Você não pode mudar este ponto' using errcode = '42501'; end if;
  p_desenhos := coalesce(p_desenhos, des_antes); p_itens := coalesce(p_itens, itn_antes);
  p_ficha := coalesce(p_ficha, fic_antes); p_analise := coalesce(p_analise, ana_antes);
  if p_tipo = 'repo' then p_mapa := coalesce(p_mapa, map_antes); p_mover := coalesce(p_mover, mov_antes); else p_mapa := null; p_mover := null; end if;

  -- épicos e histórias desligados: para de montar; os intactos podem ir para a lixeira (mesma hora, para voltarem juntos)
  if itn_antes and not p_itens then
    perform interno.fonte_inventario_limpar(org);
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
    update public.repositorios set gera_desenhos = p_desenhos, gera_itens = p_itens, gera_ficha = p_ficha, gera_analise = p_analise, gera_mapa = p_mapa, mover_status = p_mover,
           itens_desligados_em = case when itn_antes and not p_itens and n_lix > 0 then agora when p_itens then null else itens_desligados_em end where id = p_id;
  else
    update public.infra_bancos set gera_desenhos = p_desenhos, gera_itens = p_itens, gera_ficha = p_ficha, gera_analise = p_analise,
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
  if (not des_antes and p_desenhos) or (not itn_antes and p_itens) or (not fic_antes and p_ficha) or (not ana_antes and p_analise) then perform public.infra_auto_pedir(no); end if;
  return jsonb_build_object('desenhos', p_desenhos, 'itens', p_itens, 'ficha', p_ficha, 'analise', p_analise, 'mapa', p_mapa, 'mover', p_mover, 'para_lixeira', n_lix, 'voltaram', n_volta, 'desenhos_voltaram', n_des);
end $$;
revoke all on function logica.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon, service_role;
grant execute on function logica.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
create or replace function public.fonte_opcoes(p_tipo text, p_id uuid, p_desenhos boolean, p_itens boolean, p_lixeira boolean default false,
  p_ficha boolean default null, p_analise boolean default null, p_mapa boolean default null, p_mover boolean default null) returns jsonb
language sql security invoker set search_path = '' as $$ select * from logica.fonte_opcoes($1, $2, $3, $4, $5, $6, $7, $8, $9) $$;
comment on function public.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) is 'Porta da API (security invoker). O corpo e a regra de acesso estão em logica.fonte_opcoes.';
revoke all on function public.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.fonte_opcoes(text, uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
