# Portal do stakeholder: o que o Java da Blanco & Lisboa precisa fazer

> Para: o agente que cuida do sistema Java da Blanco & Lisboa (repositório `Blanco-Lisboa/B-L`, pasta `bl-sistema-java`).
> De: o CicloDev (IT.IA), onde fica o acompanhamento dos projetos da Blanco & Lisboa.
> Onde cada coisa aparece dentro do Java é decisão do William com você. Este documento diz **o que** precisa existir e **como** ligar.

## 1. A regra principal

O Java **não guarda nada** disto no banco dele. Todo dado mora no banco do CicloDev. O Java só:

1. **lê** e mostra (painel, estrutura, quadro, itens, perguntas);
2. **responde** as perguntas que a equipe do CicloDev manda;
3. **recebe avisos** quando chega pergunta nova (ou busca a lista de avisos, se preferir).

Quem pode ver e responder: só as pessoas que o William convidar no portal (hoje: Lucas, Adrian e ele mesmo). O portal é do usuário do William no CicloDev; ninguém mais do CicloDev enxerga o portal.

## 2. Como ligar

| O quê | Valor |
|---|---|
| Endereço base | `https://tfcvoszeewmpghgxztuy.supabase.co/functions/v1/portal-api` |
| Chave do portal | Gerada pelo William no CicloDev (Operações › cliente Blanco & Lisboa › Mais › Portal do stakeholder › Gerar chave). Começa com `cdp_`. Aparece uma vez só. |
| Como mandar a chave | Cabeçalho `Authorization: Bearer <chave>` em **toda** chamada |
| Quem está respondendo | Cabeçalho `X-Portal-Usuario: <e-mail>` nas respostas. O e-mail precisa estar na lista de convidados do portal (ativo). |
| Segredo do webhook | Gerado no CicloDev na mesma tela (Aviso automático). Começa com `cdw_`. Aparece uma vez só. |

**Segurança:**
- A chave e o segredo vão em **variáveis de ambiente** do Java (por exemplo `CICLODEV_PORTAL_CHAVE` e `CICLODEV_WEBHOOK_SEGREDO`), nunca no código, nunca no repositório, nunca no log.
- Todas as chamadas saem do lado servidor do Java (Spring), nunca da tela JavaFX direto com a chave exposta.
- O Java é responsável por mandar em `X-Portal-Usuario` o e-mail de quem está logado **nele**. O CicloDev confere que esse e-mail foi convidado, mas confia que o Java identificou a pessoa certa.
- Se a chave vazar, o William revoga na mesma tela e gera outra.

Todas as respostas vêm em JSON neste formato:

```json
{ "ok": true, "portal": { "id": "…", "nome": "Blanco & Lisboa" }, "dados": … }
```

Erro:

```json
{ "ok": false, "erro": "texto em português, pode mostrar para a pessoa" }
```

| Código | Quando |
|---|---|
| 400 | Pedido mal feito (id inválido, corpo que não é JSON, resposta vazia, falta `X-Portal-Usuario`) |
| 401 | Sem chave, chave errada ou revogada |
| 403 | E-mail que não é convidado, ou parte fora do portal |
| 404 | Endereço desconhecido, ou item/pergunta que não é deste portal |
| 409 | Pergunta que já foi respondida ou cancelada |
| 413 | Resposta com mais de 8000 letras |
| 500 | Problema no CicloDev (tente de novo depois) |

## 3. As telas que precisam existir no Java

Os nomes abaixo são sugestões; onde e como aparecem é com vocês.

### 3.1 Painel (igual ao painel do CicloDev)

Chamada: `GET /painel` (o cliente todo) ou `GET /painel?no=<id>` (uma parte: projeto, produto, aplicação ou frente).

O que mostrar, na mesma ordem do CicloDev:

1. **Aviso de perguntas** no alto, se `numeros.perguntas_esperando` > 0: "X perguntas esperando resposta", com botão para a caixa de perguntas (3.5).
2. **Seis números em cartões:** Itens (`itens`), A fazer (`a_fazer`), Em andamento (`em_andamento`), Concluídos (`concluidos`), Frentes ativas (`frentes_ativas`), Frentes paradas (`frentes_paradas`). Os atrasados (`atrasados`) e travados (`travados`) vão como texto pequeno embaixo.
3. **Progresso por parte** (`por_parte`): uma barra por projeto ou produto, com a porcentagem (`progresso`) e "X de Y". Clicar abre o painel daquela parte (`?no=<id>`).
4. **Itens por status** (`por_grupo`): rosca ou barras, com as cores do CicloDev (seção 5).
5. **Linha do tempo de 14 dias** (`concluidos_por_dia`): uma barra por dia com os concluídos.
6. **Últimos concluídos** (`ultimos_concluidos`) e **Próximos prazos** (`proximos_prazos`): listas curtas. Clicar abre o item (3.4).

Exemplo real (encurtado):

```json
{
  "no": { "id": "a615f8ab-…", "nome": "Blanco & Lisboa", "tipo": "cliente" },
  "numeros": { "itens": 42, "a_fazer": 16, "em_andamento": 9, "travados": 1, "concluidos": 16, "atrasados": 3,
               "frentes_ativas": 34, "frentes_paradas": 0, "perguntas_esperando": 1 },
  "por_grupo": { "backlog": 6, "todo": 10, "doing": 7, "review": 2, "blocked": 1, "done": 16 },
  "por_parte": [ { "id": "cea3db88-…", "nome": "BL", "tipo": "projeto", "itens": 42, "concluidos": 16, "progresso": 38 } ],
  "concluidos_por_dia": [ { "dia": "2026-09-16", "concluidos": 0 }, "… 14 dias …" ],
  "ultimos_concluidos": [ { "id": "…", "chave": "BL-8", "titulo": "Regras de acesso por empresa (RLS)", "concluido_em": "…" } ],
  "proximos_prazos": [ { "id": "…", "chave": "BL-27", "titulo": "Filtro por competência não respeita o mês", "prazo": "2026-09-25", "status": "A fazer" } ]
}
```

### 3.2 Estrutura (para navegar)

Chamada: `GET /estrutura`. Vem a árvore inteira do cliente numa lista: cada parte com `pai_id` e `nivel` (0 = o cliente, 1 = projetos, e assim por diante), `itens`, `concluidos`, `travados` e `progresso`.

Mostre como uma árvore lateral ou um caminho de migalhas ("Blanco & Lisboa › BL › Java BL"). Clicar numa parte abre o painel (`/painel?no=<id>`) ou o quadro (`/quadro?no=<id>`) daquela parte.

```json
{ "id": "70b80c6e-…", "tipo": "produto", "pai_id": "cea3db88-…", "nome": "YOU Contabilidade", "status": "ativo", "nivel": 2,
  "itens": 16, "concluidos": 5, "travados": 0, "progresso": 31 }
```

### 3.3 Quadro analítico (visão macro do Kanban)

Chamada: `GET /quadro` ou `GET /quadro?no=<id>`.

Não é o quadro de trabalho do CicloDev: é uma visão para enxergar o todo.
- **Seis colunas do fluxo:** Na fila, A fazer, Fazendo, Em revisão, Travado ou esperando, Feito. Cada coluna mostra quantos itens tem.
- **Dentro de cada coluna, um cartão por épico,** com:
  - título e chave;
  - a frente;
  - o prazo;
  - a barra de progresso ("2 de 4");
  - um selo quando `perguntas_esperando` > 0.
- **Clicar no cartão** abre o épico em modo apresentação (3.4).
- `sem_epico` é quantos itens soltos (sem épico) estão naquela coluna. Mostre como um número no pé da coluna.

```json
{ "colunas": [ { "grupo": "doing", "nome": "Fazendo", "itens": 7, "sem_epico": 4,
  "epicos": [ { "id": "8a3977f7-…", "chave": "BL-1", "titulo": "Ficha única do cliente no banco BL", "status": "Fazendo", "frente": "Database",
                "prazo": "2026-10-16", "itens": 4, "concluidos": 2, "progresso": 50, "perguntas_esperando": 0 } ] }, "… as outras 5 colunas …" ] }
```

### 3.4 Item ou épico em modo apresentação

Chamada: `GET /itens/<id>`.

Uma tela limpa, só de leitura, com:
- chave e título;
- o caminho na Estrutura (`onde`, do cliente até a frente);
- status, prioridade, responsável, início, prazo, versão;
- a descrição (vem em Markdown simples) e o checklist;
- **os itens de dentro**, se for épico (`itens`), com o status de cada um. Clicar num deles abre ele mesmo nesta tela, com uma seta para voltar;
- **as perguntas** daquele item (`perguntas`). As que estão `aguardando` têm o campo de resposta ali mesmo (3.5);
- os comentários que o cliente pode ver (`comentarios_do_cliente`).

Campos que vêm (exemplo real, encurtado):

```json
{ "id": "8a3977f7-…", "chave": "BL-1", "tipo": "epic", "titulo": "Ficha única do cliente no banco BL", "descricao": null,
  "status": "Fazendo", "grupo": "doing", "prioridade": "high", "inicio": "2026-07-28", "prazo": "2026-10-16", "concluido_em": null,
  "responsavel": "William", "versao": null, "epico": null,
  "onde": [ { "tipo": "cliente", "nome": "Blanco & Lisboa" }, { "tipo": "projeto", "nome": "BL" }, { "tipo": "produto", "nome": "Blanco & Lisboa" },
            { "tipo": "aplicacao", "nome": "Java BL" }, { "tipo": "frente", "nome": "Database" } ],
  "checklist": [ { "texto": "…", "feito": true } ],
  "itens": [ { "id": "0cd891b9-…", "chave": "BL-14", "tipo": "story", "titulo": "API de transferência de clientes para os Javas", "status": "Fazendo",
               "grupo": "doing", "prazo": "2026-10-02", "responsavel": "William" } ],
  "perguntas": [ { "pergunta_id": "9003a39c-…", "pergunta": "O layout novo do painel pode ir para o ar na sexta?", "status": "aguardando",
                   "criada_por": "William", "criada_em": "…", "resposta": null, "respondida_por": null, "respondida_em": null,
                   "item": { "id": "8a3977f7-…", "chave": "BL-1", "titulo": "Ficha única do cliente no banco BL", "tipo": "epic" } } ],
  "comentarios_do_cliente": [ { "texto": "…", "autor": null, "quando": "…" } ] }
```

Os tipos que podem vir em `tipo` são `epic` (Épico), `story` (História), `task` (Tarefa), `subtask` (Subtarefa) e `bug` (Defeito). As prioridades em `prioridade` são `highest` (Urgente), `high` (Alta), `medium` (Média) e `low` (Baixa).

### 3.5 Caixa de perguntas e resposta

Chamadas:
- `GET /perguntas`: as que estão esperando.
- `GET /perguntas?status=respondida`, `?status=cancelada` ou `?status=todas`: as outras.
- `POST /perguntas/<pergunta_id>/resposta`: para responder, com:
  - o cabeçalho `X-Portal-Usuario: lucas@…`;
  - o corpo `{"texto": "a resposta"}`.

O que precisa ter:
1. **Aviso no painel e um contador** (sininho ou selo) com as perguntas esperando.
2. **A lista das perguntas.** Cada uma mostra:
   - a pergunta;
   - quem perguntou e quando;
   - o item ou épico de onde veio, e clicar abre o modo apresentação (3.4), para a pessoa entender do que se trata.
3. **O campo para responder e o botão Enviar.** Depois de enviar, a pergunta sai da lista de esperando. Se a resposta for 409, outra pessoa já respondeu: atualize a lista.

O que acontece no CicloDev quando o Java responde (não precisa fazer nada, é automático):
- o item sai de "Aguardando stakeholder" e volta para o status que tinha;
- a resposta vira comentário no item, com o nome de quem respondeu;
- o William (e quem perguntou) recebe o aviso no sininho;
- o painel do cliente Blanco & Lisboa mostra "Lucas respondeu".

### 3.6 Quem pode responder

`GET /membros` devolve os convidados (`email`, `nome`, `ativo`). Use para ligar o usuário logado no Java ao e-mail convidado. Se o e-mail de quem está logado não está nessa lista, ou está com `ativo = false`, a tela de resposta não deve aparecer para essa pessoa.

## 4. Avisos automáticos (webhook) e a lista de avisos

Quando alguém do CicloDev **manda**, **cancela** uma pergunta, ou quando ela é **respondida**, o CicloDev avisa o Java em até 1 minuto.

**Opção A: webhook (recomendada).**
1. O Java expõe um endereço `https://…` (por exemplo `POST /ciclodev/avisos` no Spring).
2. O William cadastra esse endereço no CicloDev e passa o segredo `cdw_…` para vocês.

O CicloDev manda:

```
POST <endereço do Java>
Content-Type: application/json
X-CicloDev-Evento: pergunta_criada | pergunta_respondida | pergunta_cancelada
X-CicloDev-Assinatura: sha256=<HMAC-SHA256 do corpo, em hexadecimal, com o segredo>

{ "id": 2, "tipo": "pergunta_criada", "criado_em": "…", "dados": { …os mesmos campos de uma pergunta (3.4)… } }
```

O Java precisa:
1. **Conferir a assinatura** antes de qualquer coisa. Calcule o HMAC-SHA256 do corpo **exatamente como chegou** (os bytes brutos, antes de transformar em objeto) com o segredo, e compare com o cabeçalho. Se não bater, responda 401 e ignore.
2. **Responder 2xx em até 10 segundos.** Sem resposta 2xx, o CicloDev tenta de novo a cada minuto, até 10 vezes.
3. **Não repetir o que já recebeu:** o `id` é único e sempre crescente. Guarde o último `id` recebido (em memória ou arquivo de configuração; não precisa de banco) e ignore repetidos.
4. Com `pergunta_criada`, mostrar o aviso para quem pode responder e atualizar o contador.

Exemplo de conferência em Java 21:

```java
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

static boolean assinaturaConfere(byte[] corpoBruto, String cabecalho, String segredo) throws Exception {
    if (cabecalho == null || !cabecalho.startsWith("sha256=")) return false;
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(segredo.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String esperado = "sha256=" + HexFormat.of().formatHex(mac.doFinal(corpoBruto));
    return MessageDigest.isEqual(esperado.getBytes(StandardCharsets.UTF_8), cabecalho.getBytes(StandardCharsets.UTF_8));
}
```

No Spring, receba o corpo como `byte[]` (`@RequestBody byte[] corpo`) para ter os bytes brutos.

**Opção B: buscar a lista (sem webhook, ou para garantir que nada se perdeu).**

`GET /eventos?depois=<último id recebido>` devolve até 200 avisos depois daquele id, na ordem. Chamar a cada 1 minuto é suficiente. Dá para usar as duas juntas: o webhook para ser imediato, e a lista ao abrir o Java para pegar o que chegou com ele fechado.

## 5. Cores e nomes, para ficar igual ao CicloDev

| Grupo (`grupo`) | Nome | Cor (a mesma do CicloDev, em `fonte/design.css`) |
|---|---|---|
| `backlog` | Na fila | cinza `#A6A6AD` |
| `todo` | A fazer | azul `#3355E0` |
| `doing` | Fazendo | laranja `#E08600` |
| `review` | Em revisão | roxo `#6D4AFF` |
| `blocked` | Travado ou esperando (inclui "Aguardando stakeholder") | vermelho `#FF0000` |
| `done` | Feito | verde `#0E8A55` |

O status vem pronto em português no campo `status`. Use o `grupo` só para a cor e a coluna do quadro.

## 6. O caminho completo, do começo ao fim

1. O William abre o épico **BL-1** no CicloDev, clica no **⋯**, escolhe **Perguntar ao stakeholder** e escreve a pergunta.
2. O épico vai para "Aguardando stakeholder" (coluna Travado ou esperando).
3. Em até 1 minuto, o Java recebe `pergunta_criada`, ou pega pela lista, e mostra o aviso para Lucas, Adrian e William.
4. Lucas abre o aviso, vê o épico em modo apresentação (o que é, o que tem dentro, em que pé está) e escreve a resposta.
5. O Java manda `POST /perguntas/<id>/resposta` com `X-Portal-Usuario: lucas@…`.
6. O CicloDev:
   - volta o épico para o status que tinha;
   - põe a resposta como comentário;
   - avisa o William no sininho e no painel do cliente;
   - manda `pergunta_respondida` para o Java.
7. O Java tira a pergunta da lista de esperando e mostra "respondida por Lucas".

## 7. Lista para o agente do Java

- [ ] Guardar a chave e o segredo em variáveis de ambiente, fora do repositório.
- [ ] Um serviço Spring que chama a portal-api com `Authorization: Bearer` (todas as chamadas do lado servidor).
- [ ] Painel (3.1), com o aviso de perguntas no alto.
- [ ] Estrutura para navegar (3.2).
- [ ] Quadro analítico (3.3), com clique no cartão abrindo o épico.
- [ ] Modo apresentação do item e do épico (3.4), com seta para voltar.
- [ ] Caixa de perguntas com resposta (3.5), mandando o e-mail de quem está logado em `X-Portal-Usuario`.
- [ ] Mostrar a resposta só para quem está em `/membros` e ativo (3.6).
- [ ] Receber o webhook conferindo a assinatura (4, opção A), ou buscar a lista (opção B), ou os dois.
- [ ] Passar para o William o endereço do webhook, para ele cadastrar no CicloDev.
- [ ] Nada disso vai para o banco do Java: só o último `id` de aviso recebido, se quiserem guardar, em arquivo de configuração.
