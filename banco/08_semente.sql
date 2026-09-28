-- =====================================================================
-- CicloDev · 08 · Semente: os dados de exemplo que o sistema já mostra (gerado por gerar_semente.py)
-- Pode rodar de novo: nada duplica. As datas relativas foram calculadas em 2026-09-26.
-- =====================================================================
begin;
-- a semente não entra no registro de auditoria (o histórico de exemplo é carregado no fim)
alter table public.nos disable trigger nos_auditoria;
alter table public.itens disable trigger itens_auditoria;
alter table public.itens disable trigger itens_automacoes;
alter table public.comentarios disable trigger comentarios_auditoria;
alter table public.pedidos disable trigger pedidos_auditoria;
alter table public.custos_tecnicos disable trigger custos_tecnicos_auditoria;
alter table public.receitas disable trigger receitas_auditoria;
alter table public.regras_calculo disable trigger regras_calculo_auditoria;
alter table public.pessoas_custos disable trigger pessoas_custos_auditoria;
alter table public.servicos disable trigger servicos_auditoria;
alter table public.agentes disable trigger agentes_auditoria;
alter table public.marcos disable trigger marcos_auditoria;
alter table public.sprints disable trigger sprints_auditoria;
alter table public.automacoes disable trigger automacoes_auditoria;

insert into public.pessoas (id, nome, funcao, habilidades, capacidade_h, papel) values
  ('d148fdc5-eef3-5398-bf89-f49b55b5cd28', 'William', 'Master · Owner', array['Produto','Arquitetura','Java']::text[], 40, 'master'),
  ('b5510531-2c75-59fb-b2c1-006a90d0775f', 'Ana (exemplo)', 'Dev', array['Java','JavaFX','Supabase']::text[], 40, 'dev'),
  ('29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'Bruno (exemplo)', 'Dev', array['Flutter','APIs','QA']::text[], 30, 'dev'),
  ('2246aac4-fcc9-5564-af95-054b9cc42889', 'CEO da B&L (exemplo)', 'Stakeholder', '{}'::text[], 0, 'stakeholder')
on conflict (id) do nothing;

insert into public.nos (id, tipo, pai_id, nome, status, motivo_pausa, ordem) values
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'cliente', null, 'Blanco & Lisboa', 'ativo', null, 0),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'projeto', 'a615f8ab-48db-550e-bbe7-f11524ae2669', 'BL', 'ativo', null, 0),
  ('c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Blanco & Lisboa', 'ativo', null, 0),
  ('70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'YOU Contabilidade', 'ativo', null, 1),
  ('d7a972f1-13d0-562c-a612-018dd01688de', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Realizze', 'ativo', null, 2),
  ('4a599062-267a-58ea-999c-8ae3c67c2519', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'BEEC', 'pausado', 'Aguardando definição do escopo de tráfego pago', 3),
  ('554bf641-779b-5731-8e63-08e275e9b8ef', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Gestão de Lojas', 'ativo', null, 4),
  ('4f3b7efc-e53e-5260-b5ee-fdf6e3a92da3', 'produto', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Cobrança 40%', 'ativo', null, 5),
  ('3991414f-b7a6-5abf-a62e-064efa9a9adf', 'aplicacao', 'c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'Java BL', 'ativo', null, 0),
  ('38ff5917-3d08-5887-ba5f-57a82861493f', 'aplicacao', 'c2c5b9eb-d8ab-5f51-8a45-aae53d38a74a', 'App celular do CEO', 'ativo', null, 1),
  ('d23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Fiscal', 'ativo', null, 2),
  ('3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Financeiro', 'ativo', null, 3),
  ('3435d48c-e3bc-5887-a742-b1500492faf0', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Pessoal', 'ativo', null, 4),
  ('b3e427e0-9332-567b-8915-a2363b97dc03', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'Java Societário', 'ativo', null, 5),
  ('c37cc0c0-2eec-59e2-bebf-989417c684ee', 'aplicacao', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'App Área do Cliente', 'ativo', null, 6),
  ('28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'aplicacao', 'd7a972f1-13d0-562c-a612-018dd01688de', 'Java Realizze', 'ativo', null, 7),
  ('e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'aplicacao', '4a599062-267a-58ea-999c-8ae3c67c2519', 'Java BEEC', 'pausado', 'Pausado junto com o produto BEEC', 8),
  ('755ed714-e550-5cb4-a418-a437bda3ba4d', 'aplicacao', '554bf641-779b-5731-8e63-08e275e9b8ef', 'Java Gestão de Lojas', 'ativo', null, 9),
  ('3894255a-60fd-5aef-aea7-10dc60f62d87', 'aplicacao', '4f3b7efc-e53e-5260-b5ee-fdf6e3a92da3', 'Java Cobrança 40%', 'ativo', null, 10),
  ('27ed01ff-b4ea-5354-aaa2-c34d711304d0', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Frontend', 'ativo', null, 0),
  ('a1683a67-a153-5423-94a5-791ae7b85df9', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Backend', 'ativo', null, 1),
  ('00d6a88c-4baf-50e4-a0b7-72c2e36a21af', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Database', 'ativo', null, 2),
  ('127109a4-0854-5e51-af3d-3864af4a1b0d', 'frente', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'AI', 'ativo', null, 3),
  ('71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', 'frente', '38ff5917-3d08-5887-ba5f-57a82861493f', 'Frontend', 'ativo', null, 4),
  ('f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', 'frente', '38ff5917-3d08-5887-ba5f-57a82861493f', 'Backend', 'ativo', null, 5),
  ('6c7a5b20-1287-516f-977b-6b3bb8710fc6', 'frente', '38ff5917-3d08-5887-ba5f-57a82861493f', 'Database', 'ativo', null, 6),
  ('68118257-a8c5-5852-a1b0-c0192c4e705f', 'frente', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Frontend', 'ativo', null, 7),
  ('0b5048b2-af47-59de-8fd1-8bc8bf2c8470', 'frente', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Backend', 'ativo', null, 8),
  ('5ab3fbab-102b-57f7-a47c-8f5ac0beb539', 'frente', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Database', 'ativo', null, 9),
  ('3cb585a7-ec87-5719-aabf-7022b23dc2c2', 'frente', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Frontend', 'ativo', null, 10),
  ('c63be23e-3cfb-552e-86ae-dadb7d703e31', 'frente', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Backend', 'ativo', null, 11),
  ('f8334e5a-01f7-5bf9-8791-ba6af14d553f', 'frente', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Database', 'ativo', null, 12),
  ('31b004d0-22b5-5593-be68-960f2e3d4560', 'frente', '3435d48c-e3bc-5887-a742-b1500492faf0', 'Frontend', 'ativo', null, 13),
  ('9de59366-98dd-54bc-b1fc-7f54725a318b', 'frente', '3435d48c-e3bc-5887-a742-b1500492faf0', 'Backend', 'ativo', null, 14),
  ('4ca8f123-6951-554a-a513-5eb7f1c680c2', 'frente', '3435d48c-e3bc-5887-a742-b1500492faf0', 'Database', 'ativo', null, 15),
  ('b5d98785-0784-5d52-8e41-a4a8ee065f98', 'frente', 'b3e427e0-9332-567b-8915-a2363b97dc03', 'Frontend', 'ativo', null, 16),
  ('ce5e204e-18a7-54ba-bf94-6dd9581e94e6', 'frente', 'b3e427e0-9332-567b-8915-a2363b97dc03', 'Backend', 'ativo', null, 17),
  ('69aa1e69-cff6-507a-b2fb-99de444826e6', 'frente', 'b3e427e0-9332-567b-8915-a2363b97dc03', 'Database', 'ativo', null, 18),
  ('22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', 'frente', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Frontend', 'ativo', null, 19),
  ('7b6911f0-12de-5ea1-9304-f811fb404c42', 'frente', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Backend', 'ativo', null, 20),
  ('8af0d9e4-9993-5bb4-83cc-2c1429054f96', 'frente', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Database', 'ativo', null, 21),
  ('072b1896-e400-5d6d-9d2f-6bd0bc25a70e', 'frente', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Frontend', 'ativo', null, 22),
  ('ef73d1da-63a0-5595-ae39-e5c65377918f', 'frente', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Backend', 'ativo', null, 23),
  ('a39cba16-716f-556d-838a-aef2dc1b314e', 'frente', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Database', 'ativo', null, 24),
  ('23362b3e-9566-5331-9496-6d7f6dea9339', 'frente', 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'Frontend', 'ativo', null, 25),
  ('7dad40b2-07a5-57df-b9c8-23a422d3ea36', 'frente', 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'Backend', 'ativo', null, 26),
  ('b1af5ab4-31f0-5c29-86dc-0b466c90282b', 'frente', 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'Database', 'ativo', null, 27),
  ('151159e9-006b-54c2-92c6-71ac19303628', 'frente', '755ed714-e550-5cb4-a418-a437bda3ba4d', 'Frontend', 'ativo', null, 28),
  ('3b0fdf80-1f60-5ada-a666-1c9bf9bff667', 'frente', '755ed714-e550-5cb4-a418-a437bda3ba4d', 'Backend', 'ativo', null, 29),
  ('0d5599d5-0ffc-5ea6-a763-bd51d6309ffa', 'frente', '755ed714-e550-5cb4-a418-a437bda3ba4d', 'Database', 'ativo', null, 30),
  ('5aa97a0f-6ca7-5ad4-9fa9-783fdd9ff6d6', 'frente', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Frontend', 'ativo', null, 31),
  ('a747a148-99f3-5f75-90d0-9d82e260970d', 'frente', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Backend', 'ativo', null, 32),
  ('98059cc2-df97-5ea7-a2df-1bfdcebbc4c8', 'frente', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Database', 'ativo', null, 33)
on conflict (id) do nothing;

insert into public.clientes (no_id, tipo_cliente, documento, holding_id) values
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'holding', null, null)
on conflict (no_id) do nothing;

insert into public.projetos (no_id, origem, inicio, alvo) values
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'brownfield', '2026-07-13', '2027-02-23')
on conflict (no_id) do nothing;

insert into public.aplicacoes (no_id, plataforma, origem_codigo, servico_id) values
  ('3991414f-b7a6-5abf-a62e-064efa9a9adf', 'desktop', 'proprio', null),
  ('38ff5917-3d08-5887-ba5f-57a82861493f', 'mobile', 'proprio', null),
  ('d23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'desktop', 'proprio', null),
  ('3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'desktop', 'proprio', null),
  ('3435d48c-e3bc-5887-a742-b1500492faf0', 'desktop', 'proprio', null),
  ('b3e427e0-9332-567b-8915-a2363b97dc03', 'desktop', 'proprio', null),
  ('c37cc0c0-2eec-59e2-bebf-989417c684ee', 'mobile', 'proprio', null),
  ('28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'desktop', 'proprio', null),
  ('e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd', 'desktop', 'proprio', null),
  ('755ed714-e550-5cb4-a418-a437bda3ba4d', 'desktop', 'proprio', null),
  ('3894255a-60fd-5aef-aea7-10dc60f62d87', 'desktop', 'proprio', null)
on conflict (no_id) do nothing;

insert into public.frentes (no_id, wip_limite) values
  ('27ed01ff-b4ea-5354-aaa2-c34d711304d0', 3),
  ('a1683a67-a153-5423-94a5-791ae7b85df9', 3),
  ('00d6a88c-4baf-50e4-a0b7-72c2e36a21af', 3),
  ('127109a4-0854-5e51-af3d-3864af4a1b0d', 3),
  ('71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', 3),
  ('f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', 3),
  ('6c7a5b20-1287-516f-977b-6b3bb8710fc6', 3),
  ('68118257-a8c5-5852-a1b0-c0192c4e705f', 3),
  ('0b5048b2-af47-59de-8fd1-8bc8bf2c8470', 3),
  ('5ab3fbab-102b-57f7-a47c-8f5ac0beb539', 3),
  ('3cb585a7-ec87-5719-aabf-7022b23dc2c2', 3),
  ('c63be23e-3cfb-552e-86ae-dadb7d703e31', 3),
  ('f8334e5a-01f7-5bf9-8791-ba6af14d553f', 3),
  ('31b004d0-22b5-5593-be68-960f2e3d4560', 3),
  ('9de59366-98dd-54bc-b1fc-7f54725a318b', 3),
  ('4ca8f123-6951-554a-a513-5eb7f1c680c2', 3),
  ('b5d98785-0784-5d52-8e41-a4a8ee065f98', 3),
  ('ce5e204e-18a7-54ba-bf94-6dd9581e94e6', 3),
  ('69aa1e69-cff6-507a-b2fb-99de444826e6', 3),
  ('22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', 3),
  ('7b6911f0-12de-5ea1-9304-f811fb404c42', 3),
  ('8af0d9e4-9993-5bb4-83cc-2c1429054f96', 3),
  ('072b1896-e400-5d6d-9d2f-6bd0bc25a70e', 3),
  ('ef73d1da-63a0-5595-ae39-e5c65377918f', 3),
  ('a39cba16-716f-556d-838a-aef2dc1b314e', 3),
  ('23362b3e-9566-5331-9496-6d7f6dea9339', 3),
  ('7dad40b2-07a5-57df-b9c8-23a422d3ea36', 3),
  ('b1af5ab4-31f0-5c29-86dc-0b466c90282b', 3),
  ('151159e9-006b-54c2-92c6-71ac19303628', 3),
  ('3b0fdf80-1f60-5ada-a666-1c9bf9bff667', 3),
  ('0d5599d5-0ffc-5ea6-a763-bd51d6309ffa', 3),
  ('5aa97a0f-6ca7-5ad4-9fa9-783fdd9ff6d6', 3),
  ('a747a148-99f3-5f75-90d0-9d82e260970d', 3),
  ('98059cc2-df97-5ea7-a2df-1bfdcebbc4c8', 3)
on conflict (no_id) do nothing;

insert into public.participacoes (pessoa_id, no_id, papel) values
  ('d148fdc5-eef3-5398-bf89-f49b55b5cd28', 'a615f8ab-48db-550e-bbe7-f11524ae2669', 'owner'),
  ('b5510531-2c75-59fb-b2c1-006a90d0775f', 'cea3db88-841f-5511-98d1-3bedcc411131', 'dev'),
  ('29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'cea3db88-841f-5511-98d1-3bedcc411131', 'dev'),
  ('2246aac4-fcc9-5564-af95-054b9cc42889', 'cea3db88-841f-5511-98d1-3bedcc411131', 'stakeholder')
on conflict (pessoa_id, no_id) do nothing;

insert into public.etiquetas (id, nome, cor, categoria, descricao) values
  ('706ed303-fc13-57b8-86f4-61ac87d97551', 'Holding', '#050506', 'Tipo', 'Empresa que controla outras empresas'),
  ('4131797f-20c3-5856-9f6f-cb45b8c09d21', 'Contabilidade', '#2E2E31', 'Segmento', null),
  ('2b7d0445-2208-54f6-bace-e12056f0fea4', 'Certificados digitais', '#2E2E31', 'Segmento', null),
  ('74de9ec6-cb08-5678-ba6b-3fd99b29a21e', 'Tráfego pago', '#2E2E31', 'Segmento', null),
  ('d9050943-a887-5b58-8334-acf5e2964741', 'Cobrança', '#2E2E31', 'Segmento', null),
  ('6ea9b15f-9ad0-5f92-a854-a5dfbc098e73', 'Varejo', '#2E2E31', 'Segmento', null),
  ('8cb84d64-4a29-5e40-ba82-3827d36e8155', 'Prioritário', '#FF0000', 'Relacionamento', 'Cliente com atenção redobrada')
on conflict (id) do nothing;

insert into public.etiquetas_nos (etiqueta_id, no_id) values
  ('706ed303-fc13-57b8-86f4-61ac87d97551', 'a615f8ab-48db-550e-bbe7-f11524ae2669'),
  ('8cb84d64-4a29-5e40-ba82-3827d36e8155', 'a615f8ab-48db-550e-bbe7-f11524ae2669'),
  ('4131797f-20c3-5856-9f6f-cb45b8c09d21', '70b80c6e-aa4f-5cd7-8663-4439f0084edf'),
  ('2b7d0445-2208-54f6-bace-e12056f0fea4', 'd7a972f1-13d0-562c-a612-018dd01688de'),
  ('74de9ec6-cb08-5678-ba6b-3fd99b29a21e', '4a599062-267a-58ea-999c-8ae3c67c2519'),
  ('6ea9b15f-9ad0-5f92-a854-a5dfbc098e73', '554bf641-779b-5731-8e63-08e275e9b8ef'),
  ('d9050943-a887-5b58-8334-acf5e2964741', '4f3b7efc-e53e-5260-b5ee-fdf6e3a92da3')
on conflict (no_id, etiqueta_id) do nothing;

insert into public.status_fluxo (id, no_id, chave, nome, explicacao, cor, grupo, ordem) values
  ('04c022f2-6169-5a25-adfe-1a43f66c093a', null, 'backlog', 'Backlog', 'na fila, ainda não planejado', '#A6A6AD', 'backlog', 0),
  ('4549c18d-0fb2-5425-9d63-62360e2c4a88', null, 'todo', 'To Do', 'a fazer', '#3355E0', 'todo', 1),
  ('c492b85a-8079-5176-a476-fac31bcc1aaa', null, 'doing', 'In Progress', 'em andamento', '#E08600', 'doing', 2),
  ('e4da0819-465a-5cd8-b70e-2c837053429e', null, 'review', 'In Review', 'em revisão', '#6D4AFF', 'review', 3),
  ('852fa09a-b876-585e-a93a-c51409240120', null, 'blocked', 'Blocked', 'bloqueado, esperando algo', '#FF0000', 'blocked', 4),
  ('c81b6d0b-de4d-53ce-85e9-d24600183909', null, 'done', 'Done', 'concluído', '#0E8A55', 'done', 5)
on conflict (id) do nothing;

insert into public.status_fluxo (id, no_id, chave, nome, explicacao, cor, grupo, ordem) values
  ('9a6959a6-14a5-5705-afeb-74f1eef5fc09', 'cea3db88-841f-5511-98d1-3bedcc411131', 'cs_cli', 'Aguardando cliente', null, '#B04A00', 'blocked', 10)
on conflict (id) do nothing;

insert into public.requisitos (id, nome, padrao, ordem) values
  ('7a57186b-a49b-5644-86e0-da0bdededc6c', 'Painel do cliente', true, 0),
  ('a6d3d6f4-c8e1-5022-a63d-348ed92caaa6', 'Botão de feedback', true, 1),
  ('17c66ec9-6227-5597-9cc3-7123b11c708f', 'Login e níveis de acesso', true, 2),
  ('e80d6409-3277-5870-82d4-99573c74aab2', 'Registro de quem fez o quê', true, 3),
  ('d2f7d9d9-6d59-592e-83c2-a113da178ebd', 'Changelog', true, 4),
  ('dc454f6c-ee34-504f-a186-7cadbbd55c1f', 'Backup e LGPD', true, 5),
  ('3e522ccb-a100-5446-a83c-8140434edad9', 'Sinal de funcionamento', true, 6)
on conflict (id) do nothing;

insert into public.servicos (id, codigo, categoria, nome, descricao, entregaveis, frentes_padrao, horas_min, horas_max, sla, checklist_inicio, ativo) values
  ('eecf79c8-6a01-5673-99c7-4d51966097a5', 'sv_site', 'Web', 'Site institucional', 'Site de apresentação da empresa, com páginas institucionais e formulário de contato.', array['Layout aprovado','Site publicado','Painel para editar textos','Configuração de domínio e SEO básico']::text[], array['Design','Frontend','SEO']::text[], 40, 120, null, array['Manual de identidade do cliente','Textos e imagens','Acesso ao domínio']::text[], true),
  ('9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', 'sv_landing', 'Web', 'Landing page', 'Página única de venda ou captação, focada em conversão.', array['Página publicada','Formulário ligado ao CRM ou planilha','Pixel e analytics']::text[], array['Design','Frontend']::text[], 16, 40, null, array['Oferta e público definidos','Identidade visual']::text[], true),
  ('4fd4e566-689b-551a-8198-81451df52331', 'sv_ecommerce', 'Web', 'E-commerce', 'Loja virtual com catálogo, carrinho e pagamento.', array['Loja publicada','Meios de pagamento','Integração com estoque']::text[], array['Design','Frontend','Backend','Integrations']::text[], 160, 480, '8 horas úteis', array['Contrato do gateway de pagamento','Catálogo de produtos']::text[], true),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'sv_sistema', 'Sistemas', 'Sistema web sob medida (ERP, CRM e outros)', 'Sistema de gestão feito para o processo do cliente.', array['Módulos combinados no escopo','Painel do cliente','Treinamento','Documentação']::text[], array['Frontend','Backend','Database','Integrations']::text[], 400, 2400, '4 horas úteis', array['Processos mapeados','Responsável do cliente definido','Acessos aos sistemas atuais']::text[], true),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'sv_desktop', 'Sistemas', 'Sistema desktop', 'Aplicativo instalado no computador, como os Javas do BL.', array['Instalador','Atualização automática','Painel do cliente']::text[], array['Frontend','Backend','Database']::text[], 200, 1200, '4 horas úteis', array['Sistema operacional dos usuários','Rede e permissões']::text[], true),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'sv_mobile', 'Sistemas', 'App mobile', 'Aplicativo de celular Android e iOS.', array['App nas lojas','Painel do cliente','Notificações']::text[], array['Design','Frontend','Backend']::text[], 240, 1400, '8 horas úteis', array['Contas de desenvolvedor Apple e Google']::text[], true),
  ('0807b44d-6f69-5089-b9f3-9b278f0e3975', 'sv_ajuste_nosso', 'Evolução', 'Manutenção e ajustes em sistema nosso', 'Correções e melhorias em sistemas feitos pela CicloDev.', array['Mudança publicada','Changelog atualizado']::text[], array['Frontend','Backend']::text[], 4, 80, '8 horas úteis', array['Pedido registrado no Service Desk']::text[], true),
  ('40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'sv_ajuste_terceiro', 'Evolução', 'Manutenção e ajustes em sistema de terceiros', 'Correções e melhorias em sistemas feitos por outra empresa.', array['Diagnóstico do código recebido','Mudança publicada','Relatório de riscos']::text[], array['Discovery','Frontend','Backend']::text[], 8, 160, '1 dia útil', array['Acesso ao código','Acesso ao banco','Documentação existente','Contrato ou termo de responsabilidade']::text[], true),
  ('d853e838-05c7-5e5e-a228-a443d7fe1883', 'sv_integracao', 'Integração e IA', 'Integrações entre sistemas', 'Ligação entre sistemas por API, webhook ou arquivo.', array['Integração no ar','Monitoramento de falhas','Documentação do contrato']::text[], array['Backend','Integrations']::text[], 24, 240, '4 horas úteis', array['Documentação da API do outro sistema','Credenciais de teste']::text[], true),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', 'sv_ia', 'Integração e IA', 'Automação e agentes de IA', 'Robôs e agentes que executam tarefas, com níveis de permissão.', array['Agente configurado','Níveis de permissão','Painel de uso e custo']::text[], array['AI','Backend','Integrations']::text[], 40, 400, '4 horas úteis', array['Processo a automatizar descrito','Dados de exemplo','Aprovação de uso de IA com dados do cliente']::text[], true),
  ('7c80a2f6-e352-5997-95a2-3f595f002ac1', 'sv_discovery', 'Consultoria', 'Discovery e diagnóstico', 'Levantamento do que existe e do que precisa, antes de construir.', array['Dossiê atual','Matriz de evidências','Proposta de solução','Estimativa']::text[], array['Discovery']::text[], 16, 80, null, array['Acesso ao código e ao banco, se houver','Pessoas para entrevistar']::text[], true),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', 'sv_suporte', 'Recorrente', 'Suporte e sustentação mensal', 'Plano mensal com horas para correções, melhorias e acompanhamento.', array['Horas do mês','Relatório mensal','Atendimento pelo Service Desk']::text[], array['Frontend','Backend']::text[], 10, 80, '4 horas úteis', array['Acesso ao Service Desk']::text[], true)
on conflict (id) do nothing;

insert into public.servicos_cobranca (id, servico_id, modelo, parametros, ordem) values
  ('b694d2ae-cae1-511c-b65b-eeed0736962a', 'eecf79c8-6a01-5673-99c7-4d51966097a5', 'fixo', '{}'::jsonb, 0),
  ('cf2526f0-54bc-5998-8924-71555e1ce7ab', 'eecf79c8-6a01-5673-99c7-4d51966097a5', 'manutencao', '{"pct": 18}'::jsonb, 1),
  ('54db7e9a-0773-5e2e-a809-ef9ee962e8ea', '9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', 'fixo', '{}'::jsonb, 0),
  ('d7c98383-51e8-5ef6-9d7d-a67282f37a0e', '9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', 'mensalidade', '{"valor": 250, "horas": 2, "excedente": 0}'::jsonb, 1),
  ('68622f71-0182-5b2d-aeee-6482de480139', '4fd4e566-689b-551a-8198-81451df52331', 'implantacao', '{}'::jsonb, 0),
  ('ea4228ea-7f0f-59e1-8d0a-1bfdab2f26c0', '4fd4e566-689b-551a-8198-81451df52331', 'mensalidade', '{"valor": 900, "horas": 6}'::jsonb, 1),
  ('8e685e9d-9c01-5d71-b710-f6f01f9c2702', '4fd4e566-689b-551a-8198-81451df52331', 'sucesso', '{"pct": 1.5, "base": "Faturamento da loja"}'::jsonb, 2),
  ('1f7b9676-e8bc-5033-9d95-4dc809c88a92', '30152efb-067c-5bff-b291-b5c079e6f771', 'marco', '{"parcelas": [30, 40, 30]}'::jsonb, 0),
  ('a0b206e0-c411-5895-9572-d635c371353f', '30152efb-067c-5bff-b291-b5c079e6f771', 'usuario', '{"valor": 39, "minimo": 10}'::jsonb, 1),
  ('744b91c4-565a-5121-a3d6-94319f7f4bf8', '30152efb-067c-5bff-b291-b5c079e6f771', 'mensalidade', '{"valor": 3500, "horas": 20, "excedente": 0}'::jsonb, 2),
  ('8728388c-2f86-54d6-9063-0e0f37b352a7', '635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'implantacao', '{}'::jsonb, 0),
  ('84d13cb2-8c49-5204-9adc-8324c63eba40', '635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'usuario', '{"valor": 59, "minimo": 5}'::jsonb, 1),
  ('2812a9a1-4f2d-5a52-8671-ed7b7b4d0cf0', '0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'marco', '{"parcelas": [40, 30, 30]}'::jsonb, 0),
  ('c29d74c5-f97b-5b89-a676-b032592d8614', '0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'mensalidade', '{"valor": 1200, "horas": 8, "excedente": 0}'::jsonb, 1),
  ('30ad3e8e-d4d9-5ba5-9085-ec9123b70920', '0807b44d-6f69-5089-b9f3-9b278f0e3975', 'hora', '{}'::jsonb, 0),
  ('9bc4613b-dfe4-596c-a258-72636f02159c', '0807b44d-6f69-5089-b9f3-9b278f0e3975', 'banco_horas', '{"horas": 20, "validade": 3}'::jsonb, 1),
  ('5b65f796-c223-5707-92eb-a1f9b585a522', '40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'fixo', '{"nome": "Diagnóstico inicial"}'::jsonb, 0),
  ('66240030-a282-525d-9766-41f9110e9a1c', '40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'hora', '{"mult": 1.2}'::jsonb, 1),
  ('aa72d0c6-a19a-537d-8a25-24f6a2d89ab5', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'fixo', '{}'::jsonb, 0),
  ('44f9db43-b366-516a-aceb-b4815caae697', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'repasse', '{"markup": 15}'::jsonb, 1),
  ('8d3365ea-5b2a-5fe6-afdd-2f11aa7a9948', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'mensalidade', '{"valor": 400, "horas": 2, "excedente": 0}'::jsonb, 2),
  ('9f65d95d-fba1-5de3-b0e2-1a69149cedcd', 'fd39b09d-10a7-5b78-ad5f-4421c498e154', 'implantacao', '{}'::jsonb, 0),
  ('9dad4366-f018-5be1-840e-f028cd78779c', 'fd39b09d-10a7-5b78-ad5f-4421c498e154', 'uso', '{"unidade": "mil chamadas", "valor": 18, "franquia": 5}'::jsonb, 1),
  ('0eaa4f37-baec-5ea2-823d-aecefda30a74', 'fd39b09d-10a7-5b78-ad5f-4421c498e154', 'valor', '{"ganho": 120000, "pct": 15}'::jsonb, 2),
  ('17a8449d-de66-5a49-9b56-cbe8e56da2db', '7c80a2f6-e352-5997-95a2-3f595f002ac1', 'fixo', '{}'::jsonb, 0),
  ('3e5768eb-c2a0-5a54-ac05-1680151c469c', '5c8891c1-11b2-5497-aae3-052fe40ccbec', 'mensalidade', '{"valor": 0, "horas": 20, "excedente": 0}'::jsonb, 0),
  ('54e4ced5-c371-5d2d-ada6-d55b1c236866', '5c8891c1-11b2-5497-aae3-052fe40ccbec', 'faixas', '{"faixas": [{"nome": "Essencial", "horas": 10, "valor": 0}, {"nome": "Profissional", "horas": 20, "valor": 0}, {"nome": "Dedicado", "horas": 80, "valor": 0}]}'::jsonb, 1)
on conflict (id) do nothing;

update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3991414f-b7a6-5abf-a62e-064efa9a9adf' and servico_id is null;
update public.aplicacoes set servico_id = '0e3962f2-5424-54b3-8a1e-550f0adfe7b5' where no_id = '38ff5917-3d08-5887-ba5f-57a82861493f' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3435d48c-e3bc-5887-a742-b1500492faf0' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = 'b3e427e0-9332-567b-8915-a2363b97dc03' and servico_id is null;
update public.aplicacoes set servico_id = '0e3962f2-5424-54b3-8a1e-550f0adfe7b5' where no_id = 'c37cc0c0-2eec-59e2-bebf-989417c684ee' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '28e89fc6-dff1-5d34-afee-da7cd76b42f4' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = 'e917b7b5-2dbb-5517-8ebf-5bf904b7b5dd' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '755ed714-e550-5cb4-a418-a437bda3ba4d' and servico_id is null;
update public.aplicacoes set servico_id = '635a3fcb-ee41-59bd-9a66-b418dc8f48fa' where no_id = '3894255a-60fd-5aef-aea7-10dc60f62d87' and servico_id is null;

insert into public.servicos_requisitos (servico_id, requisito_id) values
  ('eecf79c8-6a01-5673-99c7-4d51966097a5', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('eecf79c8-6a01-5673-99c7-4d51966097a5', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('9f0f3c79-eebd-5097-a614-1fa4a7b2e4d8', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('4fd4e566-689b-551a-8198-81451df52331', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('4fd4e566-689b-551a-8198-81451df52331', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('4fd4e566-689b-551a-8198-81451df52331', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('4fd4e566-689b-551a-8198-81451df52331', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'a6d3d6f4-c8e1-5022-a63d-348ed92caaa6'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('30152efb-067c-5bff-b291-b5c079e6f771', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('635a3fcb-ee41-59bd-9a66-b418dc8f48fa', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'a6d3d6f4-c8e1-5022-a63d-348ed92caaa6'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', '17c66ec9-6227-5597-9cc3-7123b11c708f'),
  ('0e3962f2-5424-54b3-8a1e-550f0adfe7b5', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('0807b44d-6f69-5089-b9f3-9b278f0e3975', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd'),
  ('40fc7936-50b1-5951-8d8f-3a373f1bbaba', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('d853e838-05c7-5e5e-a228-a443d7fe1883', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('d853e838-05c7-5e5e-a228-a443d7fe1883', '3e522ccb-a100-5446-a83c-8140434edad9'),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', 'e80d6409-3277-5870-82d4-99573c74aab2'),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('fd39b09d-10a7-5b78-ad5f-4421c498e154', 'dc454f6c-ee34-504f-a186-7cadbbd55c1f'),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', '7a57186b-a49b-5644-86e0-da0bdededc6c'),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', 'a6d3d6f4-c8e1-5022-a63d-348ed92caaa6'),
  ('5c8891c1-11b2-5497-aae3-052fe40ccbec', 'd2f7d9d9-6d59-592e-83c2-a113da178ebd')
on conflict (servico_id, requisito_id) do nothing;

insert into public.regras_calculo (vigente_desde, regime, aliq_simples, aliq_presumido, aliq_real, inss_patronal, rat, terceiros, fgts, ferias, terco_ferias, decimo_terceiro, multa_fgts, horas_mes, faturavel_pct, margem_pct, contingencia_pct, folga_rateio_pct, manutencao_pct, cambio_usd, complexidade, urgencia) values
  ('2025-01-01', 'simples', 6, 16.33, 17.5, 20, 2, 5.8, 8, 8.33, 2.78, 8.33, 3.2, 168, 65, 20, 15, 10, 18, 5.4, '{"Baixa": 0.85, "Média": 1, "Alta": 1.3, "Muito alta": 1.6}'::jsonb, '{"Normal": 1, "Prioritária": 1.15, "Urgente": 1.3}'::jsonb)
on conflict (vigente_desde) do nothing;

insert into public.pessoas_custos (id, pessoa_id, vinculo, salario, prolabore, valor_pj, beneficios, vigente_desde) values
  ('4e8b6d71-0f8c-5258-ba31-f6b560ee4067', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'socio', 0, 15000, 0, 0, '2025-01-01'),
  ('42e1f576-4a11-5f48-a6bc-6cc26186d99f', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'clt', 8500, 0, 0, 1100, '2025-01-01'),
  ('90dcc04f-474e-57d0-8af8-8617faf7d0b9', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'pj', 0, 0, 9000, 0, '2025-01-01')
on conflict (id) do nothing;

insert into public.custos_operacao (id, nome, categoria, valor, moeda, recorrencia, meses_depreciacao, inicio) values
  ('02af4638-7d5b-5075-a660-a583955a1647', 'Assinaturas de IA do time (Claude, outros)', 'Ferramentas', 600, 'BRL', 'mensal', null, '2025-01-01'),
  ('a5534c50-1bea-50fe-aa1f-68e79f95bc25', 'GitHub Team', 'Ferramentas', 12, 'USD', 'mensal', null, '2025-01-01'),
  ('93a09241-e17a-5043-922e-1beef885c1ce', 'Figma', 'Ferramentas', 45, 'USD', 'mensal', null, '2025-01-01'),
  ('99f2aa08-1039-58bc-b772-a9fd1fa93083', 'Contabilidade', 'Administrativo', 900, 'BRL', 'mensal', null, '2025-01-01'),
  ('9cfce1a1-f728-5944-8955-25474b25ec79', 'Coworking', 'Estrutura', 1800, 'BRL', 'mensal', null, '2025-01-01'),
  ('bbc69320-efc4-5d17-b673-86f9a164f652', 'Internet e telefone', 'Estrutura', 250, 'BRL', 'mensal', null, '2025-01-01'),
  ('68d6daf1-f26d-5b94-a9ac-73a4887ff0cd', 'Notebooks (depreciação em 36 meses)', 'Equipamentos', 21600, 'BRL', 'depreciacao', 36, '2025-01-01'),
  ('c0c41794-bc81-5ca8-bcfb-f9c19a60072b', 'Domínio itia.com.br', 'Estrutura', 40, 'BRL', 'anual', null, '2025-01-01')
on conflict (id) do nothing;

insert into public.custos_tecnicos (id, no_id, fornecedor, categoria, descricao, recorrencia, moeda, valor, unidade, limite, plano, proximo_plano, proximo_valor, extra_por_unidade, repasse, taxa_repasse_pct, inicio) values
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Supabase', 'Banco de dados', 'Plano Pro do banco BL', 'mensal', 'USD', 25, 'GB de banco', 8, 'Pro (8 GB inclusos)', 'Pro + disco extra', 25, 0.125, true, 15, '2025-07-05'),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Supabase', 'Armazenamento', 'Storage de arquivos (documentos dos clientes)', 'mensal', 'USD', 0, 'GB de arquivos', 100, 'Incluso no Pro (100 GB)', 'Storage adicional', null, 0.021, true, 15, '2025-07-05'),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '3991414f-b7a6-5abf-a62e-064efa9a9adf', 'Anthropic', 'API de IA', 'Billy: consumo da API', 'uso', 'USD', 1, 'US$ de consumo', 150, 'Limite de gasto mensal definido', 'Aumentar o limite de gasto', null, null, true, 25, '2026-01-05'),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'WhatsGW', 'Mensageria', 'WhatsApp dos departamentos', 'mensal', 'BRL', 349, 'números conectados', 10, 'Plano 10 números', 'Plano 20 números', 599, null, true, 10, '2025-01-05'),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', 'Vercel', 'Hospedagem', 'Área do Cliente (web)', 'mensal', 'USD', 20, 'GB de tráfego', 1000, 'Pro (1 TB)', 'Pro + tráfego extra', 20, 0.15, true, 15, '2025-11-05'),
  ('7b9ddb00-f0c1-52b1-ae8c-3c0834797adf', '3d08e58a-8710-5ec5-b23e-7e8e9d36dbd3', 'Conexa', 'Integração', 'Taxa da integração de cobrança', 'mensal', 'BRL', 120, null, null, null, null, null, null, false, 0, '2025-09-05'),
  ('a871b08c-3f87-558d-80e0-b5df05caca45', '28e89fc6-dff1-5d34-afee-da7cd76b42f4', 'Registro.br', 'Domínio', 'Domínio da Realizze', 'anual', 'BRL', 40, null, null, null, null, null, null, true, 0, '2024-03-05'),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'Marketplaces', 'Integração', 'Taxa por pedido integrado', 'uso', 'BRL', 1, 'R$ de taxa', 500, 'Sem plano fixo', 'Negociar plano por volume', null, null, true, 0, '2026-05-05')
on conflict (id) do nothing;

insert into public.custos_uso (custo_id, mes, quantidade) values
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-04-01', 4.1),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-05-01', 4.43),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-06-01', 4.78),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-07-01', 5.16),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-08-01', 5.58),
  ('ae294633-0c8f-5ae2-b941-31b3f7a13ef9', '2026-09-01', 6.02),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-04-01', 52),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-05-01', 55.64),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-06-01', 59.53),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-07-01', 63.7),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-08-01', 68.16),
  ('5ae322e9-5e25-5850-b20b-569bf1187698', '2026-09-01', 72.93),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-04-01', 38),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-05-01', 44.84),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-06-01', 52.91),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-07-01', 62.44),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-08-01', 73.67),
  ('594352b6-40d7-56a8-a2b2-321f2a869c57', '2026-09-01', 86.93),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-04-01', 6),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-05-01', 6),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-06-01', 7),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-07-01', 7),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-08-01', 8),
  ('6b8d7682-9bfe-5309-a903-12d330072b45', '2026-09-01', 9),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-04-01', 180),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-05-01', 201.6),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-06-01', 225.79),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-07-01', 252.89),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-08-01', 283.23),
  ('86b36766-7820-5266-9b6d-596a6d7df85a', '2026-09-01', 317.22),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-04-01', 0),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-05-01', 0),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-06-01', 40),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-07-01', 95),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-08-01', 160),
  ('f4f67ac0-b170-5e8e-9d85-cbf68f96e554', '2026-09-01', 240)
on conflict (custo_id, mes) do nothing;

insert into public.receitas (id, no_id, servico_id, descricao, modelo, valor, moeda, forma, parcelas, inicio, fim) values
  ('8040caee-9b00-51ea-a60e-94393dc33c22', 'cea3db88-841f-5511-98d1-3bedcc411131', '30152efb-067c-5bff-b291-b5c079e6f771', 'Projeto BL: implantação em 6 parcelas', 'marco', 180000, 'BRL', 'parcelada', 6, '2026-06-10', null),
  ('d4da586a-d3bf-51f1-b1e7-d4bcf38757fa', '3991414f-b7a6-5abf-a62e-064efa9a9adf', '5c8891c1-11b2-5497-aae3-052fe40ccbec', 'Sustentação mensal do Java BL', 'mensalidade', 6500, 'BRL', 'mensal', null, '2026-08-10', null),
  ('c29f5a21-8a91-5ea7-b2e8-f5d07fb6be46', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', '30152efb-067c-5bff-b291-b5c079e6f771', 'Javas da YOU e Área do Cliente', 'mensalidade', 4800, 'BRL', 'mensal', null, '2025-12-10', null),
  ('45d99b93-0ef4-5d8d-9d04-d17a736836a9', '3894255a-60fd-5aef-aea7-10dc60f62d87', 'd853e838-05c7-5e5e-a228-a443d7fe1883', 'Integração com marketplaces', 'fixo', 28000, 'BRL', 'unica', null, '2026-09-16', null)
on conflict (id) do nothing;

insert into public.slas (no_id, gravidade, horas_resposta, horas_solucao) values
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'parado', 1, 8),
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'quebrada', 4, 24),
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'incomodo', 8, 72),
  ('a615f8ab-48db-550e-bbe7-f11524ae2669', 'cosmetico', 24, 168)
on conflict (no_id, gravidade) do nothing;

insert into public.sprints (id, projeto_id, nome, meta, inicio, fim, status) values
  ('e6d05bf8-1f53-5dcf-8ec6-1fcc0887432c', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Ciclo 1 · Painel do CEO e Fiscal', 'Painel central do CEO no ar e filtro de competência corrigido', '2026-09-14', '2026-09-27', 'ativo')
on conflict (id) do nothing;

insert into public.marcos (id, no_id, tipo, nome, descricao, data, visivel_cliente, entregue_em) values
  ('795bbb2e-f16f-5bcd-adc6-891d2ebdee0e', 'cea3db88-841f-5511-98d1-3bedcc411131', 'marco', 'Painel do CEO no ar', 'O CEO acompanha o grupo pelo app e pelo Java BL', '2026-10-08', true, null),
  ('32ab3563-4f92-5013-882e-4f2180502b52', '70b80c6e-aa4f-5cd7-8663-4439f0084edf', 'release', 'YOU v0.5', 'Fiscal com competência corrigida e Área do Cliente com login por CPF', '2026-10-26', true, null),
  ('02209c37-29cd-58fb-94d4-acfedde299ef', 'cea3db88-841f-5511-98d1-3bedcc411131', 'marco', 'Financeiro no ar', 'Conexa integrada nos Javas', '2026-11-25', true, null)
on conflict (id) do nothing;

insert into public.automacoes (id, no_id, nome, gatilho, condicao, acao, parametros, ativa, criado_por) values
  ('074ffdd1-7c41-53c8-a2d8-9854a8226144', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Bug concluído avisa quem abriu', 'status_mudou', '{"tipo": "bug", "grupo": "done"}'::jsonb, 'notificar', '{"para": "relator", "titulo": "O bug que você abriu foi resolvido"}'::jsonb, true, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('4a757b83-3a06-590c-b199-1626920faefc', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Item bloqueado sobe a prioridade', 'status_mudou', '{"grupo": "blocked"}'::jsonb, 'mudar_prioridade', '{"prioridade": "high"}'::jsonb, true, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28')
on conflict (id) do nothing;

insert into public.campos_personalizados (id, no_id, nome, tipo, opcoes, ordem) values
  ('2a870456-898f-5fce-afb8-e3ce554161e5', 'cea3db88-841f-5511-98d1-3bedcc411131', 'Ambiente', 'lista', array['Teste','Produção']::text[], 0)
on conflict (id) do nothing;

insert into public.itens (id, frente_id, pai_id, tipo, titulo, descricao, status_id, prioridade, responsavel_id, relator_id, estimativa_h, pontos, inicio, prazo, data_prevista, visivel_cliente, sprint_id, marco_id, criado_em, iniciado_em, concluido_em) values
  ('8a3977f7-b358-541c-970b-79ea511033f7', '00d6a88c-4baf-50e4-a0b7-72c2e36a21af', null, 'epic', 'Ficha única do cliente no banco BL', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'highest', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 40, null, '2026-07-28', '2026-10-16', '2026-10-16', true, null, null, '2026-07-23T12:00:00-03:00', '2026-07-28T09:00:00-03:00', null),
  ('d8015c00-3a4a-51e0-90f7-b56e7edd6a2d', '71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', null, 'story', 'Resumo diário do grupo no celular', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'high', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-09-29', '2026-10-21', '2026-10-24', true, null, null, '2026-09-24T12:00:00-03:00', null, null),
  ('7a67550a-f4f0-5e6a-a7cd-a9dba3387090', '71d5831e-a4c2-5b2c-8120-16ed8f0eb28a', null, 'task', 'Aprovações pendentes em um toque', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-11', '2026-11-05', '2026-11-08', false, null, null, '2026-10-06T12:00:00-03:00', null, null),
  ('2600ca8e-80f4-5573-bc0c-25d10602850e', 'f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', null, 'task', 'Notificações do CEO', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 6, null, '2026-10-01', '2026-10-14', '2026-10-17', false, null, null, '2026-09-26T12:00:00-03:00', null, null),
  ('4df9e111-74c1-52ae-b763-6f3ef1e59fad', '5ab3fbab-102b-57f7-a47c-8f5ac0beb539', null, 'task', 'Carteira de clientes do Fiscal', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-08-12', '2026-09-06', '2026-09-09', false, null, null, '2026-08-07T12:00:00-03:00', '2026-08-12T09:00:00-03:00', '2026-09-04T17:00:00-03:00'),
  ('34e36605-30c9-5eb8-a1fa-0043eb1b6c2e', '0b5048b2-af47-59de-8fd1-8bc8bf2c8470', null, 'story', 'Importar obrigações do mês', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 14, null, '2026-09-18', '2026-10-01', '2026-10-04', true, null, null, '2026-09-13T12:00:00-03:00', '2026-09-18T09:00:00-03:00', null),
  ('a1453820-697f-5834-947c-544319d7048d', '68118257-a8c5-5852-a1b0-c0192c4e705f', null, 'bug', 'Filtro por competência não respeita o mês', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'highest', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 3, null, '2026-09-23', '2026-09-25', '2026-09-25', false, null, null, '2026-09-18T12:00:00-03:00', null, null),
  ('edd71102-1084-5f62-893b-7e960fa8a290', '68118257-a8c5-5852-a1b0-c0192c4e705f', null, 'task', 'Tela de guias e vencimentos', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-09-28', '2026-10-12', '2026-10-15', false, null, null, '2026-09-23T12:00:00-03:00', null, null),
  ('0f07e627-5656-5248-a912-45778d4334ac', 'c63be23e-3cfb-552e-86ae-dadb7d703e31', null, 'story', 'Reflexo financeiro decidido pelo CEO', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'highest', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 20, null, '2026-09-14', '2026-10-06', '2026-10-06', true, null, null, '2026-09-09T12:00:00-03:00', '2026-09-14T09:00:00-03:00', null),
  ('bdb0cca2-c9ee-5385-bf36-765defb34811', 'c63be23e-3cfb-552e-86ae-dadb7d703e31', null, 'task', 'Integração com a Conexa', null, 'e4da0819-465a-5cd8-b70e-2c837053429e', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-09-08', '2026-09-26', '2026-09-29', false, null, null, '2026-09-03T12:00:00-03:00', '2026-09-08T09:00:00-03:00', null),
  ('58f2ad43-4326-5199-908c-edaf162cf37e', '3cb585a7-ec87-5719-aabf-7022b23dc2c2', null, 'task', 'Contas a receber por empresa', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-02', '2026-10-18', '2026-10-21', false, null, null, '2026-09-27T12:00:00-03:00', null, null),
  ('b6cf630e-0701-568e-9dd6-5c4ea9dff73a', '9de59366-98dd-54bc-b1fc-7f54725a318b', null, 'task', 'Folha e eventos do mês', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-10-16', '2026-11-15', '2026-11-18', false, null, null, '2026-10-11T12:00:00-03:00', null, null),
  ('ede1c23b-8e93-54f1-a51a-c2376ea8c027', 'ce5e204e-18a7-54ba-bf94-6dd9581e94e6', null, 'task', 'Processos societários e prazos', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'low', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-10-26', '2026-12-05', '2026-12-08', false, null, null, '2026-10-21T12:00:00-03:00', null, null),
  ('87d225b6-f37f-5f1f-a6b1-375ee9a5b22a', '22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', null, 'story', 'Login do cliente por CPF', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'high', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 8, null, '2026-09-20', '2026-10-04', '2026-10-07', true, null, null, '2026-09-15T12:00:00-03:00', '2026-09-20T09:00:00-03:00', null),
  ('fe4b9844-6a48-5076-8f8b-e0238f0c27d2', '22ea1d28-a27c-5b7f-9dfd-5ea181bcb67a', null, 'story', 'Envio de documentos pelo celular', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'high', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 14, null, '2026-10-05', '2026-10-24', '2026-10-27', true, null, null, '2026-09-30T12:00:00-03:00', null, null),
  ('b7258ab3-15e9-5df4-bc90-9177b229f690', '7b6911f0-12de-5ea1-9304-f811fb404c42', null, 'task', 'Botão de feedback do Kit CicloDev', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 6, null, '2026-09-30', '2026-10-10', '2026-10-13', false, null, null, '2026-09-25T12:00:00-03:00', null, null),
  ('f773d5fc-e3f6-51f7-9a3e-b89184348318', 'ef73d1da-63a0-5595-ae39-e5c65377918f', null, 'story', 'Agenda de emissão de certificados', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'medium', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-09-21', '2026-10-08', '2026-10-11', false, null, null, '2026-09-16T12:00:00-03:00', '2026-09-21T09:00:00-03:00', null),
  ('edfcb991-3fc4-53f2-906b-6368f2179447', '072b1896-e400-5d6d-9d2f-6bd0bc25a70e', null, 'task', 'Tela de validade dos certificados', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'medium', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 8, null, '2026-09-01', '2026-09-14', '2026-09-17', false, null, null, '2026-08-27T12:00:00-03:00', '2026-09-01T09:00:00-03:00', '2026-09-13T17:00:00-03:00'),
  ('8e22501f-6f05-5438-a680-4ac68cd051ba', '0d5599d5-0ffc-5ea6-a763-bd51d6309ffa', null, 'task', 'Módulo de chips por loja', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-08', '2026-10-31', '2026-11-03', false, null, null, '2026-10-03T12:00:00-03:00', null, null),
  ('0abf5256-5faa-5b27-859d-b7e5c6b31ada', 'a747a148-99f3-5f75-90d0-9d82e260970d', null, 'epic', 'Integração com marketplaces', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'high', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 40, null, '2026-09-22', '2026-11-10', '2026-11-13', true, null, null, '2026-09-17T12:00:00-03:00', '2026-09-22T09:00:00-03:00', null),
  ('2eaa0315-945c-52b8-a1c8-08faffe7631b', 'a747a148-99f3-5f75-90d0-9d82e260970d', null, 'task', 'Robô de cobrança automática', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-10-03', '2026-10-26', '2026-10-29', false, null, null, '2026-09-28T12:00:00-03:00', null, null),
  ('5d590ea1-84f1-5356-a38e-e41d05ff2cd1', '5aa97a0f-6ca7-5ad4-9fa9-783fdd9ff6d6', null, 'task', 'Cobrança pelo faturamento via Pix', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-10-16', '2026-11-15', '2026-11-18', false, null, null, '2026-10-11T12:00:00-03:00', null, null),
  ('9e11825c-aed2-5d36-968d-03a62362c33c', '23362b3e-9566-5331-9496-6d7f6dea9339', null, 'task', 'Painel de campanhas', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'low', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-10-26', '2026-11-25', '2026-11-28', false, null, null, '2026-10-21T12:00:00-03:00', null, null),
  ('43b9faed-ad85-5c4c-b372-3cda3cb3eefa', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Tela de login do Java BL', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-04', '2026-08-08', '2026-08-11', false, null, null, '2026-07-30T12:00:00-03:00', '2026-08-04T09:00:00-03:00', '2026-08-08T17:00:00-03:00'),
  ('6a9c1fff-4415-594b-94fe-a386a7963874', 'f8de61c6-cdfd-5f0e-8058-1e6a5e970ac5', null, 'task', 'Ícones do app do CEO', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-09', '2026-08-13', '2026-08-16', false, null, null, '2026-08-04T12:00:00-03:00', '2026-08-09T09:00:00-03:00', '2026-08-13T17:00:00-03:00'),
  ('be459ca1-b812-5ab2-8b54-c01b898a5de3', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Índices da tabela de clientes', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-16', '2026-08-20', '2026-08-23', false, null, null, '2026-08-11T12:00:00-03:00', '2026-08-16T09:00:00-03:00', '2026-08-20T17:00:00-03:00'),
  ('8ab86c6f-af9c-5d51-8375-edaeedf456a0', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Contrato de eventos do cadastro', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-18', '2026-08-22', '2026-08-25', false, null, null, '2026-08-13T12:00:00-03:00', '2026-08-18T09:00:00-03:00', '2026-08-22T17:00:00-03:00'),
  ('e8e9d95c-b45a-51fd-9226-7b5a852cd1b6', '0b5048b2-af47-59de-8fd1-8bc8bf2c8470', null, 'task', 'Exportação de obrigações em PDF', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-24', '2026-08-28', '2026-08-31', false, null, null, '2026-08-19T12:00:00-03:00', '2026-08-24T09:00:00-03:00', '2026-08-28T17:00:00-03:00'),
  ('1b209a5d-135e-5d98-89b7-6efa1d43416e', '7b6911f0-12de-5ea1-9304-f811fb404c42', null, 'task', 'Tela de documentos do cliente', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-08-30', '2026-09-03', '2026-09-06', false, null, null, '2026-08-25T12:00:00-03:00', '2026-08-30T09:00:00-03:00', '2026-09-03T17:00:00-03:00'),
  ('cc8ffb85-2e8a-5064-bf91-40b4c1f5c960', '0b5048b2-af47-59de-8fd1-8bc8bf2c8470', null, 'task', 'Correção do fuso nos vencimentos', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-06', '2026-09-10', '2026-09-13', false, null, null, '2026-09-01T12:00:00-03:00', '2026-09-06T09:00:00-03:00', '2026-09-10T17:00:00-03:00'),
  ('4eb80240-8177-5e3a-b1d3-976cd5b90824', 'ef73d1da-63a0-5595-ae39-e5c65377918f', null, 'task', 'Aviso de certificado vencendo', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-07', '2026-09-11', '2026-09-14', false, null, null, '2026-09-02T12:00:00-03:00', '2026-09-07T09:00:00-03:00', '2026-09-11T17:00:00-03:00'),
  ('013b420d-67ff-5487-830a-47096059f9a5', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Registro de quem fez o quê', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-13', '2026-09-17', '2026-09-20', false, null, null, '2026-09-08T12:00:00-03:00', '2026-09-13T09:00:00-03:00', '2026-09-17T17:00:00-03:00'),
  ('7e034b06-b598-5e1b-a240-72a72a5a44cc', 'a1683a67-a153-5423-94a5-791ae7b85df9', null, 'task', 'Revisão das regras de acesso', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-14', '2026-09-18', '2026-09-21', false, null, null, '2026-09-09T12:00:00-03:00', '2026-09-14T09:00:00-03:00', '2026-09-18T17:00:00-03:00'),
  ('9b1a19c7-b6ec-5214-ab3e-ffda925fff6b', '7b6911f0-12de-5ea1-9304-f811fb404c42', null, 'task', 'Ajuste de layout da Área do Cliente', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'low', '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 4, null, '2026-09-19', '2026-09-23', '2026-09-26', false, null, null, '2026-09-14T12:00:00-03:00', '2026-09-19T09:00:00-03:00', '2026-09-23T17:00:00-03:00'),
  ('d0c12602-067b-5fbb-93d9-1d3e9869ab5c', '27ed01ff-b4ea-5354-aaa2-c34d711304d0', null, 'story', 'Painel central do CEO', null, 'e4da0819-465a-5cd8-b70e-2c837053429e', 'high', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 14, null, '2026-09-11', '2026-09-28', '2026-10-01', true, 'e6d05bf8-1f53-5dcf-8ec6-1fcc0887432c', '795bbb2e-f16f-5bcd-adc6-891d2ebdee0e', '2026-09-06T12:00:00-03:00', '2026-09-11T09:00:00-03:00', null),
  ('a7d3df61-f110-5f3d-8863-d2075ecc8ec8', '27ed01ff-b4ea-5354-aaa2-c34d711304d0', null, 'task', 'Login e níveis de acesso', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'medium', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-08-07', '2026-08-27', '2026-08-30', false, 'e6d05bf8-1f53-5dcf-8ec6-1fcc0887432c', null, '2026-08-02T12:00:00-03:00', '2026-08-07T09:00:00-03:00', '2026-08-26T17:00:00-03:00'),
  ('7061c178-900a-5e80-a36e-080147aca0ad', '127109a4-0854-5e51-af3d-3864af4a1b0d', null, 'epic', 'Billy: ouvinte, operacional e voz', null, '4549c18d-0fb2-5425-9d63-62360e2c4a88', 'medium', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 60, null, '2026-10-06', '2026-12-25', '2026-12-28', false, null, null, '2026-10-01T12:00:00-03:00', null, null),
  ('97feb758-c850-5aac-a658-59ca42ad853c', '127109a4-0854-5e51-af3d-3864af4a1b0d', null, 'task', 'Níveis de permissão das function calls', null, '04c022f2-6169-5a25-adfe-1a43f66c093a', 'medium', null, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-10-16', '2026-11-10', '2026-11-13', false, null, null, '2026-10-11T12:00:00-03:00', null, null),
  ('03712cfe-cd5e-54d3-821f-12efe367bf38', '00d6a88c-4baf-50e4-a0b7-72c2e36a21af', '8a3977f7-b358-541c-970b-79ea511033f7', 'task', 'Tabela de clientes com vínculo ativo e inativo', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 12, null, '2026-07-30', '2026-08-17', '2026-08-20', false, null, null, '2026-07-25T12:00:00-03:00', '2026-07-30T09:00:00-03:00', '2026-08-16T17:00:00-03:00'),
  ('177a89a3-e23d-5a1d-8c9b-8b024385d639', '00d6a88c-4baf-50e4-a0b7-72c2e36a21af', '8a3977f7-b358-541c-970b-79ea511033f7', 'task', 'Regras de acesso por empresa (RLS)', null, 'c81b6d0b-de4d-53ce-85e9-d24600183909', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 10, null, '2026-08-17', '2026-09-01', '2026-09-04', false, null, null, '2026-08-12T12:00:00-03:00', '2026-08-17T09:00:00-03:00', '2026-08-31T17:00:00-03:00'),
  ('0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'a1683a67-a153-5423-94a5-791ae7b85df9', '8a3977f7-b358-541c-970b-79ea511033f7', 'story', 'API de transferência de clientes para os Javas', null, 'c492b85a-8079-5176-a476-fac31bcc1aaa', 'highest', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 16, null, '2026-09-06', '2026-10-02', '2026-10-02', true, null, null, '2026-09-01T12:00:00-03:00', '2026-09-06T09:00:00-03:00', null),
  ('9e805ad3-d394-52a8-addf-149375c03c4c', 'a1683a67-a153-5423-94a5-791ae7b85df9', '8a3977f7-b358-541c-970b-79ea511033f7', 'task', 'Webhook de atualização de cadastro', null, '852fa09a-b876-585e-a93a-c51409240120', 'high', 'b5510531-2c75-59fb-b2c1-006a90d0775f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 8, null, '2026-09-16', '2026-09-30', '2026-10-03', false, null, null, '2026-09-11T12:00:00-03:00', '2026-09-16T09:00:00-03:00', null)
on conflict (id) do nothing;

insert into public.itens_checklist (id, item_id, texto, feito, ordem) values
  ('0d680c50-88e4-58bd-a63c-319fc66fd579', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'Contrato da API aprovado', true, 0),
  ('e819e11d-11b8-516c-bb7c-6982b0a3f6a3', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'Autenticação por token', true, 1),
  ('61d86d7e-ec10-55ae-a153-f10d3f0ff7f7', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'Teste com duas empresas', false, 2)
on conflict (id) do nothing;

insert into public.itens_ligacoes (origem_id, destino_id, tipo) values
  ('0cd891b9-53a2-5077-b74f-f99cb4f60a77', '9e805ad3-d394-52a8-addf-149375c03c4c', 'bloqueia')
on conflict (origem_id, destino_id, tipo) do nothing;

insert into public.comentarios (id, item_id, autor_id, texto, visivel_cliente, criado_em) values
  ('6f520df9-4242-5034-ad1e-65e1c2f65782', '87d225b6-f37f-5f1f-a6b1-375ee9a5b22a', '2246aac4-fcc9-5564-af95-054b9cc42889', 'Consigo entrar só com o CPF, sem e-mail?', true, '2026-09-24T10:00:00-03:00')
on conflict (id) do nothing;

insert into public.blocos_agenda (id, item_id, pessoa_id, inicio, fim) values
  ('0aa767cb-f3e1-5499-bd9f-427b96bee199', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-26T09:00:00-03:00', '2026-09-26T11:30:00-03:00'),
  ('97d8c6dd-91cc-5653-8427-fbd1a4e0ad3c', 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-28T10:00:00-03:00', '2026-09-28T12:00:00-03:00'),
  ('e3264f25-f67e-56c7-8a12-566f7985589b', '0f07e627-5656-5248-a912-45778d4334ac', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-27T14:00:00-03:00', '2026-09-27T17:00:00-03:00')
on conflict (id) do nothing;

insert into public.ficha_campos (no_id, secao, campo, valor, personalizado) values
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Visual identity', 'Manual de identidade', 'Manual Blanco & Lisboa 2026 (versão azul) e manual YOU "New DS 01"', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Stack', 'Linguagens e versões', 'Java 21', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Stack', 'Frameworks', 'Spring Boot, JavaFX', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Stack', 'Plataformas', 'Desktop (Java), celular', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Database', 'Banco e schema', 'Supabase tfcvoszeewmpghgxztuy', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Integrations', 'Sistemas ligados', 'WhatsGW, Conexa, Gmail', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Business rules', 'Regras de negócio do cliente', 'Carteira de clientes só existe no Fiscal. CNPJ e CPF são assuntos separados.', false),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'Custom fields', 'Holding', 'Blanco & Lisboa', true),
  ('d23ede90-b2b5-56e0-b294-cc0ff4f9c41a', 'Stack', 'Plataformas', 'Desktop (Java)', false)
on conflict (no_id, secao, campo) do nothing;

insert into public.etapas_modelo (id, chave, nome, explicacao, lente, entrega, ordem) values
  ('662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'et_0', 'Intake', 'entrada e triagem do pedido', 'Triagem', null, 0),
  ('af44fe96-f85f-5815-b727-4b172fcfb729', 'et_1', 'Scoping', 'recorte do escopo', 'Supervisor · Arquitetura e mapeamento', null, 1),
  ('aba3573c-fb85-589c-b1de-180f61803c76', 'et_2', 'Discovery', 'levantamento do que existe', 'Investigação do legado · Produto', null, 2),
  ('960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'et_3', 'Design', 'desenho da solução', 'Arquiteto · Banco de dados · Segurança · Impacto', null, 3),
  ('6fb03194-df1f-5789-be31-4aa7ac30f56f', 'et_4', 'Planning', 'planejamento', 'Supervisor · Dev líder · AI PO', null, 4),
  ('ff200273-4e16-5a73-9d89-43c75d1689ae', 'et_5', 'Build', 'construção', 'Dev especialista', null, 5),
  ('3369c902-ec7f-5904-92e0-cda9650f81d8', 'et_6', 'QA & Security', 'testes e segurança', 'QA · Segurança · Auditoria técnica', null, 6),
  ('c0d39cf8-5786-50c2-aa93-2f3451130d99', 'et_7', 'Verification', 'verificação final', 'Verificador final', null, 7),
  ('69bff48e-3ff0-5197-bcfe-cd4fa56c662a', 'et_8', 'Approval', 'aprovação', 'William', null, 8),
  ('8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'et_9', 'Release', 'entrega no ar', 'Dev líder · Impacto e regressão', null, 9),
  ('2a068aec-dfe8-57e3-a4c6-92c3b51ed763', 'et_10', 'Retrospective', 'aprender com a entrega', 'Aprendizado e prevenção', null, 10)
on conflict (id) do nothing;

insert into public.etapas_modelo_itens (id, etapa_id, texto, modo, obrigatorio, prova_tipo, quem_cumpre, so_terceiros, ordem) values
  ('983be369-bc26-56fe-8afd-52ff277c0c07', '662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'Quem pediu, qual sistema e qual empresa', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('86f897a0-db25-589a-a361-90715176886c', '662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'Tipo: projeto novo, em andamento, melhoria ou incidente', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('87e188a3-bc4a-5412-9db2-2d83debf9e68', '662a56b1-0fe9-5bd1-8776-7bce89f6ee04', 'Urgência e autorização mínima para começar', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('acaff49b-da46-5980-b5cc-0c401cb03d0c', 'af44fe96-f85f-5815-b727-4b172fcfb729', 'Objetivo, perfis de usuário e critérios de aceite', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('98ac4985-3fc0-5808-a675-4169afb46d21', 'af44fe96-f85f-5815-b727-4b172fcfb729', 'Repositório, banco e ambiente confirmados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('7fcadd16-e9a7-5ce9-83ff-29f51093face', 'af44fe96-f85f-5815-b727-4b172fcfb729', 'O que fica de fora, por escrito', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('290ff705-7732-553f-b470-ef7e16be4877', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Código e banco confrontados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('ba675695-df22-5edb-8c46-cdc3bacb5dfb', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Quem usa, como usa e as jornadas de cada perfil', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('25e28a59-a8c6-55ff-bf51-449cc71f39a5', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Achados marcados como fato, inferência, hipótese ou proposta', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('6ff15df9-06ba-5297-8002-dc1fb0e33f47', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Acesso ao código, ao banco e à documentação do sistema de terceiros', 'aviso', true, 'texto', 'responsavel_etapa', true, 3),
  ('d86717d7-c7b2-55cb-a8eb-180846791ea5', 'aba3573c-fb85-589c-b1de-180f61803c76', 'Mapa dos riscos do código feito por outra empresa', 'aviso', true, 'arquivo', 'responsavel_etapa', true, 4),
  ('50bed218-7f2e-52c3-9934-b3f3688de7c9', 'aba3573c-fb85-589c-b1de-180f61803c76', 'O que dá para aproveitar e o que precisa ser refeito', 'aviso', true, 'texto', 'responsavel_etapa', true, 5),
  ('35a8cf39-daf2-5c4d-98ed-6d6ba5b9fb21', '960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'Arquitetura, contratos de API e eventos, modelo de dados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('a8c38e31-e4eb-526e-943a-4eed4ffb5815', '960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'Regras de acesso desenhadas antes de criar', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('b5eb5781-24dd-5d34-ae40-5f932a83dceb', '960e16bb-9657-5168-a6ef-ddbc14ff0ec8', 'Quem mais é afetado e como voltar atrás', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('cf2dbff3-0b5f-5a9e-a545-f50df2ee56a5', '6fb03194-df1f-5789-be31-4aa7ac30f56f', 'Epics, stories e tasks com critério de aceite', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('20b1b428-ba1e-563c-8f17-79572786eecc', '6fb03194-df1f-5789-be31-4aa7ac30f56f', 'Estimativa e datas previstas', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('5d0ffbbf-8503-5893-b6bc-d30eae972996', '6fb03194-df1f-5789-be31-4aa7ac30f56f', 'Marcos e dependências ligados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('79932756-4a3c-57a5-9290-b1564f98c2ed', 'ff200273-4e16-5a73-9d89-43c75d1689ae', 'Mudança mínima e reversível', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('a0d0da90-9034-5756-8bd3-47ba6c04666c', 'ff200273-4e16-5a73-9d89-43c75d1689ae', 'Teste escrito antes do código, quando se aplica', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('d791b2fe-253d-553a-9a90-7dd2f8c6c981', 'ff200273-4e16-5a73-9d89-43c75d1689ae', 'Só no repositório e ambiente autorizados', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('7034c9e0-967c-5f95-a23d-11e7bcadaf86', '3369c902-ec7f-5904-92e0-cda9650f81d8', 'Testes funcionais, de integração e de regressão', 'aviso', true, 'captura', 'responsavel_etapa', false, 0),
  ('962bc464-0e87-51ec-bdc9-9741f2e1b95d', '3369c902-ec7f-5904-92e0-cda9650f81d8', 'Autorização no servidor, segredos e dependências', 'aviso', true, 'captura', 'responsavel_etapa', false, 1),
  ('ac9ba9f5-eee4-5f5f-b300-be5efab6add4', '3369c902-ec7f-5904-92e0-cda9650f81d8', 'Isolamento provado com dois clientes', 'aviso', true, 'captura', 'responsavel_etapa', false, 2),
  ('cd0e946c-f4da-5685-8b12-f938dc90e7f8', 'c0d39cf8-5786-50c2-aa93-2f3451130d99', 'Build, lint e testes rodados, com a saída real', 'aviso', true, 'captura', 'responsavel_etapa', false, 0),
  ('88b7bfe0-d173-5b54-8009-6d40346193e6', 'c0d39cf8-5786-50c2-aa93-2f3451130d99', 'Checklist completo e riscos que sobram declarados', 'aviso', true, 'captura', 'responsavel_etapa', false, 1),
  ('b54003ba-0495-5c27-b323-e91f5b77d38e', 'c0d39cf8-5786-50c2-aa93-2f3451130d99', 'Requisitos obrigatórios da aplicação cumpridos', 'aviso', true, 'captura', 'responsavel_etapa', false, 2),
  ('4b9601cd-99a5-528d-8c6b-10fc6bb9f47b', '69bff48e-3ff0-5197-bcfe-cd4fa56c662a', 'Push, merge, deploy e migração só com o "sim" dele', 'aviso', true, 'aprovacao', 'responsavel_etapa', false, 0),
  ('d41a83ad-77cb-501d-9761-663abd9d323b', '69bff48e-3ff0-5197-bcfe-cd4fa56c662a', 'Decisões pendentes respondidas', 'aviso', true, 'aprovacao', 'responsavel_etapa', false, 1),
  ('d5503ce4-1472-527f-a3da-21dca21a34a4', '8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'Plano de migração com paridade e rollback', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('52a78022-9b8b-5707-8629-9d3277eaa1a4', '8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'Convivência com o sistema antigo', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1),
  ('d912442e-35d5-5c6a-a607-b040fdba852b', '8f1d21f3-c820-50f5-bf07-8f1139d1372d', 'Changelog publicado para o cliente', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 2),
  ('ccfda1b9-57a7-5b62-b0ff-ced860bca655', '2a068aec-dfe8-57e3-a4c6-92c3b51ed763', 'Causa do que deu errado e o controle que evita repetir', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 0),
  ('1d008284-dcac-5159-be49-26d003d89047', '2a068aec-dfe8-57e3-a4c6-92c3b51ed763', 'Lições gravadas na memória', 'aviso', true, 'nenhuma', 'responsavel_etapa', false, 1)
on conflict (id) do nothing;

insert into public.etapas_nos (no_id, item_modelo_id, situacao, cumprido_por, cumprido_em, motivo_dispensa) values
  ('cea3db88-841f-5511-98d1-3bedcc411131', '983be369-bc26-56fe-8afd-52ff277c0c07', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '86f897a0-db25-589a-a361-90715176886c', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '87e188a3-bc4a-5412-9db2-2d83debf9e68', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', 'acaff49b-da46-5980-b5cc-0c401cb03d0c', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '98ac4985-3fc0-5808-a675-4169afb46d21', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '290ff705-7732-553f-b470-ef7e16be4877', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-07T12:00:00-03:00', null),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '7fcadd16-e9a7-5ce9-83ff-29f51093face', 'dispensado', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-08-12T12:00:00-03:00', 'Escopo aberto por decisão do William: o projeto cresce por produto'),
  ('cea3db88-841f-5511-98d1-3bedcc411131', '35a8cf39-daf2-5c4d-98ed-6d6ba5b9fb21', 'cumprido', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-06T12:00:00-03:00', null)
on conflict (no_id, item_modelo_id) do nothing;

insert into public.provas (id, no_id, item_modelo_id, tipo, valor, enviado_por) values
  ('67c6e848-f89a-5708-a213-42e693cd7e2b', 'cea3db88-841f-5511-98d1-3bedcc411131', '983be369-bc26-56fe-8afd-52ff277c0c07', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('ae810f7d-0d9e-53cf-9d18-ef0df5173f76', 'cea3db88-841f-5511-98d1-3bedcc411131', '86f897a0-db25-589a-a361-90715176886c', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('f8a62d26-cd14-53e1-bb6d-beb04607e56a', 'cea3db88-841f-5511-98d1-3bedcc411131', '87e188a3-bc4a-5412-9db2-2d83debf9e68', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('f6389416-5196-5cee-b485-5a17a2bef898', 'cea3db88-841f-5511-98d1-3bedcc411131', 'acaff49b-da46-5980-b5cc-0c401cb03d0c', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('ee4dbd32-79be-50f9-8e38-c8238a2224d6', 'cea3db88-841f-5511-98d1-3bedcc411131', '98ac4985-3fc0-5808-a675-4169afb46d21', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('453ac331-2eab-59de-a107-de8aaf28928c', 'cea3db88-841f-5511-98d1-3bedcc411131', '290ff705-7732-553f-b470-ef7e16be4877', 'texto', 'Registrado no Intake do projeto BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28'),
  ('fbdcd999-b027-5cf9-80b7-db220922a969', 'cea3db88-841f-5511-98d1-3bedcc411131', '35a8cf39-daf2-5c4d-98ed-6d6ba5b9fb21', 'link', 'Canvas de estruturação do BL', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28')
on conflict (id) do nothing;

insert into public.agentes (id, codigo, nome, papel, instrucoes, regras_passagem) values
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'ag_po', 'AI PO', 'Product Owner: planos de execução, capacidade do time, previsão e replanejamento', 'Organize as demandas em epics, stories e tasks. Use a capacidade de cada pessoa. Nunca mude prazo, pessoa ou cliente sem a aprovação do Master.', 'Qualquer decisão de prazo, custo ou cliente'),
  ('41e3b626-1c1d-5011-9dfe-8551b88390eb', 'ag_at', 'Agente de atendimento', 'Primeira resposta no Service Desk: entende, classifica e resolve dúvidas', 'Converse primeiro, faça perguntas objetivas e tente reproduzir. Dúvida de uso: explique com base no manual. Falha real: resuma com passos e provas e passe para a equipe.', 'Cliente pede uma pessoa, sistema parado, ou duas tentativas sem resolver'),
  ('6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'ag_billy', 'Billy', 'Assistente do grupo: ouvinte, operacional e voz', 'Siga os níveis de permissão. Toda function call é validada pelo Java antes de executar.', 'Qualquer ação fora do nível Livre')
on conflict (id) do nothing;

insert into public.agentes_fontes (id, agente_id, nome) values
  ('95887200-b2a4-53ad-a251-6f96f63ef1ba', 'e9104d90-ba48-5020-9888-c995298bb0d0', 'Banco do projeto'),
  ('2a9e92f4-f3d7-51b0-8094-caca54dd1717', 'e9104d90-ba48-5020-9888-c995298bb0d0', 'Canvas do projeto'),
  ('188e982c-1cef-5224-a311-a43df3ae0545', 'e9104d90-ba48-5020-9888-c995298bb0d0', 'Ficha técnica'),
  ('a8689980-10a7-5c2b-9665-086e662fe213', 'e9104d90-ba48-5020-9888-c995298bb0d0', 'Histórico de entregas'),
  ('a2bdfe2c-4ab4-5309-ad03-f3c387594e51', '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Manual de cada aplicação'),
  ('a795acfe-5e87-5d30-a38f-2581a427798a', '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Base de conhecimento'),
  ('a5788818-3257-52ea-b19d-7d7457b8378e', '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Histórico de pedidos'),
  ('bf5ccc1e-a7c8-5d43-9f45-3dd368d317fc', '6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Banco BL'),
  ('3719dfe0-27ab-5bb2-bbda-c938c8827390', '6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Reuniões'),
  ('31063adb-ea7b-5860-8a2a-1cde9a9fe027', '6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Tarefas')
on conflict (id) do nothing;

insert into public.agentes_ferramentas (agente_id, ferramenta, permissao) values
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'Criar tarefa', 'confirmacao'),
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'Mudar status', 'automatica'),
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'Mudar prazo', 'confirmacao'),
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'Atribuir pessoa', 'confirmacao'),
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'Gerar relatório', 'livre'),
  ('e9104d90-ba48-5020-9888-c995298bb0d0', 'Apagar item', 'bloqueada'),
  ('41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Responder o cliente', 'automatica'),
  ('41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Classificar pedido', 'automatica'),
  ('41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Juntar pedidos repetidos', 'confirmacao'),
  ('41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Criar item no board', 'confirmacao'),
  ('41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Fechar pedido', 'confirmacao'),
  ('6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Consultar dados', 'livre'),
  ('6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Criar tarefa', 'confirmacao'),
  ('6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Enviar mensagem', 'confirmacao'),
  ('6b674e96-56c2-5bbe-aaab-95ae0d2ac587', 'Mexer em financeiro', 'bloqueada')
on conflict (agente_id, ferramenta) do nothing;

insert into public.pedidos (id, no_id, autor_id, tipo, gravidade, status, titulo, contexto, item_id, criado_em, resolvido_em) values
  ('a7b735ee-a6a3-543c-8b82-31c4b8687986', 'd23ede90-b2b5-56e0-b294-cc0ff4f9c41a', '2246aac4-fcc9-5564-af95-054b9cc42889', 'bug', 'quebrada', 'aguardando_voce', 'Guias do mês anterior aparecendo no filtro de setembro', '{"resumo": "Tela: Guias e vencimentos · Versão 0.4.2 · Chrome 128 · Erro: nenhum"}'::jsonb, null, '2026-09-25T09:00:00-03:00', null),
  ('92e61f72-37c7-5606-9391-2850c2c953ef', 'c37cc0c0-2eec-59e2-bebf-989417c684ee', '2246aac4-fcc9-5564-af95-054b9cc42889', 'duvida', 'incomodo', 'resolvido', 'Como reenviar um documento rejeitado', '{"resumo": "Tela: Documentos · Versão 0.2.0 · App Android"}'::jsonb, null, '2026-09-23T09:00:00-03:00', '2026-09-23T09:00:00-03:00'),
  ('4b6ff104-2e8d-5ae1-961d-aeccc76f2977', '38ff5917-3d08-5887-ba5f-57a82861493f', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', 'funcionalidade', 'cosmetico', 'novo', 'Ver o faturamento consolidado das empresas no celular', '{"resumo": "Tela: Resumo diário · App iOS"}'::jsonb, null, '2026-09-26T09:00:00-03:00', null)
on conflict (id) do nothing;

insert into public.pedidos_mensagens (id, pedido_id, autor_tipo, pessoa_id, agente_id, texto, criado_em) values
  ('cbbbb4fe-b0ee-5b65-850d-0348829ee774', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', null, 'Quando filtro setembro aparecem guias de agosto também.', '2026-09-25T09:01:00-03:00'),
  ('bc532fc8-57cc-5770-9487-7fc446d6ecda', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'ia', null, '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Entendi. Consegue me dizer se isso acontece com todos os clientes ou só com algum específico?', '2026-09-25T09:04:00-03:00'),
  ('0a90a70f-5822-5f35-a056-332b51b4bc49', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', null, 'Com todos. Mandei o print.', '2026-09-25T09:07:00-03:00'),
  ('3995aaa1-42c5-5ca4-9e31-71d3236350bf', 'a7b735ee-a6a3-543c-8b82-31c4b8687986', 'ia', null, '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Obrigado. Reproduzi o comportamento com os dados do print: o filtro está usando a data de vencimento em vez da competência. Classifiquei como falha real e passei para a equipe.', '2026-09-25T09:10:00-03:00'),
  ('d784db51-d765-5626-b4b7-d25435f6b1cd', '92e61f72-37c7-5606-9391-2850c2c953ef', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', null, '(áudio transcrito) Mandei o documento errado, como faço para mandar de novo?', '2026-09-23T09:01:00-03:00'),
  ('47bbe6b2-64c1-59ef-ae85-21e4ff247125', '92e61f72-37c7-5606-9391-2850c2c953ef', 'ia', null, '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'É só abrir o documento com a etiqueta Rejeitado e tocar em Reenviar. O arquivo antigo fica guardado no histórico.', '2026-09-23T09:04:00-03:00'),
  ('af77e683-b8ca-5d4e-a70a-fdca09cc704e', '92e61f72-37c7-5606-9391-2850c2c953ef', 'cliente', '2246aac4-fcc9-5564-af95-054b9cc42889', null, 'Deu certo, obrigado.', '2026-09-23T09:07:00-03:00'),
  ('dfd08714-19c8-5d47-8d68-57dbaa6d776e', '4b6ff104-2e8d-5ae1-961d-aeccc76f2977', 'cliente', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', null, 'Queria ver o faturamento de todas as empresas juntas, na primeira tela.', '2026-09-26T09:01:00-03:00'),
  ('bd38e37d-964d-5eb7-89aa-1215942eb4ac', '4b6ff104-2e8d-5ae1-961d-aeccc76f2977', 'ia', null, '41e3b626-1c1d-5011-9dfe-8551b88390eb', 'Anotado como pedido de funcionalidade nova. Quer ver o total do mês ou comparar com o mês anterior também?', '2026-09-26T09:04:00-03:00')
on conflict (id) do nothing;

insert into public.anexos (id, nome, tipo, tamanho_bytes, storage_path, url, item_id, enviado_por, pedido_id) values
  ('3c4b66dd-9607-5e5b-afec-af0224ea20c9', 'Canvas de estruturação do BL', 'link', null, null, 'https://claude.ai/artifact/GYBDTp5XrcAVbA5Z8Aqa88', 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', null),
  ('61914708-368b-5a03-b25c-7af8ff098e26', 'rascunho-painel-ceo.png', 'imagem', 184000, 'exemplo/rascunho-painel-ceo.png', null, 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', null),
  ('a92baad0-09a3-581c-a7bb-f3ae8fb0c0c8', 'print-filtro-competencia.png', 'imagem', null, 'exemplo/print-filtro-competencia.png', null, null, '2246aac4-fcc9-5564-af95-054b9cc42889', 'a7b735ee-a6a3-543c-8b82-31c4b8687986'),
  ('99a0b436-b169-506c-a7ae-112a95dcedb6', 'audio-duvida.m4a', 'audio', null, 'exemplo/audio-duvida.m4a', null, null, '2246aac4-fcc9-5564-af95-054b9cc42889', '92e61f72-37c7-5606-9391-2850c2c953ef')
on conflict (id) do nothing;

delete from auditoria.registros where tabela = 'itens' and mudancas ? 'semente';
insert into auditoria.registros (tabela, registro_id, acao, mudancas, pessoa_id, em) values
  ('itens', '9e11825c-aed2-5d36-968d-03a62362c33c', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-26T15:22:00+00:00'),
  ('itens', 'bdb0cca2-c9ee-5385-bf36-765defb34811', 'I', '{"titulo": "Integração com a Conexa", "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-26T12:41:00+00:00'),
  ('itens', '8a3977f7-b358-541c-970b-79ea511033f7', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-26T09:00:00+00:00'),
  ('itens', '58f2ad43-4326-5199-908c-edaf162cf37e', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-25T15:58:00+00:00'),
  ('itens', '0cd891b9-53a2-5077-b74f-f99cb4f60a77', 'I', '{"titulo": "API de transferência de clientes para os Javas", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-25T12:17:00+00:00'),
  ('itens', '9e805ad3-d394-52a8-addf-149375c03c4c', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-24T15:34:00+00:00'),
  ('itens', 'b6cf630e-0701-568e-9dd6-5c4ea9dff73a', 'U', '{"prazo": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-24T09:15:00+00:00'),
  ('itens', '9b1a19c7-b6ec-5214-ab3e-ffda925fff6b', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-23T15:13:00+00:00'),
  ('itens', 'ede1c23b-8e93-54f1-a51a-c2376ea8c027', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-23T12:32:00+00:00'),
  ('itens', 'd0c12602-067b-5fbb-93d9-1d3e9869ab5c', 'U', '{"prazo": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-23T09:51:00+00:00'),
  ('itens', '87d225b6-f37f-5f1f-a6b1-375ee9a5b22a', 'I', '{"titulo": "Login do cliente por CPF", "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-22T15:49:00+00:00'),
  ('itens', '7061c178-900a-5e80-a36e-080147aca0ad', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-22T12:08:00+00:00'),
  ('itens', '97feb758-c850-5aac-a658-59ca42ad853c', 'I', '{"titulo": "Níveis de permissão das function calls", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-21T15:25:00+00:00'),
  ('itens', 'fe4b9844-6a48-5076-8f8b-e0238f0c27d2', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-21T09:06:00+00:00'),
  ('itens', 'b7258ab3-15e9-5df4-bc90-9177b229f690', 'I', '{"titulo": "Botão de feedback do Kit CicloDev", "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-20T12:23:00+00:00'),
  ('itens', 'd8015c00-3a4a-51e0-90f7-b56e7edd6a2d', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-20T09:42:00+00:00'),
  ('itens', 'f773d5fc-e3f6-51f7-9a3e-b89184348318', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-19T15:40:00+00:00'),
  ('itens', '7a67550a-f4f0-5e6a-a7cd-a9dba3387090', 'I', '{"titulo": "Aprovações pendentes em um toque", "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-19T12:59:00+00:00'),
  ('itens', '2600ca8e-80f4-5573-bc0c-25d10602850e', 'U', '{"comentario": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-18T15:16:00+00:00'),
  ('itens', '7e034b06-b598-5e1b-a240-72a72a5a44cc', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-18T12:56:00+00:00'),
  ('itens', '8e22501f-6f05-5438-a680-4ac68cd051ba', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-17T12:14:00+00:00'),
  ('itens', '013b420d-67ff-5487-830a-47096059f9a5', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-17T09:39:00+00:00'),
  ('itens', '34e36605-30c9-5eb8-a1fa-0043eb1b6c2e', 'U', '{"prazo": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-17T09:33:00+00:00'),
  ('itens', '0abf5256-5faa-5b27-859d-b7e5c6b31ada', 'I', '{"titulo": "Integração com marketplaces", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-16T15:31:00+00:00'),
  ('itens', 'a1453820-697f-5834-947c-544319d7048d', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-16T12:50:00+00:00'),
  ('itens', 'edd71102-1084-5f62-893b-7e960fa8a290', 'I', '{"titulo": "Tela de guias e vencimentos", "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-15T15:07:00+00:00'),
  ('itens', '2eaa0315-945c-52b8-a1c8-08faffe7631b', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'b5510531-2c75-59fb-b2c1-006a90d0775f', '2026-09-15T09:48:00+00:00'),
  ('itens', '5d590ea1-84f1-5356-a38e-e41d05ff2cd1', 'I', '{"titulo": "Cobrança pelo faturamento via Pix", "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-14T12:05:00+00:00'),
  ('itens', '0f07e627-5656-5248-a912-45778d4334ac', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, 'd148fdc5-eef3-5398-bf89-f49b55b5cd28', '2026-09-14T09:24:00+00:00'),
  ('itens', 'edfcb991-3fc4-53f2-906b-6368f2179447', 'U', '{"status_id": [null, null], "semente": true}'::jsonb, '29f7bce5-bf6e-5a2f-8e3b-c25e855a33c4', '2026-09-13T09:57:00+00:00');

alter table public.nos enable trigger nos_auditoria;
alter table public.itens enable trigger itens_auditoria;
alter table public.itens enable trigger itens_automacoes;
alter table public.comentarios enable trigger comentarios_auditoria;
alter table public.pedidos enable trigger pedidos_auditoria;
alter table public.custos_tecnicos enable trigger custos_tecnicos_auditoria;
alter table public.receitas enable trigger receitas_auditoria;
alter table public.regras_calculo enable trigger regras_calculo_auditoria;
alter table public.pessoas_custos enable trigger pessoas_custos_auditoria;
alter table public.servicos enable trigger servicos_auditoria;
alter table public.agentes enable trigger agentes_auditoria;
alter table public.marcos enable trigger marcos_auditoria;
alter table public.sprints enable trigger sprints_auditoria;
alter table public.automacoes enable trigger automacoes_auditoria;
commit;

select bi.atualizar();
