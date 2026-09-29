# Banco do CicloDev (Supabase `tfcvoszeewmpghgxztuy`, no ar)

## Situação: aplicado no Supabase em 26/09/2026

O banco está no ar no projeto `tfcvoszeewmpghgxztuy` ("IT-Systems", Postgres 17, São Paulo), em 16 migrações:

| Migração | O que entrou |
|---|---|
| `ciclodev_01` a `ciclodev_07` | As partes 01 a 07 abaixo |
| `ciclodev_08a` a `ciclodev_08d` | A semente (parte 08) em quatro pedaços, por causa do tamanho |
| `ciclodev_09`, `ciclodev_10` | Depósito de arquivos e rotinas agendadas |
| `ciclodev_11_ajustes_verificador` | O que o verificador do Supabase pediu (ver "Ajustes do verificador") |
| `ciclodev_12_login` | A rotina `vincular_meu_login`: no primeiro login, liga a pessoa do time ao usuário pelo e-mail confirmado e devolve o papel dela (Master, Dev ou Stakeholder) |
| `ciclodev_13_dominios` | Cadastro de domínios (partes 11 e 12): tabelas `dominios` e `dominios_registros`, a visão `bi.dominios_situacao`, o aviso diário de vencimento para o Master (60, 30, 7, 1 e 0 dias antes) e o `it-ia.tec.br` com os 9 registros do Cloudflare |

**Conferência feita depois de aplicar:**
- Dados: as 54 tabelas têm o mesmo número de linhas e o mesmo conteúdo, linha por linha, que o banco de teste montado com estes arquivos. As únicas diferenças são a ordem alfabética de palavras com acento (o Supabase ordena de outro jeito) e a hora de envio das provas, que é a hora em que a semente rodou.
- Verificador de segurança do Supabase: nenhum aviso.
- Contas, simulando o login do William e desfazendo no fim: preço hora R$ 207,03; BL com custo do mês R$ 1.424,75, gasto R$ 15.310,07, cobrado R$ 209.000, a receber R$ 60.000 e equipe para terminar R$ 55.474,93. Tudo igual à tela.
- Acesso, simulando o login do CEO da B&L: vê só os 9 itens marcados como visíveis ao cliente e nenhum custo ou receita.
- Tempo no Supabase com os dados de exemplo: painel do projeto 25 ms, painel da raiz 12 ms, financeiro 79 ms, carga de 4 semanas 5 ms.

## Parte 18: itens mais completos, lixeira e modelos (aplicada em 29/09/2026 como `ciclodev_25_tarefas_lixeira_modelos`)

Testada no Postgres local (`96_teste_tarefas_LOCAL.sql`: 37 de 37) e conferida no Supabase depois de aplicar: colunas, tabelas com RLS e GRANT, funções, gatilhos e as duas rotinas (`ciclodev_lembretes` já rodou com sucesso). **Foi aplicada ANTES da tela nova, como precisa**: a tela passa a gravar as colunas `recorrencia`, `lembrete_em` e `lembrete_para` em `itens`; sem elas, criar ou alterar item dá erro.

| Peça | Para que serve |
|---|---|
| `itens.recorrencia` | Repetição (`{"freq":"dia|semana|mes|ano","a_cada":1,"ate":"AAAA-MM-DD"}`). Quem cria o próximo é a tela, ao concluir; a repetição passa para o novo |
| `itens.lembrete_em`, `lembrete_para`, `lembrete_enviado_em` | Lembrete. A rotina `ciclodev_lembretes` (a cada minuto) põe o aviso no sininho de quem pediu |
| `itens_descricao_versoes` | Cada versão da descrição, gravada pelo gatilho. Edições seguidas da mesma pessoa em 10 minutos ficam numa versão só. Só leitura para a tela |
| `modelos` | Modelos de item e de estrutura (projeto, produto, aplicação, frente), por espaço |
| `itens.excluido_em`, `nos.excluido_em` | Lixeira. Item na lixeira some da leitura (regra `ver` de `itens`); ponto da estrutura na lixeira esconde tudo o que tem dentro (a tela filtra) |
| `lixeira_mover`, `lixeira_restaurar`, `lixeira_apagar`, `lixeira_listar` | O que a tela chama. Confere quem pode: o que é do meu espaço, ou está dentro de algo compartilhado comigo como owner ou dev. O ponto compartilhado em si só o dono do espaço exclui |
| Rotina `ciclodev_lixeira` (todo dia, 4h23) | Apaga de vez o que está na lixeira há mais de 30 dias, com tudo o que tinha dentro |

## Parte 20: comunicação e metas (AINDA NÃO APLICADA)

Testada no Postgres local (`98_teste_comunicacao_LOCAL.sql`: 47 de 47; as partes 18 e 19 continuam 37 de 37 e 42 de 42 com a 20 por cima). Pode ser aplicada antes da tela nova: a tela lê as tabelas novas separado e, se elas ainda não existirem, só avisa "falta atualizar o banco" nas Metas e nas Preferências.

| Peça | Para que serve |
|---|---|
| `pessoas_preferencias` | Como cada pessoa quer os avisos por e-mail (na hora, resumo do dia, nunca), de quais tipos, aviso do navegador, relatório da semana e a arrumação do Meu painel. Cada um só vê e muda a sua |
| `notificacoes.tipo`, `autor_id`, `email_modo`, `email_status`, `email_em` | Tipo do aviso (menção, comentário, responsável, lembrete, automação, aviso) e a fila da cópia por e-mail |
| Gatilho `comentarios_avisar` | Comentário com `@[Nome](id)` avisa quem foi mencionado; comentário avisa o responsável, quem pediu e os observadores. Ninguém é avisado do que fez, nem de item que não pode ver, nem de comentário interno se for stakeholder |
| Gatilho `itens_avisar_responsavel` | Quem vira responsável de um item é avisado (menos quando pega para si) |
| Gatilho `notificacoes_preparar` | Põe cada aviso novo na fila de e-mail, conforme a preferência da pessoa (sem preferência: resumo do dia) |
| `metas`, `metas_resultados`, `metas_resultados_itens` | Metas de um projeto, produto ou aplicação, com resultados por número ou pelos itens concluídos. Mesma regra de acesso do ponto; stakeholder não vê |
| `avisos_email_lote`, `avisos_email_marcar`, `relatorio_semanal_lote` | Só para a função `enviar-avisos` (papel `service_role`) |

## Parte 21: rotinas do e-mail (SÓ NO SUPABASE, depois da função `enviar-avisos` no ar)

`21_avisos_email_SUPABASE.sql` agenda as chamadas à função: a cada 5 minutos (na hora), às 8h de Brasília (resumo do dia) e segunda às 8h05 (relatório da semana). Precisa da extensão `pg_net` e do segredo `ciclodev_avisos_segredo` no Vault, com o mesmo valor do segredo `AVISOS_SEGREDO` da função. Não entra no `APLICAR_NO_SUPABASE.sql`.

## Parte 19: código, publicações e notas de versão (aplicada em 29/09/2026 como `ciclodev_26_codigo_entregas` + `ciclodev_27_ajuste_verificador`)

Testada no Postgres local (`97_teste_codigo_LOCAL.sql`: 42 de 42; a parte 18 continua 37 de 37 com a 19 por cima) e conferida no Supabase depois de aplicar (tabelas com RLS e GRANT, segredos sem acesso de fora, `git_receber` só para `service_role`). A Edge Function `git-webhook` está implantada (versão 1, verify_jwt desligado). **Foi aplicada ANTES da tela nova, como precisa**: a tela passa a gravar `marcos.notas`.

| Peça | Para que serve |
|---|---|
| `repositorios` | Repositório do GitHub ou do GitLab ligado a um projeto ou a uma aplicação. Stakeholder não vê |
| `interno.repositorios_segredos` | O segredo de cada repositório para o aviso automático (webhook). A tela não lê a tabela; `repositorio_segredo(p_repo, p_trocar)` mostra ou troca, só para quem pode editar o ponto |
| `codigo_vinculos` | Branch, commit e pull request (merge request) de cada item |
| `publicacoes` | O que foi para o ar: quando, ambiente, versão, de onde veio (manual, GitHub, GitLab) |
| `marcos.notas` | Notas de versão (as versões são os marcos do tipo release) |
| `git_receber(...)` | Recebe o aviso: confere a assinatura (GitHub: HMAC SHA-256 do corpo; GitLab: token), acha as chaves dos itens (ex.: BL-37) no branch, no commit e no título do PR, liga e anda o status (branch/commit: Em andamento; PR aberto: Em revisão; PR mesclado: Concluído; nunca volta). Release e deployment viram publicação; publicação em produção de uma versão de mesmo nome marca a versão como entregue. Só o papel `service_role` chama |

Junto vai a Edge Function `supabase/functions/git-webhook` (implantar com **verify_jwt desligado**, porque quem chama é o GitHub ou o GitLab). Ela não abre o conteúdo: só repassa corpo e cabeçalhos para `git_receber`. Testes da lógica: `node --experimental-strip-types supabase/functions/git-webhook/logica.test.ts` (10 de 10).

## Como aplicar num banco novo (se um dia precisar)

1. **Antes de tudo, olhar o banco.** O arquivo foi feito para um banco vazio.
2. Rodar o `APLICAR_NO_SUPABASE.sql` inteiro no SQL Editor. Ele junta as partes 01 a 10, na ordem.
3. O único schema exposto na API continua sendo o `public`. Não é preciso expor `bi`, `interno` nem `auditoria`.
4. Conferir no verificador do Supabase (Database Advisor) que não sobrou aviso.

| Arquivo | O que faz | Vai para o Supabase? |
|---|---|---|
| `00_simulacao_supabase_LOCAL.sql` | Imita papéis e login do Supabase para testar num Postgres comum | Não |
| `01_base_estrutura.sql` | Schemas, a árvore (cliente › projeto › produto › aplicação › frente), pessoas, participação e etiquetas | Sim |
| `02_trabalho.sql` | Status, itens, ciclos, marcos, ligações, checklist, campos personalizados, comentários, tempo, agenda, visões salvas, automações, notificações e quadro visual | Sim |
| `03_ficha_etapas_comercial.sql` | Ficha técnica, decisões, segredos (só o nome), requisitos, etapas e provas, catálogo, regras de cálculo, custos e receitas | Sim |
| `04_atendimento_agentes_anexos_auditoria.sql` | SLA, pedidos e conversa, agentes, anexos e o registro de quem fez o quê | Sim |
| `05_bi.sql` | Todas as contas: preço da hora, custo de pessoas, custos e receitas mês a mês, previsão de limite, ritmo, velocidade, queima do ciclo, carga, SLA, etapas, ficha herdada, painel e financeiro | Sim |
| `06_rotinas.sql` | O que a tela chama (mover na estrutura, foco, cronômetro, converter pedido, cumprir e dispensar etapa) e o motor das automações | Sim |
| `07_seguranca.sql` | RLS em todas as tabelas, GRANT explícito e permissões automáticas desligadas para o futuro | Sim |
| `08_semente.sql` | Os dados de exemplo que o sistema já mostra (gerado por `gerar_semente.py`) | Sim |
| `09_arquivos_SUPABASE.sql` | Depósito de arquivos privado `anexos` e as regras dele | Sim (só existe no Supabase) |
| `10_rotinas_agendadas_SUPABASE.sql` | Atualiza o BI a cada 10 minutos e dispara as automações de prazo vencido todo dia | Sim (só existe no Supabase) |
| `11_dominios.sql` | Cadastro de domínios e registros de DNS, só o Master vê. Custo aponta para os custos que já existem, sem repetir | Sim |
| `12_dominios_dados.sql` | Os domínios reais já conhecidos (hoje, o it-ia.tec.br) | Sim |
| `90_testes_LOCAL.sql` | 16 testes das regras (tem que terminar em "TODOS OS TESTES PASSARAM") | Não |
| `91_usuarios_teste_LOCAL.sql`, `92_carga_volume_LOCAL.sql` | Logins falsos e volume grande para medir desempenho | Não |
| `18_tarefas_lixeira_modelos.sql` | Item que se repete, lembrete, histórico da descrição, lixeira (excluir e restaurar em 30 dias) e modelos de item e de estrutura | Sim (aplicada em 29/09/2026) |
| `96_teste_tarefas_LOCAL.sql` | 37 testes da parte 18: repetição, lembrete, versões, lixeira, limpeza de 30 dias, modelos e quem pode o quê | Não |
| `19_codigo_entregas.sql` | Código do GitHub e do GitLab ligado aos itens (status anda sozinho), registro das publicações e notas de versão | Sim (aplicada em 29/09/2026) |
| `97_teste_codigo_LOCAL.sql` | 42 testes da parte 19: avisos assinados do GitHub e do GitLab, status sozinho, publicações, versões e quem pode o quê | Não |
| `20_comunicacao_metas.sql` | Menções, avisos automáticos, fila de e-mail, preferências de cada pessoa e metas | Ainda não |
| `98_teste_comunicacao_LOCAL.sql` | 47 testes da parte 20: quem é avisado e quem não é, fila de e-mail, preferências, metas e quem pode o quê | Não |
| `21_avisos_email_SUPABASE.sql` | Rotinas que chamam a função `enviar-avisos` (precisa de `pg_net` e do segredo no Vault) | Ainda não, e só depois da função |

## Decisões de estrutura (e por quê)

| Decisão | Por quê |
|---|---|
| **Uma árvore só** (`nos`) para cliente, projeto, produto, aplicação e frente, com tabelas de extensão para os campos de cada tipo | Etiquetas, participação, ficha, custos, marcos e SLA apontam para "qualquer nível" com chave estrangeira de verdade, sem colunas soltas de "tipo + id" |
| **Tabela de ancestrais** (`nos_ancestrais`), mantida pelo próprio banco | O painel de qualquer nível soma tudo o que está abaixo com um acesso ao índice, sem percorrer a hierarquia. Mover uma aplicação de produto atualiza tudo sozinho |
| **Tipo do nível garantido por chave composta** (`id, tipo`) | Uma frente nunca vira pai de projeto, e um item nunca fica fora de uma frente. É o banco que barra, não a tela |
| **Etiquetas automáticas não são guardadas** (view `etiquetas_sistema`) | Elas vêm das ligações. Guardar seria duplicar e poderia ficar desatualizado |
| **Status personalizados com "grupo"** (backlog, a fazer, andamento, revisão, bloqueado, concluído) | Cada frente pode ter os próprios status, e os painéis continuam somando certo pelo grupo |
| **Cronômetro e foco na mesma tabela de tempo** | O foco atual é o registro de foco ainda aberto. Não existe uma segunda tabela dizendo a mesma coisa |
| **"Mudanças recentes" lidas da auditoria** | Um registro só do que aconteceu, com o antes e o depois apenas do que mudou |
| **Custos ligados ao nível certo da árvore; o cliente vem da árvore** | Não existe coluna "cliente" repetida no custo que possa discordar da estrutura |
| **Dinheiro sempre com moeda e data; câmbio por dia** | O custo em dólar de março usa o dólar de março |
| **Regras de cálculo com vigência** | Mudar a margem hoje não reescreve o preço calculado no mês passado |
| **Itens de etapa só para código de terceiros** (`so_terceiros`) | Quando uma aplicação é de outra empresa, o Discovery ganha itens a mais, e eles só contam onde valem |
| **Travas de sobreposição** | Dois ciclos do mesmo projeto e dois horários reservados da mesma pessoa não se sobrepõem. É o banco que recusa |
| **Nada se apaga no dia a dia** | Item arquivado some das telas e continua guardado; a auditoria guarda o resto |
| **Segredos: só o nome** | O nome segue o padrão de variável (MAIÚSCULAS) justamente para não caber um valor ali |

## Ajustes do verificador (migração ciclodev_11)

| Aviso do Supabase | O que foi feito |
|---|---|
| 8 rotinas com poder de dono (security definer) direto na API | O miolo foi para o schema `interno`, fora da API. Na API ficou só uma casca sem poder especial que chama o miolo, igual ao painel. O miolo continua conferindo a permissão antes de agir |
| 34 tabelas com duas regras valendo na leitura | A regra de mudança, que valia "para tudo", virou três (incluir, alterar, apagar) com as mesmas condições. A leitura fica só com a regra "ver" |
| Chaves estrangeiras sem índice (informativo) | Índice nas 15 chaves usadas para apagar em cascata ou juntar dados (itens, pedidos, quadro visual, campos, etapas). As que apontam para pessoas ficaram sem índice de propósito: pessoa não se apaga, só é desativada, e o índice só custaria escrita. As chaves compostas (id e tipo) já são cobertas pela chave principal |
| Índices ainda não usados (informativo) | Normal num banco que acabou de nascer. Cada um foi criado para uma consulta medida no teste de volume |

## Segurança

| Papel | Vê | Muda |
|---|---|---|
| **Master** | Tudo | Tudo |
| **Dev** | A estrutura e os itens dos projetos em que participa, e o caminho até a raiz. Nenhum valor em dinheiro, salário ou segredo | Itens, comentários, tempo, ficha, etapas (pela rotina), ciclos e marcos onde participa |
| **Stakeholder** | Só o que está marcado como visível ao cliente, os próprios pedidos e o painel. Sem ficha, etapas, custos ou quadro visual | Abre pedidos, conversa neles e comenta no que é visível |
| **Sem login (anon)** | Nada | Nada |

- As regras chamam as funções de acesso entre parênteses, com select, como em `(select interno.eh_master())`. Assim o banco calcula uma vez por consulta, e não uma vez por linha.
- Toda tabela tem RLS e GRANT (conferido pelo teste 12). As permissões automáticas que o Supabase dá para anônimos em coisas novas ficam desligadas.
- Toda função tem o caminho de busca fixo (`search_path`), que é o que o verificador de segurança do Supabase pede.

## Desempenho medido (Postgres 16 local, com permissões ligadas)

Volume do teste: 50 clientes, 300 projetos, 1.500 aplicações, 6.000 frentes, **300 mil itens** e **690 mil registros de auditoria**.

| Consulta | Antes da análise | Depois |
|---|---|---|
| Board de uma frente (Master) | 15 ms | 1 a 19 ms |
| Board de uma frente (Dev) | 3 ms | 2 ms |
| Painel de um projeto | 5,9 s | **0,15 s** |
| Painel de um cliente | 6,3 s | **0,57 s** |
| Painel da raiz BL | 11,8 s | **0,2 s** |
| Financeiro de um cliente | 93 ms | 90 ms |
| Carga de 4 semanas, todo mundo (250 mil itens abertos, caso extremo) | 3,5 s | **1,4 s** |
| Carga de 4 semanas (Dev) | 0,8 s | 0,17 s |
| Lista geral: 50 itens atrasados (Everything) | 3,4 s | **0,11 s** |
| Minhas tarefas (My Work) | 0,39 s | **13 ms** |
| Atualizar o BI (visão materializada do ritmo) | | 2,7 s, a cada 10 minutos, sem travar leitura |

**O que causava a lentidão, e o que foi feito:**
1. **Regras de permissão linha a linha.** Chamar `interno.eh_stakeholder()` sem o `select` rodava a função 300 mil vezes. Todas as regras passaram a usar `(select ...)`.
2. **Mudanças recentes varriam toda a auditoria.** Agora, num escopo pequeno, a busca vai direto aos itens do escopo pelo índice. Num escopo grande, percorre a auditoria da mais nova para a mais velha e para quando junta o suficiente.
3. **Etapas pendentes cruzavam toda a estrutura com todos os itens de etapa.** Agora só olham projetos e aplicações do escopo.
4. **Carga chamava funções de data linha a linha.** Agora a conta fica escrita direto na consulta, com uma fórmula de dias úteis.

**Onde cada conta mora:**
- **Na hora:** custos, receitas, painel e financeiro. São pequenos e mudam toda hora, e assim o número nunca fica velho.
- **Visão materializada** (resultado guardado pronto, atualizado de tempos em tempos): só o ritmo semanal, que é histórico e cresce sem parar.

## Conferência com o sistema

| Número | No sistema (tela) | No banco |
|---|---|---|
| Preço hora sugerido | R$ 207,03 | R$ 207,03 |
| Custo da equipe por mês | R$ 36.337 | R$ 36.336,59 |
| Operação interna por mês | R$ 4.461 | R$ 4.461,13 |
| BL: custo técnico do mês | R$ 1.424,75 | R$ 1.424,75 |
| BL: já gasto até hoje | R$ 15.310,07 | R$ 15.310,07 |
| BL: já cobrado até hoje | R$ 209.000 | R$ 209.000 |
| BL: ainda a receber | R$ 60.000 | R$ 60.000 |
| BL: equipe para terminar | R$ 55.474,93 | R$ 55.474,93 |

Cada um dos 8 custos e das 4 receitas também foi conferido item por item.

## O que fica para depois

- **Login:** pronto na versão da Vercel. Para dar acesso a alguém, crie o usuário no Supabase (Authentication, Users, Add user) com o mesmo e-mail cadastrado na pessoa do time. No primeiro login, a rotina `vincular_meu_login` liga os dois. O Master (William) está cadastrado com `admin@it-ia.tec.br`.
- **A tela ainda guarda os dados no navegador.** A troca para o banco é o próximo passo, e depende do login e das instruções que você vai passar.
- **Provedor de IA** para o Agent Studio: as tabelas de execuções, avaliações e mensagens da IA já existem.
- **Arquivos de exemplo:** os anexos da semente apontam para `exemplo/...` no depósito, mas os arquivos em si não existem. Só o nome veio dos dados de exemplo.
