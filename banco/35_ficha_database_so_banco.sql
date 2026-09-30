-- Parte 35: a seção Database da ficha automática só vem do banco ligado ao ponto (pedido do William, 30/09/2026).
-- O código do repositório não preenche mais Database; o que já tinha sido gravado assim sai.
-- Mesma assinatura da parte 34 (não cria outra versão da função).

create or replace function public.infra_ficha_gravar(p_no uuid, p_repositorio uuid, p_banco uuid, p_rotulo text, p_referencia text, p_campos jsonb)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare c jsonb; v text; sc text; cp text; n integer := 0; chaves text[] := '{}'; velho public.ficha_auto; org text; fnt text;
begin
  if (p_repositorio is null) = (p_banco is null) then raise exception 'Diga o repositório ou o banco (um dos dois)' using errcode = '22023'; end if;
  if not exists (select 1 from public.nos where id = p_no) then raise exception 'Ponto não encontrado' using errcode = '22023'; end if;
  -- cada ponto tem a própria ficha: só entra o que é do repositório ou do banco ligado a ESTE ponto (o do app não vai para o produto)
  if p_repositorio is not null and not exists (select 1 from public.repositorios where id = p_repositorio and no_id = p_no) then return 0; end if;
  if p_banco is not null and not exists (select 1 from public.infra_bancos where id = p_banco and no_id = p_no) then return 0; end if;
  org := case when p_repositorio is not null then 'repo:' || p_repositorio else 'banco:' || p_banco end;
  fnt := case when p_repositorio is not null then 'codigo' else 'banco' end;
  if jsonb_typeof(coalesce(p_campos, '[]')) <> 'array' then raise exception 'Campos inválidos' using errcode = '22023'; end if;
  for c in select * from jsonb_array_elements(coalesce(p_campos, '[]')) loop
    sc := left(btrim(coalesce(c->>'secao', '')), 80); cp := left(btrim(coalesce(c->>'campo', '')), 120); v := left(btrim(coalesce(c->>'valor', '')), 4000);
    if sc = '' or cp = '' or v = '' then continue; end if;
    -- a seção Database só vem do banco ligado, nunca do código do repositório
    if p_repositorio is not null and lower(sc) = 'database' then continue; end if;
    chaves := array_append(chaves, sc || '|' || cp);
    velho := null;
    select * into velho from public.ficha_auto where no_id = p_no and origem = org and secao = sc and campo = cp;
    if velho.id is null then
      insert into public.ficha_auto (no_id, origem, repositorio_id, banco_id, fonte, rotulo, secao, campo, valor, referencia)
      values (p_no, org, p_repositorio, p_banco, fnt, left(coalesce(p_rotulo, ''), 200), sc, cp, v, left(p_referencia, 200));
      n := n + 1;
    elsif velho.valor is distinct from v then
      update public.ficha_auto set anterior = left(velho.valor, 4000), valor = v, mudou_em = now(), atualizado_em = now(), rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200) where id = velho.id;
      n := n + 1;
    else
      update public.ficha_auto set atualizado_em = now(), rotulo = left(coalesce(p_rotulo, ''), 200), referencia = left(p_referencia, 200) where id = velho.id;
    end if;
  end loop;
  delete from public.ficha_auto where no_id = p_no and origem = org and not ((secao || '|' || campo) = any(chaves));
  return n;
end $$;
revoke all on function public.infra_ficha_gravar(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.infra_ficha_gravar(uuid, uuid, uuid, text, text, jsonb) to service_role;

delete from public.ficha_auto where repositorio_id is not null and lower(secao) = 'database';
