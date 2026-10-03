-- SOMENTE TESTE LOCAL: parte 62 (I4). Para cada uma das 13 tabelas e cada pessoa de teste, quantas linhas ela vê e quantas
-- conseguiria mudar/apagar. Rodar ANTES e DEPOIS da parte 62 e comparar a saída (as linhas "VE" têm de ser iguais).
-- No fim: uma política permissiva por ação em cada tabela. Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table quem as select nome, auth_user_id from pessoas where auth_user_id is not null order by nome;
grant select on quem to authenticated;
create temp table saida (linha text); grant all on saida to authenticated;
do $$
declare p record; t text; n bigint; m bigint;
begin
  for p in select * from quem loop
    perform set_config('request.jwt.claim.sub', p.auth_user_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', p.auth_user_id, 'role', 'authenticated')::text, true);
    foreach t in array array['custos_uso','dominios_registros','equipes','equipes_membros','espaco_membros','etapas_modelo_itens','etiquetas',
                             'infra_canvas','itens_criterios','servicos','servicos_cobranca','servicos_requisitos','vinculos_externos'] loop
      execute 'set local role authenticated';
      execute format('select count(*) from public.%I', t) into n;
      -- quantas linhas um update "sem mudar nada" alcança (não muda nada de verdade: a transação volta atrás)
      begin execute format('with x as (update public.%I set %I = %I returning 1) select count(*) from x', t,
              (select attname from pg_attribute where attrelid = ('public.' || t)::regclass and attnum = 1), (select attname from pg_attribute where attrelid = ('public.' || t)::regclass and attnum = 1)) into m;
      exception when others then m := -1; end;
      execute 'reset role';
      insert into saida values (format('VE %s | %s | %s linhas | alcança mudar %s', t, p.nome, n, m));
    end loop;
  end loop;
end $$;
select linha from saida order by linha;
select pg_temp.ok(not exists (
  select 1 from pg_policy p join pg_class c on c.oid = p.polrelid cross join unnest(array['r','a','w','d']) acao
   where c.relnamespace = 'public'::regnamespace and p.polpermissive and p.polcmd in (acao::"char", '*')
     and c.relname in ('custos_uso','dominios_registros','equipes','equipes_membros','espaco_membros','etapas_modelo_itens','etiquetas',
                       'infra_canvas','itens_criterios','servicos','servicos_cobranca','servicos_requisitos','vinculos_externos')
   group by c.relname, acao, p.polroles having count(*) > 1), 'I4: uma política permissiva por ação (e por papel) nas 13 tabelas');
rollback;
