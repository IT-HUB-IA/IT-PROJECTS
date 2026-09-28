/* =====================================================================
   Itens mais completos: repetição, lembrete, texto formatado com histórico,
   duplicar, modelos, lixeira (excluir e restaurar) e desfazer.
   Camada nova por cima das outras (carrega depois do studio.js).
   Tudo com prefixo tf para não misturar com o resto.
   ===================================================================== */
const TF = {desfazer:null, modelos:null, lixeira:null, carregandoLix:false, vistos:null};
const TF_SV = d => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" aria-hidden="true">' + d + '</svg>';
const TF_ICO = {
  mais:TF_SV('<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>'),
  sino:TF_SV('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20h4"/>'),
  repete:TF_SV('<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8"/><path d="M20 3v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.7L4 16"/><path d="M4 21v-5h5"/>'),
  copia:TF_SV('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>'),
  modelo:TF_SV('<path d="M4 4h16v5H4zM4 13h7v7H4zM15 13h5v7h-5z"/>'),
  historico:TF_SV('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  arquivo:TF_SV('<path d="M3 4h18v5H3z"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/>'),
  lixo:TF_SV('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  criar:TF_SV('<path d="M12 5v14M5 12h14"/>'),
  mover:TF_SV('<path d="M4 12h16M14 6l6 6-6 6"/>'),
  restaurar:TF_SV('<path d="M4 10a8 8 0 1 1 2 6"/><path d="M4 4v6h6"/>'),
  editar:TF_SV('<path d="M4 20h4L20 8l-4-4L4 16z"/>')
};
const tfClone = o => JSON.parse(JSON.stringify(o));
const tfSb = () => COM_BANCO ? window.ciclodevBanco : null;
const tfEu = () => idEu(UI.verComo) || idEu('master') || '';
const TIPO_NO_PT = {client:'cliente', project:'projeto', product:'produto', app:'aplicacao', ws:'frente'};
const NOME_NIVEL = {cliente:'Cliente', projeto:'Projeto', produto:'Produto', aplicacao:'Aplicação', frente:'Frente', item:'Item'};
const tfErro = e => (e && (e.message || e.error_description || e.details)) || String(e || 'erro');

/* ---------- aviso com botões (Desfazer, Abrir...) ---------- */
function tfAviso(msg, botoes, ms){
  let a = $('#tf-aviso');
  if (!a){ a = document.createElement('div'); a.id = 'tf-aviso'; a.className = 'tf-aviso'; a.setAttribute('role', 'status'); a.setAttribute('aria-live', 'polite'); document.body.appendChild(a); }
  const t = $('#toast'); if (t) t.hidden = true;
  a.innerHTML = '<span class="tf-aviso-txt">' + esc(msg) + '</span>' + (botoes || []).map((b, k) => '<button type="button" class="tf-aviso-b" data-tf-aviso="' + k + '">' + esc(b.txt) + '</button>').join('') +
    '<button type="button" class="tf-aviso-x" data-tf-aviso-x aria-label="Fechar aviso">' + ICO.fechar + '</button>';
  a.hidden = false; a._botoes = botoes || [];
  clearTimeout(a._t); a._t = setTimeout(() => { a.hidden = true; }, ms || 8000);
}
document.addEventListener('click', e => {
  const a = $('#tf-aviso'); if (!a || a.hidden) return;
  const b = e.target.closest('[data-tf-aviso]'); if (b){ const bt = a._botoes[+b.dataset.tfAviso]; a.hidden = true; if (bt && bt.acao) bt.acao(); return; }
  if (e.target.closest('[data-tf-aviso-x]')) a.hidden = true;
});

/* ---------- desfazer: guarda uma foto dos dados antes da ação ---------- */
function tfComDesfazer(msg, fazer, extras){
  const antes = tfClone(D);
  const r = fazer(); if (r === false) return false;
  salvar(); render();
  const desfazer = () => { if (TF.desfazer !== desfazer) return; TF.desfazer = null; D = antes; salvar(); if (itemAberto && !byId('issues', itemAberto)) fecharItem(); else if (itemAberto) abrirItem(itemAberto); render(); tfAviso('Desfeito.', [], 3000); };
  TF.desfazer = desfazer; TF.desfazerAte = Date.now() + 60000;
  tfAviso(msg, (extras || []).concat([{txt:'Desfazer', acao:desfazer}]));
  return r;
}
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
  if (e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (TF.desfazer && Date.now() < TF.desfazerAte){ e.preventDefault(); TF.desfazer(); }
});

/* ---------- menu de ações (⋯) ---------- */
function tfFecharMenu(){ const m = $('#tf-menu'); if (m){ const a = m._ancora; m.remove(); if (a && a.isConnected) a.setAttribute('aria-expanded', 'false'); } }
function tfMenu(ancora, itens){
  tfFecharMenu();
  const m = document.createElement('div'); m.id = 'tf-menu'; m.className = 'tf-menu'; m.setAttribute('role', 'menu');
  const lista = itens.filter(Boolean);
  m.innerHTML = lista.map((it, k) => it.sep ? '<div class="tf-menu-sep" role="separator"></div>' + (it.titulo ? '<div class="tf-menu-tit">' + esc(it.titulo) + '</div>' : '')
    : '<button type="button" role="menuitem" class="tf-menu-b' + (it.perigo ? ' perigo' : '') + '" data-tf-menu="' + k + '">' + (it.ico || '') + '<span><b>' + esc(it.txt) + '</b>' + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span></button>').join('');
  document.body.appendChild(m); m._itens = lista; m._ancora = ancora;
  ancora.setAttribute('aria-expanded', 'true');
  const r = ancora.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  let x = Math.min(r.right - w, window.innerWidth - w - 8); x = Math.max(8, x);
  let y = r.bottom + 4; if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 4);
  m.style.left = x + 'px'; m.style.top = y + 'px';
  const bts = $$('.tf-menu-b', m); if (bts[0]) bts[0].focus();
  m.addEventListener('keydown', e => {
    const k = bts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown'){ e.preventDefault(); bts[(k + 1) % bts.length].focus(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); bts[(k - 1 + bts.length) % bts.length].focus(); }
    else if (e.key === 'Escape' || e.key === 'Tab'){ e.preventDefault(); e.stopPropagation(); tfFecharMenu(); ancora.focus(); }
  });
}
document.addEventListener('click', e => {
  const m = $('#tf-menu'); if (!m) return;
  const b = e.target.closest('[data-tf-menu]');
  if (b && m.contains(b)){ e.stopPropagation(); const it = m._itens[+b.dataset.tfMenu]; tfFecharMenu(); if (it && it.acao) it.acao(); return; }
  if (!m.contains(e.target) && !e.target.closest('[data-tf-acoes-item],[data-tf-acoes-no]')) tfFecharMenu();
}, true);
window.addEventListener('resize', tfFecharMenu);

/* ---------- texto formatado (Markdown simples e seguro) ---------- */
function tfInline(s){
  const codigos = [];
  s = String(s).replace(/`([^`]+)`/g, (m, c) => { codigos.push(c); return '\u0001' + (codigos.length - 1) + '\u0001'; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>');
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, (m, a, u) => a + '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^\w*])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>').replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0001(\d+)\u0001/g, (m, k) => '<code>' + esc(codigos[+k]) + '</code>');
}
function tfMd(src, comCaixas){
  const L = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  let h = '', k = 0, caixa = 0;
  const celulas = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  while (k < L.length){
    const l = L[k];
    if (/^\s*```/.test(l)){ const cod = []; k++; while (k < L.length && !/^\s*```/.test(L[k])){ cod.push(L[k]); k++; } k++; h += '<pre><code>' + esc(cod.join('\n')) + '</code></pre>'; continue; }
    if (/^\s*$/.test(l)){ k++; continue; }
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))){ const n = m[1].length + 2; h += '<h' + n + '>' + tfInline(m[2]) + '</h' + n + '>'; k++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)){ h += '<hr>'; k++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && k + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[k + 1])){
      const cab = celulas(l); k += 2; const linhas = [];
      while (k < L.length && /^\s*\|.*\|\s*$/.test(L[k])){ linhas.push(celulas(L[k])); k++; }
      h += '<div class="tf-md-tab"><table><thead><tr>' + cab.map(c => '<th>' + tfInline(c) + '</th>').join('') + '</tr></thead><tbody>' + linhas.map(r => '<tr>' + cab.map((_, j) => '<td>' + tfInline(r[j] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    if (/^>\s?/.test(l)){ const q = []; while (k < L.length && /^>\s?/.test(L[k])){ q.push(L[k].replace(/^>\s?/, '')); k++; } h += '<blockquote>' + q.map(tfInline).join('<br>') + '</blockquote>'; continue; }
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(l)){
      let li = '';
      while (k < L.length && (m = L[k].match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/))){ const f = m[1] !== ' ';
        li += '<li class="tf-md-ck' + (f ? ' feito' : '') + '"><label><input type="checkbox"' + (f ? ' checked' : '') + (comCaixas ? ' data-tf-md-ck="' + caixa + '"' : ' disabled') + '><span>' + tfInline(m[2]) + '</span></label></li>'; caixa++; k++; }
      h += '<ul class="tf-md-tarefas">' + li + '</ul>'; continue;
    }
    if (/^\s*[-*]\s+/.test(l)){ let li = ''; while (k < L.length && /^\s*[-*]\s+(?!\[[ xX]\])/.test(L[k])){ li += '<li>' + tfInline(L[k].replace(/^\s*[-*]\s+/, '')) + '</li>'; k++; } h += '<ul>' + li + '</ul>'; continue; }
    if (/^\s*\d+[.)]\s+/.test(l)){ let li = ''; while (k < L.length && /^\s*\d+[.)]\s+/.test(L[k])){ li += '<li>' + tfInline(L[k].replace(/^\s*\d+[.)]\s+/, '')) + '</li>'; k++; } h += '<ol>' + li + '</ol>'; continue; }
    const p = []; while (k < L.length && L[k].trim() && !/^(#{1,3}\s|>|\s*```|\s*[-*]\s+|\s*\d+[.)]\s+|\s*\|.*\|\s*$|\s*(-{3,}|\*{3,})\s*$)/.test(L[k])){ p.push(L[k]); k++; }
    if (!p.length){ p.push(l); k++; }
    h += '<p>' + p.map(tfInline).join('<br>') + '</p>';
  }
  return h;
}
// marcar uma caixinha "- [ ]" direto no texto lido
function tfTrocarCaixa(txt, n){ let c = -1; return String(txt || '').split('\n').map(l => { const m = l.match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/); if (!m) return l; c++; return c === n ? m[1] + (m[2] === ' ' ? 'x' : ' ') + m[3] : l; }).join('\n'); }

const TF_BARRA = [
  ['b', 'Negrito (Ctrl+B)', '<b>B</b>'], ['i', 'Itálico (Ctrl+I)', '<i>I</i>'], ['s', 'Riscado', '<s>S</s>'], ['h', 'Título', 'T'],
  ['ul', 'Lista', TF_SV('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>')],
  ['ol', 'Lista numerada', TF_SV('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5h1v3M4 11h2l-2 3h2M4 17h2v3H4"/>')],
  ['ck', 'Lista de tarefas', TF_SV('<rect x="3" y="5" width="5" height="5"/><path d="M11 7.5h10M3 16l2 2 3-4M11 16.5h10"/>')],
  ['q', 'Citação', TF_SV('<path d="M5 7h5v5H7l-2 4M14 7h5v5h-3l-2 4"/>')],
  ['c', 'Código', TF_SV('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>')],
  ['a', 'Link', TF_SV('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')],
  ['t', 'Tabela', TF_SV('<rect x="3" y="4" width="18" height="16"/><path d="M3 10h18M3 15h18M10 4v16"/>')]
];
function tfFormatar(ta, k){
  const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, sel = v.slice(a, b);
  const envolve = (antes, depois, vazio) => { const t = sel || vazio; ta.value = v.slice(0, a) + antes + t + depois + v.slice(b); ta.setSelectionRange(a + antes.length, a + antes.length + t.length); };
  const porLinha = f => { const ini = v.lastIndexOf('\n', a - 1) + 1, fimL = v.indexOf('\n', b); const fim = fimL < 0 ? v.length : fimL;
    const bloco = v.slice(ini, fim).split('\n').map(f).join('\n'); ta.value = v.slice(0, ini) + bloco + v.slice(fim); ta.setSelectionRange(ini, ini + bloco.length); };
  if (k === 'b') envolve('**', '**', 'texto em negrito');
  else if (k === 'i') envolve('_', '_', 'texto em itálico');
  else if (k === 's') envolve('~~', '~~', 'texto riscado');
  else if (k === 'h') porLinha(l => l.startsWith('## ') ? l.slice(3) : '## ' + l.replace(/^#+\s*/, ''));
  else if (k === 'ul') porLinha(l => '- ' + l.replace(/^\s*[-*]\s+/, ''));
  else if (k === 'ol') { let n = 0; porLinha(l => (++n) + '. ' + l.replace(/^\s*\d+[.)]\s+/, '')); }
  else if (k === 'ck') porLinha(l => '- [ ] ' + l.replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/, ''));
  else if (k === 'q') porLinha(l => '> ' + l.replace(/^>\s?/, ''));
  else if (k === 'c') { if (sel.includes('\n')) envolve('```\n', '\n```', ''); else envolve('`', '`', 'código'); }
  else if (k === 'a') { const t = sel || 'texto do link'; const ins = '[' + t + '](https://)'; ta.value = v.slice(0, a) + ins + v.slice(b); const p = a + t.length + 3; ta.setSelectionRange(p, p + 8); }
  else if (k === 't') { const ins = (a && v[a - 1] !== '\n' ? '\n' : '') + '| Coluna 1 | Coluna 2 |\n| --- | --- |\n| Valor | Valor |\n'; ta.value = v.slice(0, a) + ins + v.slice(b); ta.setSelectionRange(a + ins.indexOf('Coluna 1'), a + ins.indexOf('Coluna 1') + 8); }
  ta.focus(); ta.dispatchEvent(new Event('input', {bubbles:true}));
}

/* ---------- datas: lembrete e repetição ---------- */
const tfDiaSem = ['dom','seg','ter','qua','qui','sex','sáb'];
function tfQuando(ts){
  const d = new Date(ts); if (isNaN(d)) return '';
  const hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const dia = new Date(d); dia.setHours(0, 0, 0, 0); const dif = Math.round((dia - HOJE) / 864e5);
  const qual = dif === 0 ? 'hoje' : dif === 1 ? 'amanhã' : dif === -1 ? 'ontem' : tfDiaSem[d.getDay()] + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return qual + ' às ' + hh;
}
const tfLocal = d => { const x = new Date(d); return iso(x) + 'T' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
const FREQ = {dia:['dia','dias'], semana:['semana','semanas'], mes:['mês','meses'], ano:['ano','anos']};
function tfTextoRepete(r){
  if (!r || !r.freq) return '';
  const n = +r.a_cada || 1;
  const base = n === 1 ? {dia:'Todo dia', semana:'Toda semana', mes:'Todo mês', ano:'Todo ano'}[r.freq] : 'A cada ' + n + ' ' + FREQ[r.freq][1];
  return base + (r.ate ? ', até ' + fmtData(r.ate) : '');
}
function tfSomar(s, r){
  const d = parse(s); if (!d) return null; const n = +r.a_cada || 1;
  if (r.freq === 'dia') d.setDate(d.getDate() + n);
  else if (r.freq === 'semana') d.setDate(d.getDate() + 7 * n);
  else { const dia = d.getDate(); d.setDate(1); if (r.freq === 'mes') d.setMonth(d.getMonth() + n); else d.setFullYear(d.getFullYear() + n);
    const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(dia, ult)); }
  return iso(d);
}

/* ---------- foto e montagem de itens (duplicar, modelos, repetição) ---------- */
function tfFotoItem(i, o){
  o = o || {};
  const f = {tipo:i.tipo, titulo:i.titulo, desc:i.desc || '', prio:i.prio, est:i.est, pontos:i.pontos, vis:i.vis,
    check:(i.check || []).map(c => ({t:c.t, grupo:c.grupo || ''})), cf:Object.assign({}, i.cf || {}), etiquetas:(i.etiquetas || []).slice()};
  if (o.pessoas){ f.resp = i.resp || null; f.membros = (i.membros || []).slice(); }
  if (o.datas){ f.ini = i.ini || null; f.fim = i.fim || null; f.alvo = i.alvo || null; }
  if (o.escopo || o.manterWs) f.wsRef = i.ws;
  if (o.manterWs) f.manterWs = true;
  if (o.filhos !== false) f.filhos = D.issues.filter(x => x.pai === i.id && !x.arquivado && (!o.escopo || o.escopo.has(x.ws))).map(x => tfFotoItem(x, o));
  return f;
}
function tfMontarItem(f, ws, pai, extra, criados, mapaWs){
  // subitem de outra frente: vai para a frente certa (na cópia, a frente nova equivalente)
  const wsUsa = (mapaWs && f.wsRef && mapaWs[f.wsRef]) || (f.manterWs && f.wsRef && byId('ws', f.wsRef) ? f.wsRef : ws);
  const ni = novoIssue(Object.assign({tipo:f.tipo || 'task', titulo:f.titulo || 'Sem título', desc:f.desc || '', prio:f.prio || 'medium', est:f.est == null ? 0 : f.est, vis:f.vis || 'interno',
    ws:wsUsa, pai:pai || null, resp:f.resp && pessoa(f.resp) ? f.resp : null, status:'todo', rep:tfEu() || null,
    check:(f.check || []).map(c => ({t:c.t, f:false, grupo:c.grupo || ''}))}, f.ini !== undefined ? {ini:f.ini, fim:f.fim, alvo:f.alvo} : {}, extra || {}));
  ni.pontos = f.pontos == null ? undefined : f.pontos;
  ni.cf = Object.assign({}, f.cf || {});
  ni.etiquetas = (f.etiquetas || []).filter(t => byId('tags', t)); ni.membros = (f.membros || []).filter(p => pessoa(p)); ni.observadores = []; ni.votos = [];
  D.issues.push(ni); if (criados) criados.push(ni);
  (f.filhos || []).forEach(x => tfMontarItem(x, wsUsa, ni.id, null, criados, mapaWs));
  return ni;
}
const tfContarFoto = f => 1 + (f.filhos || []).reduce((s, x) => s + tfContarFoto(x), 0);

/* ---------- foto e montagem da estrutura (projeto, produto, aplicação, frente) ---------- */
function tfFotoNo(chave, o){
  o = o || {};
  const [tipo, id] = chave.split(':');
  const ficha = k => o.ficha && D.sheets && D.sheets[k] ? tfClone(D.sheets[k]) : undefined;
  const tags = (t, x) => D.tagLinks.filter(l => l.tipo === t && l.id === x).map(l => l.tag);
  const escopo = new Set(tfDentro(chave).ws), oi = Object.assign({}, o, {escopo});
  const raiz = i => !(i.pai && D.issues.some(p => p.id === i.pai && !p.arquivado && escopo.has(p.ws)));
  const fotoWs = w => ({tipo:'frente', ref:w.id, nome:w.nome, wip:w.wip == null ? null : w.wip, ficha:ficha('ws:' + w.id), tags:tags('ws', w.id),
    itens: o.itens ? D.issues.filter(i => i.ws === w.id && !i.arquivado && raiz(i)).map(i => tfFotoItem(i, oi)) : []});
  const fotoApp = a => ({tipo:'aplicacao', nome:a.nome, plataforma:a.plataforma || 'web', origemCodigo:a.origemCodigo || 'proprio', servico:a.servico || '', ficha:ficha('app:' + a.id), tags:tags('app', a.id),
    filhos:D.ws.filter(w => w.app === a.id).map(fotoWs)});
  const fotoProd = p => ({tipo:'produto', nome:p.nome, ficha:ficha('product:' + p.id), tags:tags('product', p.id), filhos:D.apps.filter(a => a.product === p.id).map(fotoApp)});
  if (tipo === 'ws') return fotoWs(byId('ws', id));
  if (tipo === 'app') return fotoApp(byId('apps', id));
  if (tipo === 'product') return fotoProd(byId('products', id));
  if (tipo === 'project'){ const p = byId('projects', id);
    return {tipo:'projeto', nome:p.nome, origem:p.origem || 'greenfield', ficha:ficha('project:' + p.id), tags:tags('project', p.id),
      filhos:D.products.filter(x => x.project === p.id).map(fotoProd).concat(D.apps.filter(a => a.project === p.id && !a.product).map(fotoApp))}; }
  return null;
}
// onde montar: {client} para projeto, {project} para produto, {project, product} para aplicação, {app} para frente
function tfMontarNo(f, onde, nome, criados){
  const c = criados || {nos:0, itens:0}, mapa = {}, pendentes = [];
  const poeFicha = (k, fx) => { if (fx){ D.sheets = D.sheets || {}; D.sheets[k] = tfClone(fx); } };
  const poeTags = (t, x, tg) => (tg || []).forEach(tag => { if (byId('tags', tag)) D.tagLinks.push({tag, tipo:t, id:x}); });
  const ws = (fx, app, nm) => { const w = {id:uid('ws'), app, nome:nm || fx.nome, status:'active', motivo:'', wip:fx.wip == null ? 3 : fx.wip}; D.ws.push(w); c.nos++;
    poeFicha('ws:' + w.id, fx.ficha); poeTags('ws', w.id, fx.tags); if (fx.ref) mapa[fx.ref] = w.id; (fx.itens || []).forEach(i => pendentes.push([i, w.id])); return 'ws:' + w.id; };
  const app = (fx, project, product, nm) => { const a = {id:uid('ap'), project, product:product || null, nome:nm || fx.nome, plataforma:fx.plataforma || 'web', origemCodigo:fx.origemCodigo || 'proprio', servico:fx.servico || '', status:'active', motivo:''};
    D.apps.push(a); c.nos++; poeFicha('app:' + a.id, fx.ficha); poeTags('app', a.id, fx.tags); (fx.filhos || []).forEach(w => ws(w, a.id)); return 'app:' + a.id; };
  const prod = (fx, project, nm) => { const pj = byId('projects', project); const p = {id:uid('pr'), project, client:pj ? pj.client : '', nome:nm || fx.nome, status:'active', motivo:''};
    D.products.push(p); c.nos++; poeFicha('product:' + p.id, fx.ficha); poeTags('product', p.id, fx.tags); (fx.filhos || []).forEach(a => app(a, project, p.id)); return 'product:' + p.id; };
  const itens = r => { const lst = []; pendentes.forEach(([i, w]) => tfMontarItem(i, w, null, null, lst, mapa)); c.itens += lst.length; return r; };
  if (f.tipo === 'frente') return itens(ws(f, onde.app, nome));
  if (f.tipo === 'aplicacao') return itens(app(f, onde.project, onde.product, nome));
  if (f.tipo === 'produto') return itens(prod(f, onde.project, nome));
  if (f.tipo === 'projeto'){ const p = {id:uid('pj'), client:onde.client, nome:nome || f.nome, status:'active', motivo:'', origem:f.origem || 'greenfield', inicio:iso(HOJE), alvo:iso(dAdd(HOJE, 90))};
    D.projects.push(p); c.nos++; poeFicha('project:' + p.id, f.ficha); poeTags('project', p.id, f.tags);
    (f.filhos || []).forEach(x => { if (x.tipo === 'produto') prod(x, p.id); else if (x.tipo === 'aplicacao') app(x, p.id, null); });
    return itens('project:' + p.id); }
  return null;
}
// o que fica embaixo de um ponto (para avisar antes de excluir)
function tfDentro(chave){
  const [tipo, id] = chave.split(':');
  const ws = tipo === 'ws' ? [id] : D.ws.filter(w => { const a = byId('apps', w.app); if (!a) return false;
    if (tipo === 'app') return a.id === id; if (tipo === 'product') return a.product === id; if (tipo === 'project') return a.project === id;
    if (tipo === 'client') return (byId('projects', a.project) || {}).client === id; return false; }).map(w => w.id);
  const apps = tipo === 'app' ? [id] : D.apps.filter(a => (tipo === 'product' && a.product === id) || (tipo === 'project' && a.project === id) || (tipo === 'client' && (byId('projects', a.project) || {}).client === id)).map(a => a.id);
  const prods = tipo === 'product' ? [id] : D.products.filter(p => (tipo === 'project' && p.project === id) || (tipo === 'client' && (byId('projects', p.project) || {}).client === id)).map(p => p.id);
  const projs = tipo === 'project' ? [id] : tipo === 'client' ? D.projects.filter(p => p.client === id).map(p => p.id) : [];
  const itens = D.issues.filter(i => ws.includes(i.ws)).map(i => i.id);
  return {ws, apps, prods, projs, itens};
}
function tfResumoDentro(chave){
  const d = tfDentro(chave), [tipo] = chave.split(':'); const p = [];
  const n = (q, um, varios) => q ? q + ' ' + (q === 1 ? um : varios) : '';
  if (tipo === 'client') p.push(n(d.projs.length, 'projeto', 'projetos'));
  if (tipo === 'client' || tipo === 'project') p.push(n(d.prods.length, 'produto', 'produtos'));
  if (tipo !== 'app' && tipo !== 'ws') p.push(n(d.apps.length, 'aplicação', 'aplicações'));
  if (tipo !== 'ws') p.push(n(d.ws.length, 'frente', 'frentes'));
  p.push(n(d.itens.length, 'item', 'itens'));
  const f = p.filter(Boolean); return f.length ? f.slice(0, -1).join(', ') + (f.length > 1 ? ' e ' : '') + f[f.length - 1] : '';
}
const tfObjNo = chave => { const [t, id] = chave.split(':'); return byId({client:'clients', project:'projects', product:'products', app:'apps', ws:'ws'}[t], id); };

/* ---------- DUPLICAR ---------- */
function tfDuplicarItem(i){
  const temFilhos = D.issues.some(x => x.pai === i.id && !x.arquivado);
  modal('Duplicar item', '<div class="grade-form"><label class="lb largo">Nome da cópia<input class="campo" id="tf-dp-n" value="' + esc(i.titulo + ' (cópia)') + '"></label></div>' +
    '<div class="tf-opcoes"><label><input type="checkbox" id="tf-dp-ck" checked> Copiar a checklist</label>' +
    (temFilhos ? '<label><input type="checkbox" id="tf-dp-f" checked> Copiar os itens de dentro (subitens)</label>' : '') +
    '<label><input type="checkbox" id="tf-dp-p" checked> Manter responsável, pessoas e etiquetas</label><label><input type="checkbox" id="tf-dp-d" checked> Manter as datas</label></div>' +
    '<p class="sec tf-nota">A cópia começa em A fazer, sem comentários e sem tempo lançado.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Duplicar', acao:dl => {
      const nome = $('#tf-dp-n', dl).value.trim(); if (!nome){ toast('Escreva o nome da cópia'); return false; }
      const o = {filhos:temFilhos && $('#tf-dp-f', dl).checked, pessoas:$('#tf-dp-p', dl).checked, datas:$('#tf-dp-d', dl).checked, manterWs:true};
      let nova;
      tfComDesfazer('Item duplicado.', () => {
        const f = tfFotoItem(i, o); f.titulo = nome; if (!$('#tf-dp-ck', dl).checked) f.check = [];
        if (!o.pessoas) f.etiquetas = [];
        nova = tfMontarItem(f, i.ws, i.pai, {sprint:i.sprint || undefined, marco:i.marco || undefined});
        registrar('criou', nova, nova.titulo + ' (cópia de ' + i.titulo + ')');
      }, [{txt:'Abrir a cópia', acao:() => nova && abrirItem(nova.id)}]);
      if (nova) abrirItem(nova.id);
    }}]);
}
function tfDuplicarNo(chave){
  const [tipo, id] = chave.split(':'), o0 = tfObjNo(chave); if (!o0) return;
  const temItens = tfDentro(chave).itens.length;
  modal('Duplicar ' + esc(o0.nome), '<div class="grade-form"><label class="lb largo">Nome da cópia<input class="campo" id="tf-dn-n" value="' + esc(o0.nome + ' (cópia)') + '"></label></div>' +
    '<div class="tf-opcoes">' + (temItens ? '<label><input type="checkbox" id="tf-dn-i" checked> Copiar os itens (' + temItens + ')</label>' : '') + '<label><input type="checkbox" id="tf-dn-f" checked> Copiar a ficha técnica</label></div>' +
    '<p class="sec tf-nota">Vai junto tudo o que está dentro (' + (tfResumoDentro(chave) || 'nada ainda') + '). Os itens copiados começam em A fazer, sem comentários e sem tempo lançado. Etapas cumpridas e custos não são copiados.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Duplicar', acao:dl => {
      const nome = $('#tf-dn-n', dl).value.trim(); if (!nome){ toast('Escreva o nome da cópia'); return false; }
      const f = tfFotoNo(chave, {itens:temItens && $('#tf-dn-i', dl).checked, ficha:$('#tf-dn-f', dl).checked, datas:true, pessoas:true});
      const onde = tipo === 'ws' ? {app:o0.app} : tipo === 'app' ? {project:o0.project, product:o0.product} : tipo === 'product' ? {project:o0.project} : {client:o0.client};
      let nova;
      tfComDesfazer('"' + nome + '" criado.', () => { nova = tfMontarNo(f, onde, nome); if (nova){ abrirArvore(nova); UI.sel = nova; UI.view = 'dashboard'; salvarUI(); } },
        [{txt:'Abrir', acao:() => { if (nova && tfObjNo(nova)){ UI.sel = nova; salvarUI(); abrirModulo('operacoes'); } }}]);
      if (UI.modulo === 'operacoes') rOperacoes();
    }}]);
}

/* ---------- MODELOS ---------- */
async function tfListarModelos(forcar){
  const sb = tfSb();
  if (!sb){ D.modelos = D.modelos || []; return D.modelos; }
  if (TF.modelos && !forcar) return TF.modelos;
  const {data, error} = await sb.from('modelos').select('id,tipo,nivel,nome,descricao,conteudo,criado_em').order('nome');
  if (error){ toast('Não deu para ler os modelos: ' + tfErro(error)); return TF.modelos || []; }
  TF.modelos = data || []; return TF.modelos;
}
async function tfGravarModelo(m){
  const sb = tfSb();
  if (!sb){ D.modelos = D.modelos || []; const novo = Object.assign({id:uid('md'), criado_em:new Date().toISOString()}, m); D.modelos.push(novo); salvar(); return novo; }
  const {data, error} = await sb.from('modelos').insert(m).select('id,tipo,nivel,nome,descricao,conteudo,criado_em');
  if (error || !data || !data.length){ toast('Não deu para salvar o modelo: ' + tfErro(error || 'o banco não confirmou')); return null; }
  TF.modelos = (TF.modelos || []).concat(data); return data[0];
}
async function tfApagarModelo(id){
  const sb = tfSb();
  if (!sb){ D.modelos = (D.modelos || []).filter(m => m.id !== id); salvar(); return true; }
  const {data, error} = await sb.from('modelos').delete().eq('id', id).select('id');
  if (error || !data || !data.length){ toast('Não deu para apagar o modelo: ' + tfErro(error || 'sem permissão')); return false; }
  TF.modelos = (TF.modelos || []).filter(m => m.id !== id); return true;
}
async function tfRenomearModelo(id, nome){
  const sb = tfSb();
  if (!sb){ const m = (D.modelos || []).find(x => x.id === id); if (m) m.nome = nome; salvar(); return true; }
  const {data, error} = await sb.from('modelos').update({nome}).eq('id', id).select('id');
  if (error || !data || !data.length){ toast('Não deu para renomear: ' + tfErro(error || 'sem permissão')); return false; }
  const m = (TF.modelos || []).find(x => x.id === id); if (m) m.nome = nome; return true;
}
function tfSalvarItemComoModelo(i){
  const temFilhos = D.issues.some(x => x.pai === i.id && !x.arquivado);
  modal('Salvar como modelo', '<p class="sec tf-nota" style="margin-top:0">Um modelo guarda este item para criar outros iguais depois, com um clique.</p>' +
    '<div class="grade-form"><label class="lb largo">Nome do modelo<input class="campo" id="tf-mi-n" value="' + esc(i.titulo) + '"></label><label class="lb largo">Para que serve (opcional)<input class="campo" id="tf-mi-d" placeholder="Ex.: todo bug que chega pelo Service Desk"></label></div>' +
    '<div class="tf-opcoes"><label><input type="checkbox" checked disabled> Tipo, título, prioridade e estimativa</label><label><input type="checkbox" id="tf-mi-desc" checked> Descrição</label><label><input type="checkbox" id="tf-mi-ck" checked> Checklist (' + (i.check || []).length + ')</label>' +
    (temFilhos ? '<label><input type="checkbox" id="tf-mi-f" checked> Itens de dentro (subitens)</label>' : '') + '<label><input type="checkbox" id="tf-mi-tg"> Etiquetas</label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar modelo', acao:dl => {
      const nome = $('#tf-mi-n', dl).value.trim(); if (!nome){ toast('Dê um nome ao modelo'); return false; }
      const f = tfFotoItem(i, {filhos:temFilhos && $('#tf-mi-f', dl).checked});
      if (!$('#tf-mi-desc', dl).checked) f.desc = ''; if (!$('#tf-mi-ck', dl).checked) f.check = []; if (!$('#tf-mi-tg', dl).checked) f.etiquetas = [];
      f.cf = {};
      tfGravarModelo({tipo:'item', nome, descricao:$('#tf-mi-d', dl).value.trim() || null, conteudo:f}).then(m => { if (m) tfAviso('Modelo "' + nome + '" salvo. Use no botão ⋯ de uma frente, em "Novo a partir de modelo".'); });
    }}]);
}
function tfSalvarNoComoModelo(chave){
  const o0 = tfObjNo(chave), [tipo] = chave.split(':'); if (!o0) return;
  const temItens = tfDentro(chave).itens.length;
  modal('Salvar ' + esc(o0.nome) + ' como modelo', '<p class="sec tf-nota" style="margin-top:0">O modelo guarda a estrutura (' + (tfResumoDentro(chave) || 'só este ponto') + ') para montar outra igual depois.</p>' +
    '<div class="grade-form"><label class="lb largo">Nome do modelo<input class="campo" id="tf-mn-n" value="' + esc(o0.nome) + '"></label><label class="lb largo">Para que serve (opcional)<input class="campo" id="tf-mn-d" placeholder="Ex.: aplicação web com frente, back e banco"></label></div>' +
    '<div class="tf-opcoes">' + (temItens ? '<label><input type="checkbox" id="tf-mn-i" checked> Incluir os itens (' + temItens + '), sem datas e sem responsáveis</label>' : '') + '<label><input type="checkbox" id="tf-mn-f"> Incluir a ficha técnica</label></div>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar modelo', acao:dl => {
      const nome = $('#tf-mn-n', dl).value.trim(); if (!nome){ toast('Dê um nome ao modelo'); return false; }
      const f = tfFotoNo(chave, {itens:temItens && $('#tf-mn-i', dl).checked, ficha:$('#tf-mn-f', dl).checked});
      tfGravarModelo({tipo:'estrutura', nivel:TIPO_NO_PT[tipo], nome, descricao:$('#tf-mn-d', dl).value.trim() || null, conteudo:f}).then(m => { if (m) tfAviso('Modelo "' + nome + '" salvo.'); });
    }}]);
}
// o que pode nascer dentro de cada ponto
const TF_NIVEIS_DENTRO = {client:['projeto'], project:['produto','aplicacao'], product:['aplicacao'], app:['frente'], ws:['item']};
async function tfUsarModelo(chave){
  const [tipo, id] = chave.split(':'), alvo = tfObjNo(chave); if (!alvo) return;
  const niveis = TF_NIVEIS_DENTRO[tipo] || [];
  const todos = await tfListarModelos(true);
  const lista = todos.filter(m => m.tipo === 'item' ? niveis.includes('item') : niveis.includes(m.nivel));
  const descr = m => m.tipo === 'item' ? (tipoNome(m.conteudo.tipo) + (m.conteudo.check && m.conteudo.check.length ? ' · checklist de ' + m.conteudo.check.length : '') + (m.conteudo.filhos && m.conteudo.filhos.length ? ' · ' + m.conteudo.filhos.length + ' subitens' : ''))
    : NOME_NIVEL[m.nivel] + ((m.conteudo.filhos || []).length ? ' · ' + m.conteudo.filhos.length + ' dentro' : '');
  const corpo = lista.length ? '<p class="sec tf-nota" style="margin-top:0">Escolha o modelo. O novo nasce dentro de <b>' + esc(alvo.nome) + '</b>.</p><ul class="tf-modelos" role="list">' + lista.map(m =>
      '<li><label class="tf-modelo"><input type="radio" name="tf-md" value="' + m.id + '"><span><b>' + esc(m.nome) + '</b><small>' + esc(descr(m)) + (m.descricao ? ' · ' + esc(m.descricao) : '') + '</small></span></label>' +
      '<span class="tf-modelo-acoes"><button type="button" class="ico-btn" data-tf-md-ren="' + m.id + '" aria-label="Renomear ' + esc(m.nome) + '" title="Renomear">' + TF_ICO.editar + '</button><button type="button" class="ico-btn perigo" data-tf-md-del="' + m.id + '" aria-label="Apagar o modelo ' + esc(m.nome) + '" title="Apagar o modelo">' + TF_ICO.lixo + '</button></span></li>').join('') + '</ul>' +
      '<label class="lb largo" style="margin-top:12px">Nome (se quiser trocar)<input class="campo" id="tf-md-nome" placeholder="Fica o nome do modelo"></label>'
    : '<div class="tf-vazio"><b>Nenhum modelo para ' + esc(niveis.map(n => NOME_NIVEL[n].toLowerCase()).join(' ou ')) + ' ainda.</b><p>Para criar um, abra o botão ⋯ de ' + (niveis[0] === 'item' ? 'um item' : 'um ponto parecido da estrutura') + ' e escolha "Salvar como modelo".</p></div>';
  const dlg = modal('Novo a partir de modelo', corpo, lista.length ? [{txt:'Cancelar', cls:'sec'}, {txt:'Criar', acao:dl => {
    const sel = $('input[name="tf-md"]:checked', dl); if (!sel){ toast('Escolha um modelo'); return false; }
    const m = lista.find(x => x.id === sel.value); const nome = $('#tf-md-nome', dl).value.trim();
    let nova, criado;
    if (m.tipo === 'item'){
      const f = tfClone(m.conteudo); if (nome) f.titulo = nome;
      tfComDesfazer('Item criado do modelo "' + m.nome + '".', () => { criado = tfMontarItem(f, id, null); registrar('criou', criado, criado.titulo + ' (do modelo ' + m.nome + ')'); }, [{txt:'Abrir', acao:() => criado && abrirItem(criado.id)}]);
      if (criado) abrirItem(criado.id);
      return;
    }
    const onde = tipo === 'client' ? {client:id} : tipo === 'project' ? {project:id, product:null} : tipo === 'product' ? {project:alvo.project, product:id} : {app:id};
    tfComDesfazer('Criado a partir do modelo "' + m.nome + '".', () => { nova = tfMontarNo(tfClone(m.conteudo), onde, nome || null); if (nova){ UI.abertos[chave] = true; abrirArvore(nova); UI.sel = nova; UI.view = 'dashboard'; salvarUI(); } });
    if (UI.modulo === 'operacoes') rOperacoes();
  }}] : [{txt:'Fechar'}]);
  dlg.addEventListener('click', async e => {
    let b;
    if ((b = e.target.closest('[data-tf-md-del]'))){ const m = lista.find(x => x.id === b.dataset.tfMdDel); if (!m) return;
      if (b.dataset.certeza !== '1'){ b.dataset.certeza = '1'; b.title = 'Clique de novo para apagar'; b.classList.add('confirmar'); toast('Clique de novo no lixo para apagar o modelo "' + m.nome + '"'); return; }
      if (await tfApagarModelo(m.id)){ b.closest('li').remove(); lista.splice(lista.indexOf(m), 1); toast('Modelo apagado'); } }
    else if ((b = e.target.closest('[data-tf-md-ren]'))){ const m = lista.find(x => x.id === b.dataset.tfMdRen); if (!m) return;
      const li = b.closest('li'), bx = $('b', li); if (li.querySelector('.tf-ren')) return;
      bx.insertAdjacentHTML('afterend', '<form class="tf-ren"><input class="campo" value="' + esc(m.nome) + '" aria-label="Novo nome do modelo"><button class="btn sec peq" type="submit">Salvar</button></form>'); bx.hidden = true;
      const fm = $('.tf-ren', li), inp = $('input', fm); inp.focus(); inp.select();
      fm.addEventListener('submit', async ev => { ev.preventDefault(); const n = inp.value.trim(); if (!n) return; if (await tfRenomearModelo(m.id, n)){ bx.textContent = n; } bx.hidden = false; fm.remove(); });
    }
  });
}

/* ---------- LEMBRETE ---------- */
function tfLembrete(i){
  const agora = new Date(), h1 = new Date(agora.getTime() + 3600e3); h1.setSeconds(0, 0);
  const am = new Date(HOJE); am.setDate(am.getDate() + 1); am.setHours(9, 0, 0, 0);
  const seg = new Date(HOJE); seg.setDate(seg.getDate() + ((8 - seg.getDay()) % 7 || 7)); seg.setHours(9, 0, 0, 0);
  const prazo = i.fim ? (() => { const d = parse(i.fim); d.setDate(d.getDate() - 1); d.setHours(9, 0, 0, 0); return d > agora ? d : null; })() : null;
  const atalhos = [['Daqui a 1 hora', h1], ['Amanhã às 9h', am], ['Segunda às 9h', seg]].concat(prazo ? [['Véspera do prazo, 9h', prazo]] : []);
  const gente = D.people.filter(p => p.acesso !== 'stakeholder');
  const valor = i.lembrete ? tfLocal(i.lembrete) : tfLocal(am);
  const dlg = modal('Lembrete', '<p class="sec tf-nota" style="margin-top:0">Na hora marcada, o CicloDev avisa no sininho' + (COM_BANCO ? ', mesmo com o sistema fechado' : '') + '.</p>' +
    '<div class="tf-atalhos">' + atalhos.map(([n, d], k) => '<button type="button" class="btn sec peq" data-tf-lb-at="' + k + '">' + n + '</button>').join('') + '</div>' +
    '<div class="grade-form"><label class="lb">Dia e hora<input class="campo" type="datetime-local" id="tf-lb-q" value="' + valor + '"></label>' +
    '<label class="lb">Avisar quem<select class="sel" id="tf-lb-p">' + gente.map(p => '<option value="' + p.id + '"' + ((i.lembretePara || tfEu()) === p.id ? ' selected' : '') + '>' + esc(p.nome) + (p.id === tfEu() ? ' (você)' : '') + '</option>').join('') + '</select></label></div>',
    [i.lembrete ? {txt:'Tirar lembrete', cls:'fant', acao:() => { tfComDesfazer('Lembrete tirado.', () => { i.lembrete = null; i.lembretePara = null; i.lembreteEnviado = null; }); abrirItem(i.id); }} : null,
      {txt:'Cancelar', cls:'sec'}, {txt:'Salvar lembrete', acao:dl => {
        const v = $('#tf-lb-q', dl).value; const d = new Date(v); if (!v || isNaN(d)){ toast('Escolha o dia e a hora'); return false; }
        if (d < new Date(Date.now() - 60000)){ toast('Escolha uma hora que ainda não passou'); return false; }
        i.lembrete = d.toISOString(); i.lembretePara = $('#tf-lb-p', dl).value || tfEu(); i.lembreteEnviado = null; salvar(); abrirItem(i.id); rView();
        tfAviso('Lembrete marcado para ' + tfQuando(i.lembrete) + '.', [], 4000);
      }}].filter(Boolean));
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-tf-lb-at]'); if (b) $('#tf-lb-q', dlg).value = tfLocal(atalhos[+b.dataset.tfLbAt][1]); });
}
// com a tela aberta: avisa na hora (no banco, a rotina também põe no sininho)
function tfVistos(){ if (!TF.vistos){ try { TF.vistos = JSON.parse(localStorage.getItem('ciclodev-lembretes-vistos') || '{}'); } catch(e){ TF.vistos = {}; } } return TF.vistos; }
function tfChecarLembretes(){
  if (!D || !D.issues) return;
  const agora = Date.now(), vis = tfVistos(), meu = tfEu();
  D.issues.forEach(i => {
    if (!i.lembrete || i.lembreteEnviado || i.arquivado) return;
    const t = new Date(i.lembrete).getTime(); if (!(t <= agora)) return;
    if ((i.lembretePara || meu) !== meu) return;
    const k = i.id + '|' + i.lembrete; if (vis[k]) return;
    vis[k] = agora; try { localStorage.setItem('ciclodev-lembretes-vistos', JSON.stringify(vis)); } catch(e){}
    if (!COM_BANCO){ i.lembreteEnviado = new Date().toISOString(); D.notifs = D.notifs || []; D.notifs.unshift({id:uid('nt'), pessoa:meu, titulo:'Lembrete: ' + i.titulo, txt:'Você pediu para ser lembrado deste item agora.', item:i.id, quando:agora, lida:false}); salvar(); }
    tfAviso('Lembrete: ' + i.titulo, [{txt:'Abrir', acao:() => abrirItem(i.id)}], 15000);
  });
}
setInterval(tfChecarLembretes, 30000);
setTimeout(tfChecarLembretes, 4000);

/* ---------- REPETIÇÃO ---------- */
function tfRepetir(i){
  const r = i.recorrencia || {};
  const dlg = modal('Repetir este item', '<p class="sec tf-nota" style="margin-top:0">Quando este item for concluído, o CicloDev cria o próximo sozinho: mesmo título, mesma checklist (desmarcada) e as datas andam para a frente.</p>' +
    '<div class="grade-form"><label class="lb">Repetir<select class="sel" id="tf-rp-f"><option value="">Não repete</option>' + Object.keys(FREQ).map(k => '<option value="' + k + '"' + (r.freq === k ? ' selected' : '') + '>' + {dia:'Todo dia', semana:'Toda semana', mes:'Todo mês', ano:'Todo ano'}[k] + '</option>').join('') + '</select></label>' +
    '<label class="lb">A cada<span class="tf-cada"><input class="campo" type="number" min="1" max="365" id="tf-rp-n" value="' + (+r.a_cada || 1) + '"><span id="tf-rp-u">' + (r.freq ? FREQ[r.freq][(+r.a_cada || 1) === 1 ? 0 : 1] : '') + '</span></span></label>' +
    '<label class="lb">Até (opcional)<input class="campo" type="date" id="tf-rp-a" value="' + esc(r.ate || '') + '"></label></div>' +
    '<p class="tf-previa" id="tf-rp-v"></p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Salvar', acao:dl => {
      const f = $('#tf-rp-f', dl).value, n = Math.max(1, Math.min(365, parseInt($('#tf-rp-n', dl).value, 10) || 1)), ate = $('#tf-rp-a', dl).value;
      if (!f){ if (i.recorrencia) tfComDesfazer('Este item não repete mais.', () => { i.recorrencia = null; }); abrirItem(i.id); return; }
      i.recorrencia = Object.assign({freq:f, a_cada:n}, ate ? {ate} : {}); salvar(); abrirItem(i.id); rView();
      tfAviso('Pronto: ' + tfTextoRepete(i.recorrencia).toLowerCase() + '.', [], 4000);
    }}]);
  const prev = () => { const f = $('#tf-rp-f', dlg).value, n = parseInt($('#tf-rp-n', dlg).value, 10) || 1; $('#tf-rp-u', dlg).textContent = f ? FREQ[f][n === 1 ? 0 : 1] : '';
    const base = i.fim || i.ini || iso(HOJE); const px = f ? tfSomar(base, {freq:f, a_cada:n}) : null;
    $('#tf-rp-v', dlg).textContent = f ? 'Ao concluir, o próximo nasce com prazo em ' + fmtData(px) + '.' : ''; };
  dlg.addEventListener('input', prev); dlg.addEventListener('change', prev); prev();
}
function tfGrupo(s){ if (STATUS.some(x => x.id === s)) return s; const c = (D.statusCustom || []).find(x => x.id === s); return c ? c.grupo : s; }
function tfProxima(i){
  const r = i.recorrencia; if (!r) return null;
  const base = i.fim || i.ini || iso(HOJE), prox = tfSomar(base, r); if (!prox) return null;
  if (r.ate && prox > r.ate){ i.recorrencia = null; tfAviso('A repetição de "' + i.titulo + '" terminou (ia até ' + fmtData(r.ate) + ').'); return null; }
  const dias = Math.round((parse(prox) - parse(base)) / 864e5);
  const anda = s => s ? iso(dAdd(parse(s), dias)) : s;
  const f = tfFotoItem(i, {filhos:true, pessoas:true, datas:true, manterWs:true});
  f.ini = anda(i.ini); f.fim = anda(i.fim); f.alvo = anda(i.alvo);
  const ni = tfMontarItem(f, i.ws, i.pai, {sprint:undefined, marco:undefined});
  ni.recorrencia = tfClone(r); i.recorrencia = null;
  if (i.lembrete){ ni.lembrete = new Date(new Date(i.lembrete).getTime() + dias * 864e5).toISOString(); ni.lembretePara = i.lembretePara || null; }
  registrar('criou', ni, ni.titulo + ' (próxima repetição)');
  return ni;
}
const _mudarStatusTf = mudarStatus;
mudarStatus = function(i, s){
  const antes = tfGrupo(i.status);
  const r = _mudarStatusTf(i, s);
  if (antes !== 'done' && tfGrupo(i.status) === 'done' && i.recorrencia){
    const ni = tfProxima(i);
    if (ni) setTimeout(() => tfAviso('Próxima repetição criada, com prazo em ' + fmtData(ni.fim) + '.', [{txt:'Abrir', acao:() => abrirItem(ni.id)}]), 50);
  }
  return r;
};

/* ---------- HISTÓRICO DA DESCRIÇÃO ---------- */
function tfVersaoLocal(i){
  if (COM_BANCO) return;
  i._versoes = i._versoes || []; const eu = tfEu(), ult = i._versoes[0];
  if (ult && ult.autor === eu && Date.now() - ult.quando < 600000) { ult.texto = i.desc || ''; ult.quando = Date.now(); }
  else i._versoes.unshift({id:uid('vd'), texto:i.desc || '', autor:eu, quando:Date.now()});
  i._versoes = i._versoes.slice(0, 100);
}
async function tfHistorico(i){
  let vs = [];
  const sb = tfSb();
  if (sb){ const {data, error} = await sb.from('itens_descricao_versoes').select('id,texto,autor_id,criado_em').eq('item_id', i.id).order('criado_em', {ascending:false}).limit(100);
    if (error){ toast('Não deu para ler o histórico: ' + tfErro(error)); return; }
    vs = (data || []).map(v => ({id:v.id, texto:v.texto, autor:v.autor_id, quando:new Date(v.criado_em).getTime()})); }
  else vs = (i._versoes || []).slice();
  const atual = i.desc || '';
  const corpo = vs.length ? '<ol class="tf-hist">' + vs.map((v, k) => '<li class="' + (k === 0 && v.texto === atual ? 'atual' : '') + '"><div class="tf-hist-cab"><span>' + avatar(v.autor) + '<b>' + esc((pessoa(v.autor) || {nome:v.autor ? 'Alguém' : 'Antes do histórico'}).nome) + '</b><small>' + esc(new Date(v.quando).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})) + '</small></span>' +
      (k === 0 && v.texto === atual ? '<span class="tf-selo">Versão atual</span>' : (podeEditar() ? '<button type="button" class="btn sec peq" data-tf-hist-rest="' + k + '">Voltar para esta</button>' : '')) + '</div>' +
      '<details' + (k === 0 ? ' open' : '') + '><summary>Ver o texto</summary><div class="tf-md">' + (v.texto ? tfMd(v.texto) : '<p class="sec">(sem descrição)</p>') + '</div></details></li>').join('') + '</ol>'
    : '<div class="tf-vazio"><b>Ainda não há versões guardadas.</b><p>Cada vez que a descrição muda, a versão fica guardada aqui.</p></div>';
  const dlg = modal('Histórico da descrição', '<p class="sec tf-nota" style="margin-top:0">Toda mudança fica guardada. Edições seguidas da mesma pessoa, em até 10 minutos, ficam numa versão só.</p>' + corpo, [{txt:'Fechar'}]);
  dlg.addEventListener('click', e => { const b = e.target.closest('[data-tf-hist-rest]'); if (!b) return; const v = vs[+b.dataset.tfHistRest];
    dlg.close(); dlg.remove();
    tfComDesfazer('A descrição voltou para a versão de ' + new Date(v.quando).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) + '.', () => { i.desc = v.texto; tfVersaoLocal(i); });
    abrirItem(i.id); });
}

/* ---------- LIXEIRA ---------- */
async function tfDescarregar(){
  if (!COM_BANCO) return;
  if (SYNC.pendente){ clearTimeout(SYNC.timer); await gravarNoBanco(); }
  for (let k = 0; k < 100 && SYNC.rodando; k++) await new Promise(r => setTimeout(r, 100));
}
async function tfRecarregar(){ await carregarDoBanco((typeof MU !== 'undefined' && MU.eu) || null); render(); }
function tfExcluirPergunta(titulo, detalhe, confirmar){
  modal(titulo, '<p style="margin:0">' + detalhe + '</p><p class="sec tf-nota">Vai para a <b>Lixeira</b> e fica lá por 30 dias. Até lá, dá para restaurar com tudo como estava.</p>',
    [{txt:'Cancelar', cls:'sec'}, {txt:'Excluir', cls:'acento', acao:() => { confirmar(); }}]);
}
function tfExcluirItem(i){
  const filhos = descendentes(i.id).size;
  tfExcluirPergunta('Excluir "' + esc(i.titulo) + '"?', filhos ? 'Os ' + filhos + ' itens de dentro vão junto.' : 'O item sai de todas as telas.', async () => {
    if (!COM_BANCO){
      const ids = new Set([i.id, ...descendentes(i.id)]);
      tfComDesfazer('"' + i.titulo + '" foi para a lixeira.', () => {
        const pacote = {issues:D.issues.filter(x => ids.has(x.id))};
        D.issues = D.issues.filter(x => !ids.has(x.id));
        D.lixeira = (D.lixeira || []).concat({id:uid('lx'), tipo:'item', alvo:i.id, nome:i.titulo, onde:caminho('ws:' + i.ws).map(p => p[1]).join(' › '), quando:Date.now(), por:tfEu(), dentro:ids.size - 1, pacote});
        registrar('arquivou', i, i.titulo + ' (lixeira)');
      }, [{txt:'Ver a lixeira', acao:() => abrirModulo('lixeira')}]);
      fecharItem(); return;
    }
    await tfDescarregar();
    const {error} = await tfSb().rpc('lixeira_mover', {p_tipo:'item', p_id:i.id});
    if (error){ toast('Não deu para excluir: ' + tfErro(error)); return; }
    fecharItem(); await tfRecarregar();
    tfAvisoLixeira('"' + i.titulo + '" foi para a lixeira.', 'item', i.id);
  });
}
function tfAvisoLixeira(msg, tipo, id){
  const desfazer = async () => { if (TF.desfazer !== desfazer) return; TF.desfazer = null; const {error} = await tfSb().rpc('lixeira_restaurar', {p_tipo:tipo, p_id:id}); if (error){ toast('Não deu para desfazer: ' + tfErro(error)); return; } TF.lixeira = null; await tfRecarregar(); tfAviso('Restaurado.', [], 3000); };
  TF.desfazer = desfazer; TF.desfazerAte = Date.now() + 60000; TF.lixeira = null;
  tfAviso(msg, [{txt:'Ver a lixeira', acao:() => abrirModulo('lixeira')}, {txt:'Desfazer', acao:desfazer}]);
}
function tfExcluirNo(chave){
  const [tipo, id] = chave.split(':'), o0 = tfObjNo(chave); if (!o0) return;
  const r = tfResumoDentro(chave);
  tfExcluirPergunta('Excluir "' + esc(o0.nome) + '"?', r ? 'Vai junto tudo o que está dentro: ' + esc(r) + '.' : 'Não tem nada dentro.', async () => {
    if (!COM_BANCO){
      const d = tfDentro(chave);
      tfComDesfazer('"' + o0.nome + '" foi para a lixeira.', () => {
        const tira = (lista, ids) => { const s = new Set(ids); const fora = D[lista].filter(x => s.has(x.id)); D[lista] = D[lista].filter(x => !s.has(x.id)); return fora; };
        const pacote = {issues:tira('issues', d.itens), ws:tira('ws', d.ws), apps:tira('apps', d.apps), products:tira('products', d.prods), projects:tira('projects', d.projs), clients:tipo === 'client' ? tira('clients', [id]) : []};
        D.lixeira = (D.lixeira || []).concat({id:uid('lx'), tipo:TIPO_NO_PT[tipo], alvo:id, nome:o0.nome, onde:caminho(chave).slice(0, -1).map(p => p[1]).join(' › '), quando:Date.now(), por:tfEu(), dentro:d.itens.length + d.ws.length + d.apps.length + d.prods.length + d.projs.length - 1, pacote});
        if (UI.sel === chave || !tfObjNo(UI.sel)){ const acima = caminho(chave).slice(-2, -1)[0]; UI.sel = acima && tfObjNo(acima[0]) ? acima[0] : 'all'; UI.view = 'dashboard'; salvarUI(); }
      }, [{txt:'Ver a lixeira', acao:() => abrirModulo('lixeira')}]);
      if (UI.modulo === 'operacoes') rOperacoes(); return;
    }
    await tfDescarregar();
    const {error} = await tfSb().rpc('lixeira_mover', {p_tipo:'no', p_id:id});
    if (error){ toast('Não deu para excluir: ' + tfErro(error)); return; }
    await tfRecarregar();
    tfAvisoLixeira('"' + o0.nome + '" foi para a lixeira.', 'no', id);
  });
}
async function tfLerLixeira(){
  if (!COM_BANCO){ const lim = Date.now() - 30 * 864e5; const antes = (D.lixeira || []).length; D.lixeira = (D.lixeira || []).filter(x => x.quando > lim); if (D.lixeira.length !== antes) salvar();
    return D.lixeira.slice().sort((a, b) => b.quando - a.quando).map(x => ({tipo:x.tipo, id:x.id, alvo:x.alvo, nome:x.nome, onde:x.onde, quando:x.quando, por:(pessoa(x.por) || {}).nome || '', dentro:x.dentro, apaga:x.quando + 30 * 864e5})); }
  const {data, error} = await tfSb().rpc('lixeira_listar');
  if (error) throw error;
  return (data || []).map(x => ({tipo:x.tipo, id:x.id, alvo:x.id, nome:x.nome, onde:x.onde || '', quando:new Date(x.excluido_em).getTime(), por:x.excluido_por || '', dentro:x.dentro || 0, apaga:new Date(x.apaga_em).getTime()}));
}
function tfRestaurarLocal(reg){
  const p = reg.pacote || {};
  const falta = (p.projects || []).find(x => !D.clients.some(c => c.id === x.client) && !(p.clients || []).some(c => c.id === x.client)) ? 'o cliente'
    : (p.products || []).find(x => !D.projects.some(c => c.id === x.project) && !(p.projects || []).some(c => c.id === x.project)) ? 'o projeto'
    : (p.apps || []).find(x => !D.projects.some(c => c.id === x.project) && !(p.projects || []).some(c => c.id === x.project)) ? 'o projeto'
    : (p.ws || []).find(x => !D.apps.some(c => c.id === x.app) && !(p.apps || []).some(c => c.id === x.app)) ? 'a aplicação'
    : (p.issues || []).find(x => !D.ws.some(c => c.id === x.ws) && !(p.ws || []).some(c => c.id === x.ws)) ? 'a frente' : null;
  if (falta){ toast('Restaure antes ' + falta + ' de onde isto saiu (também está na lixeira).'); return false; }
  ['clients','projects','products','apps','ws','issues'].forEach(k => { (p[k] || []).forEach(x => { if (!D[k].some(y => y.id === x.id)) D[k].push(x); }); });
  D.lixeira = D.lixeira.filter(x => x.id !== reg.id);
  return true;
}
const TF_ROT_TIPO = {item:'Item', cliente:'Cliente', projeto:'Projeto', produto:'Produto', aplicacao:'Aplicação', frente:'Frente'};
async function rLixeira(){
  const el = $('#m-lixeira'); if (!el) return;
  const pode = podeEditar();
  if (!TF.lixeira){
    el.innerHTML = '<div class="topo-tela"><div><h1>Lixeira</h1><p class="lead">Lendo...</p></div></div>';
    try { TF.lixeira = await tfLerLixeira(); } catch(e){ el.innerHTML = '<div class="topo-tela"><div><h1>Lixeira</h1></div></div><p class="aviso-faixa tf-lx-corpo">Não deu para ler a lixeira: ' + esc(tfErro(e)) + '</p>'; return; }
    if (UI.modulo !== 'lixeira') return;
  }
  const L = TF.lixeira, dias = t => Math.max(0, Math.ceil((t - Date.now()) / 864e5));
  el.innerHTML = '<div class="topo-tela"><div><h1>Lixeira</h1><p class="lead">O que você exclui fica aqui por 30 dias, com tudo o que estava dentro. Depois disso sai de vez.</p></div>' +
    '<button type="button" class="btn sec" data-tf-lx-reler>Atualizar</button></div><div class="tf-lx-corpo">' +
    (L.length ? '<div class="tabela-rolo"><table class="tabela tf-lx-tab"><thead><tr><th scope="col">O que</th><th scope="col">Onde estava</th><th scope="col">Excluído</th><th scope="col">Sai de vez</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
      L.map((x, k) => '<tr><th scope="row"><span class="tf-lx-tipo">' + esc(TF_ROT_TIPO[x.tipo] || x.tipo) + '</span><b>' + esc(x.nome) + '</b>' + (x.dentro ? '<small>com ' + x.dentro + (x.dentro === 1 ? ' coisa' : ' coisas') + ' dentro</small>' : '') + '</th>' +
        '<td>' + esc(x.onde || '-') + '</td><td>' + esc(new Date(x.quando).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})) + (x.por ? '<small>por ' + esc(x.por) + '</small>' : '') + '</td>' +
        '<td>' + (dias(x.apaga) <= 1 ? 'amanhã' : 'em ' + dias(x.apaga) + ' dias') + '</td>' +
        '<td>' + (pode ? '<div class="acoes"><button type="button" class="btn sec peq" data-tf-lx-rest="' + k + '">' + TF_ICO.restaurar + 'Restaurar</button><button type="button" class="btn fant peq perigo" data-tf-lx-del="' + k + '">Apagar de vez</button></div>' : '') + '</td></tr>').join('') +
      '</tbody></table></div>'
    : '<div class="tf-vazio grande">' + TF_ICO.lixo + '<b>A lixeira está vazia.</b><p>Para excluir um item, abra o item e use o botão ⋯. Para excluir um cliente, projeto, produto, aplicação ou frente, use o ⋯ ao lado do nome na Estrutura.</p></div>') + '</div>';
}
document.addEventListener('click', async e => {
  let b;
  if (e.target.closest('[data-tf-lx-reler]')){ TF.lixeira = null; rLixeira(); return; }
  if ((b = e.target.closest('[data-tf-lx-rest]'))){
    const x = (TF.lixeira || [])[+b.dataset.tfLxRest]; if (!x) return;
    if (!COM_BANCO){ const reg = (D.lixeira || []).find(r => r.id === x.id); if (reg && tfRestaurarLocal(reg)){ salvar(); TF.lixeira = null; rLixeira(); tfAviso('"' + x.nome + '" voltou.', [{txt:'Ir até lá', acao:() => tfIrPara(x)}]); } return; }
    b.disabled = true;
    const {error} = await tfSb().rpc('lixeira_restaurar', {p_tipo:x.tipo === 'item' ? 'item' : 'no', p_id:x.id});
    if (error){ b.disabled = false; toast(tfErro(error)); return; }
    TF.lixeira = null; await carregarDoBanco((typeof MU !== 'undefined' && MU.eu) || null); rLixeira(); tfAviso('"' + x.nome + '" voltou, com tudo o que tinha dentro.', [{txt:'Ir até lá', acao:() => tfIrPara(x)}]);
    return;
  }
  if ((b = e.target.closest('[data-tf-lx-del]'))){
    const x = (TF.lixeira || [])[+b.dataset.tfLxDel]; if (!x) return;
    modal('Apagar de vez "' + esc(x.nome) + '"?', '<p style="margin:0">' + (x.dentro ? 'Junto com ' + x.dentro + (x.dentro === 1 ? ' coisa' : ' coisas') + ' que estava dentro. ' : '') + '<b>Isto não tem volta.</b></p>',
      [{txt:'Cancelar', cls:'sec'}, {txt:'Apagar de vez', cls:'acento', acao:() => { (async () => {
        if (!COM_BANCO){ D.lixeira = (D.lixeira || []).filter(r => r.id !== x.id); salvar(); }
        else { const {error} = await tfSb().rpc('lixeira_apagar', {p_tipo:x.tipo === 'item' ? 'item' : 'no', p_id:x.id}); if (error){ toast('Não deu para apagar: ' + tfErro(error)); return; } }
        TF.lixeira = null; rLixeira(); toast('Apagado de vez');
      })(); }}]);
  }
});
function tfIrPara(x){
  if (x.tipo === 'item'){ const i = byId('issues', x.alvo); if (i){ abrirModulo('operacoes'); abrirItem(i.id); } return; }
  const k = {cliente:'client', projeto:'project', produto:'product', aplicacao:'app', frente:'ws'}[x.tipo] + ':' + x.alvo;
  if (tfObjNo(k)){ abrirArvore(k); UI.sel = k; UI.view = 'dashboard'; salvarUI(); abrirModulo('operacoes'); }
}
const _renderTf = render;
render = function(){ if (UI.modulo === 'lixeira') return rLixeira(); return _renderTf(); };
const _abrirModuloTf = abrirModulo;
abrirModulo = function(id){ if (id === 'lixeira') TF.lixeira = null; return _abrirModuloTf(id); };

/* ---------- menus ⋯ do item e da estrutura ---------- */
function tfAcoesItem(i, ancora){
  const pode = podeEditar();
  tfMenu(ancora, [
    pode && {txt:'Duplicar', sub:'Cria uma cópia ao lado', ico:TF_ICO.copia, acao:() => tfDuplicarItem(i)},
    pode && {txt:'Salvar como modelo', sub:'Para criar outros iguais', ico:TF_ICO.modelo, acao:() => tfSalvarItemComoModelo(i)},
    pode && {txt:i.lembrete ? 'Mudar o lembrete' : 'Lembrete', sub:i.lembrete ? tfQuando(i.lembrete) : 'Avisa no dia e hora que você escolher', ico:TF_ICO.sino, acao:() => tfLembrete(i)},
    pode && {txt:i.recorrencia ? 'Mudar a repetição' : 'Repetir', sub:i.recorrencia ? tfTextoRepete(i.recorrencia) : 'Todo dia, semana, mês ou ano', ico:TF_ICO.repete, acao:() => tfRepetir(i)},
    {txt:'Histórico da descrição', sub:'Ver e voltar versões', ico:TF_ICO.historico, acao:() => tfHistorico(i)},
    pode && {sep:true},
    pode && {txt:'Arquivar', sub:'Sai das telas e fica guardado', ico:TF_ICO.arquivo, acao:() => { tfComDesfazer('Item arquivado.', () => { i.arquivado = true; registrar('arquivou', i); }); fecharItem(); }},
    pode && {txt:'Excluir', sub:'Vai para a lixeira por 30 dias', ico:TF_ICO.lixo, perigo:true, acao:() => tfExcluirItem(i)}
  ]);
}
function tfAcoesNo(chave, ancora){
  const [tipo, id] = chave.split(':'), o0 = tfObjNo(chave); if (!o0) return;
  const arq = o0.status === 'archived';
  const NOVO = {projeto:'novo projeto', produto:'novo produto', aplicacao:'nova aplicação', frente:'nova frente', item:'novo item'};
  const novoTxt = (TF_NIVEIS_DENTRO[tipo] || []).map(n => NOVO[n]).join(' ou ');
  const novoCap = novoTxt.charAt(0).toUpperCase() + novoTxt.slice(1);
  tfMenu(ancora, [
    tipo !== 'ws' && {txt:'Criar dentro', sub:novoCap, ico:TF_ICO.criar, acao:() => criarDentro(chave)},
    {txt:'Novo a partir de modelo', sub:novoCap + ', usando um modelo salvo', ico:TF_ICO.modelo, acao:() => tfUsarModelo(chave)},
    tipo !== 'client' && {txt:'Duplicar', sub:'Com tudo o que tem dentro', ico:TF_ICO.copia, acao:() => tfDuplicarNo(chave)},
    tipo !== 'client' && {txt:'Salvar como modelo', sub:'Guarda a estrutura para repetir', ico:TF_ICO.modelo, acao:() => tfSalvarNoComoModelo(chave)},
    tipo === 'app' && {txt:'Mover', sub:'Para outro produto ou projeto', ico:TF_ICO.mover, acao:() => moverApp(id)},
    {sep:true},
    tipo !== 'client' && {txt:arq ? 'Tirar do arquivo' : 'Arquivar', sub:arq ? 'Volta a ficar ativo' : 'Fica apagado na estrutura, sem sumir', ico:TF_ICO.arquivo, acao:() => { tfComDesfazer(o0.nome + (arq ? ' voltou a ficar ativo.' : ' arquivado.'), () => { o0.status = arq ? 'active' : 'archived'; o0.motivo = ''; }); if (UI.modulo === 'operacoes') rOperacoes(); }},
    {txt:'Excluir', sub:'Vai para a lixeira por 30 dias', ico:TF_ICO.lixo, perigo:true, acao:() => tfExcluirNo(chave)}
  ]);
}
document.addEventListener('click', e => {
  let b;
  if ((b = e.target.closest('[data-tf-acoes-item]'))){ e.preventDefault(); e.stopPropagation(); if ($('#tf-menu') && $('#tf-menu')._ancora === b){ tfFecharMenu(); return; } const i = byId('issues', b.dataset.tfAcoesItem); if (i) tfAcoesItem(i, b); return; }
  if ((b = e.target.closest('[data-tf-acoes-no]'))){ e.preventDefault(); e.stopPropagation(); if ($('#tf-menu') && $('#tf-menu')._ancora === b){ tfFecharMenu(); return; } tfAcoesNo(b.dataset.tfAcoesNo, b); return; }
  if ((b = e.target.closest('[data-tf-lembrete]'))){ e.stopPropagation(); const i = byId('issues', b.dataset.tfLembrete); if (i) tfLembrete(i); return; }
  if ((b = e.target.closest('[data-tf-repetir]'))){ e.stopPropagation(); const i = byId('issues', b.dataset.tfRepetir); if (i) tfRepetir(i); return; }
}, true);

// ⋯ ao lado de cada nome da Estrutura
const _arvoreHTMLTf = arvoreHTML;
arvoreHTML = function(){
  const h = _arvoreHTMLTf(); if (!podeEditar()) return h;
  return h.replace(/(<div class="no-arv[^"]*" data-no="([^"]+)"[\s\S]*?)<\/div>/g, (m, corpo, chave) => chave === 'all' ? m :
    corpo + '<button class="ico-btn tf-mais-arv" type="button" data-tf-acoes-no="' + chave + '" aria-haspopup="menu" aria-expanded="false" aria-label="Mais ações" title="Mais ações">' + TF_ICO.mais + '</button></div>');
};
// ⋯ no alto da tela do ponto escolhido
const _rOperacoesTf = rOperacoes;
rOperacoes = function(){
  _rOperacoesTf();
  if (!podeEditar() || !UI.sel || UI.sel === 'all' || !tfObjNo(UI.sel)) return;
  const ac = $('.ops-titulo .acoes'); if (!ac || ac.querySelector('[data-tf-acoes-no]')) return;
  ac.insertAdjacentHTML('beforeend', '<button class="btn sec tf-mais-cab" type="button" data-tf-acoes-no="' + UI.sel + '" aria-haspopup="menu" aria-expanded="false">' + TF_ICO.mais + '<span>Mais</span></button>');
};

/* ---------- a gaveta do item: ações, lembrete, repetição e descrição formatada ---------- */
function tfDescHTML(i, pode){
  const vazio = !(i.desc || '').trim();
  return '<h4>Descrição<span class="tf-h4-acoes"><button type="button" class="btn fant peq" data-tf-hist-abrir>' + TF_ICO.historico + 'Histórico</button>' + (pode ? '<button type="button" class="btn fant peq" data-tf-editar>' + TF_ICO.editar + 'Editar</button>' : '') + '</span></h4>' +
    '<div class="tf-md tf-ver' + (vazio ? ' vazio' : '') + '"' + (pode ? ' data-tf-ver tabindex="0" role="button" aria-label="Editar a descrição"' : '') + '>' + (vazio ? '<p>' + (pode ? 'Sem descrição. Clique para escrever o que precisa ser feito e como saber que ficou pronto.' : 'Sem descrição.') + '</p>' : tfMd(i.desc, pode)) + '</div>' +
    (pode ? '<div class="tf-editor" hidden><div class="tf-barra" role="toolbar" aria-label="Formatação do texto">' + TF_BARRA.map(([k, t, ic]) => '<button type="button" class="tf-bb" data-tf-fmt="' + k + '" title="' + t + '" aria-label="' + t + '">' + ic + '</button>').join('') +
      '<span class="tf-barra-dir"><button type="button" class="tf-bb tf-bb-txt" data-tf-previa aria-pressed="false">Ver como fica</button></span></div>' +
      '<textarea class="campo tf-area" data-g="desc" rows="9" aria-label="Descrição" placeholder="O que precisa ser feito e como saber que ficou pronto">' + esc(i.desc) + '</textarea><div class="tf-md tf-previa-caixa" hidden></div>' +
      '<div class="tf-ed-rod"><span class="sec">**negrito**, _itálico_, - lista, - [ ] tarefa, `código`. Salva sozinho.</span><button type="button" class="btn peq" data-tf-pronto>Pronto</button></div></div>' : '');
}
function tfChipsItem(i, pode){
  const chips = [];
  if (i.lembrete || pode) chips.push('<button type="button" class="tf-chip' + (i.lembrete ? ' ativo' : '') + (i.lembrete && i.lembreteEnviado ? ' passou' : '') + '"' + (pode ? ' data-tf-lembrete="' + i.id + '"' : ' disabled') + ' title="' + (i.lembrete ? 'Lembrete para ' + esc((pessoa(i.lembretePara || tfEu()) || {nome:''}).nome) : 'Marcar um lembrete') + '">' + TF_ICO.sino +
    (i.lembrete ? (i.lembreteEnviado ? 'Lembrete enviado · ' : 'Lembrete · ') + esc(tfQuando(i.lembrete)) : 'Lembrete') + '</button>');
  if (i.recorrencia || pode) chips.push('<button type="button" class="tf-chip' + (i.recorrencia ? ' ativo' : '') + '"' + (pode ? ' data-tf-repetir="' + i.id + '"' : ' disabled') + ' title="' + (i.recorrencia ? 'Quando concluir, cria o próximo' : 'Fazer este item se repetir') + '">' + TF_ICO.repete +
    (i.recorrencia ? esc(tfTextoRepete(i.recorrencia)) : 'Repetir') + '</button>');
  return chips.length ? '<div class="tf-chips">' + chips.join('') + '</div>' : '';
}
const _abrirItemTf = abrirItem;
abrirItem = function(id){
  _abrirItemTf(id);
  const i = byId('issues', id), g = $('#gaveta-wrap .gaveta'); if (!i || !g) return;
  const pode = podeEditar();
  const fechar = $('.gaveta-cab [data-fechar-gaveta]', g);
  if (fechar && !g.querySelector('[data-tf-acoes-item]')) fechar.insertAdjacentHTML('beforebegin', '<button class="ico-btn tf-mais" type="button" data-tf-acoes-item="' + i.id + '" aria-haspopup="menu" aria-expanded="false" aria-label="Mais ações do item" title="Mais ações">' + TF_ICO.mais + '</button>');
  const faixa = $('.g-faixa', g); if (faixa) faixa.insertAdjacentHTML('afterend', tfChipsItem(i, pode));
  const desc = $('textarea[data-g="desc"]', g); const sec = desc && desc.closest('.g-sec');
  if (sec){ sec.classList.add('tf-desc'); sec.innerHTML = tfDescHTML(i, pode); }
  const arq = $('[data-acao="arquivar-item"]', g); if (arq) arq.remove();   // agora fica no menu ⋯
  const ptsDup = $('select[data-rc-g="pontos"]', g); if (ptsDup && $('select[data-bj-campo="pontos"]', g)) { const l = ptsDup.closest('.d-lin'); if (l) l.remove(); }   // Story points aparecia duas vezes
};
function tfAbrirEditor(g, focar){
  const sec = $('.tf-desc', g); if (!sec) return;
  const ed = $('.tf-editor', sec); if (!ed) return;
  $('.tf-ver', sec).hidden = true; ed.hidden = false;
  const ta = $('.tf-area', ed); ta.style.height = 'auto'; ta.style.height = Math.min(480, Math.max(180, ta.scrollHeight + 4)) + 'px';
  if (focar !== false) ta.focus();
}
function tfFecharEditor(g){
  const i = byId('issues', itemAberto), sec = $('.tf-desc', g); if (!i || !sec) return;
  sec.innerHTML = tfDescHTML(i, podeEditar());
}
document.addEventListener('click', e => {
  const g = e.target.closest('.gaveta'); if (!g) return;
  let b;
  if ((b = e.target.closest('[data-tf-fmt]'))){ const ta = $('.tf-area', g); if (ta) tfFormatar(ta, b.dataset.tfFmt); return; }
  if (e.target.closest('[data-tf-editar]')){ tfAbrirEditor(g); return; }
  if (e.target.closest('[data-tf-pronto]')){ const ta = $('.tf-area', g); if (ta) ta.dispatchEvent(new Event('change', {bubbles:true})); tfFecharEditor(g); return; }
  if (e.target.closest('[data-tf-hist-abrir]')){ const i = byId('issues', itemAberto); if (i) tfHistorico(i); return; }
  if ((b = e.target.closest('[data-tf-previa]'))){ const ed = b.closest('.tf-editor'), ta = $('.tf-area', ed), pv = $('.tf-previa-caixa', ed); const ver = pv.hidden;
    pv.innerHTML = ta.value.trim() ? tfMd(ta.value) : '<p class="sec">Nada escrito ainda.</p>'; pv.hidden = !ver; ta.hidden = ver; b.setAttribute('aria-pressed', String(ver)); b.textContent = ver ? 'Voltar a escrever' : 'Ver como fica'; return; }
  if (e.target.closest('input[data-tf-md-ck]')){ const i = byId('issues', itemAberto); if (!i || !podeEditar()) return; i.desc = tfTrocarCaixa(i.desc, +e.target.dataset.tfMdCk); tfVersaoLocal(i); salvar(); setTimeout(() => tfFecharEditor(g), 0); return; }
  if (e.target.closest('a')) return;
  if (e.target.closest('[data-tf-ver]')) tfAbrirEditor(g);
});
document.addEventListener('keydown', e => {
  const ta = e.target.closest && e.target.closest('.tf-area');
  if (ta && (e.ctrlKey || e.metaKey) && ['b','i'].includes(e.key.toLowerCase())){ e.preventDefault(); tfFormatar(ta, e.key.toLowerCase()); return; }
  if (ta && e.key === 'Escape'){ e.stopPropagation(); ta.dispatchEvent(new Event('change', {bubbles:true})); tfFecharEditor(ta.closest('.gaveta')); return; }
  if (e.target.matches && e.target.matches('[data-tf-ver]') && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); tfAbrirEditor(e.target.closest('.gaveta')); }
}, true);
document.addEventListener('input', e => { if (e.target.classList && e.target.classList.contains('tf-area')){ const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(480, Math.max(180, ta.scrollHeight + 4)) + 'px'; } });
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('.tf-area[data-g="desc"]')){ const i = byId('issues', itemAberto); if (i) tfVersaoLocal(i); } });

// no cartão do Board: sininho e repetição
const _cartaoHTMLTf = cartaoHTML;
cartaoHTML = function(i){
  const h = _cartaoHTMLTf(i); if (!i.lembrete && !i.recorrencia) return h;
  const ic = (i.recorrencia ? '<span class="lk tf-lk" title="' + esc(tfTextoRepete(i.recorrencia)) + '">' + TF_ICO.repete + '</span>' : '') + (i.lembrete && !i.lembreteEnviado ? '<span class="lk tf-lk" title="Lembrete ' + esc(tfQuando(i.lembrete)) + '">' + TF_ICO.sino + '</span>' : '');
  return h.replace('<span class="esq">', '<span class="esq">' + ic);
};

/* ---------- banco: ler e gravar os campos novos; o que está na lixeira não entra ---------- */
const _montarDadosTf = montarDados;
montarDados = function(T, eu){
  // pontos na lixeira (ou dentro de um que está) somem, com tudo o que é deles
  const nos = new Map((T.nos || []).map(n => [n.id, n]));
  const escondido = new Map();
  const naLixeira = id => { if (escondido.has(id)) return escondido.get(id); let n = nos.get(id), r = false, k = 0; while (n && k < 12){ if (n.excluido_em){ r = true; break; } n = nos.get(n.pai_id); k++; } escondido.set(id, r); return r; };
  (T.nos || []).forEach(n => naLixeira(n.id));
  const fora = new Set([...escondido].filter(([, v]) => v).map(([k]) => k));
  const itensFora = new Set((T.itens || []).filter(i => i.excluido_em || fora.has(i.frente_id)).map(i => i.id));
  if (fora.size || itensFora.size){
    const T2 = {};
    Object.keys(T).forEach(t => { const L = T[t]; if (!Array.isArray(L)){ T2[t] = L; return; }
      T2[t] = L.filter(r => !(t === 'nos' && fora.has(r.id)) && !(t === 'itens' && itensFora.has(r.id)) &&
        !(r.no_id && fora.has(r.no_id)) && !(r.frente_id && fora.has(r.frente_id)) && !(r.projeto_id && fora.has(r.projeto_id)) && !(r.aplicacao_id && fora.has(r.aplicacao_id)) &&
        !(r.item_id && itensFora.has(r.item_id)) && !(r.origem_id && itensFora.has(r.origem_id)) && !(r.destino_id && itensFora.has(r.destino_id)) && !(t === 'itens' && r.pai_id && itensFora.has(r.pai_id))); });
    T = T2;
  }
  BANCO.naLixeira = fora;
  const d = _montarDadosTf(T, eu);
  const porId = new Map((T.itens || []).map(r => [r.id, r]));
  d.issues.forEach(i => { const r = porId.get(i.id) || {};
    i.recorrencia = r.recorrencia || null; i.lembrete = r.lembrete_em || null; i.lembretePara = r.lembrete_para || null; i.lembreteEnviado = r.lembrete_enviado_em || null; });
  TF.modelos = null;
  return d;
};
const _linhasDaTelaTf = linhasDaTela;
linhasDaTela = function(d){
  const L = _linhasDaTelaTf(d);
  const porId = new Map(d.issues.map(i => [i.id, i])), temPessoa = new Set(d.people.map(p => p.id));
  (L.itens || []).forEach(r => { const i = porId.get(r.id); if (!i) return;
    r.recorrencia = i.recorrencia && i.recorrencia.freq ? i.recorrencia : null;
    r.lembrete_em = i.lembrete || null;
    r.lembrete_para = i.lembrete && i.lembretePara && temPessoa.has(i.lembretePara) ? i.lembretePara : null; });
  return L;
};

// só nos testes locais (arquivo aberto direto, file://): acesso aos dados para conferir o resultado
if (location.protocol === 'file:') window.__tf = {get D(){ return D; }, get UI(){ return UI; }, get itemAberto(){ return itemAberto; }, byId, abrirItem, fecharItem, rOperacoes, abrirArvore, salvarUI, tfEu, tfChecarLembretes, tfMd};
