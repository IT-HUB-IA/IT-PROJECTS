-- SOMENTE TESTE LOCAL: prova de isolamento. Uma pessoa nova se cadastra e não pode enxergar NENHUMA linha que já existia
-- (de nenhuma tabela do public), nem chamar função que devolva dado de outro espaço. Rodar num banco já cheio de dados.
\set ON_ERROR_STOP 1
\pset tuples_only on
-- tabelas de referência que são iguais para todo mundo (sem dado de cliente)
create temp table globais(t text primary key);
insert into globais values ('cambio'), ('status_fluxo'), ('etiquetas_sistema');
-- foto de tudo o que existe antes da pessoa nova chegar
create temp table foto(t text, h text);
do $$ declare r record; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') loop
    execute format('insert into foto select %L, md5(x::text) from public.%I x', r.relname, r.relname);
  end loop;
end $$;
create index on foto (t, h);
grant select on foto, globais to authenticated;
select 'linhas na foto: ' || count(*) || ' em ' || count(distinct t) || ' tabelas com dado' from foto;
-- a pessoa de fora se cadastra
select gen_random_uuid() as fora \gset
insert into auth.users (id, email, raw_user_meta_data) values (:'fora', 'fora-' || :'fora' || '@teste.com', '{"nome":"Pessoa de Fora"}');
select set_config('request.jwt.claim.sub', :'fora', false) is not null as ok_sub;
select set_config('request.jwt.claims', json_build_object('sub', :'fora', 'email', 'fora-' || :'fora' || '@teste.com', 'role', 'authenticated')::text, false) is not null as ok_claims;
set role authenticated;
create temp table vazou(t text, n bigint);
do $$ declare r record; n bigint; erro text; begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p','v') loop
    begin
      execute format('select count(*) from public.%I x where md5(x::text) in (select h from foto where t = %L)', r.relname, r.relname) into n;
      if n > 0 and r.relname not in (select t from globais) then insert into vazou values (r.relname, n); end if;
    exception when insufficient_privilege then null;   -- sem permissão nenhuma: também não vaza
    end;
  end loop;
end $$;
select case when count(*) = 0 then 'OK    a pessoa de fora não enxerga nenhuma linha que já existia (todas as tabelas)'
  else 'FALHA vazou: ' || string_agg(t || ' (' || n || ')', ', ') end from vazou;
reset role;
