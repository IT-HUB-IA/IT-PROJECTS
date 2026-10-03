/* =====================================================================
   Ao vivo (parte 67 do banco): o que outra pessoa (ou o robô) muda aparece aqui sem recarregar a página.
   Como funciona:
   1. O banco manda, por canal privado (um por espaço, um pessoal e o "geral"), um aviso com SÓ a tabela, a coluna
      e os ids que mudaram. Nunca o conteúdo: a tela relê essas linhas pela API normal, com as regras de acesso de sempre.
   2. Os avisos que chegam juntos viram uma releitura só (espera AV_ESPERA ms). Importação grande = "relê a tabela".
   3. O que voltou igual ao que a tela já tem (o eco da própria gravação) não mexe em nada.
   4. Não atrapalha: com janela aberta, campo em edição, texto selecionado, arrastando ou salvando, a novidade espera
      e entra quando a pessoa para. A tela não fica se redesenhando: no máximo uma vez por leva, e só se mudou algo.
   5. Ao voltar para a aba, voltar a internet ou o canal cair e voltar, relê o que pode ter perdido.
   Os módulos com dados próprios (Infraestrutura, Análise, Automático, Ficha, IA, Portal...) ouvem com avOuvir().
   ===================================================================== */
const AV = {canais:[], topicos:[], estado:{}, ligado:false, caiu:false, fila:new Map(), timer:0, tentativa:0, religar:0,
  sujo:false, itensTocados:new Set(), ouvintes:[], escondidoDesde:0, rodando:false, deNovo:false, aplicando:false,
  apertado:false, iniciado:false, parando:false, aplicou:0, registro:[]};
const AV_ESPERA = 400;          // junta os avisos que chegam juntos
const AV_INTERVALO = 3000;      // no máximo uma troca de tela a cada 3 s, mesmo com o robô mudando muita coisa seguida

// os módulos com dados próprios pedem para ser avisados: fn(lote) com lote = Map(tabela -> {c, ids:Set|null}); '*' = releia tudo
function avOuvir(tabelas, fn){ AV.ouvintes.push({tabelas:new Set(tabelas), fn}); }
// o canal ao vivo está ligado? (as conferências periódicas antigas só rodam quando não está)
function avLigado(){ try { return AV.ligado; } catch(e){ return false; } }

// a pessoa está no meio de alguma coisa: a novidade espera
function avOcupado(){
  if (document.querySelector('dialog[open]')) return true;
  if (typeof SYNC !== 'undefined' && (SYNC.rodando || SYNC.pendente)) return true;
  if (AV.apertado || document.querySelector('.arrastando, [aria-grabbed="true"]')) return true;
  const a = document.activeElement;
  if (a && a !== document.body && a.matches && (a.matches('textarea, select, [contenteditable="true"], [contenteditable=""]') ||
      (a.matches('input') && !/^(checkbox|radio|button|submit|reset|range|color|file|image)$/i.test(a.type || '')))) return true;
  const s = window.getSelection && window.getSelection(); if (s && !s.isCollapsed && String(s).trim()) return true;
  return false;
}

/* ---------- canal ---------- */
async function avIniciar(){
  const sb = window.ciclodevBanco; if (!sb || typeof sb.channel !== 'function' || AV.iniciando) return;
  AV.iniciando = true; AV.iniciado = true;
  try {
    avParar();
    const {data, error} = await sb.rpc('ao_vivo_topicos');
    if (error || !Array.isArray(data) || !data.length) throw new Error(error ? error.message : 'nenhum canal');
    try { const s = (await sb.auth.getSession()).data.session; if (s && sb.realtime && sb.realtime.setAuth) sb.realtime.setAuth(s.access_token); } catch(e){ /* segue com o login que o cliente já tem */ }
    // ao sair do sistema, fecha os canais (a conexão não pode durar mais que o login); login renovado vale também para o canal
    if (!AV.ouvindoLogin){ AV.ouvindoLogin = true;
      try { sb.auth.onAuthStateChange((ev, sess) => {
        if (ev === 'SIGNED_OUT'){ avParar(); AV.iniciado = false; clearTimeout(AV.religar); AV.religar = 0; avSelo(); }
        else if (ev === 'TOKEN_REFRESHED' && sess && sb.realtime && sb.realtime.setAuth) sb.realtime.setAuth(sess.access_token);
      }); } catch(e){ /* sem login */ } }
    AV.topicos = data.filter(t => typeof t === 'string' && /^ciclodev:[a-z0-9:-]+$/i.test(t));
    AV.topicos.forEach(t => {
      const ch = sb.channel(t, {config:{private:true}});
      ch.on('broadcast', {event:'mudou'}, m => avReceber(m && m.payload));
      AV.estado[t] = 'conectando';
      ch.subscribe(st => avEstado(t, st));
      AV.canais.push(ch);
    });
  } catch(e){ console.warn('Ao vivo:', e.message || e); AV.caiu = true; avAgendarReligar(); }
  finally { AV.iniciando = false; avSelo(); }
}
function avParar(){
  const sb = window.ciclodevBanco; AV.parando = true;
  AV.canais.forEach(ch => { try { sb.removeChannel(ch); } catch(e){ /* já fechado */ } });
  AV.canais = []; AV.estado = {}; AV.ligado = false; AV.parando = false;
}
function avEstado(t, st){
  if (AV.parando || !AV.topicos.includes(t)) return;
  AV.estado[t] = st;
  const antes = AV.ligado;
  AV.ligado = AV.topicos.length > 0 && AV.topicos.every(x => AV.estado[x] === 'SUBSCRIBED');
  if (AV.ligado){
    AV.tentativa = 0; clearTimeout(AV.religar); AV.religar = 0;
    if (AV.caiu){ AV.caiu = false; avRessincronizar(); }   // pode ter perdido avisos enquanto estava fora
  } else if (/CHANNEL_ERROR|TIMED_OUT|CLOSED/.test(st)){
    if (antes) AV.caiu = true;
    avAgendarReligar();
  }
  avSelo();
}
// uma tentativa por vez (os canais caem juntos): 2 s, 5 s, 15 s, 30 s, depois de minuto em minuto
function avAgendarReligar(){
  if (AV.religar) return;
  const espera = [2000, 5000, 15000, 30000, 60000][Math.min(AV.tentativa++, 4)];
  AV.religar = setTimeout(() => { AV.religar = 0; if (navigator.onLine !== false) avIniciar(); else avAgendarReligar(); }, espera);
}
// releitura completa (voltou de muito tempo fora): tudo o que a tela mostra, e os módulos releem o deles
function avRessincronizar(){
  if (!BANCO.T) return;
  (typeof TABELAS_BANCO !== 'undefined' ? TABELAS_BANCO : []).forEach(t => AV.fila.set(t, {c:'id', ids:null}));
  AV.fila.set('*', {c:'id', ids:null});
  clearTimeout(AV.timer); AV.timer = setTimeout(avProcessar, 50);
}

/* ---------- avisos ---------- */
// o aviso é dado, nunca ordem: só se aceita tabela, coluna e ids com formato conhecido
function avReceber(p){
  if (!p || typeof p.t !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(p.t)) return;
  const c = typeof p.c === 'string' && /^[a-z_][a-z0-9_]*$/.test(p.c) ? p.c : 'id';
  const ids = Array.isArray(p.ids) ? p.ids.filter(x => typeof x === 'string' || typeof x === 'number').map(String) : null;
  const atual = AV.fila.get(p.t);
  if (!atual) AV.fila.set(p.t, {c, ids:ids ? new Set(ids) : null});
  else if (!ids || !atual.ids) atual.ids = null;
  else ids.forEach(x => atual.ids.add(x));
  clearTimeout(AV.timer); AV.timer = setTimeout(avProcessar, AV_ESPERA);
}
const avJson = r => JSON.stringify(Object.keys(r || {}).sort().reduce((o, k) => (o[k] = r[k], o), {}));
const avPk = t => { const g = (typeof GRAVAR !== 'undefined' ? GRAVAR : []).find(x => x[0] === t); return g ? g[1] : null; };

async function avReler(t, c, ids){
  const sb = window.ciclodevBanco;
  try {
    if (!ids) return await lerTabela(sb, t);
    const lista = [...ids], todas = [];
    for (let i = 0; i < lista.length; i += 100){
      const {data, error} = await sb.from(t).select('*').in(c, lista.slice(i, i + 100));
      if (error) throw new Error(error.message);
      todas.push(...(data || []));
    }
    return todas;
  } catch(e){ console.warn('Ao vivo: não deu para reler', t, e.message || e); return null; }
}
// compara valor a valor: data em formato diferente (o que a tela mandou x o que o banco devolve) não é mudança
const AV_IGNORAR = new Set(['atualizado_em']);   // o banco carimba sozinho; não aparece na tela
const AV_DATA = /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/;
function avIgual(a, b){
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  if (typeof a === 'string' && typeof b === 'string' && AV_DATA.test(a) && AV_DATA.test(b)) return Date.parse(a) === Date.parse(b);
  return String(a) === String(b);
}
// a linha mudou de verdade? (minha = esta tela acabou de incluir: as colunas que o banco completou sozinho não contam)
function avLinhaMudou(velha, nova, minha){
  if (!velha || !nova) return true;
  for (const k of Object.keys(nova)){
    if (AV_IGNORAR.has(k)) continue;
    if (!(k in velha)){ if (minha) continue; return true; }
    if (!avIgual(velha[k], nova[k])) return true;
  }
  return false;
}
// troca as linhas na cópia do banco e diz se algo visível mudou. O eco da própria gravação não conta:
// o que esta tela gravou já está na cópia (tAnotar), então a linha relida volta igual
function avTrocarLinhas(t, c, ids, novas){
  const T = BANCO.T, velhas = T[t] || [];
  const dentro = r => !ids || ids.has(String(r[c]));
  const antes = velhas.filter(dentro);
  const pk = avPk(t), chave = r => pk ? chaveLinha(r, pk) : avJson(r), meus = BANCO.meus || new Map();
  const ma = new Map(antes.map(r => [chave(r), r])), mn = new Map(novas.map(r => [chave(r), r]));
  const mudadas = [...new Set([...ma.keys(), ...mn.keys()])].filter(k => avLinhaMudou(ma.get(k), mn.get(k), meus.has(t + '|' + k)));
  const algo = mudadas.length || antes.length !== novas.length || antes.some(r => !mn.has(chave(r)) || avJson(r) !== avJson(mn.get(chave(r))));
  if (algo) T[t] = velhas.filter(r => !dentro(r)).concat(novas);   // a cópia fica igual ao banco, mesmo quando nada visível mudou
  // quais itens isso toca (para a janela do item aberto)
  mudadas.forEach(k => [ma.get(k), mn.get(k)].forEach(r => { if (!r) return;
    [t === 'itens' ? r.id : null, r.item_id, r.origem_id, r.destino_id].forEach(x => { if (x) AV.itensTocados.add(String(x)); }); }));
  return mudadas.length > 0;
}

async function avProcessar(){
  if (AV.rodando){ AV.deNovo = true; return; }
  if (typeof BANCO === 'undefined' || !BANCO.carregado || !BANCO.T) return;
  if (typeof SYNC !== 'undefined' && (SYNC.rodando || SYNC.pendente)){ clearTimeout(AV.timer); AV.timer = setTimeout(avProcessar, 800); return; }   // a gravação desta tela vem primeiro
  const lote = AV.fila; AV.fila = new Map(); if (!lote.size) return;
  AV.rodando = true;
  const gravou = BANCO.gravou || 0;
  try {
    // 1. módulos com dados próprios
    AV.ouvintes.forEach(o => {
      const meu = new Map([...lote].filter(([t]) => t === '*' || o.tabelas.has(t) || o.tabelas.has('*')));
      if (meu.size) try { o.fn(meu); } catch(e){ console.warn('Ao vivo (módulo):', e); }
    });
    // 2. os dados gerais da tela
    const daTela = new Set(typeof TABELAS_BANCO !== 'undefined' ? TABELAS_BANCO : []);
    const relidas = [];
    for (const [t, {c, ids}] of lote){
      if (!daTela.has(t)) continue;
      const linhas = await avReler(t, c, ids);
      if (linhas === null){ avDevolver(t, c, ids); continue; }
      relidas.push([t, c, ids, linhas]);
    }
    // esta tela gravou algo enquanto relia: o que foi relido pode estar velho; relê de novo daqui a pouco
    if ((BANCO.gravou || 0) !== gravou){ relidas.forEach(([t, c, ids]) => avDevolver(t, c, ids)); clearTimeout(AV.timer); AV.timer = setTimeout(avProcessar, 600); return; }
    relidas.forEach(([t, c, ids, linhas]) => { const m = avTrocarLinhas(t, c, ids, linhas); if (m) AV.sujo = true;
      AV.registro.push({em:Date.now(), t, ids:ids ? ids.size : 'tudo', linhas:linhas.length, mudou:m}); });
    if (AV.registro.length > 30) AV.registro.splice(0, AV.registro.length - 30);   // as últimas levas, para conferir no console (AV.registro)
    avTalvezAplicar();
  } finally {
    AV.rodando = false;
    if (AV.deNovo){ AV.deNovo = false; avProcessar(); }
  }
}
function avDevolver(t, c, ids){
  const atual = AV.fila.get(t);
  if (!atual) AV.fila.set(t, {c, ids:ids ? new Set(ids) : null});
  else if (!ids || !atual.ids) atual.ids = null; else ids.forEach(x => atual.ids.add(x));
}

/* ---------- aplicar na tela, sem atrapalhar ---------- */
function avTalvezAplicar(){
  if (!AV.sujo || AV.aplicando) return;
  if (Date.now() - (AV.ultimaTroca || 0) < AV_INTERVALO) return;   // o relógio abaixo aplica quando der o intervalo
  if (avOcupado()){ avAvisarItem(); return; }   // espera; o relógio abaixo tenta de novo
  avAplicar();
}
// a pessoa está mexendo na janela do item e outra pessoa mudou esse mesmo item: avisa, sem trocar nada debaixo do cursor
function avAvisarItem(){
  const aberto = typeof itemAberto !== 'undefined' ? itemAberto : null, g = document.querySelector('#gaveta-wrap .gaveta');
  if (!aberto || !g || !AV.itensTocados.has(String(aberto)) || g.querySelector('.av-aviso')) return;
  const d = document.createElement('div'); d.className = 'av-aviso'; d.setAttribute('role', 'status');
  d.textContent = 'Outra pessoa mudou este item agora. O que você está escrevendo continua aqui; a janela se atualiza quando você sair do campo.';
  g.prepend(d);
}
// guarda e devolve a rolagem de cada área e o que estava aberto (details), para a troca não mexer na posição
function avChaveEl(el){
  if (el === document.scrollingElement || el === document.documentElement) return 'janela';
  const partes = []; let x = el;
  while (x && x !== document.body && partes.length < 8){
    if (x.id){ partes.unshift('#' + x.id); break; }
    const dd = Object.keys(x.dataset || {}).filter(k => k !== 'tooltip').sort().map(k => '[data-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + '="' + String(x.dataset[k]).slice(0, 60) + '"]').join('');
    const cl = (x.className && typeof x.className === 'string') ? '.' + x.className.trim().split(/\s+/).filter(c => !/^(sobre|arrastando|ativo|aberto|hover|foco)$/.test(c)).slice(0, 3).join('.') : '';
    const irmaos = x.parentElement ? [...x.parentElement.children].filter(y => y.tagName === x.tagName && y.className === x.className) : [];
    partes.unshift(x.tagName.toLowerCase() + cl + dd + (irmaos.length > 1 && !dd ? ':' + irmaos.indexOf(x) : ''));
    x = x.parentElement;
  }
  return partes.join('>');
}
// caminho do elemento a partir do body (índices dos filhos): achar de volta é direto, sem medir a página inteira
function avCaminho(el){ const p = []; while (el && el !== document.body && el.parentElement){ p.unshift([...el.parentElement.children].indexOf(el)); el = el.parentElement; } return p; }
function avPorCaminho(p){ let el = document.body; for (const i of p){ el = el && el.children[i]; if (!el) return null; } return el; }
function avGuardarTela(){
  const rolagem = [], abertos = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.scrollTop > 0 || el.scrollLeft > 0) rolagem.push([avCaminho(el), avChaveEl(el), el.scrollTop, el.scrollLeft, el.tagName, el.className]);
    else if (el.tagName === 'DETAILS' && el.open) abertos.push([avCaminho(el), avChaveEl(el), true, 'DETAILS', el.className]);
  });
  return {rolagem, abertos, x:window.scrollX, y:window.scrollY};
}
// devolve no mesmo lugar: pelo caminho, conferindo que é o mesmo elemento (mesma chave); se a estrutura mudou, procura pela chave
function avAchar(caminho, chave, tag, classe){
  const el = avPorCaminho(caminho); if (el && avChaveEl(el) === chave) return el;
  return [...document.getElementsByTagName(tag)].find(x => x.className === classe && avChaveEl(x) === chave) || null;
}
function avDevolverTela(s){
  s.abertos.forEach(([c, k, aberto, tag, cl]) => { const el = avAchar(c, k, tag, cl); if (el && el.open !== aberto) el.open = aberto; });
  s.rolagem.forEach(([c, k, top, left, tag, cl]) => { const el = avAchar(c, k, tag, cl); if (el){ el.scrollTop = top; el.scrollLeft = left; } });
  if (window.scrollX !== s.x || window.scrollY !== s.y) window.scrollTo(s.x, s.y);
}
// os links temporários dos anexos passam para os objetos novos (sem pedir tudo de novo nem redesenhar outra vez)
function avGuardarLinks(){
  const m = new Map();
  try { if (typeof aqTodos === 'function') aqTodos(D).forEach(a => { if (a.x && a.x.storage && a.x.url && a.x._urlAte > Date.now()) m.set(a.x.storage, [a.x.url, a.x._urlAte]); }); } catch(e){ /* sem anexos */ }
  return m;
}
function avDevolverLinks(m){
  if (!m.size) return;
  try { aqTodos(D).forEach(a => { const v = a.x && a.x.storage && m.get(a.x.storage); if (v && !a.x.url){ a.x.url = v[0]; a.x._urlAte = v[1]; } }); } catch(e){ /* sem anexos */ }
}
async function avAplicar(){
  if (!AV.sujo || AV.aplicando || typeof window.ciclodevCarregarBanco !== 'function') return;
  AV.aplicando = true; AV.sujo = false; AV.ultimaTroca = Date.now();
  try {
    const ini = performance.now(), tm = {}, marca = k => { tm[k] = Math.round(performance.now() - ini); };
    const links = avGuardarLinks(), tela = avGuardarTela(); marca('guardar');
    const aberto = typeof itemAberto !== 'undefined' ? itemAberto : null;
    const tocouAberto = aberto && AV.itensTocados.has(String(aberto));
    AV.itensTocados = new Set();
    const copia = structuredClone(BANCO.T); marca('copia');
    await window.ciclodevCarregarBanco(null, copia); marca('montar');
    avDevolverLinks(links);
    // a troca acontece toda no mesmo quadro: o navegador só pinta depois, já com a rolagem devolvida
    render(); marca('desenhar');
    if (aberto){
      if (byId('issues', aberto)){ if (tocouAberto || document.querySelector('#gaveta-wrap .av-aviso')) abrirItem(aberto); }
      else { fecharItem(); toast('O item que estava aberto foi apagado ou arquivado por outra pessoa.'); }
    }
    if (typeof atualizarSino === 'function') atualizarSino();
    avDevolverTela(tela); marca('devolver');
    AV.aplicou++; AV.registro.push({em:Date.now(), aplicou:true, ms:Math.round(performance.now() - ini), tm, foco:(document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || '', item:!!tocouAberto});
  } catch(e){ console.warn('Ao vivo: não aplicou', e); AV.sujo = true; }
  finally { AV.aplicando = false; }
}

/* ---------- módulos: relê o deles quando a pessoa não estiver no meio de algo ---------- */
// uma vez por chave (a mais nova vale); a rolagem e o que estava aberto voltam ao lugar depois
const AV_LIVRE = new Map();
function avQuandoLivre(chave, fn){ AV_LIVRE.set(chave, fn); avRodarLivres(); }
function avRodarLivres(){
  if (!AV_LIVRE.size || avOcupado()) return;
  const fs = [...AV_LIVRE.values()]; AV_LIVRE.clear();
  fs.forEach(f => { const tela = avGuardarTela();
    Promise.resolve().then(f).then(() => avDevolverTela(tela)).catch(e => console.warn('Ao vivo (módulo):', e)); });
}

/* ---------- selo "ao vivo" ---------- */
function avSelo(){
  const chip = document.querySelector('.chip-exemplo'); if (!chip) return;
  let s = document.querySelector('.av-selo');
  if (!s){ s = document.createElement('span'); s.className = 'av-selo'; s.setAttribute('role', 'status'); chip.after(s); }
  const on = AV.ligado, tentando = !on && AV.iniciado;
  s.dataset.av = on ? 'on' : (tentando ? 'religando' : 'off');
  s.textContent = on ? 'Ao vivo' : (tentando ? 'Reconectando' : '');
  s.title = on ? 'As mudanças de outras pessoas aparecem sozinhas, sem recarregar.' : (tentando ? 'Sem conexão ao vivo agora. Tentando de novo; ao voltar, a tela busca o que mudou.' : '');
  s.hidden = !AV.iniciado;
}

/* ---------- ligações ---------- */
if (typeof COM_BANCO !== 'undefined' && COM_BANCO){
  // liga depois da primeira leitura do banco (aí já se sabe quem entrou)
  const _carregarAv = carregarDoBanco;
  carregarDoBanco = async function(){ const r = await _carregarAv.apply(this, arguments); if (!AV.iniciado && BANCO.carregado) avIniciar(); return r; };
  window.ciclodevCarregarBanco = carregarDoBanco;
  // a cada segundo: se tem novidade esperando e a pessoa parou, aplica
  setInterval(() => { avRodarLivres(); if (AV.sujo && !AV.aplicando && !AV.rodando) { if (avOcupado()) avAvisarItem(); else avTalvezAplicar(); } }, 1000);
  document.addEventListener('pointerdown', () => { AV.apertado = true; }, true);
  ['pointerup', 'pointercancel', 'dragend'].forEach(ev => document.addEventListener(ev, () => { AV.apertado = false; }, true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden'){ AV.escondidoDesde = Date.now(); return; }
    const longe = AV.escondidoDesde && Date.now() - AV.escondidoDesde > 120000; AV.escondidoDesde = 0;
    if (!AV.iniciado) return;
    if (!AV.ligado){ AV.caiu = true; avIniciar(); } else if (longe) avRessincronizar();
  });
  window.addEventListener('online', () => { if (AV.iniciado){ AV.caiu = true; avIniciar(); } });
  window.addEventListener('offline', () => { if (AV.iniciado){ AV.ligado = false; AV.caiu = true; avSelo(); } });
}
if (location.protocol === 'file:' && window.__tf) Object.assign(window.__tf, {AV, avQuandoLivre, avReceber, avProcessar, avOcupado, avIniciar, avParar, avAplicar, avRessincronizar, avOuvir, avChaveEl, avEstado});
