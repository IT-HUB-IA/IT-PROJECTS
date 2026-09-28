"""Reescreve a aba Data model do Playbook (parte_playbook.html) com as tabelas reais do banco.
As colunas vêm direto do banco local (itia); o texto de cada tabela está aqui."""
import subprocess, re, os, html

AQUI = os.path.dirname(os.path.abspath(__file__))
PB = os.path.join(AQUI, '..', 'parte_playbook.html')

def cols(tabela, schema='public'):
    sql = ("select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns "
           "where table_schema = '%s' and table_name = '%s' and column_name not in ('id','criado_em','atualizado_em','tipo','frente_tipo','projeto_tipo','holding_tipo')" % (schema, tabela))
    return subprocess.run(['psql', '-h', '/tmp', '-p', '55432', '-U', 'postgres', '-d', 'itia', '-tAc', sql], capture_output=True, text=True).stdout.strip()

M, T, D, S = 'Só o Master', 'Master e o time de onde participa', 'Master e o time; o stakeholder só o visível ao cliente', 'Quem vê o registro de origem'
GRUPOS = [
 ('Estrutura', [
  ('nos', 'A árvore inteira: cada cliente, projeto, produto, aplicação e frente é uma linha', 'Master e quem participa (e o caminho até a raiz)'),
  ('nos_ancestrais', 'Cada registro ligado a todos os que estão acima dele. Mantida pelo banco, deixa os painéis rápidos', 'Igual à estrutura'),
  ('clientes', 'O que só o cliente tem: tipo (holding, empresa, pessoa), documento e a holding', 'Igual à estrutura'),
  ('projetos', 'O que só o projeto tem: do zero ou em andamento, início e data alvo', 'Igual à estrutura'),
  ('aplicacoes', 'O que só a aplicação tem: plataforma, código nosso ou de terceiros e o serviço do Catalog', 'Igual à estrutura'),
  ('frentes', 'O que só a frente tem: o limite de cartões em andamento', 'Igual à estrutura'),
  ('etiquetas', 'As etiquetas livres', 'Todos; só o Master muda'),
  ('etiquetas_nos', 'Qual etiqueta está em qual registro da estrutura', 'Igual à estrutura'),
 ]),
 ('Pessoas e acesso', [
  ('pessoas', 'O time e os stakeholders, ligados ao login quando ele existir', 'Todos; só o Master muda'),
  ('participacoes', 'Quem participa de onde e com que papel (vale para tudo abaixo)', 'O Master e a própria pessoa'),
 ]),
 ('Trabalho', [
  ('status_fluxo', 'Os status: o padrão e os personalizados de cada nível, cada um num grupo do fluxo', 'Todos; só o Master muda'),
  ('itens', 'Epics, stories, tarefas, subtarefas e bugs. Um registro só, lido por todas as views', D),
  ('itens_ligacoes', 'Bloqueia, relacionado e duplica (guardado num sentido só)', S),
  ('itens_checklist', 'As listas de conferência dos itens', S),
  ('campos_personalizados', 'Os campos personalizados criados num nível', T),
  ('itens_campos', 'O valor de cada campo personalizado em cada item', S),
  ('comentarios', 'Comentários num item ou direto num nível', D),
  ('sprints', 'Os ciclos curtos de cada projeto, sem sobreposição', T),
  ('marcos', 'Os marcos e as entregas de versão', D),
  ('tempo_registros', 'Cronômetro por item e tempo em foco na frente, na mesma tabela', 'A própria pessoa, o time e o Master'),
  ('blocos_agenda', 'Os horários reservados para um item, sem sobreposição', T),
  ('visoes_salvas', 'Os filtros e agrupamentos guardados com nome', 'O dono, ou todos quando compartilhada'),
  ('automacoes', 'Quando acontecer algo, faça algo', M),
  ('automacoes_execucoes', 'O registro de cada vez que uma automação rodou', M),
  ('notificacoes', 'Os avisos de cada pessoa', 'A própria pessoa'),
  ('quadros', 'O quadro visual (Whiteboard) de cada nível', T),
  ('quadro_elementos', 'Cartões, textos, formas e setas do quadro, que podem apontar para registros de verdade', T),
 ]),
 ('Ficha técnica e etapas', [
  ('ficha_campos', 'Os campos da ficha técnica; a aplicação herda do projeto o que não preencher', T),
  ('decisoes', 'O registro de decisões de cada nível', T),
  ('segredos_catalogo', 'A lista de segredos: só o nome e onde fica, nunca o valor', M),
  ('requisitos', 'Os requisitos mínimos obrigatórios', 'Master e time'),
  ('etapas_modelo', 'As etapas obrigatórias do modelo padrão', 'Master e time'),
  ('etapas_modelo_itens', 'Os itens de cada etapa, com modo, prova e quem cumpre', 'Master e time'),
  ('etapas_nos', 'A situação de cada item de etapa em cada projeto e aplicação, com os ajustes do Master', T),
  ('provas', 'As provas anexadas nos itens de etapa', T),
 ]),
 ('Comercial e custos', [
  ('servicos', 'O Catalog: cada serviço que a CicloDev vende', 'Master e time'),
  ('servicos_cobranca', 'Os modelos de cobrança de cada serviço', M),
  ('servicos_requisitos', 'Quais requisitos valem para cada serviço', 'Master e time'),
  ('regras_calculo', 'As regras de cálculo, com a data em que passam a valer', M),
  ('pessoas_custos', 'O custo de cada pessoa por vínculo, com vigência', M),
  ('cambio', 'O câmbio de cada dia', M),
  ('custos_operacao', 'Os custos da operação interna', M),
  ('custos_tecnicos', 'Os custos técnicos, ligados ao nível da estrutura (o cliente vem da árvore)', M),
  ('custos_uso', 'O uso de cada custo, mês a mês', M),
  ('receitas', 'O que cada cliente paga, ligado ao projeto ou à aplicação', M),
 ]),
 ('Service Desk e agentes', [
  ('slas', 'O prazo combinado por gravidade, em qualquer nível', 'Quem vê o nível'),
  ('pedidos', 'Os pedidos dos stakeholders, com o contexto capturado e o item gerado', 'O time e quem pediu'),
  ('pedidos_mensagens', 'A conversa de cada pedido: cliente, IA e equipe', S),
  ('agentes', 'Os agentes do Agent Studio', 'Master e time'),
  ('agentes_fontes', 'As fontes de conhecimento de cada agente', 'Master e time'),
  ('agentes_ferramentas', 'As ferramentas de cada agente e o nível de permissão', 'Master e time'),
  ('agentes_execucoes', 'O registro do que cada agente fez', M),
  ('agentes_avaliacoes', 'Os testes que medem se o agente responde certo', M),
  ('anexos', 'Arquivos e links, cada um preso a exatamente um lugar', S),
 ]),
]
BI = [
 ('bi.painel', 'O painel de qualquer nível: indicadores, progresso por parte, status, 14 dias, avisos, concluídos, mudanças e ritmo'),
 ('bi.financeiro', 'Custo do mês, já gasto, já cobrado, repasse, a receber, resultado e equipe para terminar, com a linha do tempo'),
 ('bi.parametros_preco e bi.calcular_preco', 'O preço da hora e a calculadora do Catalog'),
 ('bi.custo_pessoas e bi.operacao_mensal', 'O custo de cada pessoa pelo vínculo e a operação interna em valor mensal'),
 ('bi.custos_mensais e bi.receitas_mensais', 'Cada custo e cada receita mês a mês, desde o início (pode ser antigo) e com previsão'),
 ('bi.previsao_limites', 'Em quantos meses cada plano chega no limite'),
 ('bi.ritmo_semanal', 'Criados, concluídos, Lead time e Cycle time por semana, em cada nível (guardado pronto e atualizado a cada 10 minutos)'),
 ('bi.velocidade_sprints e bi.queima_sprint', 'A velocidade de cada ciclo e o gráfico de queima'),
 ('bi.carga', 'As horas de cada pessoa por dia, comparadas com a capacidade'),
 ('bi.pedidos_sla', 'A situação do prazo de cada pedido'),
 ('bi.etapas_situacao e bi.ficha_do_no', 'As etapas de cada projeto e a ficha técnica com herança'),
 ('auditoria.registros', 'Quem fez o quê, com o antes e o depois só do que mudou'),
]

def T_(termo, expl):
    t = termo + ' (' + expl + ')'
    return html.escape(termo) + '<button class="info" type="button" data-info="%s" aria-label="O que é: %s">i</button>' % (html.escape(t, quote=True), html.escape(t, quote=True))

h = ['      <div class="painel-aba" role="tabpanel" id="pn-modelo" aria-labelledby="aba-modelo" hidden>',
     '        <p class="intro">O ' + T_('Data model', 'modelo de dados: a lista das tabelas do banco e o que cada uma guarda') +
     ' do banco do projeto, já no ar no Supabase e conferido com os dados desta tela. A coluna Quem vê é o que as regras de ' +
     T_('RLS', 'regra no banco que decide quem vê cada linha') + ' aplicam de verdade.</p>',
     '        <div class="tabela-rolo"><table class="tabela">',
     '          <colgroup><col style="width:17%"><col style="width:29%"><col style="width:34%"><col style="width:20%"></colgroup>',
     '          <thead><tr><th scope="col">Tabela</th><th scope="col">O que guarda</th><th scope="col">Campos</th><th scope="col">Quem vê</th></tr></thead>',
     '          <tbody>']
for g, linhas in GRUPOS:
    h.append('            <tr class="grupo"><th scope="rowgroup" colspan="4">%s</th></tr>' % g)
    for t, o, q in linhas:
        c = cols(t)
        assert c, 'tabela sem colunas: ' + t
        h.append('            <tr><th scope="row"><code>%s</code></th><td>%s</td><td class="sec">%s</td><td>%s</td></tr>' % (t, html.escape(o), html.escape(c.replace('_', ' ')), html.escape(q)))
h.append('            <tr class="grupo"><th scope="rowgroup" colspan="4">Contas (BI) e registro</th></tr>')
for t, o in BI:
    h.append('            <tr><th scope="row"><code>%s</code></th><td colspan="2">%s</td><td>%s</td></tr>' % (html.escape(t), html.escape(o), 'Pela tela, conforme o papel' if t.startswith('bi.') else 'Só o Master'))
h += ['          </tbody>', '        </table></div>', '      </div>']

s = open(PB).read()
i = s.index('      <div class="painel-aba" role="tabpanel" id="pn-modelo"')
j = s.index('      <div class="painel-aba" role="tabpanel" id="pn-ficha"')
s = s[:i] + '\n'.join(h) + '\n\n' + s[j:]
open(PB, 'w').write(s)
print('Data model atualizado:', sum(len(l) for _, l in GRUPOS), 'tabelas')
