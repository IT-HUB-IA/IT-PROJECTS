-- SOMENTE TESTE LOCAL: parte 61 (S9). Roda depois de todas as partes e dos usuários de teste (91). Numa transação que volta atrás.
\set ON_ERROR_STOP 1
\pset tuples_only on
begin;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;
-- GitHub: app com segredo do aviso; o mesmo aviso assinado duas vezes
insert into interno.git_apps (provedor, dados, publico) values ('github', '{"webhook_secret":"segredo-teste"}', '{}')
  on conflict (provedor) do update set dados = excluded.dados;
create temp table av as select '{"ref":"refs/heads/main","after":"abc123","repository":{"id":999},"installation":{"id":777}}'::text corpo;
alter table av add column ass text; update av set ass = 'sha256=' || encode(extensions.hmac(convert_to(corpo, 'UTF8'), convert_to('segredo-teste', 'UTF8'), 'sha256'), 'hex');
create temp table res (n int, r jsonb);
insert into res select 1, git_receber_github('push', ass, corpo) from av;
insert into res select 2, git_receber_github('push', ass, corpo) from av;
select pg_temp.ok((select r->>'ok' = 'true' and r->'repetido' is null from res where n = 1), 'GitHub: o primeiro aviso é processado');
select pg_temp.ok((select r @> '{"ok":true,"repetido":true}' from res where n = 2), 'GitHub: o mesmo aviso de novo responde "repetido" e não processa');
select pg_temp.ok((select (git_receber_github('push', 'sha256=00', corpo))->>'erro' = 'assinatura inválida' from av), 'GitHub: assinatura errada continua recusada (e não ocupa a lista)');
select pg_temp.ok((select count(*) from interno.webhook_recebidos) = 1, 'uma linha guardada (só o resumo, nunca o conteúdo)');
-- GitLab: repositório com segredo próprio
insert into public.repositorios (no_id, provedor, nome) select id, 'gitlab', 'teste/aviso' from nos where tipo = 'aplicacao' limit 1;
create temp table gl as select id, git_repo_segredo(id) seg from public.repositorios where nome = 'teste/aviso';
insert into res select 3, git_receber_gitlab(id, 'Push Hook', seg, '{"object_kind":"push","after":"def456"}') from gl;
insert into res select 4, git_receber_gitlab(id, 'Push Hook', seg, '{"object_kind":"push","after":"def456"}') from gl;
select pg_temp.ok((select r->>'ok' = 'true' and r->'repetido' is null from res where n = 3) and (select r @> '{"ok":true,"repetido":true}' from res where n = 4),
  'GitLab: o mesmo aviso duas vezes grava uma');
-- Portal: limite de 120 chamadas por minuto por chave
insert into public.portais (dono_id, no_id, nome) select (select id from pessoas where nome = 'William'), id, 'Portal teste' from nos where tipo = 'cliente' limit 1;
insert into public.portais_chaves (portal_id, nome, prefixo, resumo) select id, 'teste', 'cdp_xxxx', encode(extensions.digest('cdp_' || repeat('x', 40), 'sha256'), 'hex') from public.portais where nome = 'Portal teste';
do $$ declare i int; begin
  for i in 1 .. 120 loop perform public.portal_por_chave('cdp_' || repeat('x', 40)); end loop;
  raise notice 'OK    120 chamadas no mesmo minuto passam';
  begin perform public.portal_por_chave('cdp_' || repeat('x', 40)); raise notice 'FALHA a chamada 121 passou';
  exception when sqlstate '53400' then raise notice 'OK    a chamada 121 no mesmo minuto é recusada (53400, a função responde 429)'; end;
  for i in 1 .. 200 loop perform public.portal_por_chave('cdp_' || repeat('y', 40)); end loop;
end $$;
select pg_temp.ok(not exists (select 1 from interno.portal_chamadas where resumo = encode(extensions.digest('cdp_' || repeat('y', 40), 'sha256'), 'hex')), 'chave inventada não conta (nem ocupa espaço)');
rollback;
