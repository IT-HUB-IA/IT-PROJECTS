-- =====================================================================
-- Parte 59 · Ordem de serviço do banco nº1, itens S3, S6 e S7.
-- S3: auditoria.registros, itens_historico e itens_descricao_versoes passam a ser só de inserção.
--     Gatilho recusa UPDATE, DELETE e TRUNCATE (erro 42501) e ninguém comum tem permissão para isso.
--     Três exceções, todas automáticas do próprio banco (nunca de quem usa):
--       1. apagar de vez um item (lixeira) leva junto o histórico dele (on delete cascade): o item já não existe;
--       2. apagar uma pessoa deixa a autoria vazia (on delete set null): só a coluna da pessoa muda;
--       3. a versão da descrição continua "aberta" por 10 minutos para a mesma pessoa (regra da parte 18: quem mexe
--          seguido fica numa versão só). Só a própria gravação (interno.itens_guardar_descricao) consegue, e só nesse prazo.
--     A carga de exemplo (parte 08) pode trocar as linhas marcadas "semente" da auditoria, avisando antes.
-- S6: some a função com nome de pessoa (o arquivo 15 usa um auxiliar temporário, sem nome de pessoa).
-- S7: search_path fixo em interno.infra_aba_ok e ninguém de fora (anon, public) executa função do public, interno ou logica.
-- Plano de volta: 59_historico_so_insercao_e_execucao_VOLTA.sql.
-- =====================================================================

-- ---------- S3 ----------
create or replace function interno.historico_so_insercao() returns trigger
language plpgsql set search_path = '' as $$
declare o jsonb; n jsonb;
begin
  if tg_op = 'TRUNCATE' then
    raise exception '%.% é só de inserção: TRUNCATE recusado', tg_table_schema, tg_table_name using errcode = '42501';
  end if;
  o := to_jsonb(old); n := case when tg_op = 'UPDATE' then to_jsonb(new) end;
  if tg_table_schema = 'public' and tg_table_name in ('itens_historico', 'itens_descricao_versoes') then
    -- 1. o item foi apagado de vez: o histórico vai junto
    if tg_op = 'DELETE' and not exists (select 1 from public.itens i where i.id = (o->>'item_id')::uuid) then return old; end if;
    if tg_op = 'UPDATE' then
      -- 2. a pessoa foi apagada: só a autoria fica vazia
      if (tg_table_name = 'itens_historico' and o->>'pessoa_id' is not null and n->>'pessoa_id' is null
          and not exists (select 1 from public.pessoas p where p.id = (o->>'pessoa_id')::uuid) and (n - 'pessoa_id') = (o - 'pessoa_id'))
      or (tg_table_name = 'itens_descricao_versoes' and o->>'autor_id' is not null and n->>'autor_id' is null
          and not exists (select 1 from public.pessoas p where p.id = (o->>'autor_id')::uuid) and (n - 'autor_id') = (o - 'autor_id')) then
        return new;
      end if;
      -- 3. versão ainda aberta (mesma pessoa, até 10 minutos), só pela própria gravação da descrição
      if tg_table_name = 'itens_descricao_versoes' and current_setting('ciclodev.juntando_versao', true) = 'sim'
         and n->>'id' = o->>'id' and n->>'item_id' = o->>'item_id' and n->'autor_id' = o->'autor_id'
         and (o->>'criado_em')::timestamptz > now() - interval '10 minutes' then
        return new;
      end if;
    end if;
  end if;
  if tg_table_schema = 'auditoria' and tg_op = 'DELETE' and current_setting('ciclodev.trocando_semente', true) = 'sim' and o->'mudancas' ? 'semente' then
    return old;
  end if;
  raise exception '%.% é só de inserção: % recusado', tg_table_schema, tg_table_name, tg_op using errcode = '42501';
end $$;
revoke all on function interno.historico_so_insercao() from public, anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['auditoria.registros', 'public.itens_historico', 'public.itens_descricao_versoes'] loop
    execute format('drop trigger if exists so_insercao on %s', t);
    execute format('drop trigger if exists so_insercao_truncate on %s', t);
    execute format('create trigger so_insercao before update or delete on %s for each row execute function interno.historico_so_insercao()', t);
    execute format('create trigger so_insercao_truncate before truncate on %s for each statement execute function interno.historico_so_insercao()', t);
    execute format('revoke update, delete, truncate on %s from public, anon, authenticated, service_role', t);
  end loop;
end $$;

-- a gravação da descrição avisa quando está juntando na versão aberta (mesmo comportamento da parte 18)
create or replace function interno.itens_guardar_descricao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare eu uuid := interno.pessoa_atual(); ult record;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.descricao, '') <> '' then insert into public.itens_descricao_versoes (item_id, texto, autor_id) values (new.id, new.descricao, eu); end if;
    return null;
  end if;
  if new.descricao is not distinct from old.descricao then return null; end if;
  -- item antigo, sem histórico ainda: guarda primeiro como estava
  if coalesce(old.descricao, '') <> '' and not exists (select 1 from public.itens_descricao_versoes v where v.item_id = new.id) then
    insert into public.itens_descricao_versoes (item_id, texto, autor_id, criado_em) values (new.id, old.descricao, null, coalesce(old.atualizado_em, now()) - interval '1 second');
  end if;
  select v.id, v.autor_id, v.criado_em into ult from public.itens_descricao_versoes v where v.item_id = new.id order by v.criado_em desc limit 1;
  if ult.id is not null and ult.autor_id is not distinct from eu and ult.criado_em > now() - interval '10 minutes' then
    perform set_config('ciclodev.juntando_versao', 'sim', true);
    update public.itens_descricao_versoes set texto = coalesce(new.descricao, ''), criado_em = now() where id = ult.id;
    perform set_config('ciclodev.juntando_versao', '', true);
  else
    insert into public.itens_descricao_versoes (item_id, texto, autor_id) values (new.id, coalesce(new.descricao, ''), eu);
  end if;
  return null;
end $$;

-- ---------- S6 ----------
drop function if exists interno.espaco_do_william();

-- ---------- S7 ----------
alter function interno.infra_aba_ok(text) set search_path = public, pg_temp;
do $$
declare f record; n int := 0;
begin
  for f in select p.oid, s.nspname, p.proname, pg_get_function_identity_arguments(p.oid) ident,
                  has_function_privilege('authenticated', p.oid, 'EXECUTE') au, has_function_privilege('service_role', p.oid, 'EXECUTE') sr
             from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname in ('public', 'interno', 'logica') and has_function_privilege('anon', p.oid, 'EXECUTE') loop
    -- quem já podia continua podendo (agora por permissão explícita); só anon e "todo mundo" saem
    if f.au then execute format('grant execute on function %I.%I(%s) to authenticated', f.nspname, f.proname, f.ident); end if;
    if f.sr then execute format('grant execute on function %I.%I(%s) to service_role', f.nspname, f.proname, f.ident); end if;
    execute format('revoke execute on function %I.%I(%s) from public, anon', f.nspname, f.proname, f.ident);
    n := n + 1;
  end loop;
  raise notice 'S7: anon e public perderam execute em % funções', n;
end $$;
-- funções novas: o "todo mundo" (e com ele o anon) não ganha execute sozinho; quem está logado e o service_role continuam ganhando
alter default privileges in schema interno revoke execute on functions from public;
alter default privileges in schema interno grant execute on functions to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema logica revoke execute on functions from public;
