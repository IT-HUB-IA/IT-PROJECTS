import html
f='sistema.html'; s=open(f,encoding='utf-8').read()
def rep(a,b):
    global s; assert s.count(a)==1,(a[:60],s.count(a)); s=s.replace(a,b)
def I(t):
    t=html.escape(t,quote=True)
    return '<button class="info" type="button" data-info="%s" aria-label="O que é: %s">i</button>'%(t,t)
def T(term,expl):  # termo + i
    return html.escape(term)+I(term+' ('+expl+')')

# ---------------- dados ----------------
REGRAS=[
 ('Um banco só', T('Single database','um banco de dados só')+' para o sistema inteiro da IT.IA. Nenhum projeto ganha um Supabase separado.', 'Tudo conversa com tudo: o Overview, a busca e a IA enxergam todos os projetos sem juntar bancos diferentes.'),
 ('Tabelas comuns com o código do projeto', 'Tarefas, frentes, comentários, tempo, pedidos e fichas ficam em tabelas únicas, e cada linha carrega o '+T('project_id','código do projeto a que a linha pertence')+'.', 'Projeto novo não exige programação: é só um código novo, e board, calendário e painéis já funcionam.'),
 ('Pasta própria para o exclusivo', 'O que só existe num projeto (as tabelas do sistema do BL, por exemplo) fica num '+T('Schema','pasta de tabelas dentro do mesmo banco')+' só daquele projeto.', 'Separa o que é particular sem soltar o projeto do resto.'),
 ('Cada um vê só o que é seu', 'A '+T('RLS','Row Level Security: regra no banco que decide quem vê cada linha')+' garante que o cliente só enxerga o próprio projeto e o dev só os projetos em que está.', 'A segurança fica no banco, não só na tela. Mesmo que uma tela erre, o dado não vaza.'),
 ('Permissão explícita em toda tabela nova', 'Toda tabela nova recebe '+T('GRANT','a liberação da operação: ler, gravar, apagar')+' além da RLS. A RLS filtra linhas; o GRANT libera a operação.', 'Faltando um dos dois, a tela quebra, inclusive consultas de outras tabelas que dependem dela.'),
 ('Fonte única da verdade', 'Cada informação existe uma vez só. Board, tabela, calendário e canvas são '+T('Views','formas de ver o mesmo dado')+', e todas editam o mesmo registro.', 'Mudou num lugar, mudou em todos. Nunca existem duas versões da mesma tarefa.'),
 ('Clientes cadastrados aqui', 'Todo cliente da IT.IA fica na tabela de '+T('Clients','clientes')+' deste sistema, inclusive a Blanco &amp; Lisboa, que entra como cliente do tipo holding. As empresas do grupo (YOU, Realizze, BEEC, Gestão de Lojas e Cobrança 40%) não são clientes: são produtos dentro do projeto BL, e o cliente é a Blanco &amp; Lisboa.', 'A IT.IA atende clientes de dentro e de fora do grupo com a mesma estrutura, e o stakeholder de cada cliente vê só o que é dele.'),
 ('Estrutura por ligação, não por etiqueta', 'Onde cada coisa mora (a holding do cliente, o projeto da aplicação) é uma '+T('Relationship','ligação fixa entre dois registros no banco')+'. Ligação não se apaga, só se move.', 'Se alguém apagar ou renomear uma etiqueta, nada perde o lugar.'),
 ('Etiquetas livres e automáticas', 'As '+T('Tags','etiquetas')+' são criadas, editadas e apagadas à vontade. As '+T('System tags','etiquetas automáticas, geradas a partir das ligações')+' (Holding e Projeto) aparecem com cadeado e ninguém apaga.', 'Você vê tudo como etiqueta, e a estrutura continua protegida.'),
 ('O ID nunca muda', 'Cada registro tem um '+T('ID','o código interno do banco, que nunca muda')+' e um '+T('Path','o caminho legível, como BL › YOU › Java Fiscal')+'. As ligações usam o ID; o caminho se refaz sozinho quando algo é movido.', 'Mover uma aplicação para outro projeto não quebra tarefas, comentários, tempo nem provas.'),
 ('Product é opcional', 'Entre o projeto e a aplicação pode existir um '+T('Product','produto: um conjunto de aplicações de uma mesma unidade de negócio')+'. Projeto simples vai direto para a aplicação.', 'Serve tanto para um app sozinho quanto para um projeto como o BL, com várias empresas e vários apps.'),
 ('Nunca apagar, arquivar', 'Excluir vira '+T('Soft delete','marcar como arquivado em vez de apagar de verdade')+'. O registro sai da vista, mas continua no banco.', 'Dá para desfazer, auditar e recuperar histórico.'),
 ('Tudo registrado', 'Toda mudança grava quem fez, quando, e o antes e o depois, no '+T('Audit log','registro de quem fez o quê')+'.', 'Responde "quem mudou isso?" sem depender de memória.'),
 ('Mudança de estrutura só por migration', 'Criar ou alterar tabela, função ou regra sempre vira um arquivo de '+T('Migration','roteiro versionado de mudança na estrutura do banco')+', aplicado uma vez só e guardado no repositório.', 'A estrutura do banco fica reproduzível, e ninguém aplica a mesma mudança duas vezes.'),
 ('Uma versão por função', 'Ao mudar uma função do banco, a versão antiga é substituída, nunca somada. Nada de '+T('Overload','duas funções com o mesmo nome e parâmetros diferentes')+'.', 'Duas versões juntas já causaram erros reais de "função não é única" no ERP.'),
 ('Segredos fora do banco e do código', 'Senha, token e chave de API nunca ficam escritos. O sistema guarda só o nome e onde buscar, no '+T('Secrets catalog','lista de segredos com nome e local, sem o valor')+'.', 'Um arquivo vazado não entrega acesso a nada.'),
 ('Hora sempre certa', 'O banco grava em '+T('UTC','o horário padrão mundial')+' e a tela mostra no horário de São Paulo.', 'Prazos e relatórios nunca ficam com 3 horas de diferença.'),
 ('Evento repetido não duplica', 'Integrações e automações são '+T('Idempotent','processar a mesma coisa duas vezes dá o mesmo resultado de uma vez')+'.', 'Um aviso que chega duas vezes não cria duas tarefas nem duas cobranças.'),
 ('Produção é só leitura para agentes', 'Agentes de IA leem o banco de '+T('Production','o sistema em uso real pelos clientes')+' com permissão mínima. Qualquer escrita, publicação ou migração exige o "sim" do William.', 'O sistema em uso nunca é alterado por engano.'),
 ('Memória dos agentes separada', 'O que os agentes aprendem fica no '+T('Agent Core','o banco de memória técnica dos agentes')+', nunca no banco do produto.', 'Dado de cliente e anotação de IA nunca se misturam.'),
 ('Dinheiro sempre com moeda e data', 'Todo valor guarda a moeda (real ou dólar) e a data. Custos em dólar usam o '+T('Exchange rate','câmbio do dia')+' registrado, e cada proposta guarda a regra de cálculo que valia quando foi feita.', 'O custo e o preço de um mês antigo não mudam quando o câmbio ou uma regra muda hoje.'),
 ('Salários protegidos', 'Salário, benefícios e custo de cada pessoa ficam numa tabela que só o Master enxerga.', 'O time trabalha com o custo hora médio sem ver o salário dos colegas.'),
 ('Isolamento provado com dois clientes', 'Toda regra de acesso é testada com duas empresas de teste: uma não pode ver nada da outra.', 'Só teste com duas contas prova que o isolamento funciona.'),
]

ETAPAS=[
 ('Intake', 'entrada e triagem do pedido', 'Triagem',
  ['Quem pediu, qual sistema e qual empresa','Tipo: projeto novo, projeto em andamento, melhoria ou incidente','Urgência e autorização mínima para começar'],
  'Ficha do pedido'),
 ('Scoping', 'recorte do que entra e do que não entra', 'Supervisor · Arquitetura e mapeamento',
  ['Objetivo, perfis de usuário e critérios de aceite','Repositório, banco e ambiente confirmados, nunca deduzidos pelo nome','O que fica de fora, por escrito'],
  'Escopo aprovado'),
 ('Discovery', 'levantamento do que existe e de quem usa', 'Investigação do legado · Produto',
  ['Código e banco confrontados, um não substitui o outro','Quem usa, como usa e as jornadas de cada perfil','Cada achado marcado como fato, inferência, hipótese ou proposta'],
  'Dossiê atual e matriz de evidências'),
 ('Design', 'desenho da solução', 'Arquiteto · Banco de dados · Segurança · Impacto',
  ['Arquitetura, contratos de API e eventos, e modelo de dados','Regras de acesso (RLS e GRANT) desenhadas antes de criar','Quem mais é afetado pela mudança e como voltar atrás'],
  'Documento de arquitetura'),
 ('Planning', 'plano de execução', 'Supervisor · Dev líder · AI PO',
  ['Epics, stories e tasks com critério de aceite cada uma','Estimativa e datas previstas','Marcos e dependências ligados'],
  'Backlog priorizado'),
 ('Build', 'construção', 'Dev especialista',
  ['Mudança mínima e reversível','Teste escrito antes do código, quando se aplica','Só no repositório e ambiente autorizados'],
  'Código com testes passando'),
 ('QA &amp; Security', 'testes e segurança', 'QA · Segurança · Auditoria técnica',
  ['Testes funcionais, de integração e de regressão com evidência','Autorização conferida no servidor, segredos, dependências','Isolamento provado com dois clientes'],
  'Relatório de testes e segurança'),
 ('Verification', 'verificação final', 'Verificador final',
  ['Build, lint e testes rodados, com a saída real','Checklist completo e riscos que sobram declarados','Requisitos obrigatórios da aplicação cumpridos'],
  'Relatório de verificação'),
 ('Approval', 'aprovação do William', 'William',
  ['Push, merge, deploy e migração só com o "sim" dele, por ação','Decisões pendentes respondidas'],
  'Aprovação registrada'),
 ('Release', 'entrega no ar', 'Dev líder · Impacto e regressão',
  ['Plano de migração com paridade e rollback','Convivência com o sistema antigo, sem desligar nada automaticamente','Changelog publicado para o cliente'],
  'Versão no ar'),
 ('Retrospective', 'aprendizado depois da entrega', 'Aprendizado e prevenção',
  ['O que deu errado, a causa e o controle que evita repetir','Lições gravadas na memória, sem apagar as antigas'],
  'Lições registradas'),
]

FICHA=[
 ('Identificação', ['Nome e código do projeto ou aplicação','Cliente e stakeholders','Responsável técnico e time','Status, datas de início e entrega prevista','Tipo: do zero ou em andamento']),
 ('Visual identity', ['Manual de identidade (PDF)','Logos e ícones (arquivos)','Tokens: cores, fontes, espaçamentos e raios','Link do design system','Telas de referência e prints']),
 ('Stack', ['Linguagens e versões (ex.: Java 21)','Frameworks (ex.: Spring Boot, JavaFX)','Bibliotecas principais','Ferramenta de build (ex.: Maven, Gradle)','Plataformas: desktop, web, mobile']),
 ('Repositories', ['Repositório e branch principal','Convenção de branch e de commit','Onde fica a documentação técnica']),
 ('Environments', ['Desenvolvimento, homologação e produção','Endereços de cada ambiente (sem senha)','Quem pode publicar em cada um']),
 ('Database', ['Banco e schema do projeto','Tabelas principais e o que guardam','Regras de acesso (RLS)','Rotinas agendadas e gatilhos','Política de backup']),
 ('APIs', ['APIs próprias: rotas e para que servem','APIs de terceiros consumidas','Tipo de autenticação','Links da documentação']),
 ('Integrations', ['Sistemas ligados (ex.: WhatsGW, Conexa, Gmail)','Webhooks recebidos e enviados','Base mestre de clientes: campos consumidos']),
 ('Secrets catalog', ['Nome de cada segredo e onde ele fica','Quem tem acesso','Data da última troca']),
 ('Business rules', ['Regras de negócio do cliente','Regras por nível de acesso','Exceções e casos especiais']),
 ('Decisions', ['Registro de decisões: o quê, quando, por quê e quem decidiu','Alternativas descartadas']),
 ('Baseline requirements', ['Painel do cliente','Botão de feedback','Login e níveis de acesso','Registro de quem fez o quê','Changelog','Backup e LGPD','Sinal de funcionamento']),
 ('Anexos e anotações', ['Arquivos de qualquer tipo','Anotações livres','Glossário do projeto']),
 ('Custom fields', ['Qualquer campo novo que o projeto precisar: texto, número, data, lista, arquivo, link ou pessoa']),
]
FICHA_EXPL={'Visual identity':'identidade visual','Stack':'conjunto de tecnologias usadas','Repositories':'onde fica guardado o código','Environments':'ambientes onde o sistema roda','Database':'banco de dados','APIs':'canais de conversa entre sistemas','Integrations':'ligações com outros sistemas','Secrets catalog':'lista de segredos, sem os valores','Business rules':'regras de negócio','Decisions':'decisões tomadas','Baseline requirements':'requisitos mínimos obrigatórios em todo sistema','Custom fields':'campos personalizados'}
ETAPA_EXPL={'Intake':'entrada e triagem do pedido','Scoping':'recorte do escopo','Discovery':'levantamento do que existe','Design':'desenho da solução','Prototype':'protótipo','Planning':'planejamento','Build':'construção','QA &amp; Security':'testes e segurança','Verification':'verificação final','Approval':'aprovação','Release':'entrega no ar','Retrospective':'retrospectiva: aprender com a entrega'}

# ---------------- HTML ----------------
h=[]
h.append('''    <section class="conteudo" id="tela-playbook" aria-labelledby="titulo-pb" hidden>
      <div class="eyebrow"><i class="ponto" aria-hidden="true"></i>03 — Playbook</div>
      <h1 id="titulo-pb"><span>Playbook</span>'''+I('Playbook (manual de regras da operação): o que vale para todo projeto, sempre.')+'''</h1>
      <p class="lead">As regras que todo projeto da IT.IA segue, do jeito que o banco se comporta até as etapas que nenhum projeto pode pular, mesmo com uma pessoa só no time.</p>

      <div class="abas" role="tablist" aria-label="Seções do Playbook">
        <button class="aba" type="button" role="tab" id="aba-dados" aria-controls="pn-dados" aria-selected="true">Estrutura de dados</button>
        <button class="aba" type="button" role="tab" id="aba-etapas" aria-controls="pn-etapas" aria-selected="false">Stage gates</button>
        <button class="aba" type="button" role="tab" id="aba-ficha" aria-controls="pn-ficha" aria-selected="false">Tech sheet</button>
      </div>
''')
# painel dados
h.append('      <div class="painel-aba" role="tabpanel" id="pn-dados" aria-labelledby="aba-dados">')
h.append('        <p class="intro">'+str(len(REGRAS))+' regras que o banco segue. Valem para todos os projetos e aplicações, sem exceção.</p>')
h.append('        <ol class="regras">')
for i,(t,d,p) in enumerate(REGRAS,1):
    h.append('          <li class="regra"><span class="regra-n">D%02d</span><div class="regra-c"><h3>%s</h3><p>%s</p><p class="porque"><b>Por quê</b> %s</p></div></li>'%(i,t,d,p))
h.append('        </ol>\n      </div>')
# painel etapas
h.append('      <div class="painel-aba" role="tabpanel" id="pn-etapas" aria-labelledby="aba-etapas" hidden>')
h.append('        <p class="intro">Todo projeto passa por estas '+str(len(ETAPAS))+' '+T('Stage gates','etapas com trava: só avança quando a etapa anterior entregou o que devia')+', na ordem. Cada etapa tem uma '+T('Lens','lente: o papel de especialista que avalia aquela parte')+' responsável.</p>')
h.append('''        <div class="avisos">
          <div class="aviso"><h3>Mesmo com uma pessoa só</h3><p>Quem está sozinho no time veste todas as lentes, uma de cada vez. A etapa não some porque o time é pequeno.</p></div>
          <div class="aviso"><h3>Projeto do zero ou em andamento</h3><p>'''+T('Greenfield','projeto que começa do zero')+' começa no Intake. '+T('Brownfield','projeto que já existe e é trazido em andamento')+''' também começa no Intake, e no Discovery marca, com evidência, as etapas que já estão cumpridas.</p></div>
          <div class="aviso"><h3>Pular só com justificativa</h3><p>Um item que não se aplica vira '''+T('Waiver','dispensa registrada: não se aplica, com o motivo por escrito')+''', com o motivo e quem aprovou. Nada é pulado em silêncio.</p></div>
        </div>
        <ol class="etapas">''')
for i,(n,x,lente,itens,ent) in enumerate(ETAPAS,1):
    h.append('          <li class="etapa"><div class="etapa-topo"><span class="etapa-n">%02d</span><h3>%s%s</h3></div><p class="etapa-lente"><span>Lente</span> %s</p><ul>%s</ul><p class="etapa-ent"><span>Entrega</span> %s</p></li>'%(
        i,n,I(n.replace('&amp;','&')+' ('+ETAPA_EXPL[n]+')'),lente,''.join('<li>%s</li>'%it for it in itens),ent))
h.append('        </ol>')
h.append('        <p class="nota">Estas etapas e lentes vêm dos agentes da IT.IA (Ultra-Agente e Investigação do Legado): os 14 papéis viram lentes, e o fluxo escopo, fontes, uso, evidências, desenho, protótipo, verificação e entrega vira as travas de todo projeto.</p>')
h.append('      </div>')
# painel ficha
h.append('      <div class="painel-aba" role="tabpanel" id="pn-ficha" aria-labelledby="aba-ficha" hidden>')
h.append('        <p class="intro">O modelo da '+T('Tech sheet','ficha técnica')+' que todo projeto e toda aplicação têm. A aplicação '+T('Inherits','herda: já nasce com o que o projeto definiu')+' da ficha do projeto e muda só o que for diferente.</p>')
h.append('        <div class="fichas">')
for t,campos in FICHA:
    tt = T(t,FICHA_EXPL[t]) if t in FICHA_EXPL else t
    h.append('          <div class="ficha"><h3>%s</h3><ul>%s</ul></div>'%(tt,''.join('<li>%s</li>'%c for c in campos)))
h.append('        </div>\n      </div>\n    </section>')
rep('''    </section>
  </main>''','''    </section>

'''+'\n'.join(h)+'''
  </main>''')

# menu
rep('''            <span class="item-nome">Operações</span>
          </button>
        </li>''','''            <span class="item-nome">Operações</span>
          </button>
        </li>
        <li>
          <button class="item" type="button" data-nome="Playbook" data-tela="playbook">
            <span class="item-ico">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
                <path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"></path><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"></path>
              </svg>
            </span>
            <span class="item-nome">Playbook</span>
          </button>
        </li>''')

# css
rep('''  @media (max-width: 720px){''','''  /* ---------- Playbook ---------- */
  .abas{display:flex;gap:0;margin-top:40px;border-bottom:1px solid var(--border-default);overflow-x:auto}
  .aba{height:44px;padding:0 20px;background:transparent;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;
    font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary);white-space:nowrap;
    transition:color var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)}
  .aba:hover{color:var(--text-primary)}
  .aba[aria-selected="true"]{color:var(--text-primary);border-bottom-color:var(--vermelho)}
  .painel-aba{padding-top:32px}
  .intro{margin:0 0 24px;max-width:70ch;font-size:15px;color:var(--text-secondary)}
  h3{margin:0;font-family:var(--font-display);font-size:18px;font-weight:600;line-height:1.3}

  .regras{list-style:none;margin:0;padding:0;border-top:1px solid var(--border-default)}
  .regra{display:grid;grid-template-columns:64px minmax(0,1fr);gap:16px;padding:20px 0;border-bottom:1px solid var(--border-default)}
  .regra-n{font-family:var(--font-mono);font-size:12px;letter-spacing:.1em;color:var(--text-secondary);padding-top:3px}
  .regra-c{display:grid;gap:6px;max-width:78ch}
  .regra-c p{margin:0;font-size:14px}
  .porque{color:var(--text-secondary)}
  .porque b{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--text-primary);margin-right:8px}

  .avisos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default);margin-bottom:32px}
  .aviso{background:var(--preto);color:var(--branco);padding:20px;display:grid;gap:8px;align-content:start}
  .aviso p{margin:0;font-size:14px;color:var(--nevoa)}
  .aviso .info{border-color:var(--grafite);color:var(--nevoa)}

  .etapas{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
  .etapa{border-top:3px solid var(--nevoa);padding-top:16px;display:grid;gap:10px;align-content:start}
  .etapa:nth-child(10){border-top-color:var(--vermelho)}
  .etapa-topo{display:flex;align-items:baseline;gap:12px}
  .etapa-n{font-family:var(--font-mono);font-size:12px;color:var(--text-secondary)}
  .etapa-lente,.etapa-ent{margin:0;font-size:13px}
  .etapa-lente span,.etapa-ent span{display:block;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--text-secondary);margin-bottom:2px}
  .etapa ul,.ficha ul{margin:0;padding-left:18px;display:grid;gap:4px;font-size:14px}
  .etapa-ent{padding-top:10px;border-top:1px solid var(--border-default)}
  .nota{margin:32px 0 0;padding-top:16px;border-top:1px solid var(--border-default);font-size:13px;color:var(--text-secondary);max-width:80ch}

  .fichas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:var(--border-default);border:1px solid var(--border-default)}
  .ficha{background:var(--branco);padding:20px;display:grid;gap:12px;align-content:start}

  @media (max-width: 960px){
    .etapas,.fichas{grid-template-columns:repeat(2,minmax(0,1fr))}
    .avisos{grid-template-columns:1fr}
  }
  @media (max-width: 720px){
    .etapas,.fichas{grid-template-columns:1fr}
    .regra{grid-template-columns:48px minmax(0,1fr)}''')

# js abas
rep("  document.addEventListener('keydown', e => { if (e.key === 'Escape') esconderInfo(); });","""  document.addEventListener('keydown', e => { if (e.key === 'Escape') esconderInfo(); });

  // Abas do Playbook
  const abas = Array.from(document.querySelectorAll('.aba'));
  const CHAVE_ABA = 'ciclodev-aba-playbook';
  function abrirAba(id){
    const alvo = abas.find(a => a.id === id) || abas[0];
    abas.forEach(a => {
      const sel = a === alvo;
      a.setAttribute('aria-selected', String(sel));
      a.tabIndex = sel ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !sel;
    });
    try { localStorage.setItem(CHAVE_ABA, alvo.id); } catch(e){}
  }
  let abaInicial = null; try { abaInicial = localStorage.getItem(CHAVE_ABA); } catch(e){}
  abrirAba(abaInicial);
  abas.forEach((a, i) => {
    a.addEventListener('click', () => abrirAba(a.id));
    a.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const prox = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      abrirAba(prox.id); prox.focus();
    });
  });""")
open(f,'w',encoding='utf-8').write(s)
print('ok')
