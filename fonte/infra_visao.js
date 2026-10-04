/* ===== Infraestrutura: a visão completa, aberta de cara =====
   Ao entrar numa sub-aba da Infraestrutura, o canvas já mostra o desenho inteiro, pronto para navegar:
   - na aplicação: o que está no quadro principal e o conteúdo de cada quadro (os desenhos automáticos), lado a lado,
     sem o cartão de "quadro" que precisava de dois cliques;
   - no produto: um grupo por aplicação, cada um com o desenho dela;
   - no projeto: o desenho do próprio projeto, um grupo por produto e, dentro, um grupo por aplicação.
   Aplicação ainda sem desenho nesta parte aparece só como um cartão com o nome; quando o desenho chega (publicação
   no GitHub, mudança no banco, DevIT), a visão se remonta sozinha. A visão é só para ver e navegar: ela é montada
   dos quadros de cada lugar. Para mexer à mão, o botão "Editar o quadro" abre o quadro como antes. */
const IFV = {chave:null, linhas:[], doc:null, carregando:false};
const ifvEditar = () => !!(UI.infraEditar && UI.infraEditar[UI.sel + '|' + IFR.aba]);

// os pontos que entram na visão: o próprio e, no projeto e no produto, os de dentro
function ifvPontos(){
  const [tipo, id] = UI.sel.split(':');
  if (tipo === 'project'){
    const prods = D.products.filter(p => p.project === id);
    return {tipo, raiz:id, prods:prods.map(p => ({p, apps:D.apps.filter(a => a.product === p.id)})), soltos:D.apps.filter(a => a.project === id && !a.product)};
  }
  if (tipo === 'product') return {tipo, raiz:id, prods:[], apps:D.apps.filter(a => a.product === id)};
  return {tipo, raiz:id};
}
function ifvIds(){
  const P = ifvPontos(), ids = [P.raiz];
  if (P.tipo === 'project'){ P.prods.forEach(x => { ids.push(x.p.id); x.apps.forEach(a => ids.push(a.id)); }); P.soltos.forEach(a => ids.push(a.id)); }
  if (P.tipo === 'product') P.apps.forEach(a => ids.push(a.id));
  return ids;
}
async function ifvCarregar(){
  const sb = ifrBanco(), ids = ifvIds();
  if (sb){
    const {data, error} = await sb.from('infra_canvas').select('caminho, dados, aba, no_id').in('no_id', ids).eq('aba', IFR.aba);
    if (error) throw error;
    return (data || []).filter(r => r.aba === IFR.aba && ids.includes(r.no_id));
  }
  const L = ifrLocal(); return Object.entries(L.canvas).map(([k, v]) => { const [n, a, ...c] = k.split('|'); return {no_id:n, aba:a, caminho:c.join('|'), dados:v}; }).filter(r => r.aba === IFR.aba && ids.includes(r.no_id));
}

/* ---------- montagem ---------- */
// altura de um card quando o canvas ainda não mediu (os automáticos não guardam a altura de todo tipo)
function ifvAlt(n){
  if (typeof n.h === 'number' && n.h > 0) return n.h;
  if (n.tipo === 'tabela') return 52 + 24 * ((n.linhas || []).length + (n.estilo === 'classe' ? (n.operacoes || []).length : 0));
  if (n.tipo === 'texto') return n.fonte === 'g' ? 56 : 34;
  const tops = (n.topicos || []).length;
  return 64 + (n.subtitulo ? 22 : 0) + ((n.etiquetas || []).length ? 6 : 0) + (tops ? 22 + tops * 24 : 0);
}
const ifvLarg = n => (typeof n.w === 'number' && n.w > 0 ? n.w : 260);
function ifvCaixa(nodes){
  if (!nodes.length) return {x:0, y:0, w:0, h:0};
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  nodes.forEach(n => { x0 = Math.min(x0, n.x || 0); y0 = Math.min(y0, n.y || 0); x1 = Math.max(x1, (n.x || 0) + ifvLarg(n)); y1 = Math.max(y1, (n.y || 0) + ifvAlt(n)); });
  return {x:x0, y:y0, w:x1 - x0, h:y1 - y0};
}
// um bloco = nodes e edges com ids só dele, já com o canto de cima à esquerda em (0,0)
function ifvBloco(nodes, edges, pre){
  const c = ifvCaixa(nodes), id = x => pre + x;
  return {w:c.w, h:c.h,
    nodes:nodes.map(n => Object.assign(JSON.parse(JSON.stringify(n)), {id:id(n.id), x:(n.x || 0) - c.x, y:(n.y || 0) - c.y})),
    edges:edges.filter(e => e.de && e.para).map(e => Object.assign(JSON.parse(JSON.stringify(e)), {id:id(e.id || (e.de + '>' + e.para)), de:id(e.de), para:id(e.para)}))};
}
const ifvMover = (b, dx, dy) => { b.nodes.forEach(n => { n.x += dx; n.y += dy; }); return b; };
// os blocos de um ponto: o que está solto no quadro principal e o conteúdo de cada quadro, sem o cartão de quadro
function ifvBlocosDoPonto(no, docs){
  const doc = c => docs[c], raiz = doc('quadros/raiz') || {nodes:[], edges:[]}, pre = 'v' + String(no).slice(0, 8) + '_';
  const cartoes = (raiz.nodes || []).filter(n => n.tipo === 'quadro' && n.quadroId);
  const soltos = (raiz.nodes || []).filter(n => !(n.tipo === 'quadro' && n.quadroId));
  const blocos = [];
  if (soltos.length) blocos.push(ifvBloco(soltos, (raiz.edges || []).filter(e => soltos.some(n => n.id === e.de) && soltos.some(n => n.id === e.para)), pre + 'r_'));
  const ids = cartoes.map(n => n.quadroId).concat(Object.keys(docs).filter(k => k.startsWith('quadros/') && k !== 'quadros/raiz' && (docs[k] || {}).pai === 'raiz').map(k => k.slice(8)));
  [...new Set(ids)].forEach((qid, k) => { const q = doc('quadros/' + qid); if (q && (q.nodes || []).length) blocos.push(ifvBloco(q.nodes, q.edges || [], pre + 'q' + k + '_')); });
  return blocos;
}
// lado a lado, quebrando a linha quando fica largo demais
function ifvEnfileirar(blocos, gap, largMax){
  const out = {nodes:[], edges:[], w:0, h:0}; let x = 0, y = 0, altLinha = 0;
  blocos.forEach(b => {
    if (x > 0 && x + b.w > largMax){ x = 0; y += altLinha + gap; altLinha = 0; }
    ifvMover(b, x, y); out.nodes.push(...b.nodes); out.edges.push(...b.edges);
    out.w = Math.max(out.w, x + b.w); out.h = Math.max(out.h, y + b.h); altLinha = Math.max(altLinha, b.h); x += b.w + gap;
  });
  return out;
}
// um grupo em volta do conteúdo, com o nome do produto ou da aplicação
function ifvGrupo(id, titulo, cor, dentro){
  const pad = 40, topo = 64, w = Math.max(dentro.w + pad * 2, 320), h = dentro.h + topo + pad;
  ifvMover(dentro, pad, topo);
  return {w, h, nodes:[{id, tipo:'grupo', x:0, y:0, w, h, cor, titulo, nota:''}].concat(dentro.nodes), edges:dentro.edges};
}
function ifvSemDesenho(id, nome, rotulo){
  return {w:300, h:120, edges:[], nodes:[{id, tipo:'empresa', x:0, y:0, w:300, cor:'cinza', icone:'container', rotuloTipo:rotulo, titulo:nome, subtitulo:'Ainda sem desenho nesta parte. Ligue o repositório ou o banco na Infraestrutura dela.', etiquetas:[], topicos:[], nota:''}]};
}
function ifvDoApp(a, porNo, comGrupo){
  const blocos = ifvBlocosDoPonto(a.id, porNo[a.id] || {});
  if (!blocos.length) return ifvSemDesenho('vapp_' + a.id, a.nome, 'APLICAÇÃO');
  const junto = ifvEnfileirar(blocos, 160, 9000);
  return comGrupo ? ifvGrupo('vg_' + a.id, a.nome, 'azul', junto) : junto;
}
function ifvCompor(linhas){
  const porNo = {};
  linhas.forEach(r => { (porNo[r.no_id] = porNo[r.no_id] || {})[r.caminho] = r.dados; });
  const P = ifvPontos();
  let tudo;
  if (P.tipo === 'app'){
    const a = byId('apps', P.raiz) || {id:P.raiz, nome:'Aplicação'};
    tudo = ifvDoApp(a, porNo, false);
  } else {
    const partes = [];
    const proprios = ifvBlocosDoPonto(P.raiz, porNo[P.raiz] || {});
    if (proprios.length) partes.push(ifvEnfileirar(proprios, 160, 9000));
    if (P.tipo === 'product') partes.push(ifvEnfileirar(P.apps.map(a => ifvDoApp(a, porNo, true)), 140, 7000));
    else {
      const prods = P.prods.map(x => {
        const dele = ifvBlocosDoPonto(x.p.id, porNo[x.p.id] || {});
        const dentro = [];
        if (dele.length) dentro.push(ifvEnfileirar(dele, 160, 9000));
        if (x.apps.length) dentro.push(ifvEnfileirar(x.apps.map(a => ifvDoApp(a, porNo, true)), 120, 6000));
        if (!dentro.length) return ifvSemDesenho('vprod_' + x.p.id, x.p.nome, 'PRODUTO');
        return ifvGrupo('vgp_' + x.p.id, x.p.nome, 'ouro', ifvEnfileirar(dentro, 100, 1));
      });
      const soltos = P.soltos.map(a => ifvDoApp(a, porNo, true));
      if (prods.length || soltos.length) partes.push(ifvEnfileirar(prods.concat(soltos), 180, 12000));
    }
    tudo = ifvEnfileirar(partes, 200, 1);   // uma parte embaixo da outra
  }
  // os grupos de fora vão primeiro (ficam atrás); o resto na ordem em que veio
  const grupos = tudo.nodes.filter(n => n.tipo === 'grupo'), resto = tudo.nodes.filter(n => n.tipo !== 'grupo');
  return {nome:'Visão completa', pai:null, nodes:grupos.concat(resto), edges:tudo.edges};
}

/* ---------- na tela ---------- */
const _ifrMontarCanvasV = ifrMontarCanvas;
ifrMontarCanvas = function(){
  if (ifvEditar() || IFR.erro) return _ifrMontarCanvasV.apply(this, arguments);
  const casa = $('#ops-corpo [data-ifr-canvas]'); if (!casa) return;
  const chave = UI.sel + '|' + IFR.aba;
  if (IFV.chave !== chave || !IFV.doc){
    casa.innerHTML = '<p class="ifr-carregando">Montando o desenho completo…</p>';
    IFV.chave = chave; IFV.doc = null;
    ifvCarregar().then(l => { if (IFV.chave !== chave) return; IFV.linhas = l; IFV.doc = ifvCompor(l); if (UI.view === 'infra' && UI.sel + '|' + IFR.aba === chave) ifrMontarCanvas(); })
      .catch(e => { casa.innerHTML = '<p class="entrada-erro">Não deu para montar o desenho: ' + esc(e.message || e) + '</p>'; });
    return;
  }
  const html = window.CANVAS_INFRA_HTML; if (!html) return _ifrMontarCanvasV.apply(this, arguments);
  const cfgUI = UI.infraCanvas || {};
  const init = {ns:ifrNs() + '|visao', ro:true, visao:true, rotuloRo:'Visão completa · atualiza sozinha', docs:{'quadros/raiz':IFV.doc}, diagramas:ifrMapaDiagramas(),
    ls:{'canvas-bl-cfg':cfgUI.cfg || undefined, 'canvas-bl-vistas':(cfgUI.vistas || {})[ifrNs() + '|visao'] || undefined}};
  const f = document.createElement('iframe');
  f.className = 'ifr-frame'; f.title = 'Desenho completo de ' + ifrAba(IFR.aba).nome;
  f.setAttribute('sandbox', 'allow-scripts allow-downloads'); f.setAttribute('allow', 'fullscreen');
  f.srcdoc = ifrSrcdoc(html, init);
  casa.innerHTML = ''; casa.appendChild(f);
  casa.insertAdjacentHTML('beforeend', '<button type="button" class="ifr-sair-cheia" data-ifr-cheia hidden>Sair da tela cheia <kbd>Esc</kbd></button>');
};
// de 30 em 30 segundos (e depois de cada atualização automática): remonta a visão se algum desenho mudou
const _ifrAtualizarRemotoV = ifrAtualizarRemoto;
ifrAtualizarRemoto = async function(){ // (na visão completa: remonta)
  if (ifvEditar()) return _ifrAtualizarRemotoV.apply(this, arguments);
  if (UI.view !== 'infra' || !IFR.no || !ifrFrame() || IFV.chave !== UI.sel + '|' + IFR.aba) return;
  let l; try { l = await ifvCarregar(); } catch (e){ return; }
  const novo = ifvCompor(l);
  if (JSON.stringify(novo) === JSON.stringify(IFV.doc)) return;
  IFV.linhas = l; IFV.doc = novo;
  ifrFalar({tipo:'remoto', dados:{caminho:'quadros/raiz', dados:novo}});
};
// a troca entre ver tudo e editar o quadro, em cima do canvas
const _ifrTelaHTMLV = ifrTelaHTML;
ifrTelaHTML = function(){
  const ed = ifvEditar(), pode = podeEditar();
  const barra = '<div class="ifv-modo" role="group" aria-label="Como ver"><button type="button" class="ifv-b' + (ed ? '' : ' sel') + '" data-ifv-modo="ver" aria-pressed="' + !ed + '">Desenho completo</button>' +
    (pode ? '<button type="button" class="ifv-b' + (ed ? ' sel' : '') + '" data-ifv-modo="editar" aria-pressed="' + ed + '">Editar o quadro</button>' : '') +
    (typeof ifrLigBotaoHTML === 'function' ? ifrLigBotaoHTML() : '') +
    '<span class="ifv-dica">' + (ed ? 'Você está mexendo no quadro deste lugar. Os desenhos automáticos continuam se refazendo sozinhos.' : 'Tudo o que existe nesta parte, já aberto. Se atualiza sozinho a cada publicação.') + '</span></div>';
  return _ifrTelaHTMLV.apply(this, arguments).replace('<div class="ifr-corpo">', barra + '<div class="ifr-corpo">');
};
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#ops-corpo [data-ifv-modo]'); if (!b) return;
  const k = UI.sel + '|' + IFR.aba, ed = b.dataset.ifvModo === 'editar';
  if (ed === ifvEditar()) return;
  UI.infraEditar = Object.assign({}, UI.infraEditar || {}, {[k]:ed}); if (!ed) delete UI.infraEditar[k];
  IFV.chave = null; salvarUI();
  const t = $('#ops-corpo .ifr-tela'); if (t) t.dataset.chave = '';   // força montar de novo
  rView();
});
// abrir um desenho no canvas (lista do lado): na visão completa ele já está lá; para abrir o quadro dele, vai para Editar
if (typeof ifrAbrirQuadro === 'function'){
  const _ifrAbrirQuadroV = ifrAbrirQuadro;
  ifrAbrirQuadro = function(caminho){
    if (ifvEditar()) return _ifrAbrirQuadroV.apply(this, arguments);
    const k = UI.sel + '|' + IFR.aba;
    UI.infraEditar = Object.assign({}, UI.infraEditar || {}, {[k]:true}); IFV.chave = null; salvarUI();
    const t = $('#ops-corpo .ifr-tela'); if (t) t.dataset.chave = '';
    rView();
    setTimeout(() => _ifrAbrirQuadroV(caminho), 900);
  };
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {ifvCompor, ifvPontos, IFV, ifrAtualizarRemoto: () => ifrAtualizarRemoto()});
