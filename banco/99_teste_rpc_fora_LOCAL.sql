-- SOMENTE TESTE LOCAL: parte 58 (S2). Para cada uma das 51 funções da API que rodam com o poder do dono,
-- uma pessoa de OUTRO espaço chama com os dados do William e não consegue nada (erro 42501 ou resposta vazia).
-- Também prova: nenhuma security definer no public pode ser chamada por quem está logado; a porta do public é security invoker.
-- Roda depois de todas as partes e dos usuários de teste (91). Tudo numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table fx as select
  (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') app,
  (select pai_id from nos where nome = 'Java BL' and tipo = 'aplicacao') produto,
  (select id from nos where tipo = 'cliente' and espaco_id = (select espaco_id from nos where nome = 'Java BL') limit 1) cliente,
  (select id from itens order by chave limit 1) item,
  (select id from itens order by chave offset 1 limit 1) item2,
  (select frente_id from itens order by chave limit 1) frente,
  (select id from pessoas where nome = 'William') will,
  null::uuid portal, null::uuid fora;
insert into public.portais (dono_id, no_id, nome) select will, app, 'Portal do William' from fx returning id \gset
update fx set portal = :'id';
-- um item do William já na lixeira (para tentar restaurar e apagar de vez)
update itens set excluido_em = now(), excluido_por = (select will from fx) where id = (select item2 from fx);
select gen_random_uuid() as fora_auth \gset
insert into auth.users (id, email, raw_user_meta_data) values (:'fora_auth', 'fora-' || :'fora_auth' || '@teste.com', '{"nome":"Pessoa de Fora"}');
update fx set fora = (select id from pessoas where auth_user_id = :'fora_auth');
grant select on fx to authenticated;
select pg_temp.ok((select fora from fx) is not null and (select portal from fx) is not null, 'pessoa de fora cadastrada (com o próprio espaço) e portal do William criado');

-- vazio = nada que seja do William; erro 42501 = recusado. Qualquer outro erro conta como falha (para ver).
create or replace function pg_temp.nega(p_sql text, p_nome text) returns text language plpgsql as $$
declare r jsonb;
begin
  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from (%s) x', p_sql) into r;
  if r = '[]'::jsonb or r <@ '[null, false, 0, [], {}]'::jsonb
     or not exists (select 1 from jsonb_array_elements(r) e, jsonb_each(case when jsonb_typeof(e) = 'object' then e else jsonb_build_object('v', e) end) kv where kv.value is not null and kv.value not in ('false', '0', '[]', '{}', 'null')) then
    return 'OK    ' || p_nome || ': vazio';
  end if;
  return 'FALHA ' || p_nome || ': devolveu ' || left(r::text, 200);
exception when insufficient_privilege then return 'OK    ' || p_nome || ': recusado (42501)';
          when raise_exception then return 'OK    ' || p_nome || ': recusado (' || sqlerrm || ')';
          when others then return 'FALHA ' || p_nome || ': erro ' || sqlstate || ' ' || sqlerrm;
end $$;

select set_config('request.jwt.claim.sub', (select auth_user_id::text from pessoas where id = (select fora from fx)), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
set local role authenticated;
create temp table r (linha text);
\set W '(select will from fx)'
insert into r select pg_temp.nega(q, n) from (values
 ('admin_banco',                'select * from admin_banco()'),
 ('admin_historico',            'select * from admin_historico((select will from fx), 10)'),
 ('admin_ia_definir',           'select admin_ia_definir((select will from fx), true)'),
 ('admin_ia_permissoes',        'select * from admin_ia_permissoes()'),
 ('admin_resumo',               'select admin_resumo()'),
 ('admin_telas',                'select * from admin_telas(30)'),
 ('admin_uso_diario',           'select * from admin_uso_diario(30)'),
 ('admin_usuarios',             'select * from admin_usuarios()'),
 ('analise_inventario_ligar',   'select analise_inventario_ligar(jsonb_build_array(jsonb_build_object(''no'', (select app from fx), ''achado'', gen_random_uuid())))'),
 ('analise_marcar',             'select * from analise_marcar(gen_random_uuid(), ''ok'')'),
 ('git_app_gravar',             'select git_app_gravar(''gitlab'', ''{"client_id":"x","client_secret":"y","retorno":"https://x"}'')'),
 ('git_conexao_remover',        'select git_conexao_remover(gen_random_uuid())'),
 ('git_estado_usar',            'select git_estado_usar(''estado-que-nao-e-meu'', ''github'')'),
 ('git_repo_ligar',             'select * from git_repo_ligar((select app from fx), gen_random_uuid(), ''1'', ''x/y'', null, ''main'')'),
 ('infra_auto_pedir',           'select * from infra_auto_pedir((select app from fx))'),
 ('infra_banco_remover',        'select infra_banco_remover(gen_random_uuid())'),
 ('infra_banco_salvar',         'select * from infra_banco_salvar((select app from fx), null, ''x'', ''aws'', ''postgres'', ''{public}'', ''postgresql://a:b@c/d'')'),
 ('infra_banco_supabase_ligar', 'select * from infra_banco_supabase_ligar((select app from fx), null, ''x'', gen_random_uuid())'),
 ('infra_quadro_publicar',      'select infra_quadro_publicar((select app from fx), ''software'', ''x'', ''x'', ''{}'')'),
 ('inv_conferir',               'select inv_conferir(gen_random_uuid(), gen_random_uuid(), true)'),
 ('inv_estoque',                'select inv_estoque(gen_random_uuid(), ''entrada'', gen_random_uuid(), 1)'),
 ('inv_estornar',               'select inv_estornar(gen_random_uuid())'),
 ('inv_movimentar',             'select inv_movimentar(gen_random_uuid(), ''entrega'', ''em_uso'')'),
 ('inv_pendencias_funcionario', 'select * from inv_pendencias_funcionario(gen_random_uuid())'),
 ('inv_preparar',               'select inv_preparar((select cliente from fx))'),
 ('lixeira_apagar',             'select lixeira_apagar(''item'', (select item2 from fx))'),
 ('lixeira_mover',              'select lixeira_mover(''item'', (select item from fx))'),
 ('lixeira_restaurar',          'select lixeira_restaurar(''item'', (select item2 from fx))'),
 ('pergunta_cancelar',          'select pergunta_cancelar(gen_random_uuid())'),
 ('pergunta_criar',             'select pergunta_criar((select item from fx), ''oi'')'),
 ('portal_criar',               'select portal_criar((select cliente from fx), ''meu'')'),
 ('portal_gerar_chave',         'select portal_gerar_chave((select portal from fx), ''x'')'),
 ('portal_revogar_chave',       'select portal_revogar_chave(gen_random_uuid())'),
 ('portal_webhook',             'select portal_webhook((select portal from fx), ''https://x'')'),
 ('servidores_lancar',          'select servidores_lancar(gen_random_uuid())'),
 ('studio_buscar',              'select * from studio_buscar(gen_random_uuid(), ''x'')'),
 ('studio_documentos',          'select * from studio_documentos(gen_random_uuid())'),
 ('supa_app_gravar',            'select supa_app_gravar(''00000000-0000-0000-0000-000000000001'', ''sba_x'', ''https://x'')'),
 ('supa_conexao_remover',       'select supa_conexao_remover(gen_random_uuid())'),
 ('supa_estado_usar',           'select supa_estado_usar(''estado-que-nao-e-meu'')'),
 ('supa_pode_editar',           'select supa_pode_editar((select app from fx))'),
 -- as que respondem sobre a própria pessoa (nada do William)
 ('ia_marcar_visto (só a própria pessoa)', 'select ia_marcar_visto()'),
 ('ia_novidades (só a própria pessoa)',    'select ia_novidades()'),
 ('ia_posso (só a própria pessoa)',        'select ia_posso()'),
 ('lixeira_listar (só o que a pessoa vê)', 'select * from lixeira_listar() where id in (select id from itens union select id from nos)'),
 ('portais_clientes (só o que a pessoa vê)', 'select * from portais_clientes() x where x in (select cliente from fx)')
) v(n, q);
reset role;
-- três devolvem dado público de propósito (sem segredo): conferido à parte
set local role authenticated;
insert into r select pg_temp.ok(supa_eu() = (select fora from fx), 'supa_eu devolve a própria pessoa, não outra');
insert into r select pg_temp.ok(git_apps_status()::text !~* 'secret|pem|segredo', 'git_apps_status: só nome e id público do app (sem segredo)');
insert into r select pg_temp.ok(supa_app_status()::text !~* 'secret', 'supa_app_status: só id público do app (sem segredo)');
-- git_estado_novo: cria um estado da PRÓPRIA pessoa, para ela ligar a conta dela (conferido depois, como dono)
create temp table ge (s text); grant all on ge to authenticated;
insert into ge select git_estado_novo('github');
-- supa_estado_novo: cria um estado da PRÓPRIA pessoa (ou recusa se o app não está configurado)
insert into r select pg_temp.nega('select 1 from interno.supa_estados where pessoa_id = (select will from fx)', 'supa_estado_novo não mexe nos estados do William');
reset role;
insert into r select pg_temp.ok((select e.pessoa_id from interno.git_estados e where e.estado = (select s from ge)) = (select fora from fx), 'git_estado_novo: o estado é da própria pessoa (para ligar a conta dela), nada do William');
select linha from r order by linha;
select pg_temp.ok((select excluido_em is not null from itens where id = (select item2 from fx)) and (select excluido_em is null from itens where id = (select item from fx)),
  'os itens do William continuam como estavam (um na lixeira, outro fora)');
select pg_temp.ok((select count(*) from r) = 51, 'as 51 funções testadas (' || (select count(*) from r) || ' linhas)');
-- regra geral: nenhuma security definer do public chamável por quem está logado; a porta é security invoker
select pg_temp.ok(not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')), 'nenhuma security definer do public pode ser chamada por quem está logado (aviso 0029)');
select pg_temp.ok((select count(*) from pg_proc p where p.pronamespace = 'logica'::regnamespace) >= 51
  and not exists (select 1 from pg_proc p where p.pronamespace = 'logica'::regnamespace and not exists (select 1 from pg_proc q where q.pronamespace = 'public'::regnamespace and q.proname = p.proname and not q.prosecdef))
  and not has_schema_privilege('anon', 'logica', 'USAGE'), 'cada corpo em logica tem a porta fina no public; anon não entra em logica');
select pg_temp.ok(not exists (select 1 from pg_proc p where p.pronamespace = 'logica'::regnamespace and has_function_privilege('anon', p.oid, 'EXECUTE')), 'anon não executa nada de logica');
rollback;
