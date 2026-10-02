import html,re
src=open('gerar_playbook.py',encoding='utf-8').read()
def I(t):
    t=html.escape(t,quote=True)
    return '<button class="info" type="button" data-info="%s" aria-label="O que é: %s">i</button>'%(t,t)
def T(term,expl): return html.escape(term)+I(term+' ('+expl+')')
exec(src[src.index('REGRAS=['):src.index('# ---------------- HTML')])

f='parte_playbook.html'; s=open(f,encoding='utf-8').read()
h=[]
h.append('''    <section class="conteudo" id="tela-playbook" aria-labelledby="titulo-pb" hidden>
      <h1 id="titulo-pb"><span>Playbook</span>'''+I('Playbook (manual de regras da operação): o que vale para todo projeto, sempre.')+'''</h1>
      <p class="lead">As regras que todo projeto da IT.IA segue, do jeito que o banco se comporta até as etapas que nenhum projeto pode pular, mesmo com uma pessoa só no time.</p>

      <div class="abas" role="tablist" aria-label="Seções do Playbook">
        <button class="aba" type="button" role="tab" id="aba-dados" aria-controls="pn-dados" aria-selected="true">Estrutura de dados</button>
        <button class="aba" type="button" role="tab" id="aba-etapas" aria-controls="pn-etapas" aria-selected="false">Stage gates</button>
        <button class="aba" type="button" role="tab" id="aba-hier" aria-controls="pn-hier" aria-selected="false">Hierarquia</button>
        <button class="aba" type="button" role="tab" id="aba-modelo" aria-controls="pn-modelo" aria-selected="false">Data model</button>
        <button class="aba" type="button" role="tab" id="aba-ficha" aria-controls="pn-ficha" aria-selected="false">Tech sheet</button>
      </div>
''')
# dados
h.append('''      <div class="painel-aba" role="tabpanel" id="pn-dados" aria-labelledby="aba-dados">
        <p class="intro">As regras que o banco segue. Valem para todos os projetos e aplicações, sem exceção.</p>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:20%"><col style="width:45%"><col style="width:35%"></colgroup>
          <thead><tr><th scope="col">Regra</th><th scope="col">Como funciona</th><th scope="col">Por quê</th></tr></thead>
          <tbody>''')
for t,d,p in REGRAS:
    h.append('            <tr><th scope="row">%s</th><td>%s</td><td class="sec">%s</td></tr>'%(t,d,p))
h.append('          </tbody>\n        </table></div>\n      </div>')
# etapas
h.append('''      <div class="painel-aba" role="tabpanel" id="pn-etapas" aria-labelledby="aba-etapas" hidden>
        <p class="intro">Todo projeto passa por estas '''+T('Stage gates','etapas com trava: só avança quando a etapa anterior entregou o que devia')+''', na ordem da tabela. Cada etapa tem uma '''+T('Lens','lente: o papel de especialista que avalia aquela parte')+''' responsável.</p>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:16%"><col style="width:16%"><col style="width:18%"><col style="width:32%"><col style="width:18%"></colgroup>
          <thead><tr><th scope="col">Etapa</th><th scope="col">O que é</th><th scope="col">Lente</th><th scope="col">O que precisa ser cumprido</th><th scope="col">Entrega que libera a próxima</th></tr></thead>
          <tbody>''')
for n,x,lente,itens,ent in ETAPAS:
    cls=' class="destaque"' if n=='Approval' else ''
    h.append('            <tr%s><th scope="row">%s%s</th><td class="sec">%s</td><td>%s</td><td><ul>%s</ul></td><td>%s</td></tr>'%(
        cls,n,I(n.replace('&amp;','&')+' ('+ETAPA_EXPL[n]+')'),x[0].upper()+x[1:],lente,''.join('<li>%s</li>'%i for i in itens),ent))
h.append('''          </tbody>
        </table></div>
        <h2 class="sub">Regras que valem para todas as etapas</h2>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:20%"><col style="width:80%"></colgroup>
          <thead><tr><th scope="col">Situação</th><th scope="col">Como funciona</th></tr></thead>
          <tbody>
            <tr><th scope="row">Time de uma pessoa só</th><td>Quem está sozinho no time veste todas as lentes, uma de cada vez. A etapa não some porque o time é pequeno.</td></tr>
            <tr><th scope="row">Projeto do zero</th><td>'''+T('Greenfield','projeto que começa do zero')+''' começa no Intake e passa por todas as etapas.</td></tr>
            <tr><th scope="row">Projeto em andamento</th><td>'''+T('Brownfield','projeto que já existe e é trazido em andamento')+''' também começa no Intake. No Discovery, marca com evidência as etapas que já estão cumpridas.</td></tr>
            <tr><th scope="row">Item que não se aplica</th><td>Vira '''+T('Waiver','dispensa registrada: não se aplica, com o motivo por escrito')+''', com o motivo e quem aprovou. Nada é pulado em silêncio.</td></tr>
            <tr><th scope="row">Aviso ou trava</th><td>Por enquanto todos os itens só avisam. O Master escolhe, item por item, se aquele item avisa, trava ou fica desligado.</td></tr>
            <tr><th scope="row">Prova do que foi feito</th><td>O Master pode exigir uma '''+T('Evidence','prova: o que mostra que o item foi cumprido de verdade')+''' em qualquer item. Quem executa anexa a prova, e ela fica guardada no item para ser vista depois.</td></tr>
          </tbody>
        </table></div>
        <h2 class="sub">Como cada item pode ser configurado pelo Master</h2>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:20%"><col style="width:40%"><col style="width:40%"></colgroup>
          <thead><tr><th scope="col">Configuração</th><th scope="col">Opções</th><th scope="col">O que acontece</th></tr></thead>
          <tbody>
            <tr><th scope="row">Modo</th><td><ul class="em-linha"><li>Aviso</li><li>Trava</li><li>Desligado</li></ul></td><td class="sec">Aviso deixa seguir e mostra o alerta. Trava só libera a próxima etapa quando o item estiver cumprido. Desligado não cobra o item naquele projeto.</td></tr>
            <tr><th scope="row">Obrigatório</th><td><ul class="em-linha"><li>Sim</li><li>Não</li></ul></td><td class="sec">Item obrigatório aparece destacado para quem executa e entra no aviso ou na trava.</td></tr>
            <tr><th scope="row">Tipo de prova</th><td><ul class="em-linha"><li>Captura de tela</li><li>Arquivo</li><li>Link</li><li>Texto</li><li>Aprovação de alguém</li><li>Nenhuma</li></ul></td><td class="sec">Quem executa precisa anexar a prova do tipo pedido para marcar o item como cumprido.</td></tr>
            <tr><th scope="row">Quem pode cumprir</th><td><ul class="em-linha"><li>Responsável da etapa</li><li>Qualquer pessoa do time</li><li>Pessoa definida</li></ul></td><td class="sec">Só quem tem a permissão consegue marcar o item e anexar a prova.</td></tr>
            <tr><th scope="row">Registro</th><td><ul class="em-linha"><li>Quem cumpriu</li><li>Quando</li><li>A prova anexada</li></ul></td><td class="sec">Tudo fica gravado no item, e o Master consulta depois, a qualquer momento.</td></tr>
            <tr><th scope="row">Onde vale</th><td><ul class="em-linha"><li>Modelo padrão</li><li>Só neste projeto</li><li>Só nesta aplicação</li></ul></td><td class="sec">A regra pode valer para todo projeto novo ou ser ajustada só em um projeto ou numa aplicação.</td></tr>
          </tbody>
        </table></div>
      </div>''')

# hierarquia
NIVEIS=[
 ('Client','cliente','Quem contrata. Pode ser holding, empresa ou pessoa. Empresa pode estar ligada a uma holding.','Grupo Exemplo (holding) · Empresa A (ligada à holding)','Sim'),
 ('Project','projeto','O trabalho contratado por um cliente.','BL','Sim'),
 ('Product','produto','Conjunto de aplicações de uma mesma unidade de negócio. Opcional.','Empresa A · Empresa B · Empresa C','Opcional'),
 ('Application','aplicação','Cada sistema ou app entregue. Fica dentro de um produto ou direto no projeto.','Sistema web · App celular · Portal do cliente','Sim'),
 ('Workstream','frente de trabalho','As trilhas dentro da aplicação.','Frontend · Backend · Database · Integrations · AI','Sim'),
 ('Epic','grande entrega','Um bloco grande de trabalho.','Módulo Financeiro','Opcional'),
 ('Story','funcionalidade vista pelo usuário','O que a pessoa vai conseguir fazer.','O CEO vê o faturamento do mês','Opcional'),
 ('Task','tarefa','O trabalho do dia a dia.','Criar a tabela de faturamento','Sim'),
 ('Sub-task','subtarefa','Um pedaço de uma tarefa.','Criar o índice da tabela','Opcional'),
]
h.append("""      <div class="painel-aba" role="tabpanel" id="pn-hier" aria-labelledby="aba-hier" hidden>
        <p class="intro">Do mais amplo para o mais detalhado. Dentro de qualquer projeto dá para criar produtos e aplicações novos, e qualquer um pode ser movido para outro lugar.</p>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:16%"><col style="width:30%"><col style="width:40%"><col style="width:14%"></colgroup>
          <thead><tr><th scope="col">Nível</th><th scope="col">O que é</th><th scope="col">Exemplo no projeto BL</th><th scope="col">Obrigatório</th></tr></thead>
          <tbody>""")
for n,x,d,e,o in NIVEIS:
    h.append('            <tr><th scope="row">%s</th><td>%s</td><td class="sec">%s</td><td>%s</td></tr>'%(T(n,x),d,e,o))
h.append("""          </tbody>
        </table></div>
        <h2 class="sub">Etiquetas</h2>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:20%"><col style="width:40%"><col style="width:40%"></colgroup>
          <thead><tr><th scope="col">Tipo</th><th scope="col">Como funciona</th><th scope="col">Exemplo</th></tr></thead>
          <tbody>
            <tr><th scope="row">"""+T('System tag','etiqueta automática')+"""</th><td>Gerada pelas ligações. Aparece com cadeado, muda sozinha quando algo é movido e ninguém apaga.</td><td><ul class="em-linha"><li>Holding: BL</li><li>Projeto: BL</li><li>Produto: YOU</li></ul></td></tr>
            <tr><th scope="row">"""+T('Tag','etiqueta livre')+"""</th><td>Criada, editada e apagada à vontade. Pode ir em cliente, projeto, produto ou aplicação, com nome, cor, categoria e descrição.</td><td><ul class="em-linha"><li>Holding</li><li>Contabilidade</li><li>Prioritário</li><li>Em negociação</li></ul></td></tr>
          </tbody>
        </table></div>
      </div>""")

# modelo de dados
MODELO=[
 ('Base',[
  ('clients','Os clientes, inclusive a holding','nome, tipo (holding, empresa, pessoa), holding a que pertence, documento, status','Master e time; o stakeholder vê só o próprio','Primeiro'),
  ('tags','As etiquetas livres','nome, cor, categoria, descrição','Master e time','Primeiro'),
  ('tag_links','Qual etiqueta está em qual registro','etiqueta, tipo do registro, registro','Quem vê o registro','Primeiro'),
  ('projects','Os projetos','cliente, nome, status, motivo da pausa, do zero ou em andamento, datas','Membros do projeto','Primeiro'),
  ('products','Os produtos de cada projeto','projeto, cliente da empresa, nome, status','Membros do projeto ou do produto','Primeiro'),
  ('applications','As aplicações','projeto, produto, nome, plataforma (desktop, web, mobile), status','Membros do projeto, produto ou aplicação','Primeiro'),
  ('workstreams','As frentes de cada aplicação','aplicação, nome, status, em foco, limite de cartões','Membros da aplicação','Primeiro'),
 ]),
 ('Pessoas e acesso',[
  ('people','As pessoas do time e os stakeholders','nome, função, habilidades, horas por semana','Master e o próprio','Primeiro'),
  ('memberships','Quem participa de onde e com que papel','pessoa, onde (projeto, produto ou aplicação), papel (Owner, Dev, Stakeholder)','Master','Primeiro'),
  ('audit_log','Quem fez o quê','quem, quando, o quê, antes e depois','Master','Primeiro'),
 ]),
 ('Ficha técnica e etapas',[
  ('tech_sheets','A ficha de cada projeto e aplicação','de quem é a ficha, herda da ficha do projeto','Membros','Primeiro'),
  ('tech_sheet_fields','Os campos da ficha, inclusive os personalizados','seção, nome, tipo, valor','Membros','Primeiro'),
  ('attachments','Os arquivos anexados em qualquer lugar','onde está, nome, tipo, local no storage, quem enviou','Quem vê o registro','Primeiro'),
  ('decisions','O registro de decisões','o quê, por quê, quem decidiu, quando, alternativas','Membros','Primeiro'),
  ('secrets_catalog','A lista de segredos, sem os valores','nome, onde fica, quem acessa, última troca','Master','Primeiro'),
  ('stage_templates','O modelo padrão das etapas','nome, ordem, lente, entrega','Master','Primeiro'),
  ('stage_template_items','Os itens do modelo padrão','texto, modo (aviso, trava, desligado), obrigatório, tipo de prova, quem pode cumprir','Master','Primeiro'),
  ('stage_items','Os itens de cada projeto ou aplicação','ajustes do modelo, quem cumpriu, quando, dispensa e motivo','Membros','Primeiro'),
  ('evidences','As provas anexadas nos itens','item, tipo (captura, arquivo, link, texto, aprovação), conteúdo, quem enviou','Membros e Master','Primeiro'),
 ]),
 ('Trabalho',[
  ('issues','Epics, stories, tasks, sub-tasks e bugs','onde fica, item pai, tipo, título, status, prioridade, responsável, estimativa, início, prazo, data prevista, visível ao cliente','Membros; stakeholder só o visível','Em seguida'),
  ('statuses','Os status personalizados','onde vale, nome, cor, grupo (a fazer, em andamento, concluído)','Membros','Em seguida'),
  ('issue_links','As ligações entre itens','item, outro item, tipo (bloqueia, relacionado, repetido)','Membros','Em seguida'),
  ('checklist_items','As listas de conferência dos itens','item, texto, feito','Membros','Em seguida'),
  ('milestones','Os marcos e as entregas de versão','projeto, nome, data, itens ligados','Membros; stakeholder o visível','Em seguida'),
  ('sprints','Os ciclos curtos, quando usados','projeto, início, fim, meta','Membros','Em seguida'),
  ('custom_fields','Os campos personalizados dos itens','onde vale, nome, tipo, e os valores','Membros','Em seguida'),
  ('saved_views','As views salvas','pessoa, onde, filtros, agrupamento, ordenação','O dono da view','Em seguida'),
  ('automations','As automações','onde vale, quando acontecer, o que fazer','Master','Em seguida'),
  ('time_entries','O tempo registrado','item, pessoa, início, fim, origem (cronômetro ou foco)','Membros e Master','Em seguida'),
  ('comments','Os comentários em qualquer registro','onde está, autor, texto, visível ao cliente','Quem vê o registro','Em seguida'),
  ('whiteboards','O canvas de cada projeto ou aplicação','de quem é, conteúdo, cards ligados a registros','Master e time','Em seguida'),
 ]),
 ('Comercial e custos',[
  ('services','O Catalog: cada serviço que a IT.IA vende','categoria, nome, descrição, entregáveis, frentes padrão, horas mínima e máxima, requisitos, SLA, checklist, ativo','Master e time','Primeiro'),
  ('service_pricing','Os modelos de cobrança de cada serviço','serviço, modelo (preço fechado, hora, marcos, implantação, mensalidade, banco de horas, por usuário, faixas, uso, valor, sucesso, manutenção, repasse), parâmetros','Master','Primeiro'),
  ('pricing_rules','As regras de cálculo, com histórico','regime, impostos, encargos, horas, faturável, margem, contingência, multiplicadores, câmbio, vigência','Master','Primeiro'),
  ('contracts','As receitas: o que cada cliente paga','cliente, serviço, modelo, valor, recorrência, início, fim','Master','Primeiro'),
  ('cost_items','Os custos técnicos de cada cliente','cliente, aplicação, fornecedor, categoria, recorrência, moeda, valor, plano, limite, próximo plano, repasse e taxa','Master','Primeiro'),
  ('cost_usage','O uso de cada custo, mês a mês','item, mês, quantidade usada, valor pago','Master','Primeiro'),
  ('people_costs','O custo de cada pessoa do time','pessoa, vínculo (CLT, PJ, estágio, sócio), salário ou valor, benefícios, vigência','Só o Master','Primeiro'),
  ('op_costs','Os custos da operação interna','item, categoria, valor, moeda, recorrência, meses de depreciação','Master','Primeiro'),
  ('fx_rates','O câmbio de cada dia','moeda, data, valor','Master','Em seguida'),
  ('cost_forecasts','As previsões calculadas','item ou projeto, mês, valor previsto, mês em que chega ao limite','Master','Em seguida'),
 ]),
 ('Atendimento e agentes',[
  ('requests','Os pedidos dos stakeholders','cliente, onde, tipo, gravidade, status, contexto capturado, item gerado','Master e o stakeholder que pediu','Depois'),
  ('request_messages','A conversa de cada pedido, inclusive com a IA','pedido, autor, texto, áudio e transcrição, anexos','Master e o stakeholder que pediu','Depois'),
  ('agents','Os agentes do Agent Studio','nome, instruções, fontes de conhecimento, ferramentas, permissões','Master','Depois'),
  ('agent_runs','O registro do que cada agente fez','agente, quando, o que fez, resultado','Master','Depois'),
 ]),
]
h.append("""      <div class="painel-aba" role="tabpanel" id="pn-modelo" aria-labelledby="aba-modelo" hidden>
        <p class="intro">O """+T('Data model','modelo de dados: a lista das tabelas do banco e o que cada uma guarda')+""" proposto para o banco do projeto, aguardando aprovação. A coluna Quem vê vira as regras de """+T('RLS','regra no banco que decide quem vê cada linha')+""".</p>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:16%"><col style="width:22%"><col style="width:32%"><col style="width:18%"><col style="width:12%"></colgroup>
          <thead><tr><th scope="col">Tabela</th><th scope="col">O que guarda</th><th scope="col">Campos principais</th><th scope="col">Quem vê</th><th scope="col">Quando</th></tr></thead>
          <tbody>""")
for grupo,linhas in MODELO:
    h.append('            <tr class="grupo"><th scope="rowgroup" colspan="5">%s</th></tr>'%grupo)
    for tb,o,c,q,w in linhas:
        h.append('            <tr><th scope="row"><code>%s</code></th><td>%s</td><td class="sec">%s</td><td>%s</td><td>%s</td></tr>'%(tb,o,c,q,w))
h.append("""          </tbody>
        </table></div>
      </div>""")

# ficha
h.append('''      <div class="painel-aba" role="tabpanel" id="pn-ficha" aria-labelledby="aba-ficha" hidden>
        <p class="intro">O modelo da '''+T('Tech sheet','ficha técnica')+''' que todo projeto e toda aplicação têm. A aplicação '''+T('Inherits','herda: já nasce com o que o projeto definiu')+''' da ficha do projeto e muda só o que for diferente.</p>
        <div class="tabela-rolo"><table class="tabela">
          <colgroup><col style="width:20%"><col style="width:22%"><col style="width:58%"></colgroup>
          <thead><tr><th scope="col">Seção</th><th scope="col">O que é</th><th scope="col">Campos</th></tr></thead>
          <tbody>''')
for t,campos in FICHA:
    tt = T(t,FICHA_EXPL[t]) if t in FICHA_EXPL else t
    ex = FICHA_EXPL.get(t,'')
    ex = ex[0].upper()+ex[1:] if ex else {'Identificação':'Os dados básicos','Anexos e anotações':'Arquivos e textos livres'}.get(t,'')
    h.append('            <tr><th scope="row">%s</th><td class="sec">%s</td><td><ul class="em-linha">%s</ul></td></tr>'%(tt,ex,''.join('<li>%s</li>'%c for c in campos)))
h.append('          </tbody>\n        </table></div>\n      </div>\n    </section>')

s2=re.sub(r'    <section class="conteudo" id="tela-playbook".*?</section>','\n'.join(h),s,count=1,flags=re.S)
assert s2!=s
s=s2
# css: remove velhos e adiciona tabela
css_novo='''  .tabela-rolo{overflow-x:auto;border:1px solid var(--border-default)}
  .tabela{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;line-height:1.5}
  .tabela thead th{position:sticky;top:0;background:var(--preto);color:var(--branco);text-align:left;vertical-align:bottom;
    padding:12px 16px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;border-right:1px solid var(--grafite)}
  .tabela thead th:last-child{border-right:0}
  .tabela tbody th,.tabela td{padding:14px 16px;text-align:left;vertical-align:top;border-top:1px solid var(--border-default);border-right:1px solid var(--border-default)}
  .tabela tbody th:last-child,.tabela td:last-child{border-right:0}
  .tabela tbody th{font-family:var(--font-display);font-size:15px;font-weight:600;line-height:1.3}
  .tabela tbody tr:nth-child(even){background:var(--preto-04)}
  .tabela tbody tr:hover{background:rgba(5,5,6,.07)}
  .tabela tr.destaque th:first-child{box-shadow:inset 3px 0 0 var(--vermelho)}
  .tabela .sec{color:var(--text-secondary)}
  .tabela ul{margin:0;padding-left:18px;display:grid;gap:4px}
  .tabela ul.em-linha{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:6px}
  .tabela ul.em-linha li{border:1px solid var(--border-default);padding:2px 8px;font-size:13px;background:var(--branco)}
  .tabela tr.grupo th{background:var(--carvao);color:var(--branco);font-family:var(--font-body);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;padding:10px 16px}
  .tabela code{font-family:var(--font-mono);font-size:13px;font-weight:500}
  .sub{margin:40px 0 16px;font-family:var(--font-display);font-size:18px;font-weight:600}
'''
s=re.sub(r'  \.regras\{.*?(?=  @media \(max-width: 960px\))', lambda m: css_novo, s, count=1, flags=re.S)
s=s.replace('  @media (max-width: 960px){\n    .avisos{grid-template-columns:1fr}\n  }\n','')
s=s.replace('    .regra{grid-template-columns:1fr;gap:6px}\n','    .tabela{table-layout:auto;min-width:720px}\n')
open(f,'w',encoding='utf-8').write(s)
print('ok')
