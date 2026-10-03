-- SOMENTE TESTE LOCAL: parte 54 (ligar banco do Supabase sem senha). Roda depois de todas as partes e dos usuários de teste (91).
-- Prova: só liga com a prova da conferência, recente e da própria pessoa; ninguém lê as chaves; o robô recebe o banco sem endereço.
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
create temp table t as select
  (select id from nos where nome = 'Java BL' and tipo = 'aplicacao') as app,
  (select espaco_id from nos where nome = 'Java BL' and tipo = 'aplicacao') as esp,
  (select id from pessoas where nome = 'William') as will,
  null::uuid as fora, null::uuid as con, null::uuid as prova, null::uuid as prova2, null::uuid as banco, null::text as estado, null::text as desafio;
grant all on t to authenticated, service_role;
-- a pessoa de fora se cadastra (ganha o próprio espaço)
select gen_random_uuid() as fora_auth \gset
insert into auth.users (id, email, raw_user_meta_data) values (:'fora_auth', 'fora-' || :'fora_auth' || '@teste.com', '{"nome":"Pessoa de Fora"}');
update t set fora = (select id from pessoas where auth_user_id = :'fora_auth');
select pg_temp.ok((select fora from t) is not null, 'pessoa de fora cadastrada');

-- ---------- 1. o app do Supabase: só o dono do sistema cadastra; ninguém lê o segredo ----------
select pg_temp.como(:'fora_auth'); set role authenticated;
do $$ begin perform supa_app_gravar('1b2c3d4e-0000-4000-8000-00000000abcd', 'segredo-123456', 'https://ciclodev.app/entrar.html?git=supabase'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'quem não é dono do sistema não cadastra o app');
reset role; select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin perform supa_app_gravar('sba_123456789abcdef', 'sba_123456789abcdef', 'https://ciclodev.app/entrar.html?git=supabase'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'o segredo (sba_) colado no campo Client ID é recusado');
do $$ begin perform supa_app_gravar('cliente-qualquer', 'segredo-123456', 'https://ciclodev.app/entrar.html?git=supabase'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'Client ID fora do formato do Supabase é recusado');
do $$ begin perform supa_app_gravar('1b2c3d4e-0000-4000-8000-00000000abcd', '1b2c3d4e-0000-4000-8000-00000000abcd', 'https://ciclodev.app/entrar.html?git=supabase'); raise exception 'aceitou'; exception when others then if sqlerrm = 'aceitou' then raise; end if; end $$;
select pg_temp.ok(true, 'segredo igual ao Client ID é recusado');
select pg_temp.ok((supa_app_gravar('1b2c3d4e-0000-4000-8000-00000000abcd', 'segredo-123456', 'https://ciclodev.app/entrar.html?git=supabase'))->>'pronto' = 'true', 'o dono cadastra o app do Supabase');
select pg_temp.ok(not (supa_app_status() ? 'client_secret'), 'a tela sabe que está pronto, sem ver o segredo');
do $$ begin perform supa_app_ler(); raise exception 'leu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'a tela não lê o segredo do app');
do $$ begin perform * from interno.supa_app; raise exception 'leu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'nem direto na tabela');

-- ---------- 2. o vai e volta com PKCE ----------
update t set estado = x->>'estado', desafio = x->>'desafio' from (select supa_estado_novo() x) s;
select pg_temp.ok(length((select estado from t)) = 48 and (select desafio from t) ~ '^[A-Za-z0-9_-]{43}$', 'William começa: estado e desafio (PKCE) para a janelinha');
reset role; select pg_temp.como(:'fora_auth'); set role authenticated;
do $$ begin perform supa_estado_usar((select estado from t)); raise exception 'usou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'a pessoa de fora não usa o estado do William');
reset role; select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
reset role; create temp table volta (x jsonb); grant all on volta to authenticated; set role authenticated;
insert into volta select supa_estado_usar((select estado from t)) x;
reset role;
select pg_temp.ok(rtrim(translate(encode(extensions.digest(x->>'verificador', 'sha256'), 'base64'), '+/', '-_'), '=') = (select desafio from t) and (x->>'espaco_id')::uuid = (select esp from t),
  'William volta: recebe o verificador que bate com o desafio, e o espaço dele') from volta;
set role authenticated;
do $$ begin perform supa_estado_usar((select estado from t)); raise exception 'usou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'o mesmo estado não vale duas vezes');

-- ---------- 3. a conta conectada: as chaves só a função vê ----------
do $$ begin perform supa_conexao_gravar((select esp from t), (select will from t), 'x', 'a', 'b', null, 'org-x'); raise exception 'gravou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'a tela não grava conta nem chave');
reset role; set role service_role;
update t set con = supa_conexao_gravar(esp, will, 'Empresa X', 'chave-acesso', 'chave-renova', now() + interval '1 hour', 'org-x');
-- a mesma organização de novo: não cria outra, só troca as chaves; outra organização vira outra conexão
create temp table orgs as select supa_conexao_gravar(esp, will, 'Empresa X', 'chave-nova', 'renova-nova', now() + interval '1 hour', 'org-x') x, supa_conexao_gravar(esp, will, 'Empresa Y', 'chave-y', null, null, 'org-y') y from t;
reset role;
select pg_temp.ok((select x from orgs) = (select con from t) and (select interno.segredo_de('interno.supa_tokens', conexao_id::text, 'acesso') from interno.supa_tokens where conexao_id = (select con from t)) = 'chave-nova', 'conectar de novo a mesma organização não repete: troca as chaves da conexão que já existe');
select pg_temp.ok((select y from orgs) <> (select con from t) and (select count(*) from supa_conexoes where espaco_id = (select esp from t)) = 2, 'outra organização vira outra conexão (o Supabase autoriza uma por vez)');
delete from supa_conexoes where id = (select y from orgs);
set role service_role;
reset role; select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
select pg_temp.ok((select count(*) from supa_conexoes where id = (select con from t)) = 1, 'William vê a conta do Supabase do espaço dele');
do $$ begin perform * from interno.supa_tokens; raise exception 'leu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'e não lê as chaves');
do $$ begin perform supa_conexao_ler((select con from t)); raise exception 'leu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'nem pela função');
reset role; select pg_temp.como(:'fora_auth'); set role authenticated;
select pg_temp.ok((select count(*) from supa_conexoes) = 0, 'a pessoa de fora não vê a conta do William');

-- ---------- 4. a prova da conferência ----------
do $$ begin perform supa_prova_gravar((select con from t), (select fora from t), 'abcdefghijklmnopqrst', 'P', '{public}', '{"ok":true,"so_leitura":true,"tabelas":3}'); raise exception 'gravou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém grava prova pela tela (só a função, depois de conferir)');
reset role; set role service_role;
do $$ begin perform supa_prova_gravar((select con from t), (select will from t), 'abcdefghijklmnopqrst', 'P', '{public}', '{"ok":false,"so_leitura":true,"tabelas":3}'); raise exception 'gravou'; exception when others then if sqlerrm = 'gravou' then raise; end if; end $$;
select pg_temp.ok(true, 'conferência que não passou não vira prova');
do $$ begin perform supa_prova_gravar((select con from t), (select will from t), 'abcdefghijklmnopqrst', 'P', '{public}', '{"ok":true,"so_leitura":false,"tabelas":3}'); raise exception 'gravou'; exception when others then if sqlerrm = 'gravou' then raise; end if; end $$;
select pg_temp.ok(true, 'leitura que não é só leitura não vira prova');
do $$ begin perform supa_prova_gravar((select con from t), (select will from t), 'abcdefghijklmnopqrst', 'P', '{public}', '{"ok":true,"so_leitura":true,"tabelas":0}'); raise exception 'gravou'; exception when others then if sqlerrm = 'gravou' then raise; end if; end $$;
select pg_temp.ok(true, 'conferência sem nenhuma tabela não vira prova');
update t set prova = supa_prova_gravar(con, will, 'abcdefghijklmnopqrst', 'Produção', '{public,app}', '{"ok":true,"so_leitura":true,"tabelas":12,"regras":4}');
update t set prova2 = supa_prova_gravar(con, will, 'abcdefghijklmnopqrst', 'Produção', '{public}', '{"ok":true,"so_leitura":true,"tabelas":12}');
reset role; update interno.supa_provas set criado_em = now() - interval '20 minutes' where id = (select prova2 from t);

-- ---------- 5. ligar com a prova ----------
reset role; select pg_temp.como(:'fora_auth'); set role authenticated;
do $$ begin perform infra_banco_supabase_ligar((select app from t), null, 'X', (select prova from t)); raise exception 'ligou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'a pessoa de fora não liga no ponto do William, nem com a prova dele');
reset role; select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin perform infra_banco_supabase_ligar((select app from t), null, 'X', gen_random_uuid()); raise exception 'ligou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'sem prova (inventada), não liga');
do $$ begin perform infra_banco_supabase_ligar((select app from t), null, 'X', (select prova2 from t)); raise exception 'ligou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'prova vencida (mais de 15 minutos), não liga');
update t set banco = (infra_banco_supabase_ligar(app, null, '', prova)).id;
select pg_temp.ok(b.supa_conexao_id = (select con from t) and b.supa_projeto = 'abcdefghijklmnopqrst' and b.provedor = 'supabase' and b.esquemas = '{public,app}' and b.nome = 'Produção'
  and b.servidor = 'abcdefghijklmnopqrst.supabase.co' and b.validado_em is not null and (b.validacao->>'tabelas')::int = 12, 'com a prova: liga, com os esquemas e o resultado da conferência')
  from infra_bancos b where b.id = (select banco from t);
do $$ begin perform infra_banco_supabase_ligar((select app from t), null, 'Outro', (select prova from t)); raise exception 'ligou'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'a mesma prova não vale duas vezes');
do $$ begin perform infra_banco_salvar((select app from t), (select banco from t), 'Produção', 'supabase', 'postgres', '{public}', null); raise exception 'mudou'; exception when others then if sqlerrm = 'mudou' then raise; end if; end $$;
select pg_temp.ok(true, 'mudar os esquemas sem conferir de novo é recusado');
select pg_temp.ok((infra_banco_salvar(app, banco, 'Produção 2', 'supabase', 'postgres', '{public,app}', null)).nome = 'Produção 2', 'só o nome pode mudar sem conferir') from t;
reset role;
select pg_temp.ok(not exists (select 1 from interno.infra_bancos_conexao where banco_id = (select banco from t)), 'ligado pelo Supabase: nenhum endereço nem senha guardados');

-- ---------- 6. o robô recebe o banco sem endereço ----------
insert into infra_automacoes (no_id, origem) select app, 'manual' from t;
set role service_role;
select pg_temp.ok(exists (select 1 from jsonb_array_elements(infra_auto_proximos(5)) p, jsonb_array_elements(p->'bancos') b
  where b->>'id' = (select banco::text from t) and b->>'supa_projeto' = 'abcdefghijklmnopqrst' and b->>'supa_conexao_id' = (select con::text from t) and b->'conexao' = 'null'::jsonb), 'a fila entrega ao robô o banco do Supabase (projeto e conta, sem endereço)');
select pg_temp.ok(exists (select 1 from jsonb_array_elements(infra_auto_bancos_devidos(20)) b where b->>'id' = (select banco::text from t)), 'e a leitura de hora em hora também');
reset role;

-- ---------- 7. tirar a conta ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a'); set role authenticated;
do $$ begin perform supa_conexao_remover((select con from t)); raise exception 'tirou'; exception when others then if sqlerrm = 'tirou' then raise; end if; end $$;
select pg_temp.ok(true, 'com banco ligado, a conta não sai (pede para desligar antes)');
-- voltar para o jeito do endereço: sai do Supabase
select pg_temp.ok(b.supa_conexao_id is null and b.supa_projeto is null and b.validacao is null, 'colar um endereço volta o banco para o jeito antigo')
  from (select (infra_banco_salvar(app, banco, 'Produção 2', 'supabase', 'postgres', '{public}', 'postgresql://leitura_ciclodev.abc:SenhaBoa123@aws-0-sa-east-1.pooler.supabase.com:5432/postgres')).* from t) b;
do $$ begin perform supa_conexao_remover((select con from t)); end $$;
select pg_temp.ok((select count(*) = 0 from supa_conexoes where id = (select con from t)), 'sem banco ligado, a conta sai');
reset role;
select pg_temp.ok(not exists (select 1 from interno.supa_tokens where conexao_id = (select con from t)), 'e as chaves dela saem junto');
-- limpeza
delete from infra_bancos where id = (select banco from t);
delete from infra_automacoes where no_id = (select app from t) and origem = 'manual' and status <> 'pronto';
delete from interno.supa_app;
