-- SOMENTE TESTE LOCAL: parte 60 (O1, O2, O3, S8, S10). Roda depois de todas as partes e dos usuários de teste (91). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create or replace function pg_temp.recusa(p_sql text, p_nome text) returns text language plpgsql as $$
begin execute p_sql; return 'FALHA ' || p_nome || ' (passou)';
exception when check_violation then return 'OK    ' || p_nome || ' é recusado';
          when others then return 'FALHA ' || p_nome || ' (erro ' || sqlstate || ': ' || sqlerrm || ')'; end $$;
create temp table fx as select
  (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') app,
  (select id from nos where nome = 'Java Fiscal' and tipo = 'aplicacao') app2,
  (select pai_id from nos where nome = 'Java BL' and tipo = 'aplicacao') produto,
  (select id from nos where tipo = 'cliente' and espaco_id = (select espaco_id from nos where nome = 'Java BL') limit 1) cliente,
  (select auth_user_id from pessoas where nome = 'William') will_auth;
alter table fx add column projeto uuid; update fx set projeto = (select pai_id from nos where id = (select produto from fx));
alter table fx add column frente uuid; update fx set frente = (select id from nos where pai_id = (select app from fx) and tipo = 'frente' limit 1);
grant select on fx to authenticated;

-- ---------- O1: pai de tipo errado é recusado, ao criar e ao mover ----------
create temp table r (linha text);
insert into r select pg_temp.recusa(format('insert into nos (tipo, nome, pai_id, espaco_id) select %L, ''x'', %s, espaco_id from nos where id = %s', t, pai, pai), t || ' dentro de ' || nome_pai)
  from (values ('projeto','(select projeto from fx)','projeto'), ('projeto','(select app from fx)','aplicação'),
               ('produto','(select cliente from fx)','cliente'), ('produto','(select app from fx)','aplicação'),
               ('aplicacao','(select cliente from fx)','cliente'), ('aplicacao','(select app from fx)','aplicação'),
               ('frente','(select produto from fx)','produto'), ('frente','(select projeto from fx)','projeto'), ('frente','(select cliente from fx)','cliente'),
               ('cliente','(select cliente from fx)','cliente')) v(t, pai, nome_pai);
insert into r select pg_temp.recusa('insert into nos (tipo, nome, pai_id, espaco_id) select ''projeto'', ''sem pai'', null, espaco_id from nos where id = (select cliente from fx)', 'projeto sem pai (no topo)');
insert into r select pg_temp.recusa('update nos set pai_id = (select cliente from fx) where id = (select produto from fx)', 'mover produto para dentro de cliente');
insert into r select pg_temp.recusa('update nos set pai_id = (select app2 from fx) where id = (select app from fx)', 'mover aplicação para dentro de aplicação');
insert into r select pg_temp.recusa('update nos set tipo = ''produto'' where id = (select app from fx)', 'trocar o tipo de um nó');
select linha from r order by linha;
select pg_temp.ok((select count(*) from r where linha like 'OK%') = 14, '14 combinações erradas recusadas (as certas são o caminho normal da árvore)');

-- ---------- O3: o item sabe o caminho; mover a frente muda o caminho ----------
select set_config('request.jwt.claim.sub', (select will_auth::text from fx), true);
select set_config('request.jwt.claims', json_build_object('sub', (select will_auth from fx), 'role', 'authenticated')::text, true);
insert into itens (frente_id, titulo, tipo, status_id) select frente, 'Item do teste da árvore', 'task', (select status_id from itens where status_id is not null limit 1) from fx;
create temp table it as select id from itens where titulo = 'Item do teste da árvore'; grant select on it to authenticated;
set local role authenticated;
select pg_temp.ok((select aplicacao_id = (select app from fx) and produto_id = (select produto from fx) and projeto_id = (select projeto from fx) and cliente_id = (select cliente from fx)
  from itens_com_caminho where id = (select id from it)), 'itens_com_caminho: cliente, projeto, produto e aplicação certos');
select mover_no((select frente from fx), (select app2 from fx));
select pg_temp.ok((select aplicacao_id from itens_com_caminho where id = (select id from it)) = (select app2 from fx), 'mover a frente para outra aplicação muda a aplicação do item na hora');
select mover_no((select frente from fx), (select app from fx));
reset role;

-- ---------- O2: nó na lixeira leva o que está dentro; restaurar traz de volta só o que foi junto ----------
insert into itens (frente_id, titulo, tipo, status_id) select frente, 'Já estava na lixeira', 'task', (select status_id from itens where status_id is not null limit 1) from fx;
set local role authenticated;
select lixeira_mover('item', (select id from itens where titulo = 'Já estava na lixeira'));
reset role;
-- o teste roda numa transação só (a hora é a mesma em tudo): este item foi para a lixeira um dia antes
update itens set excluido_em = now() - interval '1 day' where titulo = 'Já estava na lixeira';
create temp table antes as select count(*) filter (where excluido_em is null) vivos from itens where frente_id in (select a.no_id from nos_ancestrais a where a.ancestral_id = (select app from fx));
set local role authenticated;
select lixeira_mover('no', (select app from fx));
reset role;
select pg_temp.ok((select count(*) from itens i join nos_ancestrais a on a.no_id = i.frente_id join nos x on x.id = a.ancestral_id where i.excluido_em is null and x.excluido_em is not null) = 0,
  'consulta do anexo (itens vivos dentro de nó excluído) devolve zero');
set local role authenticated;
select pg_temp.ok((select count(*) from lixeira_listar() where id = (select app from fx)) = 1
  and (select count(*) from lixeira_listar() where tipo = 'item' and id in (select id from itens where frente_id in (select a.no_id from nos_ancestrais a where a.ancestral_id = (select app from fx)) and titulo <> 'Já estava na lixeira')) = 0,
  'a lixeira mostra a aplicação, não cada item que foi junto');
select lixeira_restaurar('no', (select app from fx));
reset role;
select pg_temp.ok((select count(*) filter (where excluido_em is null) from itens where frente_id in (select a.no_id from nos_ancestrais a where a.ancestral_id = (select app from fx))) = (select vivos from antes),
  'restaurar a aplicação traz de volta todos os itens que foram junto');
select pg_temp.ok((select excluido_em is not null from itens where titulo = 'Já estava na lixeira'), 'o item que já estava na lixeira antes continua na lixeira');

-- ---------- S8 e S10 ----------
select pg_temp.ok(not has_table_privilege('authenticated', 'bi.ritmo_semanal', 'SELECT') and (select count(*) from pg_class where relnamespace = 'bi'::regnamespace and relkind = 'v' and not coalesce(reloptions, '{}') @> '{security_invoker=true}') = 0,
  'S8: toda vista do bi com security_invoker; a materializada não é lida por quem está logado');
select pg_temp.ok(not exists (
    select 1 from pg_class c cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p(priv)
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and has_table_privilege('authenticated', c.oid, p.priv)
       and (not c.relrowsecurity or not exists (select 1 from pg_policy po where po.polrelid = c.oid and po.polpermissive and (po.polroles = '{0}' or 'authenticated'::regrole = any(po.polroles))
            and po.polcmd in ('*', case p.priv when 'SELECT' then 'r' when 'INSERT' then 'a' when 'UPDATE' then 'w' else 'd' end)))),
  'S10: toda permissão de quem está logado numa tabela do public tem RLS e política que a usa');
select pg_temp.ok(not exists (select 1 from pg_class c where c.relnamespace in ('interno'::regnamespace, 'auditoria'::regnamespace) and c.relkind in ('r','p') and not c.relrowsecurity),
  'S10: RLS ligada em toda tabela do interno e da auditoria');
select pg_temp.ok(not exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) x where d.defaclnamespace = 'public'::regnamespace and d.defaclobjtype = 'r'
  and x.grantee = 'authenticated'::regrole and d.defaclrole = current_user::regrole), 'S10: tabela nova no public não ganha permissão sozinha para quem está logado');
rollback;
