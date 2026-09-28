-- SOMENTE TESTE LOCAL: Agent Studio (rodar depois do 94, num banco com a parte 17)
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when c then 'OK    ' else 'FALHA ' end || m $$;

select pg_temp.ok(to_regclass('public.agentes') is null and to_regclass('public.agentes_fontes') is null and to_regclass('public.agentes_ferramentas') is null
  and to_regclass('public.agentes_execucoes') is null and to_regclass('public.agentes_avaliacoes') is null, 'as 5 tabelas dos agentes antigos saíram');
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_mensagens' and column_name = 'agente_id'), 'pedidos_mensagens sem agente_id');

-- o corte em trechos
select pg_temp.ok((select count(*) from interno.studio_cortar(E'# Livro\n\nIntro.\n\n## Capítulo 1\n\nTexto um.\n\n### Parte A\n\nTexto A.\n\n## Capítulo 2\n\nTexto dois.')) = 4, 'corta em um trecho por seção');
select pg_temp.ok((select secao from interno.studio_cortar(E'# Livro\n\n## Capítulo 1\n\n### Parte A\n\nTexto A.') where texto = 'Texto A.') = 'Livro › Capítulo 1 › Parte A', 'cada trecho sabe o capítulo de onde veio');
select pg_temp.ok((select count(*) from interno.studio_cortar(repeat('palavra ', 1000))) = 4 and (select max(length(texto)) from interno.studio_cortar(repeat('palavra ', 1000))) <= 2000, 'parágrafo gigante vira pedaços de até 2.000 caracteres');
select pg_temp.ok((select string_agg(texto, ' ' order by ordem) from interno.studio_cortar(repeat('palavra ', 1000))) = btrim(repeat('palavra ', 1000)), 'nenhuma palavra se perde no corte');

-- Maria (usuária comum) não vê nada do Studio
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from studio_agentes) = 0, 'Maria não vê o agente');
do $$ begin
  begin insert into studio_conhecimento (agente_id, titulo, conteudo) values ('5f0c1d2e-0000-4000-8000-00000000c1c0', 'x', 'x'); raise notice 'FALHA Maria colocou conhecimento';
  exception when insufficient_privilege then raise notice 'OK    Maria não coloca conhecimento'; end;
  begin perform studio_buscar('5f0c1d2e-0000-4000-8000-00000000c1c0', 'qualquer'); raise notice 'FALHA Maria buscou no conhecimento';
  exception when insufficient_privilege then raise notice 'OK    Maria não busca no conhecimento'; end;
  begin perform studio_documentos('5f0c1d2e-0000-4000-8000-00000000c1c0'); raise notice 'FALHA Maria listou os documentos';
  exception when insufficient_privilege then raise notice 'OK    Maria não lista os documentos'; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform count(*) from studio_conhecimento; raise notice 'FALHA anon leu o conhecimento';
  exception when insufficient_privilege then raise notice 'OK    sem login ninguém lê o conhecimento'; end;
end $$;
reset role;

-- William (dono do sistema)
select pg_temp.como((select auth_user_id from pessoas where id = 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'), 'william@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from studio_agentes where instrucoes = '' and not ativo) = 1, 'William vê o agente, em branco e desligado');
update studio_agentes set instrucoes = 'Versão 1' where id = '5f0c1d2e-0000-4000-8000-00000000c1c0';
update studio_agentes set instrucoes = 'Versão 2' where id = '5f0c1d2e-0000-4000-8000-00000000c1c0';
select pg_temp.ok((select count(*) from studio_instrucoes_versoes) = 1 and (select instrucoes from studio_instrucoes_versoes) = 'Versão 1', 'a versão anterior das instruções fica guardada');
insert into studio_conhecimento (agente_id, titulo, arquivo_nome, conteudo) values ('5f0c1d2e-0000-4000-8000-00000000c1c0', 'Livro de teste', 'livro.md',
  E'# Gestão de projetos\n\n## Prioridade\n\nA priorização por valor ajuda o time a escolher o que entregar primeiro.\n\n## Estimativa\n\nEstimativas ficam melhores quando o time compara com entregas passadas.');
select pg_temp.ok((select count(*) from studio_trechos) = 2, 'o livro virou trechos sozinho');
select pg_temp.ok((select trechos = 2 and caracteres > 0 from studio_documentos('5f0c1d2e-0000-4000-8000-00000000c1c0')), 'a lista da tela mostra os trechos de cada documento');
select pg_temp.ok((select tokens_estimados > 0 and caracteres > 0 and versao = 1 from studio_conhecimento), 'tamanho e tokens calculados');
select pg_temp.ok((select secao from studio_buscar('5f0c1d2e-0000-4000-8000-00000000c1c0', 'como priorizar entregas') limit 1) = 'Gestão de projetos › Prioridade', 'a busca acha o trecho certo (com palavras parecidas: priorizar/priorização)');
select pg_temp.ok((select count(*) from studio_buscar('5f0c1d2e-0000-4000-8000-00000000c1c0', 'estimativas passadas')) = 1, 'busca de outro capítulo');
update studio_conhecimento set conteudo = E'# Só um capítulo\n\nTexto novo.' where titulo = 'Livro de teste';
select pg_temp.ok((select count(*) from studio_trechos) = 1 and (select versao from studio_conhecimento) = 2, 'trocar o texto refaz os trechos e sobe a versão');
update studio_conhecimento set ativo = false;
select pg_temp.ok((select count(*) from studio_buscar('5f0c1d2e-0000-4000-8000-00000000c1c0', 'texto novo')) = 0, 'documento desligado sai da busca');
do $$ begin
  begin insert into studio_trechos (documento_id, ordem, texto) select id, 99, 'x' from studio_conhecimento; raise notice 'FALHA gravou trecho na mão';
  exception when insufficient_privilege then raise notice 'OK    trechos só pelo gatilho'; end;
  begin insert into studio_funcoes (agente_id, nome, acao, pede_confirmacao) values ('5f0c1d2e-0000-4000-8000-00000000c1c0', 'Apagar tarefa', 'apagar', false); raise notice 'FALHA função de apagar sem confirmação';
  exception when check_violation then raise notice 'OK    apagar sempre pede confirmação'; end;
end $$;
insert into studio_funcoes (agente_id, nome, acao) values ('5f0c1d2e-0000-4000-8000-00000000c1c0', 'Listar tarefas', 'ler');
select pg_temp.ok((select count(*) from studio_funcoes where not ativo) = 1, 'função nasce desligada');
delete from studio_conhecimento;
select pg_temp.ok((select count(*) from studio_trechos) = 0, 'apagar o documento apaga os trechos');
-- deixa o agente como estava
delete from studio_funcoes; delete from studio_instrucoes_versoes;
reset role;
update studio_agentes set instrucoes = '' where id = '5f0c1d2e-0000-4000-8000-00000000c1c0';
delete from studio_instrucoes_versoes;
