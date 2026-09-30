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
if (!SM_PRINCIPAIS.includes('infra')) SM_PRINCIPAIS.push('infra');
// quem já escolheu as abas da barra ganha a Infraestrutura uma vez (depois, se tirar, fica tirada)
function ifrNaBarra(){ if (Array.isArray(UI.abasFixas) && !UI.abasFixas.includes('infra') && !UI.infraNaBarra){ UI.abasFixas = UI.abasFixas.concat('infra'); UI.infraNaBarra = true; salvarUI(); } }

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
  ifrNaBarra();
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
  const ini = '<script>window.__INFRA_INIT = ' + JSON.stringify(init).replace(/</g, '\\u003c') + ';<\/script>\n';
  const f = document.createElement('iframe');
  f.className = 'ifr-frame'; f.title = 'Canvas de ' + ifrAba(IFR.aba).nome;
  f.setAttribute('sandbox', 'allow-scripts allow-downloads');
  f.srcdoc = html.replace('<script>\n/* Ponte com o CicloDev', ini + '<script>\n/* Ponte com o CicloDev');
  casa.innerHTML = ''; casa.appendChild(f);
}
const ifrFrame = () => $('#ops-corpo .ifr-frame');
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
    (cf.erro ? '<p class="ifr-cfg">' + esc(cf.erro) + '</p>' : IFR.config ? '<ul class="ifr-cfg">' + chave(cf.conversor, 'conversor de desenhos (RENDER_URL)') + chave(cf.devit, 'DevIT (ANTHROPIC_API_KEY)') + chave(cf.github, 'GitHub, para ler o código (app do CicloDev, em Admin)') + chave(cf.gitlab, 'GitLab, para ler o código (em Admin)') + chave(cf.figma, 'Figma, para ler os protótipos (FIGMA_TOKEN)') + '</ul>' : '') + '</div>';
  el.innerHTML = h;
}

/* ---------- editor de um desenho: código, imagem, evidências e versões ---------- */
async function ifrAbrir(id){
  const d = IFR.diagramas.find(x => x.id === id); if (!d) return;
  const podeNo = podeEditar() && (d.no_id === IFR.no || ifrProdutos(UI.sel).some(p => p.id === d.no_id));
  // o desenho automático é refeito sozinho: não se muda o texto dele (dá para copiar e editar a cópia)
  const auto = !!d.chave_auto, pode = podeNo && !auto;
  const img = d.svg ? '<div class="ifr-prev"><img src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d.svg) + '" alt="' + esc(d.nome) + '"></div>' : '<p class="ifr-vazio">' + (d.formato === 'markdown' ? 'Especificação em texto: não vira imagem.' : d.erro ? 'Não deu para gerar a imagem: ' + esc(d.erro) : 'Ainda sem imagem. Salve o código e clique em Gerar imagem.') + '</p>';
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
  if (d.svg) bts.push({txt:'Baixar imagem', cls:'sec', acao:() => { ifrBaixarTexto(ifrSlug(d.nome) + '.svg', d.svg, 'image/svg+xml'); return false; }});
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
  arqs.unshift([raiz + 'README.md', '# Desenhos do sistema: ' + titulo + '\n\nGerado pelo CicloDev em ' + new Date().toLocaleString('pt-BR') + '.\n\nO arquivo de texto de cada desenho (.dsl, .puml, .dbml, .mmd, .dot, .md) é a fonte de verdade; a imagem em `rendered/` é o resultado visual e pode ser gerada de novo a qualquer momento.\n\n' +
    IFR_ABAS.map(a => { const l = manifesto.filter(m => m.aba === a.id); return l.length ? '## ' + a.nome + '\n\n' + l.map(m => '- ' + m.nome + (m.onde !== titulo ? ' (' + m.onde + ')' : '') + ': `' + m.arquivo + '`' + (m.imagem ? ', imagem `' + m.imagem + '`' : '') + ', versão ' + m.versao + (m.origem === 'devit' ? ', gerado pelo DevIT' : '')).join('\n') + '\n' : ''; }).join('\n')]);
  ifrBaixarBlob('diagramas-' + ifrSlug(titulo) + '.zip', ifrZip(arqs));
  toast(todos.length + (todos.length === 1 ? ' desenho baixado' : ' desenhos baixados') + ' na estrutura docs/diagrams.');
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
  else if (m.tipo === 'baixar'){ ifrBaixarTexto(d.filename || 'canvas.json', d.data || '', 'application/json'); responder(null); }
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
  if (e.target.closest('[data-ifr-cheia]')){ const c = $('#ops-corpo .ifr-canvas'); if (c){ const on = c.classList.toggle('ifr-cheia'); e.target.textContent = on ? 'Sair da tela cheia' : 'Tela cheia'; c.insertAdjacentHTML('beforeend', ''); } return; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape'){ const c = $('#ops-corpo .ifr-canvas.ifr-cheia'); if (c){ c.classList.remove('ifr-cheia'); const b = $('[data-ifr-cheia]'); if (b) b.textContent = 'Tela cheia'; } } });
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {IFR, ifrZip, ifrAbrir, ifrNovo, ifrBaixarTudo, IFR_ABAS, rOperacoes, rView});
