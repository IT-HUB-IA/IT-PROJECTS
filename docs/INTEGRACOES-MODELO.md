# Jira, Trello e o nosso sistema: um modelo só, sem nada repetido

Regra combinada com o William (28/09/2026): cada coisa existe **uma vez** no nosso banco. Um item é o mesmo item, venha ele do Jira (issue), do Trello (card) ou daqui. As ferramentas de fora só **apontam** para o nosso registro por uma tabela de ligação. Nada de tabela "itens_jira", "cards_trello" ou coluna "titulo_trello".

> **Situação da fonte do Trello:** a página https://support.atlassian.com/trello/docs/getting-started-with-trello-rest-api/ está bloqueada pela rede desta sessão (support.atlassian.com e developer.atlassian.com). O lado Trello abaixo foi montado com o conhecimento da API REST do Trello (api.trello.com/1) e **ainda precisa ser conferido com a documentação**. O lado Jira foi conferido com a coleção enviada (ver JIRA-ANALISE.md).

## 1. Cada conceito, uma vez só

| Nosso (único) | Jira | Trello |
|---|---|---|
| Cliente (nó "cliente") | Site ou organização (cloudId) | Workspace (organization) |
| Projeto, produto, aplicação, frente (nós da Estrutura) | Project, e o board aponta para ele | Board |
| Configuração do Board do nó | Board (tipo scrum ou kanban, colunas, estimativa) | Board (as listas são as colunas) |
| Coluna do Board | Coluna (junta vários status) | List |
| Status (`status_fluxo`, padrão ou do nó) | Status | List (cada list vira um status do nó) |
| Item (`itens`) | Issue | Card |
| Tipo do item (epic, story, task, subtask, bug) | Issue type | não tem, entra como task |
| Título, descrição | summary, description | name, desc |
| Responsável | assignee | primeiro membro do card |
| Outras pessoas no item (novo: `itens_pessoas`) | watchers | os outros membros do card |
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
| Checklist (`itens_checklist`, mais a coluna nova `grupo`) | não tem (subtarefas) | checklists com itens (vários por card) |
| Comentários (`comentarios`) | comments | ações "commentCard" |
| Anexos e links (`anexos`) | attachments | attachments |
| Ligações entre itens (`itens_ligacoes`) | issue links | não tem |
| Campos próprios (`campos_personalizados`, `itens_campos`) | custom fields | custom fields |
| Pessoas (`pessoas`) | usuário (accountId) | membro (idMember) |

## 2. O que muda no banco (só o que falta, sem duplicar)

**Em tabelas que já existem:**
- `itens`: `chave` (BL-123, única por projeto), `sinalizado_em`, `motivo_sinal`. A coluna `ordem` já existe e passa a ser a ordem do Board.
- `itens_checklist`: `grupo` (nome do checklist, para os vários checklists de um card do Trello).

**Tabelas novas, uma para cada coisa que ainda não existe:**
- `boards_config`: a configuração do Board de cada nó. Guarda o tipo (scrum, kanban ou simples), a estimativa (nenhuma, contagem, pontos ou horas) e quais recursos estão ligados.
- `boards_colunas`: as colunas do Board de um nó, com nome, ordem, mínimo e máximo de itens e se subtarefa conta. Cada coluna aponta para os status (`status_fluxo`) que entram nela.
- `itens_pessoas`: as outras pessoas de um item (observadores do Jira, membros do Trello além do responsável).
- `etiquetas_itens`: a ligação entre etiqueta e item (as etiquetas já existem; hoje só ligam em nós).

**Integração (uma estrutura só para Jira, Trello e o que vier depois):**
- `integracoes`: cada conta conectada. Guarda provedor (jira ou trello), nome, conta de fora (cloudId ou workspace), endereço, qual nó da Estrutura ela alimenta, se está ativa e a última sincronização. **O token nunca fica aqui**: fica guardado no cofre do Supabase (Vault) e só a função do servidor lê.
- `vinculos_externos`: a ligação entre o nosso registro e o de fora. Cada linha tem a integração, a tabela (itens, sprints, nós, status_fluxo, pessoas, comentarios, anexos, etiquetas, marcos, itens_checklist), o nosso id, o id de fora, a chave de fora (PROJ-12 ou o link curto do Trello), o endereço e a data da última mudança lá. Um registro nosso aponta para no máximo um registro por conta.
- `integracoes_log`: o que chegou e o que foi enviado (webhooks e sincronizações), com os erros. Serve para achar problema.

Assim o mesmo item pode estar ligado ao Jira de um cliente e ao Trello de outro sem copiar nada: são só duas linhas em `vinculos_externos`.

## 3. Trello: o que a API oferece (a conferir com a documentação)

- **Login:** chave da API (API key) + token do usuário, ou OAuth. O token fica no servidor.
- **Objetos:** Workspaces (organizations), Boards, Lists, Cards, Checklists e itens de checklist, Labels, Members, Actions (comentários e histórico), Attachments, Custom Fields, Webhooks, Search e Notifications.
- **Cards:** name, desc, idList, pos, due, start, dueComplete, idMembers, idLabels, closed, cover, idShort, shortLink, url.
- **Webhooks:** o Trello avisa uma URL nossa a cada mudança num board ou card. A assinatura HMAC confirma que o aviso veio mesmo do Trello.
- **Limites:** por volta de 300 chamadas a cada 10 segundos por chave e 100 a cada 10 segundos por token (a conferir).

## 4. Como a integração roda (igual para os dois)

1. O usuário conecta a conta (Jira por OAuth 2.0; Trello por chave + token ou OAuth). O token vai para o cofre do Supabase.
2. Uma função no servidor (Supabase Edge Function) faz todas as chamadas. O navegador nunca fala direto com o Jira ou o Trello.
3. **Importar:** boards, listas ou colunas, status, itens, comentários, checklists, etiquetas e pessoas entram nas NOSSAS tabelas, e cada um ganha uma linha em `vinculos_externos`.
4. **Manter em dia:** os webhooks do Jira e do Trello avisam mudanças lá; mudanças feitas aqui voltam para lá pela mesma função. Se os dois lados mudarem o mesmo campo, vale o mais recente e o conflito fica registrado em `integracoes_log`.
