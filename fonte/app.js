(function(){
'use strict';

/* ================= utilidades ================= */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let seq = 0;
const uid = p => (p || 'x') + '_' + Date.now().toString(36) + (seq++).toString(36);
const HOJE = (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0'); };
const dAdd = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const dIso = n => iso(dAdd(HOJE, n));
const parse = s => { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DSEM = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const fmt = s => { const d = parse(s); return d ? String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') : ''; };
const fmtLongo = d => d.getDate() + ' de ' + MESES[d.getMonth()];
const I = t => { t = (window.EXPL && window.EXPL[t]) || t; return '<button class="info" type="button" data-info="' + esc(t) + '" aria-label="O que é: ' + esc(t) + '">i</button>'; };
const T = (termo, expl) => esc(termo) + I(termo + ' (' + expl + ')');
const ICO = {
  seta: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><path d="M9 6l6 6-6 6"/></svg>',
  mais: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M12 5v14M5 12h14"/></svg>',
  fechar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cadeado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  clip: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></svg>'
};

/* ================= vocabulário ================= */
const STATUS = [
  {id:'backlog', nome:'Backlog', expl:'na fila, ainda não planejado'},
  {id:'todo', nome:'To Do', expl:'a fazer'},
  {id:'doing', nome:'In Progress', expl:'em andamento'},
  {id:'review', nome:'In Review', expl:'em revisão'},
  {id:'blocked', nome:'Blocked', expl:'bloqueado, esperando algo'},
  {id:'done', nome:'Done', expl:'concluído'}
];
const stNome = id => (STATUS.find(s => s.id === id) || {nome:id}).nome;

const PRIOS = [{id:'highest',nome:'Highest',expl:'urgentíssima'},{id:'high',nome:'High',expl:'alta'},{id:'medium',nome:'Medium',expl:'média'},{id:'low',nome:'Low',expl:'baixa'}];
const prioNome = id => (PRIOS.find(p => p.id === id) || {nome:id}).nome;
const TIPOS = [{id:'epic',nome:'Epic',expl:'grande entrega'},{id:'story',nome:'Story',expl:'funcionalidade vista pelo usuário'},{id:'task',nome:'Task',expl:'tarefa'},{id:'subtask',nome:'Sub-task',expl:'subtarefa'},{id:'bug',nome:'Bug',expl:'defeito'}];
const tipoNome = id => (TIPOS.find(t => t.id === id) || {nome:id}).nome;
const EST = [{id:'active',nome:'Active',expl:'ativo'},{id:'on_hold',nome:'On Hold',expl:'pausado'},{id:'done',nome:'Done',expl:'concluído'},{id:'archived',nome:'Archived',expl:'arquivado'}];
const estNome = id => (EST.find(e => e.id === id) || {nome:id}).nome;
/* ---- ícones com cor: status, tipo e prioridade ---- */
const SV = (d, extra) => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + d + '</svg>';
const ICO_ST = {
  backlog: SV('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>'),
  todo: SV('<circle cx="12" cy="12" r="9"/>'),
  doing: SV('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>'),
  review: SV('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  blocked: SV('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  done: SV('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff"/>')
};
const ICO_TIPO = {
  epic: SV('<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>'),
  story: SV('<path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/>'),
  task: SV('<rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" stroke="none"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff"/>'),
  subtask: SV('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8v5h8M13 10l3 3-3 3"/>'),
  bug: SV('<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3" fill="#fff" stroke="none"/>')
};
const ICO_PRIO = {
  highest: SV('<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>'),
  high: SV('<path d="M6 15l6-6 6 6"/>'),
  medium: SV('<path d="M5 9h14M5 15h14"/>'),
  low: SV('<path d="M6 9l6 6 6-6"/>')
};
const stHTML = id => '<span class="st st-' + id + '">' + ICO_ST[id] + esc(stNome(id)) + '</span>';
const tipoHTML = (id, comNome) => '<span class="tp tp-' + id + '" title="' + esc(tipoNome(id)) + '">' + ICO_TIPO[id] + (comNome ? esc(tipoNome(id)) : '') + '</span>';
const prioHTML = (id, comNome) => '<span class="pr pr-' + id + '" title="Prioridade ' + esc(prioNome(id)) + '">' + ICO_PRIO[id] + (comNome ? esc(prioNome(id)) : '') + '</span>';
const MODOS = ['Aviso','Trava','Desligado'];
const PROVAS = ['Nenhuma','Captura de tela','Arquivo','Link','Texto','Aprovação de alguém'];
const NIVEIS = ['Livre','Automática','Com confirmação','Bloqueada'];
const FICHA = [
  ['Identificação','', ['Nome e código','Cliente e stakeholders','Responsável técnico e time','Status e datas','Do zero ou em andamento']],
  ['Visual identity','identidade visual', ['Manual de identidade','Logos e ícones','Tokens: cores, fontes, espaçamentos e raios','Link do design system','Telas de referência']],
  ['Stack','conjunto de tecnologias usadas', ['Linguagens e versões','Frameworks','Bibliotecas principais','Ferramenta de build','Plataformas']],
  ['Repositories','onde fica guardado o código', ['Repositório e branch principal','Convenção de branch e de commit','Documentação técnica']],
  ['Environments','ambientes onde o sistema roda', ['Desenvolvimento, homologação e produção','Endereços de cada ambiente, sem senha','Quem pode publicar em cada um']],
  ['Database','banco de dados', ['Banco e schema','Tabelas principais','Regras de acesso (RLS)','Rotinas agendadas e gatilhos','Política de backup']],
  ['APIs','canais de conversa entre sistemas', ['APIs próprias','APIs de terceiros','Tipo de autenticação','Links da documentação']],
  ['Integrations','ligações com outros sistemas', ['Sistemas ligados','Webhooks recebidos e enviados','Base de clientes: campos consumidos']],
  ['Secrets catalog','lista de segredos, sem os valores', ['Nome de cada segredo e onde fica','Quem tem acesso','Última troca']],
  ['Business rules','regras de negócio', ['Regras de negócio do cliente','Regras por nível de acesso','Exceções e casos especiais']],
  ['Decisions','decisões tomadas', ['Decisão, motivo, quem decidiu e quando','Alternativas descartadas']],
  ['Baseline requirements','requisitos mínimos obrigatórios em todo sistema', ['Painel do cliente','Botão de feedback','Login e níveis de acesso','Registro de quem fez o quê','Changelog','Backup e LGPD','Sinal de funcionamento']],
  ['Anexos e anotações','', ['Anotações livres','Glossário do projeto']]
];
const ETAPAS_MODELO = [
  ['Intake','entrada e triagem do pedido','Triagem',['Quem pediu, qual sistema e qual empresa','Tipo: projeto novo, em andamento, melhoria ou incidente','Urgência e autorização mínima para começar']],
  ['Scoping','recorte do escopo','Supervisor · Arquitetura e mapeamento',['Objetivo, perfis de usuário e critérios de aceite','Repositório, banco e ambiente confirmados','O que fica de fora, por escrito']],
  ['Discovery','levantamento do que existe','Investigação do legado · Produto',['Código e banco confrontados','Quem usa, como usa e as jornadas de cada perfil','Achados marcados como fato, inferência, hipótese ou proposta']],
  ['Design','desenho da solução','Arquiteto · Banco de dados · Segurança · Impacto',['Arquitetura, contratos de API e eventos, modelo de dados','Regras de acesso desenhadas antes de criar','Quem mais é afetado e como voltar atrás']],
  ['Planning','planejamento','Supervisor · Dev líder · AI PO',['Epics, stories e tasks com critério de aceite','Estimativa e datas previstas','Marcos e dependências ligados']],
  ['Build','construção','Dev especialista',['Mudança mínima e reversível','Teste escrito antes do código, quando se aplica','Só no repositório e ambiente autorizados']],
  ['QA & Security','testes e segurança','QA · Segurança · Auditoria técnica',['Testes funcionais, de integração e de regressão','Autorização no servidor, segredos e dependências','Isolamento provado com dois clientes']],
  ['Verification','verificação final','Verificador final',['Build, lint e testes rodados, com a saída real','Checklist completo e riscos que sobram declarados','Requisitos obrigatórios da aplicação cumpridos']],
  ['Approval','aprovação','William',['Push, merge, deploy e migração só com o "sim" dele','Decisões pendentes respondidas']],
  ['Release','entrega no ar','Dev líder · Impacto e regressão',['Plano de migração com paridade e rollback','Convivência com o sistema antigo','Changelog publicado para o cliente']],
  ['Retrospective','aprender com a entrega','Aprendizado e prevenção',['Causa do que deu errado e o controle que evita repetir','Lições gravadas na memória']]
];

/* ================= dados de exemplo ================= */
function semente(){
  const D = {v:2, clients:[], tags:[], tagLinks:[], projects:[], products:[], apps:[], ws:[], people:[], issues:[], sheets:{}, template:[], stages:{}, requests:[], agents:[], focus:null, statusCfg:{}, baseline:{}};
  D.people = [
    {id:'pe_w', nome:'William', funcao:'Master · Owner', skills:['Produto','Arquitetura','Java'], cap:40, acesso:'owner'},
    {id:'pe_a', nome:'Ana (exemplo)', funcao:'Dev', skills:['Java','JavaFX','Supabase'], cap:40, acesso:'dev'},
    {id:'pe_b', nome:'Bruno (exemplo)', funcao:'Dev', skills:['Flutter','APIs','QA'], cap:30, acesso:'dev'},
    {id:'pe_s', nome:'CEO da B&L (exemplo)', funcao:'Stakeholder', skills:[], cap:0, acesso:'stakeholder', escopo:'project:pj_bl'}
  ];
  D.tags = [
    {id:'tg_hold', nome:'Holding', cor:'#050506', cat:'Tipo', desc:'Empresa que controla outras empresas'},
    {id:'tg_cont', nome:'Contabilidade', cor:'#2E2E31', cat:'Segmento', desc:''},
    {id:'tg_cert', nome:'Certificados digitais', cor:'#2E2E31', cat:'Segmento', desc:''},
    {id:'tg_traf', nome:'Tráfego pago', cor:'#2E2E31', cat:'Segmento', desc:''},
    {id:'tg_cob', nome:'Cobrança', cor:'#2E2E31', cat:'Segmento', desc:''},
    {id:'tg_loj', nome:'Varejo', cor:'#2E2E31', cat:'Segmento', desc:''},
    {id:'tg_prio', nome:'Prioritário', cor:'#FF0000', cat:'Relacionamento', desc:'Cliente com atenção redobrada'}
  ];
  D.clients = [
    {id:'cl_bl', nome:'Blanco & Lisboa', tipo:'holding', holding:null, doc:'', status:'active'}
  ];
  D.tagLinks = [['tg_hold','client','cl_bl'],['tg_prio','client','cl_bl'],['tg_cont','product','pr_you'],['tg_cert','product','pr_rz'],['tg_traf','product','pr_beec'],['tg_loj','product','pr_gl'],['tg_cob','product','pr_40']].map(([t,y,i]) => ({tag:t, tipo:y, id:i}));
  D.projects = [{id:'pj_bl', client:'cl_bl', nome:'BL', status:'active', motivo:'', origem:'brownfield', inicio:dIso(-75), alvo:dIso(150)}];
  D.products = [
    {id:'pr_bl', project:'pj_bl', client:'cl_bl', nome:'Blanco & Lisboa', status:'active'},
    {id:'pr_you', project:'pj_bl', client:'cl_bl', nome:'YOU Contabilidade', status:'active'},
    {id:'pr_rz', project:'pj_bl', client:'cl_bl', nome:'Realizze', status:'active'},
    {id:'pr_beec', project:'pj_bl', client:'cl_bl', nome:'BEEC', status:'on_hold', motivo:'Aguardando definição do escopo de tráfego pago'},
    {id:'pr_gl', project:'pj_bl', client:'cl_bl', nome:'Gestão de Lojas', status:'active'},
    {id:'pr_40', project:'pj_bl', client:'cl_bl', nome:'Cobrança 40%', status:'active'}
  ];
  D.apps = [
    ['ap_javabl','pr_bl','Java BL','desktop'],['ap_ceo','pr_bl','App celular do CEO','mobile'],
    ['ap_fiscal','pr_you','Java Fiscal','desktop'],['ap_fin','pr_you','Java Financeiro','desktop'],['ap_pes','pr_you','Java Pessoal','desktop'],['ap_soc','pr_you','Java Societário','desktop'],['ap_cli','pr_you','App Área do Cliente','mobile'],
    ['ap_rz','pr_rz','Java Realizze','desktop'],['ap_beec','pr_beec','Java BEEC','desktop'],['ap_gl','pr_gl','Java Gestão de Lojas','desktop'],['ap_40','pr_40','Java Cobrança 40%','desktop']
  ].map(([id,pr,nome,plat]) => ({id, project:'pj_bl', product:pr, nome, plataforma:plat, status: pr === 'pr_beec' ? 'on_hold' : 'active', motivo: pr === 'pr_beec' ? 'Pausado junto com o produto BEEC' : ''}));
  D.apps.forEach(a => {
    ['Frontend','Backend','Database'].concat(a.id === 'ap_javabl' ? ['AI'] : []).forEach(n => D.ws.push({id:'ws_' + a.id.slice(3) + '_' + n.toLowerCase(), app:a.id, nome:n, status:'active', wip:3}));
  });
  const w = (app, n) => 'ws_' + app.slice(3) + '_' + n;
  let k = 0;
  const it = (ws, tipo, titulo, status, prio, resp, ini, fim, est, extra) => {
    const o = Object.assign({id:'is_' + (++k), ws, tipo, titulo, desc:'', status, prio, resp, rep:'pe_w', ini:dIso(ini), fim:dIso(fim), alvo:dIso(fim + (prio === 'highest' ? 0 : 3)), est, vis:'interno', pai:null, check:[], links:[], coments:[], tempo:[], bloco:null, criado:dIso(ini - 5), feito:null}, extra || {});
    if (status === 'done' && !o.feito) o.feito = dIso(Math.min(fim, 0));
    D.issues.push(o); return o;
  };
  const e1 = it(w('ap_javabl','database'),'epic','Ficha única do cliente no banco BL','doing','highest','pe_w',-60,20,40,{vis:'cliente'});
  it(w('ap_javabl','database'),'task','Tabela de clientes com vínculo ativo e inativo','done','high','pe_a',-58,-40,12,{pai:e1.id,feito:dIso(-41)});
  it(w('ap_javabl','database'),'task','Regras de acesso por empresa (RLS)','done','high','pe_a',-40,-25,10,{pai:e1.id,feito:dIso(-26)});
  const t4 = it(w('ap_javabl','backend'),'story','API de transferência de clientes para os Javas','doing','highest','pe_w',-20,6,16,{pai:e1.id,vis:'cliente',check:[{t:'Contrato da API aprovado',f:true},{t:'Autenticação por token',f:true},{t:'Teste com duas empresas',f:false}]});
  const t5 = it(w('ap_javabl','backend'),'task','Webhook de atualização de cadastro','blocked','high','pe_a',-10,4,8,{pai:e1.id});
  t5.links.push({tipo:'Is blocked by', alvo:t4.id});
  it(w('ap_javabl','frontend'),'story','Painel central do CEO','review','high','pe_w',-15,2,14,{vis:'cliente'});
  it(w('ap_javabl','frontend'),'task','Login e níveis de acesso','done','medium','pe_a',-50,-30,10,{feito:dIso(-31)});
  it(w('ap_javabl','ai'),'epic','Billy: ouvinte, operacional e voz','todo','medium','pe_w',10,90,60);
  it(w('ap_javabl','ai'),'task','Níveis de permissão das function calls','backlog','medium',null,20,45,12);
  it(w('ap_ceo','frontend'),'story','Resumo diário do grupo no celular','todo','high','pe_b',3,25,16,{vis:'cliente'});
  it(w('ap_ceo','frontend'),'task','Aprovações pendentes em um toque','backlog','medium','pe_b',15,40,10);
  it(w('ap_ceo','backend'),'task','Notificações do CEO','todo','medium','pe_b',5,18,6);
  it(w('ap_fiscal','database'),'task','Carteira de clientes do Fiscal','done','high','pe_a',-45,-20,12,{feito:dIso(-22)});
  it(w('ap_fiscal','backend'),'story','Importar obrigações do mês','doing','high','pe_a',-8,5,14,{vis:'cliente'});
  it(w('ap_fiscal','frontend'),'bug','Filtro por competência não respeita o mês','todo','highest','pe_a',-3,-1,3);
  it(w('ap_fiscal','frontend'),'task','Tela de guias e vencimentos','todo','medium','pe_b',2,16,10);
  it(w('ap_fin','backend'),'story','Reflexo financeiro decidido pelo CEO','doing','highest','pe_w',-12,10,20,{vis:'cliente'});
  it(w('ap_fin','backend'),'task','Integração com a Conexa','review','high','pe_a',-18,0,12);
  it(w('ap_fin','frontend'),'task','Contas a receber por empresa','todo','medium','pe_b',6,22,10);
  it(w('ap_pes','backend'),'task','Folha e eventos do mês','backlog','medium',null,20,50,16);
  it(w('ap_soc','backend'),'task','Processos societários e prazos','backlog','low',null,30,70,16);
  it(w('ap_cli','frontend'),'story','Login do cliente por CPF','doing','high','pe_b',-6,8,8,{vis:'cliente'});
  it(w('ap_cli','frontend'),'story','Envio de documentos pelo celular','todo','high','pe_b',9,28,14,{vis:'cliente'});
  it(w('ap_cli','backend'),'task','Botão de feedback do Kit IT.IA','todo','medium','pe_a',4,14,6);
  it(w('ap_rz','backend'),'story','Agenda de emissão de certificados','doing','medium','pe_a',-5,12,12);
  it(w('ap_rz','frontend'),'task','Tela de validade dos certificados','done','medium','pe_b',-25,-12,8,{feito:dIso(-13)});
  it(w('ap_gl','database'),'task','Módulo de chips por loja','todo','low','pe_b',12,35,10);
  it(w('ap_40','backend'),'epic','Integração com marketplaces','doing','high','pe_w',-4,45,40,{vis:'cliente'});
  it(w('ap_40','backend'),'task','Robô de cobrança automática','todo','high','pe_a',7,30,16);
  it(w('ap_40','frontend'),'task','Cobrança pelo faturamento via Pix','backlog','medium',null,20,50,12);
  it(w('ap_beec','frontend'),'task','Painel de campanhas','backlog','low',null,30,60,10);
  // histórico de concluídos nas últimas semanas, para o painel
  [[-49,'pe_a','Tela de login do Java BL'],[-44,'pe_b','Ícones do app do CEO'],[-37,'pe_a','Índices da tabela de clientes'],[-35,'pe_w','Contrato de eventos do cadastro'],[-29,'pe_a','Exportação de obrigações em PDF'],[-23,'pe_b','Tela de documentos do cliente'],[-16,'pe_a','Correção do fuso nos vencimentos'],[-15,'pe_b','Aviso de certificado vencendo'],[-9,'pe_a','Registro de quem fez o quê'],[-8,'pe_w','Revisão das regras de acesso'],[-3,'pe_b','Ajuste de layout da Área do Cliente']].forEach(([d,p,t], i) =>
    it(w(['ap_javabl','ap_ceo','ap_javabl','ap_javabl','ap_fiscal','ap_cli','ap_fiscal','ap_rz','ap_javabl','ap_javabl','ap_cli'][i],'backend'),'task',t,'done','low',p,d-4,d,4,{feito:dIso(d)}));
  // blocos de horário (time blocking)
  D.issues.find(x => x.titulo.startsWith('API de transferência')).bloco = {data:dIso(0), ini:'09:00', fim:'11:30'};
  D.issues.find(x => x.titulo.startsWith('Reflexo financeiro')).bloco = {data:dIso(1), ini:'14:00', fim:'17:00'};
  D.issues.find(x => x.titulo.startsWith('Painel central')).bloco = {data:dIso(2), ini:'10:00', fim:'12:00'};
  D.issues.find(x => x.titulo.startsWith('Painel central')).refs = [{nome:'Canvas de estruturação do BL', tipo:'link', url:'https://claude.ai/artifact/GYBDTp5XrcAVbA5Z8Aqa88'},{nome:'rascunho-painel-ceo.png', tipo:'imagem', tam:184000}];
  D.issues.find(x => x.titulo.startsWith('Login do cliente')).coments.push({quem:'pe_s', txt:'Consigo entrar só com o CPF, sem e-mail?', quando:dIso(-2), cliente:true});
  // modelo das etapas
  D.template = ETAPAS_MODELO.map(([nome, expl, lente, itens], i) => ({id:'et_' + i, nome, expl, lente, itens: itens.map((t, j) => ({id:'eti_' + i + '_' + j, texto:t, modo:'Aviso', obrig:true, prova: (nome === 'Verification' || nome === 'QA & Security') ? 'Captura de tela' : (nome === 'Approval' ? 'Aprovação de alguém' : 'Nenhuma'), quem:'Responsável da etapa'}))}));
  D.stages['project:pj_bl'] = {};
  ['eti_0_0','eti_0_1','eti_0_2','eti_1_0','eti_1_1','eti_2_0'].forEach(id => { D.stages['project:pj_bl'][id] = {feito:true, quem:'pe_w', quando:dIso(-50), prova:{tipo:'Texto', valor:'Registrado no Intake do projeto BL'}}; });
  D.stages['project:pj_bl']['eti_1_2'] = {dispensa:'Escopo aberto por decisão do William: o projeto cresce por produto', quem:'pe_w', quando:dIso(-45)};
  D.stages['project:pj_bl']['eti_3_0'] = {feito:true, quem:'pe_w', quando:dIso(-20), prova:{tipo:'Link', valor:'Canvas de estruturação do BL'}};
  // ficha técnica do projeto
  D.sheets['project:pj_bl'] = {campos:{
    'Visual identity|Manual de identidade':'Manual Blanco & Lisboa 2026 (versão azul) e manual YOU "New DS 01"',
    'Stack|Linguagens e versões':'Java 21',
    'Stack|Frameworks':'Spring Boot, JavaFX',
    'Stack|Plataformas':'Desktop (Java), celular',
    'Database|Banco e schema':'Supabase tfcvoszeewmpghgxztuy',
    'Integrations|Sistemas ligados':'WhatsGW, Conexa, Gmail',
    'Business rules|Regras de negócio do cliente':'Carteira de clientes só existe no Fiscal. CNPJ e CPF são assuntos separados.'
  }, custom:[{nome:'Holding', tipo:'Texto', valor:'Blanco & Lisboa'}], arquivos:[]};
  D.sheets['app:ap_fiscal'] = {campos:{'Stack|Plataformas':'Desktop (Java)'}, custom:[], arquivos:[]};
  // service desk
  D.requests = [
    {id:'rq_1', cliente:'cl_bl', app:'ap_fiscal', tipo:'Bug report', grav:'Função quebrada', status:'Aguardando você', titulo:'Guias do mês anterior aparecendo no filtro de setembro', quando:dIso(-1), autor:'pe_s', anexos:[{nome:'print-filtro-competencia.png', tipo:'imagem'}], contexto:'Tela: Guias e vencimentos · Versão 0.4.2 · Chrome 128 · Erro: nenhum', issue:null,
      msgs:[{de:'cliente', txt:'Quando filtro setembro aparecem guias de agosto também.'},{de:'ia', txt:'Entendi. Consegue me dizer se isso acontece com todos os clientes ou só com algum específico?'},{de:'cliente', txt:'Com todos. Mandei o print.'},{de:'ia', txt:'Obrigado. Reproduzi o comportamento com os dados do print: o filtro está usando a data de vencimento em vez da competência. Classifiquei como falha real e passei para a equipe.'}]},
    {id:'rq_2', cliente:'cl_bl', app:'ap_cli', tipo:'Question', grav:'Incômodo', status:'Resolvido pela IA', titulo:'Como reenviar um documento rejeitado', quando:dIso(-3), autor:'pe_s', anexos:[{nome:'audio-duvida.m4a', tipo:'áudio'}], contexto:'Tela: Documentos · Versão 0.2.0 · App Android', issue:null,
      msgs:[{de:'cliente', txt:'(áudio transcrito) Mandei o documento errado, como faço para mandar de novo?'},{de:'ia', txt:'É só abrir o documento com a etiqueta Rejeitado e tocar em Reenviar. O arquivo antigo fica guardado no histórico.'},{de:'cliente', txt:'Deu certo, obrigado.'}]},
    {id:'rq_3', cliente:'cl_bl', app:'ap_ceo', tipo:'Feature request', grav:'Cosmético', status:'Em triagem', titulo:'Ver o faturamento consolidado das empresas no celular', quando:dIso(0), autor:'pe_w', anexos:[], contexto:'Tela: Resumo diário · App iOS', issue:null,
      msgs:[{de:'cliente', txt:'Queria ver o faturamento de todas as empresas juntas, na primeira tela.'},{de:'ia', txt:'Anotado como pedido de funcionalidade nova. Quer ver o total do mês ou comparar com o mês anterior também?'}]}
  ];
  D.agents = [
    {id:'ag_po', nome:'AI PO', papel:'Product Owner: planos de execução, capacidade do time, previsão e replanejamento', instr:'Organize as demandas em epics, stories e tasks. Use a capacidade de cada pessoa. Nunca mude prazo, pessoa ou cliente sem a aprovação do Master.', fontes:['Banco do projeto','Canvas do projeto','Ficha técnica','Histórico de entregas'], ferramentas:[['Criar tarefa','Com confirmação'],['Mudar status','Automática'],['Mudar prazo','Com confirmação'],['Atribuir pessoa','Com confirmação'],['Gerar relatório','Livre'],['Apagar item','Bloqueada']], passa:'Qualquer decisão de prazo, custo ou cliente'},
    {id:'ag_at', nome:'Agente de atendimento', papel:'Primeira resposta no Service Desk: entende, classifica e resolve dúvidas', instr:'Converse primeiro, faça perguntas objetivas e tente reproduzir. Dúvida de uso: explique com base no manual. Falha real: resuma com passos e provas e passe para a equipe.', fontes:['Manual de cada aplicação','Base de conhecimento','Histórico de pedidos'], ferramentas:[['Responder o cliente','Automática'],['Classificar pedido','Automática'],['Juntar pedidos repetidos','Com confirmação'],['Criar item no board','Com confirmação'],['Fechar pedido','Com confirmação']], passa:'Cliente pede uma pessoa, sistema parado, ou duas tentativas sem resolver'},
    {id:'ag_billy', nome:'Billy', papel:'Assistente do grupo: ouvinte, operacional e voz', instr:'Siga os níveis de permissão. Toda function call é validada pelo Java antes de executar.', fontes:['Banco BL','Reuniões','Tarefas'], ferramentas:[['Consultar dados','Livre'],['Criar tarefa','Com confirmação'],['Enviar mensagem','Com confirmação'],['Mexer em financeiro','Bloqueada']], passa:'Qualquer ação fora do nível Livre'}
  ];
  D.baseline = {'Painel do cliente':true,'Botão de feedback':true,'Login e níveis de acesso':true,'Registro de quem fez o quê':true,'Changelog':true,'Backup e LGPD':true,'Sinal de funcionamento':true};
  gerarEventos(D);
  sementeComercial(D);
  return D;
}
/* ================= comercial e custos: dados de exemplo ================= */
function sementeComercial(D){
  // Regras de cálculo (editáveis em Costs › Regras de cálculo)
  D.regras = {
    regime:'simples',
    impostos:{simples:6.0, presumido:16.33, real:17.5},
    encargos:{inss:20, rat:2, terceiros:5.8, fgts:8, ferias:8.33, terco:2.78, decimo:8.33, multaFgts:3.2},
    horasMes:168, faturavel:65, margem:20, risco:15, cambio:5.40,
    complexidade:{'Baixa':0.85, 'Média':1, 'Alta':1.3, 'Muito alta':1.6},
    urgencia:{'Normal':1, 'Prioritária':1.15, 'Urgente':1.3},
    manutencaoAnual:18, reservaOverhead:10
  };
  // Custo da equipe
  const eq = {
    pe_w:{vinculo:'Sócio', salario:0, prolabore:15000, beneficios:0},
    pe_a:{vinculo:'CLT', salario:8500, beneficios:1100},
    pe_b:{vinculo:'PJ', salario:0, valorPJ:9000, beneficios:0}
  };
  D.people.forEach(p => { if (eq[p.id]) p.custo = eq[p.id]; });
  // Custos fixos da operação interna
  D.opCustos = [
    {id:'oc_1', nome:'Assinaturas de IA do time (Claude, outros)', cat:'Ferramentas', valor:600, moeda:'BRL', rec:'Mensal'},
    {id:'oc_2', nome:'GitHub Team', cat:'Ferramentas', valor:12, moeda:'USD', rec:'Mensal'},
    {id:'oc_3', nome:'Figma', cat:'Ferramentas', valor:45, moeda:'USD', rec:'Mensal'},
    {id:'oc_4', nome:'Contabilidade', cat:'Administrativo', valor:900, moeda:'BRL', rec:'Mensal'},
    {id:'oc_5', nome:'Coworking', cat:'Estrutura', valor:1800, moeda:'BRL', rec:'Mensal'},
    {id:'oc_6', nome:'Internet e telefone', cat:'Estrutura', valor:250, moeda:'BRL', rec:'Mensal'},
    {id:'oc_7', nome:'Notebooks (depreciação em 36 meses)', cat:'Equipamentos', valor:21600, moeda:'BRL', rec:'Depreciação', meses:36},
    {id:'oc_8', nome:'Domínio itia.com.br', cat:'Estrutura', valor:40, moeda:'BRL', rec:'Anual'}
  ];
  // Custos técnicos por cliente (infra, APIs, licenças)
  const hist = (base, cresc, n) => Array.from({length:n}, (_, k) => +(base * Math.pow(1 + cresc, k)).toFixed(2));
  D.custos = [
    {id:'ct_1', cliente:'cl_bl', app:'ap_javabl', fornecedor:'Supabase', cat:'Banco de dados', desc:'Plano Pro do banco BL', rec:'Mensal', moeda:'USD', valor:25,
      uso:{unidade:'GB de banco', hist:hist(4.1, 0.08, 6), limite:8, plano:'Pro (8 GB inclusos)', prox:{nome:'Pro + disco extra', valor:25, extraUnidade:0.125, obs:'US$ 0,125 por GB acima de 8 GB'}}, repasse:true, markup:15},
    {id:'ct_2', cliente:'cl_bl', app:'ap_javabl', fornecedor:'Supabase', cat:'Armazenamento', desc:'Storage de arquivos (documentos dos clientes)', rec:'Mensal', moeda:'USD', valor:0,
      uso:{unidade:'GB de arquivos', hist:hist(52, 0.07, 6), limite:100, plano:'Incluso no Pro (100 GB)', prox:{nome:'Storage adicional', valor:0, extraUnidade:0.021, obs:'US$ 0,021 por GB acima de 100 GB'}}, repasse:true, markup:15},
    {id:'ct_3', cliente:'cl_bl', app:'ap_javabl', fornecedor:'Anthropic', cat:'API de IA', desc:'Billy: consumo da API', rec:'Por uso', moeda:'USD', valor:0,
      uso:{unidade:'US$ de consumo', hist:hist(38, 0.18, 6), limite:150, plano:'Limite de gasto mensal definido', prox:{nome:'Aumentar o limite de gasto', valor:0, obs:'Revisar o limite ao chegar perto'}}, repasse:true, markup:25},
    {id:'ct_4', cliente:'cl_bl', app:'ap_fiscal', fornecedor:'WhatsGW', cat:'Mensageria', desc:'WhatsApp dos departamentos', rec:'Mensal', moeda:'BRL', valor:349,
      uso:{unidade:'números conectados', hist:[6,6,7,7,8,9], limite:10, plano:'Plano 10 números', prox:{nome:'Plano 20 números', valor:599, obs:'Troca de plano ao passar de 10 números'}}, repasse:true, markup:10},
    {id:'ct_5', cliente:'cl_bl', app:'ap_cli', fornecedor:'Vercel', cat:'Hospedagem', desc:'Área do Cliente (web)', rec:'Mensal', moeda:'USD', valor:20,
      uso:{unidade:'GB de tráfego', hist:hist(180, 0.12, 6), limite:1000, plano:'Pro (1 TB)', prox:{nome:'Pro + tráfego extra', valor:20, extraUnidade:0.15, obs:'US$ 0,15 por GB acima de 1 TB'}}, repasse:true, markup:15},
    {id:'ct_6', cliente:'cl_bl', app:'ap_fin', fornecedor:'Conexa', cat:'Integração', desc:'Taxa da integração de cobrança', rec:'Mensal', moeda:'BRL', valor:120, uso:null, repasse:false, markup:0},
    {id:'ct_7', cliente:'cl_bl', app:'ap_rz', fornecedor:'Registro.br', cat:'Domínio', desc:'Domínio da Realizze', rec:'Anual', moeda:'BRL', valor:40, uso:null, repasse:true, markup:0},
    {id:'ct_8', cliente:'cl_bl', app:'ap_40', fornecedor:'Marketplaces', cat:'Integração', desc:'Taxa por pedido integrado', rec:'Por uso', moeda:'BRL', valor:0,
      uso:{unidade:'R$ de taxa', hist:[0,0,40,95,160,240], limite:500, plano:'Sem plano fixo', prox:{nome:'Negociar plano por volume', valor:0, obs:'Avaliar plano fixo acima de R$ 500 por mês'}}, repasse:true, markup:0}
  ];
  // Receitas (contratos) por cliente
  const inicios = {ct_1:-14, ct_2:-14, ct_3:-8, ct_4:-20, ct_5:-10, ct_6:-12, ct_7:-30, ct_8:-4};
  D.custos.forEach(c => { if (inicios[c.id] != null) c.inicio = iso(new Date(HOJE.getFullYear(), HOJE.getMonth() + inicios[c.id], 5)); });
  D.receitas = [
    {id:'rc_1', cliente:'cl_bl', project:'pj_bl', app:'', servico:'sv_sistema', desc:'Projeto BL: implantação em 6 parcelas', modelo:'marco', valor:180000, rec:'Parcelado', parcelas:6, inicio:iso(new Date(HOJE.getFullYear(), HOJE.getMonth() - 3, 10))},
    {id:'rc_2', cliente:'cl_bl', project:'pj_bl', app:'ap_javabl', servico:'sv_suporte', desc:'Sustentação mensal do Java BL', modelo:'mensal', valor:6500, rec:'Mensal', inicio:iso(new Date(HOJE.getFullYear(), HOJE.getMonth() - 1, 10))},
    {id:'rc_3', cliente:'cl_bl', project:'pj_bl', app:'ap_fiscal', servico:'sv_sistema', desc:'Javas da YOU e Área do Cliente', modelo:'mensal', valor:4800, rec:'Mensal', inicio:iso(new Date(HOJE.getFullYear(), HOJE.getMonth() - 9, 10))},
    {id:'rc_4', cliente:'cl_bl', project:'pj_bl', app:'ap_40', servico:'sv_integracao', desc:'Integração com marketplaces', modelo:'fixo', valor:28000, rec:'Único', inicio:dIso(-10)}
  ];
  // Catálogo de serviços
  const S = (id, cat, nome, desc, entrega, frentes, h, preco, req, sla, check) => ({id, cat, nome, desc, entrega, frentes, horas:h, preco, req, sla, check, ativo:true});
  D.catalog = [
    S('sv_site','Web','Site institucional','Site de apresentação da empresa, com páginas institucionais e formulário de contato.',['Layout aprovado','Site publicado','Painel para editar textos','Configuração de domínio e SEO básico'],['Design','Frontend','SEO'],[40,120],
      [{m:'fixo'},{m:'manutencao', pct:18}], ['Backup e LGPD','Sinal de funcionamento'], '', ['Manual de identidade do cliente','Textos e imagens','Acesso ao domínio']),
    S('sv_landing','Web','Landing page','Página única de venda ou captação, focada em conversão.',['Página publicada','Formulário ligado ao CRM ou planilha','Pixel e analytics'],['Design','Frontend'],[16,40],
      [{m:'fixo'},{m:'mensal', valor:250, horas:2, excedente:0}], ['Sinal de funcionamento'], '', ['Oferta e público definidos','Identidade visual']),
    S('sv_ecommerce','Web','E-commerce','Loja virtual com catálogo, carrinho e pagamento.',['Loja publicada','Meios de pagamento','Integração com estoque'],['Design','Frontend','Backend','Integrations'],[160,480],
      [{m:'setup'},{m:'mensal', valor:900, horas:6},{m:'sucesso', pct:1.5, base:'Faturamento da loja'}], ['Login e níveis de acesso','Backup e LGPD','Sinal de funcionamento','Changelog'], '8 horas úteis', ['Contrato do gateway de pagamento','Catálogo de produtos']),
    S('sv_sistema','Sistemas','Sistema web sob medida (ERP, CRM e outros)','Sistema de gestão feito para o processo do cliente.',['Módulos combinados no escopo','Painel do cliente','Treinamento','Documentação'],['Frontend','Backend','Database','Integrations'],[400,2400],
      [{m:'marco', parcelas:[30,40,30]},{m:'usuario', valor:39, minimo:10},{m:'mensal', valor:3500, horas:20, excedente:0}], ['Painel do cliente','Botão de feedback','Login e níveis de acesso','Registro de quem fez o quê','Changelog','Backup e LGPD','Sinal de funcionamento'], '4 horas úteis', ['Processos mapeados','Responsável do cliente definido','Acessos aos sistemas atuais']),
    S('sv_desktop','Sistemas','Sistema desktop','Aplicativo instalado no computador, como os Javas do BL.',['Instalador','Atualização automática','Painel do cliente'],['Frontend','Backend','Database'],[200,1200],
      [{m:'setup'},{m:'usuario', valor:59, minimo:5}], ['Painel do cliente','Login e níveis de acesso','Registro de quem fez o quê','Backup e LGPD'], '4 horas úteis', ['Sistema operacional dos usuários','Rede e permissões']),
    S('sv_mobile','Sistemas','App mobile','Aplicativo de celular Android e iOS.',['App nas lojas','Painel do cliente','Notificações'],['Design','Frontend','Backend'],[240,1400],
      [{m:'marco', parcelas:[40,30,30]},{m:'mensal', valor:1200, horas:8, excedente:0}], ['Painel do cliente','Botão de feedback','Login e níveis de acesso','Changelog'], '8 horas úteis', ['Contas de desenvolvedor Apple e Google']),
    S('sv_ajuste_nosso','Evolução','Manutenção e ajustes em sistema nosso','Correções e melhorias em sistemas feitos pela IT.IA.',['Mudança publicada','Changelog atualizado'],['Frontend','Backend'],[4,80],
      [{m:'hora'},{m:'banco', horas:20, validade:3}], ['Changelog'], '8 horas úteis', ['Pedido registrado no Service Desk']),
    S('sv_ajuste_terceiro','Evolução','Manutenção e ajustes em sistema de terceiros','Correções e melhorias em sistemas feitos por outra empresa.',['Diagnóstico do código recebido','Mudança publicada','Relatório de riscos'],['Discovery','Frontend','Backend'],[8,160],
      [{m:'fixo', nome:'Diagnóstico inicial'},{m:'hora', mult:1.2}], ['Changelog','Registro de quem fez o quê'], '1 dia útil', ['Acesso ao código','Acesso ao banco','Documentação existente','Contrato ou termo de responsabilidade']),
    S('sv_integracao','Integração e IA','Integrações entre sistemas','Ligação entre sistemas por API, webhook ou arquivo.',['Integração no ar','Monitoramento de falhas','Documentação do contrato'],['Backend','Integrations'],[24,240],
      [{m:'fixo'},{m:'repasse', markup:15},{m:'mensal', valor:400, horas:2, excedente:0}], ['Registro de quem fez o quê','Sinal de funcionamento'], '4 horas úteis', ['Documentação da API do outro sistema','Credenciais de teste']),
    S('sv_ia','Integração e IA','Automação e agentes de IA','Robôs e agentes que executam tarefas, com níveis de permissão.',['Agente configurado','Níveis de permissão','Painel de uso e custo'],['AI','Backend','Integrations'],[40,400],
      [{m:'setup'},{m:'uso', unidade:'mil chamadas', valor:18, franquia:5},{m:'valor', ganho:120000, pct:15}], ['Registro de quem fez o quê','Painel do cliente','Backup e LGPD'], '4 horas úteis', ['Processo a automatizar descrito','Dados de exemplo','Aprovação de uso de IA com dados do cliente']),
    S('sv_discovery','Consultoria','Discovery e diagnóstico','Levantamento do que existe e do que precisa, antes de construir.',['Dossiê atual','Matriz de evidências','Proposta de solução','Estimativa'],['Discovery'],[16,80],
      [{m:'fixo'}], [], '', ['Acesso ao código e ao banco, se houver','Pessoas para entrevistar']),
    S('sv_suporte','Recorrente','Suporte e sustentação mensal','Plano mensal com horas para correções, melhorias e acompanhamento.',['Horas do mês','Relatório mensal','Atendimento pelo Service Desk'],['Frontend','Backend'],[10,80],
      [{m:'mensal', valor:0, horas:20, excedente:0},{m:'faixa', faixas:[{nome:'Essencial', horas:10, valor:0},{nome:'Profissional', horas:20, valor:0},{nome:'Dedicado', horas:80, valor:0}]}], ['Painel do cliente','Botão de feedback','Changelog'], '4 horas úteis', ['Acesso ao Service Desk'])
  ];
  return D;
}

function gerarEventos(D){
  D.eventos = [];
  const tipos = ['status','criou','comentou','prazo','status','criou'];
  D.issues.filter(i => !i.feito || parse(i.feito) > dAdd(HOJE, -14)).slice(0, 40).forEach((i, k) => {
    const dia = -(k % 13), hora = 9 + (k * 3) % 9;
    const t = i.feito && parse(i.feito) > dAdd(HOJE, -14) ? 'concluiu' : tipos[k % tipos.length];
    const q = new Date(dAdd(HOJE, t === 'concluiu' ? Math.round((parse(i.feito) - HOJE) / 864e5) : dia)); q.setHours(hora, (k * 17) % 60);
    D.eventos.push({tipo:t, item:i.id, ws:i.ws, txt: t === 'status' ? i.titulo + ' → ' + stNome(i.status) : t === 'prazo' ? i.titulo + ' → ' + fmt(i.fim) : i.titulo, quando:q.getTime(), quem:i.resp || 'pe_w'});
  });
  D.eventos.sort((a, b) => b.quando - a.quando);
}
/* ================= armazenamento ================= */
const CHAVE_DADOS = 'itia-sistema-dados-v1';
let D;
try { const raw = document.body.classList.contains('com-login') ? null : localStorage.getItem(CHAVE_DADOS); D = raw ? JSON.parse(raw) : null; } catch(e){ D = null; }
if (!D || D.v !== 2) D = semente();
if (!D.catalog || !D.regras) sementeComercial(D);
if (!D.eventos || !D.eventos.length) gerarEventos(D);
function salvar(){ try { localStorage.setItem(CHAVE_DADOS, JSON.stringify(D)); } catch(e){} }
window.itiaDados = () => D;
window.itiaCalc = {custoNoMes, gastoAteHoje, receitaNoMes, cobradoAteHoje, inicioCusto};

/* ================= estado da tela ================= */
const UI = {modulo:'overview', sel:'project:pj_bl', view:'dashboard', abertos:{'client:cl_bl':true,'project:pj_bl':true,'product:pr_bl':true,'product:pr_you':true}, filtros:{}, busca:'', raias:'nenhuma', calModo:'mes', calRef:iso(HOJE), cargaModo:'semana', ordem:{campo:'status', dir:1}, pedSel:'rq_1', agSel:'ag_po', verComo:'master', filtroPed:'todos'};
try { Object.assign(UI, JSON.parse(localStorage.getItem('itia-sistema-ui') || '{}')); } catch(e){}
function salvarUI(){ try { localStorage.setItem('itia-sistema-ui', JSON.stringify(UI)); } catch(e){} }
const podeEditar = () => UI.verComo !== 'stakeholder';
const souMaster = () => UI.verComo === 'master';
/* quem é "eu" em cada papel: no exemplo são pessoas fixas; com login, vêm do banco (definido em recursos.js) */
const PAPEL_EU = {master:'pe_w', dev:'pe_a', stakeholder:'pe_s'};
let EU_IDS = null;
const idEu = papel => EU_IDS ? (EU_IDS[papel] || '') : PAPEL_EU[papel];
const pjStake = () => { const p = pessoa(idEu('stakeholder')); return p && p.escopo ? (cadeia(p.escopo).project || {}).id : (D.projects[0] || {}).id; };
const cliStake = () => { const p = pessoa(idEu('stakeholder')); return p && p.escopo ? (cadeia(p.escopo).client || {}).id : (D.clients[0] || {}).id; };
const cliPadrao = () => (D.clients[0] || {}).id || '';

/* ================= consultas ================= */
const byId = (lista, id) => D[lista].find(x => x.id === id);
const pessoa = id => byId('people', id);
const ini = n => (n || '?').split(' ').filter(p => p && p[0] !== '(').slice(0,2).map(p => p[0]).join('').toUpperCase();
const avatar = id => { const p = pessoa(id); return p ? '<span class="avatar" title="' + esc(p.nome) + '">' + esc(ini(p.nome)) + '</span>' : '<span class="avatar sem-resp" title="Sem responsável"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg></span>'; };
const wsDe = i => byId('ws', i.ws);
const appDe = i => { const w = wsDe(i); return w ? byId('apps', w.app) : null; };
const prodDe = a => a && a.product ? byId('products', a.product) : null;
const projDe = a => a ? byId('projects', a.project) : null;
function cadeia(chave){
  const [tipo, id] = chave.split(':');
  const r = {};
  if (tipo === 'ws'){ r.ws = byId('ws', id); r.app = r.ws && byId('apps', r.ws.app); }
  if (tipo === 'app') r.app = byId('apps', id);
  if (r.app){ r.product = prodDe(r.app); r.project = projDe(r.app); }
  if (tipo === 'product'){ r.product = byId('products', id); r.project = r.product && byId('projects', r.product.project); }
  if (tipo === 'project') r.project = byId('projects', id);
  if (r.project) r.client = byId('clients', r.project.client);
  if (tipo === 'client') r.client = byId('clients', id);
  if (r.client && r.client.holding) r.holding = byId('clients', r.client.holding);
  else if (r.client && r.client.tipo === 'holding') r.holding = r.client;
  return r;
}
function nomeDe(chave){
  if (chave === 'all') return 'Todos os clientes';
  const [tipo, id] = chave.split(':');
  const m = {client:'clients', project:'projects', product:'products', app:'apps', ws:'ws'}[tipo];
  const o = m && byId(m, id);
  return o ? o.nome : '';
}
function issuesEm(chave){
  const ativos = D.issues.filter(i => !i.arquivado);
  if (chave === 'all') return ativos;
  const [tipo, id] = chave.split(':');
  return ativos.filter(i => {
    const w = wsDe(i); if (!w) return false;
    if (tipo === 'ws') return w.id === id;
    const a = byId('apps', w.app); if (!a) return false;
    if (tipo === 'app') return a.id === id;
    if (tipo === 'product') return a.product === id;
    if (tipo === 'project') return a.project === id;
    if (tipo === 'client'){ const p = byId('projects', a.project); return p && (p.client === id || (byId('clients', p.client) || {}).holding === id); }
    return false;
  });
}
const atrasado = i => i.status !== 'done' && i.fim && parse(i.fim) < HOJE;
function caminho(chave){
  const c = cadeia(chave), p = [];
  if (c.client) p.push(['client:' + c.client.id, c.client.nome]);
  if (c.project) p.push(['project:' + c.project.id, c.project.nome]);
  if (c.product) p.push(['product:' + c.product.id, c.product.nome]);
  if (c.app) p.push(['app:' + c.app.id, c.app.nome]);
  if (c.ws) p.push(['ws:' + c.ws.id, c.ws.nome]);
  return p;
}
const caminhoTexto = i => { const a = appDe(i), w = wsDe(i); return a ? a.nome + ' › ' + (w ? w.nome : '') : ''; };
function tagsSistema(chave){
  const c = cadeia(chave), t = [];
  if (c.holding) t.push('Holding: ' + c.holding.nome);
  if (c.project && !chave.startsWith('project')) t.push('Projeto: ' + c.project.nome);
  if (c.product && !chave.startsWith('product')) t.push('Produto: ' + c.product.nome);
  return t;
}
const tagsLivres = (tipo, id) => D.tagLinks.filter(l => l.tipo === tipo && l.id === id).map(l => byId('tags', l.tag)).filter(Boolean);
function tagsHTML(tipo, id, chaveSistema){
  const sis = chaveSistema ? tagsSistema(chaveSistema) : [];
  return '<div class="tags">' + sis.map(t => '<span class="tag sistema" title="Etiqueta automática: vem da ligação e não pode ser apagada">' + ICO.cadeado + esc(t) + '</span>').join('') +
    tagsLivres(tipo, id).map(t => '<span class="tag" style="--c:' + esc(t.cor) + '"><i class="cor"></i>' + esc(t.nome) + (podeEditar() ? '<button type="button" data-acao="tirar-tag" data-tag="' + t.id + '" data-tipo="' + tipo + '" data-id="' + id + '" aria-label="Tirar etiqueta">×</button>' : '') + '</span>').join('') +
    (podeEditar() ? '<button class="btn fant peq" type="button" data-acao="por-tag" data-tipo="' + tipo + '" data-id="' + id + '">' + ICO.mais + 'Tag</button>' : '') + '</div>';
}

/* ================= toast, modal, gaveta ================= */
let timerToast;
function toast(msg){ let t = $('#toast'); if (!t){ t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role','status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(timerToast); timerToast = setTimeout(() => { t.hidden = true; }, 2600); }
function modal(titulo, corpo, botoes){
  const dlg = document.createElement('dialog'); dlg.className = 'modal';
  dlg.innerHTML = '<div class="modal-cab"><h2>' + titulo + '</h2><button class="ico-btn" type="button" data-fechar aria-label="Fechar">' + ICO.fechar + '</button></div><div class="modal-corpo">' + corpo + '</div><div class="modal-rod">' +
    (botoes || []).map((b, i) => '<button class="btn ' + (b.cls || '') + '" type="button" data-b="' + i + '">' + esc(b.txt) + '</button>').join('') + '</div>';
  document.body.appendChild(dlg);
  const fechar = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-fechar]')) fechar(); const b = e.target.closest('[data-b]'); if (b){ const bt = botoes[+b.dataset.b]; if (!bt.acao || bt.acao(dlg) !== false) fechar(); } });
  dlg.addEventListener('cancel', e => { e.preventDefault(); fechar(); });
  dlg.showModal();
  const f = dlg.querySelector('input,select,textarea'); if (f) f.focus();
  return dlg;
}
const lerArquivo = f => new Promise(res => {
  const base = {nome:f.name, tipo:f.type.startsWith('image') ? 'imagem' : f.type.startsWith('audio') ? 'áudio' : f.type.startsWith('video') ? 'vídeo' : 'arquivo', tam:f.size};
  if ((f.type.startsWith('image') && f.size < 600000) || (f.type.startsWith('audio') && f.size < 1500000)){ const r = new FileReader(); r.onload = () => res(Object.assign(base, {url:r.result})); r.onerror = () => res(base); r.readAsDataURL(f); }
  else res(base);
});

/* ================= navegação entre módulos ================= */
const itens = $$('.item');
function abrirModulo(id){
  if (UI.verComo === 'stakeholder' && !['overview','servicedesk'].includes(id)) id = 'overview';
  const el = itens.find(i => i.dataset.tela === id) || itens[0];
  UI.modulo = el.dataset.tela;
  itens.forEach(i => { if (i === el) i.setAttribute('aria-current','page'); else i.removeAttribute('aria-current'); });
  $$('.principal > .conteudo').forEach(sec => { sec.hidden = sec.id !== 'tela-' + UI.modulo; });
  salvarUI(); render();
}
itens.forEach(el => el.addEventListener('click', () => { if (el.dataset.tela === 'operacoes' && UI.modulo !== 'operacoes') UI.view = 'dashboard'; abrirModulo(el.dataset.tela); }));
function render(){
  const f = {overview:rOverview, operacoes:rOperacoes, clientes:rClientes, catalog:rCatalog, custos:rCustos, servicedesk:rServiceDesk, time:rTime, agentes:rAgentes, configuracoes:rConfig}[UI.modulo];
  if (f) f();
}
function aplicarVerComo(){
  document.body.classList.toggle('modo-stakeholder', UI.verComo === 'stakeholder');
  document.body.classList.toggle('modo-dev', UI.verComo === 'dev');
  itens.forEach(i => { i.parentElement.hidden = UI.verComo === 'stakeholder' && !['overview','servicedesk'].includes(i.dataset.tela); });
}
$('#ver-como').value = UI.verComo;
$('#ver-como').addEventListener('change', e => { UI.verComo = e.target.value; aplicarVerComo(); abrirModulo(UI.modulo); toast(UI.verComo === 'stakeholder' ? 'Vendo como o CEO da B&L: só o painel e os pedidos dele' : UI.verComo === 'dev' ? 'Vendo como Dev: sem as configurações do Master' : 'Vendo como Master'); });

/* ================= painel (dashboard) reutilizável ================= */
function filhosDe(chave){
  if (chave === 'all') return D.clients.filter(c => !c.holding).map(c => 'client:' + c.id);
  const [tipo, id] = chave.split(':');
  if (tipo === 'client') return D.projects.filter(p => p.client === id || (byId('clients', p.client) || {}).holding === id).map(p => 'project:' + p.id);
  if (tipo === 'project'){ const pr = D.products.filter(p => p.project === id).map(p => 'product:' + p.id); const soltos = D.apps.filter(a => a.project === id && !a.product).map(a => 'app:' + a.id); return pr.concat(soltos); }
  if (tipo === 'product') return D.apps.filter(a => a.product === id).map(a => 'app:' + a.id);
  if (tipo === 'app') return D.ws.filter(w => w.app === id).map(w => 'ws:' + w.id);
  return [];
}
function metricas(lista){
  const n = lista.length, feitos = lista.filter(i => i.status === 'done').length;
  const atr = lista.filter(atrasado).length, bloq = lista.filter(i => i.status === 'blocked').length, and = lista.filter(i => i.status === 'doing' || i.status === 'review').length;
  const prog = n ? Math.round(feitos / n * 100) : 0;
  const saude = (atr >= 2 || bloq >= 2) ? 'critico' : (atr || bloq) ? 'atencao' : 'ok';
  return {n, feitos, atr, bloq, and, prog, saude};
}
const ICO_SAUDE = {
  ok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  atencao: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>',
  critico: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>',
  pausado: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7M14 8.5v7"/></svg>'
};
const saudeHTML = s => { const k = s === 'critico' ? 'critico' : s === 'atencao' ? 'atencao' : s === 'pausado' ? 'pausado' : 'ok'; return '<span class="saude s-' + k + '">' + ICO_SAUDE[k] + ({ok:'Saudável', atencao:'Atenção', critico:'Crítico', pausado:'Pausado'}[k]) + '</span>'; };
const statusDoNo = chave => { const [t, id] = chave.split(':'); const m = {project:'projects', product:'products', app:'apps', ws:'ws', client:'clients'}[t]; const o = m && byId(m, id); return o ? o.status : 'active'; };

function navNiveis(chave, opts){
  if (opts.soCliente || chave === 'all') return '';
  const trilha = caminho(chave);
  const noOverview = UI.modulo === 'overview';
  const pai = trilha.length > 1 ? trilha[trilha.length - 2][0] : (noOverview ? 'all' : null);
  const itens = (noOverview ? [['all','Todos os clientes']] : []).concat(trilha);
  return '<nav class="nav-niveis" aria-label="Voltar para um nível acima">' +
    (pai ? '<button class="btn sec peq" type="button" data-ir="' + pai + '">‹ Voltar para ' + esc(pai === 'all' ? 'todos os clientes' : nomeDe(pai)) + '</button>' : '') +
    '<span class="nav-trilha">' + itens.map(([k, n], i) => (i ? '<span class="sep">›</span>' : '') + (k === chave ? '<b>' + esc(n) + '</b>' : '<button type="button" data-ir="' + k + '">' + esc(n) + '</button>')).join('') + '</span></nav>';
}
/* ---- registro de mudanças (alimenta "Mudanças recentes" e a linha do tempo) ---- */
function registrar(tipo, i, txt){
  D.eventos = D.eventos || [];
  D.eventos.unshift({tipo, item: i ? i.id : null, ws: i ? i.ws : null, txt: txt || (i ? i.titulo : ''), quando: Date.now(), quem: idEu(UI.verComo)});
  if (D.eventos.length > 600) D.eventos.length = 600;
}
function eventosEm(chave, lista){
  const ids = new Set(lista.map(i => i.id));
  return (D.eventos || []).filter(e => e.item && ids.has(e.item));
}
const haQuanto = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); if (m < 1) return 'agora'; if (m < 60) return 'há ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'há ' + h + ' h'; const d = Math.round(h / 24); return 'há ' + d + (d === 1 ? ' dia' : ' dias'); };
const VERBO = {criou:'criou', concluiu:'concluiu', status:'mudou o status de', comentou:'comentou em', arquivou:'arquivou', moveu:'moveu', prazo:'mudou o prazo de', etapa:'cumpriu etapa em'};
const COR_EV = {criou:'#2563EB', concluiu:'#1E8E3E', status:'#C26A00', comentou:'#7C3AED', arquivou:'#6B6B72', moveu:'#2563EB', prazo:'#C26A00', etapa:'#1E8E3E'};

/* ---- painel no formato do Painel central do canvas ---- */
function rosca(partes, centro, rotulo){
  const total = partes.reduce((s, p) => s + p[1], 0) || 1, r = 72, c = 2 * Math.PI * r; let acc = 0;
  const arcos = partes.filter(p => p[1] > 0).map(([nome, v, cor]) => { const l = v / total * c; const s = '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="12" stroke-dasharray="' + Math.max(0, l - 2) + ' ' + (c - Math.max(0, l - 2)) + '" stroke-dashoffset="' + (-acc) + '" transform="rotate(-90 90 90)"><title>' + esc(nome) + ': ' + v + '</title></circle>'; acc += l; return s; }).join('');
  const ticks = Array.from({length:60}, (_, k) => { const a = k / 60 * 2 * Math.PI - Math.PI / 2, r1 = k % 6 === 0 ? 84 : 86, r2 = 89; return '<line x1="' + (90 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (90 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (90 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (90 + r2 * Math.sin(a)).toFixed(1) + '" class="' + (k % 6 === 0 ? 'tk-f' : 'tk') + '"/>'; }).join('');
  return '<svg viewBox="0 0 180 180" class="rosca" role="img" aria-label="' + esc(rotulo + ' ' + centro) + '">' + ticks + '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="#EEEEF1" stroke-width="12"/>' + arcos + '<text x="90" y="92" text-anchor="middle" class="r-num">' + esc(centro) + '</text><text x="90" y="114" text-anchor="middle" class="r-rot">' + esc(rotulo) + '</text></svg>';
}
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';
function kpiTile(cls, rot, valor, frac, legenda, info){
  return '<div class="pc-k ' + cls + '"><div class="pc-k-top"><i></i><span>' + esc(rot) + (info ? I(info) : '') + '</span></div><b>' + valor + '</b>' + (frac === null ? '<div class="pc-k-bar nulo"></div>' : '<div class="pc-k-bar"><i style="width:' + Math.min(100, frac * 100) + '%"></i></div>') + '<small>' + esc(legenda) + '</small></div>';
}
function painelCards(chave, lista, filhos, opts){
  const qt = s => lista.filter(i => (Array.isArray(s) ? s.includes(i.status) : i.status === s)).length;
  const total = lista.length, afazer = qt(['backlog','todo']), andamento = qt(['doing','review']), bloq = qt('blocked'), feitos = qt('done');
  const nos = filhos.length ? filhos : [chave];
  const ativos = nos.filter(f => statusDoNo(f) === 'active').length, parados = nos.filter(f => statusDoNo(f) === 'on_hold').length;
  const rotNos = filhos.length ? (({client:'clientes', project:'projetos', product:'produtos', app:'aplicações', ws:'frentes'})[filhos[0].split(':')[0]] || 'partes') : 'partes';
  const fem = ['aplicações','frentes','partes'].includes(rotNos); const cap = rotNos[0].toUpperCase() + rotNos.slice(1);
  // progresso por parte
  const barrasParte = nos.map(f => { let l = issuesEm(f); if (opts.soCliente) l = l.filter(i => i.vis === 'cliente' || i.status === 'done'); const n = l.length || 1; const d = l.filter(i => i.status === 'done').length, a = l.filter(i => i.status === 'doing' || i.status === 'review').length, b = l.filter(i => i.status === 'blocked').length; const pct = l.length ? Math.round(d / l.length * 100) : 0;
    return '<button type="button" class="pp-lin" data-ir="' + f + '" title="' + esc(nomeDe(f)) + ': ' + d + ' concluídos, ' + a + ' em andamento, ' + b + ' bloqueados, ' + (l.length - d - a - b) + ' a fazer"><span class="pp-nome">' + esc(nomeDe(f)) + '</span><span class="pp-bar"><i class="c-done" style="width:' + (d / n * 100) + '%"></i><i class="c-doing" style="width:' + (a / n * 100) + '%"></i><i class="c-blocked" style="width:' + (b / n * 100) + '%"></i></span><b>' + pct + '%</b></button>'; }).join('');
  // linha do tempo de 14 dias
  const evs = eventosEm(chave, lista);
  const dias = Array.from({length:14}, (_, k) => { const d = dAdd(HOJE, k - 13), di = iso(d); const concl = lista.filter(i => i.feito === di).length; const outras = evs.filter(e => e.tipo !== 'concluiu' && iso(new Date(e.quando)) === di).length; return {d, concl, outras}; });
  const maxD = Math.max(4, ...dias.map(x => x.concl + x.outras));
  const criados14 = lista.filter(i => i.criado && parse(i.criado) > dAdd(HOJE, -14)).length;
  const semana = lista.filter(i => i.feito && parse(i.feito) > dAdd(HOJE, -7)).length, semAnt = lista.filter(i => i.feito && parse(i.feito) > dAdd(HOJE, -14) && parse(i.feito) <= dAdd(HOJE, -7)).length;
  // avisos
  const atrasados = lista.filter(atrasado), semResp = lista.filter(i => i.status !== 'done' && !i.resp);
  const avisos = [];
  if (atrasados.length) avisos.push(['#E00000', atrasados.length + (atrasados.length === 1 ? ' item atrasado' : ' itens atrasados'), atrasados[0].id]);
  if (bloq) avisos.push(['#E00000', bloq + (bloq === 1 ? ' item bloqueado' : ' itens bloqueados'), lista.find(i => i.status === 'blocked').id]);
  if (semResp.length && !opts.soCliente) avisos.push(['#C26A00', semResp.length + (semResp.length === 1 ? ' item sem responsável' : ' itens sem responsável'), semResp[0].id]);
  const [tp, idp] = chave.split(':');
  if (!opts.soCliente && tp === 'project'){ const st = D.stages[chave] || {}; let pend = 0, comecou = false; for (let k = D.template.length - 1; k >= 0; k--) D.template[k].itens.forEach(it => { const r = st[it.id] || {}; if (r.feito) comecou = true; else if (comecou && it.obrig && !r.dispensa) pend++; }); if (pend) avisos.push(['#C26A00', pend + ' itens de etapa pendentes', null]); }
  if (!opts.soCliente && souMaster()){ const apps = appsDoEscopo(chave === 'all' ? '' : chave); const lim = D.custos.filter(c => c.uso && (chave === 'all' || apps.includes(c.app)) && mesesAteLimite(c.uso) !== null && mesesAteLimite(c.uso) <= 2).length; if (lim) avisos.push(['#C26A00', lim + (lim === 1 ? ' custo perto do limite do plano' : ' custos perto do limite do plano'), null]); }
  const ped = D.requests.filter(r => r.status === 'Aguardando você' && (chave === 'all' || appsDoEscopo(chave).includes(r.app))).length;
  if (ped && !opts.soCliente) avisos.push(['#2563EB', ped + (ped === 1 ? ' pedido de cliente aguardando você' : ' pedidos de clientes aguardando você'), null]);
  // últimos concluídos e mudanças
  const ultimos = lista.filter(i => i.feito).sort((a, b) => b.feito.localeCompare(a.feito)).slice(0, 7);
  const mudancas = evs.slice(0, 8);
  // análises
  const abertosPorParte = filhos.map(f => [f, issuesEm(f).filter(i => i.status !== 'done').length]).sort((a, b) => b[1] - a[1]);
  const ritmo = [0,1,2,3].map(w => lista.filter(i => i.feito && parse(i.feito) > dAdd(HOJE, -7 * (w + 1)) && parse(i.feito) <= dAdd(HOJE, -7 * w)).length).reduce((a, b) => a + b, 0) / 4;
  const abertos = total - feitos;
  const semanasFalta = ritmo ? Math.ceil(abertos / ritmo) : null;
  const partesFeitas = filhos.filter(f => { const l = issuesEm(f); return l.length && l.every(i => i.status === 'done'); }).length;
  const analises = [];
  if (abertosPorParte.length && abertosPorParte[0][1]) analises.push(['#6B6B72', 'Mais pendências: ' + nomeDe(abertosPorParte[0][0]), abertosPorParte[0][1] + ' em aberto']);
  analises.push(['#2563EB', 'Nesta semana: ' + semana + (semana === 1 ? ' item concluído' : ' itens concluídos'), 'antes: ' + semAnt]);
  analises.push(['#C26A00', semanasFalta === null ? 'Sem ritmo de entrega ainda para prever o fim' : abertos ? 'No ritmo atual, faltam cerca de ' + semanasFalta + (semanasFalta === 1 ? ' semana' : ' semanas') : 'Tudo concluído', ritmo ? num(ritmo, 1) + ' por semana' : '']);
  if (filhos.length) analises.push(['#7C3AED', partesFeitas + ' de ' + filhos.length + ' ' + rotNos + (fem ? ' concluídas' : ' concluídos') + ' por inteiro', '']);
  const CORES = {backlog:'#A6A6AD', todo:'#3355E0', doing:'#E08600', review:'#6D4AFF', blocked:'#FF0000', done:'#0E8A55'};
  return '<div class="pc">' +
    '<div class="pc-kpis">' +
      kpiTile('', 'Itens', total, null, criados14 + ' criados nos últimos 14 dias', 'Issues (itens): todas as tarefas, stories, epics e bugs deste nível') +
      kpiTile('k-todo', 'A fazer', afazer, total ? afazer / total : 0, pct(afazer, total) + ' do total') +
      kpiTile('k-doing', 'Em andamento', andamento, total ? andamento / total : 0, pct(andamento, total) + ' do total' + (bloq ? ' · ' + bloq + ' bloqueado' + (bloq > 1 ? 's' : '') : '')) +
      kpiTile('k-done', 'Concluídos', feitos, total ? feitos / total : 0, (semana ? '+' + semana : 'Nenhum') + ' nesta semana') +
      kpiTile('k-ativo', filhos.length ? cap + (fem ? ' ativas' : ' ativos') : 'Ativo', ativos, nos.length ? ativos / nos.length : 0, 'de ' + nos.length + ' ' + (filhos.length ? rotNos : 'item')) +
      kpiTile('k-parado', filhos.length ? cap + (fem ? ' paradas' : ' parados') : 'Parado', parados, nos.length ? parados / nos.length : 0, parados ? 'Precisa de atenção' : 'Nada parado') +
    '</div>' +
    '<div class="pc-l3">' +
      '<section class="pc-c"><h3>Progresso por ' + (filhos.length ? rotNos.replace(/s$/, '').replace(/õe$/, 'ão').replace(/ões$/, 'ão') : 'parte') + '<span>' + nos.length + '</span></h3><div class="pp">' + barrasParte + '</div><div class="pc-leg"><span><i style="background:#1E8E3E"></i>Concluído</span><span><i style="background:#C26A00"></i>Em andamento</span><span><i style="background:#E00000"></i>Bloqueado</span><span><i style="background:#EEEEF1"></i>A fazer</span></div></section>' +
      '<section class="pc-c"><h3>Itens por status</h3><div class="pc-rosca-l"><div class="pc-rosca">' + rosca(STATUS.map(s => [s.nome, qt(s.id), CORES[s.id]]), (total ? Math.round(feitos / total * 100) : 0) + '%', 'concluído') + '<ul class="pc-st">' + STATUS.map(s => '<li><i style="background:' + CORES[s.id] + '"></i><span>' + esc(s.nome) + '</span><b>' + qt(s.id) + '</b><small>' + pct(qt(s.id), total) + '</small></li>').join('') + '</ul></div></section>' +
      '<section class="pc-c"><h3>Linha do tempo · 14 dias<span>' + semana + (semana === 1 ? ' concluído' : ' concluídos') + ' na semana</span></h3><div class="pc-dias">' + dias.map((x, k) => '<div class="pc-dia' + (k === 13 ? ' hoje' : '') + (x.d.getDay() === 0 || x.d.getDay() === 6 ? ' fds' : '') + '" title="' + fmt(iso(x.d)) + ': ' + x.concl + ' concluídos, ' + x.outras + ' outras mudanças"><i class="o" style="height:' + (x.outras / maxD * 100) + '%"></i><i class="c" style="height:' + (x.concl / maxD * 100) + '%"></i></div>').join('') + '</div><div class="pc-eixo">' + dias.map((x, k) => '<span' + (k === 13 ? ' class="hoje"' : '') + '><b>' + 'DSTQQSS'[x.d.getDay()] + '</b>' + x.d.getDate() + '</span>').join('') + '</div><div class="pc-leg"><span><i style="background:#1E8E3E"></i>Concluídos</span><span><i style="background:#2563EB"></i>Outras mudanças</span></div></section>' +
    '</div>' +
    '<div class="pc-l4">' +
      '<section class="pc-c"><h3>Avisos<span>' + avisos.length + '</span></h3>' + (avisos.length ? '<ul class="pc-lista">' + avisos.map(([cor, t, it]) => '<li' + (it ? ' data-abrir-item="' + it + '" class="clicavel"' : '') + '><i style="background:' + cor + '"></i><span>' + esc(t) + '</span></li>').join('') + '</ul>' : '<p class="pc-vazio">Nenhum aviso. Está tudo em dia.</p>') + '</section>' +
      '<section class="pc-c"><h3>Últimos concluídos</h3>' + (ultimos.length ? '<ul class="pc-lista">' + ultimos.map(i => '<li class="clicavel" data-abrir-item="' + i.id + '"><i style="background:#1E8E3E"></i><span>' + esc(i.titulo) + '</span><small>' + fmt(i.feito) + '</small></li>').join('') + '</ul>' : '<p class="pc-vazio">Marque itens como concluídos e eles aparecem aqui.</p>') + '</section>' +
      '<section class="pc-c"><h3>Mudanças recentes</h3>' + (mudancas.length ? '<ul class="pc-lista">' + mudancas.map(e => '<li class="clicavel" data-abrir-item="' + e.item + '"><i style="background:' + (COR_EV[e.tipo] || '#6B6B72') + '"></i><span>' + esc((VERBO[e.tipo] || e.tipo) + ': ' + e.txt) + '</span><small>' + haQuanto(e.quando) + '</small></li>').join('') + '</ul>' : '<p class="pc-vazio">As mudanças feitas nos itens aparecem aqui.</p>') + '</section>' +
      '<section class="pc-c"><h3>Análises</h3><ul class="pc-lista">' + analises.map(([cor, t, s]) => '<li><i style="background:' + cor + '"></i><span>' + esc(t) + '</span>' + (s ? '<small>' + esc(s) + '</small>' : '') + '</li>').join('') + '</ul></section>' +
    '</div></div>';
}
function painelHTML(chave, opts){
  opts = opts || {};
  let lista = issuesEm(chave);
  if (opts.soCliente) lista = lista.filter(i => i.vis === 'cliente' || i.status === 'done');
  const m = metricas(lista);
  const porStatus = STATUS.map(s => [s, lista.filter(i => i.status === s.id).length]);
  const maxS = Math.max(1, ...porStatus.map(x => x[1]));
  const semanas = [];
  for (let k = 7; k >= 0; k--){
    const fim = dAdd(HOJE, -7 * k), iniW = dAdd(fim, -6);
    const q = lista.filter(i => i.feito && parse(i.feito) >= iniW && parse(i.feito) <= fim).length;
    semanas.push([iniW, q]);
  }
  const maxW = Math.max(1, ...semanas.map(x => x[1]));
  const filhos = filhosDe(chave);
  const linhaTab = (f, nivel) => { const ls = issuesEm(f); const mf = metricas(opts.soCliente ? ls.filter(i => i.vis === 'cliente' || i.status === 'done') : ls); const st = statusDoNo(f); const sub = filhosDe(f); const aberto = !!(UI.tabAbertos || {})[f];
    let h = '<tr class="linha-arv' + (nivel ? ' filha' : '') + '"><th scope="row"><div class="arv-cel" style="padding-left:' + (nivel * 20) + 'px">' + (sub.length ? '<button class="seta-tab" type="button" data-tab-alt="' + f + '" aria-expanded="' + aberto + '" aria-label="' + (aberto ? 'Recolher ' : 'Expandir ') + esc(nomeDe(f)) + '">' + ICO.seta + '</button>' : '<span class="seta-tab vazia"></span>') + '<button class="nome-tab" type="button" data-ir="' + f + '" title="Abrir o painel de ' + esc(nomeDe(f)) + '">' + esc(nomeDe(f)) + '</button><span class="tipo-tab">' + f.split(':')[0] + '</span></div></th><td>' + esc(estNome(st)) + '</td><td><div class="celula-prog"><div class="progresso" style="flex:1"><i style="width:' + mf.prog + '%"></i></div><span>' + mf.prog + '%</span></div></td><td>' + mf.and + '</td><td class="' + (mf.atr ? 'atrasado' : '') + '">' + mf.atr + '</td><td>' + mf.bloq + '</td><td>' + (st === 'on_hold' ? saudeHTML('pausado') : saudeHTML(mf.saude)) + '</td></tr>';
    if (aberto) sub.forEach(s => { h += linhaTab(s, nivel + 1); });
    return h; };
  const linhasFilhos = filhos.map(f => linhaTab(f, 0)).join('');
  const proxEntregas = lista.filter(i => i.status !== 'done' && i.fim).sort((a,b) => a.fim.localeCompare(b.fim)).slice(0, 6);
  return painelCards(chave, lista, filhos, opts) +
    (filhos.length || (chave !== 'all' && !opts.soCliente) ? '<div class="topo-tela" style="margin-top:40px"><div style="display:grid;gap:8px">' + navNiveis(chave, opts) + '<h2 class="sub" style="margin:0">' + (filhos.length ? (opts.tituloFilhos || 'Por parte') : esc(nomeDe(chave))) + '</h2></div>' + (filhos.length ? '<div class="acoes"><button class="btn sec peq" type="button" data-tab-todos="1">Expandir tudo</button><button class="btn sec peq" type="button" data-tab-todos="0">Recolher tudo</button></div>' : '') + '</div><div style="height:16px"></div>' + (filhos.length ? '<div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:24%"><col style="width:10%"><col style="width:24%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:12%"></colgroup><thead><tr><th>Nome</th><th>Status</th><th>Progresso</th><th>Em andamento</th><th>Atrasados</th><th>Bloqueados</th><th>Saúde</th></tr></thead><tbody>' + linhasFilhos + '</tbody></table></div>' : '<p class="vazio-linha" style="padding:0">Este é o nível mais detalhado. Use o Voltar para subir.</p>') : '');
}

/* ================= OVERVIEW ================= */
function rOverview(){
  const el = $('#m-overview');
  if (UI.verComo === 'stakeholder'){
    const p = pessoa(idEu('stakeholder')) || {escopo:'all'};
    el.innerHTML = '<div class="topo-tela"><div><h1>Painel do projeto BL</h1><p class="lead">O que o stakeholder' + I('Stakeholder (cliente que acompanha o projeto, sem executar)') + ' vê dentro do sistema dele: só o andamento do projeto dele, sem as partes internas.</p></div><div class="acoes"><button class="btn" type="button" data-acao="novo-pedido">Enviar comentário ou pedido</button></div></div>' + painelHTML(p.escopo, {soCliente:true, tituloFilhos:'Produtos'});
    return;
  }
  const foco = D.focus ? byId('ws', D.focus.ws) : null;
  const trilha = UI.ovSel && UI.ovSel !== 'all' ? caminho(UI.ovSel) : [];
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Overview</span>' + I('Overview (visão geral): o painel que enxerga todos os clientes e projetos de uma vez só') + '</h1><p class="lead">Clique numa linha para descer no detalhe. ' + T('Drill-down','ir descendo nos detalhes, do macro ao micro') + '.</p></div>' +
    '<div class="acoes">' + (foco ? '<span class="rotulo-mini">Em foco' + I('Focus (foco): em que você está trabalhando agora') + '</span><button class="btn sec" type="button" data-ir-ops="ws:' + foco.id + '">' + esc(byId('apps', foco.app).nome + ' › ' + foco.nome) + '</button><button class="btn fant" type="button" data-acao="sair-foco">Pausar foco</button>' : '<span class="rotulo-mini">Nenhuma frente em foco</span>') + '</div></div>' +
    '<nav class="ops-trilha" style="margin-top:20px" aria-label="Breadcrumb"><button type="button" data-ov="all">Todos os clientes</button>' + trilha.map(([k, n]) => ' › <button type="button" data-ov="' + k + '">' + esc(n) + '</button>').join('') + (UI.ovSel && UI.ovSel !== 'all' ? ' <button class="btn sec peq" type="button" data-ir-ops="' + UI.ovSel + '" style="margin-left:12px">Abrir em Operações</button>' : '') + '</nav>' +
    painelHTML(UI.ovSel || 'all', {tituloFilhos: (UI.ovSel || 'all') === 'all' ? 'Clientes' : 'Partes de ' + nomeDe(UI.ovSel)});
}

/* ================= OPERAÇÕES ================= */
function arvoreHTML(){
  const linha = (chave, nome, nivel, tipo, filhos, st) => {
    const aberto = !!UI.abertos[chave];
    return '<div class="no-arv' + (UI.sel === chave ? ' escolhido' : '') + (aberto ? ' aberto' : '') + (st === 'on_hold' || st === 'archived' ? ' pausado' : '') + '" data-no="' + chave + '" style="padding-left:' + (8 + nivel * 14) + 'px" role="treeitem" aria-expanded="' + (filhos ? aberto : 'false') + '" aria-selected="' + (UI.sel === chave) + '">' +
      (filhos ? '<button class="seta" type="button" data-alt="' + chave + '" aria-label="' + (aberto ? 'Recolher' : 'Expandir') + '">' + ICO.seta + '</button>' : '<span class="seta"></span>') +
      '<span class="nome">' + esc(nome) + '</span><span class="tipo">' + tipo + '</span>' +
      (podeEditar() && tipo !== 'ws' ? '<button class="ico-btn mais so-master" type="button" data-criar="' + chave + '" aria-label="Criar dentro de ' + esc(nome) + '">' + ICO.mais + '</button>' : '') + '</div>';
  };
  let h = '';
  const clientesRaiz = D.clients.filter(c => D.projects.some(p => p.client === c.id));
  clientesRaiz.forEach(c => {
    const kc = 'client:' + c.id;
    h += linha(kc, c.nome, 0, 'client', true, c.status);
    if (!UI.abertos[kc]) return;
    D.projects.filter(p => p.client === c.id).forEach(p => {
      const kp = 'project:' + p.id;
      h += linha(kp, p.nome, 1, 'project', true, p.status);
      if (!UI.abertos[kp]) return;
      const appLinha = (a, nv) => { const ka = 'app:' + a.id; h += linha(ka, a.nome, nv, 'app', true, a.status); if (UI.abertos[ka]) D.ws.filter(w => w.app === a.id).forEach(w => { h += linha('ws:' + w.id, w.nome, nv + 1, 'ws', false, w.status); }); };
      D.products.filter(pr => pr.project === p.id).forEach(pr => {
        const kr = 'product:' + pr.id;
        h += linha(kr, pr.nome, 2, 'product', true, pr.status);
        if (UI.abertos[kr]) D.apps.filter(a => a.product === pr.id).forEach(a => appLinha(a, 3));
      });
      D.apps.filter(a => a.project === p.id && !a.product).forEach(a => appLinha(a, 2));
    });
  });
  return h;
}
const VIEWS = [
  ['dashboard','Dashboard','painel analítico'],['board','Board','quadro kanban'],['table','Table','tabela editável'],['list','List','lista agrupada'],['calendar','Calendar','calendário'],['timeline','Timeline','linha do tempo com barras de duração'],['workload','Workload','carga de trabalho por pessoa'],['whiteboard','Whiteboard','quadro visual livre, o canvas'],['custos','Costs','custos e receitas: o que já foi gasto e cobrado, com a linha do tempo'],['sheet','Tech sheet','ficha técnica'],['stages','Stages','etapas obrigatórias']
];
/* o "i" de cada view de Operações: o que ela faz, em uma frase */
const EXPL_VIEW = {
  dashboard:'Dashboard (painel): o resumo do que está escolhido na estrutura. Mostra quanto já foi feito, o que está atrasado, os avisos e as mudanças recentes.',
  board:'Board (quadro): os itens em colunas pela situação (a fazer, em andamento, em revisão, feito). Arraste o cartão de uma coluna para outra para mudar a situação.',
  table:'Table (tabela): os itens em linhas e colunas, como numa planilha, para ver e mudar vários campos de uma vez.',
  list:'List (lista): os itens agrupados por situação, pessoa ou prioridade, para ler rápido tudo o que existe.',
  calendar:'Calendar (calendário): os itens nos dias do prazo, por mês, semana, dia ou em forma de agenda.',
  timeline:'Timeline (linha do tempo): cada item vira uma barra do início até o prazo, para ver o que acontece ao mesmo tempo e o que depende do quê.',
  workload:'Workload (carga de trabalho): quantas horas cada pessoa tem em cada dia ou semana, comparado com o quanto ela aguenta, para ninguém ficar sobrecarregado.',
  sprints:'Sprints (ciclos): períodos curtos, de 1 ou 2 semanas, com uma meta e os itens escolhidos para aquele período.',
  mywork:'My Work (meu trabalho): só os itens que estão com você, separados em atrasados, de hoje e próximos.',
  whiteboard:'Whiteboard (quadro visual): uma área livre para desenhar, colar notas e ligar ideias. As notas podem virar itens.',
  custos:'Costs (custos): quanto este ponto da estrutura já gastou e já cobrou, os custos de cada fornecedor e a previsão dos próximos meses.',
  sheet:'Tech sheet (ficha técnica): as informações técnicas guardadas, como linguagem, banco, integrações, regras do cliente e arquivos.',
  stages:'Stages (etapas): as etapas obrigatórias do processo (entrada, escopo, descoberta e as outras) e o que já foi cumprido em cada uma, com a prova.'
};
const abaView = v => '<span class="view-casa"><button class="view-b" type="button" role="tab" data-view="' + v[0] + '" aria-selected="' + (UI.view === v[0]) + '">' + v[1] + '</button>' + (EXPL_VIEW[v[0]] ? I(EXPL_VIEW[v[0]]) : '') + '</span>';
function rOperacoes(){
  const el = $('#m-operacoes');
  const [tipo, id] = UI.sel.split(':');
  const m = {client:'clients', project:'projects', product:'products', app:'apps', ws:'ws'}[tipo];
  let obj = m && byId(m, id);
  if (!obj && D.projects[0]){ UI.sel = 'project:' + D.projects[0].id; obj = D.projects[0]; }
  const tipoNomes = {client:['Client','cliente'], project:['Project','projeto'], product:['Product','produto'], app:['Application','aplicação'], ws:['Workstream','frente de trabalho']};
  const viewsDisp = VIEWS.filter(v => !(v[0] === 'custos' && (tipo === 'ws' || UI.verComo !== 'master')) && !((v[0] === 'stages') && !['project','app'].includes(tipo)) && !((v[0] === 'sheet') && !['project','app','product'].includes(tipo)));
  if (!viewsDisp.some(v => v[0] === UI.view)) UI.view = 'dashboard';
  const emFoco = D.focus && tipo === 'ws' && D.focus.ws === id;
  const trilha = caminho(UI.sel);
  el.innerHTML = '<div class="ops' + (UI.semArvore ? ' sem-arvore' : '') + '" style="--arv:' + (UI.arvW || ARV_PADRAO) + 'px">' +
    '<aside class="ops-arvore" aria-label="Estrutura"><div class="arv-puxador" role="separator" aria-orientation="vertical" aria-label="Arrastar para mudar a largura da estrutura" title="Arraste para aumentar ou diminuir. Dois cliques com o botão direito voltam à largura padrão." tabindex="0"></div><div class="cab"><span class="rotulo-mini">Estrutura</span>' + (podeEditar() ? '<button class="btn sec peq so-master" type="button" data-acao="novo-cliente-proj">' + ICO.mais + 'Projeto</button>' : '') + '<button class="ico-btn arv-alternar" type="button" data-acao="arvore" aria-label="Recolher a estrutura" title="Recolher a estrutura"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true"><rect x="3" y="3" width="18" height="18"></rect><path d="M9 3v18"></path><path d="M16 15l-3-3 3-3"></path></svg></button></span></div><div role="tree">' + arvoreHTML() + '</div></aside>' +
    '<aside class="arv-trilho" aria-label="Estrutura recolhida" data-acao="arvore" title="Expandir a estrutura"><button class="ico-btn arv-alternar" type="button" data-acao="arvore" aria-label="Expandir a estrutura" title="Expandir a estrutura"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true"><rect x="3" y="3" width="18" height="18"></rect><path d="M9 3v18"></path><path d="M13 9l3 3-3 3"></path></svg></button><span class="arv-trilho-rot">Estrutura</span></aside>' +
    '<div class="ops-main">' +
      '<div class="ops-cab">' +
        '<nav class="ops-trilha" aria-label="Breadcrumb">' + trilha.map(([k, n], i) => (i ? '<span>›</span>' : '') + '<button type="button" data-no-ir="' + k + '">' + esc(n) + '</button>').join('') + '</nav>' +
        '<div class="ops-titulo"><div class="titulo-esq"><h1>' + esc(obj.nome) + '<small>' + tipoNomes[tipo][0] + '</small>' + I(tipoNomes[tipo][0] + ' (' + tipoNomes[tipo][1] + ')') + '</h1>' + (tipo !== 'ws' ? tagsHTML(tipo, id, UI.sel) : '<div class="tags">' + tagsSistema(UI.sel).map(t => '<span class="tag sistema">' + ICO.cadeado + esc(t) + '</span>').join('') + '</div>') + '</div>' +
          '<div class="acoes">' +
            (tipo !== 'client' ? '<label class="rotulo-mini" style="display:flex;gap:8px;align-items:center">Status <select class="sel peq" data-estado="' + UI.sel + '"' + (podeEditar() ? '' : ' disabled') + '>' + EST.map(e => '<option value="' + e.id + '"' + (obj.status === e.id ? ' selected' : '') + '>' + e.nome + ' · ' + e.expl + '</option>').join('') + '</select></label>' : '') +
            (tipo === 'ws' && podeEditar() ? (emFoco ? '<button class="btn acento" type="button" data-acao="sair-foco">Em foco · pausar</button>' : '<button class="btn sec" type="button" data-acao="por-foco" data-ws="' + id + '">' + (D.focus ? 'Switch focus' : 'Pôr em foco') + '</button>') : '') +
            (tipo === 'app' && podeEditar() ? '<button class="btn sec so-master" type="button" data-acao="mover-app" data-id="' + id + '">Mover</button>' : '') +
          '</div></div>' +
        (obj.status === 'on_hold' ? '<div class="aviso-faixa"><b>On Hold</b><span>' + esc(obj.motivo || 'Sem motivo registrado') + '</span></div>' : '') +
        '<div class="views" role="tablist" aria-label="Views">' + viewsDisp.map(abaView).join('') + '</div>' +
      '</div>' +
      '<div class="ops-corpo" id="ops-corpo"></div>' +
    '</div></div>';
  ajustarMain();
  rView();
}
function listaFiltrada(){
  let l = issuesEm(UI.sel);
  const f = UI.filtros, b = (UI.busca || '').toLowerCase().trim();
  if (f.meus) l = l.filter(i => i.resp === idEu(UI.verComo));
  if (f.alta) l = l.filter(i => i.prio === 'highest' || i.prio === 'high');
  if (f.atraso) l = l.filter(atrasado);
  if (f.bloq) l = l.filter(i => i.status === 'blocked');
  if (f.cliente) l = l.filter(i => i.vis === 'cliente');
  if (b){
    const partes = b.split(/\s+e\s+/);
    l = l.filter(i => partes.every(p => {
      const mm = /^(status|responsável|responsavel|tipo|prioridade)\s*=\s*(.+)$/.exec(p.trim());
      if (mm){ const v = mm[2].trim(); if (mm[1] === 'status') return stNome(i.status).toLowerCase().includes(v); if (mm[1] === 'tipo') return tipoNome(i.tipo).toLowerCase().includes(v); if (mm[1] === 'prioridade') return prioNome(i.prio).toLowerCase().includes(v); const pp = pessoa(i.resp); return pp && pp.nome.toLowerCase().includes(v); }
      return (i.titulo + ' ' + caminhoTexto(i)).toLowerCase().includes(p.trim());
    }));
  }
  return l;
}
function ferramentasHTML(extra){
  const fr = [['meus','Meus itens'],['alta','Alta prioridade'],['atraso','Atrasados'],['bloq','Bloqueados'],['cliente','Visíveis ao cliente']];
  return '<div class="ferramentas"><input class="campo" id="busca-itens" type="search" placeholder="Buscar ou: status = in progress e responsável = ana" value="' + esc(UI.busca) + '" aria-label="Busca avançada">' + I('Advanced search (busca avançada no estilo JQL, a linguagem de busca do Jira): escreva campo = valor, e junte com " e "') +
    '<span class="rotulo-mini" style="margin-left:8px">Quick filters' + I('Quick filters (filtros rápidos de um clique)') + '</span>' + fr.map(([k, n]) => '<button class="filtro-rap" type="button" data-filtro="' + k + '" aria-pressed="' + !!UI.filtros[k] + '">' + n + '</button>').join('') + '<span class="espaco"></span>' + (extra || '') + '</div>';
}
function rView(){
  const c = $('#ops-corpo'); if (!c) return;
  const v = UI.view;
  if (v === 'board') c.innerHTML = vBoard();
  else if (v === 'table') c.innerHTML = vTable();
  else if (v === 'list') c.innerHTML = vList();
  else if (v === 'calendar') c.innerHTML = vCalendar();
  else if (v === 'timeline') c.innerHTML = vTimeline();
  else if (v === 'workload') c.innerHTML = vWorkload();
  else if (v === 'whiteboard') c.innerHTML = vWhiteboard();
  else if (v === 'dashboard') c.innerHTML = painelHTML(UI.sel, {tituloFilhos:'Partes de ' + nomeDe(UI.sel)});
  else if (v === 'sheet') c.innerHTML = vSheet();
  else if (v === 'stages') c.innerHTML = vStages();
  else if (v === 'custos') c.innerHTML = vCustosEscopo(UI.sel);
  ligarArrastar();
}
function cartaoHTML(i){
  const ck = i.check.length ? i.check.filter(x => x.f).length : 0;
  const atr = atrasado(i);
  return '<article class="cartao c-' + i.status + '" draggable="' + podeEditar() + '" data-item="' + i.id + '" tabindex="0">' +
    '<div class="c-topo">' + tipoHTML(i.tipo) + '<span class="onde">' + esc(caminhoTexto(i)) + '</span></div>' +
    '<div class="tt">' + esc(i.titulo) + '</div>' +
    (i.check.length ? '<div class="c-check" title="Checklist ' + ck + ' de ' + i.check.length + '"><div class="progresso"><i style="width:' + (ck / i.check.length * 100) + '%"></i></div><span>' + ck + '/' + i.check.length + '</span></div>' : '') +
    '<div class="rod"><span class="esq">' + prioHTML(i.prio) + (i.fim ? '<span class="data' + (atr ? ' atraso' : '') + '" title="' + (atr ? 'Atrasado. ' : '') + 'Prazo ' + fmt(i.fim) + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' + fmt(i.fim) + '</span>' : '') +
      (i.links.length ? '<span class="lk" title="Tem dependência"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg></span>' : '') +
      (i.coments.length ? '<span class="lk" title="' + i.coments.length + ' comentário(s)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H8l-4 4z"/></svg>' + i.coments.length + '</span>' : '') +
      ((i.refs || []).length ? '<span class="lk" title="' + i.refs.length + ' referência(s)">' + ICO.clip + i.refs.length + '</span>' : '') +
      (i.vis === 'cliente' ? '<span class="lk" title="Visível ao cliente"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></span>' : '') +
    '</span>' + avatar(i.resp) + '</div></article>';
}
function vBoard(){
  const l = listaFiltrada();
  const [tipo, id] = UI.sel.split(':');
  const wip = tipo === 'ws' ? (byId('ws', id).wip || 0) : 0;
  const colunas = (lista, raia) => '<div class="board">' + STATUS.map(s => {
    const its = lista.filter(i => i.status === s.id);
    const estouro = wip && s.id === 'doing' && its.length > wip;
    return '<section class="coluna col-' + s.id + (estouro ? ' cheia' : '') + '" aria-label="' + esc(s.nome) + '"><div class="coluna-cab"><span>' + esc(s.nome) + I(s.nome + ' (' + s.expl + ')') + '</span><span class="qt' + (estouro ? ' estouro' : '') + '">' + its.length + (wip && s.id === 'doing' ? ' / ' + wip : '') + '</span></div>' +
      '<div class="coluna-corpo" data-soltar-status="' + s.id + '"' + (raia ? ' data-raia="' + esc(raia) + '"' : '') + '>' + its.map(cartaoHTML).join('') + '</div>' +
      (podeEditar() && !raia ? '<form class="add-rap" data-add-status="' + s.id + '"><input class="campo" name="t" placeholder="Quick add' + '" aria-label="Criar item em ' + esc(s.nome) + '"><button class="btn peq" type="submit">' + ICO.mais + '</button></form>' : '') + '</section>';
  }).join('') + '</div>';
  const raiasSel = '<label class="rotulo-mini" style="display:flex;gap:8px;align-items:center">Swimlanes' + I('Swimlanes (faixas horizontais que agrupam o quadro)') + '<select class="sel peq" id="raias">' + [['nenhuma','Nenhuma'],['resp','Responsável'],['prio','Prioridade'],['app','Aplicação']].map(([k, n]) => '<option value="' + k + '"' + (UI.raias === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    (wip ? '<span class="rotulo-mini">WIP limit' + I('WIP limit (limite de cartões em andamento: a coluna fica vermelha se passar)') + ' ' + wip + '</span>' : '') +
    (podeEditar() ? '<button class="btn" type="button" data-acao="novo-item">' + ICO.mais + 'Novo item</button>' : '');
  let corpo;
  if (UI.raias === 'nenhuma') corpo = colunas(l);
  else {
    const chaveR = i => UI.raias === 'resp' ? (pessoa(i.resp) || {nome:'Sem responsável'}).nome : UI.raias === 'prio' ? prioNome(i.prio) : (appDe(i) || {nome:'-'}).nome;
    const grupos = [...new Set(l.map(chaveR))].sort();
    corpo = grupos.map(g => '<div class="raia"><div class="raia-cab">' + esc(g) + '</div>' + colunas(l.filter(i => chaveR(i) === g), g) + '</div>').join('') || '<p class="vazio-linha">Nenhum item com esses filtros.</p>';
  }
  return ferramentasHTML(raiasSel) + '<div class="board-rolo">' + corpo + '</div>';
}
function vTable(){
  const l = listaFiltrada().slice();
  const o = UI.ordem, val = i => o.campo === 'resp' ? (pessoa(i.resp) || {nome:'~'}).nome : o.campo === 'prio' ? PRIOS.findIndex(p => p.id === i.prio) : o.campo === 'status' ? STATUS.findIndex(s => s.id === i.status) : (i[o.campo] || '~');
  l.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * o.dir);
  const th = (campo, nome) => '<th scope="col" class="ord" data-ordem="' + campo + '">' + nome + (o.campo === campo ? (o.dir > 0 ? ' ↑' : ' ↓') : '') + '</th>';
  const dis = podeEditar() ? '' : ' disabled';
  return ferramentasHTML(podeEditar() ? '<button class="btn" type="button" data-acao="novo-item">' + ICO.mais + 'Novo item</button>' : '') +
    '<div class="tabela-rolo"><table class="tabela itens"><colgroup><col style="width:24%"><col style="width:8%"><col style="width:15%"><col style="width:11%"><col style="width:9%"><col style="width:13%"><col style="width:10%"><col style="width:10%"></colgroup><thead><tr>' +
    th('titulo','Título') + th('tipo','Tipo') + '<th scope="col">Onde</th>' + th('status','Status') + th('prio','Prioridade') + th('resp','Responsável') + th('ini','Início') + th('fim','Prazo') + '</tr></thead><tbody>' +
    l.map(i => '<tr data-linha="' + i.id + '"><th scope="row"><input class="campo" data-editar="titulo" value="' + esc(i.titulo) + '"' + dis + ' aria-label="Título"></th>' +
      '<td><select class="sel" data-editar="tipo"' + dis + '>' + TIPOS.map(t => '<option value="' + t.id + '"' + (i.tipo === t.id ? ' selected' : '') + '>' + t.nome + '</option>').join('') + '</select></td>' +
      '<td class="sec" style="font-size:12px"><button class="btn fant peq" type="button" data-abrir-item="' + i.id + '">' + esc(caminhoTexto(i)) + '</button></td>' +
      '<td><select class="sel" data-editar="status"' + dis + '>' + STATUS.map(s => '<option value="' + s.id + '"' + (i.status === s.id ? ' selected' : '') + '>' + s.nome + '</option>').join('') + '</select></td>' +
      '<td><select class="sel" data-editar="prio"' + dis + '>' + PRIOS.map(p => '<option value="' + p.id + '"' + (i.prio === p.id ? ' selected' : '') + '>' + p.nome + '</option>').join('') + '</select></td>' +
      '<td><select class="sel" data-editar="resp"' + dis + '><option value="">Sem responsável</option>' + D.people.filter(p => p.acesso !== 'stakeholder').map(p => '<option value="' + p.id + '"' + (i.resp === p.id ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') + '</select></td>' +
      '<td><input class="campo" type="date" data-editar="ini" value="' + esc(i.ini || '') + '"' + dis + ' aria-label="Início"></td>' +
      '<td><input class="campo' + (atrasado(i) ? ' atrasado' : '') + '" type="date" data-editar="fim" value="' + esc(i.fim || '') + '"' + dis + ' aria-label="Prazo"></td></tr>').join('') +
    '</tbody></table></div>' + (l.length ? '' : '<p class="vazio-linha">Nenhum item com esses filtros.</p>');
}
function vList(){
  const l = listaFiltrada();
  return ferramentasHTML(podeEditar() ? '<button class="btn" type="button" data-acao="novo-item">' + ICO.mais + 'Novo item</button>' : '') + STATUS.map(s => {
    const its = l.filter(i => i.status === s.id); if (!its.length) return '';
    return '<div class="grupo-lista"><h3>' + stHTML(s.id) + '<span class="rotulo-mini">' + its.length + '</span></h3><ul>' + its.map(i => '<li data-abrir-item="' + i.id + '"><span style="display:flex;gap:8px;align-items:center">' + tipoHTML(i.tipo) + prioHTML(i.prio) + esc(i.titulo) + '</span><span class="sec" style="font-size:12px">' + esc(caminhoTexto(i)) + '</span><span style="display:flex;gap:6px;align-items:center">' + avatar(i.resp) + '<span style="font-size:12px">' + esc((pessoa(i.resp) || {nome:''}).nome) + '</span></span><span class="' + (atrasado(i) ? 'atrasado' : '') + '">' + fmt(i.fim) + '</span></li>').join('') + '</ul></div>';
  }).join('');
}

/* ---- calendário ---- */
function vCalendar(){
  const ref = parse(UI.calRef) || HOJE;
  const l = listaFiltrada();
  const modos = [['mes','Month'],['semana','Week'],['dia','Day'],['agenda','Agenda']];
  let titulo = '', corpo = '';
  const evHTML = i => '<div class="ev' + (i.status === 'done' ? ' done' : atrasado(i) ? ' atraso' : '') + '" draggable="' + podeEditar() + '" data-item="' + i.id + '" title="' + esc(i.titulo) + ' · ' + esc(stNome(i.status)) + '">' + esc(i.titulo) + '</div>';
  if (UI.calModo === 'mes'){
    titulo = MESES[ref.getMonth()] + ' de ' + ref.getFullYear();
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const ini0 = dAdd(primeiro, -primeiro.getDay());
    corpo = '<div class="mes">' + DSEM.map(d => '<div class="dsem">' + d + '</div>').join('');
    for (let k = 0; k < 42; k++){
      const d = dAdd(ini0, k), di = iso(d);
      const its = l.filter(i => i.fim === di);
      const marcos = D.projects.filter(p => p.alvo === di);
      corpo += '<div class="dia' + (d.getMonth() !== ref.getMonth() ? ' fora' : '') + (di === iso(HOJE) ? ' hoje' : '') + '" data-soltar-data="' + di + '"><span class="dn">' + d.getDate() + '</span>' + marcos.map(p => '<div class="ev marco">Entrega prevista: ' + esc(p.nome) + '</div>').join('') + its.slice(0, 4).map(evHTML).join('') + (its.length > 4 ? '<button class="btn fant peq" type="button" data-cal-dia="' + di + '">+' + (its.length - 4) + ' itens</button>' : '') + '</div>';
    }
    corpo += '</div>';
  } else if (UI.calModo === 'semana' || UI.calModo === 'dia'){
    const dias = UI.calModo === 'dia' ? [ref] : Array.from({length:7}, (_, k) => dAdd(ref, k - ref.getDay()));
    titulo = UI.calModo === 'dia' ? DSEM[ref.getDay()] + ', ' + fmtLongo(ref) : fmtLongo(dias[0]) + ' a ' + fmtLongo(dias[6]);
    const horas = Array.from({length:12}, (_, k) => 8 + k);
    corpo = '<div class="semana" style="--dias:' + dias.length + '"><div class="topo"></div>' + dias.map(d => '<div class="topo' + (iso(d) === iso(HOJE) ? ' hoje' : '') + '">' + DSEM[d.getDay()] + ' ' + d.getDate() + ' <span class="carga-dia">' + cargaDoDia(iso(d)).toFixed(0) + 'h previstas</span></div>').join('') +
      '<div class="h">Prazo</div>' + dias.map(d => '<div class="dia-todo" data-soltar-data="' + iso(d) + '">' + l.filter(i => i.fim === iso(d)).map(evHTML).join('') + '</div>').join('');
    horas.forEach(hh => {
      corpo += '<div class="h">' + String(hh).padStart(2,'0') + ':00</div>';
      dias.forEach(d => {
        const di = iso(d);
        const blocos = l.filter(i => i.bloco && i.bloco.data === di && parseInt(i.bloco.ini, 10) === hh);
        corpo += '<div class="cel" data-bloco-dia="' + di + '" data-bloco-hora="' + hh + '">' + blocos.map(i => { const [h1, m1] = i.bloco.ini.split(':').map(Number), [h2, m2] = i.bloco.fim.split(':').map(Number); const dur = Math.max(0.5, (h2 + m2 / 60) - (h1 + m1 / 60)); return '<div class="ev bloco bloco-abs" data-abrir-item="' + i.id + '" style="top:' + (m1 / 60 * 44) + 'px;height:' + (dur * 44 - 3) + 'px">' + esc(i.bloco.ini + ' ' + i.titulo) + '</div>'; }).join('') + '</div>';
      });
    });
    corpo += '</div><p class="legenda"><span>Clique num horário vazio para reservar um bloco. ' + T('Time blocking','reservar um horário para trabalhar numa tarefa') + '</span></p>';
  } else {
    titulo = 'Próximos dias';
    const dias = [...new Set(l.filter(i => i.fim && parse(i.fim) >= dAdd(HOJE, -7)).map(i => i.fim))].sort().slice(0, 20);
    corpo = '<div class="agenda">' + dias.map(di => '<div class="ag-dia"><div>' + DSEM[parse(di).getDay()] + ', ' + fmtLongo(parse(di)) + '</div><div class="ag-itens">' + l.filter(i => i.fim === di).map(i => '<div class="ag-it" data-abrir-item="' + i.id + '">' + stHTML(i.status) + '<span>' + esc(i.titulo) + '</span><span class="sec" style="font-size:12px">' + esc(caminhoTexto(i)) + '</span><span style="display:flex;gap:6px;align-items:center">' + avatar(i.resp) + '</span></div>').join('') + '</div></div>').join('') + '</div>';
  }
  return ferramentasHTML() + '<div class="cal-cab"><button class="btn sec peq" type="button" data-cal-nav="-1" aria-label="Anterior">‹</button><button class="btn sec peq" type="button" data-cal-nav="0">Hoje</button><button class="btn sec peq" type="button" data-cal-nav="1" aria-label="Próximo">›</button><h3>' + esc(titulo) + '</h3><span class="espaco"></span><div class="seg" role="group" aria-label="Modo do calendário">' + modos.map(([k, n]) => '<button type="button" data-cal-modo="' + k + '" aria-pressed="' + (UI.calModo === k) + '">' + n + '</button>').join('') + '</div></div>' + corpo +
    (UI.calModo === 'mes' ? '<div class="legenda"><span><i style="border-left:3px solid var(--grafite)"></i>Prazo</span><span><i style="border-left:3px solid var(--vermelho)"></i>Atrasado</span><span><i style="background:var(--preto)"></i>Entrega prevista do projeto</span><span>Arraste um item para outro dia para mudar o prazo. ' + T('Drag to reschedule','arrastar para mudar a data') + '</span></div>' : '');
}
function horasPorDia(i){
  const a = parse(i.ini) || parse(i.fim), b = parse(i.fim) || a; if (!a || !b) return {};
  const dias = []; for (let d = new Date(a); d <= b; d = dAdd(d, 1)) if (d.getDay() > 0 && d.getDay() < 6) dias.push(iso(d));
  const r = {}; const h = (i.est || 0) / Math.max(1, dias.length); dias.forEach(d => { r[d] = h; }); return r;
}
function cargaDoDia(di, pid){
  return D.issues.filter(i => !i.arquivado && i.status !== 'done' && i.resp && (!pid || i.resp === pid)).reduce((s, i) => s + (horasPorDia(i)[di] || 0), 0);
}

/* ---- timeline e workload ---- */
function vTimeline(){
  const l = listaFiltrada().filter(i => i.ini && i.fim);
  if (!l.length) return ferramentasHTML() + '<p class="vazio-linha">Nenhum item com início e prazo.</p>';
  let a = l.reduce((m, i) => parse(i.ini) < m ? parse(i.ini) : m, parse(l[0].ini)), b = l.reduce((m, i) => parse(i.fim) > m ? parse(i.fim) : m, parse(l[0].fim));
  a = dAdd(a, -a.getDay()); b = dAdd(b, 7);
  const total = (b - a) / 864e5;
  const pos = d => ((parse(d) - a) / 864e5) / total * 100;
  const semanas = []; for (let d = new Date(a); d < b; d = dAdd(d, 7)) semanas.push(d);
  const porApp = {}; l.forEach(i => { const n = (appDe(i) || {nome:'-'}).nome; (porApp[n] = porApp[n] || []).push(i); });
  const hojeP = ((HOJE - a) / 864e5) / total * 100;
  return ferramentasHTML() + '<div class="gantt-rolo"><div class="gantt" style="min-width:' + Math.max(900, semanas.length * 60 + 280) + 'px"><div class="g-escala"><div style="padding:8px 12px">Item</div><div class="sem">' + semanas.map(d => '<span style="left:' + (((d - a) / 864e5) / total * 100) + '%">' + fmt(iso(d)) + '</span>').join('') + '</div></div>' +
    Object.keys(porApp).sort().map(n => '<div class="g-grupo">' + esc(n) + '</div>' + porApp[n].sort((x, y) => x.ini.localeCompare(y.ini)).map(i => '<div class="g-lin"><div class="g-nome" data-abrir-item="' + i.id + '">' + esc(i.titulo) + '</div><div class="g-faixa"><div class="hoje-l" style="left:' + hojeP + '%"></div><div class="g-barra ' + (i.status === 'done' ? 'done' : atrasado(i) ? 'atraso' : (i.status === 'todo' || i.status === 'backlog') ? 'todo' : '') + '" data-abrir-item="' + i.id + '" style="left:' + pos(i.ini) + '%;width:' + Math.max(0.8, pos(i.fim) - pos(i.ini)) + '%" title="' + esc(i.titulo + ': ' + fmt(i.ini) + ' a ' + fmt(i.fim)) + '"></div></div></div>').join('')).join('') +
    '</div></div><div class="legenda"><span><i style="background:var(--preto)"></i>Concluído</span><span><i style="background:var(--grafite)"></i>Em andamento</span><span><i style="background:var(--nevoa)"></i>A fazer</span><span><i style="background:var(--vermelho)"></i>Atrasado</span><span><i style="background:var(--vermelho);width:2px"></i>Hoje</span></div>';
}
function vWorkload(){
  const ref = parse(UI.calRef) || HOJE;
  let dias = [];
  if (UI.cargaModo === 'semana') dias = Array.from({length:7}, (_, k) => dAdd(ref, k - ref.getDay())).filter(d => d.getDay() > 0 && d.getDay() < 6);
  else if (UI.cargaModo === 'dia') dias = [ref];
  const equipe = D.people.filter(p => p.acesso !== 'stakeholder');
  let tabela;
  if (UI.cargaModo === 'mes'){
    const p0 = new Date(ref.getFullYear(), ref.getMonth(), 1); const seg0 = dAdd(p0, -((p0.getDay() + 6) % 7)); const semanas = Array.from({length:5}, (_, k) => dAdd(seg0, 7 * k));
    tabela = '<table class="carga"><thead><tr><th style="width:220px">Pessoa</th>' + semanas.map(s => '<th>Semana de ' + fmt(iso(s)) + '</th>').join('') + '</tr></thead><tbody>' + equipe.map(p => '<tr><th>' + esc(p.nome) + '<br><span class="sec" style="font-weight:400;font-size:12px">' + p.cap + 'h por semana</span></th>' + semanas.map(s => { let h = 0; for (let k = 0; k < 5; k++) h += cargaDoDia(iso(dAdd(s, k)), p.id); const c = h > p.cap ? 'sobre' : h > p.cap * 0.8 ? 'cheio' : h < 1 ? 'livre' : 'ok'; return '<td class="' + c + '">' + h.toFixed(0) + 'h</td>'; }).join('') + '</tr>').join('') + '</tbody></table>';
  } else {
    tabela = '<table class="carga"><thead><tr><th style="width:220px">Pessoa</th>' + dias.map(d => '<th>' + DSEM[d.getDay()] + ' ' + fmt(iso(d)) + '</th>').join('') + '</tr></thead><tbody>' + equipe.map(p => { const capDia = p.cap / 5; return '<tr><th>' + esc(p.nome) + '<br><span class="sec" style="font-weight:400;font-size:12px">' + capDia.toFixed(0) + 'h por dia</span></th>' + dias.map(d => { const h = cargaDoDia(iso(d), p.id); const c = h > capDia ? 'sobre' : h > capDia * 0.8 ? 'cheio' : h < 0.5 ? 'livre' : 'ok'; return '<td class="' + c + '" title="' + esc(p.nome) + ': ' + h.toFixed(1) + 'h de ' + capDia.toFixed(0) + 'h">' + h.toFixed(1) + 'h</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  return '<div class="cal-cab"><button class="btn sec peq" type="button" data-cal-nav="-1" aria-label="Anterior">‹</button><button class="btn sec peq" type="button" data-cal-nav="0">Hoje</button><button class="btn sec peq" type="button" data-cal-nav="1" aria-label="Próximo">›</button><h3>Carga do time' + I('Workload (carga): as horas estimadas das tarefas distribuídas entre o início e o prazo, comparadas com a Capacity, a capacidade de cada pessoa') + '</h3><span class="espaco"></span><div class="seg" role="group">' + [['dia','Day'],['semana','Week'],['mes','Month']].map(([k, n]) => '<button type="button" data-carga-modo="' + k + '" aria-pressed="' + (UI.cargaModo === k) + '">' + n + '</button>').join('') + '</div></div>' +
    '<div class="tabela-rolo" style="border:0">' + tabela + '</div><div class="legenda"><span><i></i>Com folga</span><span><i style="background:var(--preto-04)"></i>Perto do limite</span><span><i style="background:var(--vermelho)"></i>Acima da capacidade</span><span>A carga soma todos os projetos da pessoa.</span></div>';
}
function vWhiteboard(){
  return '<div class="vazio" style="margin-top:0"><div class="vazio-listras" aria-hidden="true"></div><div class="vazio-texto"><h2>Canvas de estruturação</h2><p>O ' + T('Whiteboard','quadro visual livre') + ' deste projeto é o canvas do BL. Os cards do canvas vão apontar para os clientes, produtos e aplicações de verdade daqui, para existir uma coisa só em cada lugar.</p><div class="acoes" style="margin-top:12px"><a class="btn" href="https://claude.ai/artifact/GYBDTp5XrcAVbA5Z8Aqa88" target="_blank" rel="noopener">Abrir o canvas</a></div></div></div>';
}

/* ---- ficha técnica ---- */
function vSheet(){
  const chave = UI.sel;
  const f = D.sheets[chave] || (D.sheets[chave] = {campos:{}, custom:[], arquivos:[]});
  const c = cadeia(chave);
  const pai = chave.startsWith('app') ? D.sheets[c.product ? 'product:' + c.product.id : ''] || D.sheets['project:' + (c.project || {}).id] : chave.startsWith('product') ? D.sheets['project:' + (c.project || {}).id] : null;
  const paiProj = c.project ? D.sheets['project:' + c.project.id] : null;
  const dis = podeEditar() ? '' : ' disabled';
  const herdar = k => { const v = (pai && pai.campos[k]) || (paiProj && paiProj.campos[k]); return v && !chave.startsWith('project') ? v : ''; };
  return '<p class="intro">A ' + T('Tech sheet','ficha técnica') + ' de ' + esc(nomeDe(chave)) + '.' + (chave.startsWith('project') ? ' Aplicações e produtos deste projeto herdam o que for preenchido aqui.' : ' Campo vazio usa o valor do projeto. ' + T('Inherits','herda: já nasce com o que o projeto definiu')) + '</p>' +
    FICHA.map(([sec, expl, campos]) => '<section class="ficha-sec"><h3>' + (expl ? T(sec, expl) : esc(sec)) + '</h3><div class="ficha-campos">' + campos.map(cp => { const k = sec + '|' + cp, v = f.campos[k] || '', h = herdar(k); return '<label class="lb">' + esc(cp) + (h && !v ? ' <span class="herdado">herdado do projeto</span>' : '') + '<textarea class="campo" rows="2" data-ficha="' + esc(k) + '" placeholder="' + esc(h || '') + '"' + dis + '>' + esc(v) + '</textarea></label>'; }).join('') + '</div>' +
      (sec === 'Visual identity' || sec === 'Anexos e anotações' ? '<div class="arquivos">' + f.arquivos.filter(a => a.sec === sec).map((a, ix) => '<span class="arq">' + (a.url ? '<img src="' + a.url + '" alt="">' : ICO.clip) + '<span>' + esc(a.nome) + '</span></span>').join('') + (podeEditar() ? '<label class="btn sec peq" style="cursor:pointer">' + ICO.clip + 'Anexar arquivos<input type="file" multiple hidden data-anexar-ficha="' + esc(sec) + '"></label>' : '') + '</div>' : '') + '</section>').join('') +
    '<section class="ficha-sec"><h3>' + T('Custom fields','campos personalizados') + '</h3><div class="tabela-rolo" style="border:0"><table class="tabela"><thead><tr><th>Campo</th><th>Tipo</th><th>Valor</th><th style="width:60px"></th></tr></thead><tbody>' +
      f.custom.map((cf, ix) => '<tr><th scope="row">' + esc(cf.nome) + '</th><td>' + esc(cf.tipo) + '</td><td><input class="campo" data-custom="' + ix + '" value="' + esc(cf.valor) + '"' + dis + ' style="width:100%"></td><td>' + (podeEditar() ? '<button class="ico-btn" type="button" data-tirar-custom="' + ix + '" aria-label="Tirar campo">' + ICO.fechar + '</button>' : '') + '</td></tr>').join('') +
      (podeEditar() ? '<tr><td><input class="campo" id="cf-nome" placeholder="Nome do campo" style="width:100%"></td><td><select class="sel" id="cf-tipo" style="width:100%">' + ['Texto','Número','Data','Lista','Link','Pessoa','Arquivo'].map(t => '<option>' + t + '</option>').join('') + '</select></td><td><input class="campo" id="cf-valor" placeholder="Valor" style="width:100%"></td><td><button class="btn peq" type="button" data-acao="add-custom">' + ICO.mais + '</button></td></tr>' : '') +
    '</tbody></table></div></section>';
}

/* ---- etapas ---- */
function vStages(){
  const chave = UI.sel;
  const st = D.stages[chave] || (D.stages[chave] = {});
  const master = souMaster();
  let avisos = [], jaComecou = false;
  const todas = [];
  D.template.forEach((et, ie) => et.itens.forEach(it => { const cfg = Object.assign({}, it, (st['cfg_' + it.id] || {})); const r = st[it.id] || {}; todas.push({et, ie, it, cfg, r}); }));
  for (let k = todas.length - 1; k >= 0; k--){ const x = todas[k]; if (x.r.feito) jaComecou = true; else if (jaComecou && x.cfg.obrig && x.cfg.modo !== 'Desligado' && !x.r.dispensa) avisos.push(x); }
  avisos.reverse();
  const linhas = D.template.map((et, ie) => et.itens.map((it, ii) => {
    const cfg = Object.assign({}, it, (st['cfg_' + it.id] || {})); const r = st[it.id] || {};
    const estado = r.feito ? '<span class="st st-done">' + ICO_ST.done + 'Cumprido</span>' : r.dispensa ? '<span class="st st-backlog">' + ICO_ST.backlog + 'Waiver</span>' : cfg.modo === 'Desligado' ? '<span class="sec">Desligado</span>' : '<span class="st st-todo">' + ICO_ST.todo + 'Pendente</span>';
    const quem = r.quem ? esc((pessoa(r.quem) || {nome:''}).nome) + ' · ' + fmt(r.quando) : '';
    const prova = r.prova ? (r.prova.url ? '<img src="' + r.prova.url + '" alt="Prova" style="width:44px;height:44px;object-fit:cover;vertical-align:middle"> ' : '') + '<span class="sec" style="font-size:12px">' + esc(r.prova.tipo + ': ' + (r.prova.valor || r.prova.nome || '')) + '</span>' : r.dispensa ? '<span class="sec" style="font-size:12px">' + esc(r.dispensa) + '</span>' : '';
    return '<tr' + (et.nome === 'Approval' ? ' class="destaque"' : '') + '>' + (ii === 0 ? '<th scope="rowgroup" rowspan="' + et.itens.length + '">' + esc(et.nome) + I(et.nome + ' (' + et.expl + ')') + '<div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400;margin-top:4px">' + esc(et.lente) + '</div></th>' : '') +
      '<td>' + esc(cfg.texto) + (cfg.obrig ? '' : ' <span class="sec">(opcional)</span>') + '</td>' +
      '<td>' + (master ? '<select class="sel peq" data-cfg="' + it.id + '" data-campo="modo">' + MODOS.map(mo => '<option' + (cfg.modo === mo ? ' selected' : '') + '>' + mo + '</option>').join('') + '</select>' : esc(cfg.modo)) + '</td>' +
      '<td>' + (master ? '<select class="sel peq" data-cfg="' + it.id + '" data-campo="prova">' + PROVAS.map(p => '<option' + (cfg.prova === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select>' : esc(cfg.prova)) + '</td>' +
      '<td>' + estado + '<div class="sec" style="font-size:11px;margin-top:2px">' + quem + '</div></td>' +
      '<td>' + prova + '</td>' +
      '<td>' + (podeEditar() ? (r.feito || r.dispensa ? '<button class="btn fant peq" type="button" data-desfazer-item="' + it.id + '">Reabrir</button>' : '<div class="acoes"><button class="btn peq" type="button" data-cumprir="' + it.id + '">Cumprir</button><button class="btn fant peq" type="button" data-dispensar="' + it.id + '">Waiver</button></div>') : '') + '</td></tr>';
  }).join('')).join('');
  return (avisos.length ? '<div class="aviso-faixa"><b>Avisos</b><span>' + avisos.length + ' ' + (avisos.length === 1 ? 'item obrigatório está pendente' : 'itens obrigatórios estão pendentes') + ' em etapas anteriores: ' + avisos.slice(0, 3).map(x => esc(x.et.nome + ' · ' + x.cfg.texto)).join('; ') + (avisos.length > 3 ? '...' : '') + '. Por enquanto só avisa, nenhum item trava.</span></div>' : '') +
    '<p class="intro">As ' + T('Stage gates','etapas obrigatórias') + ' de ' + esc(nomeDe(chave)) + '. ' + (master ? 'Como Master, você escolhe o modo e a prova de cada item. A mudança vale só para este ' + (chave.startsWith('app') ? 'aplicativo' : 'projeto') + '; o modelo padrão fica em Settings.' : 'Quem executa marca o item e anexa a prova pedida.') + '</p>' +
    '<div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:13%"><col style="width:24%"><col style="width:10%"><col style="width:14%"><col style="width:12%"><col style="width:16%"><col style="width:11%"></colgroup><thead><tr><th>Etapa</th><th>Item</th><th>Modo</th><th>Prova pedida' + '</th><th>Estado</th><th>Prova anexada</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
}

/* ---- gaveta do item ---- */
let itemAberto = null, timerCron = null;
function abrirItem(id){
  const i = byId('issues', id); if (!i) return;
  itemAberto = id;
  if (!$('#gaveta-wrap')){ const g = document.createElement('div'); g.id = 'gaveta-wrap'; document.body.appendChild(g); }
  const pode = podeEditar(), dis = pode ? '' : ' disabled';
  const correndo = i.tempo.find(t => !t.fim);
  const totalMin = i.tempo.reduce((s, t) => s + ((t.fim || Date.now()) - t.ini) / 60000, 0);
  const outros = D.issues.filter(x => x.id !== i.id && !x.arquivado && appDe(x) && appDe(i) && appDe(x).project === appDe(i).project);
  const wsOpts = D.ws.map(w => '<option value="' + w.id + '"' + (w.id === i.ws ? ' selected' : '') + '>' + esc(byId('apps', w.app).nome + ' › ' + w.nome) + '</option>').join('');
  const campo = (rotulo, info, controle, icone) => '<div class="d-lin"><span class="d-rot">' + esc(rotulo) + (info ? I(info) : '') + '</span><span class="d-val">' + (icone || '') + controle + '</span></div>';
  const sel = (g, opts, atual) => '<select class="sel d-sel" data-g="' + g + '"' + dis + '>' + opts.map(([v, n]) => '<option value="' + v + '"' + (atual === v ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
  const ck = i.check.filter(x => x.f).length;
  const trilha = caminho('ws:' + i.ws).map(p => esc(p[1])).join(' › ');
  const html = '<div class="veu" data-fechar-gaveta></div><aside class="gaveta larga" role="dialog" aria-modal="true" aria-labelledby="g-tit">' +
    '<div class="gaveta-cab">' + tipoHTML(i.tipo, true) + '<span class="g-trilha">' + trilha + '</span><button class="ico-btn" type="button" data-fechar-gaveta aria-label="Fechar">' + ICO.fechar + '</button></div>' +
    '<div class="g-duas">' +
      '<div class="g-principal">' +
        '<textarea class="g-titulo" id="g-tit" data-g="titulo" rows="1"' + dis + ' aria-label="Título">' + esc(i.titulo) + '</textarea>' +
        '<div class="g-faixa">' + stHTML(i.status) + prioHTML(i.prio, true) + (atrasado(i) ? '<span class="g-atraso">Atrasado desde ' + fmt(i.fim) + '</span>' : '') + (i.vis === 'cliente' ? '<span class="g-vis">Visível ao cliente</span>' : '') + '</div>' +
        '<section class="g-sec"><h4>Descrição</h4><textarea class="campo" data-g="desc" rows="4"' + dis + ' placeholder="O que precisa ser feito e como saber que ficou pronto">' + esc(i.desc) + '</textarea></section>' +
        '<section class="g-sec"><h4>References' + I('References (referências: imagens, arquivos, áudios, vídeos e links que ajudam a entender o item)') + ((i.refs || []).length ? '<span class="g-cont">' + i.refs.length + '</span>' : '') + '</h4>' + refsHTML(i.refs, 'issue:' + i.id, pode) + '</section>' +
        '<section class="g-sec"><h4>Checklist' + I('Checklist (lista de conferência)') + (i.check.length ? '<span class="g-cont">' + ck + ' de ' + i.check.length + '</span>' : '') + '</h4>' + (i.check.length ? '<div class="progresso" style="margin-bottom:6px"><i style="width:' + (ck / i.check.length * 100) + '%"></i></div>' : '') + '<ul class="g-lista">' + i.check.map((c, ix) => '<li><label class="g-ck"><input type="checkbox" data-check="' + ix + '"' + (c.f ? ' checked' : '') + dis + '><span' + (c.f ? ' class="feito"' : '') + '>' + esc(c.t) + '</span></label></li>').join('') + '</ul>' + (pode ? '<form class="g-add" data-form="check"><input class="campo" name="t" placeholder="Adicionar item à checklist"><button class="btn sec peq" type="submit">Adicionar</button></form>' : '') + '</section>' +
        '<section class="g-sec"><h4>Links' + I('Links (ligações entre itens: bloqueia, é bloqueado por, tem relação com)') + '</h4><ul class="g-lista">' + i.links.map((l, ix) => { const o = byId('issues', l.alvo); return o ? '<li class="g-link"><span class="g-lk-tipo">' + esc(l.tipo) + '</span>' + tipoHTML(o.tipo) + '<button class="g-lk-nome" type="button" data-abrir-item="' + o.id + '">' + esc(o.titulo) + '</button>' + stHTML(o.status) + (pode ? '<button class="ico-btn" type="button" data-tirar-link="' + ix + '" aria-label="Tirar ligação">' + ICO.fechar + '</button>' : '') + '</li>' : ''; }).join('') + '</ul>' +
          (pode && outros.length ? '<form class="g-add" data-form="link"><select class="sel" name="tipo">' + ['Blocks','Is blocked by','Relates to','Duplicates'].map(t => '<option>' + t + '</option>').join('') + '</select><select class="sel" name="alvo" style="flex:1;min-width:0">' + outros.map(o => '<option value="' + o.id + '">' + esc(o.titulo) + '</option>').join('') + '</select><button class="btn sec peq" type="submit">Ligar</button></form>' : '') + '</section>' +
        '<section class="g-sec"><h4>Comments' + I('Comments (comentários)') + '</h4>' + (i.coments.length ? i.coments.map(c => '<div class="g-com' + (c.cliente ? ' cliente' : '') + '">' + avatar(c.quem) + '<div><div class="quem">' + esc((pessoa(c.quem) || {nome:''}).nome) + ' · ' + fmt(c.quando) + (c.cliente ? ' · stakeholder' : '') + '</div><div>' + esc(c.txt) + '</div></div></div>').join('') : '<p class="sec" style="margin:0;font-size:13px">Nenhum comentário.</p>') + '<form class="g-add" data-form="coment"><input class="campo" name="t" placeholder="Escrever um comentário"><button class="btn sec peq" type="submit">Comentar</button></form></section>' +
      '</div>' +
      '<div class="g-lateral">' +
        '<section class="g-cartao"><h4>Detalhes</h4>' +
          campo('Status', null, sel('status', STATUS.map(s => [s.id, s.nome + ' · ' + s.expl]), i.status), '<span class="st st-' + i.status + ' so-ico">' + ICO_ST[i.status] + '</span>') +
          campo('Priority', 'Priority (prioridade)', sel('prio', PRIOS.map(p => [p.id, p.nome + ' · ' + p.expl]), i.prio), prioHTML(i.prio)) +
          campo('Assignee', 'Assignee (responsável, quem vai fazer)', sel('resp', [['', 'Sem responsável']].concat(D.people.filter(p => p.acesso !== 'stakeholder').map(p => [p.id, p.nome])), i.resp || ''), avatar(i.resp)) +
          campo('Tipo', null, sel('tipo', TIPOS.map(t => [t.id, t.nome + ' · ' + t.expl]), i.tipo), tipoHTML(i.tipo)) +
          campo('Workstream', 'Workstream (frente de trabalho onde o item fica)', '<select class="sel d-sel" data-g="ws"' + dis + '>' + wsOpts + '</select>') +
          campo('Visibility', 'Visibility (visibilidade: só interno ou visível ao cliente no painel dele)', sel('vis', [['interno','Só interno'],['cliente','Visível ao cliente']], i.vis)) +
        '</section>' +
        '<section class="g-cartao"><h4>Datas</h4>' +
          campo('Start date', 'Start date (data de início)', '<input class="campo d-sel" type="date" data-g="ini" value="' + esc(i.ini || '') + '"' + dis + '>') +
          campo('Due date', 'Due date (prazo)', '<input class="campo d-sel' + (atrasado(i) ? ' atrasado' : '') + '" type="date" data-g="fim" value="' + esc(i.fim || '') + '"' + dis + '>') +
          campo('Target date', 'Target date (data prevista de entrega)', '<input class="campo d-sel" type="date" data-g="alvo" value="' + esc(i.alvo || '') + '"' + dis + '>') +
          campo('Estimate', 'Estimate (estimativa de esforço, em horas)', '<input class="campo d-sel" type="number" min="0" data-g="est" value="' + esc(i.est || 0) + '"' + dis + '><span class="sec" style="font-size:12px">h</span>') +
        '</section>' +
        '<section class="g-cartao"><h4>Time tracking' + I('Time tracking (controle de tempo): o cronômetro registra quanto tempo foi gasto no item') + '</h4><div class="cronometro"><span id="g-cron">' + Math.floor(totalMin / 60) + 'h ' + String(Math.floor(totalMin % 60)).padStart(2,'0') + 'min</span>' + (pode ? '<button class="btn ' + (correndo ? 'acento' : '') + '" type="button" data-acao="cron">' + (correndo ? 'Parar' : 'Iniciar') + '</button>' : '') + '</div>' + (i.est ? '<div class="progresso" style="margin-top:8px"><i style="width:' + Math.min(100, totalMin / 60 / i.est * 100) + '%"></i></div><div class="sec" style="font-size:12px;margin-top:4px">de ' + i.est + 'h estimadas</div>' : '') + '</section>' +
        '<section class="g-cartao"><h4>Time blocking' + I('Time blocking (reservar um horário no calendário para trabalhar no item)') + '</h4>' +
          campo('Dia', null, '<input class="campo d-sel" type="date" data-bloco="data" value="' + esc(i.bloco ? i.bloco.data : '') + '"' + dis + '>') +
          campo('Das', null, '<input class="campo d-sel" type="time" data-bloco="ini" value="' + esc(i.bloco ? i.bloco.ini : '') + '"' + dis + '>') +
          campo('Até', null, '<input class="campo d-sel" type="time" data-bloco="fim" value="' + esc(i.bloco ? i.bloco.fim : '') + '"' + dis + '>') +
        '</section>' +
        (pode ? '<button class="btn fant" type="button" data-acao="arquivar-item" style="justify-self:start">Arquivar item</button>' : '') +
      '</div>' +
    '</div></aside>';
  $('#gaveta-wrap').innerHTML = html;
  const tt = $('#g-tit'); if (tt){ const aj = () => { tt.style.height = 'auto'; tt.style.height = tt.scrollHeight + 'px'; }; aj(); tt.addEventListener('input', aj); }
  clearInterval(timerCron);
  if (correndo) timerCron = setInterval(() => { const x = byId('issues', itemAberto); if (!x){ clearInterval(timerCron); return; } const t = x.tempo.reduce((s, tt2) => s + ((tt2.fim || Date.now()) - tt2.ini) / 60000, 0); const el = $('#g-cron'); if (el) el.textContent = Math.floor(t / 60) + 'h ' + String(Math.floor(t % 60)).padStart(2,'0') + 'min ' + String(Math.floor((t * 60) % 60)).padStart(2,'0') + 's'; }, 1000);
}
function fecharItem(){ itemAberto = null; clearInterval(timerCron); const g = $('#gaveta-wrap'); if (g) g.innerHTML = ''; render(); }

/* ---- arrastar e soltar ---- */
function ligarArrastar(){
  $$('[data-item][draggable="true"]').forEach(c => {
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.item); e.dataTransfer.effectAllowed = 'move'; c.classList.add('arrastando'); });
    c.addEventListener('dragend', () => c.classList.remove('arrastando'));
  });
  $$('[data-soltar-status],[data-soltar-data]').forEach(z => {
    z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('sobre'); });
    z.addEventListener('dragleave', () => z.classList.remove('sobre'));
    z.addEventListener('drop', e => {
      e.preventDefault(); z.classList.remove('sobre');
      const i = byId('issues', e.dataTransfer.getData('text/plain')); if (!i) return;
      if (z.dataset.soltarStatus){ mudarStatus(i, z.dataset.soltarStatus); }
      if (z.dataset.soltarData){ const dur = i.ini && i.fim ? (parse(i.fim) - parse(i.ini)) / 864e5 : 0; registrar('prazo', i, i.titulo + ' → ' + fmt(z.dataset.soltarData)); i.fim = z.dataset.soltarData; if (i.ini && parse(i.ini) > parse(i.fim)) i.ini = iso(dAdd(parse(i.fim), -dur)); toast('Prazo mudado para ' + fmt(i.fim)); }
      salvar(); rView();
    });
  });
}
function mudarStatus(i, s){
  if (i.status === s) return;
  registrar(s === 'done' ? 'concluiu' : 'status', i, s === 'done' ? i.titulo : i.titulo + ' → ' + stNome(s));
  i.status = s;
  i.feito = s === 'done' ? iso(HOJE) : null;
  toast('"' + i.titulo + '" foi para ' + stNome(s));
}

/* ================= CLIENTS ================= */
function rClientes(){
  const el = $('#m-clientes');
  const usos = t => D.tagLinks.filter(l => l.tag === t).length;
  if (UI.cliPag === 'tags'){
    el.innerHTML = '<nav class="nav-niveis" aria-label="Voltar"><button class="btn sec peq" type="button" data-acao="cli-clientes">‹ Voltar para Clients</button><span class="nav-trilha"><button type="button" data-acao="cli-clientes">Clients</button><span class="sep">›</span><b>Tags</b></span></nav>' +
      '<div class="topo-tela" style="margin-top:16px"><div><h1><span>Tags</span>' + I('Tags (etiquetas livres: criadas, editadas e apagadas à vontade)') + '</h1><p class="lead">As etiquetas livres dos clientes, projetos, produtos e aplicações. As automáticas, com cadeado, vêm das ligações e não aparecem aqui porque ninguém apaga.</p></div><div class="acoes"><button class="btn" type="button" data-acao="nova-tag">' + ICO.mais + 'Nova tag</button></div></div>' +
      '<div class="tabela-rolo" style="margin-top:24px"><table class="tabela"><colgroup><col style="width:22%"><col style="width:16%"><col style="width:36%"><col style="width:10%"><col style="width:16%"></colgroup><thead><tr><th>Tag</th><th>Categoria</th><th>Descrição</th><th>Em uso</th><th></th></tr></thead><tbody>' +
      D.tags.map(t => '<tr><th scope="row"><span class="tag" style="--c:' + esc(t.cor) + '"><i class="cor"></i>' + esc(t.nome) + '</span></th><td>' + esc(t.cat) + '</td><td class="sec">' + esc(t.desc) + '</td><td>' + usos(t.id) + '</td><td><div class="acoes"><button class="btn sec peq" type="button" data-editar-tag="' + t.id + '">Editar</button><button class="btn fant peq" type="button" data-apagar-tag="' + t.id + '">Excluir</button></div></td></tr>').join('') +
      '</tbody></table></div>';
    return;
  }
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Clients</span>' + I('Clients (clientes): quem contrata a IT.IA, de dentro ou de fora do grupo') + '</h1><p class="lead">Todos os clientes, inclusive a holding e as empresas ligadas a ela.</p></div><div class="acoes"><button class="btn sec" type="button" data-acao="cli-tags">Gerenciar tags</button><button class="btn" type="button" data-acao="novo-cliente">' + ICO.mais + 'Novo cliente</button></div></div>' +
    '<div class="tabela-rolo" style="margin-top:24px"><table class="tabela"><colgroup><col style="width:22%"><col style="width:10%"><col style="width:16%"><col style="width:32%"><col style="width:10%"><col style="width:10%"></colgroup><thead><tr><th>Cliente</th><th>Tipo</th><th>Holding</th><th>Tags</th><th>Projetos</th><th></th></tr></thead><tbody>' +
    D.clients.map(c => { const h = c.holding ? byId('clients', c.holding) : null; const projs = D.projects.filter(p => p.client === c.id).length + D.products.filter(p => p.client === c.id).length; return '<tr><th scope="row">' + esc(c.nome) + '</th><td>' + ({holding:'Holding', empresa:'Empresa', pessoa:'Pessoa'}[c.tipo] || c.tipo) + '</td><td>' + (h ? esc(h.nome) : '<span class="sec">Nenhuma</span>') + '</td><td>' + tagsHTML('client', c.id, 'client:' + c.id) + '</td><td>' + projs + '</td><td><button class="btn sec peq" type="button" data-editar-cliente="' + c.id + '">Editar</button></td></tr>'; }).join('') +
    '</tbody></table></div>';
}
function formCliente(c){
  c = c || {nome:'', tipo:'empresa', holding:'', doc:''};
  return '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="fc-nome" value="' + esc(c.nome) + '"></label><label class="lb">Tipo' + I('Tipo de cliente: Holding é a empresa que controla outras, como a Blanco & Lisboa. Empresa é uma companhia, do grupo ou de fora. Pessoa é um cliente pessoa física') + '<select class="sel" id="fc-tipo">' + [['holding','Holding'],['empresa','Empresa'],['pessoa','Pessoa']].map(([k, n]) => '<option value="' + k + '"' + (c.tipo === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb">Pertence à holding' + I('Holding: a empresa que controla este cliente. Ao escolher, o sistema cria sozinho a etiqueta automática da ligação') + '<select class="sel" id="fc-hold"><option value="">Nenhuma</option>' + D.clients.filter(x => x.tipo === 'holding' && x.id !== c.id).map(x => '<option value="' + x.id + '"' + (c.holding === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">CNPJ ou CPF<input class="campo" id="fc-doc" value="' + esc(c.doc || '') + '"></label></div>' +
    '<div class="bloco-g"><h4>Tags</h4><div class="tags">' + D.tags.map(t => '<label class="tag" style="--c:' + esc(t.cor) + ';cursor:pointer"><input type="checkbox" data-fc-tag="' + t.id + '"' + (c.id && D.tagLinks.some(l => l.tipo === 'client' && l.id === c.id && l.tag === t.id) ? ' checked' : '') + '><i class="cor"></i>' + esc(t.nome) + '</label>').join('') + '</div></div>';
}
function salvarCliente(dlg, c){
  const nome = $('#fc-nome', dlg).value.trim(); if (!nome){ toast('Escreva o nome do cliente'); return false; }
  const novo = !c; c = c || {id:uid('cl'), status:'active'};
  c.nome = nome; c.tipo = $('#fc-tipo', dlg).value; c.holding = $('#fc-hold', dlg).value || null; c.doc = $('#fc-doc', dlg).value;
  if (novo) D.clients.push(c);
  D.tagLinks = D.tagLinks.filter(l => !(l.tipo === 'client' && l.id === c.id));
  $$('[data-fc-tag]', dlg).forEach(x => { if (x.checked) D.tagLinks.push({tag:x.dataset.fcTag, tipo:'client', id:c.id}); });
  salvar(); render(); toast(novo ? 'Cliente criado' : 'Cliente salvo');
}
function formTag(t){
  t = t || {nome:'', cor:'#2E2E31', cat:'', desc:''};
  const cores = [['#050506','Preto'],['#2E2E31','Grafite'],['#B9B9BE','Névoa'],['#FF0000','Vermelho']];
  return '<div class="grade-form"><label class="lb">Nome<input class="campo" id="ft-nome" value="' + esc(t.nome) + '"></label><label class="lb">Categoria<input class="campo" id="ft-cat" value="' + esc(t.cat) + '" list="cats"><datalist id="cats">' + [...new Set(D.tags.map(x => x.cat))].map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></label>' +
    '<label class="lb">Cor<select class="sel" id="ft-cor">' + cores.map(([v, n]) => '<option value="' + v + '"' + (t.cor === v ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label><label class="lb largo">Descrição<textarea class="campo" id="ft-desc">' + esc(t.desc) + '</textarea></label></div>';
}


/* ---- referências: imagens, arquivos, áudios, vídeos e links em qualquer registro ---- */
const ICO_ARQ = {
  imagem: SV('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'),
  'áudio': SV('<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>'),
  'vídeo': SV('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>'),
  link: SV('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  arquivo: SV('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>')
};
function refsHTML(lista, alvo, pode){
  lista = lista || [];
  return '<div class="refs">' + (lista.length ? '<div class="refs-grade">' + lista.map((r, ix) => {
      const prev = r.tipo === 'imagem' && r.url ? '<button class="ref-prev" type="button" data-ver-ref="' + alvo + '|' + ix + '" aria-label="Ampliar ' + esc(r.nome) + '"><img src="' + r.url + '" alt=""></button>'
        : r.tipo === 'áudio' && r.url ? '<audio controls src="' + r.url + '" preload="none"></audio>'
        : '<span class="ref-ico">' + (ICO_ARQ[r.tipo] || ICO_ARQ.arquivo) + '</span>';
      const nome = r.tipo === 'link' ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.nome) + '</a>' : esc(r.nome);
      return '<div class="ref ref-' + (r.tipo === 'áudio' ? 'audio' : r.tipo) + '">' + prev + '<div class="ref-info"><b>' + nome + '</b><small>' + esc(r.tipo) + (r.tam ? ' · ' + (r.tam > 1048576 ? (r.tam / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(r.tam / 1024)) + ' KB') : '') + (r.tipo !== 'link' && !r.url ? ' · só o nome guardado neste protótipo' : '') + '</small></div>' + (pode ? '<button class="ico-btn" type="button" data-tirar-ref="' + alvo + '|' + ix + '" aria-label="Tirar referência">' + ICO.fechar + '</button>' : '') + '</div>';
    }).join('') + '</div>' : '') +
    (pode ? '<div class="refs-add"><label class="solta"><input type="file" multiple data-refs-add="' + alvo + '" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"><span class="solta-ico">' + ICO.clip + '</span><span><b>Adicionar referências</b><small>Imagens, arquivos, áudios e vídeos. Pode escolher vários.</small></span></label>' +
      '<form class="g-add" data-form="ref-link" data-alvo="' + alvo + '"><input class="campo" name="t" placeholder="Ou cole um link de referência (site, Figma, vídeo...)"><button class="btn sec peq" type="submit">Adicionar link</button></form></div>' : '') + '</div>';
}
function refsDe(alvo){
  const [t, id] = alvo.split(':');
  if (t === 'issue'){ const i = byId('issues', id); if (i){ i.refs = i.refs || []; return i.refs; } }
  if (t === 'req'){ const r = byId('requests', id); if (r){ r.anexos = r.anexos || []; return r.anexos; } }
  return null;
}
function reRenderRefs(alvo){ if (alvo.startsWith('issue:')) abrirItem(alvo.slice(6)); else rServiceDesk(); }

/* ================= SERVICE DESK ================= */
const TIPOS_PED = [
  ['Bug report','relato de falha','bug'],['Fix request','pedido de correção','fix'],['Change request','pedido de mudança','change'],['Feature request','pedido de funcionalidade nova','feature'],['Question','dúvida','question']
];
const ICO_PED = {
  bug: SV('<path d="M8 8a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0z"/><path d="M12 13v7M4 11h4M16 11h4M5 5l3 3M19 5l-3 3M5 19l3-2M19 19l-3-2"/>'),
  fix: SV('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.5 2.5-2.5-.7-.7-2.5z"/>'),
  change: SV('<path d="M4 7h13l-3-3M20 17H7l3 3"/>'),
  feature: SV('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>'),
  question: SV('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.5v.01"/>')
};
const chaveTipoPed = t => (TIPOS_PED.find(x => x[0] === t) || ['','','question'])[2];
const EST_PED = [
  ['Em triagem','triagem', SV('<path d="M4 5h16l-6 7v6l-4 2v-8z"/>')],
  ['Aguardando você','aguardando', SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')],
  ['Em andamento','andamento', ICO_ST.doing],
  ['Resolvido pela IA','ia', SV('<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M12 3v4M9 12v2M15 12v2"/>')],
  ['Resolvido','resolvido', ICO_ST.done],
  ['Recusado','recusado', ICO_ST.blocked]
];
const estPedHTML = s => { const e = EST_PED.find(x => x[0] === s) || EST_PED[0]; return '<span class="pill pe-' + e[1] + '">' + e[2] + esc(s) + '</span>'; };
const GRAV = [['Sistema parado','critico'],['Função quebrada','alto'],['Incômodo','medio'],['Cosmético','baixo']];
const gravHTML = g => { const k = (GRAV.find(x => x[0] === g) || GRAV[2])[1]; return '<span class="pill gv-' + k + '">' + ICO_SAUDE[k === 'critico' ? 'critico' : k === 'alto' || k === 'medio' ? 'atencao' : 'ok'] + esc(g) + '</span>'; };
const avatarCliente = c => '<span class="avatar av-cli" title="' + esc(c ? c.nome : '') + '">' + esc(ini(c ? c.nome : '?')) + '</span>';

function rServiceDesk(){
  const el = $('#m-servicedesk');
  const stake = UI.verComo === 'stakeholder';
  let base = D.requests.slice().sort((a, b) => b.quando.localeCompare(a.quando));
  if (stake) base = base.filter(r => r.cliente === cliStake());
  const lista = UI.filtroPed === 'todos' ? base : base.filter(r => r.status === UI.filtroPed);
  const sel = lista.find(r => r.id === UI.pedSel) || lista[0];
  const contar = s => base.filter(r => r.status === s).length;
  const cliente = r => byId('clients', r.cliente);
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Service Desk</span>' + I('Service Desk (central de atendimento): os pedidos e comentários dos stakeholders, com a IA respondendo primeiro') + '</h1><p class="lead">' + (stake ? 'Os seus pedidos e o andamento de cada um.' : 'A IA conversa primeiro com o cliente e passa para você só o que for real.') + '</p></div><div class="acoes"><button class="btn" type="button" data-acao="novo-pedido">' + ICO.mais + 'Novo pedido</button></div></div>' +
    '<div class="sd-kpis" role="group" aria-label="Filtrar por status"><button type="button" class="sd-kpi' + (UI.filtroPed === 'todos' ? ' ativo' : '') + '" data-filtro-ped="todos"><b>' + base.length + '</b><span>Todos</span></button>' +
      EST_PED.map(([s, k, ic]) => '<button type="button" class="sd-kpi pe-' + k + (UI.filtroPed === s ? ' ativo' : '') + '" data-filtro-ped="' + esc(s) + '"><b>' + contar(s) + '</b><span>' + ic + esc(s) + '</span></button>').join('') + '</div>' +
    '<div class="sd"><div class="sd-lista">' + (lista.length ? lista.map(r => { const k = chaveTipoPed(r.tipo); return '<div class="sd-item' + (sel && sel.id === r.id ? ' escolhido' : '') + '" data-ped="' + r.id + '" tabindex="0"><span class="sd-ico tp-' + k + '">' + ICO_PED[k] + '</span><div class="sd-meio"><div class="sd-l1"><span>' + esc(r.tipo) + '</span><span>' + fmt(r.quando) + '</span></div><div class="sd-tt">' + esc(r.titulo) + '</div><div class="sd-l2">' + avatarCliente(cliente(r)) + '<span>' + esc((byId('apps', r.app) || {nome:''}).nome) + '</span>' + estPedHTML(r.status) + '</div></div></div>'; }).join('') : '<p class="vazio-linha">Nenhum pedido neste filtro.</p>') + '</div>' +
    (sel ? (() => { const k = chaveTipoPed(sel.tipo); const cl = cliente(sel); const app = byId('apps', sel.app) || {nome:''}; const iss = sel.issue && byId('issues', sel.issue);
      return '<div class="sd-det"><div class="sd-cab"><div class="sd-cab-l"><span class="sd-ico grande tp-' + k + '">' + ICO_PED[k] + '</span><div><div class="sd-l1"><span>' + esc(sel.tipo) + ' · ' + esc(cl ? cl.nome : '') + '</span></div><h2>' + esc(sel.titulo) + '</h2></div></div>' +
        (iss ? '<button class="btn sec" type="button" data-abrir-item="' + iss.id + '">Abrir item no board</button>' : (stake ? '' : '<button class="btn" type="button" data-acao="virar-issue" data-id="' + sel.id + '">Converter em Issue</button>')) + '</div>' +
        '<div class="sd-props">' +
          '<div class="sd-prop"><span>Status</span>' + (stake ? estPedHTML(sel.status) : '<select class="sel peq" data-ped-campo="status">' + EST_PED.map(([g]) => '<option' + (sel.status === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select>') + '</div>' +
          '<div class="sd-prop"><span>Severity' + I('Severity (gravidade: sistema parado, função quebrada, incômodo ou cosmético)') + '</span>' + (stake ? gravHTML(sel.grav) : '<select class="sel peq" data-ped-campo="grav">' + GRAV.map(([g]) => '<option' + (sel.grav === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select>') + '</div>' +
          '<div class="sd-prop"><span>Aplicação</span><b>' + esc(app.nome) + '</b></div>' +
          '<div class="sd-prop"><span>Cliente</span><b style="display:flex;gap:8px;align-items:center">' + avatarCliente(cl) + esc(cl ? cl.nome : '') + '</b></div>' +
          '<div class="sd-prop largo"><span>Context capture' + I('Context capture (captura automática de contexto: tela, versão, aparelho e erros, enviados junto com o pedido)') + '</span><code>' + esc(sel.contexto) + '</code></div>' +
          '</div>' +
        '<section class="g-sec"><h4>References' + I('References (referências: prints, arquivos, áudios, vídeos e links enviados junto com o pedido)') + (sel.anexos.length ? '<span class="g-cont">' + sel.anexos.length + '</span>' : '') + '</h4>' + refsHTML(sel.anexos, 'req:' + sel.id, true) + '</section>' +
        '<div class="sd-conversa">' + sel.msgs.map(m => { const quem = m.de === 'ia' ? 'Agente de atendimento' : m.de === 'voce' ? ((pessoa(idEu('master')) || {nome:'Equipe'}).nome) : (cl ? cl.nome : 'Cliente'); const av = m.de === 'ia' ? '<span class="avatar av-ia">IA</span>' : m.de === 'voce' ? avatar(idEu('master')) : avatarCliente(cl);
          return '<div class="bolha b-' + m.de + '">' + av + '<div class="bolha-c"><div class="bolha-quem">' + esc(quem) + (m.de === 'ia' ? '<span class="simulado">exemplo</span>' : '') + '</div><div class="bolha-txt">' + esc(m.txt) + '</div></div></div>'; }).join('') + '</div>' +
        '<form class="sd-resp" data-form="resp-ped"><input class="campo" name="t" placeholder="' + (stake ? 'Responder' : 'Responder ao cliente') + '"><button class="btn" type="submit">Enviar</button></form></div>'; })() : '<div class="vazio-linha">Selecione um pedido.</div>') + '</div>';
}
function formPedido(){
  const apps = UI.verComo === 'stakeholder' ? D.apps.filter(a => a.project === pjStake()) : D.apps;
  return '<div class="bloco-g"><h4>O que você quer enviar</h4><div class="tiles">' + TIPOS_PED.map(([t, expl, k], ix) => '<label class="tile"><input type="radio" name="fp-tipo" value="' + t + '"' + (ix === 0 ? ' checked' : '') + '><span class="tile-c"><span class="sd-ico tp-' + k + '">' + ICO_PED[k] + '</span><b>' + esc(expl[0].toUpperCase() + expl.slice(1)) + '</b><small>' + t + '</small></span></label>').join('') + '</div></div>' +
    '<div class="grade-form"><label class="lb">Aplicação<select class="sel" id="fp-app">' + apps.map(a => '<option value="' + a.id + '">' + esc(a.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb largo">Assunto<input class="campo" id="fp-tit" placeholder="Em uma frase, o que aconteceu ou o que você precisa"></label>' +
    '<label class="lb largo">Descrição<textarea class="campo" id="fp-desc" rows="4" placeholder="Conte com detalhes. Se for uma falha, diga o que fez antes dela aparecer."></textarea></label></div>' +
    '<label class="solta"><input type="file" id="fp-arq" multiple accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"><span class="solta-ico">' + ICO.clip + '</span><span><b>Referências: prints, arquivos, áudios e vídeos</b><small id="fp-arq-n">Clique para escolher. Pode escolher vários.</small></span></label>' +
    '<label class="lb">Link de referência, se tiver<input class="campo" id="fp-link" placeholder="https://"></label><p class="sec" style="margin:0;font-size:13px">Junto com o pedido vão a tela, a versão do sistema e o aparelho, sem precisar escrever.</p>';
}

/* ================= TEAM ================= */
const PAPEL = {owner:['Owner · Master','owner'], dev:['Dev','dev'], stakeholder:['Stakeholder','stake']};
function rTime(){
  const el = $('#m-time');
  const dias = Array.from({length:7}, (_, k) => dAdd(HOJE, k - HOJE.getDay())).filter(d => d.getDay() > 0 && d.getDay() < 6);
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Team</span>' + I('Team (time): as pessoas, o que cada uma faz e quanto tempo tem') + '</h1><p class="lead">A base que o AI PO usa para planejar: função, habilidades e ' + T('Capacity','capacidade: horas disponíveis por semana') + ' de cada pessoa.</p></div><div class="acoes"><button class="btn so-master" type="button" data-acao="nova-pessoa">' + ICO.mais + 'Nova pessoa</button></div></div>' +
    '<div class="pessoas">' + D.people.map(p => {
      const h = dias.reduce((s, d) => s + cargaDoDia(iso(d), p.id), 0); const pct = p.cap ? Math.min(100, h / p.cap * 100) : 0;
      const nivel = !p.cap ? '' : h > p.cap ? 'sobre' : h > p.cap * 0.8 ? 'cheio' : 'ok';
      const its = D.issues.filter(i => !i.arquivado && i.resp === p.id && i.status !== 'done');
      const pap = PAPEL[p.acesso] || PAPEL.dev;
      return '<article class="pessoa"><div class="pessoa-topo"><span class="avatar grande">' + esc(ini(p.nome)) + '</span><div class="pessoa-nome"><h3>' + esc(p.nome) + '</h3><span class="pill pp-' + pap[1] + '">' + esc(p.funcao || pap[0]) + '</span></div>' +
        '<div class="pessoa-acoes so-master"><button class="ico-btn" type="button" data-editar-pessoa="' + p.id + '" aria-label="Editar ' + esc(p.nome) + '" title="Editar">' + SV('<path d="M4 20h4L20 8l-4-4L4 16z"/>') + '</button>' + (p.id !== idEu('master') ? '<button class="ico-btn perigo" type="button" data-excluir-pessoa="' + p.id + '" aria-label="Excluir ' + esc(p.nome) + '" title="Excluir">' + SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>') + '</button>' : '') + '</div></div>' +
        (p.skills.length ? '<div class="tags">' + p.skills.map(s => '<span class="tag">' + esc(s) + '</span>').join('') + '</div>' : '<span class="sec" style="font-size:13px">Sem habilidades cadastradas</span>') +
        (p.cap ? '<div class="carga-p"><div class="carga-p-l"><span>Carga desta semana</span><b class="c-' + nivel + '">' + h.toFixed(0) + 'h de ' + p.cap + 'h</b></div><div class="progresso grosso"><i class="c-' + nivel + '" style="width:' + pct + '%"></i></div></div>' : '<div class="carga-p"><span class="sec" style="font-size:13px">Acompanha, não executa tarefas</span></div>') +
        '<div class="pessoa-st">' + ['todo','doing','review','blocked'].map(s => '<span title="' + esc(stNome(s)) + '">' + ICO_ST[s].replace('<svg', '<svg class="st-' + s + '"') + its.filter(i => i.status === s).length + '</span>').join('') + '<span class="sec">' + its.length + ' em aberto</span></div>' +
      '</article>'; }).join('') + '</div>';
}
function formPessoa(p){
  p = p || {nome:'', funcao:'Dev', skills:[], cap:40, acesso:'dev'};
  return '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="fpe-nome" value="' + esc(p.nome) + '" placeholder="Nome completo"></label>' +
    '<label class="lb">Função<input class="campo" id="fpe-func" value="' + esc(p.funcao) + '" placeholder="Dev, Designer, QA..."></label>' +
    '<label class="lb">Horas por semana' + I('Capacity (capacidade: horas disponíveis por semana)') + '<input class="campo" type="number" min="0" id="fpe-cap" value="' + p.cap + '"></label></div>' +
    '<div class="bloco-g"><h4>Acesso' + I('Roles (papéis de acesso)') + '</h4><div class="tiles">' + [['owner','Owner · Master','Vê e configura tudo'],['dev','Dev','Executa e cumpre etapas'],['stakeholder','Stakeholder','Só acompanha e comenta']].map(([k, n, d]) => '<label class="tile"><input type="radio" name="fpe-ac" value="' + k + '"' + (p.acesso === k ? ' checked' : '') + '><span class="tile-c"><span class="pill pp-' + (PAPEL[k][1]) + '">' + n + '</span><small>' + d + '</small></span></label>').join('') + '</div></div>' +
    '<label class="lb">Skills' + I('Skills (habilidades: o que a pessoa sabe fazer)') + '<input class="campo" id="fpe-sk" value="' + esc(p.skills.join(', ')) + '" placeholder="Separadas por vírgula: Java, JavaFX, Supabase"></label>';
}

/* ================= AGENT STUDIO ================= */
const NIVEL_COR = {'Livre':'livre','Automática':'auto','Com confirmação':'conf','Bloqueada':'bloq'};
function rAgentes(){
  const el = $('#m-agentes');
  const a = byId('agents', UI.agSel) || D.agents[0];
  const m = souMaster(), dis = m ? '' : ' disabled';
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Agent Studio</span>' + I('Agent Studio (oficina de agentes): onde os agentes de IA são criados, ajustados e testados') + '</h1><p class="lead">Cada agente tem instruções, fontes de conhecimento, ferramentas e o nível de permissão de cada ferramenta. Você é o Master de todos.</p></div><div class="acoes"><button class="btn so-master" type="button" data-acao="novo-agente">' + ICO.mais + 'Novo agente</button></div></div>' +
    (!a ? '<p class="vazio-linha">Nenhum agente. Crie o primeiro.</p>' :
    '<div class="ag"><div class="ag-lista">' + D.agents.map(x => '<button type="button" class="ag-item' + (x.id === a.id ? ' escolhido' : '') + '" data-agente="' + x.id + '"><span class="avatar av-ia grande">' + esc(ini(x.nome)) + '</span><span class="ag-meio"><b>' + esc(x.nome) + '</b><small>' + esc(x.papel) + '</small><span class="ag-cont">' + x.ferramentas.length + ' ferramentas · ' + x.fontes.length + ' fontes</span></span></button>').join('') + '</div>' +
    '<div class="ag-det"><div class="ag-cab"><span class="avatar av-ia grande">' + esc(ini(a.nome)) + '</span><div style="flex:1;min-width:0"><input class="g-titulo" data-ag="nome" value="' + esc(a.nome) + '"' + dis + ' aria-label="Nome do agente"><input class="campo d-sel" data-ag="papel" value="' + esc(a.papel) + '"' + dis + ' aria-label="Papel" style="width:100%"></div>' + (m ? '<button class="btn sec perigo" type="button" data-excluir-agente="' + a.id + '">Excluir agente</button>' : '') + '</div>' +
      '<section class="g-cartao"><h4>Instructions' + I('Instructions ou System prompt (as instruções fixas de como o agente se comporta)') + '</h4><textarea class="campo" rows="4" data-ag="instr"' + dis + '>' + esc(a.instr) + '</textarea></section>' +
      '<section class="g-cartao"><h4>Knowledge sources' + I('Knowledge sources (fontes de conhecimento: de onde o agente tira as respostas, via RAG)') + '</h4><div class="tags">' + a.fontes.map((f, ix) => '<span class="tag">' + SV('<path d="M4 4h12l4 4v12H4z"/>') + esc(f) + (m ? '<button type="button" data-tirar-fonte="' + ix + '" aria-label="Tirar fonte">×</button>' : '') + '</span>').join('') + '</div>' + (m ? '<form class="g-add" data-form="fonte"><input class="campo" name="t" placeholder="Nova fonte de conhecimento"><button class="btn sec peq" type="submit">Adicionar</button></form>' : '') + '</section>' +
      '<section class="g-cartao"><h4>Tools e Permissions' + I('Tools (o que o agente pode fazer no sistema) e Permissions (até onde ele pode ir sozinho)') + '</h4>' +
        '<div class="ferr">' + a.ferramentas.map(([f, n], ix) => '<div class="ferr-lin"><b>' + esc(f) + '</b><div class="niveis" role="radiogroup" aria-label="Nível de ' + esc(f) + '">' + NIVEIS.map(nv => '<button type="button" class="nv nv-' + NIVEL_COR[nv] + (n === nv ? ' ativo' : '') + '" role="radio" aria-checked="' + (n === nv) + '" data-nivel-f="' + ix + '" data-nivel-v="' + esc(nv) + '"' + dis + '>' + esc(nv) + '</button>').join('') + '</div>' + (m ? '<button class="ico-btn" type="button" data-tirar-ferr="' + ix + '" aria-label="Tirar ferramenta">' + ICO.fechar + '</button>' : '') + '</div>').join('') + '</div>' +
        (m ? '<form class="g-add" data-form="ferr"><input class="campo" name="t" placeholder="Nova ferramenta, ex.: Enviar e-mail"><button class="btn sec peq" type="submit">Adicionar</button></form>' : '') +
        '<div class="legenda"><span><i class="nv-livre"></i><b>Livre</b> faz sem avisar</span><span><i class="nv-auto"></i><b>Automática</b> faz e registra</span><span><i class="nv-conf"></i><b>Com confirmação</b> espera o seu ok</span><span><i class="nv-bloq"></i><b>Bloqueada</b> nunca faz</span></div></section>' +
      '<section class="g-cartao"><h4>Handoff rules' + I('Handoff rules (quando o agente passa a conversa para uma pessoa)') + '</h4><input class="campo" data-ag="passa" value="' + esc(a.passa) + '"' + dis + ' placeholder="Quando passar para uma pessoa"></section>' +
      '<section class="g-cartao"><h4>Playground' + I('Playground (área de teste para conversar com o agente antes de soltar para os clientes)') + '</h4><div class="aviso-faixa" style="margin:0"><b>Sem provedor</b><span>O teste de conversa liga quando o provedor de IA for conectado a este sistema.</span></div><div class="g-add"><input class="campo" placeholder="Escreva uma pergunta de teste" disabled><button class="btn" type="button" disabled>Testar</button></div></section>' +
      '<section class="g-cartao"><h4>Logs e Evals' + I('Logs (registro de tudo que o agente respondeu e fez) e Evals (testes que medem se ele está respondendo certo)') + '</h4><p class="sec" style="margin:0;font-size:13px">Nenhum registro ainda.</p></section>' +
    '</div></div>');
}

/* ================= SETTINGS ================= */
function rConfig(){
  const el = $('#m-configuracoes');
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Settings</span>' + I('Settings e Templates (configurações e modelos que valem para todo projeto novo)') + '</h1><p class="lead">O modelo padrão das etapas, os requisitos obrigatórios e os níveis de acesso. Projetos novos já nascem com o que estiver aqui.</p></div></div>' +
    '<h2 class="sub">Stage gates: modelo padrão</h2><div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:14%"><col style="width:34%"><col style="width:12%"><col style="width:10%"><col style="width:16%"><col style="width:14%"></colgroup><thead><tr><th>Etapa</th><th>Item</th><th>Modo</th><th>Obrigatório</th><th>Prova pedida</th><th>Quem pode cumprir</th></tr></thead><tbody>' +
    D.template.map(et => et.itens.map((it, ii) => '<tr>' + (ii === 0 ? '<th scope="rowgroup" rowspan="' + et.itens.length + '">' + esc(et.nome) + '</th>' : '') + '<td><input class="campo peq" data-tpl="' + it.id + '" data-campo="texto" value="' + esc(it.texto) + '" style="width:100%"></td><td><select class="sel peq" data-tpl="' + it.id + '" data-campo="modo">' + MODOS.map(m => '<option' + (it.modo === m ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></td><td><select class="sel peq" data-tpl="' + it.id + '" data-campo="obrig"><option value="1"' + (it.obrig ? ' selected' : '') + '>Sim</option><option value="0"' + (!it.obrig ? ' selected' : '') + '>Não</option></select></td><td><select class="sel peq" data-tpl="' + it.id + '" data-campo="prova">' + PROVAS.map(p => '<option' + (it.prova === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></td><td><select class="sel peq" data-tpl="' + it.id + '" data-campo="quem">' + ['Responsável da etapa','Qualquer pessoa do time','Pessoa definida'].map(p => '<option' + (it.quem === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></td></tr>').join('')).join('') +
    '</tbody></table></div>' +
    '<h2 class="sub">Baseline requirements' + I('Baseline requirements (requisitos mínimos obrigatórios em todo sistema desenvolvido)') + '</h2><div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:40%">Requisito</th><th>Obrigatório em todo sistema</th></tr></thead><tbody>' +
    Object.keys(D.baseline).map(k => '<tr><th scope="row">' + esc(k) + '</th><td><label style="display:inline-flex;gap:8px;align-items:center"><input type="checkbox" data-base="' + esc(k) + '"' + (D.baseline[k] ? ' checked' : '') + '> ' + (D.baseline[k] ? 'Sim' : 'Não') + '</label></td></tr>').join('') +
    '</tbody></table></div>' +
    '<h2 class="sub">Roles' + I('Roles (papéis de acesso)') + '</h2><div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:20%">Papel</th><th>O que vê</th><th>O que faz</th></tr></thead><tbody>' +
      '<tr><th scope="row">Owner · Master</th><td>Tudo, de todos os clientes</td><td>Tudo, inclusive configurar etapas, travas, agentes e acessos</td></tr>' +
      '<tr><th scope="row">Dev</th><td>Os projetos em que participa, com canvas e ficha técnica</td><td>Cria e edita itens, cumpre etapas com prova, registra tempo</td></tr>' +
      '<tr><th scope="row">Stakeholder</th><td>Só o painel do próprio projeto e os itens marcados como visíveis ao cliente</td><td>Comenta e envia pedidos, com prints, arquivos e áudios</td></tr>' +
    '</tbody></table></div>' +
    (COM_BANCO ? painelBanco() : '<h2 class="sub">Dados deste protótipo</h2><div class="acoes"><button class="btn sec" type="button" data-acao="restaurar">Restaurar os dados de exemplo</button><span class="sec" style="font-size:13px">As mudanças ficam guardadas só neste navegador até o banco do projeto ser ligado.</span></div>');
}

/* ================= motor de preços e custos ================= */
const brl = v => (isFinite(v) ? v : 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2});
const num = (v, c) => (isFinite(v) ? v : 0).toLocaleString('pt-BR', {maximumFractionDigits: c == null ? 1 : c});
const paraBRL = (v, moeda) => moeda === 'USD' ? v * D.regras.cambio : v;
const R = () => D.regras;
const impostoPct = () => R().impostos[R().regime] || 0;
const MODELOS_PRECO = {
  fixo:{nome:'Fixed price', expl:'preço fechado pelo escopo', campos:[['nome','Nome do item','texto']]},
  hora:{nome:'Time and materials', expl:'cobra pelas horas trabalhadas', campos:[['mult','Multiplicador sobre a hora','num']]},
  marco:{nome:'Milestones', expl:'pagamento em parcelas, a cada entrega', campos:[['parcelas','Parcelas em %, separadas por vírgula','lista']]},
  setup:{nome:'Implementation fee', expl:'taxa de implantação, paga uma vez', campos:[['pctSetup','% do valor calculado','num']]},
  mensal:{nome:'Retainer', expl:'mensalidade fixa, com horas incluídas', campos:[['valor','Valor mensal (0 = calcular pelas horas)','num'],['horas','Horas incluídas por mês','num']]},
  banco:{nome:'Hour bank', expl:'banco de horas pré-pago, com desconto', campos:[['horas','Horas do pacote','num'],['validade','Validade em meses','num'],['desc','Desconto em %','num']]},
  usuario:{nome:'Per user', expl:'valor por usuário ativo por mês', campos:[['valor','Valor por usuário','num'],['minimo','Mínimo de usuários','num']]},
  faixa:{nome:'Tiered', expl:'planos em faixas, cada um com um limite', campos:[['faixas','Planos','faixas']]},
  uso:{nome:'Usage-based', expl:'cobra pelo que foi usado', campos:[['unidade','Unidade','texto'],['valor','Valor por unidade','num'],['franquia','Franquia inclusa','num']]},
  valor:{nome:'Value-based', expl:'preço pelo valor que o sistema gera para o cliente', campos:[['ganho','Ganho estimado por ano (R$)','num'],['pct','% cobrado do ganho','num']]},
  sucesso:{nome:'Success fee', expl:'percentual do resultado, como faturamento ou recuperação', campos:[['pct','% do resultado','num'],['base','Sobre o quê','texto']]},
  manutencao:{nome:'Maintenance', expl:'percentual anual do valor do projeto, cobrado por mês', campos:[['pct','% ao ano','num']]},
  repasse:{nome:'Pass-through', expl:'repasse dos custos de terceiros, com uma taxa', campos:[['markup','Taxa sobre o custo (%)','num']]}
};
const PADRAO_COMP = {fixo:{}, hora:{mult:1}, marco:{parcelas:[30,40,30]}, setup:{pctSetup:100}, mensal:{valor:0, horas:10}, banco:{horas:20, validade:3, desc:10}, usuario:{valor:39, minimo:5}, faixa:{faixas:[{nome:'Essencial', horas:10, valor:0},{nome:'Profissional', horas:20, valor:0},{nome:'Dedicado', horas:80, valor:0}]}, uso:{unidade:'unidade', valor:1, franquia:0}, valor:{ganho:100000, pct:10}, sucesso:{pct:2, base:'faturamento'}, manutencao:{pct:18}, repasse:{markup:15}};
function custoPessoa(p){
  const c = p.custo; if (!c) return null;
  const e = R().encargos, simples = R().regime === 'simples', d = [];
  let total = 0;
  if (c.vinculo === 'CLT'){
    const s = +c.salario || 0;
    const prov = s * (e.ferias + e.terco + e.decimo) / 100;
    const fgts = (s + prov) * e.fgts / 100;
    const inss = simples ? 0 : (s + prov) * (e.inss + e.rat + e.terceiros) / 100;
    const multa = s * e.multaFgts / 100;
    d.push(['Salário', s], ['Férias, 1/3 e 13º (provisão)', prov], ['FGTS', fgts], ['INSS patronal, RAT e terceiros' + (simples ? ' (no Simples vai no DAS)' : ''), inss], ['Provisão de multa do FGTS', multa], ['Benefícios', +c.beneficios || 0]);
  } else if (c.vinculo === 'PJ'){ d.push(['Valor da nota PJ', +c.valorPJ || 0], ['Benefícios', +c.beneficios || 0]); }
  else if (c.vinculo === 'Estágio'){ d.push(['Bolsa', +c.salario || 0], ['Benefícios e seguro', +c.beneficios || 0]); }
  else { const pl = +c.prolabore || 0; d.push(['Pró-labore', pl], ['INSS patronal sobre o pró-labore', simples ? 0 : pl * 0.2], ['Benefícios', +c.beneficios || 0]); }
  total = d.reduce((s, x) => s + x[1], 0);
  const horas = (p.cap ? p.cap * 4.33 : R().horasMes) * R().faturavel / 100;
  return {total, detalhes:d, horasFat:horas, hora: horas ? total / horas : 0};
}
const mensalEq = o => { const v = paraBRL(+o.valor || 0, o.moeda); return o.rec === 'Anual' ? v / 12 : o.rec === 'Depreciação' ? v / (o.meses || 36) : o.rec === 'Único' ? 0 : v; };
function overheadMensal(){ return D.opCustos.reduce((s, o) => s + mensalEq(o), 0); }
function capacidadeFat(){ return D.people.filter(p => p.custo && p.cap).reduce((s, p) => s + custoPessoa(p).horasFat, 0); }
function custoEquipeMensal(){ return D.people.filter(p => p.custo).reduce((s, p) => s + custoPessoa(p).total, 0); }
function custoHoraMedio(){ const h = capacidadeFat(); return h ? custoEquipeMensal() / h : 0; }
function overheadHora(){ const h = capacidadeFat(); return h ? overheadMensal() * (1 + R().reservaOverhead / 100) / h : 0; }
function precoHora(){ const div = 1 - (impostoPct() + R().margem) / 100; return (custoHoraMedio() + overheadHora()) * (1 + R().risco / 100) / (div > 0.05 ? div : 0.05); }
function calcular(horas, compl, urg){
  const kc = R().complexidade[compl] || 1, ku = R().urgencia[urg] || 1;
  const eq = horas * kc * custoHoraMedio(), ov = horas * kc * overheadHora();
  const cont = (eq + ov) * R().risco / 100;
  const base = eq + ov + cont;
  const div = 1 - (impostoPct() + R().margem) / 100;
  const preco = base / (div > 0.05 ? div : 0.05) * ku;
  return {horas:horas * kc, eq, ov, cont, base, imp:preco * impostoPct() / 100, marg:preco * R().margem / 100, urgAdd: preco - preco / ku, preco};
}
function valorComponente(c, calc, ctx){
  const ph = precoHora();
  switch (c.m){
    case 'fixo': return {ini: calc.preco, txt: brl(calc.preco) + ' fechado'};
    case 'hora': return {hora: ph * (c.mult || 1), txt: brl(ph * (c.mult || 1)) + ' por hora'};
    case 'marco': { const ps = (c.parcelas || [100]); return {ini: calc.preco, txt: ps.map((p, i) => 'Marco ' + (i + 1) + ': ' + brl(calc.preco * p / 100)).join(' · ')}; }
    case 'setup': { const v = calc.preco * (c.pctSetup || 100) / 100; return {ini:v, txt: brl(v) + ' na implantação'}; }
    case 'mensal': { const v = +c.valor || (c.horas || 0) * ph * 0.95; return {mes:v, txt: brl(v) + ' por mês' + (c.horas ? ', com ' + c.horas + 'h incluídas' : '')}; }
    case 'banco': { const v = (c.horas || 0) * ph * (1 - (c.desc || 10) / 100); return {ini:v, txt: c.horas + 'h por ' + brl(v) + ', válidas por ' + (c.validade || 3) + ' meses'}; }
    case 'usuario': { const n = Math.max(ctx.usuarios || 0, c.minimo || 0); return {mes:(c.valor || 0) * n, txt: brl(c.valor || 0) + ' por usuário · ' + n + ' usuários = ' + brl((c.valor || 0) * n) + ' por mês'}; }
    case 'faixa': return {txt: (c.faixas || []).map((f, i) => f.nome + ': ' + brl(+f.valor || f.horas * ph * (1 - i * 0.05)) + ' (' + f.horas + 'h)').join(' · ')};
    case 'uso': { const q = Math.max(0, (ctx.uso || 0) - (c.franquia || 0)); return {mes:q * (c.valor || 0), txt: brl(c.valor || 0) + ' por ' + (c.unidade || 'unidade') + ' acima de ' + (c.franquia || 0) + ' inclusos'}; }
    case 'valor': { const v = (c.ganho || 0) * (c.pct || 0) / 100; return {ini:v, txt: (c.pct || 0) + '% de ' + brl(c.ganho || 0) + ' de ganho = ' + brl(v)}; }
    case 'sucesso': return {txt: (c.pct || 0) + '% sobre ' + (c.base || 'o resultado')};
    case 'manutencao': { const v = calc.preco * (c.pct || R().manutencaoAnual) / 100 / 12; return {mes:v, txt: (c.pct || R().manutencaoAnual) + '% ao ano = ' + brl(v) + ' por mês'}; }
    case 'repasse': return {txt: 'Custo de terceiros + ' + (c.markup || 0) + '%'};
  }
  return {txt:''};
}
// previsão linear simples a partir do histórico mensal
function tendencia(h){
  const n = h.length; if (n < 2) return {slope:0, prox:h[0] || 0};
  const xm = (n - 1) / 2, ym = h.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0; h.forEach((y, x) => { a += (x - xm) * (y - ym); b += (x - xm) * (x - xm); });
  const slope = b ? a / b : 0; return {slope, prox: ym + slope * (n - xm)};
}
function mesesAteLimite(u){
  const atual = u.hist[u.hist.length - 1], t = tendencia(u.hist);
  if (atual >= u.limite) return 0; if (t.slope <= 0) return null;
  return Math.ceil((u.limite - atual) / t.slope);
}
const mesIdx = d => d.getFullYear() * 12 + d.getMonth();
const HOJE_M = mesIdx(HOJE);
const rotuloOff = off => { const d = new Date(HOJE.getFullYear(), HOJE.getMonth() + off, 1); return MESES_CURTO[d.getMonth()] + '/' + String(d.getFullYear()).slice(2); };
function inicioCusto(ct){ return ct.inicio || iso(new Date(HOJE.getFullYear(), HOJE.getMonth() - ((ct.uso && ct.uso.hist.length) || 6) + 1, 1)); }
function usoNoMes(u, off){ const h = u.hist, i = h.length - 1 + off; if (i >= 0 && i < h.length) return h[i]; if (i < 0) return h[0]; const t = tendencia(h); return Math.max(0, h[h.length - 1] + t.slope * (i - h.length + 1)); }
function custoNoMes(ct, off, caixa){ // off = meses a partir do mês atual; caixa = o que foi pago de fato naquele mês
  const ini = mesIdx(parse(inicioCusto(ct))), m = HOJE_M + off;
  if (m < ini || (ct.fim && m > mesIdx(parse(ct.fim)))) return 0;
  let v = paraBRL(ct.valor || 0, ct.moeda);
  if (ct.rec === 'Anual') v = caixa ? ((m - ini) % 12 === 0 ? v : 0) : v / 12;
  else if (ct.rec === 'Único') v = m === ini ? v : 0;
  if (ct.uso){ const q = usoNoMes(ct.uso, off); if (ct.rec === 'Por uso') v = paraBRL(q, ct.moeda); else if (q > ct.uso.limite && ct.uso.prox) v = paraBRL((ct.uso.prox.valor || ct.valor || 0) + (ct.uso.prox.extraUnidade ? (q - ct.uso.limite) * ct.uso.prox.extraUnidade : 0), ct.moeda); }
  return v;
}
function custoItemMes(ct, k){ return custoNoMes(ct, k - 5, false); } // k: 0..5 passado, 6..11 previsão
function gastoAteHoje(ct){ const ini = mesIdx(parse(inicioCusto(ct))); let s = 0; for (let m = ini; m <= HOJE_M; m++) s += custoNoMes(ct, m - HOJE_M, true); return s; }
function receitaNoMes(r, off){ const ini = mesIdx(parse(r.inicio) || HOJE), m = HOJE_M + off; if (m < ini || (r.fim && m > mesIdx(parse(r.fim)))) return 0;
  if (r.rec === 'Mensal') return +r.valor || 0; if (r.rec === 'Único') return m === ini ? +r.valor || 0 : 0; if (r.rec === 'Parcelado'){ const n = r.parcelas || 1; return m - ini < n ? (+r.valor || 0) / n : 0; } return 0; }
function cobradoAteHoje(r){ const ini = mesIdx(parse(r.inicio) || HOJE); let s = 0; for (let m = ini; m <= HOJE_M; m++) s += receitaNoMes(r, m - HOJE_M); return s; }
function appsDoEscopo(chave){ const [t, id] = chave.split(':');
  if (t === 'app') return [id]; if (t === 'product') return D.apps.filter(a => a.product === id).map(a => a.id); if (t === 'project') return D.apps.filter(a => a.project === id).map(a => a.id);
  if (t === 'ws'){ const w = byId('ws', id); return w ? [w.app] : []; }
  if (t === 'client') return D.apps.filter(a => { const p = byId('projects', a.project); return p && (p.client === id || (byId('clients', p.client) || {}).holding === id); }).map(a => a.id);
  return []; }
function custosDoEscopo(chave){ const [t, id] = chave.split(':'); const apps = appsDoEscopo(chave); const c = cadeia(chave); return D.custos.filter(x => apps.includes(x.app) || (!x.app && ((t === 'project' && c.project && x.cliente === c.project.client) || (t === 'client' && x.cliente === id)))); }
function receitasDoEscopo(chave){ const [t, id] = chave.split(':'); const apps = appsDoEscopo(chave); return D.receitas.filter(r => (r.app && apps.includes(r.app)) || (!r.app && ((t === 'project' && r.project === id) || (t === 'client' && r.cliente === id)))); }
const MESES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const rotuloMes = k => rotuloOff(k - 5);
function receitaMes(filtroCli){ // mensalidades + projetos pagos de uma vez, rateados pelos meses do projeto
  return D.receitas.filter(r => !filtroCli || r.cliente === filtroCli).reduce((s, r) => {
    if (r.rec === 'Mensal') return s + r.valor;
    if (r.rec === 'Parcelado') return s + receitaNoMes(r, 0);
    if (r.rec === 'Único'){ const p = byId('projects', r.project) || D.projects.find(x => x.client === r.cliente); const ini = parse(p ? p.inicio : r.inicio) || HOJE, fim = parse(p ? p.alvo : r.inicio) || HOJE; const meses = Math.max(1, Math.round((fim - ini) / (30.4 * 864e5))); return s + r.valor / meses; }
    return s;
  }, 0);
}
function horasRestantes(chave){ return issuesEm(chave).filter(i => i.status !== 'done').reduce((s, i) => s + (+i.est || 0), 0); }
function horasFeitas(chave){ return issuesEm(chave).filter(i => i.status === 'done').reduce((s, i) => s + (+i.est || 0), 0); }

/* ================= CATALOG ================= */
function rCatalog(){
  const el = $('#m-catalog');
  const sv = UI.svSel && byId('catalog', UI.svSel);
  if (sv) return rServico(el, sv);
  const cats = [...new Set(D.catalog.map(s => s.cat))];
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Catalog</span>' + I('Catalog ou Service Catalog (catálogo de serviços): tudo o que a IT.IA faz e vende, cada um com o seu modelo pronto') + '</h1><p class="lead">Cada serviço traz frentes, etapas, requisitos e o comercial prontos. Ao criar um projeto, o serviço escolhido já preenche tudo.</p></div><div class="acoes"><span class="rotulo-mini">Preço hora sugerido ' + brl(precoHora()) + I('Preço hora sugerido: custo da equipe mais a operação, com contingência, impostos e margem. Ajuste em Costs, Regras de cálculo') + '</span><button class="btn" type="button" data-acao="novo-servico">' + ICO.mais + 'Novo serviço</button></div></div>' +
    '<div class="tabela-rolo" style="margin-top:24px"><table class="tabela"><colgroup><col style="width:26%"><col style="width:13%"><col style="width:17%"><col style="width:32%"><col style="width:12%"></colgroup><thead><tr><th>Serviço</th><th>Esforço típico</th><th>Faixa de preço sugerida</th><th>Modelos de cobrança</th><th>Status</th></tr></thead><tbody>' +
    cats.map(c => '<tr class="grupo"><th colspan="5">' + esc(c) + '</th></tr>' + D.catalog.filter(s => s.cat === c).map(s => { const a = calcular(s.horas[0], 'Média', 'Normal').preco, b = calcular(s.horas[1], 'Média', 'Normal').preco;
      return '<tr class="linha-link" data-servico="' + s.id + '"><th scope="row"><button class="nome-tab" type="button" data-servico="' + s.id + '">' + esc(s.nome) + '</button><div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400;margin-top:2px">' + esc(s.desc) + '</div></th><td>' + s.horas[0] + ' a ' + s.horas[1] + 'h</td><td>' + brl(a) + ' a ' + brl(b) + '</td><td><div class="tags">' + s.preco.map(p => '<span class="tag">' + esc(MODELOS_PRECO[p.m].nome) + '</span>').join('') + '</div></td><td>' + (s.ativo ? '<span class="pill pe-resolvido">' + ICO_ST.done + 'Ativo</span>' : '<span class="pill">' + ICO_ST.backlog + 'Inativo</span>') + '</td></tr>'; }).join('')).join('') +
    '</tbody></table></div>';
}
function rServico(el, s){
  const aba = UI.svAba || 'comercial';
  const ctx = UI.svCtx || (UI.svCtx = {horas: Math.round((s.horas[0] + s.horas[1]) / 2), compl:'Média', urg:'Normal', usuarios:15, uso:20});
  const calc = calcular(+ctx.horas || 0, ctx.compl, ctx.urg);
  let totIni = 0, totMes = 0;
  const comps = s.preco.map((c, ix) => { const v = valorComponente(c, calc, ctx); totIni += v.ini || 0; totMes += v.mes || 0; return [c, ix, v]; });
  const abas = [['comercial','Comercial'],['descricao','Descrição'],['frentes','Frentes e etapas'],['requisitos','Requisitos']];
  let corpo = '';
  if (aba === 'comercial'){
    corpo = '<div class="cm"><div class="cm-comp"><h3 class="sub" style="margin:0 0 12px">Como cobrar' + I('Pricing model (modelo de cobrança): a forma de cobrar o serviço. Um serviço pode combinar vários') + '</h3>' +
      comps.map(([c, ix, v]) => { const M = MODELOS_PRECO[c.m]; return '<div class="comp"><div class="comp-cab"><select class="sel peq" data-comp-m="' + ix + '">' + Object.entries(MODELOS_PRECO).map(([k, mm]) => '<option value="' + k + '"' + (k === c.m ? ' selected' : '') + '>' + esc(mm.nome) + ' · ' + esc(mm.expl) + '</option>').join('') + '</select><button class="ico-btn" type="button" data-tirar-comp="' + ix + '" aria-label="Tirar este modelo">' + ICO.fechar + '</button></div>' +
        '<div class="comp-campos">' + M.campos.map(([k, n, t]) => t === 'faixas' ? '<div class="comp-faixas">' + (c.faixas || []).map((f, fi) => '<span><input class="campo peq" data-faixa="' + ix + '|' + fi + '|nome" value="' + esc(f.nome) + '" aria-label="Nome do plano"><input class="campo peq" type="number" data-faixa="' + ix + '|' + fi + '|horas" value="' + f.horas + '" aria-label="Horas do plano">h</span>').join('') + '</div>' : '<label class="lb">' + esc(n) + '<input class="campo peq" ' + (t === 'num' ? 'type="number" step="any" ' : '') + 'data-comp-c="' + ix + '|' + k + '|' + t + '" value="' + esc(t === 'lista' ? (c[k] || []).join(', ') : (c[k] == null ? '' : c[k])) + '"></label>').join('') + '</div>' +
        '<div class="comp-val">' + esc(v.txt) + '</div></div>'; }).join('') +
      '<button class="btn sec" type="button" data-acao="add-comp">' + ICO.mais + 'Adicionar modelo de cobrança</button></div>' +
      '<div class="cm-calc"><section class="g-cartao"><h4>Calculadora' + I('Calculadora: estima o preço pelo esforço, com as regras de custo, impostos e margem') + '</h4>' +
        '<div class="grade-form"><label class="lb">Horas estimadas<input class="campo" type="number" min="0" data-ctx="horas" value="' + ctx.horas + '"></label><label class="lb">Complexidade<select class="sel" data-ctx="compl">' + Object.keys(R().complexidade).map(k => '<option' + (k === ctx.compl ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label><label class="lb">Urgência<select class="sel" data-ctx="urg">' + Object.keys(R().urgencia).map(k => '<option' + (k === ctx.urg ? ' selected' : '') + '>' + k + '</option>').join('') + '</select></label><label class="lb">Usuários<input class="campo" type="number" min="0" data-ctx="usuarios" value="' + ctx.usuarios + '"></label><label class="lb">Uso no mês<input class="campo" type="number" min="0" data-ctx="uso" value="' + ctx.uso + '"></label></div>' +
        '<table class="calc"><tbody>' +
          '<tr><th>Horas com a complexidade</th><td>' + num(calc.horas) + 'h</td></tr>' +
          '<tr><th>Custo da equipe' + I('Custo da equipe: horas vezes o custo hora médio do time, com salários, encargos e benefícios') + '</th><td>' + brl(calc.eq) + '</td></tr>' +
          '<tr><th>Rateio da operação' + I('Overhead (rateio da operação): ferramentas, estrutura e administrativo divididos pelas horas faturáveis do time') + '</th><td>' + brl(calc.ov) + '</td></tr>' +
          '<tr><th>Contingência de ' + R().risco + '%' + I('Contingency (contingência): reserva para imprevistos do projeto') + '</th><td>' + brl(calc.cont) + '</td></tr>' +
          '<tr class="sub-t"><th>Custo total</th><td>' + brl(calc.base) + '</td></tr>' +
          '<tr><th>Impostos (' + num(impostoPct(), 2) + '%)</th><td>' + brl(calc.imp) + '</td></tr>' +
          '<tr><th>Margem (' + R().margem + '%)</th><td>' + brl(calc.marg) + '</td></tr>' +
          (calc.urgAdd > 0.5 ? '<tr><th>Adicional de urgência</th><td>' + brl(calc.urgAdd) + '</td></tr>' : '') +
          '<tr class="total"><th>Preço calculado</th><td>' + brl(calc.preco) + '</td></tr>' +
        '</tbody></table>' +
        '<div class="proposta"><div><span>Valor inicial</span><b>' + brl(totIni) + '</b></div><div><span>Recorrente por mês</span><b>' + brl(totMes) + '</b></div><div><span>Hora avulsa</span><b>' + brl(precoHora()) + '</b></div></div>' +
        '<p class="sec" style="margin:0;font-size:12px">Fórmula: (custo da equipe + rateio) × (1 + contingência) ÷ (1 − impostos − margem) × urgência. As regras ficam em Costs, Regras de cálculo.</p></section></div></div>';
  } else if (aba === 'descricao'){
    corpo = '<div class="grade-form"><label class="lb largo">Descrição<textarea class="campo" rows="3" data-sv="desc">' + esc(s.desc) + '</textarea></label><label class="lb">Categoria<input class="campo" data-sv="cat" value="' + esc(s.cat) + '"></label><label class="lb">Horas mínimas<input class="campo" type="number" data-sv-h="0" value="' + s.horas[0] + '"></label><label class="lb">Horas máximas<input class="campo" type="number" data-sv-h="1" value="' + s.horas[1] + '"></label><label class="lb">SLA' + I('SLA (prazo combinado de resposta)') + '<input class="campo" data-sv="sla" value="' + esc(s.sla) + '"></label></div>' +
      '<div class="duas-listas"><section class="g-cartao"><h4>Entregáveis' + I('Deliverables (entregáveis): o que o cliente recebe no fim') + '</h4>' + listaEditavel(s.entrega, 'entrega') + '</section><section class="g-cartao"><h4>Checklist de início' + I('Kickoff checklist (o que precisa existir antes de começar)') + '</h4>' + listaEditavel(s.check, 'check') + '</section></div>';
  } else if (aba === 'frentes'){
    corpo = '<section class="g-cartao"><h4>Workstreams padrão' + I('Workstreams (frentes de trabalho) que toda aplicação deste serviço já recebe ao nascer') + '</h4>' + listaEditavel(s.frentes, 'frentes') + '</section><p class="intro" style="margin-top:16px">As etapas seguem o modelo padrão de Settings. Os itens que não se aplicam a este serviço podem ser marcados como Desligado no projeto.</p>';
  } else {
    corpo = '<div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:50%">Baseline requirement' + I('Baseline requirements (requisitos mínimos obrigatórios)') + '</th><th>Vale para este serviço</th></tr></thead><tbody>' + Object.keys(D.baseline).map(k => '<tr><th scope="row">' + esc(k) + '</th><td><label style="display:inline-flex;gap:8px;align-items:center"><input type="checkbox" data-sv-req="' + esc(k) + '"' + (s.req.includes(k) ? ' checked' : '') + '> ' + (s.req.includes(k) ? 'Sim' : 'Não') + '</label></td></tr>').join('') + '</tbody></table></div>';
  }
  el.innerHTML = '<nav class="nav-niveis"><button class="btn sec peq" type="button" data-acao="catalog-lista">‹ Voltar para Catalog</button><span class="nav-trilha"><button type="button" data-acao="catalog-lista">Catalog</button><span class="sep">›</span><span>' + esc(s.cat) + '</span><span class="sep">›</span><b>' + esc(s.nome) + '</b></span></nav>' +
    '<div class="topo-tela" style="margin-top:12px"><div class="titulo-esq"><h1 style="font-size:32px"><input class="g-titulo" data-sv="nome" value="' + esc(s.nome) + '" aria-label="Nome do serviço" style="font-size:32px;width:auto;min-width:320px"></h1><label class="rotulo-mini" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-sv-ativo' + (s.ativo ? ' checked' : '') + '> Ativo</label></div><div class="acoes"><button class="btn sec perigo" type="button" data-acao="excluir-servico">Excluir serviço</button></div></div>' +
    '<div class="views" role="tablist">' + abas.map(([k, n]) => '<button class="view-b" type="button" role="tab" data-sv-aba="' + k + '" aria-selected="' + (aba === k) + '">' + n + '</button>').join('') + '</div><div style="height:20px"></div>' + corpo;
}
function listaEditavel(lista, campo){
  return '<ul class="g-lista">' + lista.map((t, i) => '<li class="g-link"><span style="flex:1">' + esc(t) + '</span><button class="ico-btn" type="button" data-tirar-lista="' + campo + '|' + i + '" aria-label="Tirar">' + ICO.fechar + '</button></li>').join('') + '</ul><form class="g-add" data-form="sv-lista" data-campo="' + campo + '"><input class="campo" name="t" placeholder="Adicionar"><button class="btn sec peq" type="submit">Adicionar</button></form>';
}

/* ================= COSTS ================= */
const ABAS_CUSTO = [['visao','Visão geral'],['clientes','Por cliente'],['equipe','Equipe'],['operacao','Operação interna'],['regras','Regras de cálculo']];
function rCustos(){
  const el = $('#m-custos');
  const aba = UI.ctAba || 'visao';
  let corpo = '';
  if (aba === 'visao') corpo = custoVisao();
  else if (aba === 'clientes') corpo = UI.ctCliente ? custoCliente(UI.ctCliente) : custoClientes();
  else if (aba === 'equipe') corpo = custoEquipe();
  else if (aba === 'operacao') corpo = custoOperacao();
  else corpo = custoRegras();
  el.innerHTML = '<div class="topo-tela"><div><h1><span>Costs</span>' + I('Costs (custos): o custo técnico de cada cliente e o custo completo da operação da IT.IA, com previsão') + '</h1><p class="lead">Do macro ao micro: a operação inteira, cada cliente, cada aplicação e cada item de custo, com linha do tempo e previsão.</p></div></div>' +
    '<div class="views" role="tablist">' + ABAS_CUSTO.map(([k, n]) => '<button class="view-b" type="button" role="tab" data-ct-aba="' + k + '" aria-selected="' + (aba === k) + '">' + n + '</button>').join('') + '</div><div style="height:20px"></div>' + corpo;
}
function serieMeses(filtro){ // 6 meses passados + 6 previstos
  return Array.from({length:12}, (_, k) => D.custos.filter(filtro || (() => true)).reduce((s, ct) => s + custoItemMes(ct, k), 0));
}
function barrasTempo(valores, titulo, extra){
  const max = Math.max(1, ...valores.map(v => v.total));
  return '<div class="grafico"><h3>' + titulo + '</h3><div class="colunas alta">' + valores.map((v, k) => '<div class="c' + (k > 5 ? ' previsto' : '') + '" title="' + rotuloMes(k) + ': ' + brl(v.total) + (k > 5 ? ' (previsão)' : '') + '"><span class="n">' + (v.total >= 1000 ? num(v.total / 1000, 1) + 'k' : num(v.total, 0)) + '</span>' + (v.partes || [['', v.total, '']]).map(([n, val, cls]) => '<div class="b ' + cls + '" style="height:' + (val / max * 100) + '%"></div>').join('') + '</div>').join('') + '</div><div class="eixo">' + valores.map((_, k) => '<span' + (k > 5 ? ' class="prev"' : '') + '>' + rotuloMes(k) + '</span>').join('') + '</div>' + (extra || '') + '</div>';
}
function custoVisao(){
  const eq = custoEquipeMensal(), op = overheadMensal();
  const tec = serieMeses();
  const recMes = receitaMes();
  const repasse = D.custos.filter(c => c.repasse).reduce((s, c) => s + custoItemMes(c, 5) * (1 + (c.markup || 0) / 100), 0);
  const totalMes = eq + op + tec[5];
  const margem = recMes + repasse ? ((recMes + repasse - totalMes) / (recMes + repasse)) * 100 : 0;
  const serie = tec.map(t => ({total: t + eq + op, partes:[['Equipe', eq, 'eq'],['Operação', op, 'op'],['Técnico dos clientes', t, 'tec']]}));
  const alertas = D.custos.filter(c => c.uso).map(c => ({c, m: mesesAteLimite(c.uso), atual: c.uso.hist[c.uso.hist.length - 1]})).filter(x => x.m !== null && x.m <= 6).sort((a, b) => a.m - b.m);
  const porCat = {}; D.custos.forEach(c => { porCat[c.cat] = (porCat[c.cat] || 0) + custoItemMes(c, 5); });
  const maxCat = Math.max(1, ...Object.values(porCat));
  const projetos = D.projects.map(p => { const hr = horasRestantes('project:' + p.id); return {p, hr, custo: hr * custoHoraMedio() * (1 + R().risco / 100)}; });
  return '<div class="kpis" style="margin-top:0">' +
      '<div class="kpi"><b>' + brl(totalMes) + '</b><span>Custo total do mês</span></div>' +
      '<div class="kpi"><b>' + brl(eq) + '</b><span>Equipe</span></div>' +
      '<div class="kpi"><b>' + brl(op) + '</b><span>Operação interna</span></div>' +
      '<div class="kpi"><b>' + brl(tec[5]) + '</b><span>Técnico dos clientes</span></div>' +
      '<div class="kpi"><b>' + brl(recMes + repasse) + '</b><span>Receita do mês' + I('Receita do mês: mensalidades, projetos pagos de uma vez divididos pelos meses do projeto, e os repasses de custo cobrados dos clientes') + '</span></div>' +
      '<div class="kpi ' + (margem < 0 ? 'alerta' : '') + '"><b>' + num(margem, 0) + '%</b><span>Margem da operação</span></div>' +
    '</div>' +
    '<div class="graficos">' + barrasTempo(serie, 'Linha do tempo dos custos', '<div class="legenda"><span><i style="background:var(--preto)"></i>Equipe</span><span><i style="background:#2563EB"></i>Operação interna</span><span><i style="background:#C26A00"></i>Técnico dos clientes</span><span><i class="hach"></i>Previsão</span></div>') +
      '<div class="grafico"><h3>Técnico dos clientes por categoria</h3><div class="barras">' + Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => '<div class="barra-l" title="' + esc(k) + ': ' + brl(v) + '"><span>' + esc(k) + '</span><div class="trilho"><div class="enche" style="width:' + (v / maxCat * 100) + '%;background:#C26A00"></div></div><span class="v">' + brl(v) + '</span></div>').join('') + '</div></div></div>' +
    '<h2 class="sub">Limites de plano chegando' + I('Usage limits (limites de uso): quando o consumo chega no limite do plano, o custo muda para o próximo plano') + '</h2>' +
    (alertas.length ? '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Cliente</th><th>Item</th><th>Uso atual / limite</th><th>Previsão</th><th>O que acontece</th></tr></thead><tbody>' + alertas.map(({c, m, atual}) => '<tr class="linha-link" data-ct-cliente="' + c.cliente + '"><th scope="row">' + esc((byId('clients', c.cliente) || {}).nome || '') + '</th><td>' + esc(c.fornecedor + ' · ' + c.desc) + '</td><td>' + usoBarra(c.uso) + '</td><td>' + (m === 0 ? '<span class="pill gv-critico">' + ICO_SAUDE.critico + 'Já passou do limite</span>' : '<span class="pill ' + (m <= 2 ? 'gv-alto' : 'gv-medio') + '">' + ICO_SAUDE.atencao + 'Chega em cerca de ' + m + (m === 1 ? ' mês' : ' meses') + '</span>') + '</td><td class="sec">' + esc(c.uso.prox ? c.uso.prox.nome + ': ' + c.uso.prox.obs : '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="vazio-linha" style="padding:0">Nenhum limite perto de estourar nos próximos 6 meses.</p>') +
    '<h2 class="sub">Previsão pelo andamento dos projetos' + I('Forecast (previsão): horas que ainda faltam nas tarefas abertas, vezes o custo hora do time, com contingência') + '</h2>' +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Projeto</th><th>Horas feitas</th><th>Horas que faltam</th><th>Custo previsto para terminar</th><th>Receita contratada</th></tr></thead><tbody>' + projetos.map(({p, hr, custo}) => { const rec = D.receitas.filter(r => r.cliente === p.client && r.rec === 'Único').reduce((s, r) => s + r.valor, 0); return '<tr><th scope="row">' + esc(p.nome) + '</th><td>' + num(horasFeitas('project:' + p.id), 0) + 'h</td><td>' + num(hr, 0) + 'h</td><td>' + brl(custo) + '</td><td>' + brl(rec) + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
function usoBarra(u){
  const atual = u.hist[u.hist.length - 1], pct = Math.min(100, atual / u.limite * 100);
  const cls = pct >= 100 ? 'c-sobre' : pct >= 80 ? 'c-cheio' : 'c-ok';
  return '<div class="uso"><div class="progresso grosso"><i class="' + cls + '" style="width:' + pct + '%"></i></div><span>' + num(atual) + ' de ' + num(u.limite) + ' ' + esc(u.unidade) + '</span></div>';
}
function custoClientes(){
  const linhas = D.clients.map(c => {
    const itens = D.custos.filter(x => x.cliente === c.id);
    const tec = itens.reduce((s, x) => s + custoItemMes(x, 5), 0);
    const rep = itens.filter(x => x.repasse).reduce((s, x) => s + custoItemMes(x, 5) * (1 + (x.markup || 0) / 100), 0);
    const rec = receitaMes(c.id);
    const alerta = itens.some(x => x.uso && mesesAteLimite(x.uso) !== null && mesesAteLimite(x.uso) <= 2);
    const gasto = itens.reduce((s, x) => s + gastoAteHoje(x), 0), cobrado = D.receitas.filter(r => r.cliente === c.id).reduce((s, r) => s + cobradoAteHoje(r), 0);
    return {c, n:itens.length, tec, rep, rec, alerta, gasto, cobrado};
  });
  return '<div class="topo-tela"><p class="intro" style="margin:0">Clique num cliente para ver cada aplicação e cada item de custo, com a linha do tempo.</p><div class="acoes"><button class="btn" type="button" data-acao="novo-custo">' + ICO.mais + 'Novo custo</button></div></div><div style="height:12px"></div>' +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Cliente</th><th>Itens de custo</th><th>Custo técnico no mês</th><th>Repasse cobrado' + I('Pass-through (repasse): o custo de terceiros cobrado do cliente, com a taxa definida') + '</th><th>Receita do mês' + I('Mensalidades mais projetos pagos de uma vez, divididos pelos meses do projeto') + '</th><th>Resultado técnico</th><th>Já gasto até hoje</th><th>Já cobrado até hoje</th><th>Limites</th></tr></thead><tbody>' +
    linhas.map(l => '<tr class="linha-link" data-ct-cliente="' + l.c.id + '"><th scope="row"><button class="nome-tab" type="button" data-ct-cliente="' + l.c.id + '">' + esc(l.c.nome) + '</button></th><td>' + l.n + '</td><td>' + brl(l.tec) + '</td><td>' + brl(l.rep) + '</td><td>' + brl(l.rec) + '</td><td class="' + (l.rep + l.rec - l.tec < 0 ? 'atrasado' : '') + '">' + brl(l.rep + l.rec - l.tec) + '</td><td>' + brl(l.gasto) + '</td><td>' + brl(l.cobrado) + '</td><td>' + (l.alerta ? '<span class="pill gv-alto">' + ICO_SAUDE.atencao + 'Perto do limite</span>' : '<span class="pill gv-baixo">' + ICO_SAUDE.ok + 'Tranquilo</span>') + '</td></tr>').join('') + '</tbody></table></div>';
}
function custoCliente(id){
  const c = byId('clients', id); if (!c){ UI.ctCliente = null; return custoClientes(); }
  const itens = D.custos.filter(x => x.cliente === id);
  const serie = serieMeses(x => x.cliente === id).map(t => ({total:t, partes:[['', t, 'tec']]}));
  const porApp = {}; itens.forEach(x => { const k = x.app || '_'; (porApp[k] = porApp[k] || []).push(x); });
  return '<nav class="nav-niveis"><button class="btn sec peq" type="button" data-acao="ct-voltar">‹ Voltar para todos os clientes</button><span class="nav-trilha"><button type="button" data-acao="ct-voltar">Por cliente</button><span class="sep">›</span><b>' + esc(c.nome) + '</b></span></nav>' +
    '<div class="graficos">' + barrasTempo(serie, 'Linha do tempo: custo técnico de ' + esc(c.nome), '<div class="legenda"><span><i style="background:#C26A00"></i>Custo</span><span><i class="hach"></i>Previsão pelo ritmo de uso</span></div>') + '</div>' +
    '<div class="topo-tela" style="margin-top:32px"><h2 class="sub" style="margin:0">Itens de custo por aplicação</h2><div class="acoes"><button class="btn" type="button" data-acao="novo-custo">' + ICO.mais + 'Novo custo</button></div></div><div style="height:12px"></div>' +
    '<div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:19%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:10%"><col style="width:18%"><col style="width:7%"><col style="width:7%"></colgroup><thead><tr><th>Item</th><th>Categoria</th><th>Recorrência</th><th>Começou em</th><th>Custo no mês</th><th>Já gasto</th><th>Uso e limite</th><th>Repasse</th><th></th></tr></thead><tbody>' +
    (itens.length ? Object.entries(porApp).map(([app, lista]) => '<tr class="grupo"><th colspan="9">' + esc(app === '_' ? 'Sem aplicação' : (byId('apps', app) || {nome:app}).nome) + '</th></tr>' + lista.map(x => { const m = x.uso ? mesesAteLimite(x.uso) : null;
      return '<tr><th scope="row">' + esc(x.fornecedor) + '<div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400">' + esc(x.desc) + '</div></th><td>' + esc(x.cat) + '</td><td>' + esc(x.rec) + '</td><td>' + brl(custoItemMes(x, 5)) + (x.moeda === 'USD' ? '<div class="sec" style="font-size:11px">em dólar, câmbio ' + num(R().cambio, 2) + '</div>' : '') + '</td><td>' + (x.uso ? usoBarra(x.uso) + '<div class="sec" style="font-size:11px;margin-top:4px">' + esc(x.uso.plano) + (m === 0 ? ' · já passou do limite' : m ? ' · limite em cerca de ' + m + (m === 1 ? ' mês' : ' meses') : '') + '</div>' : '<span class="sec">Sem limite de uso</span>') + '</td><td><b>' + brl(gastoAteHoje(x)) + '</b></td><td>' + (x.repasse ? 'Sim, +' + (x.markup || 0) + '%' : 'Não') + '</td><td><div class="acoes"><button class="btn sec peq" type="button" data-editar-custo="' + x.id + '">Editar</button><button class="ico-btn perigo" type="button" data-excluir-custo="' + x.id + '" aria-label="Excluir">' + SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>') + '</button></div></td></tr>'; }).join('')).join('') : '<tr><td colspan="9" class="sec">Nenhum custo registrado para este cliente.</td></tr>') +
    '</tbody></table></div>';
}
function custoEquipe(){
  const pessoas = D.people.filter(p => p.custo);
  return '<p class="intro">O custo de cada pessoa pelas regras do vínculo. CLT soma férias, 1/3, 13º, FGTS, multa do FGTS e, fora do Simples, o INSS patronal. O custo hora usa só as horas faturáveis' + I('Billable hours (horas faturáveis): a parte do tempo que vira trabalho de cliente, sem reuniões e administrativo') + '.</p>' +
    '<div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:18%"><col style="width:10%"><col style="width:36%"><col style="width:12%"><col style="width:10%"><col style="width:14%"></colgroup><thead><tr><th>Pessoa</th><th>Vínculo</th><th>Composição do custo</th><th>Custo mensal</th><th>Custo hora</th><th></th></tr></thead><tbody>' +
    pessoas.map(p => { const c = custoPessoa(p); return '<tr><th scope="row" style="display:flex;gap:10px;align-items:center">' + avatar(p.id) + esc(p.nome) + '</th><td><span class="pill ' + (p.custo.vinculo === 'CLT' ? 'pp-dev' : p.custo.vinculo === 'PJ' ? 'pp-stake' : 'pp-owner') + '">' + esc(p.custo.vinculo) + '</span></td><td><ul class="comp-lista">' + c.detalhes.filter(d => d[1]).map(d => '<li><span>' + esc(d[0]) + '</span><b>' + brl(d[1]) + '</b></li>').join('') + '</ul></td><td><b>' + brl(c.total) + '</b></td><td>' + brl(c.hora) + '<div class="sec" style="font-size:11px">' + num(c.horasFat, 0) + 'h faturáveis</div></td><td><button class="btn sec peq" type="button" data-custo-pessoa="' + p.id + '">Editar custo</button></td></tr>'; }).join('') +
    '<tr class="total-l"><th scope="row">Time</th><td></td><td></td><td><b>' + brl(custoEquipeMensal()) + '</b></td><td><b>' + brl(custoHoraMedio()) + '</b><div class="sec" style="font-size:11px">média</div></td><td></td></tr></tbody></table></div>' +
    (D.people.some(p => !p.custo && p.acesso !== 'stakeholder') ? '<p class="sec" style="font-size:13px">Pessoas sem custo cadastrado: ' + D.people.filter(p => !p.custo && p.acesso !== 'stakeholder').map(p => '<button class="btn fant peq" type="button" data-custo-pessoa="' + p.id + '">' + esc(p.nome) + '</button>').join('') + '</p>' : '');
}
function custoOperacao(){
  const tot = overheadMensal();
  return '<div class="topo-tela"><p class="intro" style="margin:0">Tudo o que a IT.IA paga para funcionar, fora a equipe. Entra no preço como rateio por hora faturável.</p><div class="acoes"><button class="btn" type="button" data-acao="novo-op">' + ICO.mais + 'Novo custo</button></div></div><div style="height:12px"></div>' +
    '<div class="tabela-rolo"><table class="tabela"><thead><tr><th>Item</th><th>Categoria</th><th>Valor</th><th>Recorrência</th><th>Equivale por mês</th><th></th></tr></thead><tbody>' +
    D.opCustos.map(o => '<tr><th scope="row">' + esc(o.nome) + '</th><td>' + esc(o.cat) + '</td><td>' + (o.moeda === 'USD' ? 'US$ ' + num(o.valor, 2) : brl(o.valor)) + '</td><td>' + esc(o.rec) + (o.rec === 'Depreciação' ? ' em ' + (o.meses || 36) + ' meses' : '') + '</td><td>' + brl(mensalEq(o)) + '</td><td><div class="acoes"><button class="btn sec peq" type="button" data-editar-op="' + o.id + '">Editar</button><button class="ico-btn perigo" type="button" data-excluir-op="' + o.id + '" aria-label="Excluir">' + SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>') + '</button></div></td></tr>').join('') +
    '<tr class="total-l"><th scope="row">Total por mês</th><td></td><td></td><td></td><td><b>' + brl(tot) + '</b></td><td></td></tr></tbody></table></div>';
}
function custoRegras(){
  const r = R();
  const campo = (rot, info, k, sub, suf) => '<label class="lb">' + esc(rot) + (info ? I(info) : '') + '<span class="com-suf"><input class="campo" type="number" step="any" data-regra="' + k + (sub ? '|' + sub : '') + '" value="' + (sub ? r[k][sub] : r[k]) + '"><span>' + (suf || '') + '</span></span></label>';
  return '<p class="intro">As regras que o sistema usa para calcular custo e preço. Mudou aqui, todo o Catalog e todo o Costs recalculam na hora.</p>' +
    '<div class="regras-g">' +
      '<section class="g-cartao"><h4>Impostos</h4><label class="lb">Regime tributário' + I('Regime tributário: muda os impostos sobre a nota e se o INSS patronal entra no custo da CLT') + '<select class="sel" data-regra="regime">' + [['simples','Simples Nacional'],['presumido','Lucro Presumido'],['real','Lucro Real']].map(([k, n]) => '<option value="' + k + '"' + (r.regime === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
        campo('Alíquota no Simples', 'Alíquota efetiva do Simples sobre o faturamento (varia pela faixa e pelo Fator R)', 'impostos', 'simples', '%') + campo('Alíquota no Presumido', 'ISS, PIS, COFINS, IRPJ e CSLL somados', 'impostos', 'presumido', '%') + campo('Alíquota no Real', 'Estimativa média no Lucro Real', 'impostos', 'real', '%') + '</section>' +
      '<section class="g-cartao"><h4>Encargos da CLT</h4>' + campo('INSS patronal', 'Fora do Simples', 'encargos', 'inss', '%') + campo('RAT', 'Risco de acidente de trabalho', 'encargos', 'rat', '%') + campo('Terceiros', 'Sistema S e outras entidades', 'encargos', 'terceiros', '%') + campo('FGTS', '', 'encargos', 'fgts', '%') + campo('Férias', 'Provisão mensal de 1/12', 'encargos', 'ferias', '%') + campo('1/3 de férias', 'Provisão mensal de 1/36', 'encargos', 'terco', '%') + campo('13º salário', 'Provisão mensal de 1/12', 'encargos', 'decimo', '%') + campo('Multa do FGTS', 'Provisão para a multa de 40% na demissão', 'encargos', 'multaFgts', '%') + '</section>' +
      '<section class="g-cartao"><h4>Horas e margem</h4>' + campo('Horas de trabalho por mês', '', 'horasMes', null, 'h') + campo('Horas faturáveis', 'Parte do tempo que vira trabalho de cliente. O comum é de 50% a 70%', 'faturavel', null, '%') + campo('Margem de lucro', 'O comum em software house é de 15% a 30%', 'margem', null, '%') + campo('Contingência', 'Reserva para imprevistos. O comum é de 10% a 20%', 'risco', null, '%') + campo('Reserva sobre a operação', 'Folga sobre o rateio da operação interna', 'reservaOverhead', null, '%') + campo('Manutenção anual padrão', 'Percentual do valor do projeto cobrado por ano. O comum é de 15% a 20%', 'manutencaoAnual', null, '%') + campo('Câmbio do dólar', 'Usado para custos em dólar. Quando o banco for ligado, atualiza sozinho', 'cambio', null, 'R$') + '</section>' +
      '<section class="g-cartao"><h4>Multiplicadores</h4>' + Object.keys(r.complexidade).map(k => campo('Complexidade ' + k.toLowerCase(), '', 'complexidade', k, '×')).join('') + Object.keys(r.urgencia).map(k => campo('Urgência ' + k.toLowerCase(), '', 'urgencia', k, '×')).join('') + '</section>' +
    '</div>' +
    '<div class="kpis"><div class="kpi"><b>' + brl(custoHoraMedio()) + '</b><span>Custo hora médio do time</span></div><div class="kpi"><b>' + brl(overheadHora()) + '</b><span>Rateio da operação por hora</span></div><div class="kpi"><b>' + brl(precoHora()) + '</b><span>Preço hora sugerido</span></div><div class="kpi"><b>' + num(capacidadeFat(), 0) + 'h</b><span>Horas faturáveis do time por mês</span></div></div>' +
    '<h2 class="sub">No banco do projeto</h2><p class="intro">Estas contas já estão no banco do sistema, no ar no Supabase e conferidas com os números desta tela. A tela passa a ler de lá quando o login existir.</p><div class="tabela-rolo"><table class="tabela"><thead><tr><th style="width:26%">O quê</th><th>Como ficou no banco</th><th style="width:18%">Situação</th></tr></thead><tbody>' +
      [['Guardar o uso de cada item todo mês','Um registro por mês de cada custo, e a conta mês a mês usa o uso real e prevê os próximos pela tendência','Pronto'],
       ['Buscar o uso direto dos fornecedores','A tabela de uso já recebe os números. Trazer sozinho do Supabase, Vercel, Anthropic e WhatsGW precisa da chave de acesso de cada fornecedor','Depende das integrações'],
       ['Previsão e alerta de limite','A previsão diz em quantos meses cada plano chega no limite, e o aviso aparece no painel do Master','Pronto'],
       ['Câmbio do dia','Uma cotação por dia e por moeda, e cada mês usa o dólar daquele mês. Buscar a cotação sozinho precisa de um serviço de câmbio','Pronto; busca automática depende de serviço'],
       ['Custo real por hora trabalhada','O tempo registrado no cronômetro cruza com o custo de cada pessoa','Pronto, fica exato conforme o time registra tempo'],
       ['Histórico das regras de cálculo','Cada regra tem a data em que passa a valer; mudar hoje não reescreve o passado','Pronto'],
       ['Proteção dos dados de salário','Só o Master lê salários e custos da equipe; o Dev e o stakeholder não enxergam nem pela API','Pronto']].map(([a, b, c]) => '<tr><th scope="row">' + a + '</th><td class="sec">' + b + '</td><td>' + (c === 'Pronto' ? '<span class="rc-sit">Pronto</span>' : '<span class="rc-sit alerta">' + c + '</span>') + '</td></tr>').join('') +
    '</tbody></table></div>';
}

function vCustosEscopo(chave){
  const cs = custosDoEscopo(chave), rs = receitasDoEscopo(chave);
  const inicios = cs.map(x => mesIdx(parse(inicioCusto(x)))).concat(rs.map(r => mesIdx(parse(r.inicio) || HOJE)));
  const desde = Math.max(HOJE_M - 23, Math.min(HOJE_M - 5, ...(inicios.length ? inicios : [HOJE_M])));
  const offs = []; for (let m = desde; m <= HOJE_M + 6; m++) offs.push(m - HOJE_M);
  const mesesDados = offs.map(off => ({off, c: cs.reduce((s, x) => s + custoNoMes(x, off, true), 0), r: rs.reduce((s, r) => s + receitaNoMes(r, off), 0)}));
  const max = Math.max(1, ...mesesDados.map(m => Math.max(m.c, m.r)));
  const gasto = cs.reduce((s, x) => s + gastoAteHoje(x), 0), cobrado = rs.reduce((s, r) => s + cobradoAteHoje(r), 0);
  const mesAtual = cs.reduce((s, x) => s + custoNoMes(x, 0, false), 0);
  const hr = horasRestantes(chave), prevEquipe = hr * custoHoraMedio() * (1 + R().risco / 100);
  const aReceber = rs.reduce((s, r) => r.rec === 'Mensal' ? s : s + Math.max(0, (+r.valor || 0) - cobradoAteHoje(r)), 0);
  return '<div class="topo-tela" style="margin-bottom:8px"><p class="intro" style="margin:0">Custos técnicos e receitas de ' + esc(nomeDe(chave)) + '. A data de início pode ser antiga: o sistema calcula tudo o que já foi gasto e cobrado desde então.</p><div class="acoes"><button class="btn sec" type="button" data-acao="nova-receita">' + ICO.mais + 'Nova receita</button><button class="btn" type="button" data-acao="novo-custo-escopo">' + ICO.mais + 'Novo custo</button></div></div>' +
    '<div class="kpis" style="margin-top:12px"><div class="kpi"><b>' + brl(mesAtual) + '</b><span>Custo técnico por mês</span></div><div class="kpi"><b>' + brl(gasto) + '</b><span>Já gasto até hoje</span></div><div class="kpi"><b>' + brl(cobrado) + '</b><span>Já cobrado até hoje</span></div><div class="kpi ' + (cobrado - gasto < 0 ? 'alerta' : '') + '"><b>' + brl(cobrado - gasto) + '</b><span>Resultado acumulado' + I('Resultado acumulado: tudo o que já foi cobrado menos tudo o que já foi gasto em custos técnicos. A equipe entra na previsão ao lado') + '</span></div><div class="kpi"><b>' + brl(aReceber) + '</b><span>Ainda a receber</span></div><div class="kpi"><b>' + brl(prevEquipe) + '</b><span>Equipe para terminar' + I('Horas que ainda faltam nas tarefas abertas vezes o custo hora do time, com contingência') + '</span></div></div>' +
    '<div class="grafico" style="margin-top:24px"><h3>Linha do tempo: custo e receita por mês</h3><div class="graf-rolo"><div style="min-width:' + (mesesDados.length * 30) + 'px"><div class="colunas duplas">' + mesesDados.map(m => '<div class="c' + (m.off > 0 ? ' previsto' : '') + (m.off === 0 ? ' atual' : '') + '" title="' + rotuloOff(m.off) + ': custo ' + brl(m.c) + ' · receita ' + brl(m.r) + (m.off > 0 ? ' (previsão)' : '') + '"><div class="par"><div class="b tec" style="height:' + (m.c / max * 100) + '%"></div><div class="b rec" style="height:' + (m.r / max * 100) + '%"></div></div></div>').join('') + '</div><div class="eixo">' + mesesDados.map(m => '<span' + (m.off > 0 ? ' class="prev"' : '') + '>' + rotuloOff(m.off) + '</span>').join('') + '</div></div></div><div class="legenda"><span><i style="background:#C26A00"></i>Custo técnico pago no mês</span><span><i style="background:#1E8E3E"></i>Receita cobrada no mês</span><span><i class="hach"></i>Previsão</span></div></div>' +
    '<h2 class="sub">Custos' + (cs.length ? ' <span class="rotulo-mini">' + cs.length + '</span>' : '') + '</h2><div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:20%"><col style="width:13%"><col style="width:9%"><col style="width:10%"><col style="width:11%"><col style="width:11%"><col style="width:16%"><col style="width:10%"></colgroup><thead><tr><th>Item</th><th>Aplicação</th><th>Recorrência</th><th>Começou em</th><th>Custo no mês</th><th>Já gasto</th><th>Uso e limite</th><th></th></tr></thead><tbody>' +
      (cs.length ? cs.map(x => '<tr><th scope="row">' + esc(x.fornecedor) + '<div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400">' + esc(x.desc) + '</div></th><td>' + esc((byId('apps', x.app) || {nome:'Todo o projeto'}).nome) + '</td><td>' + esc(x.rec) + '</td><td>' + fmtData(inicioCusto(x)) + (x.fim ? '<div class="sec" style="font-size:11px">até ' + fmtData(x.fim) + '</div>' : '') + '</td><td>' + brl(custoNoMes(x, 0, false)) + '</td><td><b>' + brl(gastoAteHoje(x)) + '</b></td><td>' + (x.uso ? usoBarra(x.uso) : '<span class="sec">Sem limite</span>') + '</td><td><div class="acoes"><button class="btn sec peq" type="button" data-editar-custo="' + x.id + '">Editar</button><button class="ico-btn perigo" type="button" data-excluir-custo="' + x.id + '" aria-label="Excluir">' + SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>') + '</button></div></td></tr>').join('') : '<tr><td colspan="8" class="sec">Nenhum custo registrado aqui ainda.</td></tr>') +
    '</tbody></table></div>' +
    '<h2 class="sub">Receitas' + (rs.length ? ' <span class="rotulo-mini">' + rs.length + '</span>' : '') + '</h2><div class="tabela-rolo"><table class="tabela"><colgroup><col style="width:24%"><col style="width:13%"><col style="width:12%"><col style="width:10%"><col style="width:12%"><col style="width:12%"><col style="width:17%"></colgroup><thead><tr><th>Receita</th><th>Modelo</th><th>Como é cobrada</th><th>Começou em</th><th>Valor</th><th>Já cobrado</th><th></th></tr></thead><tbody>' +
      (rs.length ? rs.map(r => '<tr><th scope="row">' + esc(r.desc) + '<div class="sec" style="font-family:var(--font-body);font-size:12px;font-weight:400">' + esc((byId('catalog', r.servico) || {nome:''}).nome) + '</div></th><td>' + esc((MODELOS_PRECO[r.modelo] || {nome:r.modelo || ''}).nome) + '</td><td>' + esc(r.rec === 'Parcelado' ? r.parcelas + ' parcelas mensais' : r.rec) + '</td><td>' + fmtData(r.inicio) + (r.fim ? '<div class="sec" style="font-size:11px">até ' + fmtData(r.fim) + '</div>' : '') + '</td><td>' + brl(+r.valor || 0) + (r.rec === 'Mensal' ? '<div class="sec" style="font-size:11px">por mês</div>' : '') + '</td><td><b>' + brl(cobradoAteHoje(r)) + '</b></td><td><div class="acoes"><button class="btn sec peq" type="button" data-editar-receita="' + r.id + '">Editar</button><button class="ico-btn perigo" type="button" data-excluir-receita="' + r.id + '" aria-label="Excluir">' + SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>') + '</button></div></td></tr>').join('') : '<tr><td colspan="7" class="sec">Nenhuma receita registrada aqui ainda.</td></tr>') +
    '</tbody></table></div>';
}
const fmtData = s => { const d = parse(s); return d ? String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth() + 1).padStart(2,'0') + '/' + d.getFullYear() : ''; };
function formReceita(r, preset){
  const c = cadeia(UI.sel);
  r = r || Object.assign({desc:'', cliente: c.client ? c.client.id : cliPadrao(), project: c.project ? c.project.id : '', app: c.app ? c.app.id : '', servico:'', modelo:'fixo', valor:0, rec:'Único', parcelas:3, inicio:iso(HOJE), fim:''}, preset || {});
  return '<div class="grade-form"><label class="lb largo">Descrição<input class="campo" id="fr-desc" value="' + esc(r.desc) + '" placeholder="Ex.: Implantação do Java Financeiro"></label>' +
    '<label class="lb">Cliente<select class="sel" id="fr-cli">' + D.clients.map(x => '<option value="' + x.id + '"' + (r.cliente === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Projeto<select class="sel" id="fr-proj"><option value="">Nenhum</option>' + D.projects.map(x => '<option value="' + x.id + '"' + (r.project === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Aplicação<select class="sel" id="fr-app"><option value="">Todo o projeto</option>' + D.apps.map(a => '<option value="' + a.id + '"' + (r.app === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Serviço do Catalog<select class="sel" id="fr-sv"><option value="">Nenhum</option>' + D.catalog.map(s => '<option value="' + s.id + '"' + (r.servico === s.id ? ' selected' : '') + '>' + esc(s.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Modelo de cobrança<select class="sel" id="fr-mod">' + Object.entries(MODELOS_PRECO).map(([k, m]) => '<option value="' + k + '"' + (r.modelo === k ? ' selected' : '') + '>' + esc(m.nome) + ' · ' + esc(m.expl) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Como é cobrada<select class="sel" id="fr-rec">' + [['Único','De uma vez'],['Parcelado','Parcelado mês a mês'],['Mensal','Todo mês']].map(([k, n]) => '<option value="' + k + '"' + (r.rec === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
    '<label class="lb">Valor (total, ou por mês se for mensal)<input class="campo" type="number" step="any" id="fr-val" value="' + (r.valor || 0) + '"></label>' +
    '<label class="lb">Número de parcelas<input class="campo" type="number" min="1" id="fr-parc" value="' + (r.parcelas || 1) + '"></label>' +
    '<label class="lb">Começou em' + I('Pode ser uma data antiga. O sistema soma tudo o que já foi cobrado desde essa data') + '<input class="campo" type="date" id="fr-ini" value="' + esc(r.inicio || '') + '"></label>' +
    '<label class="lb">Terminou em (opcional)<input class="campo" type="date" id="fr-fim" value="' + esc(r.fim || '') + '"></label></div>';
}
function salvarReceita(dlg, r){
  const desc = $('#fr-desc', dlg).value.trim(); if (!desc){ toast('Escreva a descrição'); return false; }
  const nova = !r; r = r || {id:uid('rc')};
  Object.assign(r, {desc, cliente:$('#fr-cli', dlg).value, project:$('#fr-proj', dlg).value, app:$('#fr-app', dlg).value, servico:$('#fr-sv', dlg).value, modelo:$('#fr-mod', dlg).value, rec:$('#fr-rec', dlg).value, valor:+$('#fr-val', dlg).value || 0, parcelas:Math.max(1, +$('#fr-parc', dlg).value || 1), inicio:$('#fr-ini', dlg).value || iso(HOJE), fim:$('#fr-fim', dlg).value});
  if (nova) D.receitas.push(r); salvar(); render(); toast(nova ? 'Receita registrada. Já cobrado até hoje: ' + brl(cobradoAteHoje(r)) : 'Receita salva');
}
function formCusto(c, preset){
  c = c || Object.assign({cliente: UI.ctCliente || cliPadrao(), app:'', fornecedor:'', cat:'Hospedagem', desc:'', rec:'Mensal', moeda:'BRL', valor:0, uso:null, repasse:true, markup:15, inicio:iso(HOJE), fim:''}, preset || {});
  const u = c.uso || {unidade:'', hist:[0], limite:0, plano:'', prox:{nome:'', valor:0, obs:''}};
  return '<div class="grade-form"><label class="lb">Cliente<select class="sel" id="fc2-cli">' + D.clients.map(x => '<option value="' + x.id + '"' + (c.cliente === x.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label><label class="lb">Aplicação<select class="sel" id="fc2-app"><option value="">Sem aplicação</option>' + D.apps.map(a => '<option value="' + a.id + '"' + (c.app === a.id ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('') + '</select></label>' +
    '<label class="lb">Fornecedor<input class="campo" id="fc2-for" value="' + esc(c.fornecedor) + '" placeholder="Ex.: Supabase"></label><label class="lb">Categoria<input class="campo" id="fc2-cat" value="' + esc(c.cat) + '" list="cats-custo"><datalist id="cats-custo">' + ['Banco de dados','Armazenamento','Hospedagem','API de IA','Mensageria','Integração','Domínio','Licença'].map(x => '<option value="' + x + '">').join('') + '</datalist></label>' +
    '<label class="lb largo">Descrição<input class="campo" id="fc2-desc" value="' + esc(c.desc) + '"></label>' +
    '<label class="lb">Recorrência<select class="sel" id="fc2-rec">' + ['Mensal','Anual','Por uso','Único'].map(x => '<option' + (c.rec === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label><label class="lb">Moeda<select class="sel" id="fc2-moeda"><option' + (c.moeda === 'BRL' ? ' selected' : '') + '>BRL</option><option' + (c.moeda === 'USD' ? ' selected' : '') + '>USD</option></select></label><label class="lb">Valor do plano<input class="campo" type="number" step="any" id="fc2-valor" value="' + c.valor + '"></label>' +
    '<label class="lb">Começou em' + I('Pode ser uma data antiga. O sistema soma tudo o que já foi gasto desde essa data') + '<input class="campo" type="date" id="fc2-ini" value="' + esc(c.inicio || inicioCusto(c)) + '"></label><label class="lb">Terminou em (opcional)<input class="campo" type="date" id="fc2-fim" value="' + esc(c.fim || '') + '"></label>' +
    '<label class="lb">Repasse ao cliente<select class="sel" id="fc2-rep"><option value="1"' + (c.repasse ? ' selected' : '') + '>Sim</option><option value="0"' + (!c.repasse ? ' selected' : '') + '>Não</option></select></label><label class="lb">Taxa do repasse (%)<input class="campo" type="number" step="any" id="fc2-mk" value="' + (c.markup || 0) + '"></label></div>' +
    '<div class="bloco-g"><h4>Limite de uso e próximo plano' + I('Deixe o limite em zero se este custo não tem limite de uso') + '</h4><div class="grade-form"><label class="lb">Unidade<input class="campo" id="fc2-un" value="' + esc(u.unidade) + '" placeholder="GB, números, chamadas"></label><label class="lb">Uso atual<input class="campo" type="number" step="any" id="fc2-atual" value="' + (u.hist[u.hist.length - 1] || 0) + '"></label><label class="lb">Limite do plano<input class="campo" type="number" step="any" id="fc2-lim" value="' + (u.limite || 0) + '"></label><label class="lb">Plano atual<input class="campo" id="fc2-plano" value="' + esc(u.plano) + '"></label><label class="lb">Próximo plano<input class="campo" id="fc2-pn" value="' + esc(u.prox ? u.prox.nome : '') + '"></label><label class="lb">Valor do próximo plano<input class="campo" type="number" step="any" id="fc2-pv" value="' + (u.prox ? u.prox.valor || 0 : 0) + '"></label><label class="lb largo">Regra da troca<input class="campo" id="fc2-po" value="' + esc(u.prox ? u.prox.obs : '') + '" placeholder="Ex.: ao passar de 10 números, muda para o plano de 20"></label></div></div>';
}
function editarOp(o){
  const x = o || {nome:'', cat:'Ferramentas', valor:0, moeda:'BRL', rec:'Mensal', meses:36};
  modal(o ? 'Editar custo da operação' : 'Novo custo da operação', '<div class="grade-form"><label class="lb largo">Item<input class="campo" id="op-n" value="' + esc(x.nome) + '"></label><label class="lb">Categoria<input class="campo" id="op-c" value="' + esc(x.cat) + '" list="op-cats"><datalist id="op-cats">' + ['Ferramentas','Administrativo','Estrutura','Equipamentos','Marketing','Impostos e taxas'].map(v => '<option value="' + v + '">').join('') + '</datalist></label><label class="lb">Valor<input class="campo" type="number" step="any" id="op-v" value="' + x.valor + '"></label><label class="lb">Moeda<select class="sel" id="op-m"><option' + (x.moeda === 'BRL' ? ' selected' : '') + '>BRL</option><option' + (x.moeda === 'USD' ? ' selected' : '') + '>USD</option></select></label><label class="lb">Recorrência<select class="sel" id="op-r">' + ['Mensal','Anual','Depreciação','Único'].map(v => '<option' + (x.rec === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label><label class="lb">Meses de depreciação<input class="campo" type="number" id="op-me" value="' + (x.meses || 36) + '"></label></div>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => { const n = $('#op-n', d).value.trim(); if (!n){ toast('Escreva o item'); return false; } const y = o || {id:uid('oc')}; y.nome = n; y.cat = $('#op-c', d).value; y.valor = +$('#op-v', d).value || 0; y.moeda = $('#op-m', d).value; y.rec = $('#op-r', d).value; y.meses = +$('#op-me', d).value || 36; if (!o) D.opCustos.push(y); salvar(); rCustos(); toast('Custo salvo'); }}]);
}
function salvarCusto(dlg, c){
  const novo = !c; c = c || {id:uid('ct')};
  c.cliente = $('#fc2-cli', dlg).value; c.app = $('#fc2-app', dlg).value; c.fornecedor = $('#fc2-for', dlg).value.trim() || 'Fornecedor'; c.cat = $('#fc2-cat', dlg).value.trim() || 'Outros'; c.desc = $('#fc2-desc', dlg).value; c.rec = $('#fc2-rec', dlg).value; c.moeda = $('#fc2-moeda', dlg).value; c.valor = +$('#fc2-valor', dlg).value || 0; c.repasse = $('#fc2-rep', dlg).value === '1'; c.markup = +$('#fc2-mk', dlg).value || 0; c.inicio = $('#fc2-ini', dlg).value || iso(HOJE); c.fim = $('#fc2-fim', dlg).value;
  const lim = +$('#fc2-lim', dlg).value || 0, atual = +$('#fc2-atual', dlg).value || 0;
  if (lim > 0){ const h = (c.uso && c.uso.hist) ? c.uso.hist.slice() : [atual]; h[h.length - 1] = atual; c.uso = {unidade:$('#fc2-un', dlg).value, hist:h, limite:lim, plano:$('#fc2-plano', dlg).value, prox:{nome:$('#fc2-pn', dlg).value, valor:+$('#fc2-pv', dlg).value || 0, obs:$('#fc2-po', dlg).value}}; } else c.uso = null;
  if (novo) D.custos.push(c); salvar(); render(); toast(novo ? 'Custo registrado. Já gasto até hoje: ' + brl(gastoAteHoje(c)) : 'Custo salvo');
}

/* ================= eventos globais ================= */
document.addEventListener('click', e => {
  const t = e.target;
  const q = s => t.closest(s);
  let x;
  if ((x = q('[data-fechar-gaveta]'))) { fecharItem(); return; }
  if ((x = q('[data-abrir-item]'))) { abrirItem(x.dataset.abrirItem); return; }
  if ((x = q('.cartao,[data-item].ev'))) { if (!q('button')) { abrirItem(x.dataset.item); return; } }
  if ((x = q('[data-tab-alt]'))) { UI.tabAbertos = UI.tabAbertos || {}; const k = x.dataset.tabAlt; UI.tabAbertos[k] = !UI.tabAbertos[k]; salvarUI(); render(); return; }
  if ((x = q('[data-tab-todos]'))) { UI.tabAbertos = {}; if (x.dataset.tabTodos === '1'){ const abrir = k => { const s = filhosDe(k); if (s.length){ UI.tabAbertos[k] = true; s.forEach(abrir); } }; const base = UI.modulo === 'overview' ? (UI.verComo === 'stakeholder' ? (pessoa(idEu('stakeholder')) || {escopo:'all'}).escopo : (UI.ovSel || 'all')) : UI.sel; filhosDe(base).forEach(abrir); } salvarUI(); render(); return; }
  if ((x = q('[data-ov]'))) { UI.ovSel = x.dataset.ov; salvarUI(); rOverview(); return; }
  if ((x = q('#m-overview [data-ir]'))) { UI.ovSel = x.dataset.ir; salvarUI(); rOverview(); return; }
  if ((x = q('#m-operacoes [data-ir]'))) { UI.sel = x.dataset.ir; UI.view = 'dashboard'; abrirArvore(UI.sel); salvarUI(); rOperacoes(); return; }
  if ((x = q('[data-ir-ops]'))) { UI.sel = x.dataset.irOps; abrirArvore(UI.sel); UI.view = 'dashboard'; abrirModulo('operacoes'); return; }
  if ((x = q('[data-alt]'))) { const k = x.dataset.alt; UI.abertos[k] = !UI.abertos[k]; salvarUI(); rOperacoes(); return; }
  if ((x = q('[data-criar]'))) { criarDentro(x.dataset.criar); return; }
  if ((x = q('[data-no-ir]'))) { UI.sel = x.dataset.noIr; UI.view = 'dashboard'; salvarUI(); rOperacoes(); return; }
  if ((x = q('[data-no]'))) { if (UI.sel !== x.dataset.no) UI.view = 'dashboard'; UI.sel = x.dataset.no; if (!UI.abertos[UI.sel]) UI.abertos[UI.sel] = true; salvarUI(); rOperacoes(); return; }
  if ((x = q('[data-view]'))) { UI.view = x.dataset.view; salvarUI(); $$('.view-b').forEach(b => b.setAttribute('aria-selected', String(b === x))); rView(); return; }
  if ((x = q('[data-filtro]'))) { const k = x.dataset.filtro; UI.filtros[k] = !UI.filtros[k]; salvarUI(); rView(); return; }
  if ((x = q('[data-ordem]'))) { const c = x.dataset.ordem; UI.ordem = {campo:c, dir: UI.ordem.campo === c ? -UI.ordem.dir : 1}; salvarUI(); rView(); return; }
  if ((x = q('[data-cal-modo]'))) { UI.calModo = x.dataset.calModo; salvarUI(); rView(); return; }
  if ((x = q('[data-carga-modo]'))) { UI.cargaModo = x.dataset.cargaModo; salvarUI(); rView(); return; }
  if ((x = q('[data-cal-nav]'))) { const n = +x.dataset.calNav; const r = parse(UI.calRef) || HOJE; const modo = UI.view === 'workload' ? UI.cargaModo : UI.calModo; UI.calRef = n === 0 ? iso(HOJE) : iso(modo === 'mes' ? new Date(r.getFullYear(), r.getMonth() + n, 1) : dAdd(r, n * (modo === 'dia' ? 1 : 7))); salvarUI(); rView(); return; }
  if ((x = q('[data-cal-dia]'))) { UI.calModo = 'dia'; UI.calRef = x.dataset.calDia; salvarUI(); rView(); return; }
  if ((x = q('[data-bloco-dia]')) && !q('.ev') && podeEditar()) { reservarBloco(x.dataset.blocoDia, +x.dataset.blocoHora); return; }
  if ((x = q('[data-cumprir]'))) { cumprirItem(x.dataset.cumprir); return; }
  if ((x = q('[data-dispensar]'))) { dispensarItem(x.dataset.dispensar); return; }
  if ((x = q('[data-desfazer-item]'))) { const st = D.stages[UI.sel]; delete st[x.dataset.desfazerItem]; salvar(); rView(); return; }
  if ((x = q('[data-tirar-custom]'))) { D.sheets[UI.sel].custom.splice(+x.dataset.tirarCustom, 1); salvar(); rView(); return; }
  if ((x = q('[data-tirar-link]'))) { const i = byId('issues', itemAberto); i.links.splice(+x.dataset.tirarLink, 1); salvar(); abrirItem(i.id); return; }
  if ((x = q('[data-check]'))) { const i = byId('issues', itemAberto); i.check[+x.dataset.check].f = x.checked; salvar(); return; }
  if ((x = q('[data-tirar-tag]'))) { const d = x.dataset; D.tagLinks = D.tagLinks.filter(l => !(l.tag === d.tag && l.tipo === d.tipo && l.id === d.id)); salvar(); render(); return; }
  if ((x = q('[data-por-tag],[data-acao="por-tag"]'))) { porTag(x.dataset.tipo, x.dataset.id); return; }
  if ((x = q('[data-editar-cliente]'))) { const c = byId('clients', x.dataset.editarCliente); modal('Editar cliente', formCliente(c), [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => salvarCliente(d, c)}]); return; }
  if ((x = q('[data-editar-tag]'))) { const tg = byId('tags', x.dataset.editarTag); modal('Editar tag', formTag(tg), [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => salvarTag(d, tg)}]); return; }
  if ((x = q('[data-apagar-tag]'))) { const tg = byId('tags', x.dataset.apagarTag); const n = D.tagLinks.filter(l => l.tag === tg.id).length; modal('Excluir a tag ' + esc(tg.nome) + '?', '<p style="margin:0">' + (n ? 'Ela sai de ' + n + (n === 1 ? ' registro' : ' registros') + '. ' : '') + 'As ligações e as etiquetas automáticas não mudam.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.tags = D.tags.filter(z => z.id !== tg.id); D.tagLinks = D.tagLinks.filter(l => l.tag !== tg.id); salvar(); render(); toast('Tag excluída'); }}]); return; }
  if ((x = q('[data-ped]'))) { UI.pedSel = x.dataset.ped; salvarUI(); rServiceDesk(); return; }
  if ((x = q('[data-filtro-ped]'))) { UI.filtroPed = x.dataset.filtroPed; salvarUI(); rServiceDesk(); return; }
  if ((x = q('[data-agente]'))) { UI.agSel = x.dataset.agente; salvarUI(); rAgentes(); return; }
  if ((x = q('[data-tirar-fonte]'))) { (byId('agents', UI.agSel) || D.agents[0]).fontes.splice(+x.dataset.tirarFonte, 1); salvar(); rAgentes(); return; }
  if ((x = q('[data-servico]'))) { UI.svSel = x.dataset.servico; UI.svAba = 'comercial'; UI.svCtx = null; salvarUI(); rCatalog(); return; }
  if ((x = q('[data-sv-aba]'))) { UI.svAba = x.dataset.svAba; salvarUI(); rCatalog(); return; }
  if ((x = q('[data-tirar-comp]'))) { byId('catalog', UI.svSel).preco.splice(+x.dataset.tirarComp, 1); salvar(); rCatalog(); return; }
  if ((x = q('[data-tirar-lista]'))) { const [c, i] = x.dataset.tirarLista.split('|'); byId('catalog', UI.svSel)[c].splice(+i, 1); salvar(); rCatalog(); return; }
  if ((x = q('[data-ct-aba]'))) { UI.ctAba = x.dataset.ctAba; UI.ctCliente = null; salvarUI(); rCustos(); return; }
  if ((x = q('[data-ct-cliente]'))) { UI.ctAba = 'clientes'; UI.ctCliente = x.dataset.ctCliente; salvarUI(); rCustos(); return; }
  if ((x = q('[data-editar-custo]'))) { const c = byId('custos', x.dataset.editarCusto); modal('Editar custo', formCusto(c), [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => salvarCusto(d, c)}]); return; }
  if ((x = q('[data-excluir-custo]'))) { const c = byId('custos', x.dataset.excluirCusto); modal('Excluir o custo ' + esc(c.fornecedor) + '?', '<p style="margin:0">' + esc(c.desc) + '</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.custos = D.custos.filter(z => z.id !== c.id); salvar(); render(); toast('Custo excluído'); }}]); return; }
  if ((x = q('[data-custo-pessoa]'))) { const p = pessoa(x.dataset.custoPessoa); const c = p.custo || {vinculo:'CLT', salario:0, beneficios:0};
    modal('Custo de ' + esc(p.nome), '<div class="grade-form"><label class="lb">Vínculo<select class="sel" id="cp-v">' + ['CLT','PJ','Estágio','Sócio'].map(v => '<option' + (c.vinculo === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label><label class="lb">Salário ou bolsa<input class="campo" type="number" step="any" id="cp-s" value="' + (c.salario || 0) + '"></label><label class="lb">Valor da nota PJ<input class="campo" type="number" step="any" id="cp-pj" value="' + (c.valorPJ || 0) + '"></label><label class="lb">Pró-labore<input class="campo" type="number" step="any" id="cp-pl" value="' + (c.prolabore || 0) + '"></label><label class="lb">Benefícios por mês<input class="campo" type="number" step="any" id="cp-b" value="' + (c.beneficios || 0) + '"></label></div><p class="sec" style="margin:0;font-size:13px">Preencha só o campo do vínculo escolhido. Os encargos são calculados pelas Regras de cálculo.</p>',
      [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => { p.custo = {vinculo:$('#cp-v', d).value, salario:+$('#cp-s', d).value || 0, valorPJ:+$('#cp-pj', d).value || 0, prolabore:+$('#cp-pl', d).value || 0, beneficios:+$('#cp-b', d).value || 0}; salvar(); rCustos(); toast('Custo de ' + p.nome + ' salvo'); }}]); return; }
  if ((x = q('[data-editar-receita]'))) { const r = byId('receitas', x.dataset.editarReceita); modal('Editar receita', formReceita(r), [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => salvarReceita(d, r)}]); return; }
  if ((x = q('[data-excluir-receita]'))) { const r = byId('receitas', x.dataset.excluirReceita); modal('Excluir a receita ' + esc(r.desc) + '?', '<p style="margin:0">Sai dos totais cobrados e da linha do tempo.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.receitas = D.receitas.filter(z => z.id !== r.id); salvar(); render(); toast('Receita excluída'); }}]); return; }
  if ((x = q('[data-editar-op]'))) { editarOp(byId('opCustos', x.dataset.editarOp)); return; }
  if ((x = q('[data-excluir-op]'))) { const o = byId('opCustos', x.dataset.excluirOp); modal('Excluir ' + esc(o.nome) + '?', '<p style="margin:0">Sai do custo da operação e do rateio do preço hora.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.opCustos = D.opCustos.filter(z => z.id !== o.id); salvar(); rCustos(); toast('Custo excluído'); }}]); return; }
  if ((x = q('[data-tirar-ref]'))) { const [al, ix] = x.dataset.tirarRef.split('|'); const l = refsDe(al); if (l){ l.splice(+ix, 1); salvar(); reRenderRefs(al); } return; }
  if ((x = q('[data-ver-ref]'))) { const [al, ix] = x.dataset.verRef.split('|'); const r = (refsDe(al) || [])[+ix]; if (r) modal(esc(r.nome), '<img src="' + r.url + '" alt="' + esc(r.nome) + '" style="max-width:100%;display:block;margin:0 auto">', [{txt:'Fechar', cls:'sec'}]); return; }
  if ((x = q('[data-excluir-pessoa]'))) { const p = pessoa(x.dataset.excluirPessoa); const n = D.issues.filter(i => i.resp === p.id && i.status !== 'done' && !i.arquivado).length; modal('Excluir ' + esc(p.nome) + '?', '<p style="margin:0">' + (n ? n + (n === 1 ? ' item em aberto fica' : ' itens em aberto ficam') + ' sem responsável. ' : '') + 'O histórico do que a pessoa fez continua guardado.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.issues.forEach(i => { if (i.resp === p.id && i.status !== 'done') i.resp = null; }); D.people = D.people.filter(z => z.id !== p.id); salvar(); rTime(); toast(p.nome + ' excluído do time'); }}]); return; }
  if ((x = q('[data-excluir-agente]'))) { const ag = byId('agents', x.dataset.excluirAgente); modal('Excluir o agente ' + esc(ag.nome) + '?', '<p style="margin:0">As instruções, as fontes e as permissões dele saem do sistema.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.agents = D.agents.filter(z => z.id !== ag.id); UI.agSel = D.agents[0] ? D.agents[0].id : null; salvar(); salvarUI(); rAgentes(); toast('Agente excluído'); }}]); return; }
  if ((x = q('[data-nivel-f]'))) { const ag = byId('agents', UI.agSel) || D.agents[0]; ag.ferramentas[+x.dataset.nivelF][1] = x.dataset.nivelV; salvar(); rAgentes(); return; }
  if ((x = q('[data-tirar-ferr]'))) { const ag = byId('agents', UI.agSel) || D.agents[0]; ag.ferramentas.splice(+x.dataset.tirarFerr, 1); salvar(); rAgentes(); return; }
  if ((x = q('[data-editar-pessoa]'))) { const p = pessoa(x.dataset.editarPessoa); modal('Editar pessoa', formPessoa(p), [{txt:'Cancelar', cls:'sec'},{txt:'Salvar', acao:d => salvarPessoa(d, p)}]); return; }
  if ((x = q('[data-acao]'))) acao(x.dataset.acao, x);
});
function acao(a, x){
  if (a === 'novo-item') novoItem();
  else if (a === 'catalog-lista'){ UI.svSel = null; salvarUI(); rCatalog(); }
  else if (a === 'novo-servico') modal('Novo serviço', '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="ns-n" placeholder="Ex.: Chatbot de atendimento"></label><label class="lb">Categoria<input class="campo" id="ns-c" list="ns-cats"><datalist id="ns-cats">' + [...new Set(D.catalog.map(s => s.cat))].map(c => '<option value="' + esc(c) + '">').join('') + '</datalist></label><label class="lb">Horas mínimas<input class="campo" type="number" id="ns-h1" value="20"></label><label class="lb">Horas máximas<input class="campo" type="number" id="ns-h2" value="80"></label></div>', [{txt:'Cancelar', cls:'sec'},{txt:'Criar serviço', acao:d => { const n = $('#ns-n', d).value.trim(); if (!n){ toast('Escreva o nome do serviço'); return false; } const s = {id:uid('sv'), cat:$('#ns-c', d).value.trim() || 'Outros', nome:n, desc:'', entrega:[], frentes:['Frontend','Backend'], horas:[+$('#ns-h1', d).value || 0, +$('#ns-h2', d).value || 0], preco:[{m:'fixo'}], req:[], sla:'', check:[], ativo:true}; D.catalog.push(s); UI.svSel = s.id; UI.svAba = 'comercial'; UI.svCtx = null; salvar(); salvarUI(); rCatalog(); toast('Serviço criado'); }}]);
  else if (a === 'excluir-servico'){ const s = byId('catalog', UI.svSel); modal('Excluir o serviço ' + esc(s.nome) + '?', '<p style="margin:0">Projetos que já usaram este serviço continuam como estão.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Excluir', cls:'acento', acao:() => { D.catalog = D.catalog.filter(z => z.id !== s.id); UI.svSel = null; salvar(); salvarUI(); rCatalog(); toast('Serviço excluído'); }}]); }
  else if (a === 'add-comp'){ byId('catalog', UI.svSel).preco.push(Object.assign({m:'hora'}, JSON.parse(JSON.stringify(PADRAO_COMP.hora)))); salvar(); rCatalog(); }
  else if (a === 'ct-voltar'){ UI.ctCliente = null; salvarUI(); rCustos(); }
  else if (a === 'novo-custo') modal('Novo custo', formCusto(), [{txt:'Cancelar', cls:'sec'},{txt:'Registrar', acao:d => salvarCusto(d, null)}]);
  else if (a === 'novo-op') editarOp(null);
  else if (a === 'novo-custo-escopo'){ const c = cadeia(UI.sel); modal('Novo custo em ' + esc(nomeDe(UI.sel)), formCusto(null, {cliente: c.client ? (c.product && c.product.client ? c.product.client : c.client.id) : cliPadrao(), app: c.app ? c.app.id : ''}), [{txt:'Cancelar', cls:'sec'},{txt:'Registrar', acao:d => salvarCusto(d, null)}]); }
  else if (a === 'nova-receita') modal('Nova receita', formReceita(), [{txt:'Cancelar', cls:'sec'},{txt:'Registrar', acao:d => salvarReceita(d, null)}]);
  else if (a === 'por-foco'){ const ws = x.dataset.ws; if (D.focus) toast('Foco trocado. A frente anterior foi pausada e o tempo dela registrado.'); else toast('Frente em foco'); D.focus = {ws, desde:Date.now(), hist:(D.focus && D.focus.hist) || []}; salvar(); rOperacoes(); }
  else if (a === 'sair-foco'){ D.focus = null; salvar(); render(); toast('Foco pausado'); }
  else if (a === 'mover-app') moverApp(x.dataset.id);
  else if (a === 'cli-tags'){ UI.cliPag = 'tags'; salvarUI(); rClientes(); }
  else if (a === 'cli-clientes'){ UI.cliPag = 'clientes'; salvarUI(); rClientes(); }
  else if (a === 'arvore'){ UI.semArvore = !UI.semArvore; salvarUI(); rOperacoes(); }
  else if (a === 'novo-cliente-proj') novoProjeto();
  else if (a === 'novo-cliente') modal('Novo cliente', formCliente(), [{txt:'Cancelar', cls:'sec'},{txt:'Criar', acao:d => salvarCliente(d, null)}]);
  else if (a === 'nova-tag') modal('Nova tag', formTag(), [{txt:'Cancelar', cls:'sec'},{txt:'Criar', acao:d => salvarTag(d, null)}]);
  else if (a === 'novo-pedido') novoPedido();
  else if (a === 'virar-issue') virarIssue(x.dataset.id);
  else if (a === 'nova-pessoa') modal('Nova pessoa', formPessoa(), [{txt:'Cancelar', cls:'sec'},{txt:'Criar', acao:d => salvarPessoa(d, null)}]);
  else if (a === 'novo-agente') modal('Novo agente', '<div class="grade-form"><label class="lb largo">Nome<input class="campo" id="na-n" placeholder="Ex.: Agente de cobrança"></label><label class="lb largo">Papel<input class="campo" id="na-p" placeholder="O que ele faz, em uma frase"></label></div>', [{txt:'Cancelar', cls:'sec'},{txt:'Criar agente', acao:d => { const n = $('#na-n', d).value.trim(); if (!n){ toast('Escreva o nome do agente'); return false; } const ag = {id:uid('ag'), nome:n, papel:$('#na-p', d).value.trim() || 'Sem papel definido', instr:'', fontes:[], ferramentas:[['Consultar dados','Livre']], passa:''}; D.agents.push(ag); UI.agSel = ag.id; salvar(); salvarUI(); rAgentes(); toast('Agente criado'); }}]);
  else if (a === 'add-custom'){ const n = $('#cf-nome').value.trim(); if (!n){ toast('Escreva o nome do campo'); return; } D.sheets[UI.sel].custom.push({nome:n, tipo:$('#cf-tipo').value, valor:$('#cf-valor').value}); salvar(); rView(); }
  else if (a === 'cron'){ const i = byId('issues', itemAberto); const r = i.tempo.find(t => !t.fim); if (r) r.fim = Date.now(); else i.tempo.push({ini:Date.now(), fim:null, quem:idEu(UI.verComo), origem:'Timer'}); salvar(); abrirItem(i.id); }
  else if (a === 'arquivar-item'){ const i = byId('issues', itemAberto); i.arquivado = true; registrar('arquivou', i); salvar(); fecharItem(); toast('Item arquivado. Continua guardado no banco.'); }
  else if (a === 'reler-banco' && COM_BANCO){ toast('Lendo o banco de novo...'); carregarDoBanco(null).then(() => { render(); toast('Pronto: dados lidos do banco agora'); }); }
  else if (a === 'restaurar' && !COM_BANCO) modal('Restaurar os dados de exemplo?', '<p style="margin:0">Tudo o que foi mudado neste navegador volta para o exemplo inicial.</p>', [{txt:'Cancelar', cls:'sec'},{txt:'Restaurar', cls:'acento', acao:() => { D = semente(); salvar(); render(); toast('Dados de exemplo restaurados'); }}]);
}
function abrirArvore(chave){ caminho(chave).forEach(([k]) => { UI.abertos[k] = true; }); }

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'raias'){ UI.raias = t.value; salvarUI(); rView(); return; }
  if (t.dataset.estado){ const [tipo, id] = t.dataset.estado.split(':'); const m = {project:'projects', product:'products', app:'apps', ws:'ws'}[tipo]; const o = byId(m, id);
    if (t.value === 'on_hold'){ modal('Pausar ' + esc(o.nome), '<label class="lb">Motivo da pausa<textarea class="campo" id="motivo-pausa" rows="3" placeholder="Por que está pausando"></textarea></label><p class="sec" style="margin:0;font-size:13px">Enquanto estiver pausado, os prazos não contam como atraso no painel.</p>', [{txt:'Cancelar', cls:'sec', acao:() => { rOperacoes(); }},{txt:'Pausar', acao:d => { o.status = 'on_hold'; o.motivo = $('#motivo-pausa', d).value.trim() || 'Sem motivo registrado'; salvar(); rOperacoes(); toast(o.nome + ' pausado'); }}]); return; }
    o.status = t.value; o.motivo = ''; salvar(); rOperacoes(); toast(o.nome + ': ' + estNome(t.value)); return; }
  const linha = t.closest('[data-linha]');
  if (linha && t.dataset.editar){ const i = byId('issues', linha.dataset.linha); const campo = t.dataset.editar; if (campo === 'status') mudarStatus(i, t.value); else i[campo] = t.value || null; salvar(); if (campo === 'status' || campo === 'fim') rView(); return; }
  if (t.dataset.g && itemAberto){ const i = byId('issues', itemAberto); const c = t.dataset.g; if (c === 'status') mudarStatus(i, t.value); else if (c === 'est') i.est = +t.value || 0; else i[c] = t.value || null; salvar(); if (['ws','tipo','status','prio','resp','vis','fim'].includes(c)) abrirItem(i.id); return; }
  if (t.dataset.bloco && itemAberto){ const i = byId('issues', itemAberto); const b = i.bloco || {data:'', ini:'', fim:''}; b[t.dataset.bloco] = t.value; i.bloco = (b.data && b.ini && b.fim) ? b : (b.data || b.ini || b.fim ? b : null); salvar(); return; }
  if (t.dataset.ficha){ const f = D.sheets[UI.sel]; f.campos[t.dataset.ficha] = t.value; salvar(); return; }
  if (t.dataset.custom){ D.sheets[UI.sel].custom[+t.dataset.custom].valor = t.value; salvar(); return; }
  if (t.dataset.compM){ const s = byId('catalog', UI.svSel); s.preco[+t.dataset.compM] = Object.assign({m:t.value}, JSON.parse(JSON.stringify(PADRAO_COMP[t.value] || {}))); salvar(); rCatalog(); return; }
  if (t.dataset.compC){ const [ix, k, tp] = t.dataset.compC.split('|'); const s = byId('catalog', UI.svSel); s.preco[+ix][k] = tp === 'num' ? (+t.value || 0) : tp === 'lista' ? t.value.split(',').map(v => +v.trim()).filter(v => !isNaN(v)) : t.value; salvar(); rCatalog(); return; }
  if (t.dataset.faixa){ const [ix, fi, k] = t.dataset.faixa.split('|'); const f = byId('catalog', UI.svSel).preco[+ix].faixas[+fi]; f[k] = k === 'horas' ? (+t.value || 0) : t.value; salvar(); rCatalog(); return; }
  if (t.dataset.ctx){ UI.svCtx[t.dataset.ctx] = t.tagName === 'SELECT' ? t.value : (+t.value || 0); salvarUI(); rCatalog(); return; }
  if (t.dataset.sv){ byId('catalog', UI.svSel)[t.dataset.sv] = t.value; salvar(); if (t.dataset.sv === 'nome') toast('Nome salvo'); return; }
  if (t.dataset.svH){ byId('catalog', UI.svSel).horas[+t.dataset.svH] = +t.value || 0; salvar(); return; }
  if (t.hasAttribute('data-sv-ativo')){ byId('catalog', UI.svSel).ativo = t.checked; salvar(); toast(t.checked ? 'Serviço ativo' : 'Serviço inativo'); return; }
  if (t.dataset.svReq){ const s = byId('catalog', UI.svSel); const k = t.dataset.svReq; s.req = t.checked ? s.req.concat(k) : s.req.filter(x => x !== k); salvar(); rCatalog(); return; }
  if (t.dataset.regra){ const [k, sub] = t.dataset.regra.split('|'); const v = t.tagName === 'SELECT' ? t.value : (+t.value || 0); if (sub) D.regras[k][sub] = v; else D.regras[k] = v; salvar(); rCustos(); toast('Regra atualizada. Catalog e Costs recalculados.'); return; }
  if (t.dataset.refsAdd){ const al = t.dataset.refsAdd; Promise.all(Array.from(t.files).map(lerArquivo)).then(arqs => { const l = refsDe(al); if (!l) return; arqs.forEach(a => l.push(a)); salvar(); reRenderRefs(al); toast(arqs.length + (arqs.length === 1 ? ' referência adicionada' : ' referências adicionadas')); }); return; }
  if (t.id === 'ni-refs'){ const s = $('#ni-refs-n'); if (s) s.textContent = t.files.length ? Array.from(t.files).map(f => f.name).join(', ') : 'Imagens, arquivos, áudios e vídeos. Pode escolher vários.'; return; }
  if (t.id === 'fp-arq'){ const n = t.files.length; const s = $('#fp-arq-n'); if (s) s.textContent = n ? Array.from(t.files).map(f => f.name).join(', ') : 'Clique para escolher. Pode escolher vários.'; return; }
  if (t.dataset.anexarFicha){ Promise.all(Array.from(t.files).map(lerArquivo)).then(arqs => { arqs.forEach(a => { a.sec = t.dataset.anexarFicha; D.sheets[UI.sel].arquivos.push(a); }); salvar(); rView(); toast(arqs.length + (arqs.length === 1 ? ' arquivo anexado' : ' arquivos anexados')); }); return; }
  if (t.dataset.cfg){ const st = D.stages[UI.sel]; const k = 'cfg_' + t.dataset.cfg; st[k] = Object.assign({}, st[k], {[t.dataset.campo]: t.value}); salvar(); rView(); toast('Ajuste vale só para ' + nomeDe(UI.sel)); return; }
  if (t.dataset.tpl){ const it = D.template.flatMap(et => et.itens).find(z => z.id === t.dataset.tpl); it[t.dataset.campo] = t.dataset.campo === 'obrig' ? t.value === '1' : t.value; salvar(); toast('Modelo padrão atualizado'); return; }
  if (t.dataset.base){ D.baseline[t.dataset.base] = t.checked; salvar(); rConfig(); return; }
  if (t.dataset.pedCampo){ const r = byId('requests', UI.pedSel) || D.requests[0]; r[t.dataset.pedCampo] = t.value; salvar(); rServiceDesk(); return; }
  if (t.dataset.ag){ const a = byId('agents', UI.agSel) || D.agents[0]; a[t.dataset.ag] = t.value; salvar(); if (t.dataset.ag === 'papel' || t.dataset.ag === 'nome') rAgentes(); return; }
  if (t.dataset.nivel){ const a = byId('agents', UI.agSel); a.ferramentas[+t.dataset.nivel][1] = t.value; salvar(); return; }
});
let timerBusca;
document.addEventListener('input', e => {
  if (e.target.id === 'busca-itens'){ UI.busca = e.target.value; clearTimeout(timerBusca); timerBusca = setTimeout(() => { salvarUI(); const pos = e.target.selectionStart; rView(); const b = $('#busca-itens'); if (b){ b.focus(); b.setSelectionRange(pos, pos); } }, 250); }
  if (e.target.dataset.g === 'titulo' && itemAberto){ byId('issues', itemAberto).titulo = e.target.value; salvar(); }
});
document.addEventListener('submit', e => {
  const f = e.target; e.preventDefault();
  const txt = f.t ? f.t.value.trim() : '';
  if (f.dataset.addStatus){ if (!txt) return; const ws = UI.sel.startsWith('ws:') ? UI.sel.slice(3) : primeiroWs(UI.sel); if (!ws){ toast('Escolha uma aplicação ou frente para criar o item'); return; } { const ni = novoIssue({titulo:txt, status:f.dataset.addStatus, ws}); D.issues.push(ni); registrar('criou', ni); } salvar(); rView(); toast('Item criado'); return; }
  const i = itemAberto && byId('issues', itemAberto);
  if (f.dataset.form === 'check' && txt){ i.check.push({t:txt, f:false}); salvar(); abrirItem(i.id); }
  else if (f.dataset.form === 'link'){ if (!f.alvo.value) return; i.links.push({tipo:f.tipo.value, alvo:f.alvo.value}); salvar(); abrirItem(i.id); }
  else if (f.dataset.form === 'coment' && txt){ const stake = UI.verComo === 'stakeholder'; i.coments.push({quem: idEu(UI.verComo), txt, quando:iso(HOJE), cliente:stake}); registrar('comentou', i); salvar(); abrirItem(i.id); }
  else if (f.dataset.form === 'resp-ped' && txt){ const r = byId('requests', UI.pedSel) || D.requests[0]; r.msgs.push({de: UI.verComo === 'stakeholder' ? 'cliente' : 'voce', txt}); salvar(); rServiceDesk(); }
  else if (f.dataset.form === 'sv-lista' && txt){ byId('catalog', UI.svSel)[f.dataset.campo].push(txt); salvar(); rCatalog(); }
  else if (f.dataset.form === 'ref-link' && txt){ const l = refsDe(f.dataset.alvo); if (l){ l.push({nome:txt, tipo:'link', url:/^https?:\/\//.test(txt) ? txt : 'https://' + txt}); salvar(); reRenderRefs(f.dataset.alvo); toast('Link adicionado'); } }
  else if (f.dataset.form === 'fonte' && txt){ (byId('agents', UI.agSel) || D.agents[0]).fontes.push(txt); salvar(); rAgentes(); }
  else if (f.dataset.form === 'ferr' && txt){ (byId('agents', UI.agSel) || D.agents[0]).ferramentas.push([txt, 'Com confirmação']); salvar(); rAgentes(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && itemAberto && !document.querySelector('dialog[open]')) fecharItem();
  if (e.key === 'Enter' && e.target.matches('.cartao,.ped')){ e.target.click(); }
});

/* ================= criação e ações com modal ================= */
function primeiroWs(chave){ const l = issuesEm(chave); const [tipo, id] = chave.split(':'); if (tipo === 'app') return (D.ws.find(w => w.app === id) || {}).id; if (tipo === 'product'){ const a = D.apps.find(x => x.product === id); return a && (D.ws.find(w => w.app === a.id) || {}).id; } if (tipo === 'project'){ const a = D.apps.find(x => x.project === id); return a && (D.ws.find(w => w.app === a.id) || {}).id; } return l[0] && l[0].ws; }
function novoIssue(o){ return Object.assign({id:uid('is'), tipo:'task', titulo:'', desc:'', status:'todo', prio:'medium', resp:null, rep:idEu(UI.verComo), ini:iso(HOJE), fim:iso(dAdd(HOJE, 7)), alvo:iso(dAdd(HOJE, 7)), est:4, vis:'interno', pai:null, check:[], links:[], coments:[], tempo:[], refs:[], bloco:null, criado:iso(HOJE), feito:null}, o); }
function novoItem(){
  const [tipo, id] = UI.sel.split(':');
  const wsList = D.ws.filter(w => { const a = byId('apps', w.app); if (tipo === 'ws') return w.id === id; if (tipo === 'app') return w.app === id; if (tipo === 'product') return a.product === id; if (tipo === 'project') return a.project === id; return true; });
  modal('Novo item', '<div class="grade-form"><label class="lb largo">Título<input class="campo" id="ni-t"></label><label class="lb">Tipo' + I('Tipo do item: Epic é uma grande entrega, Story é uma funcionalidade que o usuário vê, Task é uma tarefa, Sub-task é um pedaço dela e Bug é um defeito') + '<select class="sel" id="ni-tipo">' + TIPOS.map(t => '<option value="' + t.id + '"' + (t.id === 'task' ? ' selected' : '') + '>' + t.nome + ' · ' + t.expl + '</option>').join('') + '</select></label><label class="lb">Onde' + I('Onde: a frente de trabalho em que o item fica, como Frontend ou Backend. Decide em qual parte da estrutura ele aparece') + '<select class="sel" id="ni-ws">' + wsList.map(w => '<option value="' + w.id + '">' + esc(byId('apps', w.app).nome + ' › ' + w.nome) + '</option>').join('') + '</select></label><label class="lb">Prioridade' + I('Priority (prioridade)') + '<select class="sel" id="ni-p">' + PRIOS.map(p => '<option value="' + p.id + '"' + (p.id === 'medium' ? ' selected' : '') + '>' + p.nome + ' · ' + p.expl + '</option>').join('') + '</select></label><label class="lb">Responsável<select class="sel" id="ni-r"><option value="">Sem responsável</option>' + D.people.filter(p => p.acesso !== 'stakeholder').map(p => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('') + '</select></label><label class="lb">Início<input class="campo" type="date" id="ni-i" value="' + iso(HOJE) + '"></label><label class="lb">Prazo<input class="campo" type="date" id="ni-f" value="' + iso(dAdd(HOJE, 7)) + '"></label><label class="lb">Estimativa em horas' + I('Estimate (estimativa de esforço, em horas)') + '<input class="campo" type="number" min="0" id="ni-e" value="4"></label><label class="lb largo">Descrição<textarea class="campo" id="ni-d" rows="3"></textarea></label></div>' +
    '<div class="bloco-g"><h4>References' + I('References (referências: imagens, arquivos, áudios, vídeos e links que ajudam a entender o item)') + '</h4><label class="solta"><input type="file" multiple id="ni-refs" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"><span class="solta-ico">' + ICO.clip + '</span><span><b>Adicionar referências</b><small id="ni-refs-n">Imagens, arquivos, áudios e vídeos. Pode escolher vários.</small></span></label><label class="lb">Link de referência<input class="campo" id="ni-link" placeholder="https://"></label></div>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Criar item', acao:d => { const t = $('#ni-t', d).value.trim(); if (!t){ toast('Escreva o título'); return false; } const dados = {titulo:t, tipo:$('#ni-tipo', d).value, ws:$('#ni-ws', d).value, prio:$('#ni-p', d).value, resp:$('#ni-r', d).value || null, ini:$('#ni-i', d).value, fim:$('#ni-f', d).value, alvo:$('#ni-f', d).value, est:+$('#ni-e', d).value || 0, desc:$('#ni-d', d).value}; const lk = $('#ni-link', d).value.trim(); Promise.all(Array.from($('#ni-refs', d).files || []).map(lerArquivo)).then(refs => { if (lk) refs.push({nome:lk, tipo:'link', url:lk}); dados.refs = refs; const ni = novoIssue(dados); D.issues.push(ni); registrar('criou', ni); salvar(); rView(); toast(refs.length ? 'Item criado com ' + refs.length + (refs.length === 1 ? ' referência' : ' referências') : 'Item criado'); }); }}]);
}
function criarDentro(chave){
  const [tipo, id] = chave.split(':');
  const opts = tipo === 'client' ? [['project','Novo projeto']] : tipo === 'project' ? [['product','Novo produto'],['app','Nova aplicação direto no projeto']] : tipo === 'product' ? [['app','Nova aplicação']] : [['ws','Nova frente de trabalho']];
  modal('Criar dentro de ' + esc(nomeDe(chave)), '<div class="grade-form"><label class="lb">O que criar<select class="sel" id="cd-o">' + opts.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select></label><label class="lb">Nome<input class="campo" id="cd-n"></label><label class="lb">Plataforma, se for aplicação<select class="sel" id="cd-p"><option value="desktop">Desktop</option><option value="web">Web</option><option value="mobile">Celular</option></select></label></div>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Criar', acao:d => {
      const o = $('#cd-o', d).value, n = $('#cd-n', d).value.trim(); if (!n){ toast('Escreva o nome'); return false; }
      let nova;
      if (o === 'project'){ nova = {id:uid('pj'), client:id, nome:n, status:'active', motivo:'', origem:'greenfield', inicio:iso(HOJE), alvo:iso(dAdd(HOJE, 90))}; D.projects.push(nova); nova = 'project:' + nova.id; }
      else if (o === 'product'){ const pr = {id:uid('pr'), project:id, client:byId('projects', id).client, nome:n, status:'active'}; D.products.push(pr); nova = 'product:' + pr.id; }
      else if (o === 'app'){ const proj = tipo === 'project' ? id : byId('products', id).project; const ap = {id:uid('ap'), project:proj, product: tipo === 'product' ? id : null, nome:n, plataforma:$('#cd-p', d).value, status:'active'}; D.apps.push(ap); ['Frontend','Backend','Database'].forEach(wn => D.ws.push({id:uid('ws'), app:ap.id, nome:wn, status:'active', wip:3})); nova = 'app:' + ap.id; }
      else { const w = {id:uid('ws'), app:id, nome:n, status:'active', wip:3}; D.ws.push(w); nova = 'ws:' + w.id; }
      UI.abertos[chave] = true; UI.sel = nova; salvar(); salvarUI(); rOperacoes(); toast('Criado: ' + n);
    }}]);
}
function novoProjeto(){
  modal('Novo projeto', '<div class="grade-form"><label class="lb">Cliente<select class="sel" id="np-c">' + D.clients.map(c => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('') + '</select></label><label class="lb">Nome do projeto<input class="campo" id="np-n"></label><label class="lb">Origem' + I('Origem do projeto: Greenfield é um sistema novo, feito do zero. Brownfield é um sistema que já existe e chega para continuar') + '<select class="sel" id="np-o"><option value="greenfield">Greenfield · do zero</option><option value="brownfield">Brownfield · já em andamento</option></select></label></div>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Criar projeto', acao:d => { const n = $('#np-n', d).value.trim(); if (!n){ toast('Escreva o nome'); return false; } const p = {id:uid('pj'), client:$('#np-c', d).value, nome:n, status:'active', motivo:'', origem:$('#np-o', d).value, inicio:iso(HOJE), alvo:iso(dAdd(HOJE, 90))}; D.projects.push(p); UI.abertos['client:' + p.client] = true; UI.sel = 'project:' + p.id; UI.view = 'stages'; salvar(); salvarUI(); rOperacoes(); toast('Projeto criado. Ele já nasce com as etapas obrigatórias.'); }}]);
}
function moverApp(id){
  const a = byId('apps', id);
  modal('Mover ' + esc(a.nome), '<div class="grade-form"><label class="lb largo">Para onde<select class="sel" id="mv">' + D.projects.map(p => '<option value="' + p.id + '|"' + (a.project === p.id && !a.product ? ' selected' : '') + '>' + esc(p.nome) + ' (direto no projeto)</option>' + D.products.filter(pr => pr.project === p.id).map(pr => '<option value="' + p.id + '|' + pr.id + '"' + (a.product === pr.id ? ' selected' : '') + '>' + esc(p.nome + ' › ' + pr.nome) + '</option>').join('')).join('') + '</select></label></div><p class="sec" style="margin:0;font-size:13px">As tarefas, a ficha, o tempo e as provas vão junto. As etiquetas automáticas mudam sozinhas.</p>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Mover', acao:d => { const [p, pr] = $('#mv', d).value.split('|'); a.project = p; a.product = pr || null; abrirArvore('app:' + a.id); salvar(); rOperacoes(); toast(a.nome + ' movido'); }}]);
}
function porTag(tipo, id){
  const tem = D.tagLinks.filter(l => l.tipo === tipo && l.id === id).map(l => l.tag);
  const livres = D.tags.filter(t => !tem.includes(t.id));
  modal('Pôr tag', (livres.length ? '<div class="tags">' + livres.map(t => '<label class="tag" style="--c:' + esc(t.cor) + ';cursor:pointer"><input type="checkbox" data-pt="' + t.id + '"><i class="cor"></i>' + esc(t.nome) + '</label>').join('') + '</div>' : '<p style="margin:0">Todas as tags já estão aqui.</p>') + '<label class="lb">Ou criar uma nova<input class="campo" id="pt-nova" placeholder="Nome da tag nova"></label>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Aplicar', acao:d => { $$('[data-pt]', d).forEach(x => { if (x.checked) D.tagLinks.push({tag:x.dataset.pt, tipo, id}); }); const n = $('#pt-nova', d).value.trim(); if (n){ const t = {id:uid('tg'), nome:n, cor:'#2E2E31', cat:'Geral', desc:''}; D.tags.push(t); D.tagLinks.push({tag:t.id, tipo, id}); } salvar(); render(); }}]);
}
function salvarTag(dlg, t){
  const nome = $('#ft-nome', dlg).value.trim(); if (!nome){ toast('Escreva o nome da tag'); return false; }
  const nova = !t; t = t || {id:uid('tg')};
  t.nome = nome; t.cat = $('#ft-cat', dlg).value.trim() || 'Geral'; t.cor = $('#ft-cor', dlg).value; t.desc = $('#ft-desc', dlg).value;
  if (nova) D.tags.push(t); salvar(); render(); toast(nova ? 'Tag criada' : 'Tag salva');
}
function salvarPessoa(dlg, p){
  const nome = $('#fpe-nome', dlg).value.trim(); if (!nome){ toast('Escreva o nome'); return false; }
  const nova = !p; p = p || {id:uid('pe')};
  p.nome = nome; p.funcao = $('#fpe-func', dlg).value; p.acesso = (dlg.querySelector('input[name=fpe-ac]:checked') || {value:'dev'}).value; p.cap = +$('#fpe-cap', dlg).value || 0; p.skills = $('#fpe-sk', dlg).value.split(',').map(s => s.trim()).filter(Boolean);
  if (nova) D.people.push(p); salvar(); render(); toast(nova ? 'Pessoa criada' : 'Pessoa salva');
}
function reservarBloco(dia, hora){
  const l = listaFiltrada().filter(i => i.status !== 'done');
  modal('Reservar horário · ' + fmt(dia) + ' às ' + String(hora).padStart(2,'0') + ':00', '<div class="grade-form"><label class="lb largo">Item<select class="sel" id="rb-i">' + l.map(i => '<option value="' + i.id + '">' + esc(i.titulo) + '</option>').join('') + '</select></label><label class="lb">Duração<select class="sel" id="rb-d"><option value="1">1 hora</option><option value="2" selected>2 horas</option><option value="3">3 horas</option><option value="4">4 horas</option></select></label></div>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Reservar', acao:d => { const i = byId('issues', $('#rb-i', d).value); if (!i) return; const du = +$('#rb-d', d).value; i.bloco = {data:dia, ini:String(hora).padStart(2,'0') + ':00', fim:String(Math.min(23, hora + du)).padStart(2,'0') + ':00'}; salvar(); rView(); toast('Horário reservado'); }}]);
}
function itemEtapa(id){ const it = D.template.flatMap(et => et.itens).find(z => z.id === id); const st = D.stages[UI.sel]; return Object.assign({}, it, (st['cfg_' + id] || {})); }
function cumprirItem(id){
  const cfg = itemEtapa(id);
  const campoProva = cfg.prova === 'Captura de tela' ? '<label class="lb">Captura de tela<input class="campo" type="file" accept="image/*" id="cp-arq" style="padding:6px"></label>' : cfg.prova === 'Arquivo' ? '<label class="lb">Arquivo<input class="campo" type="file" id="cp-arq" style="padding:6px"></label>' : cfg.prova === 'Link' ? '<label class="lb">Link<input class="campo" id="cp-txt" placeholder="https://"></label>' : cfg.prova === 'Texto' ? '<label class="lb">Descreva o que foi feito<textarea class="campo" id="cp-txt"></textarea></label>' : cfg.prova === 'Aprovação de alguém' ? '<label class="lb">Quem aprovou<select class="sel" id="cp-txt">' + D.people.map(p => '<option>' + esc(p.nome) + '</option>').join('') + '</select></label>' : '<p style="margin:0" class="sec">Este item não pede prova.</p>';
  modal('Cumprir item', '<p style="margin:0"><b>' + esc(cfg.texto) + '</b></p><p class="sec" style="margin:0;font-size:13px">Prova pedida: ' + esc(cfg.prova) + ' · Modo: ' + esc(cfg.modo) + '</p>' + campoProva,
    [{txt:'Cancelar', cls:'sec'},{txt:'Marcar como cumprido', acao:d => {
      const arq = $('#cp-arq', d), txt = $('#cp-txt', d);
      const fim = prova => { D.stages[UI.sel][id] = {feito:true, quem:idEu(UI.verComo), quando:iso(HOJE), prova}; salvar(); rView(); toast('Item cumprido e registrado'); };
      if (arq){ if (!arq.files[0]){ toast('Anexe a prova pedida'); return false; } lerArquivo(arq.files[0]).then(a => fim({tipo:cfg.prova, nome:a.nome, url:a.url})); return; }
      if (txt){ if (!txt.value.trim()){ toast('Preencha a prova pedida'); return false; } fim({tipo:cfg.prova, valor:txt.value.trim()}); return; }
      fim(null);
    }}]);
}
function dispensarItem(id){
  const cfg = itemEtapa(id);
  modal('Waiver', '<p style="margin:0"><b>' + esc(cfg.texto) + '</b></p><label class="lb">Por que não se aplica<textarea class="campo" id="wv-t"></textarea></label>', [{txt:'Cancelar', cls:'sec'},{txt:'Registrar dispensa', acao:d => { const m = $('#wv-t', d).value.trim(); if (!m){ toast('Escreva o motivo'); return false; } D.stages[UI.sel][id] = {dispensa:m, quem:idEu(UI.verComo), quando:iso(HOJE)}; salvar(); rView(); toast('Dispensa registrada com o motivo'); }}]);
}
function novoPedido(){
  modal('Novo pedido', formPedido(), [{txt:'Cancelar', cls:'sec'},{txt:'Enviar', acao:d => {
    const tit = $('#fp-tit', d).value.trim(); if (!tit){ toast('Escreva o assunto'); return false; }
    const app = byId('apps', $('#fp-app', d).value); const prod = prodDe(app);
    const files = Array.from($('#fp-arq', d).files || []);
    Promise.all(files.map(lerArquivo)).then(anexos => {
      const lk = ($('#fp-link', d).value || '').trim(); if (lk) anexos.push({nome:lk, tipo:'link', url:lk});
      const tipo = (d.querySelector('input[name=fp-tipo]:checked') || {value:'Question'}).value;
      const r = {id:uid('rq'), cliente: prod ? prod.client : cliPadrao(), app:app.id, tipo, grav:'Incômodo', status:'Em triagem', titulo:tit, quando:iso(HOJE), autor: idEu(UI.verComo), anexos, contexto:'Tela: ' + app.nome + ' · Enviado pelo ' + (/Mobi/.test(navigator.userAgent) ? 'celular' : 'computador'), issue:null,
        msgs:[{de:'cliente', txt:$('#fp-desc', d).value.trim() || tit},{de:'ia', txt: tipo === 'Question' ? 'Recebi sua dúvida. Vou procurar a resposta no manual de ' + app.nome + ' e já te explico.' : 'Recebi. Para eu entender direito: isso acontece sempre ou só às vezes? Se puder, mande um print da tela.'}]};
      D.requests.push(r); UI.pedSel = r.id; UI.filtroPed = 'todos'; salvar(); salvarUI(); if (UI.modulo !== 'servicedesk') abrirModulo('servicedesk'); else rServiceDesk(); toast('Pedido enviado');
    });
  }}]);
}
function virarIssue(id){
  const r = byId('requests', id); const wss = D.ws.filter(w => w.app === r.app);
  modal('Converter em Issue', '<div class="grade-form"><label class="lb largo">Título<input class="campo" id="vi-t" value="' + esc(r.titulo) + '"></label><label class="lb">Frente<select class="sel" id="vi-w">' + wss.map(w => '<option value="' + w.id + '">' + esc(w.nome) + '</option>').join('') + '</select></label><label class="lb">Tipo<select class="sel" id="vi-tp"><option value="bug"' + (r.tipo.startsWith('Bug') || r.tipo.startsWith('Fix') ? ' selected' : '') + '>Bug</option><option value="story"' + (r.tipo.startsWith('Feature') || r.tipo.startsWith('Change') ? ' selected' : '') + '>Story</option><option value="task">Task</option></select></label></div>',
    [{txt:'Cancelar', cls:'sec'},{txt:'Criar item', acao:d => { const i = novoIssue({titulo:$('#vi-t', d).value, ws:$('#vi-w', d).value, tipo:$('#vi-tp', d).value, prio: r.grav === 'Sistema parado' ? 'highest' : r.grav === 'Função quebrada' ? 'high' : 'medium', vis:'cliente', desc:'Veio do pedido do Service Desk: ' + r.titulo}); D.issues.push(i); registrar('criou', i); r.issue = i.id; r.status = 'Em andamento'; salvar(); rServiceDesk(); toast('Item criado no board e ligado ao pedido'); }}]);
}


/* ---- largura da estrutura: padrão fixo, arrastável; o resto nunca encolhe, é empurrado ---- */
const ARV_PADRAO = 220;
function ajustarMain(){
  const ops = $('.ops'), pr = $('.principal'); if (!ops || !pr) return;
  const larg = pr.clientWidth - (UI.semArvore ? 48 : ARV_PADRAO);
  ops.style.setProperty('--main-min', Math.max(320, larg) + 'px');
}
window.addEventListener('resize', ajustarMain);
document.getElementById('menu').addEventListener('transitionend', e => { if (e.target.id === 'menu') ajustarMain(); });
new MutationObserver(ajustarMain).observe(document.getElementById('app'), {attributes:true, attributeFilter:['class']});
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.arv-puxador'); if (!h) return;
  e.preventDefault();
  const ops = $('.ops'); const x0 = e.clientX; const w0 = UI.arvW || ARV_PADRAO;
  document.body.classList.add('puxando');
  const mover = ev => { UI.arvW = Math.max(180, Math.min(640, w0 + ev.clientX - x0)); ops.style.setProperty('--arv', UI.arvW + 'px'); };
  const soltar = () => { document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', soltar); document.body.classList.remove('puxando'); salvarUI(); };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', soltar);
});
let ultimoDireito = 0;
function restaurarArvore(){ UI.arvW = ARV_PADRAO; salvarUI(); const ops = $('.ops'); if (ops) ops.style.setProperty('--arv', ARV_PADRAO + 'px'); ajustarMain(); toast('Estrutura de volta à largura padrão'); }
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('.arv-puxador, .ops-arvore')) return;
  e.preventDefault();
  const agora = Date.now();
  if (agora - ultimoDireito < 500){ ultimoDireito = 0; restaurarArvore(); } else ultimoDireito = agora;
});
document.addEventListener('dblclick', e => { if (e.target.closest('.arv-puxador')){ UI.arvW = ARV_PADRAO; salvarUI(); const ops = $('.ops'); if (ops) ops.style.setProperty('--arv', ARV_PADRAO + 'px'); } });
document.addEventListener('keydown', e => { const h = e.target.closest && e.target.closest('.arv-puxador'); if (!h || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return; e.preventDefault(); UI.arvW = Math.max(180, Math.min(640, (UI.arvW || ARV_PADRAO) + (e.key === 'ArrowRight' ? 20 : -20))); $('.ops').style.setProperty('--arv', UI.arvW + 'px'); salvarUI(); });

/* ================= início ================= */
aplicarVerComo();
abrirModulo(UI.modulo);
})();
