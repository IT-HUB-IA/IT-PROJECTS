# Modelo de Inventário de TI (gestão de ativos de TI)

Modelo completo e padrão para montar, em qualquer sistema, o mesmo inventário de TI robusto do CicloDev.

Este documento traz:
- todas as tabelas e todos os campos, com tipo, regra e para que servem;
- as listas de valores, as regras que o banco precisa garantir e as funções;
- os avisos automáticos, as telas, os documentos impressos, a planilha de importação e as contas.

Os nomes estão como no CicloDev (em português, sem acento) para facilitar a cópia. O tipo de cada campo segue o Postgres; em outro banco, use o equivalente.

---

## 1. Visão geral

O inventário controla quatro tipos de coisa:

| O quê | Como é controlado | Exemplos |
|---|---|---|
| **Equipamentos** | um a um, cada um com patrimônio e número de série | notebook, monitor, celular, roteador, nobreak |
| **Itens por quantidade** | pelo saldo em cada local | cabos, adaptadores, fontes, toner, pilhas |
| **Licenças de software** | por quantidade de vagas, com quem usa cada vaga | Office, antivírus, Adobe |
| **Funcionários** | só cadastro de controle (não entram no sistema) | quem está com cada equipamento |

Em volta disso:
- **Cadastros de apoio:** categorias, modelos e locais (com hierarquia).
- **Histórico de movimentações:** toda mudança fica registrada e **nunca é alterada nem apagada**. Erro se corrige com estorno.
- **Ligações entre equipamentos:** monitor conectado ao computador, memória instalada no notebook.
- **Manutenções, termo de responsabilidade, baixa e descarte** (com apagamento seguro de dados) **e conferência física.**
- **Anexos:** foto, nota fiscal, termo assinado, certificados.
- **Avisos automáticos diários.**

### Princípios que valem para tudo

1. **A situação do equipamento só muda por movimentação.** Ninguém edita "situação", "local" ou "com quem está" direto no cadastro. Existe uma função de movimentar que muda tudo junto e grava o histórico na mesma transação. Assim a situação atual nunca diverge do histórico.
2. **O histórico nunca muda.** Corrigir é estornar: um registro novo que desfaz o anterior.
3. **Senha nunca é guardada.** Nos campos de acesso e de chave de licença vai só *onde* a senha ou chave está guardada (exemplo: "cofre 1Password, item Notebook 012"). O banco recusa texto como "senha: 123".
4. **CPF é conferido pelos dígitos verificadores** e não se repete.
5. **Quem fez e quando** é gravado pelo próprio banco (`criado_por`, `feito_por`, `gerado_por`, `enviado_por` e os carimbos de data), nunca pela tela.
6. **Excluir só o que nunca foi usado.** O que já teve movimentação não se exclui: equipamento sai por baixa, funcionário por desligamento.

---

## 2. Listas de valores (padrão)

### 2.1 Grupo da categoria (`grupo`)

| Valor | Nome na tela |
|---|---|
| `computador` | Computador |
| `monitor` | Monitor |
| `periferico` | Periférico |
| `cabo` | Cabo |
| `energia` | Energia |
| `rede` | Rede |
| `telefonia` | Telefonia |
| `impressao` | Impressão |
| `componente` | Componente |
| `consumivel` | Consumível |
| `armazenamento` | Armazenamento |
| `audio_video` | Áudio e vídeo |
| `mobiliario` | Mobiliário |
| `outro` | Outro |

### 2.2 Tipo de controle da categoria (`controle`)

| Valor | Significado |
|---|---|
| `unidade` | Um a um: cada peça é um equipamento, com patrimônio e série |
| `quantidade` | Por quantidade: controla o saldo por local (cabos, consumíveis) |

### 2.3 Tipo de local (`tipo` do local)

`unidade`, `predio`, `andar`, `sala`, `armario`, `almoxarifado`, `remoto` (home office), `outro`

### 2.4 Situação do funcionário

`ativo`, `afastado`, `desligado`

### 2.5 Situação do equipamento (`situacao`)

| Valor | Nome na tela | Exige |
|---|---|---|
| `estoque` | Em estoque | nada (sem funcionário e sem aplicação) |
| `uso_funcionario` | Em uso por funcionário | funcionário; sem aplicação |
| `uso_aplicacao` | Em uso por aplicação ou sistema | aplicação; sem funcionário |
| `uso_local` | Em uso no local (exemplo: impressora da sala) | sem funcionário e sem aplicação |
| `emprestado` | Emprestado | funcionário e data prevista de devolução; sem aplicação |
| `manutencao` | Em manutenção | nada |
| `aguardando` | Aguardando (peça, configuração, decisão) | nada |
| `defeito` | Com defeito | nada |
| `perdido` | Perdido, furtado ou roubado | nada |
| `baixado` | Baixado (saiu do patrimônio) | ficha de baixa preenchida antes |

### 2.6 Propriedade do equipamento (`propriedade`)

| Valor | Significado |
|---|---|
| `proprio` | Da empresa |
| `alugado` | Alugado (exige o nome da locadora) |
| `comodato` | Emprestado por um fornecedor |
| `byod` | Do próprio funcionário (traga o seu dispositivo) |

### 2.7 Unidade do item por quantidade

`un` (unidade), `m` (metro), `cx` (caixa), `pct` (pacote), `kit`

### 2.8 Licença

- **Tipo:** `assinatura`, `perpetua`, `oem` (vem com a máquina)
- **Recorrência:** `mensal`, `anual`, `unico`
- **Moeda:** `BRL`, `USD`, `EUR`

### 2.9 Ligação entre equipamentos

`conectado` (monitor ligado ao computador), `instalado` (memória ou SSD dentro do notebook)

### 2.10 Tipo de movimentação

| Valor | O que faz | Situação depois |
|---|---|---|
| `cadastro` | Primeiro registro (automático ao cadastrar) | a do cadastro |
| `entrega` | Entrega a um funcionário | `uso_funcionario` |
| `uso_aplicacao` | Passa a servir uma aplicação ou sistema | `uso_aplicacao` |
| `uso_local` | Fica em uso num local | `uso_local` |
| `emprestimo` | Empréstimo com data de volta | `emprestado` |
| `devolucao` | Volta para o estoque | `estoque` |
| `transferencia` | Muda de local mantendo a situação | a mesma |
| `manutencao` | Vai para manutenção | `manutencao` |
| `retorno_manutencao` | Volta da manutenção | a escolhida (padrão `estoque`) |
| `aguardando` | Fica aguardando | `aguardando` |
| `defeito` | Marcado com defeito | `defeito` |
| `perda` | Perdido, furtado ou roubado | `perdido` |
| `baixa` | Sai do patrimônio | `baixado` |
| `estorno` | Desfaz a última movimentação | a de antes |
| `entrada` | Item por quantidade entra no estoque | |
| `saida` | Item por quantidade sai do estoque | |
| `ajuste` | Item por quantidade: acerta o saldo para um número | |

As quatro últimas (`entrada`, `saida`, `transferencia` e `ajuste`) também valem para itens por quantidade.

### 2.11 Manutenção (`tipo`)

`corretiva`, `preventiva`, `upgrade`, `garantia`

### 2.12 Baixa

- **Motivo:** `venda`, `doacao`, `sucata`, `perda`, `roubo`, `devolucao_locadora`, `outro`
- **Método de apagamento dos dados** (padrão NIST 800-88): vazio, `clear` (sobrescrever), `purge` (apagamento criptográfico ou de fábrica), `destroy` (destruição física), `sem_dados` (o equipamento não guarda dados)

### 2.13 Termo

`entrega`, `devolucao`

### 2.14 Papel do anexo

`foto`, `nota_fiscal`, `termo`, `certificado_apagamento`, `cdf` (certificado de destinação final), `garantia`, `contrato`, `outro`

---

## 3. Tabelas e campos

Convenções:
- Todo `id` é um identificador único (uuid) gerado pelo banco.
- Texto sem valor fica vazio (`''`), não nulo, para facilitar busca e exportação.
- "Máx. N": limite de letras.

### 3.1 `inv_categorias`: o tipo de cada coisa

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `nome` | texto | obrigatório, 1 a 80, único | Nome da categoria (Notebook, Monitor, Cabo HDMI) |
| `grupo` | texto | lista 2.1, padrão `outro` | Agrupa as categorias nos gráficos e relatórios |
| `controle` | texto | lista 2.2, padrão `unidade` | Um a um ou por quantidade |
| `depreciacao_pct_ano` | número (5,2) | 0 a 100, padrão 20 | Quanto o equipamento perde de valor por ano (tabela da Receita: computadores 20%, móveis e impressoras 10%) |
| `vida_util_meses` | inteiro | 1 a 600 | Vida útil esperada, para planejar a troca |
| `conferencia_meses` | inteiro | 1 a 120, padrão 12 | De quanto em quanto tempo o equipamento desta categoria deve ser conferido fisicamente |
| `ativo` | sim/não | padrão sim | Categoria desligada some das listas de cadastro, mas fica no histórico |
| `ordem` | inteiro | padrão 0 | Ordem de exibição |

**Categorias que já vêm prontas** (criadas na primeira vez que o inventário é aberto):

| Categoria | Grupo | Controle | Depreciação/ano | Vida útil (meses) |
|---|---|---|---|---|
| Desktop | computador | unidade | 20% | 60 |
| Notebook | computador | unidade | 20% | 60 |
| Servidor físico | computador | unidade | 20% | 60 |
| Monitor | monitor | unidade | 20% | 60 |
| Teclado | periferico | unidade | 20% | 36 |
| Mouse | periferico | unidade | 20% | 36 |
| Headset | audio_video | unidade | 20% | 36 |
| Webcam | audio_video | unidade | 20% | 36 |
| Dock / hub | periferico | unidade | 20% | 48 |
| Impressora | impressao | unidade | 10% | 120 |
| Celular | telefonia | unidade | 20% | 36 |
| Tablet | computador | unidade | 20% | 48 |
| Roteador / switch | rede | unidade | 20% | 60 |
| Access point | rede | unidade | 20% | 60 |
| Nobreak | energia | unidade | 10% | 120 |
| HD / SSD externo | armazenamento | unidade | 20% | 48 |
| Memória / disco interno | componente | unidade | 20% | 60 |
| Cabo | cabo | quantidade | 0% | |
| Fonte / carregador | energia | quantidade | 0% | |
| Adaptador | periferico | quantidade | 0% | |
| Consumível (toner, pilha) | consumivel | quantidade | 0% | |

### 3.2 `inv_modelos`: fabricante e modelo

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `categoria_id` | uuid | obrigatório, liga em `inv_categorias` | A que categoria o modelo pertence |
| `fabricante` | texto | máx. 80 | Dell, Lenovo, HP, Samsung |
| `modelo` | texto | obrigatório, 1 a 120 | Latitude 5440, ThinkPad E14 |
| `numero_modelo` | texto | máx. 80 | Código do fabricante (part number) |
| `especificacoes` | texto | máx. 2000 | Processador, memória, disco, tela |
| `fim_vida_meses` | inteiro | 1 a 600 | Quando o fabricante deixa de dar suporte, para planejar a troca |
| `ativo` | sim/não | padrão sim | Modelo desligado não aparece para cadastro novo |

### 3.3 `inv_locais`: onde as coisas estão (em árvore)

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `pai_id` | uuid | liga em `inv_locais`, não pode ser ele mesmo | Monta a árvore: Unidade › Prédio › Andar › Sala › Armário |
| `nome` | texto | obrigatório, 1 a 120 | Sala 3, Almoxarifado, Home office |
| `tipo` | texto | lista 2.3, padrão `sala` | Tipo do local |
| `endereco` | texto | máx. 300 | Endereço (útil para unidade e prédio) |
| `notas` | texto | máx. 1000 | Observações |
| `ativo` | sim/não | padrão sim | Local desativado não recebe nada novo |

### 3.4 `inv_funcionarios`: quem usa os equipamentos

Só cadastro de controle: o funcionário não tem acesso ao sistema.

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `nome` | texto | obrigatório, 1 a 160 | Nome completo (vai no termo de responsabilidade) |
| `cpf` | texto | vazio ou 11 dígitos com dígitos verificadores válidos; único quando preenchido | Identifica a pessoa no termo. Na tela aparece mascarado (123.***.***-09) |
| `telefone` | texto | máx. 30 | Contato |
| `cargo` | texto | máx. 120 | Vai no termo |
| `departamento` | texto | máx. 120 | Vai no termo e agrupa o gráfico "em uso por departamento" |
| `situacao` | texto | lista 2.4, padrão `ativo` | Desligado não recebe equipamento novo |
| `desligado_em` | data | | Data do desligamento (dispara a lista do que recolher) |
| `notas` | texto | máx. 1000 | Observações |
| `criado_em` | data e hora | pelo banco | Quando foi cadastrado |

### 3.5 `inv_funcionarios_apps`: quais sistemas cada funcionário usa

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `funcionario_id` | uuid | liga em `inv_funcionarios`; apaga junto | O funcionário |
| `aplicacao_id` | uuid | liga na sua tabela de aplicações ou sistemas | O sistema que ele usa (ERP, CRM, e-mail). No CicloDev a coluna se chama `no_id` |
| chave | | (funcionario_id, aplicacao_id) | Um par só uma vez |

Para que serve:
- no desligamento, saber de quais sistemas tirar o acesso;
- cruzar com as licenças.

### 3.6 `inv_ativos`: cada equipamento (o coração do inventário)

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | Também vai no QR code da etiqueta |
| `categoria_id` | uuid | obrigatório | Tipo do equipamento (dá a depreciação e o prazo de conferência padrão) |
| `modelo_id` | uuid | opcional | Fabricante e modelo |
| `patrimonio` | texto | máx. 60; único quando preenchido (sem diferenciar maiúscula) | Número da plaqueta ou etiqueta |
| `numero_serie` | texto | máx. 120 | Série do fabricante (usado em garantia e na conferência) |
| `descricao` | texto | máx. 300 | Descrição livre (Notebook do financeiro, 16 GB) |
| `situacao` | texto | lista 2.5, padrão `estoque`; **só muda por movimentação** | Onde e como o equipamento está agora |
| `local_id` | uuid | opcional; **só muda por movimentação** | Local atual (vazio quando está com a pessoa) |
| `funcionario_id` | uuid | **só muda por movimentação** | Com quem está (uso ou empréstimo) |
| `aplicacao_id` | uuid | **só muda por movimentação** | Sistema que o equipamento atende (servidor, totem, impressora fiscal) |
| `devolucao_prevista` | data | **só muda por movimentação** | Quando o empréstimo volta |
| `propriedade` | texto | lista 2.6, padrão `proprio` | De quem é o equipamento |
| `locadora` | texto | máx. 120; obrigatório se `alugado` | De quem foi alugado |
| `contrato_fim` | data | | Fim do contrato de aluguel (gera aviso) |
| `valor_mensal` | número (12,2) | ≥ 0 | Valor do aluguel por mês (soma no custo mensal) |
| `fornecedor` | texto | máx. 120 | De quem foi comprado |
| `nota_fiscal` | texto | máx. 60 | Número da nota fiscal |
| `nf_chave` | texto | vazio ou exatamente 44 dígitos | Chave de acesso da NF-e (consulta na Receita) |
| `data_compra` | data | | Base da depreciação e da garantia |
| `valor_compra` | número (12,2) | ≥ 0 | Valor pago |
| `garantia_ate` | data | | Fim da garantia (gera aviso) |
| `depreciacao_pct_ano` | número (5,2) | 0 a 100; vazio = usa o da categoria | Taxa própria, quando diferente da categoria |
| `ultima_conferencia` | data | preenchido pela conferência | Quando foi visto pela última vez |
| `proxima_conferencia` | data | preenchido pela conferência | Quando deve ser conferido de novo (gera aviso de atraso) |
| `hostname` | texto | máx. 120 | Nome do computador na rede |
| `ip` | texto | máx. 64 | Endereço IP fixo |
| `mac` | texto | máx. 64 | Endereço físico da placa de rede |
| `sistema` | texto | máx. 120 | Sistema operacional e versão |
| `acesso_onde` | texto | máx. 300; **recusa senha escrita** (senha:, password=, token:, pin:...) | Onde ficam a senha e o acesso (nunca a senha) |
| `notas` | texto | máx. 4000 | Observações |
| `criado_por` | uuid | pelo banco | Quem cadastrou |
| `criado_em` | data e hora | pelo banco | Quando cadastrou |
| `atualizado_em` | data e hora | pelo banco a cada mudança | Última mudança |

**Regras que o banco garante:**
- **A situação e "com quem está" andam juntas:**
  - `uso_funcionario`: tem funcionário e não tem aplicação;
  - `emprestado`: tem funcionário, data de devolução e não tem aplicação;
  - `uso_aplicacao`: tem aplicação e não tem funcionário;
  - qualquer outra situação: sem funcionário e sem aplicação.
- Alugado precisa de locadora.
- Situação, local, funcionário, aplicação e data de devolução **não mudam por edição comum**. Uma trava recusa a mudança se não vier da função de movimentar.
- Ao cadastrar, o banco já grava a primeira movimentação (`cadastro`), com a data da compra ou a de hoje.
- Índices de busca: situação; funcionário; aplicação; número de série.

### 3.7 `inv_ligacoes`: equipamento ligado a equipamento

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `ativo_id` | uuid | obrigatório; apaga junto | O equipamento (exemplo: o monitor) |
| `alvo_id` | uuid | obrigatório, diferente do anterior; apaga junto | Onde ele está ligado (exemplo: o computador) |
| `tipo` | texto | lista 2.9, padrão `conectado` | Conectado ou instalado dentro |
| `desde` | data | padrão hoje | Desde quando |
| `notas` | texto | máx. 300 | Observações |
| único | | (ativo_id, alvo_id, tipo) | Não repete a mesma ligação |

Para que serve: ao entregar o computador, saber o que vai junto, e no conserto, saber o que estava instalado.

### 3.8 `inv_itens`: itens controlados por quantidade

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `categoria_id` | uuid | obrigatório | Categoria (do tipo quantidade) |
| `nome` | texto | obrigatório, 1 a 160, único | Cabo HDMI 2 m, Toner HP 85A |
| `unidade` | texto | lista 2.7, padrão `un` | Como se conta |
| `estoque_minimo` | número (12,2) | ≥ 0, padrão 0 | Abaixo disso, avisa para comprar |
| `valor_unitario` | número (12,2) | ≥ 0 | Para valorizar o estoque |
| `notas` | texto | máx. 1000 | Observações |
| `ativo` | sim/não | padrão sim | Item fora de linha |

### 3.9 `inv_saldos`: saldo de cada item em cada local

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `item_id` | uuid | apaga junto com o item | O item |
| `local_id` | uuid | | O local |
| `quantidade` | número (12,2) | ≥ 0 (nunca negativo) | Quanto tem ali |
| chave | | (item_id, local_id) | Um saldo por item e local |

**Só a função de estoque mexe no saldo**: ninguém grava aqui direto. Assim o saldo sempre bate com o histórico.

### 3.10 `inv_licencas`: licenças de software

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `nome` | texto | obrigatório, 1 a 160 | Microsoft 365 Business, Antivírus X |
| `fornecedor` | texto | máx. 120 | De quem foi comprada |
| `tipo` | texto | lista 2.8 | Assinatura, perpétua ou OEM |
| `quantidade` | inteiro | 1 a 100000, padrão 1 | Quantas vagas foram compradas |
| `chave_onde` | texto | máx. 300 | Onde está a chave ou o login de administração (nunca a chave) |
| `inicio` | data | | Começo do contrato |
| `vence_em` | data | | Vencimento (gera aviso) |
| `valor` | número (12,2) | ≥ 0 | Valor por período |
| `moeda` | texto | lista 2.8, padrão BRL | Moeda do valor |
| `recorrencia` | texto | lista 2.8, padrão mensal | De quanto em quanto tempo paga (soma no custo mensal) |
| `renovacao_automatica` | sim/não | padrão não | Muda o texto do aviso de vencimento |
| `notas` | texto | máx. 1000 | Observações |

### 3.11 `inv_licencas_uso`: quem ocupa cada vaga da licença

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `licenca_id` | uuid | obrigatório; apaga junto | A licença |
| `funcionario_id` | uuid | um dos dois, exatamente | A licença é da pessoa |
| `ativo_id` | uuid | um dos dois, exatamente | Ou a licença é da máquina |
| `desde` | data | padrão hoje | Desde quando |
| único | | (licença, pessoa ou máquina) | A mesma pessoa ou máquina não ocupa duas vagas |

**Trava:** não deixa passar da quantidade comprada (mostra "já está toda em uso, X de Y").

### 3.12 `inv_termos`: termo de responsabilidade

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `funcionario_id` | uuid | obrigatório | Quem assina |
| `tipo` | texto | lista 2.13 | Entrega ou devolução |
| `ativos` | lista de uuid | padrão vazio | Os equipamentos do termo |
| `texto` | texto | máx. 20000 | O termo como foi gerado (fica congelado) |
| `gerado_em` | data e hora | pelo banco | Quando foi gerado |
| `gerado_por` | uuid | pelo banco | Quem gerou |
| `assinado_em` | data | | Quando voltou assinado (o arquivo assinado vai como anexo) |

Termo já assinado não pode ser excluído.

### 3.13 `inv_movimentos`: histórico de tudo (nunca muda)

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `tipo` | texto | lista 2.10, obrigatório | O que aconteceu |
| `ativo_id` | uuid | **um dos dois** | O equipamento movimentado |
| `item_id` | uuid | **um dos dois** | Ou o item por quantidade |
| `quantidade` | número (12,2) | | Quanto (itens por quantidade; no ajuste, a diferença) |
| `situacao_antes` | texto | | Situação antes |
| `situacao_depois` | texto | | Situação depois |
| `local_de` | uuid | | De onde saiu |
| `local_para` | uuid | | Para onde foi |
| `funcionario_de` | uuid | | Com quem estava |
| `funcionario_para` | uuid | | Com quem ficou |
| `aplicacao_de` | uuid | | Que sistema atendia |
| `aplicacao_para` | uuid | | Que sistema passou a atender |
| `devolucao_prevista` | data | | No empréstimo, quando volta |
| `data` | data | padrão hoje | A data em que aconteceu (pode ser no passado) |
| `em` | data e hora | pelo banco | Quando foi registrado |
| `motivo` | texto | máx. 500 | Por quê |
| `feito_por` | uuid | pelo banco | Quem registrou |
| `estorno_de` | uuid | liga em outro movimento | Qual movimentação este estorno desfez |
| `termo_id` | uuid | | O termo gerado junto (entrega ou devolução) |

**Regras:**
- Ninguém grava aqui direto: só as funções de movimentar, estornar e estoque.
- **Nenhum campo pode ser alterado**. A única exceção: uma ligação que fica vazia porque o local, a pessoa ou o sistema foi apagado.
- Nunca se apaga uma linha.
- Índices: por equipamento (mais recente primeiro), por item, por data e por funcionário de destino.

### 3.14 `inv_manutencoes`

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `ativo_id` | uuid | obrigatório; apaga junto | O equipamento |
| `tipo` | texto | lista 2.11, padrão corretiva | Corretiva, preventiva, upgrade ou garantia |
| `fornecedor` | texto | máx. 120 | Quem fez |
| `na_garantia` | sim/não | padrão não | Coberto pela garantia |
| `aberta_em` | data | padrão hoje | Abertura |
| `concluida_em` | data | não antes da abertura | Conclusão |
| `custo` | número (12,2) | ≥ 0 | Quanto custou (soma no custo total do equipamento) |
| `descricao` | texto | máx. 2000 | O que foi feito |
| `tarefa_id` | uuid | opcional | A tarefa ou chamado no seu sistema de trabalho, quando houver. No CicloDev a coluna se chama `item_id` |

### 3.15 `inv_baixas`: saída do patrimônio e descarte

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `ativo_id` | uuid | chave (uma baixa por equipamento) | O equipamento |
| `motivo` | texto | lista 2.12, obrigatório | Venda, doação, sucata, perda, roubo... |
| `data` | data | padrão hoje | Data da baixa |
| `metodo_apagamento` | texto | lista 2.12 (NIST 800-88) | Como os dados foram apagados |
| `apagamento_por` | texto | máx. 160 | Quem apagou (pessoa ou empresa) |
| `recicladora` | texto | máx. 160 | Para quem foi o descarte |
| `mtr` | texto | máx. 60 | Manifesto de Transporte de Resíduos |
| `cdf` | texto | máx. 60 | Certificado de Destinação Final |
| `boletim` | texto | máx. 60 | Boletim de ocorrência (perda ou roubo) |
| `valor_venda` | número (12,2) | ≥ 0 | Valor recebido na venda |
| `notas` | texto | máx. 2000 | Observações |

**Regras:**
- Para baixar, a ficha da baixa precisa existir antes. A baixa em si é uma movimentação do tipo `baixa`.
- A ficha só pode ser excluída se a baixa foi desfeita (estorno).
- O certificado de apagamento e o CDF vão como anexos.

### 3.16 `inv_conferencias`: conferência física (inventário rotativo)

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `nome` | texto | obrigatório, 1 a 160 | Conferência de outubro, Sala 3 |
| `local_id` | uuid | opcional | Conferir só um local (vazio: tudo) |
| `iniciada_em` | data e hora | pelo banco | Começo |
| `concluida_em` | data e hora | | Fim (depois de concluída, não muda mais) |
| `feita_por` | uuid | pelo banco | Quem conferiu |

### 3.17 `inv_conferencias_itens`: o que foi achado em cada conferência

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `conferencia_id` | uuid | apaga junto | A conferência |
| `ativo_id` | uuid | apaga junto | O equipamento |
| `achado` | sim/não | padrão sim | Achado ou não |
| `local_achado` | uuid | | Onde foi achado (pode ser diferente do cadastrado) |
| `notas` | texto | máx. 300 | Observações |
| `em` | data e hora | pelo banco | Quando foi marcado |
| chave | | (conferência, equipamento) | Uma marca por equipamento na conferência |

Só a função de conferir grava aqui. Ao marcar como achado, o equipamento ganha:
- `ultima_conferencia` = hoje;
- `proxima_conferencia` = hoje + `conferencia_meses` da categoria.

### 3.18 `inv_anexos`: arquivos

| Campo | Tipo | Regra | Para que serve |
|---|---|---|---|
| `id` | uuid | chave | |
| `ativo_id` | uuid | no máximo um dos três | Arquivo do equipamento |
| `termo_id` | uuid | no máximo um dos três | Ou do termo (o assinado) |
| `licenca_id` | uuid | no máximo um dos três | Ou da licença (contrato) |
| `papel` | texto | lista 2.14, padrão outro | O que é o arquivo |
| `nome` | texto | obrigatório, 1 a 200 | Nome do arquivo |
| `storage_path` | texto | máx. 500 | Caminho no armazenamento privado: `<pasta>/<uuid>-<nome>` |
| `mime` | texto | máx. 120 | Tipo do arquivo (image/png, application/pdf) |
| `tamanho` | inteiro grande | ≥ 0 | Tamanho em bytes |
| `enviado_por` | uuid | pelo banco | Quem enviou |
| `enviado_em` | data e hora | pelo banco | Quando |

**Armazenamento:** os arquivos ficam num lugar **privado**, nunca público. Para ver, o sistema gera um link temporário.

---

## 4. Funções (o que muda dados de verdade)

Toda função confere a permissão antes e grava o histórico junto, na mesma transação.

### 4.1 `inv_preparar()` → número
Cria as 21 categorias padrão (tabela 3.1) só se ainda não existe nenhuma. Devolve quantas criou.

### 4.2 `inv_movimentar(ativo, tipo, situacao, local, funcionario, aplicacao, devolucao, motivo, data, termo)` → id do movimento
A única forma de mudar a situação de um equipamento.

1. Trava o equipamento para ninguém mexer ao mesmo tempo.
2. Recusa equipamento baixado.
3. **A situação sai do tipo da movimentação** (tabela 2.10), e não da tela.
4. Confere:
   - baixa precisa da ficha de baixa;
   - entrega e empréstimo precisam de funcionário;
   - uso por aplicação precisa da aplicação;
   - empréstimo precisa da data de volta;
   - transferência precisa do local de destino;
   - o funcionário não pode estar desligado;
   - o local precisa existir.
5. Atualiza o equipamento:
   - local = o escolhido (vazio quando está com a pessoa);
   - funcionário e aplicação conforme a situação;
   - na transferência, mantém com quem está.
6. Grava o movimento com o antes e o depois de tudo (situação, local, funcionário, aplicação).

### 4.3 `inv_estornar(movimento, motivo)` → id do estorno
Desfaz **só a última** movimentação do equipamento.
- Não estorna `cadastro` nem outro `estorno`.
- Volta situação, local, funcionário e aplicação para o "antes".
- Num empréstimo, recupera a data de devolução anterior.
- Grava um movimento `estorno` que aponta para o desfeito.
- Nada é apagado.

### 4.4 `inv_estoque(item, tipo, local, quantidade, local_para, funcionario, aplicacao, motivo, data)` → id do movimento
Entrada, saída, transferência e ajuste dos itens por quantidade.
- Quantidade maior que zero (no ajuste, pode ser zero).
- Saída e transferência não deixam o saldo ficar negativo ("Saldo insuficiente: há X neste local").
- Transferência precisa de outro local de destino.
- Ajuste grava a diferença entre o saldo novo e o anterior.
- Registra para quem ou para qual sistema o item saiu, quando informado.

### 4.5 `inv_conferir(conferencia, ativo, achado, local, notas)` → sim
Marca o equipamento na conferência (pode marcar de novo, que substitui). Recusa conferência concluída. Achado atualiza a última e a próxima conferência.

### 4.6 `inv_pendencias_funcionario(funcionario)` → lista
O que ainda está com a pessoa: equipamentos (patrimônio, descrição e situação) e licenças em uso. Usado no desligamento, para recolher tudo e liberar as vagas.

### 4.7 `cpf_valido(texto)` → sim/não
Confere os dois dígitos verificadores e recusa números com todos os dígitos iguais (111.111.111-11).

### 4.8 `inv_avisos()` → quantos avisos criou
Roda **todo dia** (no CicloDev, às 11h23). Detalhe na seção 5.

---

## 5. Avisos automáticos (todo dia)

| Aviso | Quando avisa |
|---|---|
| Garantia vence | 30, 7 e 0 dias antes de `garantia_ate` (equipamento não baixado) |
| Empréstimo volta / atrasado | 1 dia antes, no dia, 1 dia depois e 7 dias depois de `devolucao_prevista` |
| Aluguel termina | 60, 30, 7 e 0 dias antes de `contrato_fim` (equipamento alugado, não baixado) |
| Licença vence | 60, 30, 7 e 0 dias antes de `vence_em`. Diz se a renovação automática está ligada ou se é preciso conferir |
| Conferência atrasada | 1 e 30 dias depois de `proxima_conferencia` (equipamento não baixado) |
| Estoque abaixo do mínimo | toda segunda-feira, para item ativo com saldo total menor que `estoque_minimo` |

Cada aviso traz o patrimônio ou a descrição e vai para quem cuida do inventário (no CicloDev, como notificação no sistema).

---

## 6. Quem vê e quem mexe

- **Vê e mexe:** só o time responsável pelo inventário. Quem é de fora (cliente, visitante, stakeholder) não vê nada. Funcionário cadastrado não tem acesso.
- **Ninguém mexe direto** em: saldos, histórico de movimentações e itens de conferência. Só pelas funções.
- **Excluir:**

| O quê | Quando pode excluir |
|---|---|
| Categoria, modelo, local, ligação, licença, uso de licença, manutenção, anexo | sempre (desde que nada dependa) |
| Funcionário | só se nunca apareceu numa movimentação (senão, marque "desligado") |
| Equipamento | só se não tem movimentação além do cadastro (senão, faça a baixa) |
| Item por quantidade | só se nunca foi movimentado |
| Conferência | só se ainda não foi concluída |
| Termo | só se ainda não foi assinado |
| Ficha de baixa | só se o equipamento não está mais baixado (a baixa foi estornada) |

- Tudo com trava de acesso por linha no banco; o sistema público não tem permissão nenhuma.
- **Histórico de quem fez o quê:** cadastro de equipamentos, licenças e itens tem auditoria completa (inclusão, mudança e exclusão, com antes, depois e quem).

---

## 7. Contas que a tela faz

- **Valor atual (depreciação em linha reta):**
  `valor_compra × (1 − taxa/100 × anos desde a compra)`, nunca abaixo de zero.
  A taxa é a do equipamento, ou, se vazia, a da categoria. Os anos contam a partir de `data_compra`, com 365,25 dias por ano.
- **Saldo de um item** = soma das quantidades de todos os locais (ou de um local).
- **Vagas de licença em uso** = quantidade de linhas em `inv_licencas_uso`; livres = `quantidade` − em uso.
- **Custo mensal do inventário** = soma de:
  - `valor_mensal` dos equipamentos alugados;
  - licenças: mensais pelo valor, anuais divididas por 12 (as de pagamento único não entram).
- **Custo total de um equipamento** = valor de compra + custos de manutenção.

---

## 8. Telas

### 8.1 Painel
- **Números:** equipamentos, em uso, em estoque, em manutenção ou com defeito, valor de compra, valor atual, custo por mês (aluguéis e licenças) e avisos.
- **Atalhos:** cadastrar equipamento, cadastrar funcionário, item de estoque, importar planilha.
- **Avisos** com "Abrir" e "Criar tarefa":
  - funcionário desligado com equipamento;
  - garantia vencendo;
  - empréstimo atrasado;
  - licença vencendo;
  - estoque baixo.
- **Gráficos:** por situação, por categoria e em uso por departamento.
- **Últimas movimentações:** data, o quê, movimentação, para, motivo e quem.

### 8.2 Equipamentos
- Lista com busca (patrimônio, série, nome, hostname, IP) e filtros por:
  - situação (padrão: todas menos as baixadas);
  - categoria;
  - local;
  - funcionário;
  - departamento.
- **Ficha do equipamento:**
  - todos os campos da 3.6;
  - valor atual;
  - ligações;
  - licenças da máquina;
  - manutenções;
  - anexos;
  - histórico completo.
- **Ações:** também na ficha, sempre disponíveis: desfazer a última movimentação e imprimir etiqueta. As ações de movimentar dependem da situação atual:

| Situação atual | Ações que aparecem |
|---|---|
| Em estoque | Entregar a funcionário, Emprestar, Usar em aplicação, Deixar em uso no local, Mudar de local, Mandar para manutenção, Aguardando, Marcar com defeito, Marcar como perdido, Dar baixa |
| Em uso por funcionário | Devolver ao estoque, Mudar de local, Mandar para manutenção, Marcar com defeito, Marcar como perdido |
| Emprestado | Devolver ao estoque, Mudar de local, Mandar para manutenção, Marcar com defeito, Marcar como perdido |
| Em uso por aplicação | Devolver ao estoque, Mudar de local, Mandar para manutenção, Marcar com defeito, Marcar como perdido |
| Em uso no local | Devolver ao estoque, Entregar a funcionário, Usar em aplicação, Mudar de local, Mandar para manutenção, Marcar com defeito, Marcar como perdido |
| Em manutenção | Voltou da manutenção, Marcar com defeito, Dar baixa |
| Aguardando | Devolver ao estoque, Entregar a funcionário, Usar em aplicação, Deixar em uso no local, Marcar com defeito, Dar baixa |
| Com defeito | Mandar para manutenção, Devolver ao estoque, Dar baixa |
| Perdido | Devolver ao estoque (foi achado), Dar baixa |
| Baixado | nenhuma |

Na entrega, no empréstimo e na devolução, a opção "Gerar o termo de responsabilidade para assinar" já vem marcada.

### 8.3 Estoque
Itens por quantidade, com o saldo de cada local e o total. Ações: entrada, saída, transferir, ajustar. O item fica marcado quando está abaixo do mínimo.

### 8.4 Licenças
Vagas compradas, em uso e livres, vencimento e custo. Ação: dar a vaga a uma pessoa ou máquina, e liberar.

### 8.5 Funcionários
- **Cadastro:** CPF mascarado, situação, cargo e departamento.
- **Ficha:** o que está com a pessoa, as licenças dela, os sistemas que usa e os termos.
- **Desligar:** mostra as pendências para recolher.

### 8.6 Locais
Árvore de locais, com o que está em cada um.

### 8.7 Histórico
Todas as movimentações (as 500 mais recentes na tela), com filtro por tipo e por período (de e até), e botão para baixar em planilha. Um aviso na tela lembra que o histórico nunca muda: erro se corrige desfazendo a última movimentação, que fica registrada como estorno.

### 8.8 Conferência
- Abrir uma conferência (de tudo ou de um local) e marcar cada equipamento como achado ou não.
- A leitura pode ser feita digitando o patrimônio ou a série, ou com a câmera lendo o QR code, código de barras 128, código 39 ou EAN-13.
- Ao concluir, o sistema mostra quantos não foram achados e oferece marcar todos eles como perdidos de uma vez (movimentação `perda`). Depois de concluída, a conferência não muda mais.

### 8.9 Categorias e modelos
Cadastros de apoio, com a depreciação, a vida útil e o prazo de conferência de cada categoria.

### 8.10 Importar e exportar
Planilha CSV, detalhada na seção 10.

---

## 9. Documentos impressos

### 9.1 Termo de responsabilidade (entrega) e termo de devolução
Gerado na entrega, no empréstimo e na devolução (opção marcada por padrão). O texto gerado fica guardado em `inv_termos.texto`.

O termo traz:
- o título;
- a razão social e o documento da empresa;
- o funcionário: nome, CPF, cargo e departamento;
- a tabela dos equipamentos: patrimônio, equipamento (descrição, ou fabricante e modelo, ou categoria), série e estado (funcionando ou com defeito);
- a cidade e a data;
- as assinaturas do funcionário e da empresa.

**Compromissos do termo de entrega** (texto padrão):
1. Usar os equipamentos só para o trabalho, com cuidado, e não emprestar a terceiros.
2. Avisar logo em caso de defeito, perda, furto ou roubo (com boletim de ocorrência).
3. Devolver tudo no desligamento ou quando a empresa pedir, no estado em que recebeu, fora o desgaste normal do uso.
4. Desconto por dano só nos casos do art. 462, § 1º, da CLT (dolo, ou culpa quando previamente acordado).

**Termo de devolução:** "A empresa recebeu de volta os equipamentos acima, conferidos na data abaixo."

O termo assinado volta como anexo (papel `termo`), e a data vai em `assinado_em`.

### 9.2 Etiqueta com QR code
Três etiquetas por linha, cada uma com 62 × 26 mm. Cada etiqueta traz:
- o QR code (22 × 22 mm), que abre a ficha do equipamento no sistema (link com o `id`);
- o patrimônio em destaque (ou "sem patrimônio");
- a descrição ou categoria (até 48 letras);
- a série (S/N), quando houver.

---

## 10. Planilha de importação e exportação (CSV)

- CSV separado por ponto e vírgula, com os nomes das colunas na primeira linha.
- Há modelo para baixar, e o que já existe também pode ser baixado.
- **Antes de gravar, aparece a prévia com os erros de cada linha. Nada é gravado enquanto houver erro.**

### 10.1 Funcionários
Colunas: `nome`, `cpf`, `telefone`, `cargo`, `departamento`, `situacao` (ativo, afastado ou desligado; vazio = ativo).

Erros conferidos:
- falta o nome;
- CPF inválido;
- CPF já cadastrado;
- CPF repetido na própria planilha;
- situação desconhecida.

Importe os funcionários antes dos equipamentos que estão com eles.

### 10.2 Equipamentos
Colunas: `patrimonio`, `serie`, `categoria` (igual a uma categoria existente), `fabricante`, `modelo`, `descricao`, `situacao`, `local`, `funcionario` (nome ou CPF), `aplicacao`, `propriedade`, `locadora`, `fornecedor`, `nota_fiscal`, `data_compra`, `valor_compra`, `garantia_ate`, `hostname`, `ip`, `mac`, `sistema`, `notas`.

Local e modelo que ainda não existem são criados na importação.

### 10.3 Estoque (só exportação)
O saldo de cada item em cada local.

### 10.4 Histórico (só exportação)
As movimentações filtradas na tela de Histórico.

---

## 11. Ordem sugerida para montar em outro sistema

1. Tabelas de apoio: categorias (com as 21 padrão), modelos e locais.
2. Funcionários, com a conferência de CPF.
3. Equipamentos, com a regra "situação e com quem está andam juntas" e a trava que impede mudar a situação por edição.
4. Histórico de movimentações e a função de movimentar (mais a de estornar), gravando tudo na mesma transação. O cadastro já grava a primeira movimentação.
5. Itens por quantidade, saldos e a função de estoque.
6. Licenças e uso de licenças, com a trava de quantidade.
7. Ligações, manutenções, baixa (com NIST 800-88, MTR e CDF) e termos.
8. Conferência física e a função de conferir.
9. Anexos em armazenamento privado.
10. Avisos diários, painel, etiquetas, termo impresso e a planilha CSV.
11. Permissões: só o time responsável vê e mexe; histórico e saldos só pelas funções; exclusão só do que nunca foi usado; auditoria nos cadastros principais.
