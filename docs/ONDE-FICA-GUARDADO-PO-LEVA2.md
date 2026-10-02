# Onde fica guardado cada coisa das 14 melhorias (segunda leva do P.O.)

Resposta ao pedido "onde fica guardado". Conferido no banco de produção em 02/10/2026.

**Banco** quer dizer: tabela.coluna, ou a função do banco que grava. **Só calculado** quer dizer que a tela não guarda nada próprio: ela calcula na hora a partir de dados que já estão no banco.

Em `pessoas_preferencias`, cada pessoa só lê e grava a própria linha (regra "dono").

## Histórico oficial de mudanças do banco

As partes 44 a 53 foram aplicadas em 01 e 02/10/2026 direto pelo SQL. Por isso não apareciam em `supabase_migrations.schema_migrations`, e a última mudança visível era de 01/10. Em 02/10/2026 elas foram registradas:

| Registro | O que é |
|---|---|
| `ciclodev_52_estado_pessoa_e_permissoes` | O arquivo 52 inteiro. Pode rodar de novo sem estragar nada. |
| `ciclodev_53_po_leva2` | O arquivo 53 inteiro. Pode rodar de novo sem estragar nada. |
| `ciclodev_44_a_51_registro_conferido` | Não muda nada. Confere que cada peça das partes 44 a 51 existe e falha se faltar alguma. |

Os arquivos de cada mudança ficam em `banco/` (versionados no Git) e em `banco/APLICAR_NO_SUPABASE.sql`.

## As 14 melhorias

| # | Melhoria | Onde fica guardado | Arquivo de mudança de estrutura |
|---|---|---|---|
| 1 | Item de épico de outra frente dentro do épico | **Só calculado.** O épico de cada item sai da cadeia de pais (`itens.pai_id`) e a frente de `itens.frente_id`. A escolha "Agrupar por épico" da Lista fica no **banco**, em `pessoas_preferencias.tela` → `lv2PorEpico`. | `02_trabalho.sql` (itens); `22_preferencias_tela.sql` (tela) |
| 2 | Contagens que dizem o que contam | **Só calculado.** Vem de `itens` (situação em `status_id`, `arquivado_em`, `externa`, `frente_id`) e `marcos`. | `02_trabalho.sql`; `39_editar_em_lote.sql` (externa) |
| 3 | Tarefa externa fora dos pontos e "bloqueado por terceiro" | **Banco:** `itens.externa`. O "bloqueado por terceiro" é **calculado** a partir das ligações `itens_ligacoes` ("é bloqueado por") com uma tarefa externa ainda não aceita. O filtro rápido ligado fica em `pessoas_preferencias.tela` → `filtros.terceiro`. | `39_editar_em_lote.sql` (registro `ciclodev_39a_tarefa_externa`); `02_trabalho.sql` (ligações); `22_preferencias_tela.sql` |
| 4 | Definição de Pronto do projeto e por frente, com aviso de linha repetida | **Banco:** projeto em `projetos.definicao_pronto`; frente em `frentes.definicao_pronto`. O aviso de linha repetida é **calculado** na hora de guardar: não é um aviso que fica na tela, por isso não tem o que silenciar. O segundo clique em Guardar grava assim mesmo. | `38_item_completo_po.sql` (projeto); `53_po_leva2.sql` (frente) |
| 5 | Prazo preenchido pelo sistema; avisos; silenciar avisos | **Banco:** a origem fica em `itens.auto_origem` (exemplo: `{"prazo":"padrão de 7 dias ao criar (09/10/2026)"}`). A função `interno.po_historico_leva2()`, pelo gatilho `itens_po_historico_leva2`, grava em `itens_historico` a linha "Preenchido automaticamente ao criar". Os avisos (prazo depois da entrega, sem responsável, critério sem prova, bloqueado por terceiro, revisar) são **calculados**. **Silenciar** um aviso fica no **banco**, em `pessoas_preferencias.estado` → `po_silenciados` (chave do aviso → até quando, 7 dias). | `53_po_leva2.sql` (auto_origem e gatilho); `52_estado_pessoa_e_permissoes.sql` (estado) |
| 6 | Situação no Criar em lote | **Banco:** a situação em `itens.status_id`. "Criado já nesta situação, por lote" fica em `itens.auto_origem` → `situacao` e vai para `itens_historico` pelo mesmo gatilho do item 5. A regra do Aceito (só o P.O., com todos os critérios) é a de sempre, em `interno.po_regras_item()`. | `02_trabalho.sql`; `38_item_completo_po.sql`; `53_po_leva2.sql` |
| 7 | Prévia do Editar em lote (muda, não muda, erro) | **Só calculado.** A prévia simula numa cópia na tela e nada é gravado antes de confirmar. O Desfazer do último lote fica no **banco**, em `pessoas_preferencias.estado` → `lote_desfazer`. | `52_estado_pessoa_e_permissoes.sql` |
| 8 | Prova por critério | **Banco:** `itens_criterios.prova` (texto, link ou `anexo:<id>`), `prova_quem`, `prova_em` e `prova_resultado` (passou, falhou ou parcial). A função `interno.po_historico_criterio()` grava "prova: ..." em `itens_historico` com quem e quando. | `53_po_leva2.sql` |
| 9 | Decisão aceita com texto, quem e quando; marca "revisar" | **Banco:** `itens.decisao_texto`. `itens.decisao_por` e `itens.decisao_em` são carimbados pelo próprio banco, na função `interno.po_carimbar_decisao()` (gatilho `itens_po_carimbar_decisao`). A marca fica em `itens.revisar`, com motivo, decisão, quando e quem. "Marcado para revisar", "Revisado" e "Decisão registrada/mudou" vão para `itens_historico` com a pessoa. Os itens afetados são **calculados** a partir de `itens_ligacoes`. **Atenção:** a tabela `decisoes` (título, motivo, alternativas) é da Ficha técnica, de outra função. A decisão desta melhoria é o item do tipo Decisão (`itens.decisao`). | `53_po_leva2.sql`; `40_po_guia_projeto.sql` (itens.decisao) |
| 10 | Modelo "Dado / Quando / Então" | **Banco:** vira o texto do critério, em `itens_criterios.texto`. É só um jeito de escrever, sem coluna própria. | `38_item_completo_po.sql` |
| 11 | Mapa de histórias | **Só calculado**, a partir de `itens` (pai, frente, versão e situação) e `marcos`. A tela não tem escolhas para guardar. | `02_trabalho.sql` |
| 12 | Pirâmide do backlog | **Só calculado**, a partir de `itens` e `itens_criterios`, com a mesma regra do "Preparado". | `02_trabalho.sql`; `38_item_completo_po.sql` |
| 13 | Aba "O que mudou" | **Só calculado**, a partir de `itens_historico`. Os filtros escolhidos (desde quando, frente e pessoa) ficam no **banco**, em `pessoas_preferencias.tela` → `lv2Mudou`. | `38_item_completo_po.sql`, `39_editar_em_lote.sql`, `41_editar_lote_todas_colunas.sql` (histórico); `22_preferencias_tela.sql` (tela) |
| 14 | Baixar o projeto inteiro e o épico completo | **Só calculado.** O arquivo é montado na hora a partir de `itens`, `itens_criterios`, `itens_historico`, `frentes` e `projetos`. A tela não guarda escolhas. | os mesmos acima |

## Navegador

Nenhuma das 14 melhorias guarda coisa só no navegador.

Duas escolhas de tela ficavam só no navegador e foram corrigidas em 02/10/2026. Hoje vão para `pessoas_preferencias.tela`:
- "Agrupar por épico";
- os filtros do "O que mudou", que antes nem eram guardados.

O navegador ainda guarda **cópias** da arrumação da tela, só para abrir mais rápido. O original fica no banco.

Na primeira entrada depois da parte 52, o que estava só no navegador sobe para o banco:
- é juntado com o que o banco já tem;
- é conferido;
- só depois sai do navegador.
