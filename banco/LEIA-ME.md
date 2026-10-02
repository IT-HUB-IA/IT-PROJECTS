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

## Parte 20: comunicação e metas (aplicada em 29/09/2026 como `ciclodev_28_comunicacao_metas`)

Testada no Postgres local (`98_teste_comunicacao_LOCAL.sql`: 47 de 47; as partes 18 e 19 continuam 37 de 37 e 42 de 42 com a 20 por cima). Conferida no Supabase depois de aplicar: 4 tabelas novas com RLS e GRANT (nada para `anon`), uma versão só de cada função, os 4 gatilhos criados e as funções do e-mail só para `service_role`. A Edge Function `enviar-avisos` está implantada (versão 1, verify_jwt desligado); enquanto `RESEND_API_KEY` e `AVISOS_REMETENTE` não existirem, ela responde 503 e não mexe na fila.

| Peça | Para que serve |
|---|---|
| `pessoas_preferencias` | Como cada pessoa quer os avisos por e-mail (na hora, resumo do dia, nunca), de quais tipos, aviso do navegador, relatório da semana e a arrumação do Meu painel. Cada um só vê e muda a sua |
| `notificacoes.tipo`, `autor_id`, `email_modo`, `email_status`, `email_em` | Tipo do aviso (menção, comentário, responsável, lembrete, automação, aviso) e a fila da cópia por e-mail |
| Gatilho `comentarios_avisar` | Comentário com `@[Nome](id)` avisa quem foi mencionado; comentário avisa o responsável, quem pediu e os observadores. Ninguém é avisado do que fez, nem de item que não pode ver, nem de comentário interno se for stakeholder |
| Gatilho `itens_avisar_responsavel` | Quem vira responsável de um item é avisado (menos quando pega para si) |
| Gatilho `notificacoes_preparar` | Põe cada aviso novo na fila de e-mail, conforme a preferência da pessoa (sem preferência: resumo do dia) |
| `metas`, `metas_resultados`, `metas_resultados_itens` | Metas de um projeto, produto ou aplicação, com resultados por número ou pelos itens concluídos. Mesma regra de acesso do ponto; stakeholder não vê |
| `avisos_email_lote`, `avisos_email_marcar`, `relatorio_semanal_lote` | Só para a função `enviar-avisos` (papel `service_role`) |

## Parte 21: rotinas do e-mail (aplicada em 29/09/2026 como `ciclodev_29_avisos_email`)

`21_avisos_email_SUPABASE.sql` agenda as chamadas à função: a cada 5 minutos (na hora), às 8h de Brasília (resumo do dia) e segunda às 8h05 (relatório da semana). Precisa da extensão `pg_net` e do segredo `ciclodev_avisos_segredo` no Vault, com o mesmo valor do segredo `AVISOS_SEGREDO` da função. Não entra no `APLICAR_NO_SUPABASE.sql`. Conferida em 29/09/2026: `pg_net` ligada, segredo no Vault, a rotina de 5 minutos rodou sozinha (resposta 200) e um e-mail de teste saiu para admin@it-ia.tec.br.

## Parte 22: preferências de tela e lembretes vistos (aplicada em 29/09/2026 como `ciclodev_30_preferencias_tela`)

`22_preferencias_tela.sql` põe duas colunas em `pessoas_preferencias`: `tela` (tema, abas da barra, largura e itens abertos da Estrutura, último ponto e aba, filtros) e `lembretes_vistos` (lembretes que já apareceram na tela da pessoa). Antes, essas coisas ficavam só no navegador. Cada pessoa só mexe na própria linha (política `dono` da parte 20, sem mudança). Testada no Postgres local (`testes/t_prefs.js`: o que já estava no navegador sobe para o banco na primeira vez e outro navegador recebe igual) e conferida no Supabase depois de aplicar: colunas, as duas regras de tamanho e as permissões de `authenticated` (select, insert, update).

Junto, sem mudar o banco, a tela passou a gravar três coisas que já tinham tabela e antes se perdiam ao recarregar: o Quadro livre (`quadros` e `quadro_elementos`), as Visões salvas (`visoes_salvas`) e os arquivos anexados (bucket `anexos` da parte 09 e tabela `anexos`: itens, ficha técnica, pedidos e provas das etapas). Testes: `testes/t_persistir.js` e `testes/t_arquivos.js`.

## Parte 23: portal do stakeholder (aplicada em 29/09/2026 como `ciclodev_31_portal_stakeholder`)

`23_portal_stakeholder.sql` cria o portal do stakeholder (primeiro uso: Blanco & Lisboa, no sistema Java deles, que não tem banco e só mostra o que vem daqui). Tabelas: `portais` (de qual cliente e de quem é), `portais_membros` (quem pode responder, pelo e-mail), `portais_chaves` (só o resumo sha256 da chave), `portais_segredos` (segredo do webhook, sem acesso pela tela), `perguntas_stakeholder` e `portais_eventos` (fila de avisos). Tudo do portal só o dono vê; as perguntas também quem enxerga o item. A tela chama `portal_criar`, `portal_gerar_chave`, `portal_revogar_chave`, `portal_webhook`, `pergunta_criar`, `pergunta_cancelar` e `portais_clientes`; as funções `portal_por_chave`, `portal_estrutura`, `portal_painel`, `portal_quadro`, `portal_item`, `portal_perguntas`, `portal_eventos_lista` e `portal_responder` são só da função `portal-api` (service_role). Testada no Postgres local (`99_teste_portal_LOCAL.sql`, 31 conferências) e conferida no Supabase depois de aplicar: RLS nas 6 tabelas, permissões e uma versão só de cada função.

## Parte 24: avisos do portal por webhook (aplicada em 29/09/2026 como `ciclodev_32_portal_webhook`)

`24_portal_webhook_SUPABASE.sql` cria `interno.portal_entregar()` e a rotina `ciclodev_portal_webhook` (a cada minuto): manda os avisos da fila para o endereço do webhook de cada portal, assinados com HMAC-SHA256 no cabeçalho `X-CicloDev-Assinatura`, e tenta de novo até 10 vezes. Precisa de `pg_net` e `pg_cron`. Não entra no `APLICAR_NO_SUPABASE.sql`. Conferida no Supabase: a rotina está ligada e a primeira rodada terminou certo.

A função `portal-api` (pasta `supabase/functions/portal-api`, `verify_jwt` desligado porque confere a chave do portal) foi publicada em 29/09/2026. O que o sistema de fora precisa saber está em `docs/PORTAL-STAKEHOLDER-JAVA.md`.

## Parte 25: permissões de IA e conversa com o agente (aplicada em 29/09/2026 como `ciclodev_33_ia_permissoes_chat`)

`25_ia_permissoes_chat.sql` cria `ia_permissoes` (quem pode usar a IA; começa todo mundo desligado e só o dono do sistema muda, em Admin › Permissões de IA, pela função `admin_ia_definir`) e `ia_mensagens` (a conversa de cada usuário com o seu agente). Cada pessoa só lê a própria permissão e a própria conversa, só escreve na própria conversa, só como `usuario` e só com a IA ligada; ninguém muda nem apaga mensagem pela tela, e nem o dono do sistema lê a conversa dos outros. Ainda não existe agente respondendo. **Regra para quando existir:** o agente de um usuário só enxerga o que esse usuário enxerga no sistema (`interno.nos_visiveis()` dele) e nunca vê nem fala de projeto a que o dono dele não tem acesso. Testada no Postgres local (`99_teste_ia_LOCAL.sql`, 16 conferências; `testes/t_ia.js` pela tela) e conferida no Supabase depois de aplicar: RLS nas 2 tabelas, permissões e as 3 funções.

## Parte 26: o DevIT de cada usuário, a conversa em .md e os anexos (aplicada em 29/09/2026 como `ciclodev_34_ia_agente_historico`)

`26_ia_agente_historico.sql` cria `ia_agentes`: um por usuário, criado sozinho quando a conta nasce (gatilho `pessoas_ia_agente`, que também cria a permissão de IA, desligada). A coluna `historico_md` guarda a conversa inteira em Markdown, para o agente lembrar depois: cada mensagem nova entra no fim sozinha (gatilho `ia_mensagens_md`), com data, quem falou e os anexos. Ninguém muda nem apaga o .md pela tela; cada pessoa só lê o próprio. `ia_mensagens` ganhou `anexos` (lista de nome, tipo, tamanho e caminho), e uma mensagem pode ter só arquivo. Cada anexo precisa estar na pasta `<login>/ia/` da própria pessoa no depósito `anexos`. Desligar a IA só esconde o balão; ligar de novo traz a mesma conversa. Quem já tinha conta ganhou o agente com a conversa que já existia. Testada no Postgres local (`99_teste_ia_LOCAL.sql`, 26 conferências; `testes/t_ia.js`, 31) e conferida no Supabase: um agente para cada pessoa, os três gatilhos e a permissão só de leitura.

## Parte 27: arquivos do chat no depósito (aplicada em 29/09/2026 como `ciclodev_35_ia_anexos_deposito`)

`27_ia_anexos_SUPABASE.sql` (só no Supabase): cada pessoa lê os arquivos da própria pasta `<login>/ia/` (`anexos_ia_ver`), e a regra de apagar da parte 09 passou a não valer para essa pasta, para o histórico nunca perder arquivo. Não entra no `APLICAR_NO_SUPABASE.sql`.

## Parte 28: aviso de mensagem nova do DevIT (aplicada em 29/09/2026 como `ciclodev_36_ia_avisos`)

`28_ia_avisos.sql` põe `visto_ate` em `ia_agentes` (até quando a pessoa já viu a conversa) e as funções `ia_novidades()` (quantas mensagens do DevIT a pessoa ainda não viu) e `ia_marcar_visto()` (a pessoa abriu o chat). Com mensagem nova e o chat fechado, o balão fica com o robozinho animado e pulsa até a pessoa abrir. Testada pela tela (`testes/t_ia.js`) e conferida no Supabase: a coluna e as duas funções, só para `authenticated`.

## Parte 29: Infraestrutura, os desenhos do sistema como código (aplicada em 30/09/2026 como `ciclodev_37_infraestrutura`)

`29_infraestrutura.sql` cria a aba Infraestrutura de cada projeto e de cada produto (10 sub-abas: Arquitetura de Solução, Arquitetura de Software, Modelo de Domínio, DER / Banco de Dados, Fluxos de Processo, Diagramas de Sequência, Arquitetura de Infraestrutura, Arquitetura de Segurança, Fluxos de Usuário e Protótipos de Interface). Tabelas: `infra_canvas` (o quadro de cada sub-aba), `infra_diagramas` (o texto do desenho, o formato, a imagem SVG, de onde veio, as evidências e as lacunas; não se apaga, arquiva), `infra_diagramas_versoes` (cada mudança do texto guarda a versão anterior, pelo gatilho `interno.infra_versionar`) e `infra_geracoes` (os pedidos ao DevIT e o andamento). Quem vê o projeto ou produto vê os desenhos; só quem pode editar muda. Testada no Postgres local (`99_teste_infra_LOCAL.sql`, 21 conferências) e conferida no Supabase depois de aplicar: RLS nas 4 tabelas, permissões e gatilhos.

Junto vai a Edge Function `supabase/functions/diagramas` (**verify_jwt ligado**, quem chama é a pessoa logada), publicada em 30/09/2026 (versão 3: o DevIT também monta cada desenho como quadro no canvas e usa os desenhos automáticos como evidência). Ações: `config` (quais chaves já estão configuradas), `renderizar` (manda o texto para o conversor e guarda a imagem) e `gerar` (o DevIT lê as fontes reais como a pessoa e escreve os desenhos em segundo plano). Chaves (variáveis da função, nunca no código): `RENDER_URL` e `RENDER_TOKEN` (o conversor na VPS, no padrão Kroki: `POST {RENDER_URL}/{tipo}/svg`), `ANTHROPIC_API_KEY` (o DevIT), `FIGMA_TOKEN` (ler os arquivos do Figma) e, opcional, `DEVIT_MODELO`. Faltando uma, só a parte que depende dela avisa. O código dos repositórios o DevIT lê pela conta conectada do espaço (GitHub ou GitLab, parte 32), sem chave de pessoa. Testes da lógica: `node --experimental-strip-types supabase/functions/diagramas/logica.test.ts`.


## Parte 30: desenhos automáticos, do código publicado e do banco (aplicada em 30/09/2026 como `ciclodev_38_infra_automatica`)

`30_infra_automatica.sql` faz os desenhos se montarem sozinhos. **Do código**: quando uma publicação em produção dá certo num repositório do GitHub (gatilho `publicacoes_infra` na tabela `publicacoes`), entra um pedido em `infra_automacoes` para o projeto ou produto mais perto do repositório. Cada produto tem os próprios repositórios: o pedido do produto lê os repositórios do produto e das aplicações dele; o do projeto, só os ligados ao projeto. **Do banco**: `infra_bancos` guarda qual banco do sistema ler (esquemas e se está ligado); a conexão fica em `interno.infra_bancos_conexao`, que ninguém de fora lê. De hora em hora a estrutura é comparada (resumo SHA-256) e, se mudou, os desenhos são refeitos. O botão "Atualizar agora" chama `infra_auto_pedir(p_no)`. Funções da tela: `infra_banco_definir`, `infra_banco_remover`, `infra_auto_pedir`, `infra_quadro_publicar`. Funções só do `service_role` (a função diagramas-auto): `infra_auto_proximos`, `infra_auto_bancos_devidos`, `infra_auto_banco_lido`, `infra_auto_gravar` (grava pela `chave_auto`, guardando versão), `infra_auto_imagem`, `infra_auto_quadro`, `infra_auto_quadro_ler` e `infra_auto_concluir` (arquiva o desenho automático que sumiu da fonte). `infra_diagramas` ganhou `origem` github e banco, `chave_auto`, `referencia` (o commit ou o resumo do banco), `auto_em` e `quadro`. Testada no Postgres local (`99_teste_infra_auto_LOCAL.sql`, 68 conferências) e conferida no Supabase: RLS nas 2 tabelas novas, `authenticated` só lê, uma versão de cada função.

Junto vai a Edge Function `supabase/functions/diagramas-auto` (**verify_jwt desligado**, quem chama é o próprio banco com o cabeçalho `x-diagramas-segredo`), publicada em 30/09/2026 (versão 1). Ela baixa o código do commit publicado (pacote do GitHub ou do GitLab, pela conta conectada do espaço, parte 32) e monta, sem IA: Arquitetura de Software (módulos e importações: JS/TS, Python, Go, Java/Kotlin, C#), Arquitetura de Infraestrutura (Docker, Compose, Terraform, Kubernetes, Vercel, Netlify, Fly, Render, Supabase, GitHub Actions), Telas e rotas (Next, SvelteKit, Nuxt, Remix, React/Vue/Angular Router, Express, Fastify, Spring, FastAPI, Flask) e o DER do Prisma. Do banco lê só o catálogo, com a conexão em modo só leitura: DER por esquema (PK, FK, UQ, pé de galinha) e Acesso ao banco (papéis, RLS, regras e permissões). Cada desenho sai como texto (PlantUML, Graphviz, Mermaid ou DBML, que o conversor vira imagem) e como quadro no canvas. Chaves: `RENDER_URL` e `RENDER_TOKEN` (as mesmas da função diagramas, são do projeto inteiro). Não usa chave de pessoa para o código. Testes: `node --experimental-strip-types supabase/functions/diagramas-auto/gerar.test.ts` e `logica.test.ts`.

Para ligar o banco de um produto, crie nele um papel só de leitura (a tela mostra o SQL) e cole a conexão na tela (no Supabase, a do pooler, com o usuário `papel.projeto`). A conexão nunca volta para a tela.

## Parte 31: o banco chama a função sozinho (SÓ NO SUPABASE, aplicada em 30/09/2026 como `ciclodev_39_infra_automatica_supabase`)

`31_infra_automatica_SUPABASE.sql` cria no Vault o segredo `ciclodev_diagramas_segredo` (valor aleatório, ninguém precisa ver), a função `infra_auto_confere(p_segredo)` (só `service_role`), `interno.infra_auto_chamar()` (pg_net para a diagramas-auto) e a rotina `ciclodev_diagramas_auto` no pg_cron a cada 10 minutos, que só chama quando há pedido parado ou banco para ler. Aplicar depois de publicar a diagramas-auto. Conferida no Supabase: o segredo existe, a rotina está agendada, `authenticated` não chama `infra_auto_confere`, e uma chamada de teste do banco para a função voltou 202.


## Parte 32: conectar o GitHub e o GitLab com um clique, por empresa (aplicada em 30/09/2026 como `ciclodev_40_conexoes_git`)

`32_conexoes_git.sql` troca o jeito de ligar repositório: acabou o "cole o endereço e o segredo no GitHub". Cada empresa (espaço) conecta a conta dela numa janelinha do GitHub ou do GitLab e escolhe qual repositório é de cada projeto, produto ou aplicação.

| Peça | Para que serve |
|---|---|
| `interno.git_apps` | O app do CicloDev no GitHub (criado pelo dono do sistema com um clique na tela Admin, pelo manifesto do GitHub) e o aplicativo OAuth do GitLab (o dono cadastra o Application ID e o Secret). Os segredos ficam em `dados`; a tela só vê `publico`, por `git_apps_status()` |
| `git_conexoes` | Conta conectada a um espaço: no GitHub, a instalação do app numa conta ou organização; no GitLab, a conta autorizada. Quem é do espaço vê e usa |
| `interno.git_tokens` | Só GitLab: a chave OAuth e a de renovação. O GitHub não guarda chave: a função pede uma temporária ao app (1 hora) a cada uso |
| `interno.git_estados` | O vai e volta da janelinha: vale 30 minutos, uma vez só, e só para quem começou. Impede que alguém pendure a conta de outro no próprio espaço |
| `repositorios.conexao_id`, `externo_id`, `webhook_id` | Por qual conta o repositório foi ligado, o número dele no GitHub ou no GitLab e (GitLab) o aviso que o CicloDev criou no projeto. A tela não insere mais direto: só pela `git_repo_ligar`, e muda só as opções (status sozinho, ativo, branch) |
| `git_receber_github` | Todos os avisos do GitHub chegam pelo app, assinados com o segredo do app. Acha os repositórios pela instalação e pelo número do repositório (um repositório pode estar ligado em mais de um ponto). App removido, suspenso ou repositório tirado do app: para os repositórios e mostra o motivo; voltou, eles voltam |
| `git_receber_gitlab` | Um aviso por projeto, com o segredo que o CicloDev criou para ele |
| Parte 30 por cima | A publicação em produção do GitLab também pede os desenhos do código (origem `gitlab`); só repositório com conta conectada pede; a fila leva a conta e o número de cada repositório |

Saiu (não é mais usado): `repositorio_segredo` (o segredo que a tela mostrava), a ligação digitando o endereço do repositório e a `git_receber` antiga. Nenhum repositório estava ligado em produção, então não houve o que migrar.

Junto vão as Edge Functions:
- `git-conectar` (**verify_jwt ligado**, quem chama é a pessoa logada): `app_concluir` (termina a criação do app do GitHub), `concluir` (volta da janelinha: no GitHub confirma quem é a pessoa e guarda as instalações do app a que ela tem acesso; no GitLab troca o código pela chave), `repos` (os repositórios que a conta deixa ver), `ligar` (no GitLab cria o aviso no projeto sozinho), `desligar` (no GitLab tira o aviso) e `desconectar` (no GitLab devolve a chave). O que é da pessoa passa pelo login dela (as regras de acesso valem); só os segredos passam pelo cliente de serviço. Testes: `node --experimental-strip-types supabase/functions/git-conectar/logica.test.ts` (inclui a assinatura do app com uma chave RSA de verdade).
- `git-webhook` (verify_jwt desligado), `diagramas-auto` e `diagramas`: passam a usar a conta conectada (`supabase/functions/_shared/git.ts`). A chave `GITHUB_TOKEN` não é mais usada por nenhuma função.

Na tela: Entregas, **Ligar repositório** (conectar a conta, escolher o repositório, ligar; desligar), e Admin, aba **GitHub e GitLab** (criar o app do GitHub e configurar o GitLab). A janelinha volta para `…/entrar?git=…`; o script do começo da página (`fonte/build.py`) avisa a janela principal e fecha. O app do GitHub só funciona no endereço do CicloDev em que foi criado (é para ele que o GitHub devolve as janelinhas). Testada no Postgres local (`97_teste_codigo_LOCAL.sql`, 84 conferências; `99_teste_infra_auto_LOCAL.sql`, 74) e pela tela (`testes/t_git.js`).

**Complemento aplicado em 30/09/2026 como `ciclodev_41_nome_repo_e_versao_no_lugar`** (está no mesmo arquivo `32_conexoes_git.sql`):
- `interno.git_nome_repo`: a cada aviso, se o repositório foi renomeado ou mudou de dono no GitHub/GitLab, o CicloDev troca o nome e o endereço sozinho. É só uma troca de nome: a ligação é pelo número do repositório lá (`externo_id`), e o aviso nunca quebra por causa do nome (nome fora da regra da tabela ou repetido é ignorado).
- `interno.codigo_versao` (troca a da parte 19): a versão publicada pelo GitHub/GitLab é procurada só no lugar do repositório e no que está dentro dele, nunca no projeto inteiro. Dois produtos com "v1.0" não se confundem.
- **`ciclodev_42_repos_de_quem_conectou`** (30/09/2026): `git_conexoes.repos_permitidos` guarda, ao conectar o GitHub, só os repositórios que quem conectou pode acessar naquela instalação (a instalação pode ser de outra pessoa, que instalou o app e fez a pessoa colaboradora). Só eles aparecem na lista e `git_repo_ligar` recusa os outros. `git_conexao_repos` é só da função `git-conectar` (versão 2). Para ligar um repositório de outra pessoa: o dono instala o app (`https://github.com/apps/<app>/installations/new`) e escolhe o repositório; depois, em Ligar repositório, **Já foi instalado: só autorizar**.
- **`ciclodev_43_repos_perdidos_param`** (30/09/2026): ao conectar de novo, a lista é refeita; repositório ligado que quem conectou não acessa mais no GitHub para sozinho ("Conta sem acesso...") e volta se o acesso voltar. A tela avisa isso em cada conta do GitHub.
- **`ciclodev_44_infra_na_aplicacao`** (30/09/2026): a aplicação também tem a aba Infraestrutura (`infra_no_ok`), com os desenhos do código ligado a ela. Publicar pelo repositório de uma aplicação pede os desenhos dela e do produto em que ela está (`infra_publicou`); "Atualizar agora" da aplicação lê só os repositórios dela, o do produto lê os dele e os das aplicações dele (`infra_auto_proximos`). A frente continua sem aba própria.
- Regra da tela no mesmo dia: cada ponto vê só o que é dele e o que está dentro dele (versões, repositórios, publicações, ficha técnica); o projeto junta tudo. As 6 versões do projeto BL que eram do app MK - Plataformas (dentro de 40% (MK)) foram movidas para ele, com os itens ligados como estavam.

## Parte 39: Editar em lote e Tarefa externa (aplicada em 01/10/2026 como `ciclodev_39a_tarefa_externa` e o gatilho `itens_po_historico_edicao`)

`39_editar_em_lote.sql`: coluna `itens.externa` (Tarefa externa: tipo `task`, não é desenvolvimento e não conta nos pontos da versão) e o gatilho `itens_po_historico_edicao`, que grava em `itens_historico` (tipo novo `edicao`) cada mudança de título, história, prioridade, nível, valor, pontos, tipo, responsável, prazo, épico, versão, frente, arquivado e resolução, com o antes e o depois e quem mudou. Vale para toda edição (tela ou Editar em lote). A tela: `fonte/lote_editar.js`.

## Parte 40: guia "Montar o projeto", tipo Decisão e limites por projeto (aplicada no Supabase em 01/10/2026 como `ciclodev_40_po_guia_projeto`)

`40_po_guia_projeto.sql`: coluna `itens.decisao` (tipo Decisão: tipo `task`, com o prazo da decisão no `prazo`; não conta nos pontos da versão) e, em `projetos`, `visao`, `sucesso`, `partes`, `riscos`, `riscos_nenhum` (o que o guia de 9 passos pergunta) e `po_limites` (limites do método por projeto: parado, aceite, grande, semanas; vazio = padrão 5/3/13/4). A tela: `fonte/po_guia.js`.

## Parte 41: Editar em lote muda qualquer coluna (aplicada no Supabase em 01/10/2026 como `ciclodev_41_editar_lote_todas_colunas`)

`41_editar_lote_todas_colunas.sql`: só troca a função `interno.po_historico_edicao` (o gatilho da parte 39 continua). O histórico de edição passa a guardar também descrição, horas, início, data alvo, cliente vê e sprint. A situação continua no histórico próprio (tipo `situacao`) e o lugar do item (onde) já estava (frente). A tela: `fonte/lote_editar.js` (campos situação, motivo, início, onde, descrição, horas, data alvo, cliente vê e sprint).

## Parte 42: data da última troca do endereço do banco (aplicada no Supabase em 01/10/2026 como `ciclodev_42_banco_trocado_em`)

`42_banco_trocado_em.sql`: coluna `infra_bancos.conexao_trocada_em`, preenchida pela `infra_banco_salvar` (mesma assinatura) sempre que o endereço é gravado ou trocado, e copiada da área escondida para os bancos que já existiam. A tela mostra "Endereço salvo em ..." no card do banco, para saber se o Trocar foi gravado. A senha continua só em `interno.infra_bancos_conexao`.

## Parte 43: análise de segurança automática do código e do banco (aplicada no Supabase em 01/10/2026, em partes: tabelas, regras de acesso e funções)

`43_analise_seguranca.sql`: `analise_achados` (cada achado com regra, gravidade, onde, trecho com segredo mascarado, identidade estável, status aberto/corrigido/ignorado, motivo e item ligado) e `analise_rodadas` (o resumo de cada leitura). `analise_gravar` (só o robô, service_role) grava o que achou e marca como corrigido o que sumiu; `analise_marcar` (quem edita o ponto) ignora com motivo, volta a abrir e liga ao item. As regras ficam em `supabase/functions/diagramas-auto/seguranca.ts` (fonte única: a tela pega o mesmo catálogo no build). A tela: `fonte/seguranca.js` (aba Segurança).

## Parte 53: segunda leva do P.O. (aplicada no Supabase em 02/10/2026)

`53_po_leva2.sql`:

- `itens_criterios` ganhou `prova`, `prova_quem`, `prova_em` e `prova_resultado` (passou, falhou ou parcial). A prova pode ser texto, link ou `anexo:<id>` de um anexo do item. Pode entrar mesmo com o item já aceito: só o texto e o "marcado" ficam travados.
- `frentes.definicao_pronto`: as regras de pronto de cada frente, somadas à comum do projeto.
- `itens.auto_origem`: de onde veio cada preenchimento automático, por exemplo o prazo padrão de 7 dias ou "criado já em Pronto para testar, por lote".
- `itens.revisar`: a marca de revisar quando uma decisão muda.
- `itens.decisao_texto`, `decisao_por` e `decisao_em`: o texto da decisão fechada. Quem e quando são carimbados pelo banco.
- Histórico: tudo isso entra em `itens_historico`.
  - O gatilho `itens_po_historico_leva2` registra a origem automática, o "marcado para revisar", o "revisado" e a decisão registrada ou mudada.
  - `po_historico_criterio` passou a registrar também a prova.

A tela está em `fonte/po_leva2.js`.
- Mostra o épico de outra frente na Lista (com "Agrupar por épico") e na exportação.
- Cada contagem diz o que conta.
- As tarefas externas ficam fora dos totais, com uma linha "aguardando terceiros", e os itens que dependem delas mostram "bloqueado por terceiro".
- Avisos no "O que fazer hoje":
  - prazo depois da entrega da versão;
  - item sem responsável;
  - itens para revisar;
  - critério sem prova.
- Situação inicial no Criar em lote (`situação:`, até Pronto para testar).
- Contas na prévia do Editar em lote.
- Modelo Dado / Quando / Então para os critérios.
- Abas novas: "Mapa de histórias" (com a pirâmide do backlog) e "O que mudou".
- Exportação do projeto inteiro e do épico com os itens de todas as frentes.

## Parte 52: o que ficava só no navegador vai para o banco (aplicada no Supabase em 02/10/2026)

`52_estado_pessoa_e_permissoes.sql`:

- `pessoas_preferencias.estado`: a frente em foco, as fichas automáticas já vistas, o guia do P.O. (passo e avisos silenciados) e o Desfazer do último lote. Cada pessoa só lê e grava o seu.
- `pessoas_preferencias.navegador_antigo`: a cópia antiga de todos os dados achada no navegador (versão sem login), guardada inteira.
- Ao entrar, `fonte/estado.js`:
  - junta o que estava no navegador com o que está no banco, sem apagar nada do banco;
  - grava, relê e confere;
  - só depois tira a cópia do navegador.
- Se não der para gravar, a cópia continua no navegador e o sistema tenta de novo.
- O registro das automações passa a ser lido de `automacoes_execucoes`, que o banco já gravava.
- Tira de `authenticated` e `anon` as permissões TRUNCATE, TRIGGER e REFERENCES em todas as tabelas, e também para as tabelas futuras. Nenhuma era usada; TRUNCATE passaria por cima das regras de acesso.
- `banco/99_teste_isolamento_LOCAL.sql`: uma pessoa nova não enxerga nenhuma linha que já existia, em nenhuma tabela.

## Parte 51: o custo do plano marcado como principal (aplicada no Supabase em 02/10/2026)

`51_servidores_custo_principal.sql`: `servidores_custos.principal` (no máximo um por servidor, por índice único parcial).

O cadastro do servidor não repete mais nada:
- O bloco "Contrato e custo" tem contratado em, valor do plano, moeda, recorrência e "renova até cancelar" ou "para numa data".
- O nome do custo vem do campo Plano.
- A próxima renovação é calculada pela recorrência; não existe mais o campo "Renova em" para digitar.
- Os custos extras (backup, IP extra, licença) têm só o quê, o valor e a recorrência. Pegam a moeda e a cobrança do contrato e começam hoje (num servidor novo, na data da contratação).

## Parte 50: servidores com divisão por percentual ou valor, recorrências e lançamentos (aplicada no Supabase em 02/10/2026, em partes)

`50_servidores_rateio.sql`:

- `servidores.rateio` aceita também `percentual` e `valor`.
- `servidores_alcance` ganhou `percentual` e `valor`: a parte de cada aplicação. O que não fecha 100% aparece na tela como "Restando" (sem dono).
- `servidores_custos.recorrencia` aceita também `trimestral` e `semestral`. `fim` vazio quer dizer renova até cancelar; com data, para de cobrar nela.
- Tabela nova `servidores_lancamentos`: um lançamento por período de cada custo, do início até hoje ou até o fim. Tem RLS (vê quem vê o servidor) e só GRANT de leitura: ninguém escreve direto.
- Quem gera os lançamentos: `interno.servidores_lancar()`, rodada todo dia pela rotina `ciclodev_servidores_lancamentos` (`17 3 * * *`) e também por `public.servidores_lancar(p_servidor)` logo depois de salvar (só quem edita o servidor pode chamar).
- Na tela, marcar o cliente, um projeto ou um produto marca tudo o que está dentro. Os custos agora mudam no lugar em vez de serem apagados e gravados de novo, então os lançamentos continuam ligados a eles. O botão "Cancelar" de um custo põe `fim` = hoje.

## Parte 48: inventário de TI por cliente (aplicada no Supabase em 02/10/2026, em partes) e parte 49 (arquivos e aviso diário, só no Supabase)

`48_inventario.sql`: cada cliente tem o seu inventário, isolado pelo `cliente_id` (todas as chaves estrangeiras entre tabelas do inventário levam o cliente junto, então nada aponta para outro cliente).

| Tabela | Para que serve |
|---|---|
| `inv_categorias`, `inv_modelos` | Categorias (controle um a um ou por quantidade, depreciação % ao ano, de quanto em quanto tempo conferir) e modelos (fabricante, modelo, especificações). `inv_preparar` cria as 21 de começo |
| `inv_locais` | Matriz, filial, prédio, sala, armário, almoxarifado, remoto (um dentro do outro) |
| `inv_funcionarios`, `inv_funcionarios_apps` | Funcionários do cliente, só cadastro de controle (sem acesso): nome, CPF conferido pelos dígitos, telefone, cargo, departamento, situação. E quais aplicações do cliente cada um usa |
| `inv_ativos` | Cada equipamento um a um: patrimônio (único no cliente), série, situação (estoque, em uso por funcionário, por aplicação, no local, emprestado, manutenção, aguardando, defeito, perdido, baixado), com quem está, propriedade (próprio, alugado, comodato, do funcionário), compra, nota fiscal, garantia, depreciação, rede, onde fica o acesso (nunca a senha) |
| `inv_ligacoes` | Monitor conectado ao computador, memória instalada no notebook |
| `inv_itens`, `inv_saldos` | Itens por quantidade (cabos, fontes, adaptadores, consumíveis) e o saldo em cada local |
| `inv_licencas`, `inv_licencas_uso` | Licenças de software, com a quantidade comprada (o banco não deixa passar) e para quem ou qual máquina |
| `inv_movimentos` | O histórico: nunca muda nem some (erro se corrige com estorno) |
| `inv_termos`, `inv_manutencoes`, `inv_baixas`, `inv_conferencias(_itens)`, `inv_anexos` | Termo de responsabilidade, manutenções, baixa com descarte (NIST 800-88, MTR, CDF), conferência física e os arquivos |

Funções: `inv_movimentar` (a situação só muda por ela, que grava o histórico junto; a tabela recusa mudança direta), `inv_estornar` (desfaz só a última), `inv_estoque` (entrada, saída, transferência, ajuste), `inv_conferir`, `inv_pendencias_funcionario`, `interno.inv_avisos` (todo dia: garantia, empréstimo, aluguel, licença, conferência; estoque mínimo às segundas). Quem vê e mexe: `interno.inv_pode` (quem edita o cliente, nunca stakeholder). Teste: `99_teste_inventario_LOCAL.sql` (36 conferências).

`49_inventario_arquivos_SUPABASE.sql`: bucket privado `inventario` (caminho `<cliente>/<uuid>-<nome>`, só quem edita o cliente) e a rotina diária `ciclodev_inventario_avisos`.

## Parte 47: cadastro de servidores (VPS, dedicado, nuvem) (aplicada no Supabase em 02/10/2026, em partes)

`47_servidores.sql`, quatro tabelas, todas com RLS e GRANT explícito:

| Tabela | Para que serve |
|---|---|
| `servidores` | A máquina: tipo, ambiente, situação, provedor, plano, região, sistema, vCPU, memória, disco, tráfego, hostname, IPs, painel do provedor, **onde fica o acesso** (nunca a senha: o banco recusa texto como "senha: ..."), backup, monitoramento, responsável, contratação, renovação e como dividir o custo (`rateio` igual ou peso). Mora num ponto da estrutura (`no_id`, o dono). |
| `servidores_alcance` | Onde se aplica: cliente, projeto ou produto valem para todas as aplicações de dentro; aplicação, só para ela. `peso` para a divisão do custo. |
| `servidores_servicos` | O que roda nela: nome, tipo (aplicação, API, site, banco, proxy, container, fila, cache, rotina, monitoramento, backup, painel), tecnologia, versão, porta, endereço, pasta e a aplicação que o serviço atende. |
| `servidores_custos` | Os custos (plano, backup, IP extra, licença): valor, moeda, mensal/anual/único, início e fim. |

Quem vê: quem vê o dono ou algum ponto onde o servidor se aplica (`interno.servidor_ve`), menos stakeholder. Quem muda: quem edita o dono (`interno.servidor_edita`). A tela fica em `fonte/servidores.js` (aba Servidores no cliente, projeto, produto e aplicação) e aparece também em Custos (parte do custo de cada ponto), na Ficha técnica (seção Ambientes) e cria o item de renovação na frente Infraestrutura.

## Parte 46: inventário com as versões publicadas e as datas reais (aplicada no Supabase em 01/10/2026)

`46_inventario_versoes.sql`: o tipo de `analise_inventario` aceita também `versao`. O robô busca no GitHub/GitLab o primeiro e o último commit de cada arquivo (até 250 arquivos por leitura) e as publicações (releases) com a data de cada uma; no banco, as datas de cada tabela vêm das migrations do Supabase (`supabase_migrations.schema_migrations`) ou do próprio MySQL (`create_time`/`update_time`). As datas não entram no resumo da estrutura (mudar a data não redesenha nada). A tela monta o projeto como se o P.O. o tivesse feito no CicloDev: as publicações viram versões em Entregas, cada item ganha história, critérios de aceite (o que já tem prova vem marcado), prioridade, pontos, início e prazo pelas datas reais e a versão em que foi publicado; o que parece pronto vai para Pronto para testar e o P.O. analisa e aceita.

## Parte 45: inventário com integrações, infraestrutura e testes (aplicada no Supabase em 01/10/2026)

`45_inventario_tipos.sql`: o tipo de `analise_inventario` aceita também `infra` e `teste` (além de `integracao`, que já existia). O robô passa a ler do código os sistemas de fora que ele chama e as bibliotecas de serviços conhecidos (Integrações), os arquivos de montagem e publicação (Docker, GitHub Actions, Vercel, Terraform, Kubernetes: Infraestrutura) e os arquivos de teste (Testes). A tela monta tudo sozinha, sem botão, quando alguém que edita abre o ponto: cada item na frente do assunto; o que parece pronto vai para Pronto para testar (desde a parte 46, montado como o P.O. faria; antes nascia Concluído), o que tem sinal de inacabado entra em Criado com o motivo.

## Parte 44: análise ampliada e inventário do que já existe (aplicada no Supabase em 01/10/2026, em partes)

`44_analise_completa.sql`: a nova `analise_gravar` faz o item ligado andar sozinho (quando a análise não acha mais o ponto, o critério "A análise de segurança não acha mais este ponto" fica marcado e o item vai para Pronto para testar; aceitar continua sendo do P.O.). A tabela `analise_inventario` guarda o que o robô leu do código e do banco (telas, APIs, tarefas agendadas e tabelas, com o grupo sugerido para o épico e os sinais de pronto ou inacabado). `analise_inventario_gravar` (só o robô) grava; `analise_inventario_ligar` (quem edita o ponto) liga cada linha ao item criado na importação. A leitura fica em `supabase/functions/diagramas-auto/inventario.ts`; as regras de qualidade (QUA) e de arquitetura do banco (ARQ) em `seguranca.ts`. A aba agora se chama Análise.

**Falta em produção:** a linha final de `analise_inventario_gravar` que tira do inventário o que sumiu do código (o `delete ... and item_id is null`). A ferramenta usada aqui exige confirmação para comando que apaga, então essa função foi aplicada sem a limpeza. Para completar, rodar no SQL Editor do Supabase o trecho "o robô grava o inventário" de `44_analise_completa.sql`. Sem isso, nada quebra: só fica no inventário o que já foi removido do código.

## Parte 38: item completo pelo método do Product Owner (aplicada em 01/10/2026 como `ciclodev_38_item_completo_po` e `ciclodev_38b_sem_truncate`)

`38_item_completo_po.sql`, só acrescenta (nenhuma coluna antiga muda de sentido):

| Peça | Para que serve |
|---|---|
| `itens.historia_quem`, `historia_quero`, `historia_para` | A história: "Como [quem], quero [o quê], para [por quê]" |
| `itens.moscow` (`deve`, `deveria`, `poderia`, `nao_tera`) e `itens.nivel` (1 a 5) | Prioridade. O nível anda junto com a `prioridade` antiga (1 highest, 2 high, 3 medium, 4 e 5 low), pelo gatilho `itens_po_regras`; os itens que já existiam ganharam o nível da prioridade deles |
| `itens.valor` (1 a 10) e `valor_motivo` | Valor de negócio, para ordenar a fila (no empate, sobe quem tem mais valor por ponto) |
| `itens.pontos` | Estimativa: agora 1, 2, 3, 5, 8, 13 e 20 (o 21 antigo continua aceito para não perder nada) |
| `itens.melhoria`, `itens.origem_id` | Tipo no método: Item, Bug (`tipo = 'bug'`, com o item de origem) ou Melhoria (item novo ligado ao antigo) |
| `itens.voltou_em`, `voltou_motivo` | Situação Voltou: o P.O. devolveu. Limpa quando volta para Pronto para testar ou é aceito |
| `itens.meta` | A meta do épico |
| `itens_criterios` | Critérios de aceite (caixa de marcar, ordem). Quem marcou e quando são gravados pelo banco (`marcado_por`, `marcado_em`) |
| `itens_historico` | Cada mudança de situação e de critério, com quem e quando. **Só leitura** para a tela: só os gatilhos escrevem |
| `marcos.meta` | A meta da versão (a data de entrega já era obrigatória) |
| `projetos.po_id`, `projetos.definicao_pronto` | O P.O. do projeto e a Definição de Pronto |
| `anexos.papel` (`desenho_computador`, `desenho_celular`) | O desenho do item |

Regras que o banco garante: (1) história, tarefa e bug não vão para Aceito (grupo `done`) com critério desmarcado; (2) com P.O. definido, só ele aceita e devolve; publicação, PR mesclado e rotinas não aceitam sozinhos: o item para em Pronto para testar (`review`); sem P.O. e sem critérios, tudo como antes; (3) item aceito não muda história nem critérios (mudança depois de pronto é Melhoria, item novo); (4) só o P.O. atual passa o papel de P.O. para outra pessoa. As tabelas novas têm RLS e GRANT (nada para `anon`; sem TRUNCATE para `authenticated`). Testada no Postgres local (`99_teste_po_LOCAL.sql`: 35 de 35; os testes 93, 95, 96, 97, 99 de ficha, IA, infra, infra automática e portal continuam passando com a 38 por cima). A tela: `fonte/po.js` e `fonte/po.css`; teste da tela `testes/t_po.js`.

## Parte 37: o DevIT conduz guias no chat (aplicada em 30/09/2026 como `37_devit_guia`)

`37_devit_guia.sql`: coluna `ia_mensagens.contexto` (jsonb). Na fala do DevIT guarda o guia, o passo e os botões oferecidos; na fala da pessoa, o botão que ela clicou. Junto vai a Edge Function `supabase/functions/devit` (implantar com **verify_jwt ligado**): o botão **Guia passo a passo** da Infraestrutura abre o chat e o DevIT conduz o guia de ligar banco (Supabase ou AWS), um passo por vez, com os botões Feito, Tenho uma dúvida e Deu erro. A base de conhecimento fica num arquivo só, `supabase/functions/_shared/devit_conhecimento.json`, que a função e a janela de guia da tela usam (o build põe na página). As dúvidas escritas são respondidas pela IA quando a variável `ANTHROPIC_API_KEY` da função devit existe (só com a base de conhecimento, nunca com a internet); sem ela, pelas perguntas frequentes da base. Endereço com senha nunca é mandado: a tela recusa, e a função mascara antes de chamar a IA. Só responde a quem tem a IA ligada. Testes: `node --experimental-strip-types supabase/functions/devit/logica.test.ts` e `testes/t_devit_chat.js` (a tela, o banco local e a lógica de verdade).

## Parte 36: o servidor mostrado na tela nunca leva pedaço da senha (aplicada em 30/09/2026 como `36_servidor_sem_senha`)

`36_servidor_sem_senha.sql`: `infra_banco_salvar` (mesma assinatura) pega o servidor depois do ÚLTIMO `@` do endereço. Antes pegava o primeiro, e uma senha com `@` fazia um pedaço dela aparecer como "servidor" na lista de bancos (aconteceu no primeiro banco ligado em produção). Os bancos já ligados foram corrigidos na mesma migração. A tela passou a codificar sozinha a senha com símbolos antes de salvar.

## Parte 35: a seção Database da ficha só vem do banco ligado (aplicada em 30/09/2026 como `35_ficha_database_so_banco`)

`35_ficha_database_so_banco.sql`: `infra_ficha_gravar` (mesma assinatura) ignora os campos da seção Database quando quem grava é um repositório, e os campos de Database que já tinham vindo do código foram apagados. Banco e schema, tabelas principais e regras de acesso aparecem só depois de ligar um banco no ponto (Infraestrutura, lado, Bancos de dados). O gerador (`fichaDoCodigo`) também parou de montar esses campos. Testada no Postgres local (`99_teste_ficha_auto_LOCAL.sql`, 23 conferências).

## Parte 34: ficha técnica preenchida sozinha (aplicada em 30/09/2026 como `34_ficha_automatica`)

`34_ficha_automatica.sql`: a ficha técnica de cada ponto passa a ter um lado automático, lido do código e do banco. Tabela `ficha_auto` (uma linha por seção e campo, por origem `repo:<id>` ou `banco:<id>`, com o valor atual, o anterior e quando mudou; some junto se o repositório ou o banco for desligado). Quem vê a ficha vê o automático (mesma regra da `ficha_campos`); `authenticated` só lê. `infra_ficha_gravar(p_no, p_repositorio, p_banco, p_rotulo, p_referencia, p_campos)` grava e devolve quantos campos mudaram; só o `service_role` chama, e ela recusa repositório ou banco de outro ponto. Nunca guarda valor de segredo, só o nome dele e onde fica. `interno.infra_codigo_mudou`: toda publicação na branch principal (GitHub e GitLab, em `interno.git_processar`) pede a leitura de novo do código do app; um pedido ainda na fila é atualizado para o commit mais novo em vez de criar outro. Testada no Postgres local (`99_teste_ficha_auto_LOCAL.sql`, 22 conferências) e pela tela (`testes/t_ficha.js`). A função `diagramas-auto` que preenche a ficha foi publicada em 30/09/2026 (versão 3, verify_jwt desligado).

## Parte 33: vários bancos de dados por ponto (aplicada em 30/09/2026 como `33_varios_bancos`)

`33_varios_bancos.sql`: um projeto, produto ou aplicação liga quantos bancos quiser (produção, relatórios, legado). Cada banco tem id, nome (único no ponto), provedor (`supabase`, `aws` ou `outro`), motor (`postgres` ou `mysql`; no MySQL os "esquemas" são os bancos), os esquemas e o servidor (só o host, para a tela mostrar). O endereço com a senha fica em `interno.infra_bancos_conexao`, agora um por banco (`banco_id`). Troca a parte 30: `infra_banco_definir` saiu, entrou `infra_banco_salvar(p_no, p_id, p_nome, p_provedor, p_motor, p_esquemas, p_conexao, p_ativo)` (p_id vazio cria; p_conexao vazio mantém o endereço guardado); `infra_banco_remover(p_id)` e `infra_auto_banco_lido(p_banco, ...)` recebem o id do banco; `infra_automacoes.banco_id` diz de qual banco é a leitura de hora em hora; `infra_auto_proximos` devolve a lista `bancos`. Cada banco gera os próprios desenhos com a chave `banco:<id>:` (DER por esquema e, no Postgres, o mapa de acesso). Na tela: Infraestrutura, lado, **Bancos de dados** (lista com Trocar e Desligar, e Ligar outro banco, com passo a passo do Supabase e da AWS RDS/Aurora; na AWS o endereço é montado dos campos). Testada no Postgres local (`99_teste_infra_auto_LOCAL.sql`, 79 conferências; `97`, 84) e pela tela (`testes/t_infra.js`). Em produção havia 0 bancos ligados na hora de aplicar. A função `diagramas-auto` com leitura de MySQL (pacote `mysql2`, sessão só leitura, 20 s por consulta) é publicada junto da próxima leva dos desenhos.

## Parte 19: código, publicações e notas de versão (aplicada em 29/09/2026 como `ciclodev_26_codigo_entregas` + `ciclodev_27_ajuste_verificador`)

Testada no Postgres local (`97_teste_codigo_LOCAL.sql`: 42 de 42; a parte 18 continua 37 de 37 com a 19 por cima) e conferida no Supabase depois de aplicar (tabelas com RLS e GRANT, segredos sem acesso de fora, `git_receber` só para `service_role`). A Edge Function `git-webhook` está implantada (versão 1, verify_jwt desligado). **Foi aplicada ANTES da tela nova, como precisa**: a tela passa a gravar `marcos.notas`.

| Peça | Para que serve |
|---|---|
| `repositorios` | Repositório do GitHub ou do GitLab ligado a um projeto ou a uma aplicação. Stakeholder não vê |
| `interno.repositorios_segredos` | Desde a parte 32, só nos projetos do GitLab: o segredo do aviso que o CicloDev cria sozinho no projeto. Ninguém vê (a tela não mostra mais segredo nenhum) |
| `codigo_vinculos` | Branch, commit e pull request (merge request) de cada item |
| `publicacoes` | O que foi para o ar: quando, ambiente, versão, de onde veio (manual, GitHub, GitLab) |
| `marcos.notas` | Notas de versão (as versões são os marcos do tipo release) |
| `git_receber_github(...)` e `git_receber_gitlab(...)` (parte 32; a `git_receber` antiga saiu) | Recebem o aviso: conferem a assinatura (GitHub: HMAC SHA-256 do corpo com o segredo do app; GitLab: o segredo do projeto), acham as chaves dos itens (ex.: BL-37) no branch, no commit e no título do PR, liga e anda o status (branch/commit: Em andamento; PR aberto: Em revisão; PR mesclado: Concluído; nunca volta). Release e deployment viram publicação; publicação em produção de uma versão de mesmo nome marca a versão como entregue. Só o papel `service_role` chama |

Junto vai a Edge Function `supabase/functions/git-webhook` (implantar com **verify_jwt desligado**, porque quem chama é o GitHub ou o GitLab). Ela não abre o conteúdo: só repassa corpo e cabeçalhos para `git_receber_github` (um endereço só, o do app) ou `git_receber_gitlab` (com `?r=` do repositório). Testes da lógica: `node --experimental-strip-types supabase/functions/git-webhook/logica.test.ts` (11 de 11). Desde a parte 32 os repositórios só entram pela conta conectada (ver Parte 32).

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
| `97_teste_codigo_LOCAL.sql` | 84 testes das partes 19 e 32: o app e as contas conectadas, avisos assinados do GitHub e do GitLab, status sozinho, publicações, versões, instalação removida ou suspensa e quem pode o quê | Não |
| `20_comunicacao_metas.sql` | Menções, avisos automáticos, fila de e-mail, preferências de cada pessoa e metas | Sim (aplicada em 29/09/2026) |
| `98_teste_comunicacao_LOCAL.sql` | 47 testes da parte 20: quem é avisado e quem não é, fila de e-mail, preferências, metas e quem pode o quê | Não |
| `21_avisos_email_SUPABASE.sql` | Rotinas que chamam a função `enviar-avisos` (precisa de `pg_net` e do segredo no Vault) | Sim (aplicada em 29/09/2026) |

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
