# Jira, Trello e o nosso sistema: um modelo só, sem nada repetido

Regra combinada com o William (28/09/2026): cada coisa existe **uma vez** no nosso banco. Um item é o mesmo item, venha ele do Jira (issue), do Trello (card) ou daqui. As ferramentas de fora só **apontam** para o nosso registro por uma tabela de ligação. Nada de tabela "itens_jira", "cards_trello" ou coluna "titulo_trello".

## 0. Fontes lidas (28/09/2026)

Espaço **"Atlassian (Cloud)"** da Postman API Reference Library, lido pelo conector do Postman: 12 coleções e **1.752 funções**, cada uma com método, caminho, parâmetros e campos. A lista completa de cada coleção está em `docs/atlassian/`.

| Coleção | Funções | Uso no nosso sistema |
|---|---|---|
| Trello REST API | 255 | **Integração**: cards, listas, checklists, etiquetas, membros, comentários, anexos, campos próprios e webhooks |
| Jira Cloud platform REST API (v3) | 582 | **Integração**: criar e editar item, trocar status, comentários, anexos, horas, ligações, prioridades, versões, componentes, filtros JQL e webhooks. Cerca de 277 funções são de administração do Jira (esquemas, telas, permissões, avatares, segurança) e não têm par aqui |
| Jira Software Cloud API | 95 | **Integração**: boards, backlog, sprints, épicos, ordem e estimativa (ver JIRA-ANALISE.md) |
| Jira Service Management | 69 | Nosso **Service Desk**: pedidos, tipos de pedido, SLA, clientes, aprovações e avaliação |
| Bitbucket | 348 | Painel **Desenvolvimento** do item: branches, commits, pull requests e pipelines. O mesmo painel servirá para o GitHub |
| Confluence Cloud v2 | 194 | Documentação e ficha técnica. Fica para depois |
| Statuspage | 115 | Requisito "Sinal de funcionamento": componentes, incidentes e manutenções. Fica para depois |
| Admin Control, Atlassian Access, IDv2, User provisioning (SCIM), Data Loss Prevention | 94 | Administração de organização, login único e cadastro automático de usuários. Não entram agora |

**Login:**
- **Trello:** chave da API (`key`) + token do usuário (`token`) no endereço da chamada, em `https://api.trello.com/1`.
- **Jira:** e-mail + token de API (basic) ou OAuth 2.0, em `https://<site>.atlassian.net`.

Os tokens ficam no cofre do Supabase.

## 1. Cada conceito, uma vez só

| Nosso (único) | Jira | Trello |
|---|---|---|
| Cliente (nó "cliente") | Site ou organização (cloudId) | Workspace (organization) |
| Projeto, produto, aplicação, frente (nós da Estrutura) | Project, e o board aponta para ele | Board |
| Configuração do Board do nó | Board (tipo scrum ou kanban, colunas, estimativa) | Board (as listas são as colunas) |
| Coluna do Board | Coluna (junta vários status) | List |
| Status (`status_fluxo`, padrão ou do nó) | Status e categoria | List (cada list vira um status do nó) |
| Troca de status | Transition (fluxo) | mudar `idList` |
| Frente (nó "frente") | Component (área do projeto) | não tem (pode vir de etiqueta) |
| Prioridade | priority (Highest, High, Medium, Low, **Lowest**) | não tem |
| Motivo de conclusão (novo: `itens.resolucao`) | resolution | não tem |
| Horas que faltam (novo: `itens.restante_h`) | remainingEstimate | não tem |
| Horas lançadas (`tempo_registros`; a soma é calculada) | worklogs | não tem |
| Reações nos comentários (novo: `comentarios_reacoes`) | não tem | reactions (emoji) |
| Capa do card (novo: `anexos.capa`) | não tem | idAttachmentCover |
| Filtros salvos (`visoes_salvas`) | filters (JQL) | saved searches |
| Histórico (`auditoria.registros`) | changelog | actions |
| Pedido de cliente (`pedidos`) e SLA (`slas`) | customer request e SLA (Service Management) | não tem |
| Item (`itens`) | Issue | Card |
| Tipo do item (epic, story, task, subtask, bug) | Issue type | não tem, entra como task |
| Título, descrição | summary, description | name, desc |
| Responsável | assignee | primeiro membro do card |
| Outras pessoas no item (novo: `itens_pessoas`, papel membro, observador ou voto) | watchers e votes | os outros membros e os votos (membersVoted) |
| Quem abriu (relator) | reporter | quem criou o card |
| Início, prazo | start date, due date | start, due |
| Concluído | resolution e data | dueComplete |
| Arquivado | não tem | closed |
| Ordem no Board (`itens.ordem`, que já existe) | rank | pos |
| Chave legível (novo: `itens.chave`, como BL-123) | key (PROJ-123) | número do card (idShort) |
| Sinalizado com motivo (novo: `itens.sinalizado_em`, `itens.motivo_sinal`) | flagged | não tem (pode vir de etiqueta) |
| Pai (épico, história) | parent ou epic | não tem |
| Sprint | sprint | não tem |
| Versão ou marco (`marcos`) | fixVersion | não tem |
| Pontos e horas | story points, time tracking | não tem (pode vir de campo próprio) |
| Etiquetas (`etiquetas`, que já existe) + ligação com item (novo: `etiquetas_itens`) | labels | labels (com cor) |
| Checklist (`itens_checklist` + colunas novas `grupo`, `prazo`, `pessoa_id`) | não tem (usa subtarefas) | checklists com checkItems (name, state, pos, due, idMember) |
| Comentários (`comentarios`) | comments | ações "commentCard" |
| Anexos e links (`anexos`) | attachments | attachments |
| Ligações entre itens (`itens_ligacoes` + o tipo novo `clona`) | issue links (blocks, relates, duplicates, clones) | não tem |
| Campos próprios (`campos_personalizados`, `itens_campos`) | custom fields | custom fields (text, number, date, checkbox, list), que os nossos tipos já cobrem |
| Pessoas (`pessoas`) | usuário (accountId) | membro (idMember) |

## 2. O que muda no banco (só o que falta, sem duplicar)

**Em tabelas que já existem:**
- `itens`:
  - colunas novas `chave` (BL-123, única por projeto), `sinalizado_em`, `motivo_sinal`, `resolucao` e `restante_h`;
  - prioridade aceita também `lowest`;
  - a coluna `ordem`, que já existe, passa a ser a ordem do Board.
- `itens_checklist`: colunas novas `grupo` (nome do checklist), `prazo` e `pessoa_id`.
- `itens_ligacoes`: tipo novo `clona`.
- `anexos`: coluna nova `capa`.

**Tabelas novas, uma para cada coisa que ainda não existe:**
- `boards_config`: a configuração do Board de cada nó. Guarda o tipo (scrum, kanban ou simples), a estimativa (nenhuma, contagem, pontos ou horas) e quais recursos estão ligados.
- `boards_colunas`: as colunas do Board de um nó, com nome, ordem, mínimo e máximo de itens e se subtarefa conta. Cada coluna aponta para os status (`status_fluxo`) que entram nela.
- `itens_pessoas`: as outras pessoas de um item, com o papel membro, observador ou voto.
- `etiquetas_itens`: a ligação entre etiqueta e item (as etiquetas já existem; hoje só ligam em nós).
- `comentarios_reacoes`: reações com emoji nos comentários.

**Integração (uma estrutura só para Jira, Trello e o que vier depois):**
- `integracoes`: cada conta conectada. Guarda provedor (jira ou trello), nome, conta de fora (cloudId ou workspace), endereço, qual nó da Estrutura ela alimenta, se está ativa e a última sincronização. **O token nunca fica aqui**: fica guardado no cofre do Supabase (Vault) e só a função do servidor lê.
- `vinculos_externos`: a ligação entre o nosso registro e o de fora. Cada linha tem a integração, a tabela (itens, sprints, nós, status_fluxo, pessoas, comentarios, anexos, etiquetas, marcos, itens_checklist), o nosso id, o id de fora, a chave de fora (PROJ-12 ou o link curto do Trello), o endereço e a data da última mudança lá. Um registro nosso aponta para no máximo um registro por conta.
- `integracoes_log`: o que chegou e o que foi enviado (webhooks e sincronizações), com os erros. Serve para achar problema.

Assim o mesmo item pode estar ligado ao Jira de um cliente e ao Trello de outro sem copiar nada: são só duas linhas em `vinculos_externos`.

## 3. Como a integração roda (igual para os dois)

1. O usuário conecta a conta (Jira por OAuth 2.0; Trello por chave + token ou OAuth). O token vai para o cofre do Supabase.
2. Uma função no servidor (Supabase Edge Function) faz todas as chamadas. O navegador nunca fala direto com o Jira ou o Trello.
3. **Importar:** boards, listas ou colunas, status, itens, comentários, checklists, etiquetas e pessoas entram nas NOSSAS tabelas, e cada um ganha uma linha em `vinculos_externos`.
4. **Manter em dia:** os webhooks do Jira e do Trello avisam mudanças lá; mudanças feitas aqui voltam para lá pela mesma função. Se os dois lados mudarem o mesmo campo, vale o mais recente e o conflito fica registrado em `integracoes_log`.

## 4. Layout familiar para quem vem do Jira e do Trello

Pedido do William: a organização da tela segue a do Jira e a do Trello, para o usuário se sentir em casa.

**Board (igual aos dois):**
- Colunas lado a lado, com nome, quantidade e limite no topo.
- "+ Criar" (Jira) ou "+ Adicionar um cartão" (Trello) no pé de cada coluna, e "+ Adicionar outra coluna" no fim.
- Barra acima do Board: busca, avatares das pessoas para filtrar, filtros rápidos, "Agrupar por" (raias) e o menu do Board.

**Cartão:**
- etiquetas coloridas no topo (Trello);
- capa, se tiver (Trello);
- título;
- embaixo: ícone do tipo, chave BL-123, prioridade, pontos numa bolinha e avatar do responsável (Jira);
- marcadores de prazo, checklist 2/5, comentários, anexos e descrição (Trello);
- bandeira quando está sinalizado (Jira).

**Abrir um item:**
- **Topo:** a trilha "Projeto › Épico › BL-123", o botão de status com as trocas possíveis e as ações (observar, compartilhar, mais).
- **Esquerda:** título, descrição, checklists, subitens e itens ligados, e embaixo a atividade (comentários, histórico e horas), como no Jira.
- **Direita:**
  - o painel "Detalhes" (responsável, relator, etiquetas, sprint, pontos, prioridade, pai, versão, componente, datas);
  - o bloco "Adicionar ao cartão" (membros, etiquetas, checklist, datas, anexo, capa, campos próprios);
  - as "Ações" (mover, copiar, arquivar), como no Trello.

**Menu do projeto (Jira):** Planejamento (Linha do tempo, Backlog, Board, Relatórios, Itens), Desenvolvimento (Código, Versões) e Configurações. No nosso sistema isso fica nas abas de Operações, na mesma ordem.
