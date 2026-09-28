# CicloDev para muitos usuários: análise e arquitetura

Pedido do William (28/09/2026):
- **Um nível só de usuário.** Qualquer pessoa cria a própria conta.
- **Tudo próprio.** Cada usuário tem o seu sistema inteiro: Overview, Operações, Clients, Catalog, Costs, Service Desk, Team, Agent Studio, Playbook e Settings.
- **Compartilhar um ponto.** Ele pode compartilhar um cliente, um projeto ou só uma aplicação com outro usuário, pelo número de ID dele.
- **Trabalho junto.** Quem recebe trabalha junto em tudo o que está dentro do ponto compartilhado.
- **Aberto.** O sistema não é exclusivo do grupo: deve aguentar crescer para muita gente.

## 1. Como os grandes sistemas fazem

| Sistema | O que cada usuário ganha ao se cadastrar | O que se compartilha | O que o convidado recebe |
|---|---|---|---|
| **Trello** | Um Workspace próprio | O board (ou o workspace inteiro) | Vira membro daquele board e trabalha nele por completo; é "convidado" do workspace, sem ver o resto |
| **Jira (Atlassian Cloud)** | Um site (sua-empresa.atlassian.net) | O projeto (por papéis no projeto) ou o site | Enxerga só os projetos em que tem papel |
| **Notion** | Um workspace próprio | Qualquer página, e tudo o que está dentro dela vai junto (herança) | Vira convidado só daquela página e das de dentro |
| **Google Drive** | O "Meu Drive" | A pasta ou o arquivo, e tudo o que está dentro da pasta vai junto | Vê em "Compartilhados comigo" |
| **Asana / Monday / ClickUp** | Uma organização ou espaço | O projeto, a lista ou o espaço | Convidado com acesso só ao que recebeu |
| **Linear** | Um workspace | O time ou o projeto | Membro do time |
| **GitHub** | A conta pessoal (e organizações) | O repositório (colaboradores) | Trabalha no repositório; não vê os outros |
| **Figma** | Rascunhos próprios e times | O projeto ou o arquivo | Editor ou visualizador daquele item |

**O que todos têm em comum:**
1. **O cadastro cria na hora um espaço próprio** (Workspace, site, Meu Drive). Tudo o que o usuário cria nasce dentro dele.
2. **Compartilhar é dar acesso a um ponto, e a herança leva junto tudo o que está dentro.** É o "compartilhar pasta" do Google Drive e o "compartilhar página" do Notion.
3. **Quem recebe vê o que foi compartilhado dentro do próprio sistema** ("Compartilhados comigo" no Drive; os boards de convidado no Trello), sem enxergar o resto do espaço de quem compartilhou.
4. **Cada usuário tem uma identidade única e pública:**
   - Trello: o `@usuario`;
   - Jira: o `accountId`;
   - Notion e Drive: o e-mail.
5. **Convite para quem ainda não tem conta:** chega por e-mail e vira acesso quando a pessoa se cadastra.

## 2. Por que não criar tabelas separadas para cada usuário

A ideia de "tabelas novas para cada usuário" tem nome na literatura de sistemas em nuvem (AWS SaaS Lens, documentação do Supabase e do PostgreSQL): **modelo silo**. Nenhum dos sistemas acima usa silo para usuários comuns, por estes motivos:

| Problema do silo (tabelas por usuário) | Com 1.000 usuários |
|---|---|
| Toda mudança no sistema precisa ser repetida em cada cópia | 1.000 migrações a cada melhoria |
| O banco fica com dezenas de milhares de tabelas | O PostgreSQL fica lento para planejar consultas e para fazer cópia de segurança |
| Compartilhar entre usuários exige cruzar tabelas diferentes | Cada compartilhamento vira um caso especial |
| As regras de acesso precisam ser escritas para cada cópia | Um esquecimento vaza dados |

O que eles usam é o **modelo compartilhado ("pool")**:
- **As mesmas tabelas para todos.** Cada linha sabe a qual espaço pertence.
- **O banco tranca o acesso por linha (RLS):** uma pessoa só lê e grava o que é do espaço dela ou o que foi compartilhado com ela.
- **Para o usuário, é como ter o próprio sistema:** ele não vê nada de ninguém.
- **Para nós, é um sistema só para manter:** uma migração vale para todos.

O modelo silo (banco separado) fica reservado para um cliente grande que exija isolamento físico por contrato. Isso pode ser oferecido depois como plano especial, sem mudar a tela.

## 3. Como fica o nosso

**Identidade:**
- `pessoas` ganha o **número de ID público** (`numero`, a partir de 100001) e o **nome de usuário** opcional (`usuario`, como o `@` do Trello).
- O ID é o que se passa para outra pessoa compartilhar.

**Espaço de trabalho:**
- `espacos`: o espaço de cada usuário. É criado sozinho no cadastro, com o nome "Espaço de <nome>".
- `espaco_membros`: quem é do espaço (o dono e, no futuro, quem ele chamar para o espaço inteiro).
- Toda a **Estrutura** (`nos`: clientes, projetos, produtos, aplicações e frentes) tem `espaco_id`. Os filhos herdam o espaço do pai, sozinhos.
- O que é do sistema da pessoa e não de um projeto também tem `espaco_id`:
  - Catalog: serviços, cobranças e requisitos;
  - Costs: custos da operação e custo das pessoas;
  - Settings: regras de cálculo e modelo das etapas do Playbook;
  - Agent Studio, domínios, etiquetas, equipes e integrações.
- **O espaço novo nasce com o modelo padrão** (etapas do Playbook, requisitos e regras de cálculo), copiado de um espaço "Modelo". Assim cada usuário começa com o sistema pronto para usar, e o que ele muda é só dele.

**Compartilhar:**
- `participacoes` (que já existia) passa a ser **o compartilhamento**: pessoa + ponto da estrutura.
- Quem recebe trabalha **em tudo o que está dentro** daquele ponto: itens, sprints, custos técnicos, receitas, ficha técnica, etapas, pedidos, Board e Backlog.
- Os pontos acima do compartilhado aparecem só com o nome, para situar ("Cliente X › Projeto Y"), sem acesso ao resto.
- `equipes` também dão acesso: ligou a equipe ao projeto, todos os membros entram.
- `convites`: compartilhar com um e-mail que ainda não tem conta. Quando a pessoa se cadastra com esse e-mail, o acesso aparece sozinho.
- Quem tem acesso a um ponto também pode compartilhá-lo, como no Trello: nada exclusivo.
- Quem recebeu pode sair do compartilhamento.

**Um nível de usuário, mais o dono do sistema:**
- Não existe mais "Master", "Dev" ou "Stakeholder" como nível de conta.
- Todo usuário tem o sistema completo no próprio espaço e acesso completo ao que recebe.
- A coluna `papel` fica guardada só por compatibilidade.
- **Dono do sistema (único Master):** o William (login `admin@it-ia.tec.br`), guardado em `interno.donos_sistema`, que só muda pelo banco. Ele entra só com e-mail e senha, sem o cadastro completo. Além do espaço dele, tem o módulo **Admin**.
- O dono do sistema **não** ganha acesso aos projetos dos outros: no Admin ele vê números (quantos projetos, itens, acessos) e o cadastro, nunca o conteúdo.

**Cadastro completo (tela de login):**
- 4 passos: **você** (nome completo, nascimento, CPF, e-mail), **endereço** (o CEP preenche rua, bairro, cidade e UF pelo ViaCEP), **uso** (trabalho, estudo, pessoal ou outro; cargo ou curso; empresa ou instituição) e **senha**.
- **Senha:** 8 ou mais caracteres, uma letra maiúscula, um número e um caractere especial. A lista marca cada regra ao digitar. A mesma regra vale para "Criar a senha nova".
- **CPF:** confere os dígitos na tela e no banco; um CPF só pode ter uma conta.
- **Onde fica:** `pessoas_privado`, que só a própria pessoa (e o Admin, por função própria) vê. O gatilho do cadastro copia os dados e **tira** CPF, nascimento e endereço dos dados do login (senão iriam dentro de todo token de acesso).
- Aceite: a pessoa marca que concorda em guardar os dados, com o aviso de que ficam visíveis para ela e para a administração do sistema.

**Admin (só o dono do sistema):**
- **Visão geral:** usuários, novos, ativos hoje, em 7 e em 30 dias, tempo de uso; clientes, projetos, aplicações, itens, compartilhamentos e convites; gráficos de pessoas ativas e de cadastros por dia; telas mais usadas; uso por finalidade.
- **Usuários:** lista com busca (nome, e-mail, ID, CPF, cidade, cargo), ordenação por coluna e planilha CSV. Clicar abre a ficha: conta, dados do cadastro, o que tem no espaço, uso em 30 dias e o histórico de uso.
- **Índice de uso (0 a 100):** frequência (dias ativos) 50%, tempo de uso 30%, volume de trabalho 20%.
- **Desempenho:** tempo típico e o pior caso (95%) para carregar, tempo para salvar, erros por dia, tamanho do banco e as maiores tabelas.
- **Registro de uso:** `uso_eventos`. A tela de todo usuário anota a entrada, as telas abertas, um "ativo" a cada 5 minutos com alguém mexendo, o tempo de carregar e salvar e os erros. Cada um só grava o próprio e ninguém lê direto; só as funções `admin_*`, que conferem o dono por dentro.

**Segurança (padrões do Supabase e do PostgreSQL):**
- **Sem exceção de tabela:** toda tabela tem regra por linha (RLS) e permissão (GRANT) explícita.
- **Funções auxiliares protegidas:** as regras usam funções auxiliares no schema `interno`, com `security definer`, e as chamam entre parênteses com `select`, para o banco calcular uma vez por consulta.
- **Índices** em `espaco_id` e nas colunas usadas pelas regras.
- **Dados do perfil travados:** ninguém muda o próprio número de ID, o login ou o e-mail pela tela.
- **Relatórios bloqueados:** as funções de relatório que liam o banco inteiro (`bi.*`) ficam bloqueadas para a tela, que não as usa.
- **Cadastro pelo banco:** o cadastro cria a pessoa e o espaço por um gatilho em `auth.users`, que é o jeito indicado pelo Supabase.

## 4. Preparado para crescer

- **Exportar e apagar um espaço inteiro** fica simples, porque tudo tem `espaco_id` (pedido de portabilidade e de exclusão da LGPD).
- **Planos e limites por espaço** (quantidade de projetos, pessoas, arquivos) entram depois, lendo o `espaco_id`.
- **Espaço de empresa com vários donos** (como uma organização no Trello) já está previsto em `espaco_membros`.
- **Isolamento físico** para um cliente grande pode vir depois, sem mudar a tela.
