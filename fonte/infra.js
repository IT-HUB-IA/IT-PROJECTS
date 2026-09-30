/* ===== Aba Infraestrutura (projeto = macro; produto e aplicação = micro, cada um com o código dele) =====
   Desenhos do sistema como código. Cada sub-aba tem:
   - o canvas de estruturação (fonte/canvas_infra.html) rodando dentro da aba, com todas as funções dele
     (zoom, minimapa, botão direito, atalhos, busca, grupos, quadros dentro de quadros, desfazer...), gravando no banco
     (infra_canvas, um conjunto de documentos por projeto ou produto e sub-aba);
   - a lista dos desenhos (infra_diagramas): o texto é a fonte de verdade (.dsl, .puml, .dbml, .mmd, .dot, .md), a imagem
     é gerada pelo conversor (a função diagramas chama o conversor da VPS) e cada mudança do texto guarda a versão anterior;
   - no projeto, também os desenhos de cada produto dele, para abrir o detalhe ou pôr no quadro do projeto;
   - o pedido ao DevIT para gerar ou atualizar os desenhos a partir das fontes reais (banco, itens, ficha, repositório).
   Parte 29 do banco. A função diagramas só precisa das chaves (conversor, DevIT, GitHub, Figma) para funcionar. */
const IFR_ABAS = [
  {id:'solucao', nome:'Arquitetura de Solução', formato:'structurizr', ferramenta:'Structurizr DSL', pasta:'architecture', entrada:'Pessoas, sistemas, containers, serviços, bancos, APIs e integrações (visão C4).'},
  {id:'software', nome:'Arquitetura de Software', formato:'plantuml', ferramenta:'PlantUML', pasta:'code', entrada:'Módulos, componentes, serviços e dependências do código.'},
  {id:'dominio', nome:'Modelo de Domínio', formato:'plantuml', ferramenta:'PlantUML (classes)', pasta:'code', entrada:'Entidades do negócio, atributos e como se relacionam.'},
  {id:'der', nome:'DER / Banco de Dados', formato:'dbml', ferramenta:'DBML / dbdiagram', pasta:'database', entrada:'Tabelas, colunas, tipos, chaves, relações e índices, a partir do schema e das migrations.'},
  {id:'processos', nome:'Fluxos de Processo', formato:'mermaid', ferramenta:'Mermaid', pasta:'processes', entrada:'Regras de negócio e os passos de cada processo.'},
  {id:'sequencias', nome:'Diagramas de Sequência', formato:'plantuml', ferramenta:'PlantUML', pasta:'sequences', entrada:'Quem chama quem e em que ordem: usuário, tela, servidor, banco e APIs.'},
  {id:'infra', nome:'Arquitetura de Infraestrutura', formato:'graphviz', ferramenta:'Terraform graph / Graphviz', pasta:'infrastructure', entrada:'Nuvem, servidores, containers, banco, storage, filas e dependências (Terraform, Docker, Supabase).'},
  {id:'seguranca', nome:'Arquitetura de Segurança', formato:'structurizr', ferramenta:'Structurizr DSL', pasta:'security', entrada:'Login, papéis, permissões, RLS, dados sensíveis e fronteiras de confiança.'},
  {id:'ux', nome:'Fluxos de Usuário', formato:'mermaid', ferramenta:'Mermaid', pasta:'ux', entrada:'Telas, rotas, jornadas, permissões e casos de uso.'},
  {id:'prototipos', nome:'Protótipos de Interface', formato:'markdown', ferramenta:'Figma', pasta:'ux', entrada:'Especificação das telas (componentes, ações, estados de erro e vazio) e os links do Figma.'}
];
const IFR_FORMATOS = [
  ['structurizr', 'Structurizr DSL', 'dsl'], ['plantuml', 'PlantUML', 'puml'], ['c4plantuml', 'C4 PlantUML', 'puml'],
  ['dbml', 'DBML', 'dbml'], ['mermaid', 'Mermaid', 'mmd'], ['graphviz', 'Graphviz (DOT)', 'dot'], ['markdown', 'Especificação (Markdown)', 'md']
];
const ifrFmt = f => IFR_FORMATOS.find(x => x[0] === f) || IFR_FORMATOS[0];
// um começo pronto para cada formato, para ninguém começar da folha em branco
const IFR_MODELO = {
  structurizr:'workspace "Sistema" {\n  model {\n    usuario = person "Usuário"\n    sistema = softwareSystem "Sistema" {\n      web = container "Aplicação web"\n      banco = container "Banco de dados" "Postgres"\n    }\n    usuario -> web "Usa"\n    web -> banco "Lê e grava"\n  }\n  views {\n    container sistema {\n      include *\n      autolayout lr\n    }\n  }\n}\n',
  plantuml:'@startuml\nactor Usuario\nparticipant "Tela" as Tela\nparticipant "Servidor" as API\ndatabase "Banco" as DB\nUsuario -> Tela: abre\nTela -> API: pede os dados\nAPI -> DB: consulta\nDB --> API: linhas\nAPI --> Tela: resposta\n@enduml\n',
  c4plantuml:'@startuml\n!include <C4/C4_Container>\nPerson(usuario, "Usuário")\nSystem_Boundary(s, "Sistema") {\n  Container(web, "Aplicação web", "React")\n  ContainerDb(db, "Banco", "Postgres")\n}\nRel(usuario, web, "Usa")\nRel(web, db, "Lê e grava")\n@enduml\n',
  dbml:'Table pessoas {\n  id uuid [pk]\n  nome text [not null]\n}\n\nTable itens {\n  id uuid [pk]\n  titulo text [not null]\n  responsavel_id uuid [ref: > pessoas.id]\n}\n',
  mermaid:'flowchart LR\n  A[Começo] --> B{Está certo?}\n  B -- Sim --> C[Segue]\n  B -- Não --> D[Corrige]\n  D --> B\n',
  graphviz:'digraph infraestrutura {\n  rankdir=LR;\n  node [shape=box, style=rounded];\n  usuario -> vercel [label="HTTPS"];\n  vercel -> supabase [label="API"];\n  supabase -> storage;\n}\n',
  markdown:'# Tela: nome da tela\n\n- Rota: /exemplo\n- Quem vê: \n- Componentes: \n- Ações: \n- Estado vazio: \n- Estado de erro: \n- Figma: \n'
};
const IFR = {chave:null, aba:'solucao', no:null, docs:{}, conhecidos:{}, diagramas:[], carregando:false, erro:'', config:null, gerando:false, ultimaLeitura:0};
const ifrBanco = () => (COM_BANCO && window.ciclodevBanco && BANCO.carregado) ? window.ciclodevBanco : null;
const ifrAba = id => IFR_ABAS.find(a => a.id === id) || IFR_ABAS[0];
const ifrPodeTer = sel => /^(project|product|app):/.test(sel || '');
const ifrNoDe = sel => (sel || '').split(':')[1] || null;
// os produtos de um projeto (o macro mostra também os desenhos deles)
const ifrProdutos = sel => sel && sel.startsWith('project:') ? D.products.filter(p => p.project === ifrNoDe(sel)) : [];
const ifrNomeNo = id => { const p = byId('projects', id) || byId('products', id); return p ? p.nome : 'sem nome'; };
const ifrNs = () => IFR.no + '|' + IFR.aba;

VIEWS.push(['infra', 'Infraestrutura', 'desenhos do sistema como código']);
SM_ABAS.infra = ['Infraestrutura', 'Os desenhos do sistema: arquitetura, banco, processos, sequências, infraestrutura, segurança e telas. Cada desenho é um texto (a fonte de verdade) que vira imagem, e o DevIT gera e atualiza a partir das fontes reais.'];
SM_DICA.infra = 'desenhos do sistema como código';
EXPL_VIEW.infra = SM_ABAS.infra[1];
// a Infraestrutura é uma das abas fixas (SM_FIXAS, simples.js): fica sempre na barra onde existe

/* ---------- leitura e gravação (banco; sem banco, fica nos dados locais) ---------- */
function ifrLocal(){ D.infraLocal = D.infraLocal || {canvas:{}, diagramas:[]}; return D.infraLocal; }
async function ifrCarregar(forcar){
  const sb = ifrBanco(), nos = [IFR.no].concat(ifrProdutos(UI.sel).map(p => p.id));
  IFR.carregando = true; IFR.erro = '';
  try {
    if (sb){
      const [dg, cv] = await Promise.all([
        sb.from('infra_diagramas').select('*').in('no_id', nos),
        sb.from('infra_canvas').select('caminho, dados, aba, no_id').eq('no_id', IFR.no).eq('aba', IFR.aba)
      ]);
      if (dg.error) throw dg.error;
      if (cv.error) throw cv.error;
      IFR.diagramas = (dg.data || []).filter(d => nos.includes(d.no_id) && !d.arquivado_em);
      IFR.docs = {}; (cv.data || []).filter(r => r.no_id === IFR.no && r.aba === IFR.aba).forEach(r => { IFR.docs[r.caminho] = r.dados; });
    } else {
      const L = ifrLocal();
      IFR.diagramas = L.diagramas.filter(d => nos.includes(d.no_id) && !d.arquivado_em);
      IFR.docs = {}; Object.entries(L.canvas).forEach(([k, v]) => { const [n, a, ...c] = k.split('|'); if (n === IFR.no && a === IFR.aba) IFR.docs[c.join('|')] = v; });
    }
    IFR.conhecidos = JSON.parse(JSON.stringify(IFR.docs));
    IFR.ultimaLeitura = Date.now();
  } catch(e){ IFR.erro = e.message || String(e); }
  IFR.carregando = false;
}
async function ifrGravarDoc(caminho, dados){
  const sb = ifrBanco();
  IFR.docs[caminho] = dados; IFR.conhecidos[caminho] = JSON.parse(JSON.stringify(dados));
  if (!sb){ ifrLocal().canvas[IFR.no + '|' + IFR.aba + '|' + caminho] = dados; salvar(); return null; }
  const {data, error} = await sb.from('infra_canvas').upsert({no_id:IFR.no, aba:IFR.aba, caminho, dados}, {onConflict:'no_id,aba,caminho'}).select('caminho');
  if (error) return /permission|policy|row-level/i.test(error.message || '') ? {code:'not_granted', message:error.message} : {code:'erro', message:error.message};
  if (!data || !data.length) return {code:'not_granted', message:'Sem permissão para gravar'};
  return null;
}
async function ifrApagarDoc(caminho){
  const sb = ifrBanco();
  delete IFR.docs[caminho]; delete IFR.conhecidos[caminho];
  if (!sb){ delete ifrLocal().canvas[IFR.no + '|' + IFR.aba + '|' + caminho]; salvar(); return null; }
  const {error} = await sb.from('infra_canvas').delete().match({no_id:IFR.no, aba:IFR.aba, caminho});
  return error ? {code:'erro', message:error.message} : null;
}
async function ifrSalvarDiagrama(d, campos){
  const sb = ifrBanco();
  if (!sb){
    const L = ifrLocal();
    if (!d.id){ const n = Object.assign({id:novoUuid(), versao:1, origem:'manual', evidencias:[], lacunas:[], links:[], criado_em:new Date().toISOString()}, d, campos); L.diagramas.push(n); salvar(); return n; }
    const x = L.diagramas.find(y => y.id === d.id); if (!x) return null;
    if (campos.fonte !== undefined && campos.fonte !== x.fonte){ (x._versoes = x._versoes || []).push({versao:x.versao, fonte:x.fonte, svg:x.svg, origem:x.origem, criado_em:new Date().toISOString()}); x.versao++; x.svg = null; }
    Object.assign(x, campos); salvar(); return x;
  }
  if (!d.id){
    const {data, error} = await sb.from('infra_diagramas').insert(Object.assign({no_id:d.no_id, aba:d.aba, nome:d.nome, formato:d.formato, fonte:d.fonte || ''}, campos)).select('*');
    if (error) throw error;
    return (data || [])[0] || null;
  }
  const {data, error} = await sb.from('infra_diagramas').update(campos).eq('id', d.id).select('*');
  if (error) throw error;
  if (!data || !data.length) throw new Error('Sem permissão para mudar este desenho');
  return data[0];
}
async function ifrFuncao(corpo){
  const sb = ifrBanco();
  if (!sb || !sb.functions) return {erro:'A função diagramas só funciona com o banco ligado'};
  try {
    const {data, error} = await sb.functions.invoke('diagramas', {body:corpo});
    if (error){
      let msg = error.message || String(error);
      try { const j = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; if (j && j.erro) msg = j.erro; } catch(e){}
      return {erro:msg};
    }
    return data || {};
  } catch(e){ return {erro:e.message || String(e)}; }
}
async function ifrConfig(){
  if (IFR.config) return IFR.config;
  const r = await ifrFuncao({acao:'config'});
  IFR.config = r.erro ? {erro:r.erro} : r;
  return IFR.config;
}

/* ---------- a tela ---------- */
const _rViewIfr = rView;
rView = function(){
  const c = $('#ops-corpo');
  if (c && UI.view === 'infra'){
    if (!ifrPodeTer(UI.sel)){ UI.view = 'dashboard'; return _rViewIfr.apply(this, arguments); }
    const aba = UI.infraAba && IFR_ABAS.some(a => a.id === UI.infraAba) ? UI.infraAba : 'solucao';
    const chave = UI.sel + '|' + aba, tela = c.querySelector('.ifr-tela');
    // o canvas não é montado de novo à toa (recarregaria): só quando muda o projeto, o produto ou a sub-aba
    if (tela && tela.dataset.chave === chave){ ifrLado(); smAgruparAbas(); return; }
    IFR.chave = UI.sel; IFR.aba = aba; IFR.no = ifrNoDe(UI.sel);
    c.innerHTML = ifrTelaHTML();
    smAgruparAbas();
    ifrCarregar().then(() => { if (UI.view === 'infra' && IFR.chave === UI.sel && IFR.aba === aba){ ifrMontarCanvas(); ifrLado(); } });
    ifrConfig().then(() => { if (UI.view === 'infra') ifrLado(); });
    return;
  }
  return _rViewIfr.apply(this, arguments);
};
const _rOperacoesIfr = rOperacoes;
rOperacoes = function(){
  _rOperacoesIfr.apply(this, arguments);
  if (!ifrPodeTer(UI.sel)){ const b = $('.view-b[data-view="infra"]'); if (b) (b.closest('.view-casa') || b).remove(); if (UI.view === 'infra'){ UI.view = 'dashboard'; rView(); } }
};
function ifrTelaHTML(){
  const a = ifrAba(IFR.aba), macro = UI.sel.startsWith('project:');
  return '<div class="ifr-tela" data-chave="' + esc(UI.sel + '|' + IFR.aba) + '">' +
    '<nav class="ifr-abas" role="tablist" aria-label="Partes da Infraestrutura">' + IFR_ABAS.map((x, i) => '<button type="button" role="tab" class="ifr-aba" data-ifr-aba="' + x.id + '" aria-selected="' + (x.id === IFR.aba) + '"><span class="ifr-n">' + String(i + 1).padStart(2, '0') + '</span>' + esc(x.nome) + '</button>').join('') + '</nav>' +
    '<div class="ifr-cab"><button type="button" class="btn sec peq ifr-cheia-b" data-ifr-cheia title="Canvas em tela cheia (Esc volta)">Tela cheia</button><div><h2>' + esc(a.nome) + '</h2><p class="lead">' + esc(a.entrada) + ' Ferramenta: <b>' + esc(a.ferramenta) + '</b>.' + (macro ? ' Aqui é o <b>macro</b>: o desenho do projeto inteiro, com os desenhos de cada produto ao lado.' : ' Aqui é o <b>micro</b>: o desenho só deste produto.') + '</p></div></div>' +
    '<div class="ifr-corpo"><div class="ifr-canvas" data-ifr-canvas><p class="ifr-carregando">Abrindo o canvas…</p></div><aside class="ifr-lado" data-ifr-lado aria-label="Desenhos desta parte"></aside></div></div>';
}
function ifrMontarCanvas(){
  const casa = $('#ops-corpo [data-ifr-canvas]'); if (!casa) return;
  if (IFR.erro){ casa.innerHTML = '<p class="entrada-erro">Não deu para ler o banco: ' + esc(IFR.erro) + '</p>'; return; }
  const html = window.CANVAS_INFRA_HTML;
  if (!html){ casa.innerHTML = '<p class="entrada-erro">O canvas não veio junto com esta versão do sistema.</p>'; return; }
  const cfgUI = UI.infraCanvas || {};
  const init = {ns:ifrNs(), ro:!podeEditar(), docs:IFR.docs, diagramas:ifrMapaDiagramas(),
    ls:{'canvas-bl-cfg':cfgUI.cfg || undefined, 'canvas-bl-vistas':(cfgUI.vistas || {})[ifrNs()] || undefined}};
  const f = document.createElement('iframe');
  f.className = 'ifr-frame'; f.title = 'Canvas de ' + ifrAba(IFR.aba).nome;
  f.setAttribute('sandbox', 'allow-scripts allow-downloads');
  f.setAttribute('allow', 'fullscreen');
  f.srcdoc = ifrSrcdoc(html, init);
  casa.innerHTML = ''; casa.appendChild(f);
  casa.insertAdjacentHTML('beforeend', '<button type="button" class="ifr-sair-cheia" data-ifr-cheia hidden>Sair da tela cheia <kbd>Esc</kbd></button>');
}
// o canvas recebe os dados antes da ponte (window.__INFRA_INIT). Sozinha de propósito: vai também dentro do arquivo navegável.
function ifrSrcdoc(html, init){
  const ini = '<script>window.__INFRA_INIT = ' + JSON.stringify(init).replace(/</g, '\\u003c') + ';<\/script>\n';
  return html.replace('<script>\n/* Ponte com o CicloDev', ini + '<script>\n/* Ponte com o CicloDev');
}
const ifrFrame = () => $('#ops-corpo .ifr-frame');
const ifrEmCheia = c => !!c && (document.fullscreenElement === c || c.classList.contains('ifr-cheia'));
function ifrTelaCheia(on){
  const c = $('#ops-corpo .ifr-canvas'); if (!c) return;
  const ja = ifrEmCheia(c);
  if (on === undefined) on = !ja;
  if (on && !ja){
    const cai = () => { c.classList.add('ifr-cheia'); ifrCheiaMudou(); };
    if (c.requestFullscreen) c.requestFullscreen().then(ifrCheiaMudou, cai); else cai();
  } else if (!on && ja){
    if (document.fullscreenElement === c) document.exitFullscreen().catch(() => {});
    c.classList.remove('ifr-cheia'); ifrCheiaMudou();
  }
}
function ifrCheiaMudou(){
  const c = $('#ops-corpo .ifr-canvas'); if (!c) return;
  const on = ifrEmCheia(c);
  const b = $('#ops-corpo .ifr-cheia-b'); if (b) b.textContent = on ? 'Sair da tela cheia' : 'Tela cheia';
  const s = c.querySelector('.ifr-sair-cheia'); if (s) s.hidden = !on;
  ifrFalar({tipo:'tela-cheia', dados:{on}});
  if (!on){ const f = ifrFrame(); if (f) f.focus(); }
}
document.addEventListener('fullscreenchange', ifrCheiaMudou);
const ifrFalar = m => { const f = ifrFrame(); if (f && f.contentWindow) f.contentWindow.postMessage(Object.assign({__infra:true}, m), '*'); };
function ifrMapaDiagramas(){
  const m = {};
  IFR.diagramas.forEach(d => { m[d.id] = {nome:d.nome, formato:d.formato, versao:d.versao, origem:d.origem, svg:d.svg || null, erro:d.erro || null, renderizado_em:d.renderizado_em || null, fonte:d.formato === 'markdown' ? d.fonte : undefined}; });
  return m;
}
const ifrAvisarCanvas = () => ifrFalar({tipo:'diagramas', dados:ifrMapaDiagramas()});

const IFR_DE_ONDE = {github:'automático do código', gitlab:'automático do código', banco:'automático do banco', devit:'DevIT', manual:'feito à mão'};
// o desenho do DevIT ficou para trás quando o robô atualizou os automáticos depois dele
const ifrDesatualizado = d => d.origem === 'devit' && typeof IFR_AUTO !== 'undefined' && IFR_AUTO.pedidos.some(p => p.status === 'pronto' && p.concluido_em && d.atualizado_em && p.concluido_em > d.atualizado_em && (p.diagramas || []).length);
function ifrItemHTML(d, deOutro){
  const f = ifrFmt(d.formato);
  const st = d.quadro ? 'no quadro' : d.formato === 'markdown' ? 'especificação' : d.svg ? 'com imagem' : d.erro ? 'erro na imagem' : 'sem imagem';
  return '<li class="ifr-item' + (d.erro && !d.quadro ? ' com-erro' : '') + (d.chave_auto ? ' auto' : '') + '"><button type="button" class="ifr-item-abrir" data-ifr-abrir="' + esc(d.id) + '"><b>' + esc(d.nome) + '</b><small>' + esc(IFR_DE_ONDE[d.origem] || d.origem) + ' · ' + esc(f[1]) + ' · v' + esc(d.versao) + ' · ' + esc(st) + '</small>' +
    (ifrDesatualizado(d) ? '<small class="ifr-velho">O sistema mudou depois deste desenho: peça de novo ao DevIT.</small>' : '') + '</button>' +
    (d.quadro && !deOutro ? '<button type="button" class="btn peq" data-ifr-quadro="' + esc(d.quadro) + '" title="Abrir o quadro deste desenho no canvas">Abrir</button>' : '') +
    (podeEditar() && !d.quadro ? '<button type="button" class="btn sec peq" data-ifr-por="' + esc(d.id) + '" title="Pôr este desenho no quadro' + (deOutro ? ' do projeto' : '') + '">No quadro</button>' : '') + '</li>';
}
// serviços que os desenhos usam: um resumo recolhido ("3 de 5 ligados"); aberto, mostra o que falta e onde configurar
function ifrServicosHTML(cf){
  const l = [[cf.conversor, 'Conversor de imagens', 'variável RENDER_URL da função diagramas'], [cf.devit, 'DevIT (inteligência artificial)', 'variável ANTHROPIC_API_KEY'], [cf.github, 'GitHub', 'app do CicloDev, em Admin'], [cf.gitlab, 'GitLab', 'em Admin'], [cf.figma, 'Figma', 'variável FIGMA_TOKEN']];
  const n = l.filter(x => x[0]).length;
  return '<details class="ifr-serv"><summary><span>Serviços</span><span class="ifr-serv-n">' + n + ' de ' + l.length + ' ligados</span></summary><ul>' +
    l.map(([ok, nome, onde]) => '<li class="' + (ok ? 'ok' : 'falta') + '"><span>' + esc(nome) + '</span><small>' + (ok ? 'ligado' : 'falta configurar: ' + esc(onde)) + '</small></li>').join('') + '</ul></details>';
}
function ifrLado(){
  const el = $('#ops-corpo [data-ifr-lado]'); if (!el) return;
  const pode = podeEditar(), meus = IFR.diagramas.filter(d => d.no_id === IFR.no && d.aba === IFR.aba);
  const cf = IFR.config || {};
  const chave = (ok, nome) => '<li class="' + (ok ? 'ok' : 'falta') + '">' + (ok ? 'Pronto' : 'Falta a chave') + ': ' + esc(nome) + '</li>';
  let h = '<div class="ifr-lado-cab"><h3>Desenhos</h3>' + (pode ? '<div class="ifr-lado-acoes"><button type="button" class="btn peq" data-ifr-novo>' + ICO.mais + 'Novo desenho</button><button type="button" class="btn sec peq" data-ifr-gerar' + (IFR.gerando ? ' disabled' : '') + '>' + (IFR.gerando ? 'O DevIT está gerando…' : 'Gerar com o DevIT') + '</button></div>' : '') + '</div>';
  if (IFR.carregando) h += '<p class="vazio-linha">Lendo…</p>';
  h += meus.length ? '<ul class="ifr-lista">' + meus.map(d => ifrItemHTML(d, false)).join('') + '</ul>' : '<p class="ifr-vazio">Nenhum desenho aqui ainda.' + (pode ? ' Crie um ou peça ao DevIT para gerar a partir das fontes reais do sistema.' : '') + '</p>';
  const prods = ifrProdutos(UI.sel);
  if (prods.length){
    h += '<h4 class="ifr-sub">Dos produtos deste projeto</h4>';
    h += prods.map(p => { const l = IFR.diagramas.filter(d => d.no_id === p.id && d.aba === IFR.aba);
      return '<div class="ifr-prod"><div class="ifr-prod-cab"><b>' + esc(p.nome) + '</b><button type="button" class="ifr-lnk" data-ifr-ir="product:' + esc(p.id) + '">Abrir no produto</button></div>' + (l.length ? '<ul class="ifr-lista">' + l.map(d => ifrItemHTML(d, true)).join('') + '</ul>' : '<p class="ifr-vazio">Sem desenho nesta parte.</p>') + '</div>'; }).join('');
  }
  h += '<div class="ifr-rodape"><button type="button" class="btn sec peq" data-ifr-zip>Baixar tudo (docs/diagrams)</button>' +
    (cf.erro ? '<p class="ifr-cfg">' + esc(cf.erro) + '</p>' : IFR.config ? ifrServicosHTML(cf) : '') + '</div>';
  el.innerHTML = h;
}

/* ---------- editor de um desenho: código, imagem, evidências e versões ---------- */
async function ifrAbrir(id){
  const d = IFR.diagramas.find(x => x.id === id); if (!d) return;
  const podeNo = podeEditar() && (d.no_id === IFR.no || ifrProdutos(UI.sel).some(p => p.id === d.no_id));
  // o desenho automático é refeito sozinho: não se muda o texto dele (dá para copiar e editar a cópia)
  const auto = !!d.chave_auto, pode = podeNo && !auto;
  const img = d.svg ? '<div class="ifr-prev"><button type="button" class="btn sec peq ifr-prev-cheia" data-ifr-prev-cheia title="Ver a imagem em tela cheia (Esc volta)">Tela cheia</button><img src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg) + '" alt="' + esc(d.nome) + '"></div>' : '<p class="ifr-vazio">' + (d.formato === 'markdown' ? 'Especificação em texto: não vira imagem.' : d.erro ? 'Não deu para gerar a imagem: ' + esc(d.erro) : 'Ainda sem imagem. Salve o código e clique em Gerar imagem.') + '</p>';
  const ev = (d.evidencias || []).length ? '<ul class="ifr-ev">' + d.evidencias.map(e => '<li><b>' + esc(e.fonte || e.tipo || 'fonte') + '</b>' + (e.trecho ? '<small>' + esc(String(e.trecho).slice(0, 300)) + '</small>' : '') + '</li>').join('') + '</ul>' : '<p class="ifr-vazio">' + (d.origem === 'devit' ? 'O DevIT não listou evidências.' : 'Desenho feito à mão: sem evidências registradas.') + '</p>';
  const lac = (d.lacunas || []).length ? '<div class="ifr-lacunas"><b>' + (auto ? 'O que o robô não conseguiu desenhar' : 'O que o DevIT não achou nas fontes') + '</b><ul>' + d.lacunas.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '';
  const corpo = '<div class="ifr-ed">' +
    '<div class="ifr-ed-linha"><label class="lb">Nome<input class="campo" id="ifr-nome" value="' + esc(d.nome) + '"' + (pode ? '' : ' disabled') + '></label>' +
    '<label class="lb">Formato<select class="sel" id="ifr-formato"' + (pode ? '' : ' disabled') + '>' + IFR_FORMATOS.map(f => '<option value="' + f[0] + '"' + (f[0] === d.formato ? ' selected' : '') + '>' + esc(f[1]) + '</option>').join('') + '</select></label></div>' +
    '<p class="ifr-meta">' + esc(ifrNomeNo(d.no_id)) + ' · ' + esc(ifrAba(d.aba).nome) + ' · versão ' + esc(d.versao) + ' · ' + esc(IFR_DE_ONDE[d.origem] || d.origem) + (d.referencia && (d.origem === 'github' || d.origem === 'gitlab') ? ' (commit ' + esc(String(d.referencia).slice(0, 7)) + ')' : '') + (d.renderizado_em ? ' · imagem de ' + esc(new Date(d.renderizado_em).toLocaleString('pt-BR')) : '') + '</p>' +
    (auto ? '<p class="ifr-aviso-auto">Este desenho sai sozinho ' + (d.origem === 'banco' ? 'da estrutura do banco' : 'do código publicado em produção') + ' e é refeito a cada mudança. Para ajustar à mão, faça uma cópia.</p>' : '') +
    (d.quadro ? '<p class="ifr-meta"><button type="button" class="btn peq" data-ifr-quadro="' + esc(d.quadro) + '">Abrir o quadro deste desenho</button> O quadro é o desenho montado no canvas, com os cards e as ligações.</p>' : '') +
    '<label class="lb">Código do desenho (a fonte de verdade)<textarea class="campo ifr-codigo" id="ifr-fonte" spellcheck="false"' + (pode ? '' : ' readonly') + '>' + esc(d.fonte || '') + '</textarea></label>' +
    '<section class="ifr-sec"><h4>Imagem</h4>' + img + '</section>' +
    '<section class="ifr-sec"><h4>De onde veio</h4>' + ev + lac + '</section>' +
    '<section class="ifr-sec"><h4>Versões anteriores</h4><div data-ifr-versoes><p class="vazio-linha">Lendo…</p></div></section></div>';
  const bts = [{txt:'Fechar', cls:'sec'},
    {txt:'Baixar código', cls:'sec', acao:() => { ifrBaixarTexto(ifrArquivo(d), d.fonte || ''); return false; }}];
  if (d.svg) bts.push({txt:'Baixar imagem', cls:'sec', acao:dl => { ifrMenuImagem(dl, d); return false; }});
  if (podeNo && auto) bts.push({txt:'Copiar para editar à mão', cls:'sec', acao:() => { ifrCopiar(d); }});
  if (pode){
    bts.push({txt:'Arquivar', cls:'fant', acao:() => { ifrArquivar(d); }});
    if (d.formato !== 'markdown') bts.push({txt:'Salvar e gerar imagem', cls:'sec', acao:dl => { ifrSalvarEditor(dl, d, true); return false; }});
    bts.push({txt:'Salvar', acao:dl => { ifrSalvarEditor(dl, d, false); return false; }});
  }
  const dlg = modal(esc(d.nome), corpo, bts);
  dlg.classList.add('ifr-modal');
  const alvo = dlg.querySelector('[data-ifr-versoes]');
  const vs = await ifrVersoes(d);
  if (!alvo.isConnected) return;
  alvo.innerHTML = vs.length ? '<ul class="ifr-versoes">' + vs.map(v => '<li><span>v' + esc(v.versao) + ' · ' + esc(new Date(v.criado_em).toLocaleString('pt-BR')) + (v.origem === 'devit' ? ' · DevIT' : '') + '</span><button type="button" class="ifr-lnk" data-ifr-ver-versao="' + esc(v.versao) + '">Ver</button><button type="button" class="ifr-lnk" data-ifr-baixar-versao="' + esc(v.versao) + '">Baixar</button></li>').join('') + '</ul>' : '<p class="ifr-vazio">Ainda não mudou desde que foi criado.</p>';
  alvo.addEventListener('click', e => {
    const v = vs.find(x => String(x.versao) === (e.target.dataset.ifrVerVersao || e.target.dataset.ifrBaixarVersao)); if (!v) return;
    if (e.target.dataset.ifrBaixarVersao) ifrBaixarTexto(ifrSlug(d.nome) + '.v' + v.versao + '.' + ifrFmt(d.formato)[2], v.fonte);
    else modal(esc(d.nome) + ' · versão ' + esc(v.versao), '<pre class="ifr-pre">' + esc(v.fonte) + '</pre>', [{txt:'Fechar', cls:'sec'}]);
  });
}
// baixar a imagem de um desenho: SVG (vetorial), PNG ou PDF
function ifrMenuImagem(dl, d){
  const velho = dl.querySelector('.ifr-baixar-img'); if (velho){ velho.remove(); return; }
  const m = document.createElement('div'); m.className = 'ifr-baixar-img';
  m.innerHTML = '<span>Baixar a imagem em:</span><button type="button" class="btn sec peq" data-como="svg">SVG (vetorial)</button><button type="button" class="btn sec peq" data-como="png">PNG</button><button type="button" class="btn sec peq" data-como="pdf">PDF</button>';
  m.addEventListener('click', e => { const b = e.target.closest('[data-como]'); if (b) ifrBaixarImagem(d, b.dataset.como); });
  const ed = dl.querySelector('.ifr-ed'); if (ed) ed.prepend(m);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ifr-prev-cheia]'); if (!b) return;
  const p = b.closest('.ifr-prev'); if (!p) return;
  if (document.fullscreenElement === p) document.exitFullscreen().catch(() => {});
  else if (p.requestFullscreen) p.requestFullscreen().catch(() => toast('Este navegador não deixou abrir em tela cheia.'));
});
document.addEventListener('fullscreenchange', () => { document.querySelectorAll('[data-ifr-prev-cheia]').forEach(b => { b.textContent = b.closest('.ifr-prev') === document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia'; }); });
// a cópia de um desenho automático vira um desenho feito à mão (o original segue sendo refeito sozinho)
async function ifrCopiar(d){
  try {
    const n = await ifrSalvarDiagrama({no_id:d.no_id, aba:d.aba, nome:(d.nome + ' (cópia)').slice(0, 160), formato:d.formato, fonte:d.fonte || ''}, {evidencias:d.evidencias || [], lacunas:d.lacunas || []});
    ifrTrocar(n); ifrLado(); ifrAvisarCanvas(); ifrAbrir(n.id);
  } catch(e){ toast('Não deu para copiar: ' + (e.message || e)); }
}
async function ifrVersoes(d){
  const sb = ifrBanco();
  if (!sb) return (d._versoes || []).slice().reverse();
  const {data, error} = await sb.from('infra_diagramas_versoes').select('versao, fonte, origem, criado_em, diagrama_id').eq('diagrama_id', d.id);
  if (error) return [];
  return (data || []).filter(v => v.diagrama_id === d.id).sort((a, b) => b.versao - a.versao);
}
async function ifrSalvarEditor(dl, d, gerar){
  const nome = $('#ifr-nome', dl).value.trim(), formato = $('#ifr-formato', dl).value, fonte = $('#ifr-fonte', dl).value;
  if (!nome){ toast('Escreva o nome do desenho'); return; }
  const campos = {};
  if (nome !== d.nome) campos.nome = nome;
  if (formato !== d.formato) campos.formato = formato;
  if (fonte !== (d.fonte || '')){ campos.fonte = fonte; campos.origem = 'manual'; }
  try {
    let atual = d;
    if (Object.keys(campos).length){ atual = await ifrSalvarDiagrama(d, campos); ifrTrocar(atual); }
    if (gerar) await ifrRenderizar(atual.id);
    dl.close(); dl.remove();
    ifrLado(); ifrAvisarCanvas();
    toast(gerar ? 'Desenho salvo e imagem gerada.' : Object.keys(campos).length ? 'Desenho salvo.' : 'Nada mudou.');
    if (gerar) { const x = IFR.diagramas.find(y => y.id === atual.id); if (x && x.erro) toast('Salvo, mas a imagem não saiu: ' + x.erro); }
  } catch(e){ toast('Não deu para salvar: ' + (e.message || e)); }
}
function ifrTrocar(n){ if (!n) return; const i = IFR.diagramas.findIndex(x => x.id === n.id); if (i >= 0) IFR.diagramas[i] = n; else IFR.diagramas.push(n); }
async function ifrRenderizar(id){
  const d = IFR.diagramas.find(x => x.id === id); if (!d || d.formato === 'markdown') return;
  const r = await ifrFuncao({acao:'renderizar', id});
  if (r.erro){ d.erro = r.erro; toast('Não deu para gerar a imagem: ' + r.erro); }
  else if (r.diagrama) ifrTrocar(r.diagrama);
  ifrLado(); ifrAvisarCanvas();
}
async function ifrArquivar(d){
  try { await ifrSalvarDiagrama(d, {arquivado_em:new Date().toISOString()}); IFR.diagramas = IFR.diagramas.filter(x => x.id !== d.id); ifrLado(); ifrAvisarCanvas(); toast('Desenho arquivado. As versões continuam guardadas.'); }
  catch(e){ toast('Não deu para arquivar: ' + (e.message || e)); }
}
function ifrNovo(depois){
  const a = ifrAba(IFR.aba);
  const corpo = '<div class="ifr-ed"><label class="lb">Nome<input class="campo" id="ifr-n-nome" placeholder="Ex.: Contexto do sistema, Login, Banco principal"></label>' +
    '<label class="lb">Formato<select class="sel" id="ifr-n-formato">' + IFR_FORMATOS.map(f => '<option value="' + f[0] + '"' + (f[0] === a.formato ? ' selected' : '') + '>' + esc(f[1]) + '</option>').join('') + '</select></label>' +
    '<p class="ifr-meta">Começa com um modelo pronto do formato. Depois é só editar o código ou pedir ao DevIT para preencher a partir das fontes reais.</p></div>';
  modal('Novo desenho em ' + esc(a.nome), corpo, [{txt:'Cancelar', cls:'sec'}, {txt:'Criar', acao:async dl => {
    const nome = $('#ifr-n-nome', dl).value.trim(), formato = $('#ifr-n-formato', dl).value;
    if (!nome){ toast('Escreva o nome'); return false; }
    try {
      const n = await ifrSalvarDiagrama({no_id:IFR.no, aba:IFR.aba, nome, formato, fonte:IFR_MODELO[formato] || ''}, {});
      ifrTrocar(n); ifrLado(); ifrAvisarCanvas();
      if (depois) depois(n);
      ifrAbrir(n.id);
    } catch(e){ toast('Não deu para criar: ' + (e.message || e)); }
  }}]);
}
function ifrEscolher(nodeId){
  const l = IFR.diagramas.filter(d => d.aba === IFR.aba || d.no_id === IFR.no);
  const corpo = '<div class="ifr-ed">' + (l.length ? '<ul class="ifr-lista">' + l.map(d => '<li class="ifr-item"><button type="button" class="ifr-item-abrir" data-ifr-ligar="' + esc(d.id) + '"><b>' + esc(d.nome) + '</b><small>' + esc(ifrNomeNo(d.no_id)) + ' · ' + esc(ifrAba(d.aba).nome) + ' · ' + esc(ifrFmt(d.formato)[1]) + '</small></button></li>').join('') + '</ul>' : '<p class="ifr-vazio">Ainda não há desenho. Crie um novo.</p>') + '</div>';
  const dlg = modal('Qual desenho vai neste card?', corpo, [{txt:'Cancelar', cls:'sec'}, {txt:'Novo desenho', cls:'sec', acao:() => { ifrNovo(n => ifrFalar({tipo:'ligar-diagrama', dados:{nodeId, diagramaId:n.id}})); }}]);
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-ifr-ligar]'); if (!b) return; ifrFalar({tipo:'ligar-diagrama', dados:{nodeId, diagramaId:b.dataset.ifrLigar}}); dlg.close(); dlg.remove(); });
}
async function ifrGerar(){
  if (IFR.gerando) return;
  const no = IFR.no, aba = IFR.aba;
  IFR.gerando = true; ifrLado();
  const r = await ifrFuncao({acao:'gerar', no_id:no, aba});
  if (r.erro){ IFR.gerando = false; toast('O DevIT não conseguiu começar: ' + r.erro); ifrLado(); return; }
  toast('O DevIT está lendo as fontes do sistema e desenhando. Pode seguir usando o sistema; aviso quando terminar.');
  // o DevIT trabalha em segundo plano: acompanha o pedido no banco (infra_geracoes) por até 8 minutos
  const sb = ifrBanco(), t0 = Date.now();
  let g = null;
  while (sb && Date.now() - t0 < 8 * 60000){
    await new Promise(ok => setTimeout(ok, 5000));
    const {data} = await sb.from('infra_geracoes').select('id, status, erro, diagramas').eq('id', r.geracao);
    g = (data || []).find(x => x.id === r.geracao) || null;
    if (g && (g.status === 'pronto' || g.status === 'erro')) break;
  }
  IFR.gerando = false;
  if (IFR.no === no && IFR.aba === aba){ await ifrCarregar(); ifrLado(); ifrAvisarCanvas(); }
  if (!g || (g.status !== 'pronto' && g.status !== 'erro')) toast('O DevIT ainda está trabalhando. Os desenhos aparecem aqui quando ele terminar.');
  else if (g.status === 'erro') toast('O DevIT não conseguiu gerar: ' + (g.erro || 'erro sem detalhe'));
  else toast((g.diagramas || []).length ? 'O DevIT gerou ' + g.diagramas.length + (g.diagramas.length === 1 ? ' desenho' : ' desenhos') + ' em ' + ifrAba(aba).nome + '.' : 'O DevIT não achou evidência suficiente para desenhar: ' + (g.erro || ''));
}

/* ---------- baixar: um arquivo, ou tudo na estrutura docs/diagrams (zip sem compressão) ---------- */
const ifrSlug = s => String(s || 'desenho').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'desenho';
const ifrArquivo = d => ifrSlug(d.nome) + '.' + ifrFmt(d.formato)[2];
function ifrBaixarBlob(nome, blob){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
const ifrBaixarTexto = (nome, txt, tipo) => ifrBaixarBlob(nome, new Blob([txt], {type:(tipo || 'text/plain') + ';charset=utf-8'}));
const IFR_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const ifrCrc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = IFR_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function ifrZip(arquivos){
  const enc = new TextEncoder(), partes = [], central = []; let pos = 0;
  const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const [nome, txt] of arquivos){
    const n = enc.encode(nome), dados = enc.encode(txt), crc = ifrCrc(dados);
    const cab = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(n.length), ...u16(0)]);
    partes.push(cab, n, dados);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(dados.length), ...u32(dados.length), ...u16(n.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), n);
    pos += cab.length + n.length + dados.length;
  }
  const tamC = central.reduce((s, x) => s + x.length, 0);
  const fim = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(arquivos.length), ...u16(arquivos.length), ...u32(tamC), ...u32(pos), ...u16(0)]);
  return new Blob(partes.concat(central, [fim]), {type:'application/zip'});
}
async function ifrBaixarTudo(){
  const sb = ifrBanco(), nos = [IFR.no].concat(ifrProdutos(UI.sel).map(p => p.id));
  let todos = IFR.diagramas;
  if (sb){ const {data, error} = await sb.from('infra_diagramas').select('*').in('no_id', nos); if (!error) todos = (data || []).filter(d => nos.includes(d.no_id) && !d.arquivado_em); }
  if (!todos.length){ toast('Ainda não há desenho para baixar.'); return; }
  const raiz = 'docs/diagrams/', arqs = [], manifesto = [];
  const base = d => d.no_id === IFR.no ? raiz : raiz + 'produtos/' + ifrSlug(ifrNomeNo(d.no_id)) + '/';
  const usados = new Set();
  todos.forEach(d => {
    const a = ifrAba(d.aba), pasta = base(d) + a.pasta + '/';
    let nome = ifrSlug(d.nome), k = 2; while (usados.has(pasta + nome)) nome = ifrSlug(d.nome) + '-' + k++;
    usados.add(pasta + nome);
    const arquivo = pasta + nome + '.' + ifrFmt(d.formato)[2];
    arqs.push([arquivo, d.fonte || '']);
    let imagem = null;
    if (d.svg){ imagem = pasta + 'rendered/' + nome + '.svg'; arqs.push([imagem, d.svg]); }
    manifesto.push({nome:d.nome, parte:a.nome, aba:d.aba, onde:ifrNomeNo(d.no_id), formato:d.formato, versao:d.versao, origem:d.origem, arquivo:arquivo.slice(raiz.length), imagem:imagem ? imagem.slice(raiz.length) : null, evidencias:d.evidencias || [], lacunas:d.lacunas || [], atualizado_em:d.atualizado_em || null});
  });
  const titulo = ifrNomeNo(IFR.no);
  arqs.unshift([raiz + 'manifest.json', JSON.stringify({sistema:titulo, gerado_em:new Date().toISOString(), gerado_por:'CicloDev', desenhos:manifesto}, null, 2)]);
  arqs.unshift([raiz + 'README.md', '# Desenhos do sistema: ' + titulo + '\n\nGerado pelo CicloDev em ' + new Date().toLocaleString('pt-BR') + '.\n\nO arquivo de texto de cada desenho (.dsl, .puml, .dbml, .mmd, .dot, .md) é a fonte de verdade; a imagem em `rendered/` é o resultado visual e pode ser gerada de novo a qualquer momento. Abra `navegar.html` no navegador para ver todas as partes e quadros como no CicloDev (só leitura, sem internet).\n\n' +
    IFR_ABAS.map(a => { const l = manifesto.filter(m => m.aba === a.id); return l.length ? '## ' + a.nome + '\n\n' + l.map(m => '- ' + m.nome + (m.onde !== titulo ? ' (' + m.onde + ')' : '') + ': `' + m.arquivo + '`' + (m.imagem ? ', imagem `' + m.imagem + '`' : '') + ', versão ' + m.versao + (m.origem === 'devit' ? ', gerado pelo DevIT' : '')).join('\n') + '\n' : ''; }).join('\n')]);
  if (window.CANVAS_INFRA_HTML){ try { arqs.push([raiz + 'navegar.html', ifrPaginaNavegavel(await ifrDadosNavegaveis())]); } catch(e){} }
  ifrBaixarBlob('diagramas-' + ifrSlug(titulo) + '.zip', ifrZip(arqs));
  toast(todos.length + (todos.length === 1 ? ' desenho baixado' : ' desenhos baixados') + ' na estrutura docs/diagrams.');
}

/* ---------- PNG e PDF a partir do SVG (sem biblioteca) ----------
   Sozinha de propósito (não usa nada de fora dela): vai também dentro do arquivo navegável.
   O PNG sai em até 2x o tamanho da tela; o PDF é uma página do tamanho do desenho com a imagem em alta resolução. */
async function ifrConverter(svg, w, h, como, nome){
  if (como === 'svg') return new Blob([svg], {type:'image/svg+xml;charset=utf-8'});
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  try { await img.decode(); } catch(e){ throw new Error('O navegador não conseguiu abrir a imagem. Baixe em SVG.'); }
  w = w || img.naturalWidth || 1200; h = h || img.naturalHeight || 800;
  const k = Math.max(0.1, Math.min(2, 16000 / w, 16000 / h, Math.sqrt(1.2e8 / (w * h))));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  if (como === 'pdf'){ g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(img, 0, 0, c.width, c.height);
  const gerar = (tipo, q) => new Promise((ok, erro) => {
    try { c.toBlob(b => b ? ok(b) : erro(new Error('O navegador não deixou gerar a imagem. Baixe em SVG.')), tipo, q); }
    catch(e){ erro(new Error('Este navegador não deixa transformar este desenho em ' + (como === 'png' ? 'PNG' : 'PDF') + '. Baixe em SVG.')); }
  });
  if (como === 'png') return gerar('image/png');
  const jpg = new Uint8Array(await (await gerar('image/jpeg', 0.92)).arrayBuffer());
  const s = Math.min(1, 14400 / (w * 0.75), 14400 / (h * 0.75)), pw = +(w * 0.75 * s).toFixed(2), ph = +(h * 0.75 * s).toFixed(2);
  const enc = new TextEncoder(), partes = [], ofs = []; let pos = 0;
  const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); pos += b.length; };
  const obj = (n, corpo) => { ofs[n] = pos; add(n + ' 0 obj\n' + corpo + '\nendobj\n'); };
  const tit = '<FEFF' + [...String(nome || 'Desenho')].map(ch => ch.codePointAt(0)).filter(cc => cc <= 0xFFFF).map(cc => cc.toString(16).padStart(4, '0')).join('') + '>';
  add('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');
  ofs[4] = pos;
  add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + c.width + ' /Height ' + c.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
  add(jpg); add('\nendstream\nendobj\n');
  const cs = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
  obj(5, '<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream');
  obj(6, '<< /Title ' + tit + ' /Producer (CicloDev) >>');
  const xref = pos;
  add('xref\n0 7\n0000000000 65535 f \n' + [1, 2, 3, 4, 5, 6].map(n => String(ofs[n]).padStart(10, '0') + ' 00000 n \n').join('') +
      'trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(partes, {type:'application/pdf'});
}
async function ifrBaixarImagem(d, como){
  try { ifrBaixarBlob(ifrSlug(d.nome) + '.' + como, await ifrConverter(d.svg, 0, 0, como, d.nome)); }
  catch(e){ toast(e.message || String(e)); }
}

/* ---------- arquivo navegável: um .html que abre em qualquer navegador, sem internet e sem login ----------
   Tem as 10 partes da Infraestrutura deste ponto, cada uma com o canvas de verdade (só leitura): zoom, minimapa,
   busca, entrar e sair dos quadros; ao lado, a árvore de quadros e a lista de desenhos (imagem e código).
   Cada quadro dá para baixar em SVG, PNG ou PDF de dentro do próprio arquivo. */
async function ifrDadosNavegaveis(){
  const sb = ifrBanco(), nos = [IFR.no].concat(ifrProdutos(UI.sel).map(p => p.id));
  const docs = {}; IFR_ABAS.forEach(a => { docs[a.id] = {}; });
  let diagramas = IFR.diagramas;
  if (sb){
    const [cv, dg] = await Promise.all([
      sb.from('infra_canvas').select('caminho, dados, aba, no_id').eq('no_id', IFR.no),
      sb.from('infra_diagramas').select('*').in('no_id', nos)
    ]);
    if (cv.error) throw cv.error;
    (cv.data || []).filter(r => r.no_id === IFR.no && docs[r.aba]).forEach(r => { docs[r.aba][r.caminho] = r.dados; });
    if (!dg.error) diagramas = (dg.data || []).filter(d => nos.includes(d.no_id) && !d.arquivado_em);
  } else {
    Object.entries(ifrLocal().canvas).forEach(([k, v]) => { const [n, a, ...c] = k.split('|'); if (n === IFR.no && docs[a]) docs[a][c.join('|')] = v; });
  }
  Object.assign(docs[IFR.aba], IFR.docs);
  return {docs, diagramas};
}
function ifrPaginaNavegavel(dados){
  const titulo = ifrNomeNo(IFR.no), quando = new Date();
  const abas = IFR_ABAS.map((a, i) => {
    const qs = Object.entries(dados.docs[a.id]).filter(([k]) => k.startsWith('quadros/')).map(([k, v]) => ({id:k.slice(8), nome:(v && v.nome) || (k === 'quadros/raiz' ? 'Quadro principal' : 'Quadro'), pai:(v && v.pai) || null, cards:((v && v.nodes) || []).length}));
    const ds = dados.diagramas.filter(d => d.aba === a.id).map(d => ({id:d.id, nome:d.nome, onde:d.no_id === IFR.no ? '' : ifrNomeNo(d.no_id), formato:ifrFmt(d.formato)[1], ext:ifrFmt(d.formato)[2], versao:d.versao, origem:IFR_DE_ONDE[d.origem] || d.origem, svg:d.svg || null, fonte:d.fonte || ''}));
    return {id:a.id, n:String(i + 1).padStart(2, '0'), nome:a.nome, entrada:a.entrada, ferramenta:a.ferramenta, quadros:qs, desenhos:ds, docs:dados.docs[a.id]};
  });
  const mapa = {}; dados.diagramas.forEach(d => { mapa[d.id] = {nome:d.nome, formato:d.formato, versao:d.versao, origem:d.origem, svg:d.svg || null, erro:d.erro || null, renderizado_em:d.renderizado_em || null, fonte:d.fonte || ''}; });
  const pacote = {titulo, gerado:quando.toISOString(), geradoTxt:quando.toLocaleString('pt-BR'), abas, diagramas:mapa, canvas:window.CANVAS_INFRA_HTML || ''};
  const json = JSON.stringify(pacote).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const t = esc(titulo);
  return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + t + ' · Desenhos do sistema</title>\n<style>' + IFR_NAV_CSS + '</style></head>\n<body>\n' +
    '<header class="n-cab"><div class="n-tit"><span class="n-marca">CicloDev · Desenhos do sistema</span><h1>' + t + '</h1><p id="n-resumo"></p></div>' +
    '<div class="n-acoes"><button type="button" id="n-cheia" class="n-b">Tela cheia</button></div></header>\n' +
    '<nav class="n-abas" id="n-abas" role="tablist" aria-label="Partes da Infraestrutura"></nav>\n' +
    '<div class="n-corpo"><aside class="n-lado" id="n-lado" aria-label="Quadros e desenhos desta parte"></aside>' +
    '<main class="n-palco" id="n-palco"><iframe id="n-frame" title="Canvas" sandbox="allow-scripts allow-downloads" allow="fullscreen"></iframe>' +
    '<button type="button" id="n-sair" class="n-b n-sair" hidden>Sair da tela cheia <kbd>Esc</kbd></button></main></div>\n' +
    '<dialog id="n-dlg"><div class="n-dlg-cab"><h2 id="n-dlg-t"></h2><button type="button" class="n-b" data-fechar>Fechar</button></div><div id="n-dlg-c"></div></dialog>\n' +
    '<script>window.PACOTE = ' + json + ';<\/script>\n<script>' + ifrConverter.toString() + '\n' + ifrSrcdoc.toString() + '\n(' + ifrNavegador.toString() + ')();<\/script>\n</body></html>\n';
}
// o que roda dentro do arquivo navegável (sozinho de propósito: não usa nada do CicloDev)
function ifrNavegador(){
  const P = window.PACOTE, $ = s => document.querySelector(s), frame = $('#n-frame');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const slug = s => String(s || 'desenho').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'desenho';
  const baixar = (nome, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
  const comConteudo = P.abas.filter(a => a.quadros.some(q => q.cards) || a.desenhos.length);
  let atual = (comConteudo[0] || P.abas[0]).id;
  const nq = P.abas.reduce((s, a) => s + a.quadros.filter(q => q.cards).length, 0), nd = P.abas.reduce((s, a) => s + a.desenhos.length, 0);
  $('#n-resumo').textContent = 'Gerado em ' + P.geradoTxt + ' · ' + comConteudo.length + (comConteudo.length === 1 ? ' parte' : ' partes') + ' com conteúdo · ' + nq + (nq === 1 ? ' quadro' : ' quadros') + ' · ' + nd + (nd === 1 ? ' desenho' : ' desenhos') + '. Só leitura: o que vale é o que está no CicloDev.';
  const aba = () => P.abas.find(a => a.id === atual);
  function abas(){
    $('#n-abas').innerHTML = P.abas.map(a => { const n = a.quadros.filter(q => q.cards).length + a.desenhos.length;
      return '<button type="button" role="tab" class="n-aba' + (n ? '' : ' vazia') + '" data-aba="' + a.id + '" aria-selected="' + (a.id === atual) + '"><span class="n-n">' + a.n + '</span>' + esc(a.nome) + (n ? '<span class="n-cont">' + n + '</span>' : '') + '</button>'; }).join('');
  }
  function arvore(qs, pai, nivel){
    const filhos = qs.filter(q => (q.pai || null) === pai && q.id !== pai);
    if (!filhos.length || nivel > 12) return '';
    return '<ul class="n-arv">' + filhos.map(q => '<li><button type="button" class="n-q" data-quadro="' + esc(q.id) + '"><span>' + esc(q.nome) + '</span><small>' + q.cards + (q.cards === 1 ? ' card' : ' cards') + '</small></button>' + arvore(qs, q.id, nivel + 1) + '</li>').join('') + '</ul>';
  }
  function lado(){
    const a = aba(), raiz = a.quadros.find(q => q.id === 'raiz');
    let h = '<section><h2>' + esc(a.nome) + '</h2><p class="n-ent">' + esc(a.entrada) + ' <b>' + esc(a.ferramenta) + '</b></p></section>';
    h += '<section><h3>Quadros</h3>' + (a.quadros.length ? (raiz ? '<ul class="n-arv"><li><button type="button" class="n-q" data-quadro="raiz"><span>' + esc(raiz.nome) + '</span><small>' + raiz.cards + (raiz.cards === 1 ? ' card' : ' cards') + '</small></button>' + arvore(a.quadros, 'raiz', 0) + '</li></ul>' : arvore(a.quadros, null, 0)) : '<p class="n-vazio">Nenhum quadro nesta parte.</p>') + '</section>';
    h += '<section><h3>Desenhos</h3>' + (a.desenhos.length ? '<ul class="n-des">' + a.desenhos.map(d => '<li><button type="button" class="n-d" data-desenho="' + esc(d.id) + '"><b>' + esc(d.nome) + '</b><small>' + esc([d.onde, d.formato, 'v' + d.versao, d.origem].filter(Boolean).join(' · ')) + '</small></button></li>').join('') + '</ul>' : '<p class="n-vazio">Nenhum desenho nesta parte.</p>') + '</section>';
    $('#n-lado').innerHTML = h;
  }
  function palco(){
    const a = aba();
    frame.srcdoc = ifrSrcdoc(P.canvas, {ns:'nav|' + a.id, ro:true, exportado:true, docs:a.docs, diagramas:P.diagramas, ls:{}});
  }
  function ir(id){ atual = id; abas(); lado(); palco(); try { history.replaceState(null, '', '#' + id); } catch(e){} }
  const falar = m => { if (frame.contentWindow) frame.contentWindow.postMessage(Object.assign({__infra:true}, m), '*'); };
  function desenho(id){
    const d = P.abas.flatMap(a => a.desenhos).find(x => x.id === id); if (!d) return;
    $('#n-dlg-t').textContent = d.nome;
    $('#n-dlg-c').innerHTML = '<p class="n-meta">' + esc([d.onde, d.formato, 'versão ' + d.versao, d.origem].filter(Boolean).join(' · ')) + '</p>' +
      (d.svg ? '<div class="n-img"><img alt="' + esc(d.nome) + '" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg) + '"></div>' : '<p class="n-vazio">Este desenho não tem imagem (só o código).</p>') +
      '<div class="n-bts">' + (d.svg ? '<button type="button" class="n-b" data-img="svg">Baixar SVG</button><button type="button" class="n-b" data-img="png">Baixar PNG</button><button type="button" class="n-b" data-img="pdf">Baixar PDF</button>' : '') + '<button type="button" class="n-b" data-cod>Baixar código (.' + esc(d.ext) + ')</button></div>' +
      '<h3>Código (a fonte de verdade)</h3><pre class="n-cod">' + esc(d.fonte) + '</pre>';
    const dlg = $('#n-dlg'); dlg.dataset.id = id; if (!dlg.open) dlg.showModal();
  }
  $('#n-dlg').addEventListener('click', async e => {
    const dlg = $('#n-dlg');
    if (e.target === dlg || e.target.closest('[data-fechar]')) { dlg.close(); return; }
    const d = P.abas.flatMap(a => a.desenhos).find(x => x.id === dlg.dataset.id); if (!d) return;
    const bi = e.target.closest('[data-img]');
    if (bi){ try { baixar(slug(d.nome) + '.' + bi.dataset.img, await ifrConverter(d.svg, 0, 0, bi.dataset.img, d.nome)); } catch(err){ alert(err.message || err); } }
    if (e.target.closest('[data-cod]')) baixar(slug(d.nome) + '.' + d.ext, new Blob([d.fonte], {type:'text/plain;charset=utf-8'}));
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-aba]'); if (b){ ir(b.dataset.aba); return; }
    const q = e.target.closest('[data-quadro]'); if (q){ falar({tipo:'abrir-quadro', dados:{id:q.dataset.quadro}}); document.querySelectorAll('.n-q.ativo').forEach(x => x.classList.remove('ativo')); q.classList.add('ativo'); return; }
    const d = e.target.closest('[data-desenho]'); if (d){ desenho(d.dataset.desenho); return; }
    if (e.target.closest('#n-cheia, #n-sair')) cheia();
  });
  const palcoEl = $('#n-palco');
  function cheia(on){
    const ja = document.fullscreenElement === palcoEl || palcoEl.classList.contains('cheia');
    if (on === undefined) on = !ja;
    if (on && !ja){ const cai = () => { palcoEl.classList.add('cheia'); mudou(); }; if (palcoEl.requestFullscreen) palcoEl.requestFullscreen().then(mudou, cai); else cai(); }
    else if (!on && ja){ if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); palcoEl.classList.remove('cheia'); mudou(); }
  }
  function mudou(){ const on = document.fullscreenElement === palcoEl || palcoEl.classList.contains('cheia'); $('#n-sair').hidden = !on; $('#n-cheia').textContent = on ? 'Sair da tela cheia' : 'Tela cheia'; falar({tipo:'tela-cheia', dados:{on}}); }
  document.addEventListener('fullscreenchange', mudou);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && palcoEl.classList.contains('cheia')) cheia(false); });
  // o que o canvas pede: baixar um quadro (SVG, PNG ou PDF), tela cheia e abrir um desenho
  window.addEventListener('message', async e => {
    if (e.source !== frame.contentWindow) return;
    const m = e.data || {}; if (!m.__infra) return;
    const d = m.dados || {}, responder = erro => falar({resposta:m.id, erro:erro || null});
    if (m.tipo === 'baixar'){
      try { baixar(d.filename || 'quadro.json', d.como ? await ifrConverter(d.data || '', d.w, d.h, d.como, d.titulo || (d.filename || '').replace(/\.[a-z]+$/, '')) : new Blob([d.data || ''], {type:(d.tipo || 'application/json') + ';charset=utf-8'})); responder(null); }
      catch(err){ responder({code:'erro', message:err.message || String(err)}); }
    } else if (m.tipo === 'tela-cheia') cheia(!!d.on);
    else if (m.tipo === 'abrir') desenho(d.diagramaId);
    else if (m.id) responder({code:'not_granted', message:'Só leitura'});
  });
  const h = (location.hash || '').slice(1);
  ir(P.abas.some(a => a.id === h) ? h : atual);
}
const IFR_NAV_CSS = ':root{--fundo:#07090B;--sup:#0F1317;--sup2:#151A1F;--linha:#232A31;--tinta:#E7ECEF;--tinta2:#A7B0B9;--tinta3:#6F7C88;--ouro:#C79A5B;color-scheme:dark}' +
  '*{box-sizing:border-box}html,body{height:100%}body{margin:0;display:flex;flex-direction:column;background:var(--fundo);color:var(--tinta);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
  '.n-cab{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;padding:18px 20px 12px;border-bottom:1px solid var(--linha)}' +
  '.n-tit{min-width:0}.n-marca{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ouro);font-weight:600}' +
  '.n-cab h1{margin:4px 0 4px;font-size:22px;font-weight:650;text-wrap:balance}.n-cab p{margin:0;color:var(--tinta2);font-size:12.5px;font-variant-numeric:tabular-nums}' +
  '.n-b{font:inherit;font-size:13px;font-weight:600;color:var(--tinta);background:var(--sup2);border:1px solid var(--linha);border-radius:6px;padding:7px 12px;cursor:pointer}.n-b:hover{border-color:var(--ouro)}.n-b:focus-visible,.n-aba:focus-visible,.n-q:focus-visible,.n-d:focus-visible{outline:2px solid var(--ouro);outline-offset:2px}' +
  'kbd{font:11px ui-monospace,monospace;border:1px solid var(--linha);border-radius:4px;padding:1px 5px;margin-left:6px;color:var(--tinta2)}' +
  '.n-abas{display:flex;gap:2px;overflow-x:auto;padding:0 12px;border-bottom:1px solid var(--linha);scrollbar-width:thin}' +
  '.n-aba{flex:none;display:flex;align-items:center;gap:8px;border:0;border-bottom:3px solid transparent;background:none;color:var(--tinta2);font:inherit;font-size:13px;font-weight:600;padding:11px 10px 9px;cursor:pointer;white-space:nowrap}' +
  '.n-aba:hover{color:var(--tinta)}.n-aba[aria-selected="true"]{color:var(--tinta);border-bottom-color:var(--ouro)}.n-aba.vazia{opacity:.55}' +
  '.n-n{font:10.5px ui-monospace,monospace;color:var(--tinta3)}.n-aba[aria-selected="true"] .n-n{color:var(--ouro)}.n-cont{font-size:11px;background:var(--sup2);border:1px solid var(--linha);border-radius:10px;padding:0 7px;font-variant-numeric:tabular-nums}' +
  '.n-corpo{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr)}' +
  '.n-lado{border-right:1px solid var(--linha);overflow-y:auto;padding:14px 14px 24px;display:grid;align-content:start;gap:18px;background:var(--sup)}' +
  '.n-lado h2{margin:0 0 4px;font-size:15px}.n-lado h3{margin:0 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--tinta3)}.n-ent{margin:0;color:var(--tinta2);font-size:12.5px}' +
  '.n-arv{list-style:none;margin:0;padding:0}.n-arv .n-arv{padding-left:14px;border-left:1px solid var(--linha);margin-left:8px}' +
  '.n-q,.n-d{width:100%;display:flex;justify-content:space-between;align-items:baseline;gap:8px;text-align:left;font:inherit;color:var(--tinta);background:none;border:0;border-radius:5px;padding:6px 8px;cursor:pointer}' +
  '.n-q:hover,.n-d:hover,.n-q.ativo{background:var(--sup2)}.n-q.ativo{box-shadow:inset 3px 0 0 var(--ouro)}.n-q span{min-width:0;overflow-wrap:anywhere}.n-q small,.n-d small{color:var(--tinta3);font-size:11.5px;flex:none}' +
  '.n-des{list-style:none;margin:0;padding:0;display:grid;gap:4px}.n-d{flex-direction:column;align-items:flex-start;gap:1px;border:1px solid var(--linha)}.n-d b{font-size:13px;overflow-wrap:anywhere}.n-d small{flex:initial}' +
  '.n-vazio{margin:0;color:var(--tinta3);font-size:12.5px}' +
  '.n-palco{position:relative;min-width:0;min-height:0;background:#030405}.n-palco iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}' +
  '.n-palco.cheia{position:fixed;inset:0;z-index:50}.n-sair{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);z-index:5;box-shadow:0 10px 30px -12px #000}' +
  'dialog{width:min(1100px,calc(100vw - 32px));max-height:calc(100vh - 32px);background:var(--sup);color:var(--tinta);border:1px solid var(--linha);border-radius:10px;padding:0}dialog::backdrop{background:rgba(0,0,0,.7)}' +
  '.n-dlg-cab{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;background:var(--sup);border-bottom:1px solid var(--linha)}.n-dlg-cab h2{margin:0;font-size:16px}' +
  '#n-dlg-c{padding:14px 16px 18px;display:grid;gap:12px}.n-meta{margin:0;color:var(--tinta2);font-size:12.5px}.n-img{background:#fff;border-radius:6px;padding:12px;overflow:auto;max-height:60vh}.n-img img{display:block;max-width:100%;margin:0 auto}' +
  '.n-bts{display:flex;flex-wrap:wrap;gap:6px}#n-dlg-c h3{margin:6px 0 0;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--tinta3)}.n-cod{margin:0;background:#030405;border:1px solid var(--linha);border-radius:6px;padding:12px;overflow:auto;max-height:40vh;font:12px/1.5 ui-monospace,monospace;white-space:pre}' +
  '@media (max-width:760px){.n-corpo{grid-template-columns:1fr;grid-template-rows:auto minmax(420px,1fr)}.n-lado{border-right:0;border-bottom:1px solid var(--linha);max-height:38vh}}';
async function ifrBaixarNavegavel(){
  if (!window.CANVAS_INFRA_HTML){ toast('O canvas não veio junto com esta versão do sistema.'); return; }
  toast('Montando o arquivo navegável…');
  try {
    const dados = await ifrDadosNavegaveis();
    ifrBaixarTexto('desenhos-' + ifrSlug(ifrNomeNo(IFR.no)) + '.html', ifrPaginaNavegavel(dados), 'text/html');
    toast('Arquivo navegável baixado: abra no navegador para ver todas as partes e quadros, sem internet.');
  } catch(e){ toast('Não deu para montar o arquivo: ' + (e.message || e)); }
}

/* ---------- conversa com o canvas ---------- */
window.addEventListener('message', async e => {
  const f = ifrFrame(); if (!f || e.source !== f.contentWindow) return;
  const m = e.data || {}; if (!m.__infra || m.ns !== ifrNs()) return;
  const responder = erro => ifrFalar({resposta:m.id, erro:erro || null});
  const d = m.dados || {};
  if (m.tipo === 'set') responder(await ifrGravarDoc(d.caminho, d.dados));
  else if (m.tipo === 'delete') responder(await ifrApagarDoc(d.caminho));
  else if (m.tipo === 'ls'){
    const P = UI.infraCanvas = Object.assign({cfg:null, vistas:{}}, UI.infraCanvas || {});
    if (d.k === 'canvas-bl-cfg') P.cfg = d.v;
    else if (d.k === 'canvas-bl-vistas'){ P.vistas[ifrNs()] = d.v; const ks = Object.keys(P.vistas); if (ks.length > 60) delete P.vistas[ks[0]]; }
    salvarUI();
  }
  else if (m.tipo === 'baixar'){
    try {
      const blob = d.como ? await ifrConverter(d.data || '', d.w, d.h, d.como, d.titulo || (d.filename || '').replace(/\.[a-z]+$/, '')) : new Blob([d.data || ''], {type:(d.tipo || 'application/json') + ';charset=utf-8'});
      ifrBaixarBlob(d.filename || 'canvas.json', blob); responder(null);
    } catch(err){ responder({code:'erro', message:err.message || String(err)}); }
  }
  else if (m.tipo === 'tela-cheia') ifrTelaCheia(!!d.on);
  else if (m.tipo === 'baixar-navegavel') ifrBaixarNavegavel();
  else if (m.tipo === 'baixar-zip') ifrBaixarTudo();
  else if (m.tipo === 'escolher' && podeEditar()) ifrEscolher(d.nodeId);
  else if (m.tipo === 'abrir') ifrAbrir(d.diagramaId);
  else if (m.tipo === 'renderizar' && podeEditar()) ifrRenderizar(d.diagramaId);
  else if (m.tipo === 'gerar' && podeEditar()) ifrGerar();
});
// o que outra pessoa (ou o robô) mudou no canvas chega sozinho (a cada 30 segundos, com a aba aberta)
setInterval(() => { if (UI.view === 'infra' && document.visibilityState === 'visible') ifrAtualizarRemoto(); }, 30000);
async function ifrAtualizarRemoto(){
  const sb = ifrBanco();
  if (!sb || UI.view !== 'infra' || !IFR.no || !ifrFrame()) return;
  const {data, error} = await sb.from('infra_canvas').select('caminho, dados, aba, no_id').eq('no_id', IFR.no).eq('aba', IFR.aba);
  if (error) return;
  const vistos = new Set();
  (data || []).filter(r => r.no_id === IFR.no && r.aba === IFR.aba).forEach(r => {
    vistos.add(r.caminho);
    if (JSON.stringify(r.dados) !== JSON.stringify(IFR.conhecidos[r.caminho])){ IFR.conhecidos[r.caminho] = r.dados; IFR.docs[r.caminho] = r.dados; ifrFalar({tipo:'remoto', dados:{caminho:r.caminho, dados:r.dados}}); }
  });
  Object.keys(IFR.conhecidos).forEach(c => { if (!vistos.has(c)){ delete IFR.conhecidos[c]; delete IFR.docs[c]; ifrFalar({tipo:'remoto', dados:{caminho:c, dados:null}}); } });
}

document.addEventListener('click', e => {
  if (!e.target.closest('#ops-corpo .ifr-tela')) return;
  const a = e.target.closest('[data-ifr-aba]'); if (a){ if (a.dataset.ifrAba !== IFR.aba){ UI.infraAba = a.dataset.ifrAba; salvarUI(); rView(); } return; }
  const ab = e.target.closest('[data-ifr-abrir]'); if (ab) return ifrAbrir(ab.dataset.ifrAbrir);
  const por = e.target.closest('[data-ifr-por]'); if (por){ ifrFalar({tipo:'inserir-diagrama', dados:{diagramaId:por.dataset.ifrPor}}); toast('Desenho posto no quadro.'); return; }
  const ir = e.target.closest('[data-ifr-ir]'); if (ir){ UI.sel = ir.dataset.ifrIr; salvarUI(); rOperacoes(); return; }
  if (e.target.closest('[data-ifr-novo]')) return ifrNovo();
  if (e.target.closest('[data-ifr-gerar]')) return ifrGerar();
  if (e.target.closest('[data-ifr-zip]')) return ifrBaixarTudo();
  if (e.target.closest('[data-ifr-cheia]')) return ifrTelaCheia();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#ops-corpo .ifr-canvas.ifr-cheia')) ifrTelaCheia(false); });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {IFR, ifrZip, ifrConverter, ifrPaginaNavegavel, ifrDadosNavegaveis, ifrBaixarNavegavel, ifrTelaCheia, ifrAbrir, ifrNovo, ifrBaixarTudo, IFR_ABAS, rOperacoes, rView});
