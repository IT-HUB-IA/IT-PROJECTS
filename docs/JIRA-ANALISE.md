# Jira Software Cloud: análise da documentação e plano para o Board

Fonte analisada: coleção Postman "Jira Software Cloud API" enviada pelo William em 28/09/2026 (os dois arquivos enviados são idênticos).
105 funções em 13 grupos. Todas foram lidas, com descrição, parâmetros e campos enviados.

**Importante sobre o alcance da documentação:** ela cobre só a parte "Software" do Jira (boards, backlog, sprints, épicos, ordem e estimativa, mais os dados de desenvolvimento). Criar e editar item, trocar status, comentar, ler campos e buscar com JQL ficam na **API da plataforma do Jira (REST v3)**, que não está nesta coleção. Para a integração de verdade vamos precisar dela também.

**Login usado pela coleção:** e-mail + token de API (autenticação "basic"). O Jira também aceita OAuth 2.0 (as descrições citam os escopos `read:board-scope:jira-software`, `read:project:jira` etc.). Para contas de clientes, o certo é OAuth 2.0: o usuário autoriza no próprio Jira e nós nunca vemos a senha dele.

## 1. O que cada grupo faz e como fica no nosso sistema

Legenda: ✅ já temos · 🟡 temos parte · ❌ falta

### Backlog (2 funções)
| Função do Jira | Nosso sistema |
|---|---|
| Mover itens para o backlog (tira de sprint ativo ou futuro), até 50 por vez | 🟡 existe no planejamento do sprint, um item por vez. Falta mover vários de uma vez e o backlog como tela própria do Board |
| Mover para o backlog de um board, com posição (antes de qual item) | ❌ falta a ordem manual (rank) |

### Board (33 funções)
| Função do Jira | Nosso sistema |
|---|---|
| Listar, criar, apagar board. Tipos: scrum, kanban, simple | 🟡 temos um Board por ponto da estrutura, sem tipo. Falta escolher Scrum ou Kanban |
| Board ligado a um filtro (JQL) e a um lugar (projeto ou usuário) | 🟡 o Board segue o ponto escolhido na Estrutura. Falta filtro salvo como base do board |
| Configuração: colunas, com vários status em cada coluna, mínimo e máximo de itens (contando ou não subtarefas); a última coluna é "concluído" | 🟡 temos colunas por status e limite de WIP por frente. Falta juntar vários status numa coluna, mínimo por coluna e escolher se subtarefa conta |
| Estimativa do board: nenhuma, contagem de itens ou um campo (story points ou tempo original) | 🟡 temos horas e pontos no item. Falta escolher qual vale no board e somar por coluna e sprint |
| Ranking (ordem manual dos itens) | ❌ falta arrastar para cima e para baixo dentro da coluna e guardar a ordem |
| Itens do backlog, itens do board, contagem aproximada | 🟡 temos a lista do board. Falta a tela de backlog no Board |
| Épicos do board (feitos e não feitos), itens sem épico, itens de um épico | 🟡 temos o tipo "epic" e o pai. Falta o painel de épicos com cor, progresso e o filtro "sem épico" |
| Recursos do board (ligar e desligar: backlog, sprints, estimativa etc.) | ❌ falta |
| Projetos do board | ✅ vem da Estrutura |
| Propriedades do board (dados livres guardados no board) | ❌ falta (interno, útil para a integração) |
| Filtros rápidos do board (cada um é uma consulta JQL) | 🟡 temos 6 filtros fixos e a busca "status = in progress". Falta criar filtros rápidos próprios de cada board |
| Relatórios do board | 🟡 temos burndown e ritmo. Faltam velocidade por sprint, fluxo acumulado e relatório de sprint |
| Sprints do board (futuro, ativo, encerrado) e itens de cada sprint | ✅ temos (planejado, ativo, encerrado) |
| Versões do board (lançadas ou não) | 🟡 temos marcos do tipo "release". Falta marcar como lançada e filtrar |

### Epic (9 funções)
| Função do Jira | Nosso sistema |
|---|---|
| Ver épico, atualizar nome, resumo, cor (9 cores) e "feito" | 🟡 falta cor do épico e "feito" separado do status |
| Itens de um épico, itens sem épico, mover para épico, tirar do épico (50 por vez) | 🟡 temos o pai do item, um por vez. Falta em massa |
| Ordenar épicos | ❌ falta |

### Issue (4 funções)
| Função do Jira | Nosso sistema |
|---|---|
| Ordenar itens (antes ou depois de outro), 50 por vez | ❌ falta (ranking) |
| Ver item com os campos ágeis: sprint, sprints encerrados, **sinalizado (flagged)**, épico | 🟡 falta "sinalizado" (impedimento) e o histórico de sprints por onde o item passou |
| Ver e mudar a estimativa do item no board (aceita 1w, 2d, 3h, 20m) | 🟡 temos horas. Falta aceitar "2d 3h" e seguir o tipo de estimativa do board |

### Sprint (13 funções)
| Função do Jira | Nosso sistema |
|---|---|
| Criar sprint (nome, datas, meta) | ✅ |
| Iniciar (precisa de datas) e encerrar (grava a data de conclusão) | ✅ iniciar e encerrar. Falta gravar a data real de conclusão |
| Apagar sprint (itens abertos voltam ao backlog) | 🟡 conferir |
| Mover itens para o sprint com posição | 🟡 um por vez, sem posição |
| Trocar a ordem de dois sprints | ❌ falta |
| Propriedades do sprint | ❌ falta (interno) |

### Desenvolvimento, builds, deploys, feature flags, links externos, segurança, incidentes e componentes (44 funções)
Estas funções são para **outras ferramentas mandarem dados para o Jira**: branches, commits e pull requests (GitHub), builds e deploys (Vercel, por exemplo), feature flags, vulnerabilidades, incidentes e revisões pós-incidente. Só apps do Atlassian Connect ou Forge usam. No Jira, isso aparece dentro do item como "Desenvolvimento", "Deploys" etc.

| Nosso sistema | Situação |
|---|---|
| Painel "Desenvolvimento" dentro do item: branches, commits, PRs, builds e deploys ligados a ele | ❌ falta. Podemos ter igual, lendo direto do GitHub e da Vercel |
| Vulnerabilidades virando item de trabalho | ❌ falta |
| Incidentes e revisões pós-incidente | 🟡 temos o Service Desk (pedidos). Falta o tipo "incidente" com revisão |

## 2. Plano para o Board ficar com o que o Jira tem

**Fase A · Board igual ao do Jira** (tela)
1. Tipo do board: Scrum ou Kanban. No Kanban o backlog é opcional; no Scrum o Board mostra o sprint ativo.
2. Configurar colunas: nome, quais status entram em cada uma, mínimo e máximo, e se subtarefa conta.
3. Estimativa do board: nenhuma, contagem, story points ou tempo. Soma por coluna e por sprint.
4. Ordem manual (rank): arrastar dentro da coluna, e "mover para o topo ou para o fim".
5. Sinalizar item (flag de impedimento), com motivo, destacado no cartão.
6. Chave legível em cada item, como "BL-123", igual ao Jira (também necessária para a integração).
7. Tela de Backlog no Board, com seleção de vários itens e "mover para sprint", "mover para épico" e "mover para o backlog".
8. Painel de épicos: cor, progresso e filtro por épico ou "sem épico".
9. Filtros rápidos próprios de cada board, com a nossa busca.
10. Versões: marcar lançada e filtrar.
11. Relatórios: velocidade, fluxo acumulado e relatório do sprint.
12. Sprints: data real de conclusão, trocar a ordem, o que fazer com o que não terminou ao encerrar.

**Fase B · Integração com o Jira**
1. Conectar a conta do Jira por OAuth 2.0 (o usuário autoriza no Jira). O token fica guardado no servidor (Supabase), nunca na tela.
2. Uma função no servidor faz as chamadas ao Jira (o navegador não fala direto com o Jira).
3. Tabela de ligação: cada item, sprint, épico, board e pessoa do Jira aponta para o nosso.
4. Importar do Jira: boards, colunas, sprints, épicos e itens.
5. Manter em dia nos dois sentidos: webhooks do Jira avisam mudanças; mudanças feitas aqui voltam para lá.
6. Precisa da documentação da API da plataforma do Jira (REST v3) para criar, editar, mudar status e comentar.

## 3. Antes de tudo: gravar no banco

Hoje, com login, as telas **leem** do banco, mas as mudanças feitas nelas (fora de Domínios e da ficha do cliente) **não são gravadas**. Tudo o que for feito no Board, inclusive o que vier do Jira, precisa ser gravado no banco. Por isso a gravação vem primeiro.
