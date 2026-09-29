-- SOMENTE TESTE LOCAL: parte 23 (portal do stakeholder). Roda depois das partes 00 a 20, 22 e 23 e dos usuários de teste (91).
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when coalesce(c, false) then 'OK    ' else 'FALHA ' end || m $$;

create temp table t as select
  (select id from pessoas where auth_user_id = '00000000-0000-0000-0000-00000000000a') as william,
  (select id from nos where tipo = 'cliente' and nome = 'Blanco & Lisboa') as bl,
  (select i.id from itens i join nos_ancestrais a on a.no_id = i.frente_id join nos c on c.id = a.ancestral_id and c.tipo = 'cliente' and c.nome = 'Blanco & Lisboa'
    where i.tipo = 'epic' and i.arquivado_em is null order by i.criado_em limit 1) as epico,
  null::uuid as portal, null::text as chave, null::uuid as pergunta, null::uuid as status_antes;
update t set status_antes = (select status_id from itens where id = t.epico);
grant all on t to authenticated, service_role;

-- ---------- William cria o portal da Blanco & Lisboa ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
update t set portal = portal_criar(t.bl, 'Blanco & Lisboa');
select pg_temp.ok((select portal from t) is not null, 'William cria o portal do cliente Blanco & Lisboa');
select pg_temp.ok(exists (select 1 from status_fluxo where no_id = (select bl from t) and chave = 'aguardando_stakeholder' and grupo = 'blocked'), 'o status "Aguardando stakeholder" nasce no cliente');
insert into portais_membros (portal_id, email, nome) select portal, 'lucas@blancolisboa.com', 'Lucas' from t;
insert into portais_membros (portal_id, email, nome) select portal, 'adrian@blancolisboa.com', 'Adrian' from t;
select pg_temp.ok((select count(*) from portais_membros) = 2, 'William convida Lucas e Adrian');
update t set chave = portal_gerar_chave(t.portal, 'Java B&L');
select pg_temp.ok((select chave from t) like 'cdp_%' and length((select chave from t)) > 40, 'a chave aparece uma vez, começando por cdp_');
reset role;
select pg_temp.ok((select count(*) from portais_chaves where resumo = encode(extensions.digest((select chave from t), 'sha256'), 'hex')) = 1, 'o banco guarda só o resumo da chave');
set role authenticated;
select pg_temp.ok(portal_webhook((select portal from t), 'https://java.blancolisboa.com/ciclodev') like 'cdw_%', 'o segredo do webhook aparece uma vez');
do $$ begin perform webhook_segredo from portais_segredos; raise exception 'leu o segredo'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'ninguém lê o segredo do webhook pela tela');
do $$ begin perform portal_painel((select portal from t)); raise exception 'chamou função da portal-api'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'a tela não chama as funções da portal-api');

-- ---------- William manda uma pergunta a partir do épico ----------
update t set pergunta = pergunta_criar(t.epico, 'O layout novo do painel pode ir para o ar na sexta?');
select pg_temp.ok((select pergunta from t) is not null, 'a pergunta é criada no épico');
select pg_temp.ok((select sf.chave from itens i join status_fluxo sf on sf.id = i.status_id where i.id = (select epico from t)) = 'aguardando_stakeholder', 'o épico passa para "Aguardando stakeholder"');
select pg_temp.ok((select count(*) from portais_eventos where tipo = 'pergunta_criada') = 1, 'o aviso de pergunta nova entra na fila');
do $$ begin perform pergunta_criar((select i.id from itens i join nos_ancestrais a on a.no_id = i.frente_id where a.ancestral_id <> (select bl from t) and i.frente_id not in (select no_id from nos_ancestrais where ancestral_id = (select bl from t)) limit 1), 'x');
  raise exception 'perguntou fora do portal'; exception when others then if sqlerrm = 'perguntou fora do portal' then raise; end if; end $$;
select pg_temp.ok(true, 'item fora de um cliente com portal não aceita pergunta');
reset role;

-- ---------- alguém de fora não vê nada do portal ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000d', 'bruno@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from portais) = 0 and (select count(*) from portais_membros) = 0 and (select count(*) from portais_chaves) = 0, 'Bruno não vê o portal, os convidados nem as chaves');
reset role;

-- ---------- o Java chama a portal-api (service_role) ----------
set role service_role;
select pg_temp.ok((select count(*) from portal_por_chave((select chave from t))) = 1, 'a chave certa abre o portal');
select pg_temp.ok((select count(*) from portal_por_chave('cdp_errada')) = 0, 'chave errada não abre nada');
select pg_temp.ok(jsonb_array_length(portal_estrutura((select portal from t))) > 3, 'a Estrutura do cliente vem com as partes');
select pg_temp.ok((portal_painel((select portal from t)) -> 'numeros' ->> 'perguntas_esperando')::int = 1, 'o painel mostra 1 pergunta esperando');
select pg_temp.ok(jsonb_array_length(portal_quadro((select portal from t)) -> 'colunas') = 6, 'o quadro analítico vem com as 6 colunas do fluxo');
select pg_temp.ok((select count(*) from jsonb_array_elements(portal_quadro((select portal from t)) -> 'colunas') c, jsonb_array_elements(c -> 'epicos') e where (e ->> 'id')::uuid = (select epico from t) and c ->> 'grupo' = 'blocked') = 1, 'o épico aparece na coluna "Travado ou esperando"');
select pg_temp.ok(portal_item((select portal from t), (select epico from t)) -> 'perguntas' -> 0 ->> 'status' = 'aguardando', 'o épico em modo apresentação mostra a pergunta esperando');
select pg_temp.ok(jsonb_array_length(portal_perguntas((select portal from t))) = 1, 'a lista de perguntas esperando tem 1');
do $$ begin perform portal_responder((select portal from t), (select pergunta from t), 'intruso@x.com', 'sim'); raise exception 'intruso respondeu'; exception when insufficient_privilege then null; end $$;
select pg_temp.ok(true, 'e-mail que não é convidado não responde');
select pg_temp.ok(portal_responder((select portal from t), (select pergunta from t), 'Lucas@BlancoLisboa.com', 'Pode sim, já aprovamos.') ->> 'status' = 'respondida', 'Lucas responde pelo Java');
select pg_temp.ok((select status_id from itens where id = (select epico from t)) = (select status_antes from t), 'o épico volta para o status que tinha');
select pg_temp.ok((select count(*) from comentarios where item_id = (select epico from t) and texto like 'Resposta do stakeholder (Lucas)%Pode sim, já aprovamos.') = 1, 'a resposta vira comentário no épico');
select pg_temp.ok((select count(*) from notificacoes where pessoa_id = (select william from t) and titulo like 'Resposta do stakeholder:%') = 1, 'William recebe o aviso no sininho');
select pg_temp.ok((select count(*) from portais_eventos where tipo = 'pergunta_respondida') = 1, 'o aviso de resposta entra na fila');
select pg_temp.ok(jsonb_array_length(portal_eventos_lista((select portal from t), 0)) = 2, 'o Java também busca os avisos pela lista');
do $$ begin perform portal_responder((select portal from t), (select pergunta from t), 'adrian@blancolisboa.com', 'de novo'); raise exception 'respondeu duas vezes'; exception when others then if sqlerrm = 'respondeu duas vezes' then raise; end if; end $$;
select pg_temp.ok(true, 'uma pergunta respondida não aceita outra resposta');
reset role;

-- ---------- cancelar e revogar ----------
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
update t set pergunta = pergunta_criar(t.epico, 'Outra dúvida');
select pergunta_cancelar((select pergunta from t));
select pg_temp.ok((select status_id from itens where id = (select epico from t)) = (select status_antes from t), 'cancelar a pergunta volta o épico para o status de antes');
select portal_revogar_chave((select id from portais_chaves limit 1));
reset role;
set role service_role;
select pg_temp.ok((select count(*) from portal_por_chave((select chave from t))) = 0, 'chave revogada não abre mais o portal');
reset role;
select 'FIM DO TESTE DO PORTAL';
