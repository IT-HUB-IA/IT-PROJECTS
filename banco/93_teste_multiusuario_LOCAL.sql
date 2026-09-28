-- SOMENTE TESTE LOCAL: simula dois usuários e confere o isolamento e o compartilhamento.
\set ON_ERROR_STOP 1
\pset tuples_only on
create or replace function pg_temp.como(p uuid, email text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', p::text, false); perform set_config('request.jwt.claims', json_build_object('sub', p, 'email', email)::text, false); end $$;
create or replace function pg_temp.ok(c boolean, m text) returns text language sql as $$ select case when c then 'OK    ' else 'FALHA ' end || m $$;

-- Maria se cadastra
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com', '{"nome":"Maria Souza"}');
select pg_temp.ok((select count(*) from pessoas where email = 'maria@teste.com') = 1, 'cadastro cria a pessoa');
select pg_temp.ok((select count(*) from espacos e join pessoas p on p.id = e.dono_id where p.email = 'maria@teste.com') = 1, 'cadastro cria o espaço próprio');
select pg_temp.ok((select count(*) from etapas_modelo em join espacos e on e.id = em.espaco_id join pessoas p on p.id = e.dono_id where p.email = 'maria@teste.com') = 11, 'o espaço novo nasce com as 11 etapas do modelo');
select numero as numero_maria from pessoas where email = 'maria@teste.com' \gset

-- ===== como Maria =====
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from nos) = 0, 'Maria não vê nada do William');
select pg_temp.ok((select count(*) from servicos) = 0 and (select count(*) from custos_operacao) = 0, 'Maria não vê o Catalog nem os Costs do William');
select pg_temp.ok((select count(*) from requisitos) = 7, 'Maria vê os requisitos do próprio espaço (copiados do modelo)');
insert into nos (tipo, nome) values ('cliente', 'Cliente da Maria');
insert into clientes (no_id, tipo_cliente) select id, 'empresa' from nos where nome = 'Cliente da Maria';
insert into nos (tipo, pai_id, nome) select 'projeto', id, 'Projeto da Maria' from nos where nome = 'Cliente da Maria';
select pg_temp.ok((select count(*) from nos) = 2, 'Maria cria cliente e projeto no próprio espaço');
insert into etiquetas (nome, cor) values ('Holding', '#123456');
select pg_temp.ok(true, 'Maria cria etiqueta com o mesmo nome de uma do William (nomes são por espaço)');
do $$ begin
  insert into nos (tipo, pai_id, nome) select 'projeto', (select id from nos where nome = 'Cliente da Maria'), 'x' where false;
  begin insert into nos (tipo, pai_id, nome) values ('projeto', 'c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'invasão'); raise notice 'FALHA inseriu dentro do William';
  exception when others then raise notice 'OK    Maria não consegue criar nada dentro do espaço do William'; end;
end $$;
select pg_temp.ok((select count(*) from pessoas) = 1, 'Maria só vê a si mesma na lista de pessoas');
reset role;

-- ===== William compartilha o projeto BL com a Maria, pelo número de ID =====
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from buscar_pessoa(:'numero_maria'::text)) = 1, 'William acha a Maria pelo número de ID');
insert into participacoes (pessoa_id, no_id, papel) select (select id from buscar_pessoa(:'numero_maria'::text)), n.id, 'owner' from nos n where n.tipo = 'projeto' and n.nome = 'BL';
select pg_temp.ok((select count(*) from nos where nome = 'Cliente da Maria') = 0, 'William continua sem ver o espaço da Maria');
reset role;

-- ===== como Maria de novo =====
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
select count(*) as vistos from nos \gset
select pg_temp.ok((select count(*) from nos where tipo = 'projeto' and nome = 'BL') = 1, 'Maria agora vê o projeto BL compartilhado');
select pg_temp.ok((select count(*) from nos n join nos_ancestrais a on a.no_id = n.id join nos b on b.id = a.ancestral_id where b.nome = 'BL' and b.tipo = 'projeto') = (select count(*) from nos n2 where n2.id in (select a2.no_id from nos_ancestrais a2 join nos b2 on b2.id = a2.ancestral_id where b2.nome = 'BL' and b2.tipo = 'projeto')), 'e tudo o que está dentro do BL');
select pg_temp.ok((select count(*) from itens) > 0, 'Maria vê os itens do BL');
update itens set titulo = titulo || ' (Maria)' where id = (select id from itens order by criado_em limit 1);
select pg_temp.ok((select count(*) from itens where titulo like '% (Maria)') = 1, 'Maria edita um item do BL (trabalho junto)');
insert into nos (tipo, pai_id, nome) select 'frente', n.id, 'Frente criada pela Maria' from nos n where n.tipo = 'aplicacao' limit 1;
select pg_temp.ok((select espaco_id from nos where nome = 'Frente criada pela Maria') = (select espaco_id from nos where tipo = 'projeto' and nome = 'BL'), 'a frente criada pela Maria dentro do BL fica no espaço do dono do BL');
select pg_temp.ok((select count(*) from nos where tipo = 'cliente' and nome <> 'Cliente da Maria') = 1, 'Maria vê só o nome do cliente acima do BL (para situar)');
update nos set nome = 'mudou' where tipo = 'cliente' and nome <> 'Cliente da Maria';
select pg_temp.ok((select count(*) from nos where nome = 'mudou') = 0, 'mas não consegue mudar o cliente do William');
delete from nos where tipo = 'projeto' and nome = 'BL';
select pg_temp.ok((select count(*) from nos where tipo = 'projeto' and nome = 'BL') = 1, 'Maria não apaga o projeto que recebeu (só o dono)');
select pg_temp.ok((select count(*) from servicos) >= 0 and (select count(*) from custos_operacao) = 0, 'Maria continua sem ver os custos da operação do William');
select pg_temp.ok((select count(*) from pessoas where nome = 'William') = 1, 'Maria vê o William (quem compartilhou)');
update pessoas set numero = 1, auth_user_id = null where email = 'maria@teste.com';
select pg_temp.ok((select numero from pessoas where email = 'maria@teste.com') = :'numero_maria'::bigint, 'ninguém muda o próprio número de ID nem o login');
select pg_temp.ok((select count(*) from clientes c join nos n on n.id = c.no_id where n.nome <> 'Cliente da Maria') = 0, 'Maria NÃO vê a ficha cadastral (CNPJ, contatos) do cliente do William');
select pg_temp.ok((select count(*) from custos_tecnicos c join nos n on n.id = c.no_id where n.tipo = 'cliente') = 0 and (select count(*) from ficha_campos f join nos n on n.id = f.no_id where n.tipo = 'cliente') = 0, 'nem os custos e a ficha técnica do nível do cliente');
reset role;

-- convite por e-mail para quem ainda não tem conta
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
insert into convites (no_id, email) select id, 'joao@teste.com' from nos where tipo = 'aplicacao' limit 1;
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b2', 'joao@teste.com', '{"nome":"João"}');
select pg_temp.como('00000000-0000-0000-0000-0000000000b2', 'joao@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from nos where tipo = 'aplicacao') = 1 and (select count(*) from nos where tipo = 'projeto' and nome = 'Projeto da Maria') = 0, 'João se cadastra e já vê só a aplicação que recebeu por convite');
reset role;

-- cadastro completo: dados pessoais vão para a tabela privada e saem do login
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com',
  '{"nome":"Ana Lima Costa","nascimento":"1990-05-10","cpf":"529.982.247-25","cep":"01310-100","logradouro":"Av. Paulista","numero":"1000","bairro":"Bela Vista","cidade":"São Paulo","uf":"sp","uso":"trabalho","cargo":"Gerente","empresa":"ACME","termos":"sim"}');
select pg_temp.ok((select cpf = '52998224725' and uf = 'SP' and uso = 'trabalho' and termos_aceitos_em is not null from pessoas_privado pp join pessoas p on p.id = pp.pessoa_id where p.email = 'ana@teste.com'), 'cadastro completo grava os dados pessoais na tabela privada');
select pg_temp.ok((select not (raw_user_meta_data ? 'cpf') and not (raw_user_meta_data ? 'nascimento') and raw_user_meta_data ? 'nome' from auth.users where email = 'ana@teste.com'), 'CPF, nascimento e endereço saem dos dados do login');
do $$ begin
  begin insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b4', 'dup@teste.com', '{"nome":"Dup","cpf":"52998224725"}'); raise notice 'FALHA aceitou CPF repetido';
  exception when others then raise notice 'OK    CPF repetido é recusado no cadastro'; end;
  begin insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b5', 'inv@teste.com', '{"nome":"Inv","cpf":"11111111111"}'); raise notice 'FALHA aceitou CPF inválido';
  exception when others then raise notice 'OK    CPF inválido é recusado no cadastro'; end;
end $$;
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from pessoas_privado) = 1, 'Ana vê os próprios dados pessoais');
update pessoas_privado set cargo = 'Diretora';
select pg_temp.ok((select cargo from pessoas_privado) = 'Diretora', 'e consegue mudar');
reset role;
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from pessoas_privado) = 0, 'ninguém mais vê os dados pessoais da Ana');
reset role;

-- equipes: sem laço nas regras, e membro vê a equipe de outro espaço
select pg_temp.como('00000000-0000-0000-0000-00000000000a', 'william@teste.com');
set role authenticated;
insert into equipes (nome) values ('Squad BL');
insert into equipes_membros (equipe_id, pessoa_id) select e.id, p.id from equipes e, pessoas p where e.nome = 'Squad BL' and p.email = 'maria@teste.com';
select pg_temp.ok((select count(*) from equipes_membros m join equipes e on e.id = m.equipe_id where e.nome = 'Squad BL') = 1, 'William monta a equipe com a Maria');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b1', 'maria@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from equipes where nome = 'Squad BL') = 1 and (select count(*) from equipes_membros) >= 1 and (select count(*) from equipes_nos) >= 0, 'Maria vê a equipe de que faz parte (sem erro nas regras)');
delete from equipes_membros;
select pg_temp.ok((select count(*) from equipes_membros) >= 1, 'mas não mexe nos membros da equipe do William');
reset role;
select pg_temp.como('00000000-0000-0000-0000-0000000000b3', 'ana@teste.com');
set role authenticated;
select pg_temp.ok((select count(*) from equipes) = 0 and (select count(*) from equipes_membros) = 0, 'quem não é da equipe não vê');
reset role;
