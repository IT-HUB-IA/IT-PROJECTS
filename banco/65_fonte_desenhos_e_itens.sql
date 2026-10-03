-- =====================================================================
-- Parte 65 · Cada repositório e cada banco ligado tem duas chaves independentes:
--   gera_desenhos: o robô monta os desenhos (e quadros) dele;   gera_itens: o robô monta épicos e histórias com o que leu.
-- Dá para ter as duas, uma só ou nenhuma, na hora de ligar e depois, sem desligar do GitHub/GitLab ou do banco.
-- A Ficha técnica e a Análise (segurança, bibliotecas com falha) continuam sempre: só informam, não criam nada.
-- Desligar desenhos: os desenhos dessa fonte vão para o arquivo e os quadros saem do canvas (parte 64). Ligar de novo:
--   voltam do arquivo e o robô atualiza.
-- Desligar épicos e histórias: o robô para de montar; opcionalmente, os que ele criou e NINGUÉM mexeu vão para a lixeira
--   (todos com a mesma hora). Ligar de novo: voltam da lixeira os que foram por isso, e o robô volta a montar o que faltar.
-- Plano de volta: 65_fonte_desenhos_e_itens_VOLTA.sql.
-- =====================================================================
alter table public.repositorios add column if not exists gera_desenhos boolean not null default true,
  add column if not exists gera_itens boolean not null default true, add column if not exists itens_desligados_em timestamptz;
alter table public.infra_bancos add column if not exists gera_desenhos boolean not null default true,
  add column if not exists gera_itens boolean not null default true, add column if not exists itens_desligados_em timestamptz;
comment on column public.repositorios.gera_desenhos is 'O robô monta os desenhos deste repositório (Software, Infraestrutura, Telas e rotas).';
comment on column public.repositorios.gera_itens is 'O robô monta épicos e histórias com o que leu deste repositório.';
comment on column public.infra_bancos.gera_desenhos is 'O robô monta os desenhos deste banco (DER e Acesso).';
comment on column public.infra_bancos.gera_itens is 'O robô monta épicos e histórias com as tabelas deste banco.';

-- a fonte só "é do ponto" para desenhos se estiver no ponto E com desenhos ligados (a limpeza da parte 64 usa isto)
create or replace function interno.infra_fonte_e_do_no(p_no uuid, p_chave text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_chave like 'banco:%' then exists (select 1 from public.infra_bancos b where b.id::text = split_part(p_chave, ':', 2) and b.no_id = p_no and b.gera_desenhos)
    when split_part(p_chave, ':', 1) in ('github', 'gitlab') then exists (select 1 from public.repositorios r
          where r.provedor = split_part(p_chave, ':', 1) and r.nome = split_part(p_chave, ':', 2) and r.gera_desenhos and (r.no_id = p_no or interno.infra_no_de(r.no_id) = p_no))
    else true end
$$;
create or replace function interno.infra_fonte_saiu_tg() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' or new.no_id is distinct from old.no_id or (old.gera_desenhos and not new.gera_desenhos) then
    perform interno.infra_limpar_no(old.no_id);
    perform interno.infra_limpar_no(interno.infra_no_de(old.no_id));
  end if;
  return null;
end $$;
drop trigger if exists infra_fonte_saiu on public.repositorios;
create trigger infra_fonte_saiu after update of no_id, gera_desenhos or delete on public.repositorios for each row execute function interno.infra_fonte_saiu_tg();
drop trigger if exists infra_fonte_saiu on public.infra_bancos;
create trigger infra_fonte_saiu after update of no_id, gera_desenhos or delete on public.infra_bancos for each row execute function interno.infra_fonte_saiu_tg();

-- o robô recebe as duas chaves de cada fonte; e o inventário (que vira épicos e histórias) não é gravado com a chave desligada
do $$
declare def text;
begin
  def := pg_get_functiondef('public.infra_auto_proximos(integer)'::regprocedure);
  if position('gera_desenhos' in def) = 0 then
    if position('''conexao_id'', r.conexao_id, ''externo_id'', r.externo_id)' in def) = 0 or position('''supa_conexao_id'', b.supa_conexao_id, ''supa_projeto'', b.supa_projeto)' in def) = 0 then
      raise exception 'Parte 65: não achei onde pôr as chaves em infra_auto_proximos'; end if;
    def := replace(def, '''conexao_id'', r.conexao_id, ''externo_id'', r.externo_id)', '''conexao_id'', r.conexao_id, ''externo_id'', r.externo_id, ''gera_desenhos'', r.gera_desenhos, ''gera_itens'', r.gera_itens)');
    def := replace(def, '''supa_conexao_id'', b.supa_conexao_id, ''supa_projeto'', b.supa_projeto)', '''supa_conexao_id'', b.supa_conexao_id, ''supa_projeto'', b.supa_projeto, ''gera_desenhos'', b.gera_desenhos, ''gera_itens'', b.gera_itens)');
    execute def;
  end if;
  def := pg_get_functiondef('public.infra_auto_bancos_devidos(integer)'::regprocedure);
  if position('gera_desenhos' in def) = 0 then
    if position('''ultimo_hash'', b.ultimo_hash)' in def) = 0 then raise exception 'Parte 65: não achei onde pôr as chaves em infra_auto_bancos_devidos'; end if;
    execute replace(def, '''ultimo_hash'', b.ultimo_hash)', '''ultimo_hash'', b.ultimo_hash, ''gera_desenhos'', b.gera_desenhos, ''gera_itens'', b.gera_itens)');
  end if;
  def := pg_get_functiondef('public.analise_inventario_gravar(uuid,uuid,uuid,text,jsonb)'::regprocedure);
  if position('gera_itens' in def) = 0 then
    if position('  if jsonb_typeof(coalesce(p_itens, ''[]'')) <> ''array'' then' in def) = 0 then raise exception 'Parte 65: não achei onde pôr a chave em analise_inventario_gravar'; end if;
    execute replace(def, '  if jsonb_typeof(coalesce(p_itens, ''[]'')) <> ''array'' then',
      '  -- parte 65: com "épicos e histórias" desligado nesta fonte, nada entra no inventário (a tela não monta)
  if exists (select 1 from public.repositorios where id = p_repositorio and not gera_itens) or exists (select 1 from public.infra_bancos where id = p_banco and not gera_itens) then return 0; end if;
  if jsonb_typeof(coalesce(p_itens, ''[]'')) <> ''array'' then');
  end if;
end $$;

-- os itens que o robô montou com uma fonte, que ninguém mexeu depois (sem comentário, anexo, subitem de fora nem edição
-- depois dos 10 primeiros minutos), num ponto
create or replace function interno.itens_da_fonte_intactos(p_no uuid, p_origem text) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  with dentro as (select a.no_id from public.nos_ancestrais a where a.ancestral_id = p_no),
  st as (select i.id, i.pai_id, i.criado_em from public.itens i join public.analise_inventario v on v.item_id = i.id
          where v.origem = p_origem and i.excluido_em is null and i.frente_id in (select no_id from dentro)),
  intacto as (select t.id, t.pai_id from st t
   where not exists (select 1 from public.comentarios c where c.item_id = t.id)
     and not exists (select 1 from public.anexos x where x.item_id = t.id)
     and not exists (select 1 from public.itens f where f.pai_id = t.id and f.excluido_em is null)
     and not exists (select 1 from auditoria.registros r where r.tabela = 'itens' and r.registro_id = t.id and r.acao = 'U' and r.em > t.criado_em + interval '10 minutes')),
  -- o épico que o robô montou só vai se TODAS as histórias vivas dele forem intactas e forem junto
  ep as (select e.id from public.itens e where e.id in (select pai_id from intacto) and e.tipo = 'epic' and e.excluido_em is null
          and e.descricao like 'Épico montado pelo CicloDev%'
          and not exists (select 1 from public.itens f where f.pai_id = e.id and f.excluido_em is null and f.id not in (select id from intacto))
          and not exists (select 1 from public.comentarios c where c.item_id = e.id)
          and not exists (select 1 from public.anexos x where x.item_id = e.id)
          and not exists (select 1 from auditoria.registros r where r.tabela = 'itens' and r.registro_id = e.id and r.acao = 'U' and r.em > e.criado_em + interval '10 minutes'))
  select id from intacto union select id from ep
$$;

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
revoke all on function interno.itens_da_fonte_intactos(uuid, text) from public, anon, authenticated, service_role;
