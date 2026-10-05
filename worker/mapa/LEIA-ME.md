# Trabalhador do Mapa do Sistema

Monta o "Como está" da Infraestrutura do CicloDev: o inventário da interface de cada aplicação ligada (módulos, telas,
abas, janelas, botões, campos, para onde cada coisa leva, quando aparece e quem vê) e os alertas de dados.

## Como funciona (sem login no sistema do cliente e sem IA)

1. A cada publicação de um repositório ligado (ou no "Analisar agora"), entra um pedido na fila (`mapa_analises`).
2. O trabalhador pede o próximo à função `mapa-trabalho`, só com o segredo dele. Recebe o repositório e, para cada banco
   ligado, só a **estrutura** (tabelas, colunas, regras de valor, o que cada função devolve). Nunca o endereço do banco.
3. Baixa o código pela mesma função (a chave do GitHub/GitLab fica lá dentro).
4. Descobre sozinho quantas aplicações o repositório tem e de que tipo (React, Vue, Angular, Next, Svelte, HTML,
   e Java, PHP, Python, Ruby, .NET, Go lidos só pelo código).
5. Constrói uma cópia de cada uma numa pasta temporária, com variáveis de ambiente falsas, e sobe num endereço local.
6. Abre a cópia num navegador sem rede: toda chamada ao banco ou a outra API é respondida aqui, com dados de exemplo
   no formato das tabelas reais (cada texto é um marcador único, para saber qual coluna aparece em cada tela).
7. Percorre uma vez sem entrar e uma vez com cada papel achado nas regras do banco (ex.: `nivel in ('colaborador','gerente','diretor')`),
   com uma sessão de mentira: clica em tudo, abre as janelas, preenche os campos e anota para onde vai cada valor.
8. Lê o código (qualquer linguagem, texto puro) para achar o arquivo e a linha de cada peça e o que o código lê e grava.
9. Compara com o banco e devolve peças, ligações e alertas. Apaga a pasta.

Alertas (só com o banco da aplicação ligado): coluna ou tabela que não existe (erro), campo sem destino e só no navegador
(atenção), caminho sem fim e colunas sem tela (informação).

## Instalar num servidor com Docker

```
cd worker/mapa
sh instalar.sh
```

Pede o endereço da função e o segredo (fica em `/etc/ciclodev-mapa.env`, só o root lê). O segredo está no Cofre do CicloDev.

## Rodar sem servidor (para testar)

```
node trabalhador.mjs --pasta <repositório> --banco <estrutura.json> --saida mapa.json [--apps publico] [--tempo 120]
node testes/rodar.mjs
```

## Variáveis

| Variável | Para que serve |
|---|---|
| `MAPA_URL` | endereço da função mapa-trabalho |
| `MAPA_SEGREDO` | segredo do trabalhador (Vault: `ciclodev_mapa_segredo`) |
| `MAPA_TEMPO_PAPEL` | segundos por papel (padrão 480) |
| `MAPA_MAX_TELAS` | telas por papel (padrão 80) |
| `HTTPS_PROXY` | proxy de saída, se o servidor tiver (o curl usa para baixar as bibliotecas de CDN) |

## Segurança

- O segredo fica só na memória do processo principal. O código analisado (instalação, construção, servidor) roda como o
  usuário `caixa`, sem o segredo e sem as variáveis do trabalhador.
- O navegador nunca sai para a rede: chamadas são respondidas pelo banco de mentira; bibliotecas de CDN são baixadas
  pelo trabalhador. Imagens e fontes de fora não são baixadas.
- Só a instalação das bibliotecas (npm) usa a rede.
